from django.db import models

class RunRecord(models.Model):
    date = models.DateTimeField()
    distance_km = models.FloatField()
    duration_minutes = models.FloatField()

    @property
    def pace_min_per_km(self):
        if self.distance_km > 0:
            return round(self.duration_minutes / self.distance_km, 2)
        return None
    
    strava_activity_id = models.BigIntegerField(unique=True, null=True, blank=True)
    avg_heart_rate = models.IntegerField(null=True, blank=True)
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

    def __str__(self):
        return f"Run on {self.date.strftime('%Y-%m-%d')} - {self.distance_km} km in {self.duration_minutes} min"