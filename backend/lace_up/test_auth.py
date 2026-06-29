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
