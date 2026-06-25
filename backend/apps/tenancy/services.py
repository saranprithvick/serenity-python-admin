from .repositories import TenantRepository


class TenantService:
    """Business logic for tenants. Delegates all persistence to the repository."""

    def __init__(self, repository=None):
        self.repository = repository or TenantRepository()

    def get_tenant(self, tenant_id):
        return self.repository.get_by_id(tenant_id)

    def get_tenant_by_slug(self, slug):
        return self.repository.get_by_slug(slug)

    def get_all_active_tenants(self):
        return self.repository.get_all_active()

    def create_tenant(self, name, slug):
        return self.repository.create(name=name, slug=slug)
