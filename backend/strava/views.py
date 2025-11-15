import requests
from django.conf import settings
from django.shortcuts import redirect, HttpResponse
from .models import StravaToken

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
