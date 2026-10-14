import os
import logging
import xml.etree.ElementTree as ET
from decimal import Decimal
from datetime import datetime, date
from django.conf import settings
from django.db.models import Q
import requests

from ..models import UFTPath, CapacityTranche, CTStatus

logger = logging.getLogger(__name__)

DEFAULT_ODATA_URL = "https://192.162.2.34:44300/sap/opu/odata/sap/ZGTA_ODATA_SRV/Uft_detailsSet"
SEED_XML_PATH = os.path.join(settings.BASE_DIR, 'apps', 'gta', 'data', 'uft_seed.xml')

ATOM_NS = {
    'atom': 'http://www.w3.org/2005/Atom',
    'm': 'http://schemas.microsoft.com/ado/2007/08/dataservices/metadata',
    'd': 'http://schemas.microsoft.com/ado/2007/08/dataservices'
}


def parse_sap_date(val):
    """Parse SAP YYYYMMDD string or YYYY-MM-DD into a datetime.date object."""
    if not val:
        return None
    val = str(val).strip()
    if len(val) == 8 and val.isdigit():
        try:
            return date(int(val[:4]), int(val[4:6]), int(val[6:8]))
        except ValueError:
            return None
    try:
        return datetime.strptime(val[:10], '%Y-%m-%d').date()
    except (ValueError, TypeError):
        return None


def parse_decimal(val, default='0.00'):
    """Safely convert XML string to Decimal."""
    if val is None or str(val).strip() == '':
        return Decimal(default)
    try:
        return Decimal(str(val).strip())
    except Exception:
        return Decimal(default)


def parse_uft_xml_feed(xml_text):
    """
    Parses Atom XML feed of Uft_detailsSet into a list of dictionaries.
    """
    root = ET.fromstring(xml_text)
    entries = root.findall('atom:entry', ATOM_NS)
    # Also support feed without namespace prefix on entry
    if not entries:
        entries = root.findall('{http://www.w3.org/2005/Atom}entry')

    records = []
    for entry in entries:
        props = entry.find('atom:content/m:properties', ATOM_NS)
        if props is None:
            props = entry.find('{http://www.w3.org/2005/Atom}content/{http://schemas.microsoft.com/ado/2007/08/dataservices/metadata}properties')
        if props is None:
            continue

        def get_field(tag):
            el = props.find(f'd:{tag}', ATOM_NS)
            if el is None:
                el = props.find(f'{{http://schemas.microsoft.com/ado/2007/08/dataservices}}{tag}')
            return el.text if el is not None and el.text is not None else ''

        uft_id = get_field('UFT_ID').strip()
        if not uft_id:
            continue

        rec = {
            'uft_id': uft_id,
            'path_id_desc': get_field('PATH_ID_DESC').strip(),
            'unified_entry_point': get_field('UNFD_EN_PNT').strip(),
            'unified_exit_point': get_field('UNFD_EX_PNT').strip(),
            'delivery_point': get_field('DELIVERY_PNT').strip(),
            'total_km': parse_decimal(get_field('TOTAL_KM'), '0.000'),
            'zone_pngrb': get_field('ZONE_PNGRB').strip() or 'ZONE1',
            'applicable_tariff_regime': parse_decimal(get_field('TARIFF_APP'), '0.00'),
            'price_applicable_date': parse_sap_date(get_field('PRICE_APP_DATE')),
            'valid_from': parse_sap_date(get_field('VALID_FROM')),
            'valid_to': parse_sap_date(get_field('VALID_TO')),
            'transporter': get_field('TRANSPORTER').strip() or 'IGGL',
            'shared_km': parse_decimal(get_field('SHARED_KM'), '0.000'),
            'uft_ratio_pct': parse_decimal(get_field('UFT_RATIO'), '100.00'),
            'amt_for_invoice_per_mmbtu': parse_decimal(get_field('INVOICE_AMT'), '0.00'),
            'iggl_zonal_entity_id': get_field('IGGL_ZN_ID').strip(),
            'revenue_entitlement': parse_decimal(get_field('REV_ENTITLED'), '100.00'),
            'applicable_date': parse_sap_date(get_field('APPLICABLE_DATE')),
        }
        records.append(rec)

    return records


def sync_uft_master_paths(odata_url=DEFAULT_ODATA_URL, force_seed=False):
    """
    Synchronizes UFT Paths from SAP OData feed into the UFTPath database master.
    Falls back gracefully to the embedded official seed XML if SAP network is unreachable.
    Preserves any administrator-maintained `total_capacity_mmbtu_day`!
    """
    xml_text = None
    source = 'SAP_ODATA'

    if not force_seed:
        try:
            logger.info("Attempting to fetch UFT paths from SAP OData: %s", odata_url)
            resp = requests.get(odata_url, timeout=3.0, verify=False)
            if resp.status_code == 200 and '<feed' in resp.text:
                xml_text = resp.text
                source = 'SAP_ODATA'
            else:
                logger.warning("SAP OData returned status %s. Falling back to seed XML.", resp.status_code)
        except Exception as ex:
            logger.warning("SAP OData network connection failed (%s). Falling back to seed XML.", ex)

    if not xml_text:
        if os.path.exists(SEED_XML_PATH):
            with open(SEED_XML_PATH, 'r', encoding='utf-8') as f:
                xml_text = f.read()
            source = 'LOCAL_SEED_XML'
        else:
            raise FileNotFoundError(f"Neither SAP OData nor fallback seed XML at {SEED_XML_PATH} available.")

    parsed_records = parse_uft_xml_feed(xml_text)
    synced_paths = []
    synced_uft_ids = set()

    for item in parsed_records:
        uft_id = item['uft_id']
        synced_uft_ids.add(uft_id)
        obj = UFTPath.objects.filter(uft_id=uft_id).first()
        if obj:
            # Update all attributes from OData, but DO NOT overwrite total_capacity_mmbtu_day
            cap = obj.total_capacity_mmbtu_day  # preserve admin-set capacity
            for k, v in item.items():
                setattr(obj, k, v)
            obj.total_capacity_mmbtu_day = cap
            obj.is_active = True
            obj.save()
            synced_paths.append(obj)
        else:
            # New path: create with default capacity of 164,685.28 MMBTU/Day
            item['total_capacity_mmbtu_day'] = Decimal('164685.28')
            item['is_active'] = True
            new_obj = UFTPath.objects.create(**item)
            synced_paths.append(new_obj)

    # Deactivate any paths in the DB that are no longer present in the OData feed.
    # This removes stale entries from the web without deleting them from the database.
    deactivated_count = UFTPath.objects.exclude(uft_id__in=synced_uft_ids).filter(is_active=True).update(is_active=False)
    if deactivated_count:
        logger.info("Deactivated %d stale UFT paths no longer in OData feed.", deactivated_count)

    logger.info("Synced %d UFT paths from %s", len(synced_paths), source)
    return {
        'success': True,
        'count': len(synced_paths),
        'deactivated': deactivated_count,
        'source': source,
        'paths': [
            {
                'id': str(p.id),
                'uft_id': p.uft_id,
                'path_id_desc': p.path_id_desc,
                'unified_entry_point': p.unified_entry_point,
                'unified_exit_point': p.unified_exit_point,
                'zone_pngrb': p.zone_pngrb,
                'total_capacity_mmbtu_day': float(p.total_capacity_mmbtu_day),
                'applicable_tariff_regime': float(p.applicable_tariff_regime),
                'amt_for_invoice_per_mmbtu': float(p.amt_for_invoice_per_mmbtu),
            }
            for p in synced_paths
        ]
    }


def calculate_pipeline_capacity_availability(uft_path_identifier, start_date, end_date, requested_quantity=Decimal('0.00')):
    """
    Computes real-time capacity availability for a given UFT path over [start_date, end_date].
    
    Mathematical Model:
    1. Total Capacity C_total = uft_path.total_capacity_mmbtu_day
    2. Active Committed Capacity Tranches: CTs overlapping [start_date, end_date] with
       status in [SUBMITTED, UNDER_PROCESS, UNDER_REVIEW, APPROVED, DOCUMENT_ISSUED, EXECUTED].
    3. Peak Booked Daily Capacity L_peak = max load on any day t in [start_date, end_date].
    4. Available Capacity C_avail = max(0, C_total - L_peak).
    5. Feasibility: requested_quantity <= C_avail.
    """
    if isinstance(start_date, str):
        start_date = parse_sap_date(start_date)
    if isinstance(end_date, str):
        end_date = parse_sap_date(end_date)
    if not start_date or not end_date:
        today = date.today()
        start_date = start_date or today
        end_date = end_date or today

    if start_date > end_date:
        start_date, end_date = end_date, start_date

    try:
        requested_quantity = Decimal(str(requested_quantity or 0))
    except Exception:
        requested_quantity = Decimal('0.00')

    # Resolve UFTPath instance
    if isinstance(uft_path_identifier, UFTPath):
        uft_path = uft_path_identifier
    else:
        uft_path = UFTPath.objects.filter(
            Q(id=uft_path_identifier) if len(str(uft_path_identifier)) == 36 else Q(uft_id__iexact=str(uft_path_identifier))
        ).first()

    if not uft_path:
        # Fallback if not found in DB
        return {
            'found': False,
            'uft_id': str(uft_path_identifier),
            'total_capacity_mmbtu_day': 0.0,
            'peak_booked_capacity_mmbtu_day': 0.0,
            'available_capacity_mmbtu_day': 0.0,
            'requested_quantity_mmbtu_day': float(requested_quantity),
            'is_available': False,
            'utilization_pct': 0.0,
            'overlapping_cts_count': 0,
            'message': f"UFT Path '{uft_path_identifier}' not found in master database."
        }

    total_capacity = uft_path.total_capacity_mmbtu_day or Decimal('50000.00')

    # Query active/committed CTs that reference this UFT path
    # Statuses that reserve pipeline capacity:
    COMMITTED_STATUSES = [
        CTStatus.SUBMITTED,
        CTStatus.UNDER_REVIEW,
        CTStatus.UNDER_PROCESS,
        CTStatus.APPROVED,
        CTStatus.DOCUMENT_ISSUED,
        CTStatus.EXECUTED
    ]

    candidate_cts = CapacityTranche.objects.filter(
        Q(uft_path_id__iexact=uft_path.uft_id) |
        Q(unified_path__iexact=uft_path.uft_id) |
        Q(path_id_desc__iexact=uft_path.path_id_desc)
    ).filter(
        status__in=COMMITTED_STATUSES
    )

    # Filter overlapping CTs
    overlapping_cts = []
    critical_points = {start_date, end_date}

    for ct in candidate_cts:
        s = ct.approved_ct_start_date or ct.start_date
        e = ct.approved_ct_end_date or ct.end_date
        if not s or not e:
            continue
        if s <= end_date and e >= start_date:
            qty = ct.approved_quantity_mmbtu_day or ct.quantity_mmbtu_day or Decimal('0.00')
            shipper_str = ct.sold_to_party or (ct.gta.shipper_name if ct.gta else '') or 'Shipper'
            overlapping_cts.append({
                'ct_number': ct.ct_number,
                'shipper': shipper_str,
                'start_date': s,
                'end_date': e,
                'quantity': qty,
                'status': ct.status
            })
            critical_points.add(max(s, start_date))
            critical_points.add(min(e, end_date))

    # Evaluate daily load on each critical boundary date
    peak_booked = Decimal('0.00')
    critical_sorted = sorted(list(critical_points))

    for pt in critical_sorted:
        load_at_pt = sum(
            item['quantity'] for item in overlapping_cts
            if item['start_date'] <= pt <= item['end_date']
        )
        if load_at_pt > peak_booked:
            peak_booked = load_at_pt

    available_capacity = max(Decimal('0.00'), total_capacity - peak_booked)
    utilization_pct = (peak_booked / total_capacity * Decimal('100.00')) if total_capacity > 0 else Decimal('100.00')
    is_available = requested_quantity <= available_capacity

    return {
        'found': True,
        'uft_id': uft_path.uft_id,
        'path_id_desc': uft_path.path_id_desc,
        'unified_entry_point': uft_path.unified_entry_point,
        'unified_exit_point': uft_path.unified_exit_point,
        'delivery_point': uft_path.delivery_point,
        'zone_pngrb': uft_path.zone_pngrb,
        'start_date': str(start_date),
        'end_date': str(end_date),
        'total_capacity_mmbtu_day': float(total_capacity),
        'peak_booked_capacity_mmbtu_day': float(peak_booked),
        'available_capacity_mmbtu_day': float(available_capacity),
        'requested_quantity_mmbtu_day': float(requested_quantity),
        'remaining_after_requested': float(max(Decimal('0.00'), available_capacity - requested_quantity)),
        'is_available': bool(is_available),
        'utilization_pct': round(float(utilization_pct), 2),
        'overlapping_cts_count': len(overlapping_cts),
        'overlapping_cts': [
            {
                'ct_number': item['ct_number'],
                'shipper': item['shipper'],
                'start_date': str(item['start_date']),
                'end_date': str(item['end_date']),
                'quantity': float(item['quantity']),
                'status': item['status']
            }
            for item in overlapping_cts
        ],
        'status': 'EXHAUSTED' if available_capacity <= 0 else ('CONGESTED' if utilization_pct >= 85 else 'AVAILABLE')
    }
