from rest_framework import serializers

from .models import Practitioner


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(
        required=True,
        write_only=True,
        style={'input_type': 'password'},
    )


class PractitionerSerializer(serializers.ModelSerializer):
    role_name = serializers.SerializerMethodField()

    def get_role_name(self, obj):
        from apps.administration.models import UserRole
        ur = UserRole.objects.filter(user=obj).select_related('role').first()
        return ur.role.name if ur else None

    class Meta:
        model = Practitioner
        fields = [
            'id', 'email', 'username', 'first_name', 'last_name',
            'tenant_id', 'user_type', 'specialisation', 'role_name',
            'is_active', 'is_superuser', 'date_joined',
        ]
        read_only_fields = [
            'id', 'email', 'username', 'tenant_id',
            'is_active', 'is_superuser', 'date_joined',
        ]


class CreatePractitionerSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    tenant_id = serializers.IntegerField(required=False, allow_null=True)
    role_id = serializers.IntegerField(required=False, allow_null=True, write_only=True)

    class Meta:
        model = Practitioner
        fields = [
            'email', 'username', 'first_name', 'last_name', 'password',
            'tenant_id', 'user_type', 'specialisation', 'role_id',
        ]

    def validate_email(self, value):
        if Practitioner.objects.filter(email=value).exists():
            raise serializers.ValidationError('A practitioner with this email already exists.')
        return value


class UpdatePractitionerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Practitioner
        fields = ['first_name', 'last_name', 'is_active', 'user_type', 'specialisation']
        extra_kwargs = {
            'first_name': {'required': False},
            'last_name': {'required': False},
            'is_active': {'required': False},
            'user_type': {'required': False},
            'specialisation': {'required': False},
        }
