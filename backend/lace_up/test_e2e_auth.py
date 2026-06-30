from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import path

from .test_auth import e2e_login


urlpatterns = [
    path("api/test/login/", e2e_login),
]


@override_settings(ROOT_URLCONF=__name__, ENABLE_E2E_TEST_AUTH=True)
class E2ELoginTests(TestCase):
    endpoint = "/api/test/login/"

    @override_settings(ENABLE_E2E_TEST_AUTH=False)
    def test_returns_not_found_when_disabled(self):
        """Return 404 when the local E2E authentication feature is disabled."""
        response = self.client.post(
            self.endpoint,
            data={"username": "e2e_runner"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 404)

    def test_rejects_get_requests(self):
        """Reject non-POST requests to the local E2E login endpoint."""
        response = self.client.get(self.endpoint)

        self.assertEqual(response.status_code, 405)

    def test_rejects_malformed_json(self):
        """Return a validation error when the request body is not valid JSON."""
        response = self.client.post(
            self.endpoint,
            data="{",
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": "Invalid JSON."})

    def test_requires_an_e2e_username(self):
        """Accept only bounded string usernames that use the E2E prefix."""
        for payload in (
            {},
            {"username": "runner"},
            {"username": 123},
            {"username": "e2e_" + ("x" * 147)},
        ):
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

    def test_creates_a_user_and_authenticated_session(self):
        """Create a test user with an unusable password and start its session."""
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

    def test_reuses_an_existing_e2e_user(self):
        """Reuse an existing test user without creating a duplicate account."""
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
