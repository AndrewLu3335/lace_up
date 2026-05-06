import requests
from datetime import datetime, timedelta
from django.utils import timezone
from runs.models import RunRecord
from ..models import StravaProfile
from ..services.weather import get_weather_open_meteo
import logging
from django.conf import settings
import pytz
logger = logging.getLogger(__name__)

REQUEST_TIMEOUT_SECONDS = 30  # HTTP request timeout
STRAVA_ACTIVITIES_PER_PAGE = 30
FIRST_SYNC_LIMIT_DAYS = 30  # First sync only get activities from last 30 days
FIRST_SYNC_MAX_ACTIVITIES = 50  # First sync max activities to sync
FIRST_SYNC_WITH_WEATHER = 10  # First 10 activities sync with weather data


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
        url = f"{settings.STRAVA_API_BASE_URL}/athlete/activities?per_page={STRAVA_ACTIVITIES_PER_PAGE}&page={page}"
        
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