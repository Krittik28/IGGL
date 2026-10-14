import os
import sys
import django

# Setup Django environment
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'apps'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth.models import User
from portal_auth.models import UserProfile, UserRole

def create_admin():
    email = "admin@iggl.co.in"
    username = "admin"
    password = "Admin@123"

    user, created = User.objects.get_or_create(username=username, defaults={"email": email, "first_name": "IGGL", "last_name": "Administrator"})
    user.email = email
    user.set_password(password)
    user.is_staff = True
    user.is_superuser = True
    user.save()

    profile, p_created = UserProfile.objects.get_or_create(user=user)
    profile.role = UserRole.IT_ADMIN
    profile.department = "IT & Systems"
    profile.designation = "Chief System Administrator"
    profile.company_name = "Indradhanush Gas Grid Limited"
    profile.save()

    print(f"Admin account created successfully!")
    print(f"User ID / Email: {email} (or '{username}')")
    print(f"Password: {password}")
    print(f"Role: {profile.role} (Full administrative and approval permissions)")

if __name__ == '__main__':
    create_admin()
