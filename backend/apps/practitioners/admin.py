from django.contrib import admin

from .models import Practitioner


@admin.register(Practitioner)
class PractitionerAdmin(admin.ModelAdmin):
    list_display = ('id', 'full_name', 'specialisation', 'email', 'phone', 'tenant', 'is_active')
