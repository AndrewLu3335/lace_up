import json
import logging
import os
import pytz
import requests
import time
from datetime import datetime, timedelta
from django.conf import settings
from django.shortcuts import redirect, HttpResponse
from django.contrib.auth import logout, login
from django.contrib.auth.models import User
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse, HttpResponseForbidden
from django.utils import timezone
from runs.models import RunRecord
from .models import StravaProfile 
from rest_framework.decorators import api_view, permission_classes,authentication_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.authentication import SessionAuthentication

logger = logging.getLogger(__name__)

# Constants
STRAVA_API_BASE_URL = "https://www.strava.com/api/v3"
STRAVA_OAUTH_URL = "https://www.strava.com/oauth"
WEATHER_API_URL = "https://archive-api.open-meteo.com/v1/archive"
TOKEN_REFRESH_BUFFER_SECONDS = 60  # Refresh token 60 seconds before expiry
REQUEST_TIMEOUT_SECONDS = 30  # HTTP request timeout
STRAVA_ACTIVITIES_PER_PAGE = 30
FIRST_SYNC_LIMIT_DAYS = 30  # First sync only get activities from last 30 days
FIRST_SYNC_MAX_ACTIVITIES = 50  # First sync max activities to sync
FIRST_SYNC_WITH_WEATHER = 10  # First 10 activities sync with weather data
WEATHER_UPDATE_BATCH_SIZE = 20  # Update weather for max 20 records per sync
# Strava summary: running average_cadence is often per-leg; total steps/min (both feet) ≈ 2x (matches watch / Strava UI).
STRAVA_RUNNING_CADENCE_LEG_TO_TOTAL_SPM = 2.0

class CsrfExemptSessionAuthentication(SessionAuthentication):
    def enforce_csrf(self, request):
        return  

def decode_weather_code(code):
    '''
    OpenMeteo Weather Code
    '''
    mapping = {
        0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
        45: "Fog", 48: "Rime fog", 51: "Light drizzle", 53: "Moderate drizzle",
        55: "Dense drizzle", 61: "Light rain", 63: "Moderate rain", 65: "Heavy rain",
        80: "Rain showers", 95: "Thunderstorm",
    }
    return mapping.get(code, "Unknown")

def get_weather_open_meteo(local_date_str, lat, lon):
    """
    return weather code and temperature based on local_date_str
    local_date_str example: "2026-01-22T08:30:00Z"
    """
    try:
        dt_local = datetime.fromisoformat(local_date_str.replace("Z", ""))
        date_query = dt_local.strftime("%Y-%m-%d")
        hour_match = dt_local.strftime("%Y-%m-%dT%H:00")

        #  request url, timezone=auto (let API auto determine timezone based on lat/lon)
        url = (
            f"https://archive-api.open-meteo.com/v1/archive?"
            f"latitude={lat}&longitude={lon}"
            f"&start_date={date_query}&end_date={date_query}"
            f"&hourly=temperature_2m,weathercode"
            f"&timezone=auto" 
        )

        response = requests.get(url, timeout=REQUEST_TIMEOUT_SECONDS)
        response.raise_for_status()
        response = response.json()
        # Have not received weather data
        if "hourly" not in response:
            return None, None

        times = response["hourly"]["time"]
        temps = response["hourly"]["temperature_2m"]
        codes = response["hourly"]["weathercode"]

        # find the matching hour
        if hour_match in times:
            idx = times.index(hour_match)
            return decode_weather_code(codes[idx]), temps[idx]

        return None, None

    except Exception as e:
        logger.warning(f"Weather Error for {local_date_str}: {e}", exc_info=True)
        return None, None



def strava_connect(request):
    '''
    Strava Connect View
    '''
    auth_url = (
        f"{STRAVA_OAUTH_URL}/authorize"
        f"?client_id={settings.STRAVA_CLIENT_ID}"
        "&response_type=code"
        f"&redirect_uri={settings.STRAVA_REDIRECT_URI}"
        "&approval_prompt=auto"
        "&scope=activity:read_all,profile:read_all" # Get user profile and activities
    )
    return redirect(auth_url)


def strava_callback(request):
    '''
    Strava Callback View
    '''
    code = request.GET.get("code")
    if not code:
        return HttpResponse("No code received")

    # 1. Exchange Code for Token
    try:
        token_res = requests.post(
            f"{STRAVA_OAUTH_URL}/token",
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
        return HttpResponse(f"Strava Error: Failed to exchange code", status=500)

    if 'access_token' not in token_res:
        return HttpResponse(f"Strava Error: {token_res}")

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
        # Create a unique username, prevent conflicts
        new_username = f"runner_{strava_id}"
        
        # Check if Django User already exists (rare, but prevent just in case)
        user, created = User.objects.get_or_create(username=new_username)
        
        # Create StravaProfile
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
            f"{STRAVA_OAUTH_URL}/token",
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


def fetch_and_sync_activities(user, access_token, fast_mode=False):
    """
    Fetch and sync activities from Strava to database
    Supports pagination to fetch all activities
    
    Args:
        user: Django User object
        access_token: Strava access token
        fast_mode: If True, only sync recent activities (for first sync)
    """
    sync_count = 0
    page = 1
    headers = {"Authorization": f"Bearer {access_token}"}
    
    # Check if this is first sync (no existing activities)
    is_first_sync = not RunRecord.objects.filter(user=user).exists()
    if is_first_sync:
        fast_mode = True
        logger.info(f"First sync detected for user {user.username}, using fast mode")
    
    # Calculate date limit for fast mode
    date_limit = None
    if fast_mode:
        date_limit = timezone.now() - timedelta(days=FIRST_SYNC_LIMIT_DAYS)
        logger.info(f"Fast mode: only syncing activities after {date_limit}")
    
    activities_synced = 0
    
    # Fetch pages of activities
    while True:
        url = f"{STRAVA_API_BASE_URL}/athlete/activities?per_page={STRAVA_ACTIVITIES_PER_PAGE}&page={page}"
        
        # Make request
        try:
            res = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT_SECONDS)
            res.raise_for_status()
            activities = res.json()
        except requests.RequestException as e:
            logger.error(f"Error fetching Strava activities (page {page}) for user {user.username}: {e}")
            break
        
        # If no activities returned, we've reached the end
        if not activities:
            break
        
        # Filter activities by date if in fast mode
        if fast_mode and date_limit:
            # Filter activities that are older than date_limit
            filtered_activities = []
            for activity in activities:
                try:
                    activity_date = datetime.fromisoformat(activity["start_date_local"].replace("Z", "+00:00"))
                    if activity_date.replace(tzinfo=None) >= date_limit.replace(tzinfo=None):
                        filtered_activities.append(activity)
                    else:
                        # Activities are sorted by date desc, so if we hit an old one, we're done
                        break
                except (ValueError, KeyError):
                    # If date parsing fails, include the activity to be safe
                    filtered_activities.append(activity)
            activities = filtered_activities
        
        # Process activities in this page - first 10 with weather, rest skip weather
        new_syncs = _process_activities_page(user, activities, skip_weather=True, sync_count_so_far=sync_count)
        sync_count += new_syncs
        activities_synced += len(activities)
        
        # Fast mode: stop after reaching max activities
        if fast_mode and activities_synced >= FIRST_SYNC_MAX_ACTIVITIES:
            logger.info(f"Fast mode: reached max activities limit ({FIRST_SYNC_MAX_ACTIVITIES})")
            break
        
        # If we got fewer activities than per_page, we're done
        if len(activities) < STRAVA_ACTIVITIES_PER_PAGE:
            break
        
        # Fast mode: if we filtered out all activities, we're done
        if fast_mode and not activities:
            break
        
        page += 1
    
    # Update last synced time
    try:
        profile = user.strava_profile
        profile.ast_synced_at = timezone.now()
        profile.save(update_fields=['ast_synced_at'])
    except StravaProfile.DoesNotExist:
        pass
    
    # Note: Weather update is now handled in sync_strava_activities view
    # before calling this function, so we don't do it here to avoid duplication
    
    logger.info(f"Synced {sync_count} new activities for user {user.username} (fast_mode={fast_mode})")
    return sync_count


def _process_activities_page(user, activities, skip_weather=True, sync_count_so_far=0):
    """
    Process a single page of activities and create RunRecord entries
    First 10 activities sync with weather, rest skip weather for faster sync
    
    Args:
        user: Django User object
        activities: List of activity dicts from Strava API
        skip_weather: If True, skip weather API calls (except first 10)
        sync_count_so_far: Number of records already synced in this batch
    """
    records_to_create = []

    # 1. Get existing activity IDs for this user to avoid duplicates
    existing_ids = set(
        RunRecord.objects.filter(
            user=user,
            strava_activity_id__isnull=False
        ).values_list('strava_activity_id', flat=True)
    )

    # 2. Process each activity
    for activity in activities:
        # Only sync running activities
        if activity.get("type") != "Run":
            continue

        strava_activity_id = activity["id"]

        # Skip if already exists
        if strava_activity_id in existing_ids:
            continue

        # For first 10 records, sync with weather; rest skip weather
        should_skip_weather = skip_weather and (sync_count_so_far + len(records_to_create) >= FIRST_SYNC_WITH_WEATHER)
        
        # Extract data
        try:
            run_record = _extract_run_record_data(user, activity, strava_activity_id, skip_weather=should_skip_weather)
            if run_record:
                # Set weather status based on whether we got weather data
                if run_record.get('run_type') == 'outdoor':
                    if should_skip_weather or not run_record.get('weather'):
                        run_record['weather_status'] = 'pending'
                    else:
                        run_record['weather_status'] = 'completed'
                else:
                    run_record['weather_status'] = 'completed'  # Indoor runs don't need weather
                records_to_create.append(run_record)
        except Exception as e:
            logger.warning(f"Failed to extract data for activity {strava_activity_id}: {e}", exc_info=True)
            continue

    # 3. Bulk create records (bulk_create expects model instances, not dicts)
    sync_count = 0
    if records_to_create:
        try:
            instances = [RunRecord(**r) for r in records_to_create]
            RunRecord.objects.bulk_create(instances, ignore_conflicts=True)
            sync_count = len(instances)
        except Exception as e:
            logger.error(f"Error bulk creating run records: {e}", exc_info=True)
            # Fallback to individual creates
            for record_data in records_to_create:
                try:
                    RunRecord.objects.create(**record_data)
                    sync_count += 1
                except Exception as e:
                    logger.warning(f"Failed to save run {record_data.get('strava_activity_id')}: {e}")

    return sync_count


def _extract_run_record_data(user, activity, strava_activity_id, skip_weather=False):
    """
    Extract and prepare RunRecord data from Strava activity
    Returns a dict ready for RunRecord.objects.create() or None if invalid
    
    Args:
        user: Django User object
        activity: Activity dict from Strava API
        strava_activity_id: Strava activity ID
        skip_weather: If True, skip weather API calls for faster sync
    """
    # Extract basic data
    distance_km = round(activity["distance"] / 1000, 2)
    duration_minutes = round(activity["moving_time"] / 60, 2)
    avg_hr = activity.get("average_heartrate")
    calories = activity.get("calories")
    polyline = activity.get("map", {}).get("summary_polyline")

    # Cadence / max HR / max speed (Strava activity summary fields)
    avg_cadence = activity.get("average_cadence")
    if avg_cadence is not None:
        try:
            avg_cadence = float(avg_cadence)
        except (TypeError, ValueError):
            avg_cadence = None
        else:
            if activity.get("type") == "Run":
                avg_cadence *= STRAVA_RUNNING_CADENCE_LEG_TO_TOTAL_SPM

    max_hr = activity.get("max_heartrate")
    if max_hr is not None:
        try:
            max_hr = int(round(float(max_hr)))
        except (TypeError, ValueError):
            max_hr = None

    max_speed_m_s = activity.get("max_speed")
    if max_speed_m_s is not None:
        try:
            max_speed_m_s = float(max_speed_m_s)
        except (TypeError, ValueError):
            max_speed_m_s = None

    # Stride (m): distance_m / step_count; step_count ≈ (moving_time/60) * cadence (spm)
    distance_m = float(activity.get("distance") or 0)
    moving_time = int(activity.get("moving_time") or 0)
    stride_m = None
    if avg_cadence and avg_cadence > 0 and moving_time > 0 and distance_m > 0:
        minutes = moving_time / 60.0
        total_steps = minutes * avg_cadence
        if total_steps > 0:
            stride_m = round(distance_m / total_steps, 3)

    # Parse date
    local_date_str = activity["start_date_local"]
    try:
        date_obj = datetime.fromisoformat(local_date_str.replace("Z", "+00:00"))
    except ValueError:
        logger.warning(f"Invalid date format for activity {strava_activity_id}: {local_date_str}")
        date_obj = datetime.now(pytz.UTC)

    # Determine run type
    latlng = activity.get("start_latlng")
    is_indoor = activity.get("trainer") or not latlng or len(latlng) != 2
    
    # Map run type to model choices
    if is_indoor:
        run_type = "treadmill"
    else:
        run_type = "outdoor"  # Could be enhanced to detect trail/indoor_track

    # Get weather data for outdoor runs (skip in fast mode for speed)
    weather, temperature = None, None
    if not is_indoor and not skip_weather:
        weather, temperature = get_weather_open_meteo(
            local_date_str, latlng[0], latlng[1]
        )

    return {
        "user": user,
        "strava_activity_id": strava_activity_id,
        "distance_km": distance_km,
        "duration_minutes": duration_minutes,
        "avg_heart_rate": avg_hr,
        "max_heart_rate": max_hr,
        "average_cadence_spm": avg_cadence,
        "stride_length_m": stride_m,
        "max_speed_m_s": max_speed_m_s,
        "calories": calories,
        "date": date_obj,
        "run_type": run_type,
        "weather": weather,
        "temperature_c": temperature,
        "polyline": polyline,
    }


def _trigger_weather_update_task(user):
    """
    Trigger background weather update task (non-blocking)
    This can be called after sync to start updating weather data
    """
    # Mark pending records as updating (no date limit: all pending records can be updated)
    from runs.models import RunRecord

    RunRecord.objects.filter(
        user=user,
        run_type='outdoor',
        weather_status='pending',
    ).update(weather_status='updating')
    
    logger.info(f"Triggered weather update task for user {user.username}")


def _update_missing_weather_data(user, batch_size=None):
    """
    Update weather data for existing RunRecord entries that need weather info.
    Processes records with status 'pending' or 'updating'.
    
    Args:
        user: Django User object
        batch_size: Number of records to process (default: WEATHER_UPDATE_BATCH_SIZE)
        
    Returns:
        Number of records updated
    """
    from runs.models import RunRecord
    
    if batch_size is None:
        batch_size = WEATHER_UPDATE_BATCH_SIZE

    # Find outdoor runs that need weather data (pending or updating status), no date limit
    records_to_update = RunRecord.objects.filter(
        user=user,
        run_type='outdoor',
        weather_status__in=['pending', 'updating'],
    ).order_by('-date')[:batch_size]
    
    if not records_to_update:
        return 0
    
    updated_count = 0
    
    # Fetch activities from Strava to get location data
    try:
        profile = user.strava_profile
        access_token = refresh_strava_token(user)
        if not access_token:
            logger.warning(f"Cannot update weather: no access token for user {user.username}")
            return 0
    except StravaProfile.DoesNotExist:
        logger.warning(f"Cannot update weather: no StravaProfile for user {user.username}")
        return 0
    
    # Get activity IDs for records that need weather
    activity_ids = [r.strava_activity_id for r in records_to_update if r.strava_activity_id]
    
    if not activity_ids:
        return 0
    
    # Fetch activity details from Strava API
    headers = {"Authorization": f"Bearer {access_token}"}
    updated_records = []
    
    for activity_id in activity_ids:
        try:
            # Fetch individual activity to get location
            url = f"{STRAVA_API_BASE_URL}/activities/{activity_id}"
            res = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT_SECONDS)
            res.raise_for_status()
            activity = res.json()
            
            # Get the corresponding record
            record = next((r for r in records_to_update if r.strava_activity_id == activity_id), None)
            if not record:
                continue
            
            # Get location
            latlng = activity.get("start_latlng")
            if not latlng or len(latlng) != 2:
                continue
            
            # Get weather data
            local_date_str = activity.get("start_date_local")
            if not local_date_str:
                continue
            
            weather, temperature = get_weather_open_meteo(
                local_date_str, latlng[0], latlng[1]
            )
            
            if weather or temperature:
                record.weather = weather
                record.temperature_c = temperature
                record.weather_status = 'completed'
                updated_records.append(record)
                updated_count += 1
            else:
                # If weather API returned no data, mark as failed
                record.weather_status = 'failed'
                updated_records.append(record)
                
        except requests.RequestException as e:
            logger.warning(f"Error fetching activity {activity_id} for weather update: {e}")
            # Mark as failed
            record = next((r for r in records_to_update if r.strava_activity_id == activity_id), None)
            if record:
                record.weather_status = 'failed'
                updated_records.append(record)
            continue
        except Exception as e:
            logger.warning(f"Error updating weather for activity {activity_id}: {e}", exc_info=True)
            # Mark as failed
            record = next((r for r in records_to_update if r.strava_activity_id == activity_id), None)
            if record:
                record.weather_status = 'failed'
                updated_records.append(record)
            continue
    
    # Bulk update records
    if updated_records:
        RunRecord.objects.bulk_update(updated_records, ['weather', 'temperature_c', 'weather_status'])
        logger.info(f"Updated weather for {updated_count} records for user {user.username}")
    
    return updated_count


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
    Strava webhook
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