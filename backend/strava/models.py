from django.db import models
from django.contrib.auth.models import User


class StravaProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="strava_profile")
    # strava profile
    strava_id = models.IntegerField(unique=True)
    strava_username = models.CharField(max_length=255, blank=True, null=True)
    # strava access token
    access_token = models.CharField(max_length=255)
    refresh_token = models.CharField(max_length=255)
    # activity expires at
    expires_at = models.IntegerField()

    ast_synced_at = models.DateTimeField(null=True, blank=True)
    avatar_url = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.user.username} (Strava: {self.strava_id})"
    