import os
import sys
import shutil
from pathlib import Path

# Setup Django environment
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))
sys.path.insert(0, str(BASE_DIR / 'apps'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.sessions.models import Session
from registrations.models import CustomerRegistration, RegistrationDocument
from portal_auth.models import UserProfile, UserRole

def clear_database(preserve_admin=True):
    print("=" * 60)
    print("🧹 IGGL Portal - Database Reset Utility")
    print("=" * 60)

    # 1. Clear Uploaded Documents & Media Files
    doc_count = RegistrationDocument.objects.count()
    RegistrationDocument.objects.all().delete()
    print(f"[-] Deleted {doc_count} document metadata record(s).")

    media_docs_dir = getattr(settings, 'MEDIA_ROOT', BASE_DIR / 'media') / 'customer_documents'
    if media_docs_dir.exists():
        try:
            shutil.rmtree(media_docs_dir)
            media_docs_dir.mkdir(parents=True, exist_ok=True)
            print(f"[-] Cleaned physical media uploads at: {media_docs_dir}")
        except Exception as e:
            print(f"[!] Warning cleaning media directory: {e}")

    # 2. Clear Customer Registrations
    reg_count = CustomerRegistration.objects.count()
    CustomerRegistration.objects.all().delete()
    print(f"[-] Deleted {reg_count} customer registration record(s).")

    # 2b. Clear GTAs and Capacity Tranches
    try:
        from gta.models import GTAAgreement, CapacityTranche
        ct_count = CapacityTranche.objects.count()
        CapacityTranche.objects.all().delete()
        gta_count = GTAAgreement.objects.count()
        GTAAgreement.objects.all().delete()
        print(f"[-] Deleted {ct_count} Capacity Tranche(s) and {gta_count} GTA agreement(s).")
    except Exception as e:
        print(f"[!] Note on GTA reset: {e}")

    # 3. Clear Active Sessions
    session_count = Session.objects.count()
    Session.objects.all().delete()
    print(f"[-] Cleared {session_count} active user session(s).")

    # 4. Handle Users
    if preserve_admin:
        # Delete non-admin users
        non_admin_users = User.objects.exclude(username='admin')
        del_users_count = non_admin_users.count()
        non_admin_users.delete()
        print(f"[-] Deleted {del_users_count} customer / non-admin user account(s).")

        # Ensure admin account exists and has correct password & role
        admin_user, created = User.objects.get_or_create(
            username='admin',
            defaults={
                'email': 'admin@iggl.co.in',
                'first_name': 'IGGL',
                'last_name': 'Administrator',
                'is_staff': True,
                'is_superuser': True
            }
        )
        admin_user.email = 'admin@iggl.co.in'
        admin_user.set_password('Admin@123')
        admin_user.is_staff = True
        admin_user.is_superuser = True
        admin_user.save()

        profile, _ = UserProfile.objects.get_or_create(user=admin_user)
        profile.role = UserRole.IT_ADMIN
        profile.department = "IT & Systems"
        profile.designation = "Chief System Administrator"
        profile.company_name = "Indradhanush Gas Grid Limited"
        profile.save()

        print(f"[+] Admin account verified and ready:")
        print(f"    • Email:    admin@iggl.co.in")
        print(f"    • Username: admin")
        print(f"    • Password: Admin@123")
        print(f"    • Role:     IT_ADMIN (Full access to Review & SAP Posting Queue)")
    else:
        User.objects.all().delete()
        print(f"[-] All user accounts cleared.")

    print("=" * 60)
    print("✅ Database successfully reset to a clean state!")
    print("You can now begin a fresh customer onboarding test flow.")
    print("=" * 60)

if __name__ == '__main__':
    clear_database(preserve_admin=True)
