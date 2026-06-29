from django.contrib import admin
from .models import Permission, Role, RolePermission, UserRole


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ['key', 'module', 'action', 'description']
    list_filter = ['module']
    search_fields = ['key', 'module', 'action']
    ordering = ['module', 'action']


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ['name', 'tenant', 'is_active', 'created_at']
    list_filter = ['tenant', 'is_active']
    search_fields = ['name']
    ordering = ['tenant', 'name']


@admin.register(RolePermission)
class RolePermissionAdmin(admin.ModelAdmin):
    list_display = ['role', 'permission']
    list_filter = ['role__tenant']
    search_fields = ['role__name', 'permission__key']


@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
    list_display = ['user', 'role']
    list_filter = ['role__tenant']
    search_fields = ['user__email', 'role__name']
