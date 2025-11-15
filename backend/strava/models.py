from django.db import models


class StravaToken(models.Model):
    access_token = models.CharField(max_length=255)
    refresh_token = models.CharField(max_length=255)
    expires_at = models.IntegerField()

    def __str__(self):
        return "Strava Token"