from rest_framework import serializers

from .models import PatientMessage


class PatientMessageSerializer(serializers.ModelSerializer):
    sent_by_name = serializers.SerializerMethodField()

    class Meta:
        model = PatientMessage
        fields = [
            'id', 'patient_id', 'sent_by_id', 'sent_by_name',
            'subject', 'message', 'sent_at',
            'email_sent_to', 'is_delivered', 'delivery_error',
        ]
        read_only_fields = [
            'id', 'patient_id', 'sent_by_id', 'sent_by_name',
            'subject', 'message', 'sent_at',
            'email_sent_to', 'is_delivered', 'delivery_error',
        ]

    def get_sent_by_name(self, obj):
        if not obj.sent_by:
            return ''
        name = f"{obj.sent_by.first_name} {obj.sent_by.last_name}".strip()
        return name or obj.sent_by.email


class SendMessageSerializer(serializers.Serializer):
    subject = serializers.CharField(max_length=200, required=True)
    message = serializers.CharField(required=True, max_length=5000)

    def validate_subject(self, value):
        if not value.strip():
            raise serializers.ValidationError('Subject cannot be blank.')
        return value

    def validate_message(self, value):
        if not value.strip():
            raise serializers.ValidationError('Message cannot be blank.')
        return value
