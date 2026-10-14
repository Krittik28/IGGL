from django.test import TestCase
from django.urls import reverse
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from .models import UserProfile, UserRole

class RBACAuthenticationTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Create Marketing User
        self.marketing_user = User.objects.create_user(
            username='marketing_test',
            email='marketing@iggl.co.in',
            password='Password@123'
        )
        UserProfile.objects.create(
            user=self.marketing_user,
            role=UserRole.MARKETING_L1,
            department='Marketing & Commercial'
        )

        # Create Customer User
        self.customer_user = User.objects.create_user(
            username='customer_test',
            email='customer@company.com',
            password='Password@123'
        )
        UserProfile.objects.create(
            user=self.customer_user,
            role=UserRole.CUSTOMER,
            department='Shipper'
        )

    def test_marketing_login_success(self):
        url = reverse('portal-login')
        payload = {
            "username": "marketing@iggl.co.in",
            "password": "Password@123",
            "portal_type": "IGGL_ADMIN"
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['role'], UserRole.MARKETING_L1)
        self.assertTrue(res.data['user']['permissions']['can_review_marketing'])
        self.assertFalse(res.data['user']['permissions']['can_post_sap'])

    def test_customer_cannot_login_to_admin_portal(self):
        url = reverse('portal-login')
        payload = {
            "username": "customer@company.com",
            "password": "Password@123",
            "portal_type": "IGGL_ADMIN"
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("Access denied", str(res.data))

    def test_invalid_password_fails(self):
        url = reverse('portal-login')
        payload = {
            "username": "marketing@iggl.co.in",
            "password": "WrongPassword",
            "portal_type": "IGGL_ADMIN"
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_customer_login_by_phone_and_kunnr(self):
        # Configure customer user with phone and KUNNR
        profile = self.customer_user.profile
        profile.phone = "9876543210"
        profile.sap_customer_code = "1126846"
        profile.save()

        url = reverse('portal-login')

        # Test login by Phone
        phone_payload = {
            "username": "9876543210",
            "password": "Password@123",
            "portal_type": "CUSTOMER"
        }
        res_phone = self.client.post(url, phone_payload, format='json')
        self.assertEqual(res_phone.status_code, status.HTTP_200_OK)
        self.assertEqual(res_phone.data['role'], UserRole.CUSTOMER)

        # Test login by SAP Customer Number (KUNNR)
        kunnr_payload = {
            "username": "1126846",
            "password": "Password@123",
            "portal_type": "CUSTOMER"
        }
        res_kunnr = self.client.post(url, kunnr_payload, format='json')
        self.assertEqual(res_kunnr.status_code, status.HTTP_200_OK)
        self.assertEqual(res_kunnr.data['role'], UserRole.CUSTOMER)
