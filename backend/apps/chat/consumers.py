import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async


class PatientChatConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        self.patient_id = self.scope[
            'url_route']['kwargs']['patient_id']

        # Authenticate via session key in query string
        self.user = await self.get_user_from_session()

        if not self.user or not self.user.is_authenticated:
            await self.close(code=4001)
            return

        has_access = await self.check_patient_access()
        if not has_access:
            await self.close(code=4003)
            return

        self.group_name = (
            f'patient_chat_{self.patient_id}'
        )
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        await self.accept()

        messages = await self.get_message_history()
        await self.send(text_data=json.dumps({
            'type': 'history',
            'messages': messages
        }))

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            message_text = data.get(
                'message', '').strip()
            if not message_text:
                return

            msg = await self.save_message(
                message_text)
            if not msg:
                return

            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'chat_message',
                    'id': msg['id'],
                    'message': msg['message'],
                    'sent_by_id': msg['sent_by_id'],
                    'sent_by_name': msg['sent_by_name'],
                    'sent_by_initials': msg[
                        'sent_by_initials'],
                    'sent_at': msg['sent_at'],
                    'is_read': False
                }
            )
        except json.JSONDecodeError:
            pass
        except Exception as e:
            print(f'receive error: {e}')

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'message',
            'id': event['id'],
            'message': event['message'],
            'sent_by_id': event['sent_by_id'],
            'sent_by_name': event['sent_by_name'],
            'sent_by_initials': event['sent_by_initials'],
            'sent_at': event['sent_at'],
            'is_read': event['is_read']
        }))

    @database_sync_to_async
    def get_user_from_session(self):
        from django.contrib.sessions.models import Session
        from django.contrib.auth import get_user_model
        from django.utils import timezone

        User = get_user_model()

        # Try session cookie first (standard flow)
        scope_user = self.scope.get('user')
        if scope_user and scope_user.is_authenticated:
            return scope_user

        # Fall back to session key in query string
        query_string = self.scope.get(
            'query_string', b'').decode()
        session_key = None

        for param in query_string.split('&'):
            if param.startswith('session_key='):
                session_key = param.split('=', 1)[1]
                break

        if not session_key:
            return None

        try:
            session = Session.objects.get(
                session_key=session_key,
                expire_date__gt=timezone.now()
            )
            user_id = session.get_decoded().get(
                '_auth_user_id')
            if not user_id:
                return None
            return User.objects.get(pk=user_id)
        except (Session.DoesNotExist,
                User.DoesNotExist):
            return None

    @database_sync_to_async
    def check_patient_access(self):
        from apps.patients.models import Patient
        user = self.user
        if user.is_superuser:
            return Patient.objects.filter(
                id=self.patient_id).exists()
        if not hasattr(user, 'tenant') \
                or not user.tenant:
            return False
        return Patient.objects.filter(
            id=self.patient_id,
            tenant=user.tenant
        ).exists()

    @database_sync_to_async
    def get_message_history(self):
        from .models import PatientChatMessage
        from .serializers import PatientChatMessageSerializer
        messages = PatientChatMessage.objects.filter(
            patient_id=self.patient_id
        ).select_related('sent_by').order_by(
            'sent_at')[:50]
        serializer = PatientChatMessageSerializer(
            messages, many=True)
        return [dict(m) for m in serializer.data]

    @database_sync_to_async
    def save_message(self, message_text):
        from .models import PatientChatMessage
        from apps.patients.models import Patient

        user = self.user
        try:
            if user.is_superuser:
                patient = Patient.objects.get(
                    id=self.patient_id)
            else:
                patient = Patient.objects.get(
                    id=self.patient_id,
                    tenant=user.tenant
                )

            msg = PatientChatMessage.objects.create(
                tenant=patient.tenant,
                patient=patient,
                sent_by=user,
                message=message_text
            )

            # Build name without get_full_name()
            first = getattr(user, 'first_name', '') or ''
            last = getattr(user, 'last_name', '') or ''
            full_name = f"{first} {last}".strip()
            name = full_name if full_name else user.email

            parts = name.split()
            initials = (
                f"{parts[0][0]}{parts[1][0]}".upper()
                if len(parts) >= 2
                else name[0].upper() if name else '?'
            )

            return {
                'id': msg.id,
                'message': msg.message,
                'sent_by_id': user.id,
                'sent_by_name': name,
                'sent_by_initials': initials,
                'sent_at': msg.sent_at.isoformat(),
            }
        except Patient.DoesNotExist:
            return None
        except Exception as e:
            print(f'save_message error: {e}')
            return None