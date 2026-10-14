import re
import random
from rest_framework import serializers
from .models import CustomerRegistration, RegistrationStatus, RegistrationDocument, DocumentType

class CustomerSelfRegistrationSerializer(serializers.ModelSerializer):
    """
    Used exclusively by customers on the public registration portal.
    Only allows green fields from the specification sheet.
    """
    password = serializers.CharField(write_only=True, required=False, min_length=8, allow_blank=True)

    class Meta:
        model = CustomerRegistration
        fields = [
            'id',
            'registration_number',
            'name1',
            'name2',
            'city',
            'district',
            'postal_code',
            'street',
            'street_suppl1',
            'street_suppl2',
            'street_suppl3',
            'region',
            'country',
            'telephone',
            'tax_number',
            'pan_number',
            'email',
            'password',
            'status',
            'created_at',
        ]
        read_only_fields = ['id', 'registration_number', 'status', 'created_at']

    def validate_name1(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Name is required.")
        if len(value.strip()) > 40:
            raise serializers.ValidationError("Name cannot exceed 40 characters (SAP NAME1 limit).")
        return value.strip().upper()

    def validate_name2(self, value):
        if value and len(value.strip()) > 40:
            raise serializers.ValidationError("Name (continuation) cannot exceed 40 characters (SAP NAME2 limit).")
        return value.strip().upper() if value else ''

    def validate_city(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("City is required.")
        if len(value.strip()) > 40:
            raise serializers.ValidationError("City cannot exceed 40 characters (SAP ORT01 limit).")
        return value.strip()

    def validate_district(self, value):
        if value and len(value.strip()) > 40:
            raise serializers.ValidationError("District cannot exceed 40 characters (SAP ORT02 limit).")
        return value.strip() if value else ''

    def validate_street(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Address 1 is required.")
        if len(value.strip()) > 60:
            raise serializers.ValidationError("Address 1 cannot exceed 60 characters (SAP STRAS limit).")
        return value.strip()

    def validate_street_suppl1(self, value):
        if value and len(value.strip()) > 40:
            raise serializers.ValidationError("Address 2 cannot exceed 40 characters (SAP STR_SUPPL1 limit).")
        return value.strip() if value else ''

    def validate_street_suppl2(self, value):
        if value and len(value.strip()) > 40:
            raise serializers.ValidationError("Address 3 cannot exceed 40 characters (SAP STR_SUPPL2 limit).")
        return value.strip() if value else ''

    def validate_street_suppl3(self, value):
        if value and len(value.strip()) > 40:
            raise serializers.ValidationError("Address 4 cannot exceed 40 characters (SAP STR_SUPPL3 limit).")
        return value.strip() if value else ''

    def validate_region(self, value):
        if value and len(value.strip()) > 3:
            raise serializers.ValidationError("Region code cannot exceed 3 characters (e.g. 08, 18).")
        return value.strip().upper() if value else ''

    def validate_telephone(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Telephone/Mobile is required.")
        cleaned = re.sub(r'[^0-9+]', '', value)
        if len(cleaned) < 10 or len(cleaned) > 16:
            raise serializers.ValidationError("Telephone must be between 10 and 16 digits.")
        return cleaned

    def validate_pan_number(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Permanent Account Number (PAN) is required.")
        pan = value.strip().upper()
        if not re.match(r'^[A-Z]{5}[0-9]{4}[A-Z]{1}$', pan):
            raise serializers.ValidationError("Invalid PAN format. Must be 10 characters (e.g. AABCR7109G).")
        return pan

    def validate_tax_number(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Tax Number (GSTIN) is required.")
        gstin = value.strip().upper()
        if not re.match(r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{3}$', gstin):
            raise serializers.ValidationError("Invalid GSTIN format (15 characters, e.g. 08AABCR7106A1AQ).")
        return gstin

    def validate_email(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Email is required.")
        email = value.strip().lower()
        if CustomerRegistration.objects.filter(email__iexact=email, status__in=[RegistrationStatus.SUBMITTED, RegistrationStatus.UNDER_REVIEW, RegistrationStatus.APPROVED, RegistrationStatus.BP_CREATED]).exists():
            raise serializers.ValidationError("An active registration or account with this email already exists.")
        return email

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        seq = random.randint(10000, 99999)
        reg_no = f"IGGL-REG-2026-{seq}"
        while CustomerRegistration.objects.filter(registration_number=reg_no).exists():
            seq = random.randint(10000, 99999)
            reg_no = f"IGGL-REG-2026-{seq}"

        validated_data['registration_number'] = reg_no
        validated_data['status'] = RegistrationStatus.SUBMITTED
        registration = super().create(validated_data)

        # Provision customer user account (inactive until Admin approval & SAP BP creation)
        if password:
            from django.contrib.auth.models import User
            from portal_auth.models import UserProfile, UserRole

            user, _ = User.objects.get_or_create(
                username=registration.email.lower(),
                defaults={
                    'email': registration.email.lower(),
                    'first_name': registration.name1[:30],
                    'is_active': False
                }
            )
            user.set_password(password)
            user.email = registration.email.lower()
            user.is_active = False
            user.save()

            profile, _ = UserProfile.objects.get_or_create(user=user)
            profile.role = UserRole.CUSTOMER
            profile.phone = registration.telephone
            profile.company_name = registration.name1
            profile.save()

        return registration


class AdminEnrichmentSerializer(serializers.ModelSerializer):
    """
    Used by IGGL back-office administrators to enrich SAP-internal fields
    and trigger SAP Customer Master posting.
    """
    action = serializers.ChoiceField(
        choices=['APPROVE_AND_POST', 'SAVE_DRAFT', 'RETURN', 'REJECT'],
        write_only=True,
        required=False,
        default='SAVE_DRAFT'
    )

    class Meta:
        model = CustomerRegistration
        fields = [
            'id',
            'registration_number',
            'status',
            'name1',
            'name2',
            'city',
            'district',
            'postal_code',
            'street',
            'street_suppl1',
            'street_suppl2',
            'street_suppl3',
            'telephone',
            'tax_number',
            'pan_number',
            'email',
            'region',
            'account_group',
            'recon_account',
            'payment_terms',
            'sales_org',
            'company_code',
            'partner_category',
            'distribution_channel',
            'division',
            'pricing_procedure',
            'customer_price_group',
            'inco_term',
            'shipping_conditions',
            'currency',
            'order_probability',
            'account_assignment_group',
            'tax_type',
            'tax_classification',
            'tax_ad',
            'tax_details',
            'remarks',
            'country',
            'language_key',
            'customer_number',
            'address_number',
            'sap_status',
            'sap_posted_at',
            'action',
        ]
        read_only_fields = [
            'id',
            'registration_number',
            'name1',
            'name2',
            'city',
            'district',
            'postal_code',
            'street',
            'street_suppl1',
            'street_suppl2',
            'street_suppl3',
            'telephone',
            'tax_number',
            'pan_number',
            'email',
            'country',
            'language_key',
            'customer_number',
            'address_number',
            'sap_status',
            'sap_posted_at',
        ]

    tax_ad = serializers.CharField(write_only=True, required=False)

    def update(self, instance, validated_data):
        tax_ad = validated_data.pop('tax_ad', None)
        if tax_ad is not None:
            validated_data['tax_classification'] = tax_ad

        tax_details = validated_data.get('tax_details')
        if tax_details and isinstance(tax_details, list):
            types = [str(t.get('Tatyp', '')).strip() for t in tax_details if t.get('Tatyp')]
            classes = [str(t.get('Taxad', t.get('Takld', '0'))).strip() for t in tax_details if t.get('Tatyp')]
            if types:
                validated_data['tax_type'] = ",".join(types)
                validated_data['tax_classification'] = ",".join(classes)

        return super().update(instance, validated_data)


class RegistrationDocumentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    document_type_display = serializers.CharField(source='get_document_type_display', read_only=True)

    class Meta:
        model = RegistrationDocument
        fields = [
            'id',
            'document_type',
            'document_type_display',
            'file_name',
            'file_size',
            'content_type',
            'file_url',
            'uploaded_at',
        ]

    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None


class CustomerRegistrationDetailSerializer(serializers.ModelSerializer):
    """
    Comprehensive serializer for detailed view and tracking.
    """
    documents = RegistrationDocumentSerializer(many=True, read_only=True)

    class Meta:
        model = CustomerRegistration
        fields = '__all__'
