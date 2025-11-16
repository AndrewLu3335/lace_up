from django.urls import path
from .views import strava_connect, strava_callback, sync_strava_activities

urlpatterns = [
    path("connect/", strava_connect),
    path("callback/", strava_callback),
    path("sync/", sync_strava_activities),
]