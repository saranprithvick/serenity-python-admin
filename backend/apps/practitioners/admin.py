from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import UserChangeForm, UserCreationForm

from .models import Practitioner


class PractitionerCreationForm(UserCreationForm):
    class Meta:
        model = Practitioner
        fields = ('email', 'username', 'tenant')


class PractitionerChangeForm(UserChangeForm):
    class Meta:
        model = Practitioner
        fields = '__all__'


@admin.register(Practitioner)
class PractitionerAdmin(BaseUserAdmin):
    add_form = PractitionerCreationForm
    form = PractitionerChangeForm
    model = Practitioner

    list_display = ['email', 'username', 'tenant', 'user_type', 'is_active', 'is_staff', 'date_joined']
    list_filter = ['tenant', 'is_active', 'is_staff', 'user_type']
    search_fields = ['email', 'username']
    ordering = ['email']

    fieldsets = (
        (None, {'fields': ('email', 'username', 'password')}),
        ('Personal Info', {'fields': ('first_name', 'last_name', 'tenant', 'user_type', 'specialisation')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser')}),
        ('Important Dates', {'fields': ('last_login', 'date_joined')}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'username', 'tenant', 'user_type',
                       'password1', 'password2', 'is_active', 'is_staff'),
        }),
    )
