# Local E2E Test Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in local endpoint that creates or reuses an `e2e_` Django user and returns an authenticated session for Playwright.

**Architecture:** A focused Django view owns request validation and session creation. Django settings and URL registration enforce the `DEBUG` plus `ENABLE_E2E_TEST_AUTH` safety boundary, while a separate Compose override enables the feature only for local E2E runs.

**Tech Stack:** Python 3.12, Django 5.2, Django test client, Docker Compose, PostgreSQL

---

## File Structure

- Create `backend/lace_up/test_auth.py`: local-only E2E login view.
- Create `backend/lace_up/test_e2e_auth.py`: endpoint behavior and session tests.
- Modify `backend/lace_up/settings.py`: derive the safe opt-in setting.
- Modify `backend/lace_up/urls.py`: conditionally register the endpoint.
- Create `compose.e2e.yaml`: enable local E2E authentication without changing normal development configuration.

### Task 1: Test And Implement The Login View

**Files:**
- Create: `backend/lace_up/test_e2e_auth.py`
- Create: `backend/lace_up/test_auth.py`

- [ ] **Step 1: Write the failing endpoint tests**

Create `backend/lace_up/test_e2e_auth.py`:

```python
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import path

from .test_auth import e2e_login


urlpatterns = [
    path("api/test/login/", e2e_login),
]


@override_settings(ROOT_URLCONF=__name__)
class E2ELoginTests(TestCase):
    endpoint = "/api/test/login/"

    @override_settings(ENABLE_E2E_TEST_AUTH=False)
    def test_returns_not_found_when_disabled(self):
        response = self.client.post(
            self.endpoint,
            data={"username": "e2e_runner"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 404)

    @override_settings(ENABLE_E2E_TEST_AUTH=True)
    def test_rejects_malformed_json(self):
        response = self.client.post(
            self.endpoint,
            data="{",
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": "Invalid JSON."})

    @override_settings(ENABLE_E2E_TEST_AUTH=True)
    def test_requires_an_e2e_username(self):
        for payload in ({}, {"username": "runner"}, {"username": 123}):
            with self.subTest(payload=payload):
                response = self.client.post(
                    self.endpoint,
                    data=payload,
                    content_type="application/json",
                )

                self.assertEqual(response.status_code, 400)
                self.assertEqual(
                    response.json(),
                    {"error": "username must be a string beginning with e2e_."},
                )

    @override_settings(ENABLE_E2E_TEST_AUTH=True)
    def test_creates_a_user_and_authenticated_session(self):
        response = self.client.post(
            self.endpoint,
            data={"username": "e2e_runner"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"username": "e2e_runner", "created": True},
        )
        user = get_user_model().objects.get(username="e2e_runner")
        self.assertFalse(user.has_usable_password())
        self.assertEqual(self.client.session["_auth_user_id"], str(user.pk))

    @override_settings(ENABLE_E2E_TEST_AUTH=True)
    def test_reuses_an_existing_e2e_user(self):
        user = get_user_model().objects.create_user(username="e2e_runner")

        response = self.client.post(
            self.endpoint,
            data={"username": "e2e_runner"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"username": "e2e_runner", "created": False},
        )
        self.assertEqual(get_user_model().objects.count(), 1)
        self.assertEqual(self.client.session["_auth_user_id"], str(user.pk))

    @override_settings(ENABLE_E2E_TEST_AUTH=True)
    def test_rejects_get_requests(self):
        response = self.client.get(self.endpoint)

        self.assertEqual(response.status_code, 405)
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
docker compose -f compose.dev.yaml run --rm backend \
  sh -c "pip install -r requirements.txt >/dev/null && python manage.py test lace_up.test_e2e_auth -v 2"
```

Expected: FAIL because `lace_up.test_auth` does not exist.

- [ ] **Step 3: Implement the minimal login view**

Create `backend/lace_up/test_auth.py`:

```python
import json

from django.conf import settings
from django.contrib.auth import get_user_model, login
from django.http import Http404, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST


@csrf_exempt
@require_POST
def e2e_login(request):
    if not settings.ENABLE_E2E_TEST_AUTH:
        raise Http404

    try:
        payload = json.loads(request.body or b"{}")
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({"error": "Invalid JSON."}, status=400)

    username = payload.get("username") if isinstance(payload, dict) else None
    if (
        not isinstance(username, str)
        or not username.startswith("e2e_")
        or len(username) > 150
    ):
        return JsonResponse(
            {"error": "username must be a string beginning with e2e_."},
            status=400,
        )

    user, created = get_user_model().objects.get_or_create(username=username)
    if created:
        user.set_unusable_password()
        user.save(update_fields=["password"])

    login(
        request,
        user,
        backend="django.contrib.auth.backends.ModelBackend",
    )
    return JsonResponse({"username": user.username, "created": created})
```

- [ ] **Step 4: Run the endpoint tests**

Run:

```bash
docker compose -f compose.dev.yaml run --rm backend \
  sh -c "pip install -r requirements.txt >/dev/null && python manage.py test lace_up.test_e2e_auth -v 2"
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit the view and tests**

```bash
git add backend/lace_up/test_auth.py backend/lace_up/test_e2e_auth.py
git commit -m "Add local E2E session login view"
```

### Task 2: Add The Settings And URL Safety Boundary

**Files:**
- Modify: `backend/lace_up/settings.py`
- Modify: `backend/lace_up/urls.py`
- Test: `backend/lace_up/test_e2e_auth.py`

- [ ] **Step 1: Add a failing settings safety test**

Append this test class to `backend/lace_up/test_e2e_auth.py`:

```python
class E2EAuthSettingsTests(SimpleTestCase):
    def test_e2e_auth_is_disabled_without_debug(self):
        self.assertFalse(settings.ENABLE_E2E_TEST_AUTH)
```

Also change the existing import from:

```python
from django.test import TestCase, override_settings
```

to:

```python
from django.conf import settings
from django.test import SimpleTestCase, TestCase, override_settings
```

Run the test process with the feature requested but debug disabled:

```bash
docker compose -f compose.dev.yaml run --rm \
  -e DEBUG=False -e ENABLE_E2E_TEST_AUTH=True backend \
  sh -c "pip install -r requirements.txt >/dev/null && python manage.py test lace_up.test_e2e_auth.E2EAuthSettingsTests -v 2"
```

Expected: FAIL because `ENABLE_E2E_TEST_AUTH` is not defined.

- [ ] **Step 2: Derive the safe setting**

In `backend/lace_up/settings.py`, directly after the existing `DEBUG` assignment, add:

```python
ENABLE_E2E_TEST_AUTH = (
    DEBUG and os.getenv("ENABLE_E2E_TEST_AUTH", "False") == "True"
)
```

- [ ] **Step 3: Register the URL only when enabled**

In `backend/lace_up/urls.py`, add:

```python
from django.conf import settings
```

After the existing `urlpatterns` list, add:

```python
if settings.ENABLE_E2E_TEST_AUTH:
    from .test_auth import e2e_login

    urlpatterns.append(path("api/test/login/", e2e_login))
```

- [ ] **Step 4: Run the focused and existing Django tests**

Run:

```bash
docker compose -f compose.dev.yaml run --rm \
  -e DEBUG=False -e ENABLE_E2E_TEST_AUTH=True backend \
  sh -c "pip install -r requirements.txt >/dev/null && python manage.py test lace_up.test_e2e_auth.E2EAuthSettingsTests -v 2"
```

Expected: 1 test passes.

Run:

```bash
docker compose -f compose.dev.yaml run --rm backend \
  sh -c "pip install -r requirements.txt >/dev/null && python manage.py test -v 2"
```

Expected: all Django tests pass.

- [ ] **Step 5: Commit the safety boundary**

```bash
git add backend/lace_up/settings.py backend/lace_up/urls.py backend/lace_up/test_e2e_auth.py
git commit -m "Gate E2E authentication behind local settings"
```

### Task 3: Add The Docker E2E Override And Verify The Real Session

**Files:**
- Create: `compose.e2e.yaml`

- [ ] **Step 1: Create the explicit E2E override**

Create `compose.e2e.yaml`:

```yaml
services:
  backend:
    environment:
      DEBUG: "True"
      ENABLE_E2E_TEST_AUTH: "True"
```

- [ ] **Step 2: Validate only the Compose service structure**

Do not print the fully rendered Compose configuration because it may contain values loaded from `backend/.env`.

Run:

```bash
docker compose -f compose.dev.yaml -f compose.e2e.yaml config --services
```

Expected output includes `db`, `backend`, `redis`, `celery_worker`, `celery_beat`, `frontend`, `sync_scheduler`, and `weather_scheduler`.

- [ ] **Step 3: Start only the services required for API verification**

Run:

```bash
docker compose -f compose.dev.yaml -f compose.e2e.yaml up -d db backend
```

Expected: PostgreSQL becomes healthy and the backend listens on `http://localhost:8000`.

- [ ] **Step 4: Verify login and authenticated API access without printing cookies**

Run:

```bash
cookie_jar="$(mktemp)"
login_body="$(mktemp)"
trap 'rm -f "$cookie_jar" "$login_body"' EXIT

login_status="$(curl --silent --show-error \
  --output "$login_body" \
  --write-out '%{http_code}' \
  --cookie-jar "$cookie_jar" \
  --header 'Content-Type: application/json' \
  --data '{"username":"e2e_playwright"}' \
  http://localhost:8000/api/test/login/)"

test "$login_status" = "200"
grep -q '"username": "e2e_playwright"' "$login_body"

runs_status="$(curl --silent --show-error \
  --output /dev/null \
  --write-out '%{http_code}' \
  --cookie "$cookie_jar" \
  http://localhost:8000/api/runs/)"

test "$runs_status" = "200"
printf 'E2E login: %s; authenticated runs API: %s\n' "$login_status" "$runs_status"
```

Expected output:

```text
E2E login: 200; authenticated runs API: 200
```

- [ ] **Step 5: Confirm the endpoint is absent without the E2E override**

Recreate the backend using only normal development configuration:

```bash
docker compose -f compose.dev.yaml up -d --force-recreate backend
```

Then run:

```bash
status="$(curl --silent --show-error \
  --output /dev/null \
  --write-out '%{http_code}' \
  --header 'Content-Type: application/json' \
  --data '{"username":"e2e_playwright"}' \
  http://localhost:8000/api/test/login/)"

test "$status" = "404"
printf 'E2E login without override: %s\n' "$status"
```

Expected output:

```text
E2E login without override: 404
```

- [ ] **Step 6: Run final static checks and the Django suite**

```bash
git diff --check
docker compose -f compose.dev.yaml run --rm backend \
  sh -c "pip install -r requirements.txt >/dev/null && python manage.py test -v 2"
```

Expected: `git diff --check` produces no output and all Django tests pass.

- [ ] **Step 7: Commit the Docker configuration**

```bash
git add compose.e2e.yaml
git commit -m "Add local E2E Docker override"
```
