from rest_framework.routers import DefaultRouter

from .views import PatientMessageViewSet

router = DefaultRouter()
router.register('', PatientMessageViewSet, basename='chat')
urlpatterns = router.urls
