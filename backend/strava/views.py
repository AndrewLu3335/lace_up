import json
import logging
import requests
from django.conf import settings
from django.shortcuts import redirect, HttpResponse
from django.contrib.auth import logout, login
from django.contrib.auth.models import User
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse, HttpResponseForbidden
from .models import StravaProfile 
from rest_framework.decorators import api_view, permission_classes,authentication_classes
from rest_framework.permissions import IsAuthenticated
from .services.oauth import refresh_strava_token
from .services.sync import fetch_and_sync_activities
from .services.weather import _update_missing_weather_data, _trigger_weather_update_task
from .services.auth import CsrfExemptSessionAuthentication
import secrets
logger = logging.getLogger(__name__)

# Constants
REQUEST_TIMEOUT_SECONDS = 30  # HTTP request timeout
WEATHER_UPDATE_BATCH_SIZE = 20  # Update weather for max 20 records per sync




def strava_connect(request):
    '''
    Strava Connect View
    Redirects user to Strava's OAuth authorization page with necessary parameters.
    '''
    state = secrets.token_urlsafe(32)
    request.session['oauth_state'] = state

    auth_url = (
        f"{settings.STRAVA_OAUTH_URL}/authorize"
        f"?client_id={settings.STRAVA_CLIENT_ID}"
        "&response_type=code"
        f"&redirect_uri={settings.STRAVA_REDIRECT_URI}"
        f"&state={state}"
        "&approval_prompt=auto"
        "&scope=activity:read_all,profile:read_all" # Get user profile and activities
    )
    return redirect(auth_url)


def strava_callback(request):
    '''
    Strava Callback View
    Handles the OAuth callback from Strava, exchanges code for token, and logs in the user.
    '''
    if request.GET.get("error"):
        return redirect(f"{settings.FRONTEND_URL}/login?error=access_denied")

    code = request.GET.get("code")
    state = request.GET.get("state")
    expected = request.session.pop('oauth_state', None)

    if not code:
        return redirect(f"{settings.FRONTEND_URL}/login?error=no_code")
    if not state or state != expected:
        return redirect(f"{settings.FRONTEND_URL}/login?error=invalid_state")

    # 1. Exchange Code for Token
    try:
        token_res = requests.post(
            f"{settings.STRAVA_OAUTH_URL}/token",
            data={
                "client_id": settings.STRAVA_CLIENT_ID,
                "client_secret": settings.STRAVA_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
            },
            timeout=REQUEST_TIMEOUT_SECONDS
        )
        token_res.raise_for_status()
        token_res = token_res.json()
    except requests.RequestException as e:
        logger.error(f"Error exchanging Strava code for token: {e}")
        return redirect(f"{settings.FRONTEND_URL}/login?error=token_exchange_failed")

    if 'access_token' not in token_res:
        return redirect(f"{settings.FRONTEND_URL}/login?error=token_exchange_failed")

    # 2. Extract user info
    access_token = token_res["access_token"]
    refresh_token = token_res["refresh_token"]
    expires_at = token_res["expires_at"]
    athlete = token_res["athlete"]
    avatar_url = athlete.get("profile")
    strava_id = athlete["id"]
    strava_username = athlete.get("username", "")

    # 3. Update StravaProfile
    try:
        # Case A: Existing user logging in
        profile = StravaProfile.objects.get(strava_id=strava_id)
        user = profile.user
        
        # Update Token and avatar
        profile.access_token = access_token
        profile.refresh_token = refresh_token
        profile.expires_at = expires_at
        profile.avatar_url = avatar_url
        profile.save()
        logger.info(f"User {user.username} logged in via Strava.")

    except StravaProfile.DoesNotExist:
        # Case B: New user logging in
        new_username = f"runner_{strava_id}"
        user, _ = User.objects.get_or_create(username=new_username)

        if hasattr(user, 'strava_profile'):
            profile = user.strava_profile
            profile.strava_id = strava_id
            profile.strava_username = strava_username
            profile.access_token = access_token
            profile.refresh_token = refresh_token
            profile.expires_at = expires_at
            profile.avatar_url = avatar_url
            profile.save()
            logger.info(f"Linked existing user {user.username} to Strava {strava_id}.")
        else:
            profile = StravaProfile.objects.create(
                user=user,
                strava_id=strava_id,
                strava_username=strava_username,
                access_token=access_token,
                refresh_token=refresh_token,
                expires_at=expires_at,
                avatar_url=avatar_url,
            )
            logger.info(f"New user {user.username} created via Strava.")

    # 4. Execute Django login (let session take effect)
    login(request, user)

    # 5. Sync activities after login
    # sync_count = fetch_and_sync_activities(user, access_token)

    # 6. Redirect back to frontend (with parameters)
    return redirect(f"{settings.FRONTEND_URL}/runs?login_success=1&synced=0")


@csrf_exempt
@api_view(['POST'])
@authentication_classes([CsrfExemptSessionAuthentication]) 
@permission_classes([IsAuthenticated])
def sync_strava_activities(request):
    '''
    User trigger sync strava activities
    Fast sync - returns immediately, weather data updated by background task
    '''
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized"}, status=401)
        
    access_token = refresh_strava_token(request.user)
    if not access_token:
        return JsonResponse({"error": "Strava not connected"}, status=400)
    
    # Check if fast_mode is requested (for first sync/auto sync)
    fast_mode = request.data.get('fast_mode', False)
    if isinstance(fast_mode, str):
        fast_mode = fast_mode.lower() == 'true'
    
    # Sync activities quickly (weather will be updated by background task)
    count = fetch_and_sync_activities(request.user, access_token, fast_mode=fast_mode)
    
    # Trigger background weather update task (non-blocking)
    try:
        _trigger_weather_update_task(request.user)
    except Exception as e:
        logger.warning(f"Failed to trigger weather update task: {e}")
    
    return JsonResponse({
        "synced_activities": count, 
        "fast_mode": fast_mode,
        "message": "Sync completed. Weather data is being updated in the background."
    }, status=200)


@csrf_exempt
@api_view(['POST'])
@authentication_classes([CsrfExemptSessionAuthentication]) 
@permission_classes([IsAuthenticated])
def update_weather_data(request):
    '''
    Manually trigger weather data update for records missing weather info
    This endpoint processes a batch of records and can be called repeatedly
    '''
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Unauthorized"}, status=401)
    
    try:
        batch_size = int(request.data.get('batch_size', WEATHER_UPDATE_BATCH_SIZE))
        updated_count = _update_missing_weather_data(request.user, batch_size=batch_size)

        # Check if there are more records to update (no date limit)
        from runs.models import RunRecord
        remaining_count = RunRecord.objects.filter(
            user=request.user,
            run_type='outdoor',
            weather_status__in=['pending', 'updating'],
        ).count()
        
        return JsonResponse({
            "updated_count": updated_count,
            "remaining_count": remaining_count,
            "message": f"Updated weather data for {updated_count} records. {remaining_count} records remaining."
        }, status=200)
    except Exception as e:
        logger.error(f"Error updating weather data: {e}", exc_info=True)
        return JsonResponse({"error": str(e)}, status=500)



@csrf_exempt
def strava_logout(request): 
    '''
    User trigger logout
    '''
    logout(request)
    return JsonResponse({"status": "logged_out"})


@csrf_exempt
def strava_webhook(request):
    '''
    Strava webhook: subscription verification (GET) and deauthorization events (POST).
    '''
    # Verify webhook
    if request.method == 'GET':
        verify_token = getattr(settings, 'STRAVA_WEBHOOK_VERIFY_TOKEN', None)
        if not verify_token:
            logger.error("STRAVA_WEBHOOK_VERIFY_TOKEN not configured in settings")
            return HttpResponseForbidden()
        
        mode = request.GET.get("hub.mode")
        token = request.GET.get("hub.verify_token")
        challenge = request.GET.get("hub.challenge")

        if mode == "subscribe" and token == verify_token:
            return HttpResponse(json.dumps({"hub.challenge": challenge}), content_type="application/json")
        return HttpResponseForbidden()

    # User deauthorize app
    elif request.method == 'POST':
        try:
            data = json.loads(request.body)
            if data.get('object_type') == 'athlete' and \
               data.get('updates', {}).get('authorized') == 'false':
                
                strava_id = data.get('owner_id')
                logger.warning(f"User {strava_id} deauthorized app.")
                
                try:
                    profile = StravaProfile.objects.get(strava_id=strava_id)
                    user = profile.user 
                    user.delete()
                    logger.info(f"Profile for {strava_id} deleted.")
                except StravaProfile.DoesNotExist:
                    logger.warning(f"Profile for {strava_id} not found during deauthorization")

            return HttpResponse('EVENT_RECEIVED', status=200)
            
        except Exception as e:
            logger.error("Webhook Error:", exc_info=True)
            return HttpResponse('Server Error', status=500)

    return HttpResponse('Method Not Allowed', status=405)


@csrf_exempt
@api_view(['GET'])
@authentication_classes([CsrfExemptSessionAuthentication]) 
@permission_classes([IsAuthenticated])
def auth_me(request):
    '''
    Return the authenticated user's public profile (no Strava tokens).
    '''
    user = request.user
    try:
        profile = user.strava_profile
    except StravaProfile.DoesNotExist:
        return JsonResponse({"error": "Strava not connected"}, status=400)

    return JsonResponse({
        'id': user.id,
        'username': user.username,
        'strava_id': profile.strava_id,
        'strava_username': profile.strava_username,
        'avatar_url': profile.avatar_url,
    })