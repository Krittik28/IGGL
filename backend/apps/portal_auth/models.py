from django.db import models
from django.contrib.auth.models import User

class UserRole(models.TextChoices):
    MARKETING_L1 = 'MARKETING_L1', 'Marketing Officer (L1 Reviewer)'
    FINANCE_L2 = 'FINANCE_L2', 'Finance Manager (L2 Approver)'
    IT_ADMIN = 'IT_ADMIN', 'IT Administrator (System)'
    CUSTOMER = 'CUSTOMER', 'Shipper Customer'

class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=30, choices=UserRole.choices, default=UserRole.CUSTOMER, db_index=True)
    department = models.CharField(max_length=100, blank=True, default='')
    phone = models.CharField(max_length=20, blank=True, default='')
    designation = models.CharField(max_length=100, blank=True, default='')
    company_name = models.CharField(max_length=100, blank=True, default='Indradhanush Gas Grid Limited')
    sap_customer_code = models.CharField(max_length=20, blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} ({self.get_role_display()})"

    @property
    def full_name(self):
        return self.user.get_full_name() or self.user.username

    @property
    def permissions(self):
        """
        Calculates front-end RBAC permission flags based on role.
        """
        if self.role == UserRole.IT_ADMIN:
            return {
                "can_review_marketing": True,
                "can_approve_finance": True,
                "can_post_sap": True,
                "can_inspect_payload": True,
                "can_retry_sap": True,
                "can_manage_users": True,
                "is_admin": True,
            }
        elif self.role == UserRole.FINANCE_L2:
            return {
                "can_review_marketing": False,
                "can_approve_finance": True,
                "can_post_sap": True,
                "can_inspect_payload": True,
                "can_retry_sap": True,
                "can_manage_users": False,
                "is_admin": True,
            }
        elif self.role == UserRole.MARKETING_L1:
            return {
                "can_review_marketing": True,
                "can_approve_finance": False,
                "can_post_sap": False,
                "can_inspect_payload": False,
                "can_retry_sap": False,
                "can_manage_users": False,
                "is_admin": True,
            }
        else: # CUSTOMER
            return {
                "can_review_marketing": False,
                "can_approve_finance": False,
                "can_post_sap": False,
                "can_inspect_payload": False,
                "can_retry_sap": False,
                "can_manage_users": False,
                "is_admin": False,
            }
