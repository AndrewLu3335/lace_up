from django.urls import path
from .views import strava_connect, strava_callback

urlpatterns = [
    path("connect/", strava_connect),
    path("callback/", strava_callback),
]