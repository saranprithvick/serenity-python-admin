from rest_framework import serializers

from .models import Permission, Role


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ['id', 'key', 'module', 'action', 'description']


class RoleSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)

    class Meta:
        model = Role
        fields = ['id', 'name', 'description', 'is_active', 'created_at', 'tenant_id', 'tenant_name']
        read_only_fields = ['id', 'created_at', 'tenant_id']


class RoleDetailSerializer(RoleSerializer):
    permissions = PermissionSerializer(many=True, read_only=True)

    class Meta(RoleSerializer.Meta):
        fields = RoleSerializer.Meta.fields + ['permissions']


class AssignPermissionSerializer(serializers.Serializer):
    permission_id = serializers.IntegerField(required=True)

    def validate_permission_id(self, value):
        if not Permission.objects.filter(id=value).exists():
            raise serializers.ValidationError('Permission not found.')
        return value


class UserRoleSerializer(serializers.Serializer):
    user_id = serializers.IntegerField(required=True)
    role_id = serializers.IntegerField(required=True)
