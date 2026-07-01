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


class CreateUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['email', 'username', 'first_name', 'last_name', 'password']

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return value

    def create(self, validated_data):
        from .services import AuthService
        service = AuthService()
        request = self.context.get('request')
        tenant = getattr(request, 'tenant', None)
        return service.create_user(
            email=validated_data['email'],
            username=validated_data['username'],
            password=validated_data['password'],
            tenant=tenant,
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
        )


class UpdateUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'is_active']
        extra_kwargs = {
            'first_name': {'required': False},
            'last_name': {'required': False},
            'is_active': {'required': False},
        }
