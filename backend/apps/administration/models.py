from django.conf import settings
from django.db import models

from apps.tenancy.models import TenantAwareModel

DEFAULT_ROLE_PERMISSIONS = {
    'Tenant Admin': [
        'Administration:UserView',
        'Administration:UserCreate',
        'Administration:UserUpdate',
        'Administration:UserDelete',
        'Administration:RoleView',
        'Administration:RoleCreate',
        'Administration:RoleUpdate',
        'Administration:RoleDelete',
        'Patient:View',
        'Patient:Create',
        'Patient:Update',
        'Patient:Delete',
        'Patient:ViewOwn',
        'Patient:SendMessage',
    ],
    'Doctor': [
        'Patient:SendMessage',
    ],
    'Nurse': [],
    'Caretaker': [],
}


class Permission(models.Model):
    id = models.AutoField(primary_key=True)
    key = models.CharField(max_length=100, unique=True)
    module = models.CharField(max_length=50)
    action = models.CharField(max_length=50)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ['module', 'action']

    def __str__(self):
        return self.key

    @classmethod
    def get_or_create_defaults(cls):
        defaults = [
            ('Administration', 'UserView'),
            ('Administration', 'UserCreate'),
            ('Administration', 'UserUpdate'),
            ('Administration', 'UserDelete'),
            ('Administration', 'RoleView'),
            ('Administration', 'RoleCreate'),
            ('Administration', 'RoleUpdate'),
            ('Administration', 'RoleDelete'),
            ('Patient', 'View'),
            ('Patient', 'Create'),
            ('Patient', 'Update'),
            ('Patient', 'Delete'),
            ('Patient', 'ViewOwn'),
            ('Patient', 'SendMessage'),
        ]
        for module, action in defaults:
            key = f'{module}:{action}'
            cls.objects.get_or_create(
                key=key,
                defaults={'module': module, 'action': action},
            )


class Role(TenantAwareModel):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    permissions = models.ManyToManyField(
        Permission,
        through='RolePermission',
        related_name='roles',
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('tenant', 'name')

    def __str__(self):
        return f'{self.name} ({self.tenant})'


class RolePermission(models.Model):
    id = models.AutoField(primary_key=True)
    role = models.ForeignKey(Role, on_delete=models.CASCADE)
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE)

    class Meta:
        unique_together = ('role', 'permission')


class UserRole(models.Model):
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
    )
    role = models.ForeignKey(Role, on_delete=models.CASCADE)

    class Meta:
        unique_together = ('user', 'role')
