import requests
from datetime import datetime
import logging
from django.conf import settings
from ..services.oauth import refresh_strava_token
from ..models import StravaProfile

logger = logging.getLogger(__name__)
REQUEST_TIMEOUT_SECONDS = 30  # HTTP request timeout
WEATHER_UPDATE_BATCH_SIZE = 20  # Update weather for max 20 records per sync


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
            url = f"{settings.STRAVA_API_BASE_URL}/activities/{activity_id}"
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
