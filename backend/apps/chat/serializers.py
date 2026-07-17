from rest_framework import serializers
from .models import PatientChatMessage


class PatientChatMessageSerializer(
    serializers.ModelSerializer
):
    sent_by_name = serializers.SerializerMethodField()
    sent_by_email = serializers.SerializerMethodField()
    sent_by_initials = serializers.SerializerMethodField()

    class Meta:
        model = PatientChatMessage
        fields = [
            'id', 'patient_id',
            'sent_by_id', 'sent_by_name',
            'sent_by_email', 'sent_by_initials',
            'message', 'sent_at', 'is_read'
        ]
        read_only_fields = fields

    def get_sent_by_name(self, obj):
        if not obj.sent_by:
            return 'Unknown'
        first = obj.sent_by.first_name or ''
        last = obj.sent_by.last_name or ''
        full = f"{first} {last}".strip()
        return full if full else obj.sent_by.email

    def get_sent_by_email(self, obj):
        return obj.sent_by.email if obj.sent_by else ''

    def get_sent_by_initials(self, obj):
        if not obj.sent_by:
            return '?'
        name = self.get_sent_by_name(obj)
        parts = name.split()
        if len(parts) >= 2:
            return f"{parts[0][0]}{parts[1][0]}".upper()
        return name[0].upper() if name else '?'


class SendChatMessageSerializer(
    serializers.Serializer
):
    message = serializers.CharField(
        required=True,
        max_length=5000,
        allow_blank=False
    )