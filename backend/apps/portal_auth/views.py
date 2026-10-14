from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from django.contrib.auth import logout
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import LoginRequestSerializer, UserProfileSerializer
from .models import UserProfile, UserRole

class PortalLoginView(APIView):
    """
    Credential authentication endpoint for Customer Portal and IGGL Admin Portal.
    Validates user credentials and returns JWT access/refresh tokens and RBAC profile.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginRequestSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']
            profile = serializer.validated_data['profile']

            # Generate standard JWT
            refresh = RefreshToken.for_user(user)
            refresh['email'] = user.email
            refresh['role'] = profile.role
            refresh['full_name'] = profile.full_name or user.get_full_name()
            refresh['company_name'] = getattr(profile, 'company_name', '')
            refresh['customer_code'] = getattr(profile, 'sap_customer_code', '')

            access_token = str(refresh.access_token)
            refresh_token = str(refresh)

            profile_data = UserProfileSerializer(profile).data
            return Response({
                "message": f"Welcome back, {profile_data['full_name']}!",
                "user": profile_data,
                "role": profile.role,
                "access": access_token,
                "refresh": refresh_token,
                "token": access_token
            }, status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_401_UNAUTHORIZED)


class PortalLogoutView(APIView):
    """
    Terminates user session.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        logout(request)
        return Response({"message": "Successfully logged out of portal."})


class AvailableDemoUsersView(APIView):
    """
    Helper endpoint returning pre-configured RBAC roles and credentials for prototype evaluation.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({
            "roles": [
                {
                    "title": "Marketing Officer (L1)",
                    "email": "marketing@iggl.co.in",
                    "role": "MARKETING_L1",
                    "department": "Marketing & Commercial",
                    "can_review": True,
                    "can_post_sap": False
                },
                {
                    "title": "Finance Manager (L2)",
                    "email": "finance@iggl.co.in",
                    "role": "FINANCE_L2",
                    "department": "Finance & Accounts",
                    "can_review": True,
                    "can_post_sap": True
                },
                {
                    "title": "IT Administrator",
                    "email": "admin@iggl.co.in",
                    "role": "IT_ADMIN",
                    "department": "IT & Systems",
                    "can_review": True,
                    "can_post_sap": True
                },
                {
                    "title": "Shipper Customer",
                    "email": "contact@royalsundaram.com",
                    "role": "CUSTOMER",
                    "department": "Royal Sundaram General Insurance",
                    "can_review": False,
                    "can_post_sap": False
                }
            ]
        })


class AdminCustomerListView(APIView):
    """
    Admin endpoint: Lists all onboarded shipper customers, their profile details,
    SAP BP numbers, registration addresses, and active contract counts.
    """
    def get(self, request):
        from django.db import models
        from django.apps import apps
        from django.contrib.auth.models import User

        CustomerRegistration = apps.get_model('registrations', 'CustomerRegistration')
        GTAAgreement = apps.get_model('gta', 'GTAAgreement')
        CapacityTranche = apps.get_model('gta', 'CapacityTranche')

        # 1. Customer UserProfiles
        customer_profiles = UserProfile.objects.filter(role=UserRole.CUSTOMER).select_related('user')

        # 2. Approved or BP_CREATED registrations
        approved_regs = CustomerRegistration.objects.filter(
            status__in=['APPROVED', 'BP_CREATED']
        )

        reg_by_email = {r.email.lower(): r for r in approved_regs if r.email}
        reg_by_code = {r.customer_number: r for r in approved_regs if r.customer_number}

        seen_emails = set()
        customers = []

        for p in customer_profiles:
            u = p.user
            email_lower = (u.email or u.username).lower()
            seen_emails.add(email_lower)
            reg = reg_by_email.get(email_lower) or (reg_by_code.get(p.sap_customer_code) if p.sap_customer_code else None)

            customer_code = p.sap_customer_code or (reg.customer_number if reg else '')
            gtas_qs = GTAAgreement.objects.filter(
                models.Q(customer_code=customer_code) |
                models.Q(user=u) |
                (models.Q(customer_registration=reg) if reg else models.Q(pk=None))
            ) if (customer_code or reg) else GTAAgreement.objects.none()

            gta_count = gtas_qs.count()
            ct_count = CapacityTranche.objects.filter(gta__in=gtas_qs).count()

            company = p.company_name or (reg.name1 if reg else u.get_full_name() or u.username)
            customers.append({
                "id": u.id,
                "user_id": u.id,
                "username": u.username,
                "email": u.email,
                "company_name": company,
                "customer_code": customer_code or 'PENDING_SAP',
                "phone": p.phone or (reg.telephone if reg else ''),
                "designation": p.designation or '',
                "is_active": u.is_active,
                "date_joined": u.date_joined.strftime('%d-%m-%Y') if u.date_joined else '',
                "registration_number": reg.registration_number if reg else '',
                "gstin": reg.tax_number if reg else '',
                "pan": reg.pan_number if reg else '',
                "street": reg.street if reg else '',
                "city": reg.city if reg else '',
                "postal_code": reg.postal_code if reg else '',
                "region": reg.region if reg else '',
                "country": reg.country if reg else 'IN',
                "gta_count": gta_count,
                "ct_count": ct_count,
            })

        # Include approved registrations without separate UserProfile if any
        for r in approved_regs:
            r_email = (r.email or '').lower()
            if r_email and r_email not in seen_emails:
                seen_emails.add(r_email)
                gtas_qs = GTAAgreement.objects.filter(
                    models.Q(customer_code=r.customer_number) |
                    models.Q(customer_registration=r)
                ) if r.customer_number else GTAAgreement.objects.none()

                customers.append({
                    "id": None,
                    "user_id": None,
                    "username": r.email,
                    "email": r.email,
                    "company_name": r.name1,
                    "customer_code": r.customer_number or 'PENDING_SAP',
                    "phone": r.telephone,
                    "designation": '',
                    "is_active": True,
                    "date_joined": r.created_at.strftime('%d-%m-%Y') if r.created_at else '',
                    "registration_number": r.registration_number,
                    "gstin": r.tax_number,
                    "pan": r.pan_number,
                    "street": r.street,
                    "city": r.city,
                    "postal_code": r.postal_code,
                    "region": r.region,
                    "country": r.country,
                    "gta_count": gtas_qs.count(),
                    "ct_count": CapacityTranche.objects.filter(gta__in=gtas_qs).count(),
                })

        return Response(customers)


class AdminCustomerChangePasswordView(APIView):
    """
    Admin endpoint: Resets/updates customer portal password.
    """
    def post(self, request, user_id):
        from django.db import models
        from django.apps import apps
        from django.contrib.auth.models import User

        new_password = request.data.get('password') or request.data.get('new_password')
        if not new_password:
            return Response({"error": "New password is required."}, status=status.HTTP_400_BAD_REQUEST)
        if len(new_password) < 4:
            return Response({"error": "Password must be at least 4 characters."}, status=status.HTTP_400_BAD_REQUEST)

        user = None
        if str(user_id).isdigit():
            user = User.objects.filter(pk=int(user_id)).first()
        if not user:
            user = User.objects.filter(email__iexact=str(user_id)).first()
        if not user:
            CustomerRegistration = apps.get_model('registrations', 'CustomerRegistration')
            reg = CustomerRegistration.objects.filter(id=user_id).first() if len(str(user_id)) == 36 else None
            if reg:
                user = User.objects.filter(email__iexact=reg.email).first()

        if not user:
            CustomerRegistration = apps.get_model('registrations', 'CustomerRegistration')
            reg = CustomerRegistration.objects.filter(
                models.Q(email__iexact=str(user_id)) | models.Q(customer_number=str(user_id))
            ).first()
            if reg and reg.email:
                user = User.objects.create_user(username=reg.email, email=reg.email, password=new_password)
                profile, _ = UserProfile.objects.get_or_create(user=user)
                profile.role = UserRole.CUSTOMER
                profile.company_name = reg.name1
                profile.sap_customer_code = reg.customer_number
                profile.phone = reg.telephone
                profile.save()
                return Response({
                    "success": True,
                    "message": f"Created portal user account and set password for {user.email}."
                }, status=status.HTTP_200_OK)

            return Response({"error": "Customer account not found."}, status=status.HTTP_404_NOT_FOUND)

        user.set_password(new_password)
        user.save()

        return Response({
            "success": True,
            "message": f"Password for customer {user.email} has been updated successfully."
        }, status=status.HTTP_200_OK)

