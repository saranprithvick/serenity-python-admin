from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .services import PatientChatService
from .serializers import PatientChatMessageSerializer
from apps.administration.permissions import HasPermission


class PatientChatHistoryView(APIView):
    permission_classes = [
        IsAuthenticated,
        HasPermission('Patient:View')
    ]

    def get(self, request, patient_id):
        service = PatientChatService()
        messages = service.get_messages(
            patient_id=patient_id,
            request=request
        )
        serializer = PatientChatMessageSerializer(
            messages, many=True
        )
        return Response(serializer.data)