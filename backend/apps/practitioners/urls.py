from rest_framework.routers import DefaultRouter

from .views import PractitionerViewSet

router = DefaultRouter()
router.register('', PractitionerViewSet, basename='practitioner')
urlpatterns = router.urls
