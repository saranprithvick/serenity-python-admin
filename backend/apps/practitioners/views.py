from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from apps.administration.permissions import HasPermission

from .models import Practitioner
from .serializers import (
    CreatePractitionerSerializer,
    LoginSerializer,
    PractitionerSerializer,
    UpdatePractitionerSerializer,
)
from .services import AuthService

auth_service = AuthService()


class DashboardStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(auth_service.get_dashboard_stats(request))


class DashboardChartDataView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(auth_service.get_dashboard_chart_data(request))


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            practitioner = auth_service.authenticate_practitioner(
                email=serializer.validated_data['email'],
                password=serializer.validated_data['password'],
                request=request,
            )
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_401_UNAUTHORIZED)
        return Response(PractitionerSerializer(practitioner).data, status=status.HTTP_200_OK)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        auth_service.logout_practitioner(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(PractitionerSerializer(request.user).data, status=status.HTTP_200_OK)


class PractitionerViewSet(ModelViewSet):
    serializer_class = PractitionerSerializer

    def get_queryset(self):
        return auth_service.get_practitioners(self.request).order_by('id')

    def get_serializer_class(self):
        if self.action == 'create':
            return CreatePractitionerSerializer
        if self.action in ('update', 'partial_update'):
            return UpdatePractitionerSerializer
        return PractitionerSerializer

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
        serializer = CreatePractitionerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            practitioner = auth_service.create_practitioner_for_request(
                request=request,
                email=data['email'],
                username=data['username'],
                password=data['password'],
                tenant_id=data.get('tenant_id'),
                first_name=data.get('first_name', ''),
                last_name=data.get('last_name', ''),
                user_type=data.get('user_type'),
                specialisation=data.get('specialisation'),
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(PractitionerSerializer(practitioner).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = UpdatePractitionerSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        if request.user.is_superuser:
            practitioner = auth_service.update_practitioner(
                instance.id, is_superuser=True, **serializer.validated_data
            )
        else:
            practitioner = auth_service.update_practitioner(
                instance.id, tenant_id=request.tenant.id, **serializer.validated_data
            )
        if practitioner is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(PractitionerSerializer(practitioner).data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.pk == request.user.pk:
            return Response(
                {'detail': 'You cannot deactivate your own account.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if request.user.is_superuser:
            success = auth_service.deactivate_practitioner(instance.id, is_superuser=True)
        else:
            success = auth_service.deactivate_practitioner(instance.id, tenant_id=request.tenant.id)
        if not success:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)
