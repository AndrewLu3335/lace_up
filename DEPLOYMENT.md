# Deployment and configuration guide

This document explains how to configure and deploy Lace Up for **development** and **production**. All secrets belong in environment variables — never commit `.env`.

---

## 1. What you configure where

| Area | File / location | Notes |
|------|-----------------|--------|
| Backend secrets & URLs | `backend/.env` | Copy from `backend/.env.example` |
| Frontend API base URL | `frontend/.env` or `.env.local` | `REACT_APP_API_URL` (see `frontend/.env.example`) |
| Allowed CORS / CSRF origins | `backend/lace_up/settings.py` | Lists are **hardcoded**; add your production frontend URL (see §5) |
| Django settings logic | `backend/lace_up/settings.py` | Usually unchanged; values come from `.env` |

---

## 2. Prerequisites

- **Python** 3.10+ (match your server)
- **Node.js** 18+ and npm (to build the frontend)
- **PostgreSQL** (database engine used by the project)
- A **Strava API application** ([Strava API settings](https://www.strava.com/settings/api))

---

## 3. Backend environment variables (`backend/.env`)

Create `backend/.env` from `backend/.env.example` and set:

| Variable | Required | Description |
|----------|----------|-------------|
| `SECRET_KEY` | Yes | Long random string. Generate e.g. `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"` |
| `DEBUG` | Yes | `True` for local dev only. Use `False` in production. |
| `ALLOWED_HOSTS` | Yes | Comma-separated hostnames, no spaces. Example: `api.example.com,localhost` |
| `DB_NAME`, `DB_USER`, `DB_PASS`, `DB_HOST` | Yes | PostgreSQL connection. `DB_HOST` can be `127.0.0.1` or your DB host. |
| `STRAVA_CLIENT_ID` | Yes | From Strava app |
| `STRAVA_CLIENT_SECRET` | Yes | From Strava app |
| `BACKEND_URL` | Yes | Public base URL of the API **including scheme**, no trailing slash. Example: `https://api.example.com` |
| `FRONTEND_URL` | Yes | Public URL of the React app. Used for redirects after OAuth. Example: `https://app.example.com` |
| `STRAVA_WEBHOOK_VERIFY_TOKEN` | If using webhooks | Random string; must match the token you configure in Strava’s webhook subscription. |
| `SESSION_COOKIE_SECURE` | Production | Set `True` when the site is served **only over HTTPS**. |
| `SESSION_COOKIE_SAMESITE` | Optional | Default `Lax`; adjust if you split frontend/backend across sites. |

**Strava redirect URI** is derived in code as:

`{BACKEND_URL}/api/strava/callback/`

You must register **exactly** that URL (including `https`) in the Strava application settings.

---

## 4. Frontend environment variables

In `frontend/.env` or `.env.local` (Create React App):

| Variable | Description |
|----------|-------------|
| `REACT_APP_API_URL` | Backend base URL, **no** trailing slash. Example: `https://api.example.com` |

After changing env vars, restart `npm start` or **rebuild** for production (`npm run build`).

---

## 5. CORS and CSRF (production domains)

Session cookies and the Strava OAuth flow require the **browser origin** of your React app to be allowed.

In `backend/lace_up/settings.py`, update:

- `CORS_ALLOWED_ORIGINS` — add your frontend origin(s), e.g. `https://app.example.com`
- `CSRF_TRUSTED_ORIGINS` — same origins (scheme + host + port if non-default)

Remove or replace example domains (`laceuprun.com`, etc.) if they are not yours.

Then redeploy the backend.

---

## 6. Database

1. Create a PostgreSQL database and user.
2. Put credentials in `backend/.env`.
3. Run migrations on the server:

```bash
cd backend
source .venv/bin/activate   # or your venv path
pip install -r requirements.txt
python manage.py migrate
```

Optional: create a Django superuser for `/admin/`:

```bash
python manage.py createsuperuser
```

---

## 7. Production backend (example with Gunicorn)

Install and run from the `backend` directory (use your venv’s `gunicorn`):

```bash
pip install -r requirements.txt
gunicorn lace_up.wsgi:application --bind 0.0.0.0:8000
```

Typical setup:

- **Reverse proxy** (nginx, Caddy, etc.) terminates TLS and forwards to Gunicorn.
- Set `BACKEND_URL` / `FRONTEND_URL` to your **public HTTPS** URLs.
- Set `DEBUG=False`, `ALLOWED_HOSTS` correctly, `SESSION_COOKIE_SECURE=True`.

Collect static files if you serve Django admin static assets through the same app:

```bash
python manage.py collectstatic --noinput
```

(You may need to configure `STATIC_ROOT` in `settings.py` for full static hosting — not required if you only use the API + separate frontend build.)

---

## 8. Production frontend

Build static files:

```bash
cd frontend
cp .env.example .env   # set REACT_APP_API_URL to production API
npm ci
npm run build
```

Serve the `frontend/build` folder with **nginx** (or any static host). Ensure the SPA fallback routes to `index.html` for client-side routing.

The API must stay on a URL allowed by **CORS** and **CSRF** (§5).

---

## 9. Background jobs (sync & weather)

The UI can poll the API, but for reliable updates you should run management commands on a schedule:

- `python manage.py sync_activities`
- `python manage.py update_weather`

See **`backend/CRON_SETUP_GUIDE.md`** for cron examples and Python path pitfalls.

---

## 10. Checklist before going live

- [ ] `DEBUG=False`, strong `SECRET_KEY`, no `.env` in Git  
- [ ] `ALLOWED_HOSTS` matches your API hostname  
- [ ] `BACKEND_URL` / `FRONTEND_URL` match real HTTPS URLs  
- [ ] Strava app callback URL matches `{BACKEND_URL}/api/strava/callback/`  
- [ ] `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` include your frontend origin  
- [ ] `SESSION_COOKIE_SECURE=True` behind HTTPS  
- [ ] PostgreSQL reachable from the app server  
- [ ] Migrations applied  
- [ ] (Optional) Cron/systemd for `sync_activities` and `update_weather`  

---

## 11. Related docs

- `README.md` — quick local start  
- `backend/CRON_SETUP_GUIDE.md` — scheduled commands  
- `backend/POLLING_SETUP.md` — how polling works  
- `OPEN_SOURCE_CHECKLIST.md` — secrets and licensing  

If something fails, check Django logs, browser **Network** tab (CORS/401/403), and that cookies are sent (`withCredentials` is used on the frontend).
