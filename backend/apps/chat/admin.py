from django.contrib import admin
from .models import PatientChatMessage


@admin.register(PatientChatMessage)
class PatientChatMessageAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'patient', 'sent_by',
        'message_preview', 'sent_at',
        'is_read', 'tenant'
    ]
    list_filter = ['is_read', 'tenant', 'sent_at']
    search_fields = [
        'patient__first_name',
        'patient__last_name',
        'sent_by__email',
        'message'
    ]
    ordering = ['-sent_at']

    def message_preview(self, obj):
        return (obj.message[:50] + '...'
                if len(obj.message) > 50
                else obj.message)
    message_preview.short_description = 'Message'