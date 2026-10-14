import os
import sys
import django

# Setup Django environment
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'apps'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from registrations.models import CustomerRegistration, RegistrationStatus
from registrations.sap_service import SAPODataService

def seed():
    print("Seeding initial customer registration records...")

    # Record 1: Submitted (Royal Sundaram from sheet)
    r1, created1 = CustomerRegistration.objects.get_or_create(
        registration_number="IGGL-REG-2026-10001",
        defaults={
            "status": RegistrationStatus.SUBMITTED,
            "name1": "ROYAL SUNDARAM GENERAL",
            "name2": "INSURANCE CO. LIMITED",
            "city": "Jaipur",
            "postal_code": "302001",
            "street": "Office No 402,4th Floor, Axis Mall,",
            "telephone": "9529278332",
            "tax_number": "08AABCR7109G1ZJ",
            "pan_number": "AABCR7109G",
            "email": "contact@royalsundaram.com",
            "country": "IN",
            "language_key": "EN",
            "region": "RJ",
            "account_group": "ZDOM",
            "recon_account": "24430000",
            "payment_terms": "NT30",
            "sales_org": "1000",
        }
    )
    print(f"Record 1: {r1.registration_number} ({r1.name1}) -> {r1.status}")

    # Record 2: Already Approved and Posted to SAP (BP_CREATED)
    r2, created2 = CustomerRegistration.objects.get_or_create(
        registration_number="IGGL-REG-2026-10002",
        defaults={
            "status": RegistrationStatus.BP_CREATED,
            "name1": "ASSAM GAS COMPANY LIMITED",
            "name2": "DULIAJAN DIVISION",
            "city": "Dibrugarh",
            "postal_code": "786602",
            "street": "Industrial Area, PO Duliajan",
            "telephone": "9435012345",
            "tax_number": "18AAACA1234F1Z1",
            "pan_number": "AAACA1234F",
            "email": "shipper@agcl.co.in",
            "country": "IN",
            "language_key": "EN",
            "region": "AS",
            "account_group": "ZDOM",
            "recon_account": "24430000",
            "payment_terms": "NT30",
            "sales_org": "1000",
            "customer_number": "1126846",
            "address_number": "355321",
            "sap_status": "SUCCESS",
            "remarks": "KYC and board resolution approved. SAP customer master generated.",
        }
    )
    if created2:
        r2.sap_payload = SAPODataService.build_customer_payload(r2)
        r2.sap_response = {
            "d": {
                "KUNNR": "1126846",
                "ADRNR": "355321",
                "STATUS": "CREATED",
                "MESSAGE": "Customer Master successfully created in SAP S/4HANA",
            }
        }
        r2.save()
    print(f"Record 2: {r2.registration_number} ({r2.name1}) -> {r2.status} (KUNNR: {r2.customer_number})")

    # Record 3: Returned for Correction
    r3, created3 = CustomerRegistration.objects.get_or_create(
        registration_number="IGGL-REG-2026-10003",
        defaults={
            "status": RegistrationStatus.RETURNED,
            "name1": "BRAHMAPUTRA CRACKER & POLYMER",
            "name2": "PETROCHEM COMPLEX",
            "city": "Lepetkata",
            "postal_code": "786006",
            "street": "Central Admin Bldg, BCPL",
            "telephone": "9435198765",
            "tax_number": "18AABCB9876E1Z5",
            "pan_number": "AABCB9876E",
            "email": "contracts@bcplindia.co.in",
            "country": "IN",
            "language_key": "EN",
            "remarks": "Street address line exceeds maximum 35 characters limit for SAP STRAS field. Please shorten.",
        }
    )
    print(f"Record 3: {r3.registration_number} ({r3.name1}) -> {r3.status}")

    # Seed RBAC Users
    print("\nSeeding RBAC Portal Users...")
    from django.contrib.auth.models import User
    from portal_auth.models import UserProfile, UserRole

    users_data = [
        {
            "username": "marketing_officer",
            "email": "marketing@iggl.co.in",
            "first_name": "Ramesh",
            "last_name": "Sharma",
            "password": "Password@123",
            "role": UserRole.MARKETING_L1,
            "department": "Marketing & Commercial",
            "designation": "Senior Marketing Officer (L1)",
            "company_name": "Indradhanush Gas Grid Limited",
        },
        {
            "username": "finance_manager",
            "email": "finance@iggl.co.in",
            "first_name": "Priya",
            "last_name": "Nair",
            "password": "Password@123",
            "role": UserRole.FINANCE_L2,
            "department": "Finance & Accounts",
            "designation": "Chief Manager (F&A) - L2 Approver",
            "company_name": "Indradhanush Gas Grid Limited",
        },
        {
            "username": "admin_it",
            "email": "admin@iggl.co.in",
            "first_name": "Debashish",
            "last_name": "Barua",
            "password": "Password@123",
            "role": UserRole.IT_ADMIN,
            "department": "IT & Systems",
            "designation": "System Administrator",
            "company_name": "Indradhanush Gas Grid Limited",
        },
        {
            "username": "royal_sundaram",
            "email": "contact@royalsundaram.com",
            "first_name": "Authorized",
            "last_name": "Signatory",
            "password": "Password@123",
            "role": UserRole.CUSTOMER,
            "department": "Commercial Gas Logistics",
            "designation": "Commercial General Manager",
            "company_name": "Royal Sundaram General Insurance Co. Ltd",
        },
    ]

    for u in users_data:
        user_obj, u_created = User.objects.get_or_create(
            username=u["username"],
            defaults={
                "email": u["email"],
                "first_name": u["first_name"],
                "last_name": u["last_name"],
            }
        )
        user_obj.set_password(u["password"])
        user_obj.email = u["email"]
        user_obj.save()

        profile, p_created = UserProfile.objects.get_or_create(
            user=user_obj,
            defaults={
                "role": u["role"],
                "department": u["department"],
                "designation": u["designation"],
                "company_name": u["company_name"],
            }
        )
        profile.role = u["role"]
        profile.department = u["department"]
        profile.designation = u["designation"]
        profile.company_name = u["company_name"]
        profile.save()

        print(f"User: {user_obj.email} | Role: {profile.role} | Password: {u['password']}")

    print("Seeding completed successfully!")

if __name__ == '__main__':
    seed()
