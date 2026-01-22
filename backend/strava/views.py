import json
import os
import pytz
import requests
from datetime import datetime
from django.conf import settings
from django.shortcuts import redirect, HttpResponse
from django.contrib.auth import logout, login
from django.contrib.auth.models import User
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse, HttpResponseForbidden
from django.utils import timezone
from runs.models import RunRecord
from .models import StravaProfile 


def decode_weather_code(code):
    '''
    OpenMeteo Weather Code
    '''
    mapping = {
        0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
        45: "Fog", 48: "Rime fog", 51: "Light drizzle", 53: "Moderate drizzle",
        55: "Dense drizzle", 61: "Light rain", 63: "Moderate rain", 65: "Heavy rain",
        80: "Rain showers", 95: "Thunderstorm",
    }
    return mapping.get(code, "Unknown")

def get_weather_open_meteo(local_date_str, lat, lon):
    """
    return weather code and temperature based on local_date_str
    local_date_str 示例: "2026-01-22T08:30:00Z"
    """
    try:
        dt_local = datetime.fromisoformat(local_date_str.replace("Z", ""))
        date_query = dt_local.strftime("%Y-%m-%d")
        hour_match = dt_local.strftime("%Y-%m-%dT%H:00")

        #  request url, timezone=auto (let API auto determine timezone based on lat/lon)
        url = (
            f"https://archive-api.open-meteo.com/v1/archive?"
            f"latitude={lat}&longitude={lon}"
            f"&start_date={date_query}&end_date={date_query}"
            f"&hourly=temperature_2m,weathercode"
            f"&timezone=auto" 
        )

        response = requests.get(url).json()
        # Have not received weather data
        if "hourly" not in response:
            return None, None

        times = response["hourly"]["time"]
        temps = response["hourly"]["temperature_2m"]
        codes = response["hourly"]["weathercode"]

        # find the matching hour
        if hour_match in times:
            idx = times.index(hour_match)
            return decode_weather_code(codes[idx]), temps[idx]

        return None, None

    except Exception as e:
        print(f"Weather Error for {local_date_str}: {e}")
        return None, None



def strava_connect(request):
    '''
    Strava Connect View
    '''
    auth_url = (
        "https://www.strava.com/oauth/authorize"
        f"?client_id={settings.STRAVA_CLIENT_ID}"
        "&response_type=code"
        f"&redirect_uri={settings.STRAVA_REDIRECT_URI}"
        "&approval_prompt=auto"
        "&scope=activity:read_all,profile:read_all" # Get user profile and activities
    )
    return redirect(auth_url)


def strava_callback(request):
    '''
    Strava Callback View
    '''
    code = request.GET.get("code")
    if not code:
        return HttpResponse("No code received")

    # 1. Exchange Code for Token
    token_res = requests.post(
        "https://www.strava.com/oauth/token", data={
            "client_id": settings.STRAVA_CLIENT_ID,
            "client_secret": settings.STRAVA_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
        }
    ).json()

    if 'access_token' not in token_res:
        return HttpResponse(f"Strava Error: {token_res}")

    # 2. Extract user info
    access_token = token_res["access_token"]
    refresh_token = token_res["refresh_token"]
    expires_at = token_res["expires_at"]
    athlete = token_res["athlete"]
    avatar_url = athlete.get("profile")
    strava_id = athlete["id"]
    strava_username = athlete.get("username", "")

    # 3. Update StravaProfile
    try:
        # Case A: Existing user logging in
        profile = StravaProfile.objects.get(strava_id=strava_id)
        user = profile.user
        
        # Update Token and avatar
        profile.access_token = access_token
        profile.refresh_token = refresh_token
        profile.expires_at = expires_at
        profile.avatar_url = avatar_url
        profile.save()
        print(f"User {user.username} logged in via Strava.")

    except StravaProfile.DoesNotExist:
        # Case B: New user logging in
        # Create a unique username, prevent conflicts
        new_username = f"runner_{strava_id}"
        
        # Check if Django User already exists (rare, but prevent just in case)
        user, created = User.objects.get_or_create(username=new_username)
        
        # 创建 Profile 绑定
        profile = StravaProfile.objects.create(
            user=user,
            strava_id=strava_id,
            strava_username=strava_username,
            access_token=access_token,
            refresh_token=refresh_token,
            expires_at=expires_at,
            avatar_url=avatar_url,
        )
        print(f"New user {user.username} created via Strava.")

    # 4. Execute Django login (let session take effect)
    login(request, user)

    # 5. Sync activities after login
    sync_count = fetch_and_sync_activities(user, access_token)

    # 6. Redirect back to frontend (with parameters)
    return redirect(f"{settings.FRONTEND_URL}/runs?login_success=1&synced={sync_count}")


def refresh_strava_token(user):
    """
    Refresh Strava token for a specific user when needed
    """
    try:
        profile = user.strava_profile 
    except StravaProfile.DoesNotExist:
        return None

    # If token expires within 60 seconds, refresh it
        response = requests.post(
            "https://www.strava.com/oauth/token", data={
                "client_id": settings.STRAVA_CLIENT_ID,
                "client_secret": settings.STRAVA_CLIENT_SECRET,
                "grant_type": "refresh_token",
                "refresh_token": profile.refresh_token,
            }
        ).json()

        profile.access_token = response["access_token"]
        profile.refresh_token = response["refresh_token"]
        profile.expires_at = response["expires_at"]
        profile.save()

    return profile.access_token


def fetch_and_sync_activities(user, access_token):
    """
    Fetch and sync activities from Strava to database
    """
    # 1. Prepare request
    url = "https://www.strava.com/api/v3/athlete/activities?per_page=100&page=1"
    headers = {"Authorization": f"Bearer {access_token}"}
    
    # 2. Make request
    try:
        res = requests.get(url, headers=headers)
        if res.status_code != 200:
            print(f"⚠️ Error fetching Strava activities: {res.status_code} - {res.text}")
            return 0
        activities = res.json()
    except Exception as e:
        print(f"⚠️ Network error: {e}")
        return 0

    sync_count = 0

    # 3. Iterate activities
    for activity in activities:
        # Only sync running activities
        if activity.get("type") != "Run":
            continue

        strava_activity_id = activity["id"]

        # Must check if this record already exists for this user
        if RunRecord.objects.filter(strava_activity_id=strava_activity_id, user=user).exists():
            continue

        # === Data extraction ===
        distance_km = round(activity["distance"] / 1000, 2)
        duration_minutes = round(activity["moving_time"] / 60, 2)
        avg_hr = activity.get("average_heartrate")
        calories = activity.get("calories")
        polyline = activity.get("map", {}).get("summary_polyline")

       
        local_date_str = activity["start_date_local"]
        try:
            # Parse and mark as UTC, ensure Django stores time correctly
            date_obj = datetime.fromisoformat(local_date_str.replace("Z", "+00:00"))
        except ValueError:
            # As a fallback
            date_obj = datetime.now(pytz.UTC)

        latlng = activity.get("start_latlng")
        # If it's a treadmill run or no GPS coordinates, it's indoor
        is_indoor = activity.get("trainer") or not latlng or len(latlng) != 2
        run_type = "Treadmill Run" if is_indoor else "Outdoor Run"
        weather, temperature = None, None
        
        if not is_indoor:
            weather, temperature = get_weather_open_meteo(
                local_date_str, latlng[0], latlng[1]
            )

        # Create record
        try:
            RunRecord.objects.create(
                user=user,
                strava_activity_id=strava_activity_id,
                distance_km=distance_km,
                duration_minutes=duration_minutes,
                avg_heart_rate=avg_hr,
                calories=calories,
                date=date_obj, 
                run_type=run_type,
                weather=weather,
                temperature_c=temperature,
                polyline=polyline
            )
            sync_count += 1
        except Exception as e:
            print(f"⚠️ Failed to save run {strava_activity_id}: {e}")

    return sync_count


@csrf_exempt
def sync_strava_activities(request):
    '''
    User trigger sync strava activities
    '''
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized"}, status=401)
        
    access_token = refresh_strava_token(request.user)
    if not access_token:
        return JsonResponse({"error": "Strava not connected"}, status=400)
        
    count = fetch_and_sync_activities(request.user, access_token)
    return JsonResponse({"synced_activities": count}, status=200)



@csrf_exempt
def strava_logout(request): 
    '''
    User trigger logout
    '''
    logout(request)
    return JsonResponse({"status": "logged_out"})


@csrf_exempt
def strava_webhook(request):
    '''
    Strava webhook
    '''
    # Verify webhook
    if request.method == 'GET':
        verify_token = "LACEUP_SECRET_TOKEN_2026"
        mode = request.GET.get("hub.mode")
        token = request.GET.get("hub.verify_token")
        challenge = request.GET.get("hub.challenge")

        if mode == "subscribe" and token == verify_token:
            return HttpResponse(json.dumps({"hub.challenge": challenge}), content_type="application/json")
        return HttpResponseForbidden()

    # User deauthorize app
    elif request.method == 'POST':
        try:
            data = json.loads(request.body)
            if data.get('object_type') == 'athlete' and \
               data.get('updates', {}).get('authorized') == 'false':
                
                strava_id = data.get('owner_id')
                print(f"⚠️ User {strava_id} deauthorized app.")
                
                try:
                    profile = StravaProfile.objects.get(strava_id=strava_id)
                    user = profile.user 
                    user.delete()
                    print(f"Profile for {strava_id} deleted.")
                except StravaProfile.DoesNotExist:
                    pass

            return HttpResponse('EVENT_RECEIVED', status=200)
            
        except Exception as e:
            print("Webhook Error:", e)
            return HttpResponse('Server Error', status=500)

    return HttpResponse('Method Not Allowed', status=405)