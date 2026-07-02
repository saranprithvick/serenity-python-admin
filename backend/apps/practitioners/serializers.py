from rest_framework import serializers

from .models import Practitioner


class PractitionerSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = Practitioner
        fields = [
            'id', 'tenant_id', 'first_name', 'last_name', 'full_name',
            'email', 'phone', 'specialisation', 'city', 'country',
            'address', 'is_active', 'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'full_name', 'tenant_id', 'created_at', 'updated_at']


class CreatePractitionerSerializer(serializers.ModelSerializer):
    tenant_id = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = Practitioner
        fields = [
            'first_name', 'last_name', 'email', 'phone',
            'specialisation', 'city', 'country', 'address', 'notes',
            'tenant_id',
        ]
        extra_kwargs = {
            'first_name': {'required': True},
            'last_name': {'required': True},
        }


class UpdatePractitionerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Practitioner
        fields = [
            'first_name', 'last_name', 'email', 'phone',
            'specialisation', 'city', 'country', 'address',
            'is_active', 'notes',
        ]
        extra_kwargs = {
            'first_name': {'required': False},
            'last_name': {'required': False},
        }
