from datetime import datetime
import pytz
import requests
from django.conf import settings
from django.shortcuts import redirect, HttpResponse
from .models import StravaToken
from django.http import JsonResponse
from django.utils import timezone
from runs.models import RunRecord

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

    return HttpResponse("Strava connected and tokens saved!")

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

def sync_strava_activities(request):
    access_token = refresh_strava_token()
    if not access_token:
        return JsonResponse({"error": "Strava not connected"}, status=400)
    # Fetch activities from Strava 
    # per_page: number of activities to fetch
    url = "https://www.strava.com/api/v3/athlete/activities?per_page=20&page=1"
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

        # Convert UTC → Local timezone
        utc_time = datetime.fromisoformat(activity["start_date"][:-1])  # remove Z
        utc_time = utc_time.replace(tzinfo=pytz.UTC)
        LOCAL_TZ = pytz.timezone("America/Toronto")
        local__start_time = utc_time.astimezone(LOCAL_TZ)

        RunRecord.objects.create(
            strava_activity_id=strava_id,
            distance_km=distance_km,
            duration_minutes=duration_minutes,
            avg_heart_rate=avg_hr,
            calories=calories,
            date=local__start_time,
            run_type="Outdoor Run",
        )
        sync_count += 1

    return JsonResponse({"synced_activities": sync_count})