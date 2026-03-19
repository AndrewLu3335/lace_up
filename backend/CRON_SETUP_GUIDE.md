# Cron setup guide

## Step 1: Edit crontab

Open a terminal and run:

```bash
crontab -e
```

If this is your first time, the system may ask you to pick an editor; `nano` or `vim` are fine.

## Step 2: Add jobs

**Important:** Use the **full path** to Python, not `python` (cron’s `PATH` is minimal and `python` is often missing).

### Using the project venv (check the FAQ below if venv fails under cron)

```bash
# Sync Strava activities every 5 minutes
*/5 * * * * cd /Users/lujingsheng/lace_up/backend && /Users/lujingsheng/lace_up/venv/bin/python3 manage.py sync_activities >> /tmp/lace_up_sync.log 2>&1

# Update weather every 2 minutes
*/2 * * * * cd /Users/lujingsheng/lace_up/backend && /Users/lujingsheng/lace_up/venv/bin/python3 manage.py update_weather >> /tmp/lace_up_weather.log 2>&1
```

### Using Homebrew Python (e.g. `python` → `/opt/homebrew/Cellar/python@3.10/3.10.17/bin/python3.10`)

**Option A — Recreate venv with Homebrew Python (recommended)**  
So `venv/bin/python3` works under cron and dependencies stay in the project venv:

```bash
cd /Users/lujingsheng/lace_up
rm -rf venv
/opt/homebrew/Cellar/python@3.10/3.10.17/bin/python3.10 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
```

Then in crontab use venv’s `python3`:

```bash
*/5 * * * * cd /Users/lujingsheng/lace_up/backend && /Users/lujingsheng/lace_up/venv/bin/python3 manage.py sync_activities >> /tmp/lace_up_sync.log 2>&1
*/2 * * * * cd /Users/lujingsheng/lace_up/backend && /Users/lujingsheng/lace_up/venv/bin/python3 manage.py update_weather >> /tmp/lace_up_weather.log 2>&1
```

**Option B — No venv; call Homebrew Python directly**  
Install deps for that interpreter first:

`/opt/homebrew/Cellar/python@3.10/3.10.17/bin/python3.10 -m pip install -r /Users/lujingsheng/lace_up/backend/requirements.txt`

Crontab:

```bash
*/5 * * * * cd /Users/lujingsheng/lace_up/backend && /opt/homebrew/Cellar/python@3.10/3.10.17/bin/python3.10 manage.py sync_activities >> /tmp/lace_up_sync.log 2>&1
*/2 * * * * cd /Users/lujingsheng/lace_up/backend && /opt/homebrew/Cellar/python@3.10/3.10.17/bin/python3.10 manage.py update_weather >> /tmp/lace_up_weather.log 2>&1
```

If venv fails with **No such file or directory** and you are not using Homebrew, use system Python (install deps first; see FAQ #2):

```bash
*/5 * * * * cd /Users/lujingsheng/lace_up/backend && /usr/bin/python3 manage.py sync_activities >> /tmp/lace_up_sync.log 2>&1
*/2 * * * * cd /Users/lujingsheng/lace_up/backend && /usr/bin/python3 manage.py update_weather >> /tmp/lace_up_weather.log 2>&1
```

## Step 3: Save and exit

- **nano:** `Ctrl+X`, then `Y`, then `Enter`
- **vim:** `Esc`, type `:wq`, then `Enter`

## Step 4: Verify

```bash
crontab -l
```

## Step 5: Manual test (optional)

Before relying on cron:

```bash
source /Users/lujingsheng/lace_up/venv/bin/activate
cd /Users/lujingsheng/lace_up/backend
python manage.py sync_activities
python manage.py update_weather
```

## Cron schedule format

```
* * * * * command
│ │ │ │ │
│ │ │ │ └─── day of week (0–7, 0 and 7 = Sunday)
│ │ │ └───── month (1–12)
│ │ └─────── day of month (1–31)
│ └───────── hour (0–23)
└─────────── minute (0–59)
```

Examples:

- `*/5 * * * *` — every 5 minutes  
- `*/2 * * * *` — every 2 minutes  
- `0 */1 * * *` — every hour  
- `0 0 * * *` — daily at midnight  

## Logs

```bash
tail -f /tmp/lace_up_sync.log
tail -f /tmp/lace_up_weather.log
```

## Stop cron jobs

```bash
crontab -e
# Delete or comment lines (leading `#`)
```

## FAQ

### 1. `python: command not found`

Cron’s environment has a minimal `PATH`. Always use a full path, e.g.:

- venv: `/Users/lujingsheng/lace_up/venv/bin/python3`
- system: `/usr/bin/python3`

### 2. `venv/bin/python: No such file or directory`

The venv may point at a Python that does not exist in cron’s environment (e.g. Xcode’s Python).  

**A — Use system Python without rebuilding venv**

```bash
/usr/bin/python3 -m pip install -r /Users/lujingsheng/lace_up/backend/requirements.txt --user
```

Crontab:

```bash
*/5 * * * * cd /Users/lujingsheng/lace_up/backend && /usr/bin/python3 manage.py sync_activities >> /tmp/lace_up_sync.log 2>&1
*/2 * * * * cd /Users/lujingsheng/lace_up/backend && /usr/bin/python3 manage.py update_weather >> /tmp/lace_up_weather.log 2>&1
```

**B — Recreate venv with `/usr/bin/python3 -m venv venv`** (recommended long-term)

```bash
cd /Users/lujingsheng/lace_up
rm -rf venv
/usr/bin/python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
```

Then use `/Users/lujingsheng/lace_up/venv/bin/python3` in crontab.

### 3. Permissions

Ensure cron can read the project directory and venv.

### 4. Environment variables

If needed, set them at the top of crontab:

```bash
PATH=/usr/local/bin:/usr/bin:/bin
DJANGO_SETTINGS_MODULE=lace_up.settings
```

### 5. macOS system log

```bash
grep CRON /var/log/system.log
```

## Suggested intervals

- **Activity sync:** every 5–10 minutes (respect Strava rate limits)  
- **Weather:** every 2–5 minutes  

Adjust to your needs.
