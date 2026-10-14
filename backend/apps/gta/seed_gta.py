import os
import sys
import django
from datetime import date, datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, BASE_DIR)
sys.path.insert(0, os.path.join(BASE_DIR, 'apps'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from gta.models import GTAAgreement, CapacityTranche, GTAStatus, CTStatus, TariffZone, CapacityType
from django.contrib.auth.models import User

def seed_gta_data():
    print("Seeding GTA agreements and Capacity Tranches...")
    
    # Shipper user or fallback
    shipper_user = User.objects.filter(username="royal_sundaram").first()

    # GTA 1: GTA-2024-001 (Vijapur -> Delhi NCR)
    gta1, _ = GTAAgreement.objects.get_or_create(
        gta_number="GTA-2024-001",
        defaults={
            "shipper_name": "Hindustan Waste Treatment Ltd. (HWL)",
            "customer_code": "1126846",
            "gstin": "18AAACA1234F1Z1",
            "pan": "AAACA1234F",
            "user": shipper_user,
            "entry_point": "Vijaipur",
            "exit_point": "Delhi NCR",
            "contracted_capacity_scmd": 720000,
            "contracted_capacity_mmscmd": 0.7200,
            "capacity_type": CapacityType.COMBINED,
            "valid_from": date(2024, 4, 1),
            "valid_to": date(2027, 3, 31),
            "tariff_zone": TariffZone.ZONE_2,
            "unified_tariff_rate": 58.75,
            "security_deposit_lakhs": 85.00,
            "security_deposit_status": "VERIFIED",
            "bank_guarantee_ref": "BG-SBI-ND-2024-8841",
            "status": GTAStatus.IN_FORCE,
            "signed_by_shipper": "Sandip Somany (Director)",
            "signed_by_shipper_at": datetime(2024, 3, 28, 14, 30),
            "signed_by_iggl": "Vikram Malhotra (Commercial DGM)",
            "signed_by_iggl_at": datetime(2024, 3, 29, 10, 15),
            "remarks": "Master Gas Transportation Agreement executed under PNGRB Unified Tariff regime."
        }
    )

    # GTA 2: GTA-2024-002 (Dahej -> Mathura)
    gta2, _ = GTAAgreement.objects.get_or_create(
        gta_number="GTA-2024-002",
        defaults={
            "shipper_name": "Hindustan Waste Treatment Ltd. (HWL)",
            "customer_code": "1126846",
            "gstin": "18AAACA1234F1Z1",
            "pan": "AAACA1234F",
            "user": shipper_user,
            "entry_point": "Dahej",
            "exit_point": "Mathura",
            "contracted_capacity_scmd": 450000,
            "contracted_capacity_mmscmd": 0.4500,
            "capacity_type": CapacityType.FIRM,
            "valid_from": date(2024, 6, 15),
            "valid_to": date(2026, 6, 14),
            "tariff_zone": TariffZone.ZONE_3,
            "unified_tariff_rate": 72.30,
            "security_deposit_lakhs": 50.00,
            "security_deposit_status": "VERIFIED",
            "bank_guarantee_ref": "BG-HDFC-GUJ-2024-1102",
            "status": GTAStatus.IN_FORCE,
            "signed_by_shipper": "Sandip Somany (Director)",
            "signed_by_shipper_at": datetime(2024, 6, 10, 11, 20),
            "signed_by_iggl": "Vikram Malhotra (Commercial DGM)",
            "signed_by_iggl_at": datetime(2024, 6, 12, 16, 45),
            "remarks": "Dahej-Mathura long haul firm transmission capacity."
        }
    )

    # GTA 3: Ready to Sign
    gta3, _ = GTAAgreement.objects.get_or_create(
        gta_number="GTA-2026-003",
        defaults={
            "shipper_name": "Assam Gas Company Limited",
            "customer_code": "1126850",
            "gstin": "18AAACA5555F1Z9",
            "pan": "AAACA5555F",
            "entry_point": "Duliajan",
            "exit_point": "Guwahati CGD",
            "contracted_capacity_scmd": 300000,
            "contracted_capacity_mmscmd": 0.3000,
            "capacity_type": CapacityType.FIRM,
            "valid_from": date(2026, 10, 1),
            "valid_to": date(2031, 9, 30),
            "tariff_zone": TariffZone.ZONE_1,
            "unified_tariff_rate": 34.00,
            "security_deposit_lakhs": 35.00,
            "security_deposit_status": "VERIFIED",
            "bank_guarantee_ref": "BG-AXIS-DIB-2026-3392",
            "status": GTAStatus.READY_TO_SIGN,
            "signed_by_iggl": "Commercial Head IGGL",
            "signed_by_iggl_at": datetime(2026, 9, 20, 12, 0),
            "remarks": "Approved by IGGL Board. Awaiting Shipper DSC / e-Sign execution."
        }
    )

    # GTA 4: Under Review
    gta4, _ = GTAAgreement.objects.get_or_create(
        gta_number="GTA-2026-004",
        defaults={
            "shipper_name": "Sunrise Power & Steel Ltd.",
            "customer_code": "1126855",
            "gstin": "08AABCS9999G1Z4",
            "pan": "AABCS9999G",
            "entry_point": "Silchar",
            "exit_point": "Agartala Hub",
            "contracted_capacity_scmd": 250000,
            "contracted_capacity_mmscmd": 0.2500,
            "capacity_type": CapacityType.INTERRUPTIBLE,
            "valid_from": date(2026, 11, 1),
            "valid_to": date(2028, 10, 31),
            "tariff_zone": TariffZone.ZONE_2,
            "unified_tariff_rate": 58.75,
            "security_deposit_lakhs": 25.00,
            "security_deposit_status": "PENDING",
            "status": GTAStatus.UNDER_REVIEW,
            "remarks": "Engineering team verifying available injection pressure at Silchar tie-in point."
        }
    )

    # Seed Capacity Tranches under GTA 1
    # CT 1: CT-REQ-2026-00031 (Returned for Correction)
    CapacityTranche.objects.get_or_create(
        ct_number="CT-REQ-2026-00031",
        gta=gta1,
        defaults={
            "tranche_type": CapacityType.FIRM,
            "requested_capacity_scmd": 200000,
            "allocated_capacity_scmd": 0,
            "start_date": date(2026, 10, 1),
            "end_date": date(2026, 12, 31),
            "status": CTStatus.RETURNED,
            "action_required_note": "CT-REQ-2026-00031 requires additional documents",
            "remarks": "Please attach updated downstream offtake authorization letter."
        }
    )

    # CT 2: CT-REQ-2026-00038 (Ready to Sign / Document Issued)
    CapacityTranche.objects.get_or_create(
        ct_number="CT-REQ-2026-00038",
        gta=gta1,
        defaults={
            "tranche_type": CapacityType.FIRM,
            "requested_capacity_scmd": 250000,
            "allocated_capacity_scmd": 250000,
            "start_date": date(2026, 11, 1),
            "end_date": date(2027, 3, 31),
            "status": CTStatus.DOCUMENT_ISSUED,
            "action_required_note": "CT-REQ-2026-00038 unsigned CT awaits your signature",
            "remarks": "Approved by Commercial team. Ready for digital signature."
        }
    )

    # CT 3: CT-REQ-2026-00042 (Executed / Approved)
    CapacityTranche.objects.get_or_create(
        ct_number="CT-REQ-2026-00042",
        gta=gta1,
        defaults={
            "tranche_type": CapacityType.FIRM,
            "requested_capacity_scmd": 150000,
            "allocated_capacity_scmd": 150000,
            "start_date": date(2026, 4, 1),
            "end_date": date(2026, 9, 30),
            "status": CTStatus.EXECUTED,
            "remarks": "Executed and operational."
        }
    )

    # CT 4: CT-REQ-2026-00046 (Executed)
    CapacityTranche.objects.get_or_create(
        ct_number="CT-REQ-2026-00046",
        gta=gta1,
        defaults={
            "tranche_type": CapacityType.INTERRUPTIBLE,
            "requested_capacity_scmd": 120000,
            "allocated_capacity_scmd": 120000,
            "start_date": date(2026, 5, 1),
            "end_date": date(2026, 10, 31),
            "status": CTStatus.EXECUTED,
            "remarks": "Operational tranche."
        }
    )

    # CTs under GTA 2
    CapacityTranche.objects.get_or_create(
        ct_number="CT-REQ-2026-00050",
        gta=gta2,
        defaults={
            "tranche_type": CapacityType.FIRM,
            "requested_capacity_scmd": 250000,
            "allocated_capacity_scmd": 250000,
            "start_date": date(2026, 1, 1),
            "end_date": date(2026, 6, 14),
            "status": CTStatus.EXECUTED,
            "remarks": "Active delivery tranche."
        }
    )

    CapacityTranche.objects.get_or_create(
        ct_number="CT-REQ-2026-00051",
        gta=gta2,
        defaults={
            "tranche_type": CapacityType.FIRM,
            "requested_capacity_scmd": 200000,
            "allocated_capacity_scmd": 200000,
            "start_date": date(2026, 2, 1),
            "end_date": date(2026, 6, 14),
            "status": CTStatus.APPROVED,
            "remarks": "Approved capacity."
        }
    )

    print("GTA and CT data seeded successfully!")

if __name__ == '__main__':
    seed_gta_data()
