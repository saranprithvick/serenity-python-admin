from rest_framework import serializers

from .models import Patient


class PatientSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)

    class Meta:
        model = Patient
        fields = [
            'id', 'tenant_id', 'tenant_name', 'first_name', 'last_name', 'full_name',
            'email', 'phone', 'specialisation', 'city', 'country',
            'address', 'is_active', 'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'full_name', 'tenant_id', 'tenant_name', 'created_at', 'updated_at']


class PatientDetailSerializer(PatientSerializer):
    tenant_name = serializers.SerializerMethodField()

    class Meta(PatientSerializer.Meta):
        fields = PatientSerializer.Meta.fields + ['tenant_name']

    def get_tenant_name(self, obj):
        return obj.tenant.name if obj.tenant else None


class CreatePatientSerializer(serializers.ModelSerializer):
    tenant_id = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = Patient
        fields = [
            'first_name', 'last_name', 'email', 'phone',
            'specialisation', 'city', 'country', 'address', 'notes',
            'tenant_id',
        ]
        extra_kwargs = {
            'first_name': {'required': True},
            'last_name': {'required': True},
        }


class UpdatePatientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = [
            'first_name', 'last_name', 'email', 'phone',
            'specialisation', 'city', 'country', 'address',
            'is_active', 'notes',
        ]
        extra_kwargs = {
            'first_name': {'required': False},
            'last_name': {'required': False},
        }
