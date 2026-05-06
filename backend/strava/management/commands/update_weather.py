"""
Management command to update weather data for RunRecord entries in the background.
This command can be run periodically (e.g., via cron) to update weather data.
"""
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from strava.services.weather import _update_missing_weather_data
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Update weather data for RunRecord entries that need it'

    def add_arguments(self, parser):
        parser.add_argument(
            '--batch-size',
            type=int,
            default=20,
            help='Number of records to process per run (default: 20)',
        )
        parser.add_argument(
            '--user-id',
            type=int,
            default=None,
            help='Process weather updates for a specific user only',
        )

    def handle(self, *args, **options):
        batch_size = options['batch_size']
        user_id = options.get('user_id')
        
        self.stdout.write(f'[{timezone.now().isoformat()}] Starting weather data update...')

        if user_id:
            try:
                users = [User.objects.get(id=user_id)]
            except User.DoesNotExist:
                self.stdout.write(self.style.ERROR(f'User with ID {user_id} not found'))
                return
        else:
            # Get all users who have pending/updating weather (no date limit)
            users = User.objects.filter(
                runs__run_type='outdoor',
                runs__weather_status__in=['pending', 'updating'],
            ).distinct()
        
        if not users:
            self.stdout.write(
                self.style.WARNING('No users with pending/updating weather data; nothing to do.')
            )
            self.stdout.write(
                self.style.SUCCESS('Weather update completed. Total records updated: 0')
            )
            return
        
        total_updated = 0
        
        for user in users:
            try:
                updated_count = _update_missing_weather_data(user, batch_size=batch_size)
                total_updated += updated_count
                if updated_count > 0:
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'Updated weather for {updated_count} records for user {user.username}'
                        )
                    )
            except Exception as e:
                logger.error(f"Error updating weather for user {user.username}: {e}", exc_info=True)
                self.stdout.write(
                    self.style.ERROR(f'Error updating weather for user {user.username}: {e}')
                )
        
        self.stdout.write(
            self.style.SUCCESS(f'Weather update completed. Total records updated: {total_updated}')
        )
