import requests
import time
from django.conf import settings
import logging
from ..models import StravaProfile

logger = logging.getLogger(__name__)

REQUEST_TIMEOUT_SECONDS = 30  # HTTP request timeout
TOKEN_REFRESH_BUFFER_SECONDS = 60  # Refresh token 60 seconds before expiry

def refresh_strava_token(user):
    """
    Refresh Strava token for a specific user when needed
    """
    try:
        profile = user.strava_profile 
    except StravaProfile.DoesNotExist:
        logger.warning(f"StravaProfile not found for user {user.username}")
        return None

    # If token expires within buffer time, refresh it
    current_time = time.time()
    if profile.expires_at and current_time < profile.expires_at - TOKEN_REFRESH_BUFFER_SECONDS:
        return profile.access_token  # not expired, return current token
    
    try:
        response = requests.post(
            f"{settings.STRAVA_OAUTH_URL}/token",
            data={
                "client_id": settings.STRAVA_CLIENT_ID,
                "client_secret": settings.STRAVA_CLIENT_SECRET,
                "grant_type": "refresh_token",
                "refresh_token": profile.refresh_token,
            },
            timeout=REQUEST_TIMEOUT_SECONDS
        )
        response.raise_for_status()
        response = response.json()
    except requests.RequestException as e:
        logger.error(f"Error refreshing token for user {user.username}: {e}")
        return None

    if 'access_token' not in response:
        logger.error(f"Error refreshing token: {response}")
        return None
    
    profile.access_token = response["access_token"]
    profile.refresh_token = response["refresh_token"]
    profile.expires_at = response["expires_at"]
    profile.save()
    logger.info(f"Token refreshed for user {user.username}")

    return profile.access_token
