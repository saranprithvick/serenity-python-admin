from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    DashboardChartDataView,
    DashboardStatsView,
    LoginView,
    LogoutView,
    MeView,
    PractitionerViewSet,
    RecentActivityView,
)

router = DefaultRouter()
router.register('practitioners', PractitionerViewSet, basename='practitioner')

urlpatterns = [
    path('practitioners/auth/login/', LoginView.as_view(), name='login'),
    path('practitioners/auth/logout/', LogoutView.as_view(), name='logout'),
    path('practitioners/auth/me/', MeView.as_view(), name='me'),
    path('practitioners/auth/dashboard-stats/', DashboardStatsView.as_view(), name='dashboard-stats'),
    path('practitioners/auth/dashboard-chart-data/', DashboardChartDataView.as_view(), name='dashboard-chart-data'),
    path('practitioners/auth/recent-activity/', RecentActivityView.as_view(), name='recent-activity'),
] + router.urls
