from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase, override_settings
from django.urls import get_resolver


class E2EAuthURLTests(SimpleTestCase):
    def test_e2e_login_route_is_registered_when_enabled(self):
        routes = [str(pattern.pattern) for pattern in get_resolver().url_patterns]

        self.assertIn("api/test/login/", routes)


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

    def test_rejects_get_requests(self):
        response = self.client.get(self.endpoint)

        self.assertEqual(response.status_code, 405)

    def test_rejects_malformed_json(self):
        response = self.client.post(
            self.endpoint,
            data="{",
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": "Invalid JSON."})

    def test_requires_an_e2e_username(self):
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
