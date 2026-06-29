# Local E2E Test Login Design

## Goal

Provide Playwright with a deterministic way to create an authenticated Django session in the local Docker environment without automating real Strava OAuth or storing third-party credentials.

## Scope

This change adds one local-only test authentication endpoint to Lace Up. It does not change the production Strava login flow, add a general username/password login feature, or add Playwright tests yet.

## Endpoint

`POST /api/test/login/`

Request body:

```json
{
  "username": "e2e_runner_001"
}
```

Successful behavior:

1. Validate that `username` is a non-empty string beginning with `e2e_`.
2. Create the Django user when it does not exist, using an unusable password.
3. Reuse the user when it already exists without changing unrelated account data.
4. Establish a Django session using the configured model authentication backend.
5. Return `200` with the username and whether the user was created. The response sets the normal Django session cookie.

Invalid JSON, a missing username, or a username without the required prefix returns `400`. Non-POST requests return `405`.

## Safety Boundary

The endpoint is available only when both conditions are true:

- Django `DEBUG` is `True`.
- `ENABLE_E2E_TEST_AUTH=True` is explicitly configured.

The route is not registered when the conditions are false. The view also checks the setting and returns `404` as defense in depth.

The endpoint accepts no password, OAuth code, access token, refresh token, or other secret. Tests must not print session cookies in logs or reports.

## Docker Configuration

Add a small `compose.e2e.yaml` override that sets `ENABLE_E2E_TEST_AUTH=True` for the backend service. The normal `compose.dev.yaml` remains unchanged, so local test authentication is opt-in:

```bash
docker compose -f compose.dev.yaml -f compose.e2e.yaml up
```

## Code Ownership

- `backend/lace_up/settings.py`: parse the opt-in setting and enforce the `DEBUG` dependency.
- `backend/lace_up/test_auth.py`: validate the request, create or reuse the test user, and establish the session.
- `backend/lace_up/urls.py`: register the route only when test authentication is enabled.
- `compose.e2e.yaml`: enable the feature only for the local E2E Docker profile.
- `backend/lace_up/tests/`: verify endpoint behavior and safety controls.

## Verification

Automated Django tests will cover:

- disabled test authentication returns `404`;
- malformed or missing input returns `400`;
- usernames without the `e2e_` prefix return `400`;
- a valid request creates a user and an authenticated session;
- a repeated request reuses the same user;
- a non-POST request returns `405`.

Docker verification will start the local stack with the E2E override, call the endpoint without exposing the returned cookie, and confirm that the same client can access an authenticated Lace Up API endpoint.

## Follow-Up

After this endpoint is verified, the Playwright repository can add a setup fixture that requests an E2E session and stores authentication state for API, UI, and cross-layer tests.
