from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.administration.permissions import HasPermission

from .serializers import (
    CreatePractitionerSerializer,
    PractitionerSerializer,
    UpdatePractitionerSerializer,
)
from .services import PractitionerService

_PERM_MAP = {
    'list': 'Practitioner:View',
    'retrieve': 'Practitioner:View',
    'create': 'Practitioner:Create',
    'update': 'Practitioner:Update',
    'partial_update': 'Practitioner:Update',
    'destroy': 'Practitioner:Delete',
}

_service = PractitionerService()


class PractitionerViewSet(ModelViewSet):
    def get_permissions(self):
        perm_key = _PERM_MAP.get(getattr(self, 'action', None), 'Practitioner:View')
        return [IsAuthenticated(), HasPermission(perm_key)]

    def get_queryset(self):
        return _service.get_practitioners(self.request)

    def list(self, request, *args, **kwargs):
        qs = _service.get_practitioners(request)
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(PractitionerSerializer(page, many=True).data)
        return Response(PractitionerSerializer(qs, many=True).data)

    def retrieve(self, request, pk=None, *args, **kwargs):
        practitioner = _service.get_practitioner(pk, request)
        if practitioner is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(PractitionerSerializer(practitioner).data)

    def create(self, request, *args, **kwargs):
        serializer = CreatePractitionerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        extra = {k: v for k, v in data.items() if k not in ('first_name', 'last_name', 'tenant_id')}
        try:
            practitioner = _service.create_practitioner(
                request=request,
                first_name=data['first_name'],
                last_name=data['last_name'],
                tenant_id=data.get('tenant_id'),
                **extra,
            )
        except (ValueError, Exception) as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(PractitionerSerializer(practitioner).data, status=status.HTTP_201_CREATED)

    def update(self, request, pk=None, *args, **kwargs):
        serializer = UpdatePractitionerSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        practitioner = _service.update_practitioner(pk, request, **serializer.validated_data)
        if practitioner is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(PractitionerSerializer(practitioner).data)

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    def destroy(self, request, pk=None, *args, **kwargs):
        success = _service.deactivate_practitioner(pk, request)
        if not success:
            return Response(status=status.HTTP_404_NOT_FOUND)
        practitioner = _service.get_practitioner(pk, request)
        return Response(PractitionerSerializer(practitioner).data, status=status.HTTP_200_OK)
