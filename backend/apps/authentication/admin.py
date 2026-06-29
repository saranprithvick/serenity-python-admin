from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import UserChangeForm, UserCreationForm
from .models import User


class CustomUserCreationForm(UserCreationForm):
    class Meta:
        model = User
        fields = ('email', 'username', 'tenant')


class CustomUserChangeForm(UserChangeForm):
    class Meta:
        model = User
        fields = '__all__'


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    add_form = CustomUserCreationForm
    form = CustomUserChangeForm
    model = User

    list_display = ['email', 'username', 'tenant', 'is_active',
                    'is_staff', 'date_joined']
    list_filter = ['tenant', 'is_active', 'is_staff']
    search_fields = ['email', 'username']
    ordering = ['email']

    fieldsets = (
        (None, {'fields': ('email', 'username', 'password')}),
        ('Personal Info', {'fields': ('first_name', 'last_name', 'tenant')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser')}),
        ('Important Dates', {'fields': ('last_login', 'date_joined')}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'username', 'tenant',
                       'password1', 'password2', 'is_active', 'is_staff'),
        }),
    )
