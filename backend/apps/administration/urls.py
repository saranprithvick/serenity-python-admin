from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import PermissionViewSet, RoleViewSet, UserRoleViewSet

router = DefaultRouter()
router.register('permissions', PermissionViewSet, basename='permission')
router.register('roles', RoleViewSet, basename='role')

urlpatterns = [
    path('', include(router.urls)),
    path('user-roles/assign/', UserRoleViewSet.as_view({'post': 'assign'})),
    path('user-roles/remove/', UserRoleViewSet.as_view({'delete': 'remove'})),
    path('user-roles/<int:user_id>/roles/',
         UserRoleViewSet.as_view({'get': 'user_roles'})),
    path('user-roles/<int:user_id>/permissions/',
         UserRoleViewSet.as_view({'get': 'user_permissions'})),
]
