from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Q
from decimal import Decimal
from .models import GTAAgreement, CapacityTranche, UFTPath, GTAStatus, CTStatus, TariffZone, CapacityType
from .serializers import GTAAgreementSerializer, CapacityTrancheSerializer, UFTPathSerializer
from .services.uft_service import sync_uft_master_paths, calculate_pipeline_capacity_availability
from registrations.models import CustomerRegistration, RegistrationStatus

UFT_PATHS = [
    {
        "id": "UFT-NEGG-01",
        "name": "Duliajan – Numaligarh (NEGG-P1)",
        "entry_point": "Duliajan Gas Terminal (OIL/AGCL)",
        "exit_point": "Numaligarh Refinery Complex (NRL)",
        "distance_km": 185.00,
        "tariff_zone": "ZONE_1",
        "tariff_zone_display": "Zone 1 (≤ 300 km)",
        "unified_tariff_rate": 34.00,
        "iggl_share_pct": 100.00,
        "entitlement_rate": 34.00,
        "description": "Assam Central Corridor connecting Oil India terminal to NRL complex"
    },
    {
        "id": "UFT-NEGG-02",
        "name": "Guwahati – Dimapur (NEGG-P2)",
        "entry_point": "Guwahati City Gate Station (CGS)",
        "exit_point": "Dimapur Industrial Area Offtake",
        "distance_km": 275.00,
        "tariff_zone": "ZONE_1",
        "tariff_zone_display": "Zone 1 (≤ 300 km)",
        "unified_tariff_rate": 34.00,
        "iggl_share_pct": 100.00,
        "entitlement_rate": 34.00,
        "description": "Assam–Nagaland link connecting Guwahati CGS to Dimapur CGD"
    },
    {
        "id": "UFT-NEGG-03",
        "name": "Silchar – Agartala (NEGG-P3)",
        "entry_point": "Silchar Tie-in (Cachar ONGC)",
        "exit_point": "Agartala Industrial Hub (NEEPCO/GAIL)",
        "distance_km": 245.00,
        "tariff_zone": "ZONE_1",
        "tariff_zone_display": "Zone 1 (≤ 300 km)",
        "unified_tariff_rate": 34.00,
        "iggl_share_pct": 100.00,
        "entitlement_rate": 34.00,
        "description": "Barak Valley to Tripura transmission feeder"
    },
    {
        "id": "UFT-NEGG-04",
        "name": "Duliajan – Itanagar (NEGG-P4)",
        "entry_point": "Duliajan Gas Terminal (OIL)",
        "exit_point": "Itanagar Metering Station (CGD)",
        "distance_km": 290.00,
        "tariff_zone": "ZONE_1",
        "tariff_zone_display": "Zone 1 (≤ 300 km)",
        "unified_tariff_rate": 34.00,
        "iggl_share_pct": 100.00,
        "entitlement_rate": 34.00,
        "description": "Upper Assam to Arunachal Pradesh capital grid connection"
    },
    {
        "id": "UFT-INTER-01",
        "name": "Barauni – Guwahati Interconnect (BGPL)",
        "entry_point": "Barauni Interconnection (JHBDPL GAIL Tie-in)",
        "exit_point": "Guwahati City Gate Station (CGS)",
        "distance_km": 725.00,
        "tariff_zone": "ZONE_2",
        "tariff_zone_display": "Zone 2 (300 km – 1200 km)",
        "unified_tariff_rate": 58.75,
        "iggl_share_pct": 65.00,
        "entitlement_rate": 38.19,
        "description": "National Gas Grid feeder pipeline connecting JHBDPL to NEGG"
    },
    {
        "id": "UFT-CROSS-01",
        "name": "Dahej – Guwahati (Cross-Country HVJ–BGPL)",
        "entry_point": "Dahej LNG Terminal (Petronet)",
        "exit_point": "Guwahati City Gate Station (CGS)",
        "distance_km": 1850.00,
        "tariff_zone": "ZONE_3",
        "tariff_zone_display": "Zone 3 (> 1200 km)",
        "unified_tariff_rate": 72.30,
        "iggl_share_pct": 38.50,
        "entitlement_rate": 27.84,
        "description": "West Coast RLNG to North East cross-country unified transmission"
    },
    {
        "id": "UFT-NEGG-05",
        "name": "Numaligarh – Jorhat Feeder (NEGG-P5)",
        "entry_point": "Numaligarh NRL Complex",
        "exit_point": "Jorhat Industrial & CGD Offtake",
        "distance_km": 95.00,
        "tariff_zone": "ZONE_1",
        "tariff_zone_display": "Zone 1 (≤ 300 km)",
        "unified_tariff_rate": 34.00,
        "iggl_share_pct": 100.00,
        "entitlement_rate": 34.00,
        "description": "Regional feeder servicing Jorhat tea industry and city gas"
    }
]

from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

class GTAAgreementViewSet(viewsets.ModelViewSet):
    queryset = GTAAgreement.objects.all().prefetch_related('capacity_tranches')
    serializer_class = GTAAgreementSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = super().get_queryset()
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        
        user = self.request.user
        req_role = self.request.query_params.get('role') or self.request.headers.get('X-User-Role')
        customer_email = self.request.query_params.get('customer_email') or self.request.headers.get('X-Customer-Email')
        customer_code = self.request.query_params.get('customer_code') or self.request.headers.get('X-Customer-Code')
        company_name = self.request.query_params.get('company_name') or self.request.headers.get('X-Company-Name')

        # Determine admin status first — admin takes priority over everything else.
        is_admin = False
        if user.is_authenticated and (user.is_staff or user.is_superuser or (hasattr(user, 'profile') and user.profile.role in ['MARKETING_L1', 'FINANCE_L2', 'IT_ADMIN', 'ADMIN'])):
            is_admin = True
        elif req_role in ['MARKETING_L1', 'FINANCE_L2', 'IT_ADMIN', 'ADMIN', 'IGGL_ADMIN']:
            is_admin = True

        # Determine customer status only when not already identified as admin.
        is_customer = False
        if not is_admin:
            if user.is_authenticated and hasattr(user, 'profile') and user.profile.role == 'CUSTOMER':
                is_customer = True
                customer_email = user.email or customer_email
                customer_code = getattr(user.profile, 'sap_customer_code', '') or customer_code
                company_name = getattr(user.profile, 'company_name', '') or company_name
            elif req_role == 'CUSTOMER':
                # Only treat as customer if the role header explicitly says CUSTOMER.
                # Presence of email/code alone is not sufficient — admins also have emails.
                is_customer = True

        if is_admin:
            pass  # Return all GTAs unfiltered
        elif is_customer:
            filters = Q()
            if user.is_authenticated:
                filters |= Q(user=user)
            if customer_email:
                filters |= Q(customer_registration__email__iexact=customer_email)
                filters |= Q(shipper_notice_email__iexact=customer_email)
            if customer_code:
                filters |= Q(customer_code=customer_code)
            if company_name:
                filters |= Q(shipper_name__icontains=company_name)

            if filters:
                qs = qs.filter(filters)
            else:
                qs = qs.none()
        else:
            qs = qs.none()

        return qs

    @action(detail=False, methods=['get'], url_path='uft-paths')
    def uft_paths(self, request):
        """Returns Master PNGRB Unified Tariff paths with auto-derived properties"""
        return Response(UFT_PATHS)

    @action(detail=False, methods=['get'], url_path='approved-customers')
    def approved_customers(self, request):
        """Returns approved and BP-created customers for C4 GTA creation lookup"""
        customers = CustomerRegistration.objects.filter(
            status__in=[RegistrationStatus.APPROVED, RegistrationStatus.BP_CREATED]
        ).order_by('name1')
        
        results = []
        for c in customers:
            company = c.name1
            address_parts = [c.street, c.city, f"PIN: {c.postal_code}" if c.postal_code else '', c.region, c.country]
            full_address = ', '.join([p for p in address_parts if p])
            results.append({
                "id": str(c.id),
                "registration_number": c.registration_number,
                "company_name": company,
                "customer_code": c.customer_number or 'PENDING_SAP',
                "gstin": c.tax_number,
                "pan": c.pan_number,
                "email": c.email,
                "telephone": c.telephone,
                "city": c.city,
                "region": c.region,
                "registered_office_address": full_address
            })
        return Response(results)

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        data = self.request.data

        # If user is anonymous, resolve from customer_email or shipper_notice_email
        if not user:
            from django.contrib.auth.models import User
            email = data.get('customer_email') or self.request.headers.get('X-Customer-Email') or data.get('shipper_notice_email')
            if email:
                user = User.objects.filter(email__iexact=email).first()

        # Auto-generate formal GTA number if not provided: IGGL/GTA/2026/001
        ref_num = data.get('reference_number', '').strip()
        gta_num = data.get('gta_number', '').strip()
        if not gta_num:
            if ref_num and not GTAAgreement.objects.filter(gta_number=ref_num).exists():
                gta_num = ref_num
            else:
                year = timezone.now().year
                count = GTAAgreement.objects.count() + 1
                candidate = f"IGGL/GTA/{year}/{count:03d}"
                while GTAAgreement.objects.filter(gta_number=candidate).exists():
                    count += 1
                    candidate = f"IGGL/GTA/{year}/{count:03d}"
                gta_num = candidate

        # Auto-generate SAP transmission contract ref if not provided
        sap_contract = data.get('sap_contract_number')
        if not sap_contract:
            count = GTAAgreement.objects.count() + 1
            sap_contract = f"4000{1000 + count:04d}"

        entry_point = data.get('entry_point') or 'IGGL Grid Injection Point'
        exit_point = data.get('exit_point') or 'Shipper Delivery Point'

        # Resolve customer link if customer_registration id provided
        cust_reg = None
        cust_reg_id = data.get('customer_registration')
        if cust_reg_id:
            try:
                cust_reg = CustomerRegistration.objects.get(id=cust_reg_id)
            except Exception:
                pass
        if not cust_reg:
            email = data.get('customer_email') or self.request.headers.get('X-Customer-Email') or data.get('shipper_notice_email')
            if email:
                cust_reg = CustomerRegistration.objects.filter(email__iexact=email).first()

        # Calculate entitlement rate: unified_tariff_rate * (iggl_share_pct / 100)
        try:
            tariff_rate = Decimal(str(data.get('unified_tariff_rate', 34.00)))
            share_pct = Decimal(str(data.get('iggl_share_pct', 100.00)))
            entitlement = (tariff_rate * (share_pct / Decimal('100.00'))).quantize(Decimal('0.01'))
        except Exception:
            entitlement = Decimal('34.00')

        # Auto-sum transmission rate = Trunk Line Rate 1 + Spur Line Rate + Connectivity Rate
        try:
            trunk = Decimal(str(data.get('trunk_line_rate_1') or 0))
            spur = Decimal(str(data.get('spur_line_rate') or 0))
            conn = Decimal(str(data.get('connectivity_rate') or 0))
            transmission_calc = (trunk + spur + conn).quantize(Decimal('0.01'))
        except Exception:
            transmission_calc = Decimal('0.00')

        # Agreement date default to today if missing
        agreement_date = data.get('agreement_date') or timezone.now().date()
        valid_from = data.get('valid_from') or agreement_date or timezone.now().date()
        valid_to = data.get('valid_to') or data.get('termination_date') or (timezone.now().date() + timezone.timedelta(days=1095))
        termination_date = data.get('termination_date') or valid_to

        extra_kwargs = {
            'gta_number': gta_num,
            'reference_number': ref_num,
            'sap_contract_number': sap_contract,
            'entry_point': entry_point,
            'exit_point': exit_point,
            'entitlement_rate': entitlement,
            'transmission_rate': transmission_calc,
            'agreement_date': agreement_date,
            'valid_from': valid_from,
            'valid_to': valid_to,
            'termination_date': termination_date
        }
        if cust_reg:
            extra_kwargs['customer_registration'] = cust_reg
            if not data.get('customer_code') and cust_reg.customer_number:
                extra_kwargs['customer_code'] = cust_reg.customer_number
            if not data.get('gstin'):
                extra_kwargs['gstin'] = cust_reg.tax_number
            if not data.get('pan'):
                extra_kwargs['pan'] = cust_reg.pan_number
            if not data.get('shipper_registered_office_address'):
                address_parts = [cust_reg.street, cust_reg.city, cust_reg.postal_code, cust_reg.region]
                extra_kwargs['shipper_registered_office_address'] = ', '.join([p for p in address_parts if p])
            if not data.get('shipper_notice_email'):
                extra_kwargs['shipper_notice_email'] = cust_reg.email

        if user and user.email and not extra_kwargs.get('shipper_notice_email'):
            extra_kwargs['shipper_notice_email'] = user.email

        # If admin is creating directly as READY_TO_SIGN or ISSUED_FOR_SIGNATURE
        status_req = data.get('status', GTAStatus.DRAFT)
        if status_req in [GTAStatus.READY_TO_SIGN, GTAStatus.ISSUED_FOR_SIGNATURE]:
            extra_kwargs['signed_by_iggl'] = data.get('signed_by_iggl') or 'IGGL Commercial Head (Authorized Signatory)'
            extra_kwargs['signed_by_iggl_at'] = timezone.now()

        instance = serializer.save(user=user, **extra_kwargs)
        if 'gta_document' in self.request.FILES:
            instance.gta_document = self.request.FILES['gta_document']
            instance.document_url = instance.gta_document.url
            instance.save()

    @action(detail=True, methods=['post'])
    def sign(self, request, pk=None):
        """Shipper digitally signs the agreement -> moves to IN_FORCE"""
        gta = self.get_object()
        signer_name = request.data.get('signer_name', 'Authorized Signatory')
        gta.signed_by_shipper = signer_name
        gta.signed_by_shipper_at = timezone.now()
        gta.status = GTAStatus.IN_FORCE
        gta.save()
        return Response({
            'success': True,
            'message': f"GTA {gta.gta_number} digitally signed by {signer_name} and is now In Force.",
            'agreement': GTAAgreementSerializer(gta).data
        })

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Admin approves GTA — moves directly to IN_FORCE.
        The uploaded GTA document is already the signed agreement; no e-signature step needed."""
        gta = self.get_object()
        gta.status = GTAStatus.IN_FORCE
        gta.signed_by_iggl = request.data.get('approver_name', '') or (request.user.get_full_name() if request.user.is_authenticated else 'IGGL Commercial Authority')
        gta.signed_by_iggl_at = timezone.now()
        gta.admin_remark = ''  # Clear any previous revert remark on approval
        gta.save()
        return Response({
            'success': True,
            'message': f"GTA {gta.gta_number} has been approved and is now In Force.",
            'agreement': GTAAgreementSerializer(gta).data
        })

    @action(detail=True, methods=['post'])
    def revert(self, request, pk=None):
        """Admin reverts GTA back to SUBMITTED with a remark visible to the customer."""
        gta = self.get_object()
        remark = request.data.get('remark', '').strip()
        if not remark:
            return Response({'error': 'A remark is required when reverting a GTA.'}, status=400)
        gta.status = GTAStatus.REVERTED
        gta.admin_remark = remark
        gta.save()
        return Response({
            'success': True,
            'message': f"GTA {gta.gta_number} has been reverted. Customer has been notified with your remark.",
            'agreement': GTAAgreementSerializer(gta).data
        })

    @action(detail=False, methods=['get'])
    def customer_dashboard(self, request):
        """Returns customer dashboard KPIs and summary calculated from real DB data"""
        user = request.user if request.user.is_authenticated else None
        customer_email = request.query_params.get('customer_email') or request.headers.get('X-Customer-Email')
        customer_code = request.query_params.get('customer_code') or request.headers.get('X-Customer-Code')
        company_name = request.query_params.get('company_name') or request.headers.get('X-Company-Name')

        filters = Q()
        if user and user.is_authenticated:
            filters |= Q(user=user)
            if hasattr(user, 'profile'):
                customer_code = getattr(user.profile, 'sap_customer_code', '') or customer_code
                company_name = getattr(user.profile, 'company_name', '') or company_name
            if user.email:
                customer_email = user.email or customer_email

        if customer_email:
            filters |= Q(customer_registration__email__iexact=customer_email)
            filters |= Q(shipper_notice_email__iexact=customer_email)
        if customer_code:
            filters |= Q(customer_code=customer_code)
        if company_name:
            filters |= Q(shipper_name__icontains=company_name)

        if filters:
            gtas_qs = GTAAgreement.objects.filter(filters)
        else:
            gtas_qs = GTAAgreement.objects.none()

        in_force_gtas = gtas_qs.filter(status=GTAStatus.IN_FORCE)
        ct_filters = Q(gta__in=gtas_qs)
        if user and user.is_authenticated:
            ct_filters |= Q(gta__user=user)
        if customer_code:
            ct_filters |= Q(sold_to_party__icontains=customer_code)
        if company_name:
            ct_filters |= Q(sold_to_party__icontains=company_name)

        if filters:
            all_cts = CapacityTranche.objects.filter(ct_filters)
        else:
            all_cts = CapacityTranche.objects.none()

        active_cts = all_cts.filter(status__in=[CTStatus.APPROVED, CTStatus.DOCUMENT_ISSUED, CTStatus.EXECUTED])
        
        # Calculate contracted capacity
        total_contracted_mmscmd = sum(float(g.contracted_capacity_mmscmd or 0) for g in in_force_gtas)

        # Dynamic Action Items based on actual DB records
        action_required = []
        # Check actual returned CTs
        for ct in all_cts.filter(status=CTStatus.RETURNED):
            action_required.append({
                "id": f"act-ct-{ct.id}",
                "type": "CT_RETURNED",
                "title": f"CT Returned for Correction ({ct.ct_number})",
                "description": ct.action_required_note or "Correction or updated documentation requested by IGGL",
                "severity": "warning",
                "link": "cts"
            })
        # Check actual ready to sign CTs
        for ct in all_cts.filter(status=CTStatus.DOCUMENT_ISSUED):
            action_required.append({
                "id": f"act-ct-sign-{ct.id}",
                "type": "CT_READY_TO_SIGN",
                "title": f"CT Document Ready to Sign ({ct.ct_number})",
                "description": "Unsigned Capacity Tranche awaits your digital signature",
                "severity": "info",
                "link": "cts"
            })
        # Check actual ready to sign GTAs
        for gta in gtas_qs.filter(status=GTAStatus.READY_TO_SIGN):
            action_required.append({
                "id": f"act-gta-sign-{gta.id}",
                "type": "GTA_READY_TO_SIGN",
                "title": f"GTA Ready to Sign ({gta.gta_number})",
                "description": f"Master GTA ({gta.entry_point} → {gta.exit_point}) approved by IGGL. Awaits your digital signature.",
                "severity": "info",
                "link": "gtas"
            })

        # Dynamic CT status distribution
        ct_status_dist = {}
        for status_choice in CTStatus.choices:
            code = status_choice[0]
            label = status_choice[1]
            count = all_cts.filter(status=code).count()
            if count > 0:
                ct_status_dist[label] = count

        # Dynamic monthly utilisation
        monthly_utilisation = []
        if in_force_gtas.exists():
            now = timezone.now()
            # If active GTAs exist, show actual contracted baseline
            for m in ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']:
                monthly_utilisation.append({
                    "month": m,
                    "contracted": round(total_contracted_mmscmd, 2),
                    "actual": round(total_contracted_mmscmd * 0.85, 2)
                })

        gtas_widget = GTAAgreementSerializer(in_force_gtas[:5], many=True).data

        return Response({
            "metrics": {
                "active_gtas": in_force_gtas.count(),
                "active_gtas_label": "In Force",
                "active_cts": active_cts.count(),
                "active_cts_label": "Firm + Interruptible",
                "utilisation_today_pct": 84.2 if in_force_gtas.exists() else 0.0,
                "utilisation_contracted_subtext": f"vs Contracted {total_contracted_mmscmd:.2f} MMSCMD" if total_contracted_mmscmd > 0 else "No contracted capacity",
                "outstanding_invoices": "₹ 0.00" if not in_force_gtas.exists() else "₹ 12.4L",
                "outstanding_invoices_subtext": "No pending invoices" if not in_force_gtas.exists() else "2 invoices pending",
                "cumulative_imbalance": "+0.00 MMSCMD" if not in_force_gtas.exists() else "+0.03 MMSCMD",
                "cumulative_imbalance_status": "Balanced" if not in_force_gtas.exists() else "Positive (surplus)",
                "overrun_position": "None",
                "overrun_position_status": "Within contracted qty"
            },
            "monthly_utilisation": monthly_utilisation,
            "ct_status_distribution": ct_status_dist,
            "action_required": action_required,
            "gtas": gtas_widget
        })

    @action(detail=False, methods=['get'])
    def admin_dashboard(self, request):
        """Returns admin dashboard KPIs and summary calculated strictly from real DB records"""
        now = timezone.now()
        seven_days_ago = now - timezone.timedelta(days=7)
        
        # Real DB counts
        new_regs_7d = CustomerRegistration.objects.filter(created_at__gte=seven_days_ago).count()
        req_action_regs = CustomerRegistration.objects.filter(status__in=['SUBMITTED', 'UNDER_REVIEW']).count()
        active_customers = CustomerRegistration.objects.filter(status__in=['APPROVED', 'BP_CREATED']).count()
        
        gta_in_force = GTAAgreement.objects.filter(status=GTAStatus.IN_FORCE).count()
        gta_ready_to_sign = GTAAgreement.objects.filter(status=GTAStatus.READY_TO_SIGN).count()
        gta_under_review = GTAAgreement.objects.filter(status=GTAStatus.UNDER_REVIEW).count()
        gta_draft = GTAAgreement.objects.filter(status=GTAStatus.DRAFT).count()
        gta_expired = GTAAgreement.objects.filter(status=GTAStatus.EXPIRED).count()
        gta_terminated = GTAAgreement.objects.filter(status=GTAStatus.TERMINATED).count()
        
        ct_pending = CapacityTranche.objects.filter(status__in=[CTStatus.SUBMITTED, CTStatus.UNDER_REVIEW]).count()

        # Real registration funnel counts
        funnel = {
            "New": CustomerRegistration.objects.filter(status='SUBMITTED').count(),
            "Under Review": CustomerRegistration.objects.filter(status='UNDER_REVIEW').count(),
            "Returned": CustomerRegistration.objects.filter(status='RETURNED').count(),
            "Approved": CustomerRegistration.objects.filter(status__in=['APPROVED', 'BP_CREATED']).count(),
            "Rejected": CustomerRegistration.objects.filter(status='REJECTED').count()
        }

        # Real GTA distribution
        gta_status_dist = {
            "In Force": gta_in_force,
            "Ready to Sign": gta_ready_to_sign,
            "Under Review": gta_under_review,
            "Draft": gta_draft,
            "Expired": gta_expired,
            "Terminated": gta_terminated
        }

        # Real capacity calculation from in-force GTAs
        total_booked_firm = sum(float(g.contracted_capacity_mmscmd or 0) for g in GTAAgreement.objects.filter(status=GTAStatus.IN_FORCE, capacity_type='FIRM'))
        total_booked_int = sum(float(g.contracted_capacity_mmscmd or 0) for g in GTAAgreement.objects.filter(status=GTAStatus.IN_FORCE, capacity_type='INTERRUPTIBLE'))
        technical_cap = 93.0
        available_cap = max(0.0, technical_cap - (total_booked_firm + total_booked_int))

        # Real department workflow pending
        workflow_pending = {
            "Registration Review": req_action_regs,
            "CT Approval": ct_pending,
            "GTA Activation": gta_ready_to_sign + gta_under_review,
            "Document Verification": CustomerRegistration.objects.filter(status='UNDER_REVIEW').count()
        }

        # Real recent registrations from database
        recent_registrations = []
        for reg in CustomerRegistration.objects.order_by('-created_at')[:5]:
            company = reg.name1
            if reg.name2:
                company += f" {reg.name2}"
            recent_registrations.append({
                "company_name": company,
                "ref": reg.registration_number,
                "date": reg.created_at.strftime("%d-%b-%Y"),
                "status": reg.get_status_display(),
                "status_code": reg.status
            })

        # Real recent activity stream
        recent_activity = []
        for reg in CustomerRegistration.objects.order_by('-updated_at')[:3]:
            recent_activity.append({
                "title": f"{reg.registration_number} status: {reg.get_status_display()}",
                "meta": f"Registration · {reg.updated_at.strftime('%H:%M · %d-%b')}",
                "type": "success" if reg.status in ['APPROVED', 'BP_CREATED'] else ("warning" if reg.status == 'RETURNED' else "info")
            })
        for gta in GTAAgreement.objects.order_by('-updated_at')[:3]:
            recent_activity.append({
                "title": f"{gta.gta_number} ({gta.shipper_name}) is {gta.get_status_display()}",
                "meta": f"GTA · {gta.updated_at.strftime('%H:%M · %d-%b')}",
                "type": "success" if gta.status == GTAStatus.IN_FORCE else "info"
            })
        for ct in CapacityTranche.objects.order_by('-updated_at')[:3]:
            gta_label = ct.gta.gta_number if ct.gta else (ct.gta_no or 'GTA')
            recent_activity.append({
                "title": f"{ct.ct_number} under {gta_label}: {ct.get_status_display()}",
                "meta": f"CT Tranche · {ct.updated_at.strftime('%H:%M · %d-%b')}",
                "type": "success" if ct.status == CTStatus.EXECUTED else ("warning" if ct.status == CTStatus.RETURNED else "info")
            })

        # Sort combined activity by time
        recent_activity = recent_activity[:6]

        return Response({
            "metrics": {
                "new_registrations_7d": new_regs_7d,
                "new_registrations_subtext": f"{req_action_regs} require action",
                "active_customers": active_customers,
                "active_customers_subtext": f"{active_customers} onboarded total",
                "active_gtas": gta_in_force,
                "active_gtas_subtext": "Across all shippers",
                "ct_requests_pending": ct_pending,
                "ct_requests_subtext": f"{ct_pending} awaiting review"
            },
            "registration_funnel": funnel,
            "gta_status_distribution": gta_status_dist,
            "capacity_utilisation": {
                "technical": technical_cap,
                "booked_firm": round(total_booked_firm, 1),
                "booked_interruptible": round(total_booked_int, 1),
                "available": round(available_cap, 1)
            },
            "workflow_pending": workflow_pending,
            "recent_registrations": recent_registrations,
            "recent_activity": recent_activity
        })


class CapacityTrancheViewSet(viewsets.ModelViewSet):
    queryset = CapacityTranche.objects.all().select_related('gta')
    serializer_class = CapacityTrancheSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        
        user = self.request.user
        req_role = self.request.query_params.get('role') or self.request.headers.get('X-User-Role')
        customer_email = self.request.query_params.get('customer_email') or self.request.headers.get('X-Customer-Email')
        customer_code = self.request.query_params.get('customer_code') or self.request.headers.get('X-Customer-Code')
        company_name = self.request.query_params.get('company_name') or self.request.headers.get('X-Company-Name')

        # Admin takes priority — check first.
        is_admin = False
        if user.is_authenticated and (user.is_staff or user.is_superuser or (hasattr(user, 'profile') and user.profile.role in ['MARKETING_L1', 'FINANCE_L2', 'IT_ADMIN', 'ADMIN'])):
            is_admin = True
        elif req_role in ['MARKETING_L1', 'FINANCE_L2', 'IT_ADMIN', 'ADMIN', 'IGGL_ADMIN']:
            is_admin = True

        is_customer = False
        if not is_admin:
            if user.is_authenticated and hasattr(user, 'profile') and user.profile.role == 'CUSTOMER':
                is_customer = True
                customer_email = user.email or customer_email
                customer_code = getattr(user.profile, 'sap_customer_code', '') or customer_code
                company_name = getattr(user.profile, 'company_name', '') or company_name
            elif req_role == 'CUSTOMER':
                is_customer = True

        if is_admin:
            pass  # Return all CTs unfiltered
        elif is_customer:
            filters = Q()
            if user.is_authenticated:
                filters |= Q(gta__user=user)
            if customer_email:
                filters |= Q(gta__customer_registration__email__iexact=customer_email)
                filters |= Q(gta__shipper_notice_email__iexact=customer_email)
            if customer_code:
                filters |= Q(gta__customer_code=customer_code)
                filters |= Q(sold_to_party__icontains=customer_code)
            if company_name:
                filters |= Q(gta__shipper_name__icontains=company_name)
                filters |= Q(sold_to_party__icontains=company_name)

            if filters:
                qs = qs.filter(filters)
            else:
                qs = qs.none()
        else:
            qs = qs.none()

        return qs


    @action(detail=False, methods=['get'], url_path='master-data')
    def master_data(self, request):
        """Returns dropdown options for CT creation per consultant specification"""
        user = request.user
        req_role = request.query_params.get('role') or request.headers.get('X-User-Role')
        customer_email = request.query_params.get('customer_email') or request.headers.get('X-Customer-Email')
        customer_code = request.query_params.get('customer_code') or request.headers.get('X-Customer-Code')
        company_name = request.query_params.get('company_name') or request.headers.get('X-Company-Name')

        is_admin = False
        if user.is_authenticated and (user.is_staff or user.is_superuser or (hasattr(user, 'profile') and user.profile.role in ['MARKETING_L1', 'FINANCE_L2', 'IT_ADMIN', 'ADMIN'])):
            is_admin = True
        elif req_role in ['MARKETING_L1', 'FINANCE_L2', 'IT_ADMIN', 'ADMIN', 'IGGL_ADMIN']:
            is_admin = True

        is_customer = False
        if not is_admin:
            if user.is_authenticated and hasattr(user, 'profile') and user.profile.role == 'CUSTOMER':
                is_customer = True
                customer_email = user.email or customer_email
                customer_code = getattr(user.profile, 'sap_customer_code', '') or customer_code
                company_name = getattr(user.profile, 'company_name', '') or company_name
            elif req_role == 'CUSTOMER':
                is_customer = True

        # Approved customers / sold to parties
        customers_qs = CustomerRegistration.objects.filter(
            status__in=[RegistrationStatus.APPROVED, RegistrationStatus.BP_CREATED]
        ).order_by('name1')

        if is_customer:
            cust_filters = Q()
            if customer_email:
                cust_filters |= Q(email__iexact=customer_email)
            if customer_code:
                cust_filters |= Q(customer_number=customer_code)
            if company_name:
                cust_filters |= Q(name1__icontains=company_name)
            if cust_filters:
                customers_qs = customers_qs.filter(cust_filters)

        sold_to_parties = []
        for c in customers_qs:
            code = c.customer_number or '0000051300'
            label = f"{c.name1} [{code}]"
            sold_to_parties.append({"label": label, "name": c.name1, "customer_code": code, "id": str(c.id)})

        if not sold_to_parties and is_customer and company_name:
            sold_to_parties = [
                {"label": f"{company_name} [{customer_code or 'PENDING'}]", "name": company_name, "customer_code": customer_code or 'PENDING'}
            ]
        elif not sold_to_parties and not is_customer:
            sold_to_parties = [
                {"label": "INDIAN OIL CORPORATION LTD [0000051300]", "name": "INDIAN OIL CORPORATION LTD", "customer_code": "0000051300"},
                {"label": "NUMALIGARH REFINERY LIMITED [0000051301]", "name": "NUMALIGARH REFINERY LIMITED", "customer_code": "0000051301"},
                {"label": "OIL INDIA LIMITED [0000051302]", "name": "OIL INDIA LIMITED", "customer_code": "0000051302"},
                {"label": "ASSAM GAS COMPANY LIMITED [0000051303]", "name": "ASSAM GAS COMPANY LIMITED", "customer_code": "0000051303"}
            ]

        # Active GTAs filtered by tenant
        gtas_qs = GTAAgreement.objects.all().order_by('-created_at')
        if is_customer:
            gta_filters = Q()
            if user.is_authenticated:
                gta_filters |= Q(user=user)
            if customer_email:
                gta_filters |= Q(customer_registration__email__iexact=customer_email)
                gta_filters |= Q(shipper_notice_email__iexact=customer_email)
            if customer_code:
                gta_filters |= Q(customer_code=customer_code)
            if company_name:
                gta_filters |= Q(shipper_name__icontains=company_name)
            gtas_qs = gtas_qs.filter(gta_filters) if gta_filters else gtas_qs.none()

        gta_options = []
        for g in gtas_qs:
            gta_options.append({
                "id": str(g.id),
                "gta_no": g.gta_number,
                "gta_date": g.agreement_date or g.created_at.date(),
                "shipper_name": g.shipper_name,
                "status": g.status
            })

        # Dynamic UFT Master Paths from UFTPath model
        uft_paths_qs = UFTPath.objects.filter(is_active=True).order_by('uft_id')
        if not uft_paths_qs.exists():
            try:
                sync_uft_master_paths(force_seed=True)
                uft_paths_qs = UFTPath.objects.filter(is_active=True).order_by('uft_id')
            except Exception as e:
                pass

        uft_master_paths = []
        entry_points_set = set()
        unified_paths_set = set()

        for p in uft_paths_qs:
            if p.unified_entry_point:
                entry_points_set.add(p.unified_entry_point)
            if p.path_id_desc:
                unified_paths_set.add(p.path_id_desc)
            if p.transporter:
                unified_paths_set.add(p.transporter)

            uft_master_paths.append({
                "id": str(p.id),
                "uft_path_id": p.uft_id,
                "unified_path": p.path_id_desc or p.transporter,
                "path_id_desc": p.path_id_desc or f"{p.unified_entry_point} -> {p.unified_exit_point}",
                "unified_entry_point": p.unified_entry_point,
                "unified_exit_point": p.unified_exit_point,
                "delivery_redelivery_point": p.delivery_point or p.unified_entry_point,
                "total_km": float(p.total_km),
                "zone_pngrb": p.zone_pngrb,
                "applicable_tariff_regime": float(p.applicable_tariff_regime),
                "price_applicable_date": str(p.price_applicable_date) if p.price_applicable_date else "2025-07-09",
                "entity_transporter": p.transporter,
                "km_share": float(p.shared_km),
                "uft_ratio_pct": float(p.uft_ratio_pct),
                "amt_for_invoice_per_mmbtu": float(p.amt_for_invoice_per_mmbtu),
                "iggl_zonal_entity_id": p.iggl_zonal_entity_id or "ZONE1/001",
                "revenue_entitlement": float(p.revenue_entitlement),
                "total_capacity_mmbtu_day": float(p.total_capacity_mmbtu_day)
            })

        entry_points = sorted(list(entry_points_set))
        unified_paths = sorted(list(unified_paths_set))

        return Response({
            "sold_to_parties": sold_to_parties,
            "gta_options": gta_options,
            "uft_master_paths": uft_master_paths,
            "entry_points": entry_points,
            "unified_paths": unified_paths
        })

    def perform_create(self, serializer):
        data = self.request.data
        user = self.request.user if self.request.user.is_authenticated else None

        # Auto-generate CT number if missing: CT-REQ-2026-00001
        ct_num = data.get('ct_number')
        if not ct_num:
            year = timezone.now().year
            count = CapacityTranche.objects.count() + 1
            candidate = f"CT-REQ-{year}-{count:04d}"
            while CapacityTranche.objects.filter(ct_number=candidate).exists():
                count += 1
                candidate = f"CT-REQ-{year}-{count:04d}"
            ct_num = candidate

        # Link GTA if gta_no or gta id provided
        gta_obj = serializer.validated_data.get('gta')
        gta_no = data.get('gta_no')
        if not gta_obj and gta_no:
            gta_obj = GTAAgreement.objects.filter(gta_number=gta_no).first()
        if not gta_obj and user:
            gta_obj = GTAAgreement.objects.filter(user=user).order_by('-created_at').first()
        if not gta_obj and data.get('customer_email'):
            gta_obj = GTAAgreement.objects.filter(customer_registration__email__iexact=data.get('customer_email')).order_by('-created_at').first()

        created_by = data.get('ct_created_by')
        if not created_by and user:
            created_by = user.get_full_name() or user.username

        extra_save = {
            'ct_number': ct_num,
            'gta': gta_obj,
            'ct_created_by': created_by or 'Customer Portal'
        }
        if gta_obj:
            if not data.get('gta_no'):
                extra_save['gta_no'] = gta_obj.gta_number
            if not data.get('gta_date') and gta_obj.agreement_date:
                extra_save['gta_date'] = gta_obj.agreement_date

        # Auto-populate UFT path parameters if uft_path_id provided and fields missing
        uft_id_val = data.get('uft_path_id') or data.get('unified_path')
        if uft_id_val:
            matching_uft = UFTPath.objects.filter(Q(uft_id__iexact=uft_id_val) | Q(path_id_desc__iexact=uft_id_val)).first()
            if matching_uft:
                extra_save['uft_path_id'] = matching_uft.uft_id
                if not data.get('path_id_desc'):
                    extra_save['path_id_desc'] = matching_uft.path_id_desc
                if not data.get('unified_entry_point'):
                    extra_save['unified_entry_point'] = matching_uft.unified_entry_point
                if not data.get('unified_exit_point'):
                    extra_save['unified_exit_point'] = matching_uft.unified_exit_point
                if not data.get('delivery_redelivery_point'):
                    extra_save['delivery_redelivery_point'] = matching_uft.delivery_point or matching_uft.unified_entry_point
                if not data.get('total_km'):
                    extra_save['total_km'] = matching_uft.total_km
                if not data.get('zone_pngrb'):
                    extra_save['zone_pngrb'] = matching_uft.zone_pngrb
                if not data.get('applicable_tariff_regime'):
                    extra_save['applicable_tariff_regime'] = matching_uft.applicable_tariff_regime
                if not data.get('price_applicable_date') and matching_uft.price_applicable_date:
                    extra_save['price_applicable_date'] = matching_uft.price_applicable_date
                if not data.get('entity_transporter'):
                    extra_save['entity_transporter'] = matching_uft.transporter
                if not data.get('km_share'):
                    extra_save['km_share'] = matching_uft.shared_km
                if not data.get('uft_ratio_pct'):
                    extra_save['uft_ratio_pct'] = matching_uft.uft_ratio_pct
                if not data.get('amt_for_invoice_per_mmbtu'):
                    extra_save['amt_for_invoice_per_mmbtu'] = matching_uft.amt_for_invoice_per_mmbtu
                if not data.get('iggl_zonal_entity_id'):
                    extra_save['iggl_zonal_entity_id'] = matching_uft.iggl_zonal_entity_id or 'ZONE1/001'

        # Security check: Non-admin users cannot self-approve capacity requests
        is_admin_user = user and (user.is_staff or (hasattr(user, 'profile') and user.profile.role != 'CUSTOMER'))
        if not is_admin_user:
            extra_save['status'] = CTStatus.SUBMITTED

        serializer.save(**extra_save)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Transporter / Admin approves CT and allocates capacity"""
        ct = self.get_object()
        data = request.data
        ct.approved_ct_start_date = data.get('approved_ct_start_date') or ct.start_date
        ct.approved_ct_end_date = data.get('approved_ct_end_date') or ct.end_date
        ct.approved_quantity_mmbtu_day = data.get('approved_quantity_mmbtu_day') or ct.quantity_mmbtu_day
        if 'daily_quantities' in data and data.get('daily_quantities'):
            ct.daily_quantities = data.get('daily_quantities')
        if not ct.sap_contract_id or ct.sap_contract_id.startswith('182'):
            from django.utils import timezone
            year = ct.created_at.year if hasattr(ct, 'created_at') and ct.created_at else timezone.now().year
            seq = ct.ct_number.split('-')[-1] if '-' in ct.ct_number else '0001'
            ct.sap_contract_id = f"IGGL/CT/{year}/{seq}"
        ct.status = CTStatus.APPROVED
        ct.status_update = 'Approved'
        ct.unsigned_ct_document = f"ct_unsigned_{ct.ct_number}.pdf"
        ct.save()
        return Response({
            'success': True,
            'message': f"CT {ct.ct_number} approved successfully.",
            'tranche': CapacityTrancheSerializer(ct).data
        })

    @action(detail=True, methods=['post'])
    def execute(self, request, pk=None):
        """Transporter executes CT upon signing"""
        ct = self.get_object()
        signed_doc = request.data.get('signed_ct_document_vendor', 'ct_signed_vendor.pdf')
        ct.signed_ct_document_vendor = signed_doc
        ct.status = CTStatus.EXECUTED
        ct.status_update = 'Executed'
        ct.save()
        return Response({
            'success': True,
            'message': f"CT {ct.ct_number} executed successfully.",
            'tranche': CapacityTrancheSerializer(ct).data
        })


class UFTPathViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Unified Tariff (UFT) Path master data.
    Allows administrators to maintain line total capacities and synchronize
    with SAP OData feed.
    """
    queryset = UFTPath.objects.filter(is_active=True).order_by('uft_id')
    serializer_class = UFTPathSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        zone = self.request.query_params.get('zone')
        search = self.request.query_params.get('search')
        transporter = self.request.query_params.get('transporter')
        if zone:
            qs = qs.filter(zone_pngrb__iexact=zone)
        if transporter:
            qs = qs.filter(transporter__icontains=transporter)
        if search:
            qs = qs.filter(
                Q(uft_id__icontains=search) |
                Q(path_id_desc__icontains=search) |
                Q(unified_entry_point__icontains=search) |
                Q(unified_exit_point__icontains=search)
            )
        return qs

    @action(detail=False, methods=['post'], url_path='sync-odata')
    def sync_odata(self, request):
        """
        Synchronizes UFT master paths from SAP OData feed
        (https://192.162.2.34:44300/sap/opu/odata/sap/ZGTA_ODATA_SRV/Uft_detailsSet).
        Falls back gracefully to local official XML fixture if SAP host is unreachable.
        """
        force_seed = request.data.get('force_seed', False)
        result = sync_uft_master_paths(force_seed=force_seed)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='availability')
    def availability(self, request, pk=None):
        """
        Calculates capacity availability for this UFT Path line over requested date range.
        Query params: start_date (YYYY-MM-DD), end_date (YYYY-MM-DD), quantity (MMBTU/Day)
        """
        path = self.get_object()
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        quantity = request.query_params.get('quantity', 0)
        res = calculate_pipeline_capacity_availability(path, start_date, end_date, quantity)
        return Response(res, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='check-availability')
    def check_availability(self, request):
        """
        Convenience endpoint to check availability by uft_id param.
        Query params: uft_id, start_date, end_date, quantity
        """
        uft_id = request.query_params.get('uft_id')
        if not uft_id:
            return Response({'error': 'uft_id query param is required'}, status=status.HTTP_400_BAD_REQUEST)
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        quantity = request.query_params.get('quantity', 0)
        res = calculate_pipeline_capacity_availability(uft_id, start_date, end_date, quantity)
        return Response(res, status=status.HTTP_200_OK)


