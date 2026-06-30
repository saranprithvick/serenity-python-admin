from django.db import models


class TenantAwareManager(models.Manager):
    """Custom manager for TenantAwareModel subclasses.

    Adds for_tenant() and for_tenant_id() helpers so callers never
    write raw filter(tenant=...) calls in views or services.
    """

    def for_tenant(self, tenant):
        if tenant is None:
            return self.get_queryset().none()
        return self.get_queryset().filter(tenant=tenant)

    def for_tenant_id(self, tenant_id):
        if tenant_id is None:
            return self.get_queryset().none()
        return self.get_queryset().filter(tenant_id=tenant_id)
