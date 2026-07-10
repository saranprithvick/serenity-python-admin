from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from apps.administration.permissions import HasPermission

from .serializers import PatientMessageSerializer, SendMessageSerializer
from .services import PatientMessageService

_service = PatientMessageService()


class PatientMessageViewSet(ViewSet):
    @action(
        detail=False,
        methods=['get'],
        url_path=r'patients/(?P<patient_id>[^/.]+)/messages',
        permission_classes=[IsAuthenticated, HasPermission('Patient:View')],
    )
    def list_messages(self, request, patient_id=None):
        messages = _service.get_messages_for_patient(patient_id, request)
        serializer = PatientMessageSerializer(messages, many=True)
        return Response(serializer.data)

    @action(
        detail=False,
        methods=['post'],
        url_path=r'patients/(?P<patient_id>[^/.]+)/send-message',
        permission_classes=[IsAuthenticated, HasPermission('Patient:SendMessage')],
    )
    def send_message(self, request, patient_id=None):
        serializer = SendMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            msg = _service.send_message(
                request=request,
                patient_id=patient_id,
                subject=serializer.validated_data['subject'],
                message_text=serializer.validated_data['message'],
            )
            return Response(PatientMessageSerializer(msg).data, status=status.HTTP_201_CREATED)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response(
                {'error': 'Failed to send message. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
