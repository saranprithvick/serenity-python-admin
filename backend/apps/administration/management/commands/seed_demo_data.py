from django.core.management.base import BaseCommand

from apps.administration.models import Permission, Role, RolePermission, UserRole
from apps.administration.repositories import PermissionRepository, RoleRepository
from apps.administration.services import PermissionService, UserRoleService
from apps.patients.repositories import PatientRepository
from apps.practitioners.services import AuthService
from apps.tenancy.models import Tenant

_perm_service  = PermissionService()
_perm_repo     = PermissionRepository()
_role_repo     = RoleRepository()
_auth_service  = AuthService()
_role_service  = UserRoleService()
_patient_repo  = PatientRepository()

# Permissions assigned to each staff role in the demo
DEMO_ROLE_PERMISSIONS = {
    'Doctor':    ['Patient:View', 'Patient:Create', 'Patient:Update', 'Patient:ViewOwn'],
    'Nurse':     ['Patient:View', 'Patient:Update', 'Patient:ViewOwn'],
    'Caretaker': ['Patient:View', 'Patient:ViewOwn'],
}

# City General — 25 patients (inactive: 6, 12, 24 → 22 active, 3 inactive)
CG_PATIENTS = [
    ('Patient1',  'Knee Replacement',   'patient1@test.com',  '+44 7700 900101', 'London',     True),
    ('Patient2',  'Hip Replacement',    'patient2@test.com',  '+44 7700 900102', 'Manchester', True),
    ('Patient3',  'ACL Reconstruction', 'patient3@test.com',  '+44 7700 900103', 'Birmingham', True),
    ('Patient4',  'Spinal Surgery',     'patient4@test.com',  '+44 7700 900104', 'London',     True),
    ('Patient5',  'Physiotherapy',      'patient5@test.com',  '+44 7700 900105', 'Leeds',      True),
    ('Patient6',  'Shoulder Surgery',   'patient6@test.com',  '+44 7700 900106', 'London',     False),
    ('Patient7',  'Sports Injury',      'patient7@test.com',  '+44 7700 900107', 'Bristol',    True),
    ('Patient8',  'Knee Replacement',   'patient8@test.com',  '+44 7700 900108', 'London',     True),
    ('Patient9',  'Post-operative Care','patient9@test.com',  '+44 7700 900109', 'Sheffield',  True),
    ('Patient10', 'Hip Replacement',    'patient10@test.com', '+44 7700 900110', 'London',     True),
    ('Patient11', 'ACL Reconstruction', 'patient11@test.com', '+44 7700 900111', 'Newcastle',  True),
    ('Patient12', 'Physiotherapy',      'patient12@test.com', '+44 7700 900112', 'London',     False),
    ('Patient13', 'Spinal Surgery',     'patient13@test.com', '+44 7700 900113', 'Cardiff',    True),
    ('Patient14', 'Shoulder Surgery',   'patient14@test.com', '+44 7700 900114', 'London',     True),
    ('Patient15', 'Sports Injury',      'patient15@test.com', '+44 7700 900115', 'Edinburgh',  True),
    ('Patient16', 'Knee Replacement',   'patient16@test.com', '+44 7700 900116', 'London',     True),
    ('Patient17', 'Post-operative Care','patient17@test.com', '+44 7700 900117', 'Liverpool',  True),
    ('Patient18', 'Hip Replacement',    'patient18@test.com', '+44 7700 900118', 'London',     True),
    ('Patient19', 'Physiotherapy',      'patient19@test.com', '+44 7700 900119', 'Nottingham', True),
    ('Patient20', 'ACL Reconstruction', 'patient20@test.com', '+44 7700 900120', 'London',     True),
    ('Patient21', 'Spinal Surgery',     'patient21@test.com', '+44 7700 900121', 'Brighton',   True),
    ('Patient22', 'Sports Injury',      'patient22@test.com', '+44 7700 900122', 'London',     True),
    ('Patient23', 'Shoulder Surgery',   'patient23@test.com', '+44 7700 900123', 'Oxford',     True),
    ('Patient24', 'Knee Replacement',   'patient24@test.com', '+44 7700 900124', 'London',     False),
    ('Patient25', 'Post-operative Care','patient25@test.com', '+44 7700 900125', 'Cambridge',  True),
]

# Metro Ortho — 25 patients (inactive: 30, 38, 44 → 22 active, 3 inactive)
_MO_CONDITIONS = [
    'Knee Replacement', 'Hip Replacement', 'ACL Reconstruction', 'Spinal Surgery',
    'Physiotherapy', 'Shoulder Surgery', 'Sports Injury', 'Post-operative Care',
]
_MO_CITIES = [
    'Manchester', 'Birmingham', 'Leeds', 'Sheffield',
    'Liverpool', 'Salford', 'Bolton', 'Oldham',
]
_MO_INACTIVE = {30, 38, 44}

MO_PATIENTS = []
for _n in range(26, 51):
    _idx = _n - 26
    MO_PATIENTS.append((
        f'Patient{_n}',
        _MO_CONDITIONS[_idx % len(_MO_CONDITIONS)],
        f'patient{_n}@test.com',
        f'+44 7700 9001{_n}',
        _MO_CITIES[_idx % len(_MO_CITIES)],
        _n not in _MO_INACTIVE,
    ))


class Command(BaseCommand):
    help = 'Seed OrthoMed demo data: permissions, tenants, roles, practitioners, patients.'

    def handle(self, *args, **options):
        self._seed_permissions()
        tenant1, tenant2 = self._seed_tenants()
        self._seed_roles(tenant1, tenant2)
        self._seed_superadmin()
        self._seed_practitioners(tenant1, tenant2)
        self._seed_patients(tenant1, tenant2)
        self._print_summary(tenant1, tenant2)

    # ------------------------------------------------------------------
    # Permissions
    # ------------------------------------------------------------------

    def _seed_permissions(self):
        _perm_service.seed_default_permissions()

    # ------------------------------------------------------------------
    # Tenants
    # ------------------------------------------------------------------

    def _seed_tenants(self):
        tenant1, _ = Tenant.objects.get_or_create(
            slug='city-general',
            defaults={'name': 'City General Hospital'},
        )
        tenant2, _ = Tenant.objects.get_or_create(
            slug='metro-ortho',
            defaults={'name': 'Metro Orthopaedic Clinic'},
        )
        return tenant1, tenant2

    # ------------------------------------------------------------------
    # Roles — seed defaults then assign demo permissions
    # ------------------------------------------------------------------

    def _seed_roles(self, tenant1, tenant2):
        _perm_service.seed_default_roles(tenant1)
        _perm_service.seed_default_roles(tenant2)
        self._assign_demo_role_permissions(tenant1)
        self._assign_demo_role_permissions(tenant2)

    def _assign_demo_role_permissions(self, tenant):
        for role_name, perm_keys in DEMO_ROLE_PERMISSIONS.items():
            try:
                role = Role.objects.get(name=role_name, tenant=tenant)
            except Role.DoesNotExist:
                continue
            for key in perm_keys:
                perm = _perm_repo.get_by_key(key)
                if perm:
                    _role_repo.add_permission(role, perm)

    # ------------------------------------------------------------------
    # Superadmin
    # ------------------------------------------------------------------

    def _seed_superadmin(self):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        if not User.objects.filter(email='superadmin@orthomed.com').exists():
            _auth_service.create_practitioner(
                email='superadmin@orthomed.com',
                username='superadmin',
                password='superadmin123',
                tenant=None,
                is_superuser=True,
                is_staff=True,
            )

    # ------------------------------------------------------------------
    # Practitioners
    # ------------------------------------------------------------------

    def _seed_practitioners(self, tenant1, tenant2):
        specs = [
            # (email, username, password, tenant, user_type, specialisation, role_name)
            # City General
            ('testadmin1@citygeneral.com',     'testadmin1',     'testadmin123',    tenant1, 'tenant_admin', None,                          'Tenant Admin'),
            ('testdoctor1@citygeneral.com',    'testdoctor1',    'testdoctor123',   tenant1, 'staff',        'Orthopaedic Surgeon',          'Doctor'),
            ('testdoctor2@citygeneral.com',    'testdoctor2',    'testdoctor123',   tenant1, 'staff',        'Physiotherapist',              'Doctor'),
            ('testnurse1@citygeneral.com',     'testnurse1',     'testnurse123',    tenant1, 'staff',        None,                          'Nurse'),
            ('testnurse2@citygeneral.com',     'testnurse2',     'testnurse123',    tenant1, 'staff',        None,                          'Nurse'),
            ('testcaretaker1@citygeneral.com', 'testcaretaker1', 'testcaretaker123',tenant1, 'staff',        None,                          'Caretaker'),
            # Metro Ortho
            ('testadmin2@metroortho.com',      'testadmin2',     'testadmin123',    tenant2, 'tenant_admin', None,                          'Tenant Admin'),
            ('testdoctor3@metroortho.com',     'testdoctor3',    'testdoctor123',   tenant2, 'staff',        'Sports Medicine Specialist',   'Doctor'),
            ('testdoctor4@metroortho.com',     'testdoctor4',    'testdoctor123',   tenant2, 'staff',        'Orthopaedic Surgeon',          'Doctor'),
            ('testnurse3@metroortho.com',      'testnurse3',     'testnurse123',    tenant2, 'staff',        None,                          'Nurse'),
            ('testcaretaker2@metroortho.com',  'testcaretaker2', 'testcaretaker123',tenant2, 'staff',        None,                          'Caretaker'),
        ]
        for email, username, password, tenant, user_type, specialisation, role_name in specs:
            user = self._get_or_create_practitioner(
                email, username, password, tenant, user_type, specialisation
            )
            self._assign_role(user, role_name, tenant)

    def _get_or_create_practitioner(self, email, username, password, tenant,
                                    user_type=None, specialisation=None):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        if not User.objects.filter(email=email).exists():
            return _auth_service.create_practitioner(
                email=email,
                username=username,
                password=password,
                tenant=tenant,
                user_type=user_type,
                specialisation=specialisation,
            )
        return User.objects.get(email=email)

    def _assign_role(self, user, role_name, tenant):
        try:
            role = Role.objects.get(name=role_name, tenant=tenant)
        except Role.DoesNotExist:
            return
        if not UserRole.objects.filter(user=user, role=role).exists():
            _role_service.assign_role_to_user(user.id, role.id, tenant.id)

    # ------------------------------------------------------------------
    # Patients
    # ------------------------------------------------------------------

    def _seed_patients(self, tenant1, tenant2):
        from apps.patients.models import Patient
        for last, condition, email, phone, city, active in CG_PATIENTS:
            if not Patient.objects.filter(email=email).exists():
                _patient_repo.create(
                    tenant=tenant1,
                    first_name='Test', last_name=last,
                    specialisation=condition,
                    email=email, phone=phone,
                    city=city, country='UK',
                    is_active=active,
                )
        for last, condition, email, phone, city, active in MO_PATIENTS:
            if not Patient.objects.filter(email=email).exists():
                _patient_repo.create(
                    tenant=tenant2,
                    first_name='Test', last_name=last,
                    specialisation=condition,
                    email=email, phone=phone,
                    city=city, country='UK',
                    is_active=active,
                )

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------

    def _print_summary(self, tenant1, tenant2):
        from django.contrib.auth import get_user_model
        from apps.patients.models import Patient
        User = get_user_model()

        perm_count    = Permission.objects.count()
        tenant_count  = Tenant.objects.count()
        superuser_cnt = User.objects.filter(is_superuser=True).count()
        regular_cnt   = User.objects.filter(is_superuser=False).count()
        role_count    = Role.objects.count()
        patient_count = Patient.objects.count()

        def _role_perm_count(tenant, role_name):
            try:
                return Role.objects.get(name=role_name, tenant=tenant).permissions.count()
            except Role.DoesNotExist:
                return 0

        def _tenant_staff_counts(tenant):
            qs = User.objects.filter(tenant=tenant, is_superuser=False)
            admins   = qs.filter(user_type='tenant_admin').count()
            doctors  = UserRole.objects.filter(
                user__tenant=tenant, role__name='Doctor').count()
            nurses   = UserRole.objects.filter(
                user__tenant=tenant, role__name='Nurse').count()
            ctkrs    = UserRole.objects.filter(
                user__tenant=tenant, role__name='Caretaker').count()
            return admins, doctors, nurses, ctkrs

        def _patient_counts(tenant):
            qs = Patient.objects.filter(tenant=tenant)
            return qs.count(), qs.filter(is_active=True).count(), qs.filter(is_active=False).count()

        cg_admins, cg_docs, cg_nurses, cg_ctrs = _tenant_staff_counts(tenant1)
        cg_total_staff = User.objects.filter(tenant=tenant1).count() + superuser_cnt
        cg_pts, cg_active, cg_inactive = _patient_counts(tenant1)

        mo_admins, mo_docs, mo_nurses, mo_ctrs = _tenant_staff_counts(tenant2)
        mo_total_staff = User.objects.filter(tenant=tenant2).count()
        mo_pts, mo_active, mo_inactive = _patient_counts(tenant2)

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('=== OrthoMed Demo Data Seeded ==='))
        self.stdout.write(f'Permissions:   {perm_count:>4}')
        self.stdout.write(f'Tenants:       {tenant_count:>4}')
        self.stdout.write(f'Practitioners: {regular_cnt + superuser_cnt:>4} (including {superuser_cnt} superadmin)')
        self.stdout.write(f'Roles:         {role_count:>4} (4 per tenant)')
        self.stdout.write(f'Patients:      {patient_count:>4} (25 per tenant)')
        self.stdout.write('')
        self.stdout.write(f'City General Hospital:')
        self.stdout.write(f'  Staff: {cg_total_staff} (1 admin, {cg_docs} doctors, {cg_nurses} nurses, {cg_ctrs} caretaker)')
        self.stdout.write(f'  Patients: {cg_pts} ({cg_active} active, {cg_inactive} inactive)')
        self.stdout.write(f'  Role permissions: Doctor={_role_perm_count(tenant1,"Doctor")}, '
                          f'Nurse={_role_perm_count(tenant1,"Nurse")}, '
                          f'Caretaker={_role_perm_count(tenant1,"Caretaker")}')
        self.stdout.write('')
        self.stdout.write(f'Metro Orthopaedic Clinic:')
        def _plural(n, word):
            return f'{n} {word}{"s" if n != 1 else ""}'

        self.stdout.write(f'  Staff: {mo_total_staff} (1 admin, {_plural(mo_docs,"doctor")}, '
                          f'{_plural(mo_nurses,"nurse")}, {_plural(mo_ctrs,"caretaker")})')
        self.stdout.write(f'  Patients: {mo_pts} ({mo_active} active, {mo_inactive} inactive)')
        self.stdout.write(f'  Role permissions: Doctor={_role_perm_count(tenant2,"Doctor")}, '
                          f'Nurse={_role_perm_count(tenant2,"Nurse")}, '
                          f'Caretaker={_role_perm_count(tenant2,"Caretaker")}')
        self.stdout.write('')
        self.stdout.write('Login credentials:')
        self.stdout.write('  superadmin@orthomed.com        / superadmin123')
        self.stdout.write('  testadmin1@citygeneral.com     / testadmin123')
        self.stdout.write('  testdoctor1@citygeneral.com    / testdoctor123')
        self.stdout.write('  testdoctor2@citygeneral.com    / testdoctor123')
        self.stdout.write('  testnurse1@citygeneral.com     / testnurse123')
        self.stdout.write('  testnurse2@citygeneral.com     / testnurse123')
        self.stdout.write('  testcaretaker1@citygeneral.com / testcaretaker123')
        self.stdout.write('  testadmin2@metroortho.com      / testadmin123')
        self.stdout.write('  testdoctor3@metroortho.com     / testdoctor123')
        self.stdout.write('  testdoctor4@metroortho.com     / testdoctor123')
        self.stdout.write('  testnurse3@metroortho.com      / testnurse123')
        self.stdout.write('  testcaretaker2@metroortho.com  / testcaretaker123')
