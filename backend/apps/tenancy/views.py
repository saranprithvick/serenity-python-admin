from rest_framework import viewsets

from .serializers import TenantSerializer
from .services import TenantService


class TenantViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only API for tenants (list + retrieve). No write endpoints.

    The queryset is sourced from the service layer rather than the ORM, so
    the view stays thin and tenant access stays funnelled through one place.
    """

    serializer_class = TenantSerializer
    service = TenantService()

    def get_queryset(self):
        return self.service.get_all_active_tenants()
