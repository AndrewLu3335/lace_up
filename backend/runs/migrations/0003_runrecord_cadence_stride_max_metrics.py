# Generated manually for cadence, stride, max HR, max speed

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("runs", "0002_runrecord_weather_status"),
    ]

    operations = [
        migrations.AddField(
            model_name="runrecord",
            name="average_cadence_spm",
            field=models.FloatField(
                blank=True,
                null=True,
                help_text="Average cadence (steps per minute), from Strava average_cadence",
            ),
        ),
        migrations.AddField(
            model_name="runrecord",
            name="stride_length_m",
            field=models.FloatField(
                blank=True,
                null=True,
                help_text="Estimated stride length in meters (distance / steps when cadence known)",
            ),
        ),
        migrations.AddField(
            model_name="runrecord",
            name="max_heart_rate",
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="runrecord",
            name="max_speed_m_s",
            field=models.FloatField(
                blank=True,
                null=True,
                help_text="Max speed in meters per second (Strava max_speed)",
            ),
        ),
    ]
