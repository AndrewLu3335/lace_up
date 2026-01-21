from datetime import datetime
import pytz
import requests
from django.conf import settings
from django.shortcuts import redirect, HttpResponse
from django.contrib.auth import logout
from django.views.decorators.csrf import csrf_exempt
from .models import StravaToken
from django.http import JsonResponse
from django.utils import timezone
from runs.models import RunRecord


def decode_weather_code(code):
    """
    Decode the weather code into a human-readable description.

    Args:
        code (int): Weather code to decode

    Returns:
        str: Description of the weather code
    """
    mapping = {
        0: "Clear sky",
        1: "Mainly clear",
        2: "Partly cloudy",
        3: "Overcast",
        45: "Fog",
        48: "Rime fog",
        51: "Light drizzle",
        53: "Moderate drizzle",
        55: "Dense drizzle",
        61: "Light rain",
        63: "Moderate rain",
        65: "Heavy rain",
        80: "Rain showers",
        95: "Thunderstorm",
    }
    return mapping.get(code, "Unknown")

def strava_connect(request):
    auth_url = (
        "https://www.strava.com/oauth/authorize"
        f"?client_id={settings.STRAVA_CLIENT_ID}"
        "&response_type=code"
        f"&redirect_uri={settings.STRAVA_REDIRECT_URI}"
        "&approval_prompt=auto"
        "&scope=activity:read_all"
    )
    return redirect(auth_url)

def strava_callback(request):
    '''
    Handle the callback from Strava after authorization.
    '''
    code = request.GET.get("code")
    if not code:
        return HttpResponse("No code received")

    response = requests.post(
        "https://www.strava.com/oauth/token", data={
            "client_id": settings.STRAVA_CLIENT_ID,
            "client_secret": settings.STRAVA_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
        }
    ).json()

    StravaToken.objects.all().delete()
    StravaToken.objects.create(
        access_token=response["access_token"],
        refresh_token=response["refresh_token"],
        expires_at=response["expires_at"]
    )
    # after login, fetch and sync activities
    sync_count = fetch_and_sync_activities(response["access_token"])

    return redirect(f"{settings.FRONTEND_URL}/runs?login_success=1&synced={sync_count}")

def refresh_strava_token():
    # Helper function to refresh the Strava access token if expired
    token_obj = StravaToken.objects.first()
    if not token_obj:
        return None

    if token_obj.expires_at <= timezone.now().timestamp():
        response = requests.post(
            "https://www.strava.com/oauth/token", data={
                "client_id": settings.STRAVA_CLIENT_ID,
                "client_secret": settings.STRAVA_CLIENT_SECRET,
                "grant_type": "refresh_token",
                "refresh_token": token_obj.refresh_token,
            }
        ).json()

        token_obj.access_token = response["access_token"]
        token_obj.refresh_token = response["refresh_token"]
        token_obj.expires_at = response["expires_at"]
        token_obj.save()

    return token_obj.access_token

def fetch_and_sync_activities(access_token):
     # Fetch activities from Strava 
    # per_page: number of activities to fetch
    url = "https://www.strava.com/api/v3/athlete/activities?per_page=50&page=1"
    headers = {"Authorization": f"Bearer {access_token}"}

    response = requests.get(url, headers=headers)
    activities = response.json()

    sync_count = 0

    for activity in activities:
        if activity["type"] != "Run":
            continue

        strava_id = activity["id"]

        # skip if already exists
        if RunRecord.objects.filter(strava_activity_id= strava_id).exists():
            continue

        distance_km = round(activity["distance"] / 1000, 2)
        duration_minutes = round(activity["moving_time"] / 60, 2)
        avg_hr = activity.get("average_heartrate")
        calories = activity.get("calories")
        run_type = None

        # Convert UTC → Local timezone
        utc_time = datetime.fromisoformat(activity["start_date"][:-1])  # remove Z
        utc_time = utc_time.replace(tzinfo=pytz.UTC)
        LOCAL_TZ = pytz.timezone(settings.LOCAL_TZ)
        local__start_time = utc_time.astimezone(LOCAL_TZ)
        
        latlng = activity.get("start_latlng")
        
        is_indoor = activity.get("trainer") == True or not latlng or len(latlng) != 2
        if is_indoor:
            run_type = "Treadmill Run"
            weather = None
            temperature = None
        # Todo: add other type of running
        else: 
            run_type = "Outdoor Run"
            timestamp = int(local__start_time.timestamp())  
            lat = latlng[0]
            lon = latlng[1]
            weather, temperature = get_weather_open_meteo(timestamp, lat, lon)
        
        polyline = activity.get("map").get("summary_polyline")
            
       
        RunRecord.objects.create(
            strava_activity_id=strava_id,
            distance_km=distance_km,
            duration_minutes=duration_minutes,
            avg_heart_rate=avg_hr,
            calories=calories,
            date=local__start_time,
            run_type=run_type,
            weather=weather,
            temperature_c=temperature,
            polyline=polyline
        )
        sync_count += 1
    return sync_count


@csrf_exempt
def sync_strava_activities(request):
    access_token = refresh_strava_token()
    if not access_token:
        return JsonResponse({"error": "Strava not connected"}, status=400)
    sync_count = fetch_and_sync_activities(access_token)
    return JsonResponse({"synced_activities": sync_count}, status=200)
   

def get_weather_open_meteo(timestamp, lat, lon):
    try:
        toronto_tz = pytz.timezone(settings.LOCAL_TZ)
        dt_local = datetime.fromtimestamp(timestamp, toronto_tz)
        date_str = dt_local.strftime("%Y-%m-%d")
        hour_str = dt_local.strftime("%Y-%m-%dT%H:00")

        url = (
            f"https://archive-api.open-meteo.com/v1/archive?"
            f"latitude={lat}&longitude={lon}"
            f"&start_date={date_str}&end_date={date_str}"
            f"&hourly=temperature_2m,weathercode"
            f"&timezone={settings.LOCAL_TZ}"
        )

        response = requests.get(url).json()

        if "hourly" not in response:
            return None, None

        times = response["hourly"]["time"]
        temps = response["hourly"]["temperature_2m"]
        codes = response["hourly"]["weathercode"]

        if hour_str in times:
            idx = times.index(hour_str)
            return decode_weather_code(codes[idx]), temps[idx]

        return None, None

        return None, None
    except Exception as e:
        print("Error:", e)
        return None, None

@csrf_exempt
def strava_logout(request):
    logout(request)
    return HttpResponse("Logged out successfully")