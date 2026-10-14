from rest_framework import serializers
from .models import GTAAgreement, CapacityTranche, UFTPath, GTAStatus, CTStatus, TariffZone, CapacityType
from registrations.models import CustomerRegistration

class OptionalPrimaryKeyRelatedField(serializers.PrimaryKeyRelatedField):
    def to_internal_value(self, data):
        if data == '' or data is None:
            return None
        return super().to_internal_value(data)


class CapacityTrancheSerializer(serializers.ModelSerializer):
    gta_number = serializers.CharField(source='gta.gta_number', read_only=True)
    shipper_name = serializers.CharField(source='gta.shipper_name', read_only=True)
    gta = OptionalPrimaryKeyRelatedField(queryset=GTAAgreement.objects.all(), required=False, allow_null=True)
    ct_number = serializers.CharField(required=False, allow_blank=True, default='')
    total_volume_mmbtu = serializers.FloatField(read_only=True)

    class Meta:
        model = CapacityTranche
        fields = [
            'id', 'ct_number', 'gta', 'gta_number', 'shipper_name',
            # 1. Customer Fields
            'request_category', 'unified_path', 'sold_to_party', 'delivery_entry_point',
            'new_exit_point', 'start_date', 'end_date', 'quantity_mmbtu_day',
            # 2. Transporter Fields
            'gta_no', 'gta_date', 'approved_ct_start_date', 'approved_ct_end_date',
            'approved_quantity_mmbtu_day', 'ct_created_by', 'ct_date',
            'unsigned_ct_document', 'signed_ct_document_vendor', 'status_update',
            'sap_contract_id', 'overdelivery_tolerance', 'underdelivery_tolerance',
            # 3. UFT Path Tariff Parameters
            'uft_path_id', 'path_id_desc', 'unified_entry_point', 'unified_exit_point',
            'delivery_redelivery_point', 'total_km', 'zone_pngrb', 'applicable_tariff_regime',
            'price_applicable_date', 'entity_transporter', 'km_share', 'uft_ratio_pct',
            'amt_for_invoice_per_mmbtu', 'iggl_zonal_entity_id', 'revenue_entitlement',
            # Legacy / System
            'tranche_type', 'requested_capacity_scmd', 'allocated_capacity_scmd',
            'status', 'action_required_note', 'signed_document_url', 'daily_quantities',
            'total_volume_mmbtu', 'remarks',
            'created_at', 'updated_at'
        ]


class GTAAgreementSerializer(serializers.ModelSerializer):
    capacity_tranches = CapacityTrancheSerializer(many=True, read_only=True)
    active_cts_count = serializers.IntegerField(read_only=True)
    is_in_force = serializers.BooleanField(read_only=True)

    gta_number = serializers.CharField(required=False, allow_blank=True, default='')
    sap_contract_number = serializers.CharField(required=False, allow_blank=True, default='')
    entry_point = serializers.CharField(required=False, allow_blank=True, default='IGGL Grid Injection Point')
    exit_point = serializers.CharField(required=False, allow_blank=True, default='Shipper Delivery Point')
    valid_from = serializers.DateField(required=False, allow_null=True)
    valid_to = serializers.DateField(required=False, allow_null=True)
    trunk_line_rate_1 = serializers.DecimalField(max_digits=8, decimal_places=2, required=False, allow_null=True)
    spur_line_rate = serializers.DecimalField(max_digits=8, decimal_places=2, required=False, allow_null=True)
    connectivity_rate = serializers.DecimalField(max_digits=8, decimal_places=2, required=False, allow_null=True)
    contracted_capacity_scmd = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    contracted_capacity_mmscmd = serializers.DecimalField(max_digits=8, decimal_places=4, required=False, allow_null=True)
    reference_number = serializers.CharField(required=False, allow_blank=True, default='')
    gta_document = serializers.FileField(required=False, allow_null=True)
    gta_document_url = serializers.SerializerMethodField()
    gta_document_name = serializers.SerializerMethodField()
    customer_registration = OptionalPrimaryKeyRelatedField(
        queryset=CustomerRegistration.objects.all(),
        required=False,
        allow_null=True
    )

    def get_gta_document_url(self, obj):
        if obj.gta_document:
            return obj.gta_document.url
        return obj.document_url or ''

    def get_gta_document_name(self, obj):
        if obj.gta_document:
            import os
            return os.path.basename(obj.gta_document.name)
        return ''

    class Meta:
        model = GTAAgreement
        fields = [
            'id', 'gta_number', 'reference_number', 'gta_document', 'gta_document_url', 'gta_document_name', 'agreement_date', 'sap_contract_number', 'version',
            'customer_registration', 'shipper_name', 'customer_code', 'gstin', 'pan',
            'shipper_entity_type', 'governing_statute_and_year', 'shipper_registered_office_address',
            'security_deposit_amount_figures', 'security_deposit_amount_words',
            'bank_guarantee_amount_figures', 'bank_guarantee_amount_words',
            'termination_date', 'shipper_notice_contact_person', 'shipper_notice_address',
            'shipper_notice_email', 'shipper_notice_fax',
            'trunk_line_rate_1', 'spur_line_rate', 'connectivity_rate', 'transmission_rate',
            'fixed_monthly_spur_line_charges',
            'user', 'uft_path', 'entry_point', 'exit_point', 'distance_km',
            'contracted_capacity_scmd', 'contracted_capacity_mmscmd', 'capacity_type',
            'tolerance_pct', 'ship_or_pay_pct', 'valid_from', 'valid_to',
            'tariff_zone', 'unified_tariff_rate', 'iggl_share_pct', 'entitlement_rate',
            'security_deposit_lakhs', 'security_deposit_status', 'bank_guarantee_ref',
            'bg_bank_name', 'bg_expiry_date', 'conditions_precedent', 'document_url',
            'status', 'signed_by_shipper', 'signed_by_shipper_at', 'signed_by_iggl', 'signed_by_iggl_at',
            'remarks', 'admin_remark', 'created_at', 'updated_at', 'capacity_tranches', 'active_cts_count',
            'is_in_force'
        ]


class GTADashboardStatsSerializer(serializers.Serializer):
    active_gtas = serializers.IntegerField()
    active_cts = serializers.IntegerField()
    utilisation_today_pct = serializers.FloatField()
    contracted_capacity_mmscmd = serializers.FloatField()
    cumulative_imbalance_mmscmd = serializers.FloatField()
    overrun_position = serializers.CharField()
    outstanding_invoices_lakhs = serializers.FloatField()
    pending_invoices_count = serializers.IntegerField()


class UFTPathSerializer(serializers.ModelSerializer):
    total_capacity_mmbtu_day = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)

    class Meta:
        model = UFTPath
        fields = '__all__'

