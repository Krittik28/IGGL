from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.shortcuts import get_object_or_404
from django.db.models import Q
from .models import CustomerRegistration, RegistrationStatus, RegistrationDocument, DocumentType
from .serializers import (
    CustomerSelfRegistrationSerializer,
    AdminEnrichmentSerializer,
    CustomerRegistrationDetailSerializer,
    RegistrationDocumentSerializer,
)
from .sap_service import SAPODataService

class CustomerRegistrationSubmitView(APIView):
    """
    Public endpoint: Customer submits self-registration.
    Accepts green customer fields and statutory document uploads.
    """
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        serializer = CustomerSelfRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            registration = serializer.save()

            # Process attached documents
            file_mapping = {
                'doc_gst': DocumentType.GST_CERTIFICATE,
                'doc_pan': DocumentType.PAN_CARD,
                'doc_coi': DocumentType.INCORPORATION_CERT,
                'doc_poa': DocumentType.BOARD_RESOLUTION,
            }

            for field_name, doc_type in file_mapping.items():
                if field_name in request.FILES:
                    file_obj = request.FILES[field_name]
                    RegistrationDocument.objects.create(
                        registration=registration,
                        document_type=doc_type,
                        file=file_obj,
                        file_name=file_obj.name,
                        file_size=file_obj.size,
                        content_type=getattr(file_obj, 'content_type', '')
                    )

            # Also check for any additional uploaded files
            for key, file_obj in request.FILES.items():
                if key not in file_mapping:
                    RegistrationDocument.objects.create(
                        registration=registration,
                        document_type=DocumentType.OTHER,
                        file=file_obj,
                        file_name=file_obj.name,
                        file_size=file_obj.size,
                        content_type=getattr(file_obj, 'content_type', '')
                    )

            detail_data = CustomerRegistrationDetailSerializer(registration, context={'request': request}).data
            return Response({
                "message": "Registration submitted successfully. Please save your reference number for tracking.",
                "registration_number": registration.registration_number,
                "data": detail_data
            }, status=status.HTTP_201_CREATED)
        return Response({
            "error": "Validation failed",
            "details": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


class RegistrationStatusCheckView(APIView):
    """
    Public endpoint: Customer tracks their application status using reference number, PAN or GSTIN.
    """
    def get(self, request):
        query = request.query_params.get('query', '').strip()
        if not query:
            return Response({"error": "Please provide a registration number, PAN, or GSTIN."}, status=status.HTTP_400_BAD_REQUEST)

        registration = CustomerRegistration.objects.filter(
            Q(registration_number__iexact=query) |
            Q(tax_number__iexact=query) |
            Q(pan_number__iexact=query) |
            Q(email__iexact=query)
        ).first()

        if not registration:
            return Response({"error": "No registration record found matching the search criteria."}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            "id": str(registration.id),
            "registration_number": registration.registration_number,
            "status": registration.status,
            "status_display": registration.get_status_display(),
            "name1": registration.name1,
            "name2": registration.name2,
            "city": registration.city,
            "postal_code": registration.postal_code,
            "street": registration.street,
            "telephone": registration.telephone,
            "tax_number": registration.tax_number,
            "pan_number": registration.pan_number,
            "email": registration.email,
            "customer_number": registration.customer_number or None,
            "address_number": registration.address_number or None,
            "remarks": registration.remarks if registration.status in (RegistrationStatus.RETURNED, RegistrationStatus.REJECTED) else None,
            "documents": RegistrationDocumentSerializer(registration.documents.all(), many=True, context={'request': request}).data,
            "submitted_at": registration.created_at,
            "updated_at": registration.updated_at
        })


class RegistrationDocumentUploadView(APIView):
    """
    Public/Admin endpoint: Uploads an individual document for an existing registration.
    """
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, pk):
        registration = get_object_or_404(CustomerRegistration, pk=pk)
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({"error": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST)

        doc_type = request.data.get('document_type', DocumentType.OTHER)
        doc = RegistrationDocument.objects.create(
            registration=registration,
            document_type=doc_type,
            file=file_obj,
            file_name=file_obj.name,
            file_size=file_obj.size,
            content_type=getattr(file_obj, 'content_type', '')
        )
        return Response({
            "message": "Document uploaded successfully.",
            "data": RegistrationDocumentSerializer(doc, context={'request': request}).data
        }, status=status.HTTP_201_CREATED)


class CustomerRegistrationResubmitView(APIView):
    """
    Public endpoint: Customer edits flagged fields and resubmits an application that was RETURNED.
    """
    def patch(self, request, pk):
        registration = get_object_or_404(CustomerRegistration, pk=pk)
        if registration.status != RegistrationStatus.RETURNED:
            return Response({"error": "Only returned applications can be resubmitted."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = CustomerSelfRegistrationSerializer(registration, data=request.data, partial=True)
        if serializer.is_valid():
            reg = serializer.save()
            reg.status = RegistrationStatus.SUBMITTED
            reg.save()
            return Response({
                "message": "Application resubmitted successfully for IGGL review.",
                "data": CustomerRegistrationDetailSerializer(reg).data
            })
        return Response({"error": "Validation failed", "details": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


class AdminRegistrationListView(APIView):
    """
    Admin endpoint: Lists all customer registrations with optional status and search filtering.
    """
    def get(self, request):
        status_filter = request.query_params.get('status')
        search = request.query_params.get('search', '').strip()

        queryset = CustomerRegistration.objects.all()

        if status_filter:
            queryset = queryset.filter(status=status_filter)

        if search:
            queryset = queryset.filter(
                Q(name1__icontains=search) |
                Q(tax_number__icontains=search) |
                Q(pan_number__icontains=search) |
                Q(registration_number__icontains=search) |
                Q(customer_number__icontains=search)
            )

        serializer = CustomerRegistrationDetailSerializer(queryset, many=True)
        return Response(serializer.data)


class AdminRegistrationDetailView(APIView):
    """
    Admin endpoint: Returns detailed view of a single registration.
    """
    def get(self, request, pk):
        registration = get_object_or_404(CustomerRegistration, pk=pk)
        serializer = CustomerRegistrationDetailSerializer(registration)
        return Response(serializer.data)


class AdminRegistrationEnrichApproveView(APIView):
    """
    Admin endpoint: Enriches admin fields (REGIO, KTOKD, AKONT, ZTERM, VKORG)
    and executes actions (APPROVE_AND_POST, RETURN, REJECT, SAVE_DRAFT).
    """
    def patch(self, request, pk):
        registration = get_object_or_404(CustomerRegistration, pk=pk)
        action = request.data.get('action', 'SAVE_DRAFT')

        serializer = AdminEnrichmentSerializer(registration, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response({"error": "Validation failed", "details": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        # Save enriched fields
        updated_registration = serializer.save()

        if action == 'APPROVE_AND_POST':
            # Validate required Admin fields before SAP dispatch
            missing_admin_fields = []
            if not updated_registration.region:
                missing_admin_fields.append("Region")
            if not updated_registration.account_group:
                missing_admin_fields.append("Account Group")
            if not updated_registration.recon_account:
                missing_admin_fields.append("Reconciliation Account")
            if not updated_registration.payment_terms:
                missing_admin_fields.append("Terms of Payment")
            if not updated_registration.sales_org:
                missing_admin_fields.append("Sales Org")

            if missing_admin_fields:
                return Response({
                    "error": f"Missing mandatory admin fields before posting to SAP: {', '.join(missing_admin_fields)}"
                }, status=status.HTTP_400_BAD_REQUEST)

            # Mark as approved and post to SAP via OData
            updated_registration.status = RegistrationStatus.APPROVED
            updated_registration.save()

            sap_result = SAPODataService.post_customer_master(updated_registration)
            if sap_result.get('success'):
                # Activate customer portal user account and update SAP Customer Number
                from django.contrib.auth.models import User
                from portal_auth.models import UserProfile, UserRole

                user = User.objects.filter(email__iexact=updated_registration.email).first()
                if user:
                    user.is_active = True
                    user.save()
                    profile, _ = UserProfile.objects.get_or_create(user=user)
                    profile.role = UserRole.CUSTOMER
                    profile.sap_customer_code = updated_registration.customer_number
                    profile.phone = updated_registration.telephone
                    profile.company_name = updated_registration.name1
                    profile.save()

                return Response({
                    "message": "Customer Master successfully created and posted to SAP S/4HANA! Customer portal account has been activated.",
                    "customer_number": sap_result.get('customer_number'),
                    "address_number": sap_result.get('address_number'),
                    "data": CustomerRegistrationDetailSerializer(updated_registration).data
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    "message": "Customer approved, but SAP S/4HANA posting failed.",
                    "error": sap_result.get('error'),
                    "data": CustomerRegistrationDetailSerializer(updated_registration).data
                }, status=status.HTTP_502_BAD_GATEWAY)

        elif action == 'RETURN':
            remarks = request.data.get('remarks', '').strip()
            if not remarks:
                return Response({"error": "Remarks are mandatory when returning application for correction."}, status=status.HTTP_400_BAD_REQUEST)
            updated_registration.status = RegistrationStatus.RETURNED
            updated_registration.remarks = remarks
            updated_registration.save()
            return Response({
                "message": "Application returned to customer for correction.",
                "data": CustomerRegistrationDetailSerializer(updated_registration).data
            })

        elif action == 'REJECT':
            remarks = request.data.get('remarks', '').strip()
            if not remarks:
                return Response({"error": "Remarks are mandatory when rejecting application."}, status=status.HTTP_400_BAD_REQUEST)
            updated_registration.status = RegistrationStatus.REJECTED
            updated_registration.remarks = remarks
            updated_registration.save()
            return Response({
                "message": "Application rejected.",
                "data": CustomerRegistrationDetailSerializer(updated_registration).data
            })

        else: # SAVE_DRAFT
            if updated_registration.status == RegistrationStatus.SUBMITTED:
                updated_registration.status = RegistrationStatus.UNDER_REVIEW
                updated_registration.save()
            return Response({
                "message": "Admin enrichment details saved.",
                "data": CustomerRegistrationDetailSerializer(updated_registration).data
            })


class AdminRetrySAPPostingView(APIView):
    """
    Admin endpoint: Retries dispatching Customer Master to SAP S/4HANA.
    """
    def post(self, request, pk):
        registration = get_object_or_404(CustomerRegistration, pk=pk)
        sap_result = SAPODataService.post_customer_master(registration)
        if sap_result.get('success'):
            return Response({
                "message": "Successfully posted to SAP S/4HANA!",
                "customer_number": sap_result.get('customer_number'),
                "address_number": sap_result.get('address_number'),
                "data": CustomerRegistrationDetailSerializer(registration).data
            })
        else:
            return Response({
                "error": "SAP posting failed",
                "details": sap_result.get('error')
            }, status=status.HTTP_502_BAD_GATEWAY)


class AdminSAPMasterDataView(APIView):
    """
    Returns the 14 Value-Help (F4) sets from SAP ZGTA_ODATA_SRV
    for Company Code, Account Groups, Payment Terms, Tax Types, etc.
    """
    def get(self, request):
        force_refresh = request.query_params.get('refresh', 'false').lower() in ('true', '1')
        data = SAPODataService.fetch_f4_value_helps(force_refresh=force_refresh)
        return Response(data)


class AdminSAPCustomerLookupView(APIView):
    """
    Directly reads a customer master record from SAP S/4HANA by KUNNR key.
    Endpoint: /Create_CustSet(Kunnr='0021000003')
    """
    def get(self, request, kunnr):
        result = SAPODataService.read_customer_by_kunnr(kunnr)
        if result:
            return Response(result)
        return Response({"error": f"Customer {kunnr} not found in SAP S/4HANA"}, status=status.HTTP_404_NOT_FOUND)
