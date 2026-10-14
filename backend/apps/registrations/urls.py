from django.urls import path
from .views import (
    CustomerRegistrationSubmitView,
    RegistrationStatusCheckView,
    CustomerRegistrationResubmitView,
    RegistrationDocumentUploadView,
    AdminRegistrationListView,
    AdminRegistrationDetailView,
    AdminRegistrationEnrichApproveView,
    AdminRetrySAPPostingView,
    AdminSAPMasterDataView,
    AdminSAPCustomerLookupView,
)

urlpatterns = [
    # Customer endpoints
    path('register/', CustomerRegistrationSubmitView.as_view(), name='customer-register'),
    path('status/', RegistrationStatusCheckView.as_view(), name='registration-status'),
    path('registrations/<uuid:pk>/resubmit/', CustomerRegistrationResubmitView.as_view(), name='customer-resubmit'),
    path('registrations/<uuid:pk>/documents/', RegistrationDocumentUploadView.as_view(), name='registration-document-upload'),
    path('sap/master-data/', AdminSAPMasterDataView.as_view(), name='public-sap-master-data'),

    # Admin endpoints
    path('admin/registrations/', AdminRegistrationListView.as_view(), name='admin-registrations-list'),
    path('admin/registrations/<uuid:pk>/', AdminRegistrationDetailView.as_view(), name='admin-registration-detail'),
    path('admin/registrations/<uuid:pk>/review/', AdminRegistrationEnrichApproveView.as_view(), name='admin-registration-review'),
    path('admin/registrations/<uuid:pk>/retry-sap/', AdminRetrySAPPostingView.as_view(), name='admin-registration-retry-sap'),
    path('admin/sap/master-data/', AdminSAPMasterDataView.as_view(), name='admin-sap-master-data'),
    path('admin/sap/customer/<str:kunnr>/', AdminSAPCustomerLookupView.as_view(), name='admin-sap-customer-lookup'),
]
