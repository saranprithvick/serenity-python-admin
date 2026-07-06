from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.administration.permissions import HasPermission

from .serializers import CreatePatientSerializer, PatientSerializer, UpdatePatientSerializer
from .services import PatientService

_PERM_MAP = {
    'list': 'Patient:View',
    'retrieve': 'Patient:View',
    'create': 'Patient:Create',
    'update': 'Patient:Update',
    'partial_update': 'Patient:Update',
    'destroy': 'Patient:Delete',
}

_service = PatientService()


class PatientViewSet(ModelViewSet):
    def get_permissions(self):
        perm_key = _PERM_MAP.get(getattr(self, 'action', None), 'Patient:View')
        return [IsAuthenticated(), HasPermission(perm_key)]

    def get_queryset(self):
        return _service.get_patients(self.request)

    def list(self, request, *args, **kwargs):
        qs = _service.get_patients(request)
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(PatientSerializer(page, many=True).data)
        return Response(PatientSerializer(qs, many=True).data)

    def retrieve(self, request, pk=None, *args, **kwargs):
        patient = _service.get_patient(pk, request)
        if patient is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(PatientSerializer(patient).data)

    def create(self, request, *args, **kwargs):
        serializer = CreatePatientSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        extra = {k: v for k, v in data.items() if k not in ('first_name', 'last_name', 'tenant_id')}
        try:
            patient = _service.create_patient(
                request=request,
                first_name=data['first_name'],
                last_name=data['last_name'],
                tenant_id=data.get('tenant_id'),
                **extra,
            )
        except (ValueError, Exception) as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(PatientSerializer(patient).data, status=status.HTTP_201_CREATED)

    def update(self, request, pk=None, *args, **kwargs):
        serializer = UpdatePatientSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        patient = _service.update_patient(pk, request, **serializer.validated_data)
        if patient is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(PatientSerializer(patient).data)

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    def destroy(self, request, pk=None, *args, **kwargs):
        success = _service.deactivate_patient(pk, request)
        if not success:
            return Response(status=status.HTTP_404_NOT_FOUND)
        patient = _service.get_patient(pk, request)
        return Response(PatientSerializer(patient).data, status=status.HTTP_200_OK)
