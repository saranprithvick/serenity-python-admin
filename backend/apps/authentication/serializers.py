from rest_framework import serializers

from .models import User


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(
        required=True,
        write_only=True,
        style={'input_type': 'password'},
    )


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'username',
            'first_name',
            'last_name',
            'tenant_id',
            'is_active',
            'date_joined',
        ]
        read_only_fields = [
            'id',
            'email',
            'username',
            'tenant_id',
            'is_active',
            'date_joined',
        ]
