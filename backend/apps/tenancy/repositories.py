from .models import Tenant


class TenantRepository:
    """Data-access layer for Tenant. All Tenant ORM queries live here."""

    def get_by_id(self, tenant_id):
        return Tenant.objects.filter(pk=tenant_id).first()

    def get_by_slug(self, slug):
        return Tenant.objects.filter(slug=slug).first()

    def get_all_active(self):
        return Tenant.objects.filter(is_active=True)

    def create(self, name, slug):
        return Tenant.objects.create(name=name, slug=slug)
