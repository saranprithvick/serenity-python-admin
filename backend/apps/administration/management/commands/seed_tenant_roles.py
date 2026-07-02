from django.core.management.base import BaseCommand

from apps.tenancy.models import Tenant
from apps.administration.services import PermissionService

_perm_service = PermissionService()


class Command(BaseCommand):
    help = 'Create default roles (Tenant Admin, Staff) with correct permissions for every tenant.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--tenant-id',
            type=int,
            dest='tenant_id',
            help='Seed only the specified tenant ID instead of all tenants.',
        )

    def handle(self, *args, **options):
        tenant_id = options.get('tenant_id')
        tenants = Tenant.objects.filter(id=tenant_id) if tenant_id else Tenant.objects.all()

        if not tenants.exists():
            self.stdout.write(self.style.WARNING('No tenants found.'))
            return

        for tenant in tenants:
            _perm_service.seed_default_roles(tenant)
            self.stdout.write(
                self.style.SUCCESS(f'  ✓ {tenant.name} (id={tenant.id}) — roles seeded')
            )

        self.stdout.write(self.style.SUCCESS(f'Done. {tenants.count()} tenant(s) processed.'))
