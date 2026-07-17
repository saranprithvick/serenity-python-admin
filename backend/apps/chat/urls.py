from django.urls import path
from .views import PatientChatHistoryView

urlpatterns = [
    path(
        'patients/<int:patient_id>/messages/',
        PatientChatHistoryView.as_view(),
        name='patient-chat-history'
    ),
]