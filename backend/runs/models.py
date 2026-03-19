from django.db import models
from django.contrib.auth.models import User

class RunRecord(models.Model):
    date = models.DateTimeField()
    distance_km = models.FloatField()
    duration_minutes = models.FloatField()
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='runs')

    @property
    def pace_min_per_km(self):
        if self.distance_km > 0:
            return round(self.duration_minutes / self.distance_km, 2)
        return None
    
    strava_activity_id = models.BigIntegerField(unique=True, null=True, blank=True)
    avg_heart_rate = models.IntegerField(null=True, blank=True)
    max_heart_rate = models.IntegerField(null=True, blank=True)
    # Strava: average_cadence (running: typically total steps per minute)
    average_cadence_spm = models.FloatField(
        null=True,
        blank=True,
        help_text="Average cadence, total steps/min (both feet); sync normalizes Strava Run summary",
    )
    # Estimated when cadence + distance + moving_time available
    stride_length_m = models.FloatField(
        null=True,
        blank=True,
        help_text="Estimated average stride length (meters)",
    )
    # Strava max_speed is m/s
    max_speed_m_s = models.FloatField(
        null=True,
        blank=True,
        help_text="Max speed (m/s) from Strava",
    )
    notes = models.TextField(null=True, blank=True)
    weather = models.CharField(max_length=100, null=True, blank=True)
    location = models.CharField(max_length=100, null=True, blank=True)
    RUN_TYPE_CHOICES = [
        ("outdoor", "Outdoor"),
        ("treadmill", "Treadmill"),
        ("trail", "Trail"),
        ("indoor_track", "Indoor Track"),
    ]
    run_type = models.CharField(max_length=20, choices=RUN_TYPE_CHOICES, null=True, blank=True)
    calories = models.IntegerField(null=True, blank=True)
    temperature_c = models.FloatField(null=True, blank=True)
    polyline = models.TextField(null=True, blank=True)
    
    # Weather update status
    WEATHER_STATUS_CHOICES = [
        ('pending', 'Pending'),  # Not updated
        ('updating', 'Updating'),  # Updating
        ('completed', 'Completed'),  # Completed
        ('failed', 'Failed'),  # Failed
    ]
    weather_status = models.CharField(
        max_length=20, 
        choices=WEATHER_STATUS_CHOICES, 
        default='pending',
        help_text='Weather data update status'
    )

    def __str__(self):
        return f"Run on {self.date.strftime('%Y-%m-%d')} - {self.distance_km} km in {self.duration_minutes} min"