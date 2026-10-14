from django.db import models
from django.contrib.auth.models import User
from decimal import Decimal
import uuid

class GTAStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    SUBMITTED = 'SUBMITTED', 'Submitted'
    UNDER_REVIEW = 'UNDER_REVIEW', 'Under Review'
    ISSUED_FOR_SIGNATURE = 'ISSUED_FOR_SIGNATURE', 'Issued for Signature'
    READY_TO_SIGN = 'READY_TO_SIGN', 'Ready to Sign'
    EXECUTED = 'EXECUTED', 'Executed'
    IN_FORCE = 'IN_FORCE', 'In Force'
    REVERTED = 'REVERTED', 'Reverted'
    EXPIRED = 'EXPIRED', 'Expired'
    TERMINATED = 'TERMINATED', 'Terminated'


class TariffZone(models.TextChoices):
    ZONE_1 = 'ZONE_1', 'Zone 1 (≤ 300 km)'
    ZONE_2 = 'ZONE_2', 'Zone 2 (300 km - 1200 km)'
    ZONE_3 = 'ZONE_3', 'Zone 3 (> 1200 km)'


class CapacityType(models.TextChoices):
    FIRM = 'FIRM', 'Firm Capacity'
    INTERRUPTIBLE = 'INTERRUPTIBLE', 'Interruptible Capacity'
    COMBINED = 'COMBINED', 'Firm + Interruptible'


class CTStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    SUBMITTED = 'SUBMITTED', 'Submitted'
    UNDER_REVIEW = 'UNDER_REVIEW', 'Under Review'
    UNDER_PROCESS = 'UNDER_PROCESS', 'Underprocess'
    RETURNED = 'RETURNED', 'Returned for Correction'
    APPROVED = 'APPROVED', 'Approved'
    DOCUMENT_ISSUED = 'DOCUMENT_ISSUED', 'Document Issued'
    EXECUTED = 'EXECUTED', 'Executed'
    REJECTED = 'REJECTED', 'Rejected'


class GTAAgreement(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    gta_number = models.CharField(max_length=50, unique=True, db_index=True, blank=True)
    agreement_date = models.DateField(null=True, blank=True, help_text="Date of Agreement Execution / Issuance")
    sap_contract_number = models.CharField(max_length=50, blank=True, default='', help_text="SAP SD Transmission Contract Reference")
    version = models.CharField(max_length=10, default='1.0', help_text="Agreement Version (e.g. 1.0, 1.1)")
    
    # Shipper / Customer details (Approved Customer Lookup)
    customer_registration = models.ForeignKey(
        'registrations.CustomerRegistration',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='gtas'
    )
    shipper_name = models.CharField(max_length=150)
    customer_code = models.CharField(max_length=50, blank=True, default='')  # SAP KUNNR
    gstin = models.CharField(max_length=20, blank=True, default='')
    pan = models.CharField(max_length=20, blank=True, default='')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='gtas')
    
    # Transportation Route & UFT Path (Unified Tariff auto-derived)
    uft_path = models.CharField(max_length=150, blank=True, default='', help_text="PNGRB Unified Tariff Path")
    entry_point = models.CharField(max_length=100, blank=True, default='IGGL Grid Injection Point', help_text="Gas Injection Point, e.g. Duliajan, Vijaipur, Dahej")
    exit_point = models.CharField(max_length=100, blank=True, default='Shipper Delivery Point', help_text="Gas Offtake Point, e.g. Numaligarh, Guwahati, Dimapur")
    distance_km = models.DecimalField(max_digits=8, decimal_places=2, default=0.00, help_text="Pipeline route distance in km")
    
    # Capacity Terms
    contracted_capacity_scmd = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, help_text="Standard Cubic Meters / Day")
    contracted_capacity_mmscmd = models.DecimalField(max_digits=8, decimal_places=4, default=0.0000, help_text="Million Standard Cubic Meters / Day")
    capacity_type = models.CharField(max_length=30, choices=CapacityType.choices, default=CapacityType.FIRM)
    
    # Commercial Terms (Mandatory per §5.6 C4)
    tolerance_pct = models.DecimalField(max_digits=5, decimal_places=2, default=5.00, help_text="Mandatory ± Operational Tolerance % per §5.6")
    ship_or_pay_pct = models.DecimalField(max_digits=5, decimal_places=2, default=80.00, help_text="Mandatory Ship-or-Pay % commitment per §5.6")
    
    # Validity
    valid_from = models.DateField(null=True, blank=True)
    valid_to = models.DateField(null=True, blank=True)
    
    # Tariff & Commercials
    tariff_zone = models.CharField(max_length=30, choices=TariffZone.choices, default=TariffZone.ZONE_1)
    unified_tariff_rate = models.DecimalField(max_digits=8, decimal_places=2, default=34.00, help_text="PNGRB Unified Tariff rate in Rs/MMBTU")
    iggl_share_pct = models.DecimalField(max_digits=5, decimal_places=2, default=100.00, help_text="IGGL network revenue entitlement share %")
    entitlement_rate = models.DecimalField(max_digits=8, decimal_places=2, default=34.00, help_text="Net tariff rate attributable to IGGL (Rs/MMBTU)")
    
    # SAP SD Contract Master Fields (Consultant Specification)
    shipper_entity_type = models.CharField(max_length=100, blank=True, default='', help_text="Shipper Entity Type (e.g. Private Limited, Public Limited, PSU)")
    governing_statute_and_year = models.CharField(max_length=150, blank=True, default='', help_text="Governing Statute and Year (e.g. Companies Act 2013)")
    shipper_registered_office_address = models.TextField(blank=True, default='', help_text="Shipper Registered Office Address")
    
    # Financial Securities (Figures and Words)
    security_deposit_amount_figures = models.DecimalField(max_digits=14, decimal_places=2, default=0.00, help_text="Security Deposit Amount in Figures (INR)")
    security_deposit_amount_words = models.CharField(max_length=255, blank=True, default='', help_text="Security Deposit Amount in Words")
    bank_guarantee_amount_figures = models.DecimalField(max_digits=14, decimal_places=2, default=0.00, help_text="Bank Guarantee Amount in Figures (INR)")
    bank_guarantee_amount_words = models.CharField(max_length=255, blank=True, default='', help_text="Bank Guarantee Amount in Words")
    
    # Termination Date
    termination_date = models.DateField(null=True, blank=True, help_text="Contract Termination Date")
    
    # Shipper Notice Communication Details
    shipper_notice_contact_person = models.CharField(max_length=150, blank=True, default='', help_text="Shipper Notice Contact Person")
    shipper_notice_address = models.TextField(blank=True, default='', help_text="Shipper Notice Address")
    shipper_notice_email = models.CharField(max_length=150, blank=True, default='', help_text="Shipper Notice Email")
    shipper_notice_fax = models.CharField(max_length=50, blank=True, default='', help_text="Shipper Notice Fax")
    
    # Tariff Structure Breakdown (SAP Pricing Conditions)
    trunk_line_rate_1 = models.DecimalField(max_digits=8, decimal_places=2, default=0.00, help_text="Trunk Line Rate 1 (INR/MMBTU)")
    spur_line_rate = models.DecimalField(max_digits=8, decimal_places=2, default=0.00, help_text="Spur Line Rate (INR/MMBTU)")
    connectivity_rate = models.DecimalField(max_digits=8, decimal_places=2, default=0.00, help_text="Connectivity Rate (INR/MMBTU)")
    transmission_rate = models.DecimalField(max_digits=8, decimal_places=2, default=0.00, help_text="Transmission Rate (auto-sum: Trunk 1 + Spur + Connectivity)")
    fixed_monthly_spur_line_charges = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, help_text="Fixed Monthly Spur Line Charges (INR)")

    # Security Deposit & Bank Guarantee
    security_deposit_lakhs = models.DecimalField(max_digits=10, decimal_places=2, default=25.00, help_text="Security Deposit / BG in Lakhs (INR)")
    security_deposit_status = models.CharField(max_length=30, default='VERIFIED')  # VERIFIED, PENDING, EXEMPT
    bank_guarantee_ref = models.CharField(max_length=50, blank=True, default='')
    bg_bank_name = models.CharField(max_length=100, blank=True, default='', help_text="Issuing Bank Name for BG")
    bg_expiry_date = models.DateField(null=True, blank=True, help_text="Validity date of Bank Guarantee")
    
    # Special Terms & Document
    conditions_precedent = models.TextField(blank=True, default='', help_text="Conditions Precedent / Special Covenants")
    reference_number = models.CharField(max_length=100, blank=True, default='', help_text="Customer / Agreement Reference Number")
    gta_document = models.FileField(upload_to='gta_documents/%Y/%m/', null=True, blank=True, help_text="Uploaded GTA Document")
    document_url = models.CharField(max_length=255, blank=True, default='', help_text="Executed GTA Document PDF URL / path")
    remarks = models.TextField(blank=True, default='')
    admin_remark = models.TextField(blank=True, default='', help_text="Admin remark shown to customer on revert")
    
    # Agreement Status & Execution
    status = models.CharField(max_length=30, choices=GTAStatus.choices, default=GTAStatus.DRAFT, db_index=True)
    
    # Signatures (kept for record; no e-signature flow required — uploaded document is the signed GTA)
    signed_by_shipper = models.CharField(max_length=100, blank=True, default='')
    signed_by_shipper_at = models.DateTimeField(null=True, blank=True)
    signed_by_iggl = models.CharField(max_length=100, blank=True, default='')
    signed_by_iggl_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'GTA Agreement'
        verbose_name_plural = 'GTA Agreements'

    def save(self, *args, **kwargs):
        from django.utils import timezone
        today = timezone.now().date()
        
        # Auto-generate gta_number if empty
        if not self.gta_number:
            if self.reference_number and not GTAAgreement.objects.filter(gta_number=self.reference_number).exists():
                self.gta_number = self.reference_number
            else:
                year = today.year
                count = GTAAgreement.objects.count() + 1
                candidate = f"IGGL/GTA/{year}/{count:03d}"
                while GTAAgreement.objects.filter(gta_number=candidate).exists():
                    count += 1
                    candidate = f"IGGL/GTA/{year}/{count:03d}"
                self.gta_number = candidate

        # Sync document_url from gta_document if set
        if self.gta_document and not self.document_url:
            try:
                self.document_url = self.gta_document.url
            except Exception:
                pass

        # Default route points if blank
        if not self.entry_point:
            self.entry_point = 'IGGL Grid Injection Point'
        if not self.exit_point:
            self.exit_point = 'Shipper Delivery Point'

        # Default agreement date and validities
        if not self.agreement_date:
            self.agreement_date = today
        if not self.valid_from:
            self.valid_from = self.agreement_date or today

        # Sync termination_date and valid_to
        if self.termination_date and not self.valid_to:
            self.valid_to = self.termination_date
        elif self.valid_to and not self.termination_date:
            self.termination_date = self.valid_to
        elif not self.valid_to and not self.termination_date:
            self.valid_to = self.valid_from + timezone.timedelta(days=1095)
            self.termination_date = self.valid_to
        
        # Default null numerical fields to avoid database NOT NULL integrity errors
        if self.trunk_line_rate_1 is None:
            self.trunk_line_rate_1 = Decimal('0.00')
        if self.spur_line_rate is None:
            self.spur_line_rate = Decimal('0.00')
        if self.connectivity_rate is None:
            self.connectivity_rate = Decimal('0.00')
        if self.contracted_capacity_scmd is None:
            self.contracted_capacity_scmd = Decimal('0.00')
        if self.contracted_capacity_mmscmd is None:
            self.contracted_capacity_mmscmd = Decimal('0.0000')

        # Auto-sum transmission rate
        trunk = self.trunk_line_rate_1 or Decimal('0.00')
        spur = self.spur_line_rate or Decimal('0.00')
        conn = self.connectivity_rate or Decimal('0.00')
        self.transmission_rate = trunk + spur + conn

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.gta_number} - {self.shipper_name} ({self.get_status_display()})"

    @property
    def is_in_force(self):
        return self.status == GTAStatus.IN_FORCE

    @property
    def active_cts_count(self):
        return self.capacity_tranches.filter(status__in=[CTStatus.APPROVED, CTStatus.DOCUMENT_ISSUED, CTStatus.EXECUTED]).count()


class CapacityTranche(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ct_number = models.CharField(max_length=50, unique=True, db_index=True, blank=True)
    gta = models.ForeignKey(GTAAgreement, on_delete=models.SET_NULL, null=True, blank=True, related_name='capacity_tranches')

    # 1. Customer Fields
    request_category = models.CharField(
        max_length=50,
        default='OTHER',
        help_text="Radio: CGD_CNG(T)/PNG(D) or OTHER"
    )
    unified_path = models.CharField(max_length=150, blank=True, default='', help_text="Unified Path Dropdown, e.g. GAIL")
    sold_to_party = models.CharField(max_length=200, blank=True, default='', help_text="Sold To Party Dropdown, e.g. INDIAN OIL CORPORATION LTD [0000051300]")
    delivery_entry_point = models.CharField(max_length=150, blank=True, default='', help_text="Delivery / Entry Point Dropdown, e.g. ONGC - ODALREVU")
    new_exit_point = models.CharField(max_length=150, blank=True, default='', help_text="Add New Exit Point (Link / text optional), e.g. Oduru")
    start_date = models.DateField(null=True, blank=True, help_text="CT Start Date")
    end_date = models.DateField(null=True, blank=True, help_text="CT End Date")
    quantity_mmbtu_day = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, help_text="Quantity (MMBTU/Day)")

    # 2. Transporter Fields (Admin / Zonal Officer)
    gta_no = models.CharField(max_length=50, blank=True, default='', help_text="GTA No Dropdown")
    gta_date = models.DateField(null=True, blank=True, help_text="GTA Date")
    approved_ct_start_date = models.DateField(null=True, blank=True, help_text="Approved CT Start Date")
    approved_ct_end_date = models.DateField(null=True, blank=True, help_text="Approved CT End Date")
    approved_quantity_mmbtu_day = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, help_text="Approved Quantity (MMBTU/Day)")
    ct_created_by = models.CharField(max_length=100, blank=True, default='', help_text="CT Created by (e.g. ANKITA DEY)")
    ct_date = models.DateField(null=True, blank=True, help_text="CT Date")
    unsigned_ct_document = models.CharField(max_length=255, blank=True, default='', help_text="Unsigned CT Document generated for download")
    signed_ct_document_vendor = models.CharField(max_length=255, blank=True, default='', help_text="Signed CT Document (Vendor)")
    status_update = models.CharField(max_length=50, blank=True, default='Underprocess', help_text="Status Update: Underprocess, then Executed")
    sap_contract_id = models.CharField(max_length=50, blank=True, default='', help_text="SAP Contract ID generated after SAP integration")
    overdelivery_tolerance = models.DecimalField(max_digits=6, decimal_places=2, default=2.00, help_text="Overdelivery tolerance")
    underdelivery_tolerance = models.DecimalField(max_digits=6, decimal_places=2, default=5.00, help_text="Underdelivery tolerance")

    # 3. UFT Path Tariff Parameters (SAP Drop Down & Auto Populate)
    uft_path_id = models.CharField(max_length=50, blank=True, default='', help_text="UFT Path Id SAP Dropdown")
    path_id_desc = models.CharField(max_length=200, blank=True, default='', help_text="Path ID Description")
    unified_entry_point = models.CharField(max_length=150, blank=True, default='', help_text="Unified Entry Point")
    unified_exit_point = models.CharField(max_length=150, blank=True, default='', help_text="Unified Exit Point")
    delivery_redelivery_point = models.CharField(max_length=150, blank=True, default='', help_text="Delivery / Redelivery Point")
    total_km = models.DecimalField(max_digits=8, decimal_places=2, default=0.00, help_text="Total KM")
    zone_pngrb = models.CharField(max_length=50, blank=True, default='Zone 1', help_text="Zone as per PNGRB")
    applicable_tariff_regime = models.DecimalField(max_digits=8, decimal_places=2, default=34.00, help_text="Applicable Tariff under Unified Tariff Regime (In Rs./MMBtu)")
    price_applicable_date = models.DateField(null=True, blank=True, help_text="Price Applicable Date")
    entity_transporter = models.CharField(max_length=100, blank=True, default='IGGL', help_text="Entity / Transporter")
    km_share = models.DecimalField(max_digits=8, decimal_places=2, default=100.00, help_text="KM Share")
    uft_ratio_pct = models.DecimalField(max_digits=6, decimal_places=2, default=100.00, help_text="UFT Ratio (%)")
    amt_for_invoice_per_mmbtu = models.DecimalField(max_digits=8, decimal_places=2, default=34.00, help_text="Amt for Invoice/MMBtu (Applicable Tariff Rate * UFT Ratio)")
    iggl_zonal_entity_id = models.CharField(max_length=50, blank=True, default='IGGL-ZONE-NE1', help_text="IGGL Zonal Entity ID")
    revenue_entitlement = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, help_text="Revenue Entitlement")

    # Legacy / Bridge Fields
    tranche_type = models.CharField(max_length=30, choices=CapacityType.choices, default=CapacityType.FIRM)
    requested_capacity_scmd = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    allocated_capacity_scmd = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    status = models.CharField(max_length=30, choices=CTStatus.choices, default=CTStatus.SUBMITTED, db_index=True)
    action_required_note = models.CharField(max_length=255, blank=True, default='')
    signed_document_url = models.CharField(max_length=255, blank=True, default='')
    daily_quantities = models.JSONField(blank=True, default=list, help_text="Daily line-item capacity schedule: [{'date': 'YYYY-MM-DD', 'quantity_mmbtu': 10000}]")
    remarks = models.TextField(blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Capacity Tranche (CT)'
        verbose_name_plural = 'Capacity Tranches (CTs)'

    def save(self, *args, **kwargs):
        from django.utils import timezone
        today = timezone.now().date()

        # Auto-generate CT number if missing: CT-REQ-YYYY-####
        if not self.ct_number:
            year = today.year
            count = CapacityTranche.objects.count() + 1
            candidate = f"CT-REQ-{year}-{count:04d}"
            while CapacityTranche.objects.filter(ct_number=candidate).exists():
                count += 1
                candidate = f"CT-REQ-{year}-{count:04d}"
            self.ct_number = candidate

        # Sync dates
        if not self.ct_date:
            self.ct_date = today
        if self.start_date and not self.approved_ct_start_date:
            self.approved_ct_start_date = self.start_date
        elif self.approved_ct_start_date and not self.start_date:
            self.start_date = self.approved_ct_start_date

        if self.end_date and not self.approved_ct_end_date:
            self.approved_ct_end_date = self.end_date
        elif self.approved_ct_end_date and not self.end_date:
            self.end_date = self.approved_ct_end_date

        # Sync quantities
        if self.quantity_mmbtu_day and not self.approved_quantity_mmbtu_day:
            self.approved_quantity_mmbtu_day = self.quantity_mmbtu_day
        elif self.approved_quantity_mmbtu_day and not self.quantity_mmbtu_day:
            self.quantity_mmbtu_day = self.approved_quantity_mmbtu_day

        from decimal import Decimal

        # Sync legacy SCMD equivalents for compatibility (1 MMBTU approx 28 SCMD)
        if not self.requested_capacity_scmd and self.quantity_mmbtu_day:
            self.requested_capacity_scmd = (Decimal(str(self.quantity_mmbtu_day)) * Decimal('28.00')).quantize(Decimal('0.01'))
        if not self.allocated_capacity_scmd and self.approved_quantity_mmbtu_day:
            self.allocated_capacity_scmd = (Decimal(str(self.approved_quantity_mmbtu_day)) * Decimal('28.00')).quantize(Decimal('0.01'))

        # Calculate Amt for Invoice/MMBtu = Applicable Tariff * (UFT Ratio / 100)
        try:
            tariff = Decimal(str(self.applicable_tariff_regime or 34.00))
            ratio = Decimal(str(self.uft_ratio_pct or 100.00)) / Decimal('100.00')
            self.amt_for_invoice_per_mmbtu = (tariff * ratio).quantize(Decimal('0.01'))
        except Exception:
            self.amt_for_invoice_per_mmbtu = Decimal('34.00')

        # Revenue Entitlement = Amt for Invoice * Approved Quantity
        try:
            qty = Decimal(str(self.approved_quantity_mmbtu_day or self.quantity_mmbtu_day or 0))
            self.revenue_entitlement = (self.amt_for_invoice_per_mmbtu * qty).quantize(Decimal('0.01'))
        except Exception:
            self.revenue_entitlement = Decimal('0.00')

        # Sync status_update
        if self.status == CTStatus.EXECUTED:
            self.status_update = 'Executed'
        elif not self.status_update:
            self.status_update = 'Underprocess'

        # Sync daily_quantities with average daily rates if daily schedule is provided
        if self.daily_quantities and isinstance(self.daily_quantities, list) and len(self.daily_quantities) > 0:
            try:
                tot = sum(float(d.get('quantity_mmbtu', 0) or 0) for d in self.daily_quantities if isinstance(d, dict))
                n_days = len(self.daily_quantities)
                if n_days > 0 and tot > 0:
                    avg_qty = Decimal(str(round(tot / n_days, 2)))
                    if not self.quantity_mmbtu_day or self.quantity_mmbtu_day == Decimal('0.00'):
                        self.quantity_mmbtu_day = avg_qty
                    if not self.approved_quantity_mmbtu_day or self.approved_quantity_mmbtu_day == Decimal('0.00'):
                        self.approved_quantity_mmbtu_day = avg_qty
            except Exception:
                pass

        super().save(*args, **kwargs)

    @property
    def total_volume_mmbtu(self):
        """Calculates cumulative total MMBTU for the entire duration of the CT tranche."""
        if self.daily_quantities and isinstance(self.daily_quantities, list) and len(self.daily_quantities) > 0:
            try:
                tot = sum(float(d.get('quantity_mmbtu', 0) or 0) for d in self.daily_quantities if isinstance(d, dict))
                return round(tot, 2)
            except Exception:
                pass
        qty = float(self.approved_quantity_mmbtu_day or self.quantity_mmbtu_day or 0)
        start = self.approved_ct_start_date or self.start_date
        end = self.approved_ct_end_date or self.end_date
        if start and end and end >= start:
            days = (end - start).days + 1
            return round(days * qty, 2)
        return round(qty, 2)

    def __str__(self):
        gta_ref = self.gta_no or (self.gta.gta_number if self.gta else 'Unassigned')
        return f"{self.ct_number} under GTA {gta_ref} ({self.get_status_display()})"


class UFTPath(models.Model):
    """
    Unified Tariff (UFT) Path Master synchronized from SAP OData feed
    (https://192.162.2.34:44300/sap/opu/odata/sap/ZGTA_ODATA_SRV/Uft_detailsSet).
    Contains transportation tariffs, route entry/exit points, PNGRB zones,
    and administrator-maintained pipeline capacity.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    uft_id = models.CharField(max_length=50, unique=True, db_index=True, help_text="UFT Identifier from SAP (e.g. UFT01, UFT04)")
    path_id_desc = models.CharField(max_length=200, blank=True, default='', help_text="Description of Path ID")
    unified_entry_point = models.CharField(max_length=150, blank=True, default='', help_text="Unified Entry Point")
    unified_exit_point = models.CharField(max_length=150, blank=True, default='', help_text="Unified Exit Point")
    delivery_point = models.CharField(max_length=150, blank=True, default='', help_text="Delivery / Redelivery Point")
    total_km = models.DecimalField(max_digits=10, decimal_places=3, default=Decimal('0.000'), help_text="Total Route Distance in KM")
    zone_pngrb = models.CharField(max_length=50, blank=True, default='ZONE1', help_text="Zone as defined by PNGRB")
    applicable_tariff_regime = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'), help_text="Applicable Tariff under Unified Tariff Regime (Rs./MMBtu)")
    price_applicable_date = models.DateField(null=True, blank=True, help_text="Price Applicable Date")
    valid_from = models.DateField(null=True, blank=True, help_text="Validity Start Date")
    valid_to = models.DateField(null=True, blank=True, help_text="Validity End Date")
    transporter = models.CharField(max_length=100, blank=True, default='IGGL', help_text="Entity / Transporter")
    shared_km = models.DecimalField(max_digits=10, decimal_places=3, default=Decimal('0.000'), help_text="Shared Route KM")
    uft_ratio_pct = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal('100.00'), help_text="UFT Ratio (%)")
    amt_for_invoice_per_mmbtu = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'), help_text="Invoice Amount per MMBtu")
    iggl_zonal_entity_id = models.CharField(max_length=50, blank=True, default='', help_text="IGGL Zonal Entity ID")
    revenue_entitlement = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('100.00'), help_text="Revenue Entitlement %")
    applicable_date = models.DateField(null=True, blank=True, help_text="Applicable Date")

    # Web-maintained pipeline capacity
    total_capacity_mmbtu_day = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal('164685.28'),
        help_text="Total pipeline capacity of this line in MMBTU/Day maintained from Web"
    )
    is_active = models.BooleanField(default=True, help_text="Path is active for capacity booking")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['uft_id']
        verbose_name = 'UFT Path'
        verbose_name_plural = 'UFT Paths'

    def __str__(self):
        return f"{self.uft_id} - {self.path_id_desc} ({self.unified_entry_point} -> {self.unified_exit_point})"

