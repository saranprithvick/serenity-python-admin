from django.contrib.auth import authenticate, login, logout

from .repositories import PractitionerRepository


class AuthService:
    def __init__(self, repository=None):
        self.repository = repository or PractitionerRepository()

    def authenticate_practitioner(self, email, password, request):
        practitioner = authenticate(request, username=email, password=password)
        if practitioner is None:
            existing = self.repository.get_by_email(email)
            if existing is not None and not existing.is_active:
                raise ValueError('Account is inactive')
            raise ValueError('Invalid credentials')
        if not practitioner.is_active:
            raise ValueError('Account is inactive')
        login(request, practitioner)
        return practitioner

    def authenticate_user(self, email, password, request):
        return self.authenticate_practitioner(email, password, request)

    def logout_practitioner(self, request):
        logout(request)

    def logout_user(self, request):
        self.logout_practitioner(request)

    def get_current_practitioner(self, request):
        if request.user.is_authenticated:
            return request.user
        return None

    def get_current_user(self, request):
        return self.get_current_practitioner(request)

    def get_practitioners(self, request):
        if request.user.is_superuser:
            return self.repository.get_all(is_superuser=True)
        return self.repository.get_all(tenant_id=request.tenant.id)

    def get_users(self, request):
        return self.get_practitioners(request)

    def get_practitioner(self, practitioner_id, request):
        if request.user.is_superuser:
            return self.repository.get_by_id(practitioner_id, is_superuser=True)
        return self.repository.get_by_id(practitioner_id, tenant_id=request.tenant.id)

    def get_user(self, user_id, request):
        return self.get_practitioner(user_id, request)

    def get_practitioners_for_tenant(self, tenant_id):
        return self.repository.get_all_for_tenant(tenant_id)

    def get_users_for_tenant(self, tenant_id):
        return self.get_practitioners_for_tenant(tenant_id)

    def create_practitioner_for_request(self, request, email, username, password, tenant_id=None, role_id=None, **extra_fields):
        from django.db import transaction
        if request.user.is_superuser:
            if not tenant_id:
                raise ValueError('tenant_id is required for superuser operations')
            from apps.tenancy.models import Tenant
            tenant = Tenant.objects.get(id=tenant_id)
        else:
            tenant = request.tenant
        with transaction.atomic():
            practitioner = self.repository.create_practitioner(
                email=email, username=username, password=password, tenant=tenant, **extra_fields
            )
            if role_id is not None:
                from apps.administration.models import Role, UserRole
                try:
                    if request.user.is_superuser:
                        role = Role.objects.get(id=role_id)
                    else:
                        role = Role.objects.get(id=role_id, tenant=tenant)
                except Role.DoesNotExist:
                    raise ValueError('Role not found or does not belong to this tenant')
                UserRole.objects.get_or_create(user=practitioner, role=role)
        return practitioner

    def create_user_for_request(self, request, email, username, password, tenant_id=None, **extra_fields):
        return self.create_practitioner_for_request(request, email, username, password, tenant_id, **extra_fields)

    def update_practitioner(self, practitioner_id, tenant_id=None, is_superuser=False, **fields):
        return self.repository.update_practitioner(
            practitioner_id, tenant_id=tenant_id, is_superuser=is_superuser, **fields
        )

    def update_user(self, user_id, tenant_id=None, is_superuser=False, **fields):
        return self.update_practitioner(user_id, tenant_id=tenant_id, is_superuser=is_superuser, **fields)

    def deactivate_practitioner(self, practitioner_id, tenant_id=None, is_superuser=False):
        return self.repository.deactivate_practitioner(
            practitioner_id, tenant_id=tenant_id, is_superuser=is_superuser
        )

    def deactivate_user(self, user_id, tenant_id=None, is_superuser=False):
        return self.deactivate_practitioner(user_id, tenant_id=tenant_id, is_superuser=is_superuser)

    def create_practitioner(self, email, username, password, tenant=None, **extra_fields):
        return self.repository.create_practitioner(
            email=email, username=username, password=password, tenant=tenant, **extra_fields
        )

    def create_user(self, email, username, password, tenant=None, **extra_fields):
        return self.create_practitioner(email, username, password, tenant, **extra_fields)

    def get_dashboard_stats(self, request):
        from apps.tenancy.models import Tenant
        from apps.administration.repositories import RoleRepository
        from apps.patients.models import Patient
        from django.contrib.auth import get_user_model
        from django.utils import timezone
        from datetime import timedelta
        role_repo = RoleRepository()
        PractitionerModel = get_user_model()

        today = timezone.now().date()
        day_names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        tenant_id = None if request.user.is_superuser else request.tenant.id

        def _user_sparkline():
            rows = []
            for i in range(6, -1, -1):
                day = today - timedelta(days=i)
                qs = PractitionerModel.objects.filter(date_joined__date=day)
                if tenant_id:
                    qs = qs.filter(tenant_id=tenant_id)
                rows.append({'day': day_names[day.weekday()], 'value': qs.count()})
            return rows

        def _patient_sparkline():
            rows = []
            for i in range(6, -1, -1):
                day = today - timedelta(days=i)
                qs = Patient.objects.filter(created_at__date=day)
                if tenant_id:
                    qs = qs.filter(tenant_id=tenant_id)
                rows.append({'day': day_names[day.weekday()], 'value': qs.count()})
            return rows

        static_sparkline = [
            {'day': 'Mon', 'value': 1}, {'day': 'Tue', 'value': 1},
            {'day': 'Wed', 'value': 1}, {'day': 'Thu', 'value': 2},
            {'day': 'Fri', 'value': 2}, {'day': 'Sat', 'value': 2},
            {'day': 'Sun', 'value': 2},
        ]

        sparklines = {
            'users': _user_sparkline(),
            'practitioners': _patient_sparkline(),
            'tenants': static_sparkline,
            'roles': static_sparkline,
        }

        if request.user.is_superuser:
            return {
                'total_users': self.repository.get_all(is_superuser=True).count(),
                'total_tenants': Tenant.objects.count(),
                'total_roles': role_repo.get_all(is_superuser=True).count(),
                'total_patients': Patient.objects.count(),
                'sparklines': sparklines,
            }
        return {
            'total_users': self.repository.get_all(tenant_id=tenant_id).count(),
            'total_tenants': 1,
            'total_roles': role_repo.get_all(tenant_id=tenant_id).count(),
            'total_patients': Patient.objects.filter(tenant_id=tenant_id).count(),
            'sparklines': sparklines,
        }

    def get_dashboard_chart_data(self, request):
        from apps.patients.models import Patient
        from django.contrib.auth import get_user_model
        from django.db.models import Count
        from django.db.models.functions import TruncMonth
        from django.utils import timezone

        PractitionerModel = get_user_model()
        is_superuser = request.user.is_superuser

        if is_superuser:
            patient_qs = Patient.objects.all()
            practitioner_qs = PractitionerModel.objects.filter(is_superuser=False)
            tenant_name = None
        else:
            patient_qs = Patient.objects.filter(tenant=request.tenant)
            practitioner_qs = PractitionerModel.objects.filter(tenant=request.tenant, is_superuser=False)
            tenant_name = request.tenant.name

        spec_qs = (
            patient_qs
            .exclude(specialisation__isnull=True)
            .values('specialisation')
            .annotate(value=Count('id'))
            .order_by('-value')
        )
        patients_by_specialisation = [
            {'name': row['specialisation'], 'value': row['value']}
            for row in spec_qs
        ]

        now = timezone.now()
        month_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        monthly_raw = (
            patient_qs
            .filter(created_at__year=now.year)
            .annotate(month=TruncMonth('created_at'))
            .values('month')
            .annotate(count=Count('id'))
            .order_by('month')
        )
        month_counts = {row['month'].month: row['count'] for row in monthly_raw}
        monthly_registrations = [
            {'month': month_names[i], 'count': month_counts.get(i + 1, 0)}
            for i in range(now.month)
        ]

        recent_patients = [
            {
                'id': p.id,
                'full_name': p.full_name,
                'specialisation': p.specialisation or '',
                'is_active': p.is_active,
                'created_at': p.created_at.isoformat(),
            }
            for p in patient_qs.order_by('-created_at')[:5]
        ]

        def time_ago(dt):
            diff = now - dt
            s = int(diff.total_seconds())
            if s < 60:
                return 'just now'
            if s < 3600:
                return f'{s // 60} min ago'
            if s < 86400:
                return f'{s // 3600} h ago'
            return f'{s // 86400} days ago'

        activity = []
        for p in patient_qs.order_by('-created_at')[:5]:
            activity.append({
                'action': 'Patient added',
                'detail': p.full_name,
                'time': time_ago(p.created_at),
                'type': 'patient',
                '_dt': p.created_at,
            })
        for u in practitioner_qs.order_by('-date_joined')[:5]:
            activity.append({
                'action': 'Practitioner created',
                'detail': u.username or u.email,
                'time': time_ago(u.date_joined),
                'type': 'practitioner',
                '_dt': u.date_joined,
            })
        activity.sort(key=lambda x: x['_dt'], reverse=True)
        recent_activity = [
            {k: v for k, v in a.items() if k != '_dt'}
            for a in activity[:5]
        ]

        return {
            'patients_by_specialisation': patients_by_specialisation,
            'monthly_registrations': monthly_registrations,
            'recent_patients': recent_patients,
            'recent_activity': recent_activity,
            'tenant_name': tenant_name,
        }

    def get_recent_activity(self, request):
        from apps.patients.models import Patient

        if request.user.is_superuser:
            practitioners = (
                self.repository.get_all(is_superuser=True)
                .exclude(is_superuser=True)
                .order_by('-date_joined')[:20]
            )
            patients = Patient.objects.all().order_by('-created_at')[:20]
        else:
            practitioners = (
                self.repository.get_all(tenant_id=request.tenant.id)
                .order_by('-date_joined')[:20]
            )
            patients = Patient.objects.filter(tenant=request.tenant).order_by('-created_at')[:20]

        events = []
        for p in practitioners:
            events.append({
                'type': 'user_created',
                'icon': 'person_add',
                'description': f'{p.username} joined as {p.user_type or "staff"}',
                'time': p.date_joined.isoformat(),
                'tenant': p.tenant.name if p.tenant else 'Platform',
            })
        for patient in patients:
            events.append({
                'type': 'patient_added',
                'icon': 'personal_injury',
                'description': f'Patient {patient.full_name} added to system',
                'time': patient.created_at.isoformat(),
                'tenant': patient.tenant.name,
            })
        events.sort(key=lambda x: x['time'], reverse=True)
        return events[:10]
