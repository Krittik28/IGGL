from django.db import models
import uuid

class RegistrationStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    SUBMITTED = 'SUBMITTED', 'Submitted'
    UNDER_REVIEW = 'UNDER_REVIEW', 'Under Review'
    APPROVED = 'APPROVED', 'Approved'
    BP_CREATED = 'BP_CREATED', 'BP Created in SAP'
    RETURNED = 'RETURNED', 'Returned for Correction'
    REJECTED = 'REJECTED', 'Rejected'


class DocumentType(models.TextChoices):
    GST_CERTIFICATE = 'GST_CERTIFICATE', 'GSTIN Certificate (REG-06)'
    PAN_CARD = 'PAN_CARD', 'Permanent Account Number (PAN) Card'
    INCORPORATION_CERT = 'INCORPORATION_CERT', 'Certificate of Incorporation / Registration'
    BOARD_RESOLUTION = 'BOARD_RESOLUTION', 'Board Resolution / Power of Attorney'
    OTHER = 'OTHER', 'Other Supporting Document'


class CustomerRegistration(models.Model):
    # Tracking
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    registration_number = models.CharField(max_length=32, unique=True, db_index=True)
    status = models.CharField(
        max_length=30,
        choices=RegistrationStatus.choices,
        default=RegistrationStatus.SUBMITTED,
        db_index=True
    )
    remarks = models.TextField(blank=True, null=True, help_text="Remarks by IGGL Admin")

    # 🟢 Customer Entered Fields (from Excel sheet & SAP Address)
    name1 = models.CharField(max_length=40, help_text="Name (SAP: NAME1, max 40 chars)")
    name2 = models.CharField(max_length=40, blank=True, default='', help_text="Name (continuation) (SAP: NAME2, max 40 chars)")
    city = models.CharField(max_length=40, help_text="City (SAP: ORT01)")
    district = models.CharField(max_length=40, blank=True, default='', help_text="District (SAP: ORT02)")
    postal_code = models.CharField(max_length=10, help_text="SAP: PSTLZ (Postal Code)")
    street = models.CharField(max_length=60, help_text="Address 1 (SAP: STRAS)")
    street_suppl1 = models.CharField(max_length=40, blank=True, default='', help_text="Address 2 (SAP: Str_Suppl1)")
    street_suppl2 = models.CharField(max_length=40, blank=True, default='', help_text="Address 3 (SAP: Str_Suppl2)")
    street_suppl3 = models.CharField(max_length=40, blank=True, default='', help_text="Address 4 (SAP: Str_Suppl3)")
    region = models.CharField(max_length=3, blank=True, default='', help_text="SAP: Regio (Region/State Code e.g. 08, 18)")
    telephone = models.CharField(max_length=16, help_text="SAP: TELF1 (Telephone / Mobile)")
    tax_number = models.CharField(max_length=18, help_text="SAP: STCD3 (GSTIN)")
    pan_number = models.CharField(max_length=40, help_text="SAP: J_1IPANNO (Permanent Account Number)")
    email = models.EmailField(max_length=100, help_text="Primary Contact / Portal User Email")

    # 🟠 Admin Enriched Fields (from Excel sheet & ZGTA_ODATA_SRV spec)
    company_code = models.CharField(max_length=4, blank=True, default='', help_text="SAP: Bukrs (Company Code e.g. 2000)")
    partner_category = models.CharField(max_length=4, blank=True, default='', help_text="SAP: Title (Partner Category e.g. 0003)")
    account_group = models.CharField(max_length=4, blank=True, default='', help_text="SAP: Ktokd (Account Group e.g. ZDOM/ZD01)")
    recon_account = models.CharField(max_length=10, blank=True, default='', help_text="SAP: Akont (Reconciliation Account)")
    payment_terms = models.CharField(max_length=4, blank=True, default='', help_text="SAP: Zterm (Terms of Payment e.g. NT30/0001)")
    sales_org = models.CharField(max_length=4, blank=True, default='', help_text="SAP: Vkorg (Sales Organization e.g. 2000)")
    distribution_channel = models.CharField(max_length=2, blank=True, default='', help_text="SAP: Vtweg (Distribution Channel)")
    division = models.CharField(max_length=2, blank=True, default='', help_text="SAP: Spart (Division)")
    pricing_procedure = models.CharField(max_length=2, blank=True, default='', help_text="SAP: Kalks (Pricing Procedure)")
    customer_price_group = models.CharField(max_length=2, blank=True, default='', help_text="SAP: Konda (Customer Price Group)")
    inco_term = models.CharField(max_length=3, blank=True, default='', help_text="SAP: Inco1 (Inco Term)")
    shipping_conditions = models.CharField(max_length=2, blank=True, default='', help_text="SAP: Vsbed (Shipping Conditions)")
    currency = models.CharField(max_length=3, blank=True, default='INR', help_text="SAP: Waers (Currency)")
    order_probability = models.CharField(max_length=3, blank=True, default='', help_text="SAP: Awahr (Order Probability)")
    account_assignment_group = models.CharField(max_length=2, blank=True, default='', help_text="SAP: Ktgrd (Account Assignment Group)")
    tax_type = models.CharField(max_length=100, blank=True, default='', help_text="SAP: Tatyp (Tax Types comma separated)")
    tax_classification = models.CharField(max_length=50, blank=True, default='', help_text="SAP: Taxad / Takld (Tax Classifications comma separated)")
    tax_details = models.JSONField(blank=True, default=list, help_text="Repeatable Tax Pairs [{'Tatyp': '01', 'Taxad': '0'}]")

    # ⚪ System / Fixed / Auto Fields
    country = models.CharField(max_length=3, default='IN', help_text="SAP: LAND1 (Country code)")
    language_key = models.CharField(max_length=3, default='EN', help_text="SAP: SPRAS (Language Key)")
    customer_number = models.CharField(max_length=10, blank=True, default='', help_text="SAP: KUNNR (Customer Number generated by SAP)")
    address_number = models.CharField(max_length=10, blank=True, default='', help_text="SAP: ADRNR (Address Number generated by SAP)")

    # SAP Integration logs & outbox metadata
    sap_posted_at = models.DateTimeField(blank=True, null=True)
    sap_status = models.CharField(max_length=20, default='PENDING')  # PENDING, SUCCESS, FAILED
    sap_payload = models.JSONField(blank=True, null=True)
    sap_response = models.JSONField(blank=True, null=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Customer Registration'
        verbose_name_plural = 'Customer Registrations'

    def __str__(self):
        return f"{self.registration_number} - {self.name1} ({self.get_status_display()})"


class RegistrationDocument(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    registration = models.ForeignKey(
        CustomerRegistration,
        on_delete=models.CASCADE,
        related_name='documents'
    )
    document_type = models.CharField(
        max_length=40,
        choices=DocumentType.choices,
        default=DocumentType.OTHER
    )
    file = models.FileField(upload_to='customer_documents/%Y/%m/')
    file_name = models.CharField(max_length=255)
    file_size = models.PositiveIntegerField(help_text="File size in bytes", default=0)
    content_type = models.CharField(max_length=100, blank=True, default='')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['uploaded_at']
        verbose_name = 'Registration Document'
        verbose_name_plural = 'Registration Documents'

    def __str__(self):
        return f"{self.registration.registration_number} - {self.get_document_type_display()} ({self.file_name})"
