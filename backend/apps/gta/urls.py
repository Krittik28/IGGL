from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GTAAgreementViewSet, CapacityTrancheViewSet, UFTPathViewSet

router = DefaultRouter()
router.register(r'gtas', GTAAgreementViewSet, basename='gta')
router.register(r'capacity-tranches', CapacityTrancheViewSet, basename='capacity-tranche')
router.register(r'uft-paths', UFTPathViewSet, basename='uft-path')

urlpatterns = [
    path('', include(router.urls)),
]
