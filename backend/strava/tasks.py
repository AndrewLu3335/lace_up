from celery import shared_task
from django.core.management import call_command

@shared_task
def sync_activities_task():
    call_command('sync_activities', fast_mode=True)

@shared_task
def update_weather_task():
    call_command('update_weather', batch_size=20)