from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from apps.administration.permissions import HasPermission

from .models import User
from .serializers import CreateUserSerializer, LoginSerializer, UpdateUserSerializer, UserSerializer
from .services import AuthService

auth_service = AuthService()


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            user = auth_service.authenticate_user(
                email=serializer.validated_data['email'],
                password=serializer.validated_data['password'],
                request=request,
            )
        except ValueError as exc:
            return Response(
                {'error': str(exc)},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        return Response(UserSerializer(user).data, status=status.HTTP_200_OK)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        auth_service.logout_user(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data, status=status.HTTP_200_OK)


class UserViewSet(ModelViewSet):
    serializer_class = UserSerializer

    def get_queryset(self):
        tenant = self.request.tenant
        if tenant is None:
            return User.objects.none()
        return auth_service.get_users_for_tenant(tenant.id).order_by('id')

    def get_serializer_class(self):
        if self.action == 'create':
            return CreateUserSerializer
        if self.action in ('update', 'partial_update'):
            return UpdateUserSerializer
        return UserSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            perms = [IsAuthenticated(), HasPermission('Administration:UserView')]
        elif self.action == 'create':
            perms = [IsAuthenticated(), HasPermission('Administration:UserCreate')]
        elif self.action in ('update', 'partial_update'):
            perms = [IsAuthenticated(), HasPermission('Administration:UserUpdate')]
        elif self.action == 'destroy':
            perms = [IsAuthenticated(), HasPermission('Administration:UserDelete')]
        else:
            perms = [IsAuthenticated()]
        return perms

    def create(self, request, *args, **kwargs):
        if request.tenant is None:
            return Response(
                {'detail': 'Tenant context is required to create a user.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = UpdateUserSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        user = auth_service.update_user(
            instance.id, request.tenant.id, **serializer.validated_data
        )
        if user is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(UserSerializer(user).data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.pk == request.user.pk:
            return Response(
                {'detail': 'You cannot deactivate your own account.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        success = auth_service.deactivate_user(instance.id, request.tenant.id)
        if not success:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)
