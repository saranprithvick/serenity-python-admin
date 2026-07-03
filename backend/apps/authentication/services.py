from django.contrib.auth import authenticate, login, logout

from .repositories import UserRepository


class AuthService:
    """Authentication/session business logic. Persistence goes via the repository."""

    def __init__(self, repository=None):
        self.repository = repository or UserRepository()

    def authenticate_user(self, email, password, request):
        user = authenticate(request, username=email, password=password)
        if user is None:
            # Distinguish an inactive account from bad credentials: Django's
            # authenticate() returns None for inactive users, so re-check by email.
            existing = self.repository.get_by_email(email)
            if existing is not None and not existing.is_active:
                raise ValueError('Account is inactive')
            raise ValueError('Invalid credentials')

        if not user.is_active:
            raise ValueError('Account is inactive')

        login(request, user)
        return user

    def logout_user(self, request):
        logout(request)

    def get_current_user(self, request):
        if request.user.is_authenticated:
            return request.user
        return None

    def get_users(self, request):
        if request.user.is_superuser:
            return self.repository.get_all(is_superuser=True)
        return self.repository.get_all(tenant_id=request.tenant.id)

    def get_user(self, user_id, request):
        if request.user.is_superuser:
            return self.repository.get_by_id(user_id, is_superuser=True)
        return self.repository.get_by_id(user_id, tenant_id=request.tenant.id)

    def get_users_for_tenant(self, tenant_id):
        return self.repository.get_all_for_tenant(tenant_id)

    def create_user_for_request(self, request, email, username, password, tenant_id=None, **extra_fields):
        if request.user.is_superuser:
            if not tenant_id:
                raise ValueError('tenant_id is required for superuser operations')
            from apps.tenancy.models import Tenant
            tenant = Tenant.objects.get(id=tenant_id)
        else:
            tenant = request.tenant
        return self.repository.create_user(
            email=email, username=username, password=password, tenant=tenant, **extra_fields
        )

    def update_user(self, user_id, tenant_id=None, is_superuser=False, **fields):
        return self.repository.update_user(user_id, tenant_id=tenant_id, is_superuser=is_superuser, **fields)

    def deactivate_user(self, user_id, tenant_id=None, is_superuser=False):
        return self.repository.deactivate_user(user_id, tenant_id=tenant_id, is_superuser=is_superuser)

    def create_user(self, email, username, password, tenant=None, **extra_fields):
        return self.repository.create_user(
            email=email,
            username=username,
            password=password,
            tenant=tenant,
            **extra_fields,
        )

    def get_dashboard_stats(self, request):
        from apps.tenancy.models import Tenant
        from apps.administration.repositories import RoleRepository
        from apps.practitioners.models import Practitioner
        role_repo = RoleRepository()

        if request.user.is_superuser:
            return {
                'total_users': self.repository.get_all(is_superuser=True).count(),
                'total_tenants': Tenant.objects.count(),
                'total_roles': role_repo.get_all(is_superuser=True).count(),
                'total_practitioners': Practitioner.objects.count(),
            }
        tenant_id = request.tenant.id
        return {
            'total_users': self.repository.get_all(tenant_id=tenant_id).count(),
            'total_tenants': 1,
            'total_roles': role_repo.get_all(tenant_id=tenant_id).count(),
            'total_practitioners': Practitioner.objects.filter(tenant_id=tenant_id).count(),
        }

    def get_dashboard_chart_data(self, request):
        from apps.practitioners.models import Practitioner
        from django.contrib.auth import get_user_model
        from django.db.models import Count
        from django.db.models.functions import TruncMonth
        from django.utils import timezone

        UserModel = get_user_model()
        is_superuser = request.user.is_superuser

        if is_superuser:
            practitioner_qs = Practitioner.objects.all()
            user_qs = UserModel.objects.filter(is_superuser=False)
            tenant_name = None
        else:
            practitioner_qs = Practitioner.objects.filter(tenant=request.tenant)
            user_qs = UserModel.objects.filter(tenant=request.tenant, is_superuser=False)
            tenant_name = request.tenant.name

        # practitioners_by_specialisation
        spec_qs = (
            practitioner_qs
            .exclude(specialisation__isnull=True)
            .values('specialisation')
            .annotate(value=Count('id'))
            .order_by('-value')
        )
        practitioners_by_specialisation = [
            {'name': row['specialisation'], 'value': row['value']}
            for row in spec_qs
        ]

        # monthly_registrations — current year, up to today's month
        now = timezone.now()
        month_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        monthly_raw = (
            practitioner_qs
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

        # recent_practitioners — last 5
        recent_practitioners = [
            {
                'id': p.id,
                'full_name': p.full_name,
                'specialisation': p.specialisation or '',
                'is_active': p.is_active,
                'created_at': p.created_at.isoformat(),
            }
            for p in practitioner_qs.order_by('-created_at')[:5]
        ]

        # recent_activity — merge last 5 practitioners + last 5 users, sort, take 5
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
        for p in practitioner_qs.order_by('-created_at')[:5]:
            activity.append({
                'action': 'Practitioner added',
                'detail': p.full_name,
                'time': time_ago(p.created_at),
                'type': 'practitioner',
                '_dt': p.created_at,
            })
        for u in user_qs.order_by('-date_joined')[:5]:
            activity.append({
                'action': 'User created',
                'detail': u.username or u.email,
                'time': time_ago(u.date_joined),
                'type': 'user',
                '_dt': u.date_joined,
            })
        activity.sort(key=lambda x: x['_dt'], reverse=True)
        recent_activity = [
            {k: v for k, v in a.items() if k != '_dt'}
            for a in activity[:5]
        ]

        return {
            'practitioners_by_specialisation': practitioners_by_specialisation,
            'monthly_registrations': monthly_registrations,
            'recent_practitioners': recent_practitioners,
            'recent_activity': recent_activity,
            'tenant_name': tenant_name,
        }
