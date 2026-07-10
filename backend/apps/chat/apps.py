from django.apps import AppConfig


class ChatConfig(AppConfig):
    name = 'apps.chat'
    label = 'chat'
    verbose_name = 'Chat'
    default_auto_field = 'django.db.models.BigAutoField'
