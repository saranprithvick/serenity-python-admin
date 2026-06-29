from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet, ViewSet

from .models import Permission
from .permissions import HasPermission
from .serializers import (
    AssignPermissionSerializer,
    PermissionSerializer,
    RoleDetailSerializer,
    RoleSerializer,
    UserRoleSerializer,
)
from .services import PermissionService, RoleService, UserRoleService

_ROLE_PERM_MAP = {
    'create': 'Administration:RoleCreate',
    'update': 'Administration:RoleUpdate',
    'partial_update': 'Administration:RoleUpdate',
    'destroy': 'Administration:RoleDelete',
    'assign_permission': 'Administration:RoleUpdate',
    'remove_permission': 'Administration:RoleUpdate',
}

_USER_ROLE_PERM_MAP = {
    'assign': 'Administration:UserUpdate',
    'remove': 'Administration:UserUpdate',
    'user_roles': 'Administration:UserView',
    'user_permissions': 'Administration:UserView',
}


class PermissionViewSet(ReadOnlyModelViewSet):
    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer
    permission_classes = [IsAuthenticated, HasPermission('Administration:RoleView')]


class RoleViewSet(ModelViewSet):
    serializer_class = RoleSerializer

    def get_permissions(self):
        key = _ROLE_PERM_MAP.get(getattr(self, 'action', None), 'Administration:RoleView')
        return [IsAuthenticated(), HasPermission(key)]

    def get_queryset(self):
        return RoleService().get_roles_for_tenant(self.request.user.tenant_id).order_by('id')

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return RoleDetailSerializer
        return RoleSerializer

    def create(self, request, *args, **kwargs):
        if request.user.tenant is None:
            return Response(
                {'detail': 'No tenant associated with this account.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        role = RoleService().create_role(
            name=serializer.validated_data['name'],
            tenant=request.user.tenant,
            description=serializer.validated_data.get('description', ''),
        )
        return Response(RoleSerializer(role).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def assign_permission(self, request, pk=None):
        serializer = AssignPermissionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            RoleService().assign_permission_to_role(
                role_id=int(pk),
                permission_id=serializer.validated_data['permission_id'],
                tenant_id=request.user.tenant_id,
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'status': 'permission assigned'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['delete'])
    def remove_permission(self, request, pk=None):
        serializer = AssignPermissionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            RoleService().remove_permission_from_role(
                role_id=int(pk),
                permission_id=serializer.validated_data['permission_id'],
                tenant_id=request.user.tenant_id,
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)


class UserRoleViewSet(ViewSet):
    def get_permissions(self):
        key = _USER_ROLE_PERM_MAP.get(getattr(self, 'action', None), 'Administration:UserView')
        return [IsAuthenticated(), HasPermission(key)]

    def assign(self, request):
        serializer = UserRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            UserRoleService().assign_role_to_user(
                user_id=serializer.validated_data['user_id'],
                role_id=serializer.validated_data['role_id'],
                tenant_id=request.user.tenant_id,
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'status': 'role assigned'}, status=status.HTTP_201_CREATED)

    def remove(self, request):
        serializer = UserRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        UserRoleService().remove_role_from_user(
            user_id=serializer.validated_data['user_id'],
            role_id=serializer.validated_data['role_id'],
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    def user_roles(self, request, user_id=None):
        roles = UserRoleService().get_user_roles(user_id)
        return Response(RoleSerializer(roles, many=True).data)

    def user_permissions(self, request, user_id=None):
        permissions = UserRoleService().get_user_permissions(user_id)
        return Response(PermissionSerializer(permissions, many=True).data)
