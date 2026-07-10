from django.contrib import admin

from .models import PatientMessage


@admin.register(PatientMessage)
class PatientMessageAdmin(admin.ModelAdmin):
    list_display = ['id', 'patient', 'sent_by', 'subject', 'sent_at', 'is_delivered', 'email_sent_to']
    list_filter = ['is_delivered', 'tenant']
    search_fields = ['patient__first_name', 'patient__last_name', 'sent_by__email', 'subject']
    ordering = ['-sent_at']
