from django.urls import path
from .views import strava_connect, strava_callback, sync_strava_activities, strava_logout, strava_webhook

urlpatterns = [
    path("connect/", strava_connect),
    path("callback/", strava_callback),
    path("sync/", sync_strava_activities),
    path("logout/", strava_logout),
    path('webhook/', strava_webhook, name='strava_webhook'),
]