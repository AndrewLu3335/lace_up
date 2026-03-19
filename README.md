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

## Docs

- **`DEPLOYMENT.md`** — production setup, `.env` variables, CORS/CSRF, build & Gunicorn
- `backend/CRON_SETUP_GUIDE.md` — cron examples for sync and weather jobs
- `backend/POLLING_SETUP.md` — frontend vs backend polling
- `OPEN_SOURCE_CHECKLIST.md` — before open-sourcing (secrets, LICENSE, etc.)

## License

[MIT](LICENSE) — Copyright (c) 2026 Jingsheng Lu
