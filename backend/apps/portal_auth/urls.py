from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    PortalLoginView,
    PortalLogoutView,
    AvailableDemoUsersView,
    AdminCustomerListView,
    AdminCustomerChangePasswordView
)

urlpatterns = [
    path('auth/login/', PortalLoginView.as_view(), name='portal-login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='portal-token-refresh'),
    path('auth/logout/', PortalLogoutView.as_view(), name='portal-logout'),
    path('auth/demo-users/', AvailableDemoUsersView.as_view(), name='portal-demo-users'),

    # Admin Customer Directory & Credential Management
    path('admin/customers/', AdminCustomerListView.as_view(), name='admin-customer-list'),
    path('admin/customers/<str:user_id>/change-password/', AdminCustomerChangePasswordView.as_view(), name='admin-customer-change-password'),
]
