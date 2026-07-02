from apps.administration.permissions import HasPermission

PractitionerViewPermission = HasPermission('Practitioner:View')
PractitionerCreatePermission = HasPermission('Practitioner:Create')
PractitionerUpdatePermission = HasPermission('Practitioner:Update')
PractitionerDeletePermission = HasPermission('Practitioner:Delete')
