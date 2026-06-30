from django.http import JsonResponse


class TenantMiddleware:
    """Resolves the current tenant from the authenticated user and attaches it to the request.

    Placement: MUST come immediately after AuthenticationMiddleware in the
    MIDDLEWARE setting — this class reads request.user, which AuthenticationMiddleware
    populates.

    request.tenant semantics:
    - None for AnonymousUser (not authenticated, no tenant context)
    - None for superusers (they operate across tenants by design)
    - Tenant instance for every regular authenticated user whose tenant is active
    - Short-circuits with 403 if the user has no tenant or their tenant is inactive
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.tenant = None

        if not request.user.is_authenticated:
            return self.get_response(request)

        if request.user.is_superuser:
            return self.get_response(request)

        if request.user.tenant is None:
            return JsonResponse({'error': 'User has no assigned tenant'}, status=403)

        if not request.user.tenant.is_active:
            return JsonResponse({'error': 'Tenant account is inactive'}, status=403)

        request.tenant = request.user.tenant
        return self.get_response(request)
