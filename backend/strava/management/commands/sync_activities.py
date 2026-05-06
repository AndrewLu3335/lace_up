"""
Management command to sync Strava activities for all users in the background.
This command can be run periodically (e.g., via cron) to sync new activities.
"""
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from strava.services.sync import fetch_and_sync_activities
from strava.services.oauth import refresh_strava_token
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Sync Strava activities for all users'

    def add_arguments(self, parser):
        parser.add_argument(
            '--user-id',
            type=int,
            default=None,
            help='Sync activities for a specific user only',
        )
        parser.add_argument(
            '--fast-mode',
            action='store_true',
            help='Use fast mode (only sync recent activities)',
        )

    def handle(self, *args, **options):
        user_id = options.get('user_id')
        fast_mode = options.get('fast_mode', False)
        
        self.stdout.write('Starting Strava activities sync...')
        
        # Get users to sync
        if user_id:
            try:
                users = [User.objects.get(id=user_id)]
            except User.DoesNotExist:
                self.stdout.write(self.style.ERROR(f'User with ID {user_id} not found'))
                return
        else:
            # Get all users with Strava profiles
            users = User.objects.filter(strava_profile__isnull=False).distinct()
        
        total_synced = 0
        
        for user in users:
            try:
                # Refresh token if needed
                access_token = refresh_strava_token(user)
                if not access_token:
                    self.stdout.write(
                        self.style.WARNING(f'Cannot sync for user {user.username}: no valid token')
                    )
                    continue
                
                # Sync activities
                count = fetch_and_sync_activities(user, access_token, fast_mode=fast_mode)
                total_synced += count
                
                if count > 0:
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'Synced {count} new activities for user {user.username}'
                        )
                    )
            except Exception as e:
                logger.error(f"Error syncing activities for user {user.username}: {e}", exc_info=True)
                self.stdout.write(
                    self.style.ERROR(f'Error syncing activities for user {user.username}: {e}')
                )
        
        self.stdout.write(
            self.style.SUCCESS(f'Activities sync completed. Total activities synced: {total_synced}')
        )
