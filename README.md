# Lace Up

Full-stack running log app: **React** frontend, **Django** backend, **Strava** OAuth and activity sync, optional weather for outdoor runs, maps and stats.

## Repository layout

- `backend/` — Django project (`manage.py`, `lace_up/settings.py`, apps `runs`, `strava`)
- `frontend/` — Create React App

## Quick start

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # edit .env with your keys and DB
python manage.py migrate
python manage.py runserver
```

### Frontend

```bash
cd frontend
cp .env.example .env        # set REACT_APP_API_URL to match backend
npm install
npm start
```

### Strava

Create an app at [Strava API settings](https://www.strava.com/settings/api). Set **Authorization Callback Domain** and redirect URI to match `BACKEND_URL` (e.g. `http://localhost:8000/api/strava/callback/`).

## Local E2E Test Authentication

The local Docker environment provides an opt-in session bootstrap endpoint for automated API and UI tests:

```http
POST /api/test/login/
```

The endpoint creates or reuses a user whose username begins with `e2e_`. When required for private-route checks, it also creates a local test profile with a reserved negative Strava ID and empty token fields. It is registered only when Django debug mode and `ENABLE_E2E_TEST_AUTH` are both enabled, and it accepts no password, OAuth token, or Strava credential.

The React authentication and run-list requests explicitly send credentials so the browser can reuse the Django Session across the local frontend and backend origins.

Start the backend with local E2E authentication:

```bash
docker compose -f compose.dev.yaml -f compose.e2e.yaml up -d db backend
```

The normal `compose.dev.yaml` configuration keeps the endpoint disabled.

## Docs

Local agent planning artifacts are excluded from version control.

- **`DEPLOYMENT.md`** — production setup, `.env` variables, CORS/CSRF, build & Gunicorn
- `backend/CRON_SETUP_GUIDE.md` — cron examples for sync and weather jobs
- `backend/POLLING_SETUP.md` — frontend vs backend polling
- `OPEN_SOURCE_CHECKLIST.md` — before open-sourcing (secrets, LICENSE, etc.)

## License

[MIT](LICENSE) — Copyright (c) 2026 Jingsheng Lu
