# Lace Up — Resume Project Description

## Project Name
**Lace Up** — Running Records & Statistics Web App (Strava Integration)

---

## One-Line Summary (under project title)
Strava-based running data sync and visualization platform: OAuth login, activity sync, run heatmap, weekly/monthly volume and pace trends, outdoor-run weather integration, and async updates via scheduled jobs.

---

## Tech Stack
- **Frontend:** React 19, React Router, Ant Design, Axios, Recharts, Leaflet / React-Leaflet, Mapbox Polyline
- **Backend:** Django 5, Django REST Framework, Session authentication, CORS
- **Data & APIs:** PostgreSQL (psycopg2), Strava API (OAuth2, activities, Webhook), Open-Meteo Weather API
- **Deployment & Ops:** Gunicorn, Cron (activity sync, weather update)

---

## Features & Implementation
- **Strava OAuth login:** Callback handling, session persistence; frontend routing and data fetch based on auth state.
- **Activity sync:** Paginated fetch from Strava, sync only Run-type activities; “first sync” fast mode and full sync; Django management commands for Cron-driven background sync.
- **Run list:** Distance, duration, pace, heart rate, calories, weather (outdoor), type (outdoor/treadmill); weather status (pending/updating/completed/failed) with frontend polling.
- **Weather:** Open-Meteo by run start time and lat/lng; first sync gets weather for first N runs, rest marked pending; batch backfill via Cron and polling API.
- **Run heatmap:** Decode polylines, render routes with Leaflet; click list item to highlight corresponding route.
- **Stats page:** This week/month volume, total runs, average pace; Recharts bar chart (weekly/monthly range options), line chart (recent N runs pace trend).
- **Background jobs:** Cron runs `sync_activities` and `update_weather` using full venv Python path; logs to file for debugging.
- **Mobile:** Viewport meta, responsive header and stat cards (flexWrap, Ant Design Col xs/sm/md), touch-friendly layout.

---

## Resume — Short Version (3–4 bullets)

**Lace Up | Running Records & Statistics Web App**

- Full-stack **React + Django** app with **Strava OAuth** and activity sync; store run records in **PostgreSQL** with pagination and deduplication.
- **Run list**, **heatmap** (Leaflet + encoded polyline), **weekly/monthly volume** and **pace trend** charts (Recharts); outdoor runs show weather via **Open-Meteo** with async status (pending/updating/completed) and background jobs.
- Backend **management commands** and REST APIs for sync and weather; **Cron** for scheduled sync and weather updates; frontend session auth, polling, and responsive layout for mobile.

---

## Resume — Minimal (1–2 lines)

**Lace Up:** Strava-based running data sync and visualization web app. Stack: React, Django, PostgreSQL. OAuth login, activity sync, heatmap, weekly/monthly stats and pace trends, outdoor-run weather, Cron-based sync and weather updates; mobile-responsive UI.

---

## Resume — Single bullet (for tight space)

**Lace Up:** Full-stack running stats app (React, Django, PostgreSQL) with Strava OAuth, activity sync, heatmap, Recharts volume/pace charts, Open-Meteo weather for outdoor runs, and Cron jobs for sync and weather; responsive for mobile.

---

*Copy from “Short Version” or “Minimal” into your resume and trim to 2–3 bullets as needed.*
