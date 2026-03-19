# Polling and background jobs

This project uses two mechanisms to keep data up to date:

## 1. Frontend polling (automatic)

After login, the React app starts polling without extra configuration:

- **Activity sync:** about every 5 minutes — calls the sync API and refreshes runs  
- **Weather:** about every 10 seconds while there are pending/updating outdoor runs  

Polling runs while the page is open and stops when the user leaves.

## 2. Backend polling (optional, requires setup)

Use Django management commands on a schedule (cron or systemd).

### Commands

#### 2.1 Sync Strava activities

```bash
# All users with a Strava profile
python manage.py sync_activities

# One user
python manage.py sync_activities --user-id 1

# Fast mode (recent activities only)
python manage.py sync_activities --fast-mode
```

#### 2.2 Update weather

```bash
# All users who have pending/updating weather
python manage.py update_weather

# One user
python manage.py update_weather --user-id 1

# Batch size
python manage.py update_weather --batch-size 30
```

### Cron (typical on a server)

```bash
crontab -e
```

```bash
# Every 5 minutes — sync activities
*/5 * * * * cd /path/to/backend && /path/to/venv/bin/python manage.py sync_activities >> /var/log/lace_up_sync.log 2>&1

# Every 2 minutes — weather
*/2 * * * * cd /path/to/backend && /path/to/venv/bin/python manage.py update_weather >> /var/log/lace_up_weather.log 2>&1
```

Replace `/path/to/backend` and `/path/to/venv/bin/python` with real paths. See `CRON_SETUP_GUIDE.md` for macOS/Homebrew notes.

### systemd timer (Linux)

#### `/etc/systemd/system/lace-up-sync.service`

```ini
[Unit]
Description=Lace Up Strava Activities Sync
After=network.target

[Service]
Type=oneshot
User=your_user
WorkingDirectory=/path/to/backend
Environment="PATH=/path/to/venv/bin"
ExecStart=/path/to/venv/bin/python manage.py sync_activities
```

#### `/etc/systemd/system/lace-up-sync.timer`

```ini
[Unit]
Description=Run Lace Up sync every 5 minutes
Requires=lace-up-sync.service

[Timer]
OnBootSec=5min
OnUnitActiveSec=5min
Unit=lace-up-sync.service

[Install]
WantedBy=timers.target
```

#### `/etc/systemd/system/lace-up-weather.service`

```ini
[Unit]
Description=Lace Up Weather Data Update
After=network.target

[Service]
Type=oneshot
User=your_user
WorkingDirectory=/path/to/backend
Environment="PATH=/path/to/venv/bin"
ExecStart=/path/to/venv/bin/python manage.py update_weather
```

#### `/etc/systemd/system/lace-up-weather.timer`

```ini
[Unit]
Description=Run Lace Up weather update every 2 minutes
Requires=lace-up-weather.service

[Timer]
OnBootSec=2min
OnUnitActiveSec=2min
Unit=lace-up-weather.service

[Install]
WantedBy=timers.target
```

#### Enable

```bash
sudo systemctl enable lace-up-sync.timer
sudo systemctl enable lace-up-weather.timer
sudo systemctl start lace-up-sync.timer
sudo systemctl start lace-up-weather.timer
sudo systemctl status lace-up-sync.timer
sudo systemctl status lace-up-weather.timer
```

## Suggested intervals

- **Activity sync:** every 5–10 minutes (Strava limits)  
- **Weather:** every 2–5 minutes  

## Manual test

```bash
python manage.py sync_activities
python manage.py update_weather
tail -f /var/log/lace_up_sync.log
tail -f /var/log/lace_up_weather.log
```
