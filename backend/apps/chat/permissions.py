from apps.administration.permissions import HasPermission


class CanViewChat(HasPermission):
    def __init__(self):
        super().__init__('Patient:View')


class CanSendChatMessage(HasPermission):
    def __init__(self):
        super().__init__('Patient:View')
