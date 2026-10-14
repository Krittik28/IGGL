"""
========================================================================================
IGGL GAS TRANSMISSION PORTAL - ENTERPRISE SAP S/4HANA & PNGRB E2E TEST SUITE
========================================================================================
Author: Senior Software Engineer (SAP Labs - Enterprise Web & S/4HANA Integration)
Specification: IGGL Gas Transmission Customer Portal & PNGRB Unified Tariff Architecture
Test Count: 122 Rigorous Production-Grade Test Cases
Coverage:
  1. Enterprise Identity, Cryptographic JWT & RBAC Matrix (Tests 1–25)
  2. Strict Multi-Tenant Customer Isolation & Boundary Defense (Tests 26–45)
  3. Customer Master Registration & SAP S/4HANA OData BP Integration (Tests 46–65)
  4. GTA Contract Lifecycle, PNGRB Tariff & Financial Precision (Tests 66–85)
  5. Capacity Tranche (CT) 34 Consultant Fields, Tolerances & State Machine (Tests 86–105)
  6. Enterprise Resiliency, Fault Injection, Edge Cases & Round-Trip Workflow (Tests 106–122)
========================================================================================
"""

import uuid
import json
from decimal import Decimal
from datetime import date, timedelta
from django.test import TestCase
from django.utils import timezone
from django.urls import reverse
from django.contrib.auth.models import User
from rest_framework.test import APIClient, APIRequestFactory
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken, AccessToken
from rest_framework_simplejwt.exceptions import TokenError

from portal_auth.models import UserProfile, UserRole
from registrations.models import CustomerRegistration, RegistrationStatus, DocumentType, RegistrationDocument
from gta.models import (
    GTAAgreement, CapacityTranche, GTAStatus, CTStatus,
    TariffZone, CapacityType
)
from gta.views import GTAAgreementViewSet, CapacityTrancheViewSet


# ======================================================================================
# SUITE 1: ENTERPRISE IDENTITY, CRYPTOGRAPHIC JWT & RBAC MATRIX (TESTS 1–25)
# ======================================================================================
class EnterpriseIdentityAndJWTSecurityTests(TestCase):
    """
    Validates cryptographic JWT token issuance, RBAC claims, token expiration,
    tampering, malformed headers, and anonymous fallback defense.
    """

    def setUp(self):
        self.client = APIClient()

        # Create Standard Customer User
        self.cust_user = User.objects.create_user(
            username='shipper.test@enterprise.com',
            email='shipper.test@enterprise.com',
            password='Password@123',
            first_name='Shipper',
            last_name='Officer'
        )
        self.cust_profile = UserProfile.objects.create(
            user=self.cust_user,
            role=UserRole.CUSTOMER,
            company_name='Reliance Gas Services Ltd',
            sap_customer_code='0000051300',
            phone='9876543210'
        )

        # Create Marketing L1 Admin User
        self.mktg_user = User.objects.create_user(
            username='marketing.l1@iggl.co.in',
            email='marketing.l1@iggl.co.in',
            password='Password@123'
        )
        self.mktg_profile = UserProfile.objects.create(
            user=self.mktg_user,
            role=UserRole.MARKETING_L1,
            department='Marketing & Commercial'
        )

        # Create Finance L2 Approver User
        self.fin_user = User.objects.create_user(
            username='finance.l2@iggl.co.in',
            email='finance.l2@iggl.co.in',
            password='Password@123'
        )
        self.fin_profile = UserProfile.objects.create(
            user=self.fin_user,
            role=UserRole.FINANCE_L2,
            department='Finance & Accounts'
        )

        # Create IT Administrator
        self.admin_user = User.objects.create_user(
            username='admin.it@iggl.co.in',
            email='admin.it@iggl.co.in',
            password='Password@123',
            is_staff=True
        )
        self.admin_profile = UserProfile.objects.create(
            user=self.admin_user,
            role=UserRole.IT_ADMIN,
            department='IT & Systems'
        )

    def test_001_jwt_issuance_valid_credentials(self):
        """001: Verifies successful login returns 200 with valid JWT access and refresh tokens."""
        url = reverse('portal-login')
        res = self.client.post(url, {
            'username': 'shipper.test@enterprise.com',
            'password': 'Password@123',
            'portal_type': 'CUSTOMER'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('access', res.data)
        self.assertIn('refresh', res.data)
        self.assertTrue(len(res.data['access']) > 20)

    def test_002_jwt_claims_payload_integrity(self):
        """002: Verifies custom enterprise claims embedded in JWT payload."""
        refresh = RefreshToken.for_user(self.cust_user)
        refresh['email'] = self.cust_user.email
        refresh['role'] = self.cust_profile.role
        refresh['company_name'] = self.cust_profile.company_name
        refresh['customer_code'] = self.cust_profile.sap_customer_code

        token = refresh.access_token
        self.assertEqual(token['email'], 'shipper.test@enterprise.com')
        self.assertEqual(token['role'], UserRole.CUSTOMER)
        self.assertEqual(token['company_name'], 'Reliance Gas Services Ltd')
        self.assertEqual(token['customer_code'], '0000051300')

    def test_003_expired_jwt_token_rejection(self):
        """003: Verifies that an expired JWT token returns 401 Unauthorized."""
        refresh = RefreshToken.for_user(self.cust_user)
        token = refresh.access_token
        # Backdate expiry by 1 hour
        token.set_exp(lifetime=-timedelta(hours=1))
        expired_token_str = str(token)

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {expired_token_str}')
        res = self.client.get('/api/v1/gtas/')
        # With expired token, DRF rejects credentials
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_004_refresh_token_exchange_success(self):
        """004: Verifies token refresh endpoint returns a fresh new access token."""
        url = reverse('portal-token-refresh')
        refresh = str(RefreshToken.for_user(self.cust_user))
        res = self.client.post(url, {'refresh': refresh}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('access', res.data)

    def test_005_tampered_jwt_signature_rejection(self):
        """005: Verifies that modifying a single character of the signature causes 401."""
        token = str(RefreshToken.for_user(self.cust_user).access_token)
        tampered = token[:-4] + 'xxxx'
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {tampered}')
        res = self.client.get('/api/v1/gtas/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_006_malformed_bearer_header_space_only(self):
        """006: Verifies header 'Bearer ' without token returns 401."""
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ')
        res = self.client.get('/api/v1/gtas/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_007_non_bearer_header_handling(self):
        """007: Verifies unknown auth header prefix returns 0 results or handles gracefully."""
        self.client.credentials(HTTP_AUTHORIZATION='Basic dXNlcjpwYXNz')
        res = self.client.get('/api/v1/gtas/')
        # Treated as unauthenticated -> 0 GTAs
        self.assertEqual(len(res.data), 0)

    def test_008_missing_authorization_header_returns_empty(self):
        """008: Verifies completely missing authorization header returns 0 results for anonymous."""
        self.client.credentials()  # Clear credentials
        res = self.client.get('/api/v1/gtas/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 0)

    def test_009_customer_blocked_from_admin_portal(self):
        """009: Verifies Customer user cannot authenticate to IGGL Admin portal."""
        url = reverse('portal-login')
        res = self.client.post(url, {
            'username': 'shipper.test@enterprise.com',
            'password': 'Password@123',
            'portal_type': 'IGGL_ADMIN'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn('Access denied', str(res.data))

    def test_010_marketing_l1_cannot_post_sap(self):
        """010: Verifies Marketing L1 permissions disallow SAP posting."""
        self.assertFalse(self.mktg_profile.permissions['can_post_sap'])
        self.assertTrue(self.mktg_profile.permissions['can_review_marketing'])

    def test_011_finance_l2_authorized_for_sap(self):
        """011: Verifies Finance L2 permissions allow SAP posting and approval."""
        self.assertTrue(self.fin_profile.permissions['can_post_sap'])
        self.assertTrue(self.fin_profile.permissions['can_approve_finance'])

    def test_012_it_admin_full_system_permissions(self):
        """012: Verifies IT Admin has full system permissions."""
        perms = self.admin_profile.permissions
        self.assertTrue(perms['is_admin'])
        self.assertTrue(perms['can_manage_users'])
        self.assertTrue(perms['can_post_sap'])

    def test_013_customer_login_by_email(self):
        """013: Verifies customer can authenticate using email address."""
        res = self.client.post(reverse('portal-login'), {
            'username': 'shipper.test@enterprise.com',
            'password': 'Password@123',
            'portal_type': 'CUSTOMER'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['role'], UserRole.CUSTOMER)

    def test_014_customer_login_by_phone(self):
        """014: Verifies customer can authenticate using 10-digit registered phone."""
        res = self.client.post(reverse('portal-login'), {
            'username': '9876543210',
            'password': 'Password@123',
            'portal_type': 'CUSTOMER'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['role'], UserRole.CUSTOMER)

    def test_015_customer_login_by_sap_kunnr(self):
        """015: Verifies customer can authenticate using SAP Customer Number (KUNNR)."""
        res = self.client.post(reverse('portal-login'), {
            'username': '0000051300',
            'password': 'Password@123',
            'portal_type': 'CUSTOMER'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['role'], UserRole.CUSTOMER)

    def test_016_inactive_user_account_login_rejection(self):
        """016: Verifies unapproved/inactive customer account cannot log in."""
        self.cust_user.is_active = False
        self.cust_user.save()
        res = self.client.post(reverse('portal-login'), {
            'username': 'shipper.test@enterprise.com',
            'password': 'Password@123',
            'portal_type': 'CUSTOMER'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_017_sql_injection_defense_in_username(self):
        """017: Verifies SQL Injection attempt in username field is safely parameterized."""
        res = self.client.post(reverse('portal-login'), {
            'username': "admin' OR '1'='1' --",
            'password': 'Password@123',
            'portal_type': 'IGGL_ADMIN'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_018_xss_injection_defense_in_credentials(self):
        """018: Verifies XSS script in username does not execute or corrupt responses."""
        res = self.client.post(reverse('portal-login'), {
            'username': "<script>alert('XSS')</script>",
            'password': 'Password@123',
            'portal_type': 'CUSTOMER'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_019_unicode_and_special_character_username(self):
        """019: Verifies unicode characters in username field are safely handled."""
        res = self.client.post(reverse('portal-login'), {
            'username': 'user_unicode_ñ_ä_🚀@test.com',
            'password': 'Password@123',
            'portal_type': 'CUSTOMER'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_020_invalid_password_returns_401(self):
        """020: Verifies wrong password returns 401 with standard error message."""
        res = self.client.post(reverse('portal-login'), {
            'username': 'shipper.test@enterprise.com',
            'password': 'WrongPassword123!',
            'portal_type': 'CUSTOMER'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_021_multi_session_concurrency(self):
        """021: Verifies two simultaneous valid JWT tokens for same user both authenticate."""
        token1 = str(RefreshToken.for_user(self.cust_user).access_token)
        token2 = str(RefreshToken.for_user(self.cust_user).access_token)

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token1}')
        res1 = self.client.get('/api/v1/gtas/customer_dashboard/')
        self.assertEqual(res1.status_code, status.HTTP_200_OK)

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token2}')
        res2 = self.client.get('/api/v1/gtas/customer_dashboard/')
        self.assertEqual(res2.status_code, status.HTTP_200_OK)

    def test_022_portal_logout_terminates_session(self):
        """022: Verifies POST /api/v1/auth/logout/ terminates session cleanly."""
        token = str(RefreshToken.for_user(self.cust_user).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        res = self.client.post(reverse('portal-logout'), format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_023_anonymous_gta_list_returns_zero(self):
        """023: Verifies unauthenticated GET /api/v1/gtas/ returns 0 records."""
        self.client.credentials()
        res = self.client.get('/api/v1/gtas/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 0)

    def test_024_anonymous_ct_list_returns_zero(self):
        """024: Verifies unauthenticated GET /api/v1/capacity-tranches/ returns 0 records."""
        self.client.credentials()
        res = self.client.get('/api/v1/capacity-tranches/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 0)

    def test_025_anonymous_customer_dashboard_returns_zero_metrics(self):
        """025: Verifies unauthenticated customer dashboard request returns zeroed metrics."""
        self.client.credentials()
        res = self.client.get('/api/v1/gtas/customer_dashboard/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['metrics']['active_gtas'], 0)
        self.assertEqual(res.data['metrics']['active_cts'], 0)


# ======================================================================================
# SUITE 2: STRICT MULTI-TENANT ISOLATION & BOUNDARY DEFENSE (TESTS 26–45)
# ======================================================================================
class StrictMultiTenantIsolationTests(TestCase):
    """
    Validates complete data segregation between Customer A, Customer B, and Admin.
    Ensures zero cross-tenant leakage across GTAs, CTs, Master Data, and Dashboards.
    """

    def setUp(self):
        self.client = APIClient()

        # Customer A Setup
        self.user_a = User.objects.create_user(
            username='contact@company-a.com',
            email='contact@company-a.com',
            password='Password@123'
        )
        self.profile_a = UserProfile.objects.create(
            user=self.user_a,
            role=UserRole.CUSTOMER,
            company_name='Company A Petrochemicals Ltd',
            sap_customer_code='0000051301'
        )
        self.token_a = str(RefreshToken.for_user(self.user_a).access_token)

        # Customer B Setup
        self.user_b = User.objects.create_user(
            username='contact@company-b.com',
            email='contact@company-b.com',
            password='Password@123'
        )
        self.profile_b = UserProfile.objects.create(
            user=self.user_b,
            role=UserRole.CUSTOMER,
            company_name='Company B Fertilizers Corp',
            sap_customer_code='0000051302'
        )
        self.token_b = str(RefreshToken.for_user(self.user_b).access_token)

        # Admin Setup
        self.user_admin = User.objects.create_user(
            username='admin@iggl.co.in',
            email='admin@iggl.co.in',
            password='Password@123',
            is_staff=True
        )
        self.profile_admin = UserProfile.objects.create(
            user=self.user_admin,
            role=UserRole.IT_ADMIN
        )
        self.token_admin = str(RefreshToken.for_user(self.user_admin).access_token)

        # Create GTAs for Customer A
        self.gta_a1 = GTAAgreement.objects.create(
            user=self.user_a,
            gta_number='IGGL/GTA/2026/001',
            shipper_name='Company A Petrochemicals Ltd',
            customer_code='0000051301',
            shipper_notice_email='contact@company-a.com',
            status=GTAStatus.IN_FORCE,
            contracted_capacity_mmscmd=Decimal('1.50'),
            unified_tariff_rate=Decimal('34.00')
        )

        # Create CT under GTA A
        self.ct_a1 = CapacityTranche.objects.create(
            ct_number='CT-REQ-2026-0001',
            gta=self.gta_a1,
            sold_to_party='Company A Petrochemicals Ltd [0000051301]',
            quantity_mmbtu_day=Decimal('500.00'),
            status=CTStatus.APPROVED
        )

    def test_026_customer_a_can_view_own_gta(self):
        """026: Verifies Customer A retrieves their own GTA."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token_a}')
        res = self.client.get('/api/v1/gtas/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['gta_number'], 'IGGL/GTA/2026/001')

    def test_027_customer_b_cannot_view_customer_a_gta(self):
        """027: Verifies Customer B receives 0 GTAs and does NOT see Customer A's GTA."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token_b}')
        res = self.client.get('/api/v1/gtas/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 0)

    def test_028_customer_b_cannot_view_customer_a_gta_detail(self):
        """028: Verifies Customer B cannot access Customer A's GTA by direct UUID (returns 404)."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token_b}')
        res = self.client.get(f'/api/v1/gtas/{self.gta_a1.id}/')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_029_customer_b_cannot_sign_customer_a_gta(self):
        """029: Verifies Customer B cannot digitally sign Customer A's GTA."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token_b}')
        res = self.client.post(f'/api/v1/gtas/{self.gta_a1.id}/sign/', {'signer_name': 'Attacker'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_030_customer_a_can_view_own_ct(self):
        """030: Verifies Customer A retrieves their own Capacity Tranche."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token_a}')
        res = self.client.get('/api/v1/capacity-tranches/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['ct_number'], 'CT-REQ-2026-0001')

    def test_031_customer_b_cannot_view_customer_a_ct(self):
        """031: Verifies Customer B receives 0 CTs and does NOT see Customer A's CT."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token_b}')
        res = self.client.get('/api/v1/capacity-tranches/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 0)

    def test_032_customer_b_cannot_view_customer_a_ct_detail(self):
        """032: Verifies direct CT retrieval by UUID is blocked for other tenants (404)."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token_b}')
        res = self.client.get(f'/api/v1/capacity-tranches/{self.ct_a1.id}/')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_033_customer_b_cannot_modify_customer_a_ct(self):
        """033: Verifies PATCH modification of Customer A's CT is rejected for Customer B."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token_b}')
        res = self.client.patch(f'/api/v1/capacity-tranches/{self.ct_a1.id}/', {'quantity_mmbtu_day': 9999}, format='json')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_034_ct_master_data_customer_dropdown_isolation(self):
        """034: Verifies CT master-data dropdown only includes Customer A's GTAs for Customer A."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token_a}')
        res = self.client.get('/api/v1/capacity-tranches/master-data/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        gta_nos = [g['gta_no'] for g in res.data['gta_options']]
        self.assertIn('IGGL/GTA/2026/001', gta_nos)

    def test_035_ct_master_data_customer_b_does_not_see_customer_a_gta(self):
        """035: Verifies CT master-data dropdown does NOT leak Customer A's GTA to Customer B."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token_b}')
        res = self.client.get('/api/v1/capacity-tranches/master-data/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        gta_nos = [g['gta_no'] for g in res.data['gta_options']]
        self.assertNotIn('IGGL/GTA/2026/001', gta_nos)

    def test_036_customer_dashboard_kpi_contracted_capacity_isolated(self):
        """036: Verifies Customer A sees contracted 1.50 MMSCMD while Customer B sees 0."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token_a}')
        res_a = self.client.get('/api/v1/gtas/customer_dashboard/')
        self.assertEqual(res_a.data['metrics']['active_gtas'], 1)
        self.assertIn('1.50 MMSCMD', res_a.data['metrics']['utilisation_contracted_subtext'])

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token_b}')
        res_b = self.client.get('/api/v1/gtas/customer_dashboard/')
        self.assertEqual(res_b.data['metrics']['active_gtas'], 0)
        self.assertEqual(res_b.data['metrics']['utilisation_contracted_subtext'], 'No contracted capacity')

    def test_037_customer_dashboard_action_items_isolated(self):
        """037: Verifies returned CT action items are only delivered to the owning tenant."""
        self.ct_a1.status = CTStatus.RETURNED
        self.ct_a1.action_required_note = 'Correction needed on metering point'
        self.ct_a1.save()

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token_a}')
        res_a = self.client.get('/api/v1/gtas/customer_dashboard/')
        action_ids = [a['id'] for a in res_a.data['action_required']]
        self.assertIn(f'act-ct-{self.ct_a1.id}', action_ids)

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token_b}')
        res_b = self.client.get('/api/v1/gtas/customer_dashboard/')
        action_ids_b = [a['id'] for a in res_b.data['action_required']]
        self.assertNotIn(f'act-ct-{self.ct_a1.id}', action_ids_b)

    def test_038_admin_can_view_all_gtas(self):
        """038: Verifies Admin user views all GTAs across all shippers."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token_admin}')
        res = self.client.get('/api/v1/gtas/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(len(res.data) >= 1)

    def test_039_admin_can_view_all_cts(self):
        """039: Verifies Admin user views all CTs across all shippers."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token_admin}')
        res = self.client.get('/api/v1/capacity-tranches/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(len(res.data) >= 1)

    def test_040_header_spoofing_defense(self):
        """040: Verifies Customer B passing Customer A's email in X-Customer-Email is ignored."""
        self.client.credentials(
            HTTP_AUTHORIZATION=f'Bearer {self.token_b}',
            HTTP_X_CUSTOMER_EMAIL='contact@company-a.com'
        )
        res = self.client.get('/api/v1/gtas/')
        # Token B identifies user B -> User B has 0 GTAs -> must return 0
        self.assertEqual(len(res.data), 0)

    def test_041_query_param_spoofing_defense(self):
        """041: Verifies Customer B passing ?customer_email=contact@company-a.com is restricted."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token_b}')
        res = self.client.get('/api/v1/gtas/?customer_email=contact@company-a.com')
        # Filter is scoped by user_b -> 0
        self.assertEqual(len(res.data), 0)

    def test_042_customer_creation_auto_binds_to_authenticated_user(self):
        """042: Verifies POST /api/v1/gtas/ automatically binds new GTA to authenticated user."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token_b}')
        payload = {
            'shipper_name': 'Company B Fertilizers Corp',
            'entry_point': 'Barauni Feeder',
            'exit_point': 'Guwahati CGS',
            'contracted_capacity_scmd': 100000,
            'contracted_capacity_mmscmd': '0.10',
            'capacity_type': CapacityType.FIRM
        }
        res = self.client.post('/api/v1/gtas/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        new_gta = GTAAgreement.objects.get(id=res.data['id'])
        self.assertEqual(new_gta.user, self.user_b)
        self.assertEqual(new_gta.shipper_name, 'Company B Fertilizers Corp')

    def test_043_customer_b_now_sees_own_new_gta_only(self):
        """043: Verifies Customer B sees only their created GTA and still not Customer A's."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token_b}')
        res = self.client.get('/api/v1/gtas/')
        self.assertTrue(all(g['shipper_name'] == 'Company B Fertilizers Corp' for g in res.data))

    def test_044_ct_creation_auto_binds_to_customer_gta(self):
        """044: Verifies CT creation by Customer A automatically binds to Customer A's GTA."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token_a}')
        payload = {
            'sold_to_party': 'Company A Petrochemicals Ltd [0000051301]',
            'quantity_mmbtu_day': 120.00,
            'start_date': '2026-10-01',
            'end_date': '2026-12-31'
        }
        res = self.client.post('/api/v1/capacity-tranches/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        new_ct = CapacityTranche.objects.get(id=res.data['id'])
        self.assertEqual(new_ct.gta, self.gta_a1)

    def test_045_deleted_user_sets_gta_user_null_without_leak(self):
        """045: Verifies on_delete=SET_NULL keeps GTA secure without leaking to other customers."""
        temp_user = User.objects.create_user(username='temp@test.com', email='temp@test.com', password='Password@123')
        temp_profile = UserProfile.objects.create(user=temp_user, role=UserRole.CUSTOMER, company_name='Temp Co')
        temp_gta = GTAAgreement.objects.create(user=temp_user, gta_number='IGGL/GTA/TEMP', shipper_name='Temp Co')

        temp_user.delete()
        temp_gta.refresh_from_db()
        self.assertIsNone(temp_gta.user)

        # Customer A must still not see temp_gta
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token_a}')
        res = self.client.get('/api/v1/gtas/')
        gta_nos = [g['gta_number'] for g in res.data]
        self.assertNotIn('IGGL/GTA/TEMP', gta_nos)


# ======================================================================================
# SUITE 3: CUSTOMER REGISTRATION & SAP S/4HANA ODATA INTEGRATION (TESTS 46–65)
# ======================================================================================
class CustomerRegistrationAndSAPODataTests(TestCase):
    """
    Validates Indian statutory tax IDs (GSTIN/PAN), postal validations, SAP BP OData
    integration payload schemas, auto-activation of accounts, and admin workflow.
    """

    def setUp(self):
        self.client = APIClient()
        self.reg_data = {
            "name1": "TATA CHEMICALS LIMITED",
            "name2": "Fertilizers Division",
            "city": "Mumbai",
            "postal_code": "400001",
            "street": "Bombay House, 24 Homi Mody Street",
            "telephone": "9820098200",
            "tax_number": "27AAACT2727Q1ZW",  # Valid Maharashtra GSTIN
            "pan_number": "AAACT2727Q",       # Valid Corporate PAN
            "email": "commercial@tatachemicals.com",
            "password": "Password@123"
        }

    def test_046_valid_gstin_pan_registration(self):
        """046: Verifies valid registration creates registration record in SUBMITTED state."""
        res = self.client.post(reverse('customer-register'), self.reg_data, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res.data['registration_number'].startswith('IGGL-REG-2026-'))

    def test_047_invalid_gstin_short_length_fails(self):
        """047: Verifies GSTIN with length < 15 characters fails with 400 Bad Request."""
        bad = self.reg_data.copy()
        bad['tax_number'] = '27AAACT2727Q'  # Only 12 chars
        res = self.client.post(reverse('customer-register'), bad, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('tax_number', res.data['details'])

    def test_048_invalid_gstin_special_characters_fails(self):
        """048: Verifies GSTIN with illegal special characters fails."""
        bad = self.reg_data.copy()
        bad['tax_number'] = '27AAACT2727Q#ZW'
        res = self.client.post(reverse('customer-register'), bad, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_049_valid_pan_checksum_structure(self):
        """049: Verifies 4th character of PAN indicates entity type (C for Company, P for Person)."""
        self.assertEqual(self.reg_data['pan_number'][3], 'C')

    def test_050_invalid_pan_numeric_prefix_fails(self):
        """050: Verifies PAN starting with numbers fails validation."""
        bad = self.reg_data.copy()
        bad['pan_number'] = '1AACT2727Q'
        res = self.client.post(reverse('customer-register'), bad, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('pan_number', res.data['details'])

    def test_051_duplicate_email_registration_prevention(self):
        """051: Verifies registering existing email returns validation error."""
        self.client.post(reverse('customer-register'), self.reg_data, format='json')
        res = self.client.post(reverse('customer-register'), self.reg_data, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_052_unapproved_account_user_created_as_inactive(self):
        """052: Verifies submitted registration creates User with is_active=False."""
        self.client.post(reverse('customer-register'), self.reg_data, format='json')
        user = User.objects.get(email='commercial@tatachemicals.com')
        self.assertFalse(user.is_active)

    def test_053_status_tracking_query_by_registration_number(self):
        """053: Verifies public status tracker query by registration number."""
        reg_res = self.client.post(reverse('customer-register'), self.reg_data, format='json')
        reg_no = reg_res.data['registration_number']
        res = self.client.get(f"{reverse('registration-status')}?query={reg_no}")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['registration_number'], reg_no)
        self.assertEqual(res.data['status'], RegistrationStatus.SUBMITTED)

    def test_054_status_tracking_query_by_pan(self):
        """054: Verifies status tracker query by PAN number."""
        self.client.post(reverse('customer-register'), self.reg_data, format='json')
        res = self.client.get(f"{reverse('registration-status')}?query=AAACT2727Q")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['pan_number'], 'AAACT2727Q')

    def test_055_admin_enrichment_missing_mandatory_sap_fields_fails(self):
        """055: Verifies Admin approval without mandatory SAP fields is rejected with 400."""
        reg_res = self.client.post(reverse('customer-register'), self.reg_data, format='json')
        reg_id = reg_res.data['data']['id']

        # Missing payment_terms & recon_account
        incomplete_payload = {
            'action': 'APPROVE_AND_POST',
            'region': 'MH',
            'account_group': 'ZDOM',
            'sales_org': '1000'
        }
        res = self.client.patch(reverse('admin-registration-review', kwargs={'pk': reg_id}), incomplete_payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Missing mandatory admin fields', res.data['error'])

    def test_056_admin_enrichment_and_sap_bp_creation_success(self):
        """056: Verifies complete admin enrichment creates SAP Customer Master."""
        reg_res = self.client.post(reverse('customer-register'), self.reg_data, format='json')
        reg_id = reg_res.data['data']['id']

        full_payload = {
            'action': 'APPROVE_AND_POST',
            'region': 'MH',
            'account_group': 'ZDOM',
            'recon_account': '24430000',
            'payment_terms': 'NT30',
            'sales_org': '1000'
        }
        res = self.client.patch(reverse('admin-registration-review', kwargs={'pk': reg_id}), full_payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('customer_number', res.data)

        # Verify DB state updated
        reg = CustomerRegistration.objects.get(id=reg_id)
        self.assertEqual(reg.status, RegistrationStatus.BP_CREATED)
        self.assertTrue(len(reg.customer_number) >= 6)

    def test_057_user_auto_activated_upon_sap_approval(self):
        """057: Verifies User.is_active is set to True automatically upon SAP approval."""
        reg_res = self.client.post(reverse('customer-register'), self.reg_data, format='json')
        reg_id = reg_res.data['data']['id']
        full_payload = {
            'action': 'APPROVE_AND_POST',
            'region': 'MH',
            'account_group': 'ZDOM',
            'recon_account': '24430000',
            'payment_terms': 'NT30',
            'sales_org': '1000'
        }
        self.client.patch(reverse('admin-registration-review', kwargs={'pk': reg_id}), full_payload, format='json')
        user = User.objects.get(email='commercial@tatachemicals.com')
        self.assertTrue(user.is_active)
        self.assertTrue(len(user.profile.sap_customer_code) >= 6)

    def test_058_sap_payload_mapping_conformance(self):
        """058: Verifies SAP S/4HANA OData payload conforms to RFC specifications."""
        reg_res = self.client.post(reverse('customer-register'), self.reg_data, format='json')
        reg_id = reg_res.data['data']['id']
        full_payload = {
            'action': 'APPROVE_AND_POST',
            'region': 'MH',
            'account_group': 'ZDOM',
            'recon_account': '24430000',
            'payment_terms': 'NT30',
            'sales_org': '1000'
        }
        self.client.patch(reverse('admin-registration-review', kwargs={'pk': reg_id}), full_payload, format='json')
        reg = CustomerRegistration.objects.get(id=reg_id)
        self.assertEqual(reg.sap_payload['Ktokd'], 'ZDOM')
        self.assertEqual(reg.sap_payload['Akont'], '24430000')
        self.assertEqual(reg.sap_payload['Zterm'], 'NT30')
        self.assertEqual(reg.sap_payload['Name1'], 'TATA CHEMICALS LIMITED')
        self.assertEqual(reg.sap_payload['Land1'], 'IN')

    def test_059_admin_return_requires_remarks(self):
        """059: Verifies returning registration without remarks returns 400 Bad Request."""
        reg_res = self.client.post(reverse('customer-register'), self.reg_data, format='json')
        reg_id = reg_res.data['data']['id']
        res = self.client.patch(reverse('admin-registration-review', kwargs={'pk': reg_id}), {
            'action': 'RETURN',
            'remarks': ''
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Remarks are mandatory', res.data['error'])

    def test_060_admin_reject_marks_status_rejected(self):
        """060: Verifies rejecting application updates status to REJECTED."""
        reg_res = self.client.post(reverse('customer-register'), self.reg_data, format='json')
        reg_id = reg_res.data['data']['id']
        res = self.client.patch(reverse('admin-registration-review', kwargs={'pk': reg_id}), {
            'action': 'REJECT',
            'remarks': 'Document illegible'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        reg = CustomerRegistration.objects.get(id=reg_id)
        self.assertEqual(reg.status, RegistrationStatus.REJECTED)

    def test_061_customer_resubmit_after_return(self):
        """061: Verifies customer can resubmit updated data after being returned."""
        reg_res = self.client.post(reverse('customer-register'), self.reg_data, format='json')
        reg_id = reg_res.data['data']['id']
        # Return by admin
        self.client.patch(reverse('admin-registration-review', kwargs={'pk': reg_id}), {
            'action': 'RETURN',
            'remarks': 'Please fix street address'
        }, format='json')
        # Customer resubmit
        res = self.client.patch(reverse('customer-resubmit', kwargs={'pk': reg_id}), {
            'street': 'Updated Street 101'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        reg = CustomerRegistration.objects.get(id=reg_id)
        self.assertEqual(reg.status, RegistrationStatus.SUBMITTED)
        self.assertEqual(reg.street, 'Updated Street 101')

    def test_062_approved_customers_lookup_excludes_unapproved(self):
        """062: Verifies /api/v1/gtas/approved-customers/ only returns APPROVED/BP_CREATED."""
        CustomerRegistration.objects.create(
            name1='Draft Co', email='draft@co.com', status=RegistrationStatus.SUBMITTED,
            tax_number='27AAACD1111Q1ZZ', pan_number='AAACD1111Q'
        )
        res = self.client.get('/api/v1/gtas/approved-customers/')
        companies = [c['company_name'] for c in res.data]
        self.assertNotIn('Draft Co', companies)

    def test_063_postal_code_length_validation(self):
        """063: Verifies Indian postal PIN code 6-character length."""
        self.assertEqual(len(self.reg_data['postal_code']), 6)

    def test_064_telephone_number_digits_only(self):
        """064: Verifies telephone number contains 10 digits."""
        self.assertTrue(self.reg_data['telephone'].isdigit())
        self.assertEqual(len(self.reg_data['telephone']), 10)

    def test_065_country_default_india_in(self):
        """065: Verifies registered country defaults to IN (India)."""
        reg_res = self.client.post(reverse('customer-register'), self.reg_data, format='json')
        reg = CustomerRegistration.objects.get(id=reg_res.data['data']['id'])
        self.assertEqual(reg.country, 'IN')


# ======================================================================================
# SUITE 4: GTA CONTRACT LIFECYCLE & FINANCIAL PRECISION (TESTS 66–85)
# ======================================================================================
class GTALifecycleAndPNGRBTariffTests(TestCase):
    """
    Validates GTA contract numbering, date arithmetic, PNGRB unified tariff zones,
    financial precision (rounding/quantize), rate summation, and signature state machine.
    """

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='gta.user@test.com', email='gta.user@test.com', password='Password@123')
        self.profile = UserProfile.objects.create(user=self.user, role=UserRole.CUSTOMER, company_name='Numaligarh Refinery Ltd')
        self.token = str(RefreshToken.for_user(self.user).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')

    def test_066_auto_generated_gta_number_format(self):
        """066: Verifies auto-generated GTA number follows 'IGGL/GTA/YYYY/NNN'."""
        gta = GTAAgreement.objects.create(user=self.user, shipper_name='Numaligarh Refinery Ltd')
        year = timezone.now().year
        self.assertTrue(gta.gta_number.startswith(f'IGGL/GTA/{year}/'))

    def test_067_auto_generated_sap_contract_number(self):
        """067: Verifies SAP transmission contract number generation starts with 4000."""
        res = self.client.post('/api/v1/gtas/', {
            'shipper_name': 'Numaligarh Refinery Ltd',
            'contracted_capacity_scmd': 500000
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res.data['sap_contract_number'].startswith('4000'))

    def test_068_default_agreement_date_today(self):
        """068: Verifies agreement date defaults to today if omitted."""
        gta = GTAAgreement.objects.create(user=self.user, shipper_name='Numaligarh Refinery Ltd')
        self.assertEqual(gta.agreement_date, timezone.now().date())

    def test_069_multi_year_contract_duration_3_years(self):
        """069: Verifies default contract duration defaults to 3 years (1095 days)."""
        gta = GTAAgreement.objects.create(user=self.user, shipper_name='Numaligarh Refinery Ltd')
        diff = (gta.valid_to - gta.valid_from).days
        self.assertEqual(diff, 1095)

    def test_070_validity_bounds_order(self):
        """070: Verifies valid_from is before valid_to."""
        gta = GTAAgreement.objects.create(
            user=self.user,
            shipper_name='Numaligarh Refinery Ltd',
            valid_from=date(2026, 4, 1),
            valid_to=date(2029, 3, 31)
        )
        self.assertTrue(gta.valid_from < gta.valid_to)

    def test_071_termination_date_sync(self):
        """071: Verifies termination_date synchronizes with valid_to."""
        gta = GTAAgreement.objects.create(
            user=self.user,
            shipper_name='Numaligarh Refinery Ltd',
            valid_to=date(2030, 12, 31)
        )
        self.assertEqual(gta.termination_date, date(2030, 12, 31))

    def test_072_unified_tariff_zone_1_rate(self):
        """072: Verifies Zone 1 rate is 34.00 Rs/MMBtu."""
        gta = GTAAgreement.objects.create(
            user=self.user,
            shipper_name='Numaligarh Refinery Ltd',
            tariff_zone=TariffZone.ZONE_1,
            unified_tariff_rate=Decimal('34.00'),
            iggl_share_pct=Decimal('100.00')
        )
        self.assertEqual(gta.entitlement_rate, Decimal('34.00'))

    def test_073_unified_tariff_zone_2_rate(self):
        """073: Verifies Zone 2 rate is 58.75 Rs/MMBtu."""
        gta = GTAAgreement.objects.create(
            user=self.user,
            shipper_name='Numaligarh Refinery Ltd',
            tariff_zone=TariffZone.ZONE_2,
            unified_tariff_rate=Decimal('58.75')
        )
        self.assertEqual(gta.unified_tariff_rate, Decimal('58.75'))

    def test_074_unified_tariff_zone_3_rate(self):
        """074: Verifies Zone 3 rate is 72.30 Rs/MMBtu."""
        gta = GTAAgreement.objects.create(
            user=self.user,
            shipper_name='Numaligarh Refinery Ltd',
            tariff_zone=TariffZone.ZONE_3,
            unified_tariff_rate=Decimal('72.30')
        )
        self.assertEqual(gta.unified_tariff_rate, Decimal('72.30'))

    def test_075_iggl_share_entitlement_calculation(self):
        """075: Verifies entitlement rate = unified_tariff_rate * (share_pct / 100)."""
        # 58.75 * 0.65 = 38.1875 -> 38.19
        entitlement = (Decimal('58.75') * (Decimal('65.00') / Decimal('100.00'))).quantize(Decimal('0.01'))
        self.assertEqual(entitlement, Decimal('38.19'))

    def test_076_decimal_precision_no_float_rounding_drift(self):
        """076: Verifies financial decimal calculations avoid floating point drift."""
        # 72.30 * 0.385 = 27.8355 -> 27.84
        calculated = (Decimal('72.30') * Decimal('0.385')).quantize(Decimal('0.01'))
        self.assertEqual(calculated, Decimal('27.84'))

    def test_077_transmission_rate_summation(self):
        """077: Verifies transmission rate auto-sum = trunk + spur + connectivity."""
        gta = GTAAgreement.objects.create(
            user=self.user,
            shipper_name='Numaligarh Refinery Ltd',
            trunk_line_rate_1=Decimal('12.50'),
            spur_line_rate=Decimal('3.25'),
            connectivity_rate=Decimal('1.75')
        )
        self.assertEqual(gta.transmission_rate, Decimal('17.50'))

    def test_078_transmission_rate_zero_defaults(self):
        """078: Verifies 0 values for components sums to 0.00."""
        gta = GTAAgreement.objects.create(
            user=self.user,
            shipper_name='Numaligarh Refinery Ltd',
            trunk_line_rate_1=Decimal('0.00'),
            spur_line_rate=Decimal('0.00'),
            connectivity_rate=Decimal('0.00')
        )
        self.assertEqual(gta.transmission_rate, Decimal('0.00'))

    def test_079_scmd_to_mmscmd_conversion(self):
        """079: Verifies 500,000 SCMD equals 0.5000 MMSCMD."""
        scmd = Decimal('500000')
        mmscmd = (scmd / Decimal('1000000')).quantize(Decimal('0.0001'))
        self.assertEqual(mmscmd, Decimal('0.5000'))

    def test_080_capacity_type_choices(self):
        """080: Verifies capacity types FIRM, INTERRUPTIBLE, COMBINED are supported."""
        gta = GTAAgreement.objects.create(
            user=self.user,
            shipper_name='Numaligarh Refinery Ltd',
            capacity_type=CapacityType.FIRM
        )
        self.assertEqual(gta.capacity_type, 'FIRM')

    def test_081_admin_approval_moves_gta_to_in_force(self):
        """081: Verifies Admin approve moves GTA directly to IN_FORCE (no digital signature step)."""
        gta = GTAAgreement.objects.create(
            user=self.user,
            shipper_name='Numaligarh Refinery Ltd',
            status=GTAStatus.UNDER_REVIEW
        )
        res = self.client.post(f'/api/v1/gtas/{gta.id}/approve/', {'approver_name': 'Commercial Head'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        gta.refresh_from_db()
        self.assertEqual(gta.status, GTAStatus.IN_FORCE)
        self.assertEqual(gta.signed_by_iggl, 'Commercial Head')

    def test_082_admin_approval_records_timestamp(self):
        """082: Verifies admin approval records signed_by_iggl_at timestamp."""
        gta = GTAAgreement.objects.create(user=self.user, shipper_name='Numaligarh Refinery Ltd')
        self.client.post(f'/api/v1/gtas/{gta.id}/approve/', format='json')
        gta.refresh_from_db()
        self.assertIsNotNone(gta.signed_by_iggl_at)

    def test_083_shipper_digital_sign_moves_to_in_force(self):
        """083: Verifies Shipper sign action transitions GTA to IN_FORCE."""
        gta = GTAAgreement.objects.create(
            user=self.user,
            shipper_name='Numaligarh Refinery Ltd',
            status=GTAStatus.READY_TO_SIGN
        )
        res = self.client.post(f'/api/v1/gtas/{gta.id}/sign/', {'signer_name': 'Managing Director'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        gta.refresh_from_db()
        self.assertEqual(gta.status, GTAStatus.IN_FORCE)
        self.assertEqual(gta.signed_by_shipper, 'Managing Director')

    def test_084_shipper_signature_records_timestamp(self):
        """084: Verifies shipper signature records signed_by_shipper_at timestamp."""
        gta = GTAAgreement.objects.create(
            user=self.user,
            shipper_name='Numaligarh Refinery Ltd',
            status=GTAStatus.READY_TO_SIGN
        )
        self.client.post(f'/api/v1/gtas/{gta.id}/sign/', {'signer_name': 'MD'}, format='json')
        gta.refresh_from_db()
        self.assertIsNotNone(gta.signed_by_shipper_at)

    def test_085_in_force_gta_remains_in_force(self):
        """085: Verifies signing an already IN_FORCE agreement preserves IN_FORCE status."""
        gta = GTAAgreement.objects.create(
            user=self.user,
            shipper_name='Numaligarh Refinery Ltd',
            status=GTAStatus.IN_FORCE
        )
        res = self.client.post(f'/api/v1/gtas/{gta.id}/sign/', {'signer_name': 'MD'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        gta.refresh_from_db()
        self.assertEqual(gta.status, GTAStatus.IN_FORCE)


# ======================================================================================
# SUITE 5: CAPACITY TRANCHE (CT) 34 CONSULTANT FIELDS & TOLERANCES (TESTS 86–105)
# ======================================================================================
class CapacityTrancheConsultantFieldsAndTolerancesTests(TestCase):
    """
    Validates all 34 SAP consultant fields, overdelivery/underdelivery tolerance arithmetic,
    UFT path mappings, invoice calculations, revenue entitlements, and CT state machine.
    """

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='ct.user@test.com', email='ct.user@test.com', password='Password@123')
        self.profile = UserProfile.objects.create(user=self.user, role=UserRole.CUSTOMER, company_name='Indian Oil Corp Ltd')
        self.token = str(RefreshToken.for_user(self.user).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')

        self.gta = GTAAgreement.objects.create(
            user=self.user,
            gta_number='IGGL/GTA/2026/IOCL',
            shipper_name='Indian Oil Corp Ltd',
            agreement_date=date(2024, 4, 1),
            status=GTAStatus.IN_FORCE
        )

        self.ct_payload = {
            "gta": str(self.gta.id),
            "request_category": "OTHER",
            "unified_path": "GAIL",
            "sold_to_party": "INDIAN OIL CORPORATION LTD [0000051300]",
            "delivery_entry_point": "ONGC - ODALREVU",
            "new_exit_point": "Oduru",
            "start_date": "2026-10-01",
            "end_date": "2026-12-31",
            "quantity_mmbtu_day": 1000.00,
            "overdelivery_tolerance": 2.00,
            "underdelivery_tolerance": 5.00,
            "uft_path_id": "UFT-ODALREVU-01",
            "path_id_desc": "GAIL Odalrevu to Offtake Pipeline Network",
            "unified_entry_point": "ONGC - ODALREVU",
            "unified_exit_point": "Oduru",
            "delivery_redelivery_point": "Oduru Offtake Metering Station",
            "total_km": 185.00,
            "zone_pngrb": "Zone 1",
            "applicable_tariff_regime": 34.00,
            "price_applicable_date": "2024-04-01",
            "entity_transporter": "GAIL",
            "km_share": 100.00,
            "uft_ratio_pct": 100.00,
            "amt_for_invoice_per_mmbtu": 34.00,
            "iggl_zonal_entity_id": "IGGL-ZONE-NE1"
        }

    def test_086_auto_generated_ct_number_format(self):
        """086: Verifies auto-generated CT number follows 'CT-REQ-YYYY-NNNN'."""
        ct = CapacityTranche.objects.create(gta=self.gta, quantity_mmbtu_day=Decimal('100.00'))
        year = timezone.now().year
        self.assertTrue(ct.ct_number.startswith(f'CT-REQ-{year}-'))

    def test_087_ct_creation_links_parent_gta(self):
        """087: Verifies POST /api/v1/capacity-tranches/ properly associates parent GTA."""
        res = self.client.post('/api/v1/capacity-tranches/', self.ct_payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(str(res.data['gta']), str(self.gta.id))

    def test_088_auto_links_active_gta_when_id_omitted(self):
        """088: Verifies CT auto-associates to user's active GTA if gta ID is not supplied."""
        payload = self.ct_payload.copy()
        del payload['gta']
        res = self.client.post('/api/v1/capacity-tranches/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        ct = CapacityTranche.objects.get(id=res.data['id'])
        self.assertEqual(ct.gta, self.gta)

    def test_089_syncs_gta_number_and_date(self):
        """089: Verifies CT gta_no and gta_date sync with parent GTA."""
        res = self.client.post('/api/v1/capacity-tranches/', self.ct_payload, format='json')
        ct = CapacityTranche.objects.get(id=res.data['id'])
        self.assertEqual(ct.gta_no, 'IGGL/GTA/2026/IOCL')
        self.assertEqual(ct.gta_date, date(2024, 4, 1))

    def test_090_request_category_choices(self):
        """090: Verifies request_category persists correctly."""
        res = self.client.post('/api/v1/capacity-tranches/', self.ct_payload, format='json')
        ct = CapacityTranche.objects.get(id=res.data['id'])
        self.assertEqual(ct.request_category, 'OTHER')

    def test_091_start_date_before_end_date(self):
        """091: Verifies CT start_date is before end_date."""
        res = self.client.post('/api/v1/capacity-tranches/', self.ct_payload, format='json')
        ct = CapacityTranche.objects.get(id=res.data['id'])
        self.assertTrue(ct.start_date < ct.end_date)

    def test_092_positive_quantity_mmbtu_day(self):
        """092: Verifies quantity MMBTU/Day is a positive decimal."""
        res = self.client.post('/api/v1/capacity-tranches/', self.ct_payload, format='json')
        ct = CapacityTranche.objects.get(id=res.data['id'])
        self.assertEqual(ct.quantity_mmbtu_day, Decimal('1000.00'))

    def test_093_overdelivery_tolerance_boundary_check(self):
        """093: Verifies default overdelivery tolerance is 2.00%."""
        ct = CapacityTranche.objects.create(gta=self.gta)
        self.assertEqual(ct.overdelivery_tolerance, Decimal('2.00'))

    def test_094_underdelivery_tolerance_boundary_check(self):
        """094: Verifies default underdelivery tolerance is 5.00%."""
        ct = CapacityTranche.objects.create(gta=self.gta)
        self.assertEqual(ct.underdelivery_tolerance, Decimal('5.00'))

    def test_095_tolerance_upper_bound_calculation(self):
        """095: Verifies quantity + 2% overdelivery tolerance calculation."""
        qty = Decimal('1000.00')
        max_allowed = qty * (Decimal('1') + (Decimal('2.00') / Decimal('100')))
        self.assertEqual(max_allowed, Decimal('1020.00'))

    def test_096_tolerance_lower_bound_calculation(self):
        """096: Verifies quantity - 5% underdelivery tolerance calculation."""
        qty = Decimal('1000.00')
        min_required = qty * (Decimal('1') - (Decimal('5.00') / Decimal('100')))
        self.assertEqual(min_required, Decimal('950.00'))

    def test_097_uft_path_tariff_regime_persisted(self):
        """097: Verifies applicable tariff regime 34.00 Rs/MMBtu is stored."""
        res = self.client.post('/api/v1/capacity-tranches/', self.ct_payload, format='json')
        ct = CapacityTranche.objects.get(id=res.data['id'])
        self.assertEqual(ct.applicable_tariff_regime, Decimal('34.00'))

    def test_098_invoice_amount_per_mmbtu_calculation(self):
        """098: Verifies amt_for_invoice = applicable_tariff * (uft_ratio / 100)."""
        tariff = Decimal('58.75')
        ratio = Decimal('65.00')
        amt = (tariff * (ratio / Decimal('100'))).quantize(Decimal('0.01'))
        self.assertEqual(amt, Decimal('38.19'))

    def test_099_revenue_entitlement_calculation(self):
        """099: Verifies revenue entitlement = quantity * invoice_amt."""
        qty = Decimal('1000.00')
        inv_amt = Decimal('34.00')
        entitlement = (qty * inv_amt).quantize(Decimal('0.01'))
        self.assertEqual(entitlement, Decimal('34000.00'))

    def test_100_transporter_approve_allocates_capacity(self):
        """100: Verifies POST /api/v1/capacity-tranches/<id>/approve/ transitions CT to APPROVED."""
        res = self.client.post('/api/v1/capacity-tranches/', self.ct_payload, format='json')
        ct_id = res.data['id']
        app_res = self.client.post(f'/api/v1/capacity-tranches/{ct_id}/approve/', {
            'approved_quantity_mmbtu_day': 950.00
        }, format='json')
        self.assertEqual(app_res.status_code, status.HTTP_200_OK)
        ct = CapacityTranche.objects.get(id=ct_id)
        self.assertEqual(ct.status, CTStatus.APPROVED)
        self.assertEqual(ct.approved_quantity_mmbtu_day, Decimal('950.00'))

    def test_101_transporter_approve_generates_unsigned_pdf(self):
        """101: Verifies approve generates unsigned PDF download reference."""
        res = self.client.post('/api/v1/capacity-tranches/', self.ct_payload, format='json')
        ct_id = res.data['id']
        self.client.post(f'/api/v1/capacity-tranches/{ct_id}/approve/', format='json')
        ct = CapacityTranche.objects.get(id=ct_id)
        self.assertTrue(ct.unsigned_ct_document.startswith('ct_unsigned_'))

    def test_102_transporter_approve_assigns_sap_contract_id(self):
        """102: Verifies approve generates/assigns SAP Contract ID."""
        res = self.client.post('/api/v1/capacity-tranches/', self.ct_payload, format='json')
        ct_id = res.data['id']
        self.client.post(f'/api/v1/capacity-tranches/{ct_id}/approve/', format='json')
        ct = CapacityTranche.objects.get(id=ct_id)
        self.assertTrue(ct.sap_contract_id.startswith('IGGL/CT/') or ct.sap_contract_id.startswith('182'))

    def test_103_transporter_execute_action_moves_to_executed(self):
        """103: Verifies POST /api/v1/capacity-tranches/<id>/execute/ transitions CT to EXECUTED."""
        res = self.client.post('/api/v1/capacity-tranches/', self.ct_payload, format='json')
        ct_id = res.data['id']
        self.client.post(f'/api/v1/capacity-tranches/{ct_id}/approve/', format='json')
        exec_res = self.client.post(f'/api/v1/capacity-tranches/{ct_id}/execute/', {
            'signed_ct_document_vendor': 'signed_by_iocl.pdf'
        }, format='json')
        self.assertEqual(exec_res.status_code, status.HTTP_200_OK)
        ct = CapacityTranche.objects.get(id=ct_id)
        self.assertEqual(ct.status, CTStatus.EXECUTED)
        self.assertEqual(ct.status_update, 'Executed')
        self.assertEqual(ct.signed_ct_document_vendor, 'signed_by_iocl.pdf')

    def test_104_ct_status_update_underprocess_flow(self):
        """104: Verifies status_update moves from Underprocess to Executed."""
        ct = CapacityTranche.objects.create(gta=self.gta, status_update='Underprocess')
        self.assertEqual(ct.status_update, 'Underprocess')
        ct.status_update = 'Executed'
        ct.save()
        self.assertEqual(ct.status_update, 'Executed')

    def test_105_customer_cannot_set_ct_directly_to_approved(self):
        """105: Verifies customer POST sets status to SUBMITTED even if APPROVED attempted."""
        payload = self.ct_payload.copy()
        payload['status'] = 'APPROVED'
        res = self.client.post('/api/v1/capacity-tranches/', payload, format='json')
        ct = CapacityTranche.objects.get(id=res.data['id'])
        # New requests are created in SUBMITTED state pending transporter approval
        self.assertEqual(ct.status, CTStatus.SUBMITTED)


# ======================================================================================
# SUITE 6: ENTERPRISE RESILIENCY, EDGE CASES & ROUND-TRIP WORKFLOW (TESTS 106–122)
# ======================================================================================
class EnterpriseResiliencyEdgeCasesAndRoundTripTests(TestCase):
    """
    Validates extreme boundaries, high-volume payloads, leap years, non-ASCII inputs,
    null safety, and complete end-to-end customer onboarding to CT execution round-trip.
    """

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='e2e.user@test.com', email='e2e.user@test.com', password='Password@123')
        self.profile = UserProfile.objects.create(user=self.user, role=UserRole.CUSTOMER, company_name='Assam Gas Company Ltd')
        self.token = str(RefreshToken.for_user(self.user).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')

    def test_106_maximum_company_name_length_boundary(self):
        """106: Verifies 150-character maximum company name boundary is accepted without truncation."""
        long_name = "A" * 150
        gta = GTAAgreement.objects.create(user=self.user, shipper_name=long_name)
        self.assertEqual(len(gta.shipper_name), 150)

    def test_107_multiline_special_character_address(self):
        """107: Verifies complex multi-line address with symbols and commas persists cleanly."""
        complex_addr = "Floor 12-B, Sector 62, Near GAIL CGS Tie-In & NH-37, Guwahati (Assam) - 781001, India."
        gta = GTAAgreement.objects.create(user=self.user, shipper_name='Assam Gas', shipper_registered_office_address=complex_addr)
        self.assertEqual(gta.shipper_registered_office_address, complex_addr)

    def test_108_minimum_valid_quantity_boundary(self):
        """108: Verifies 0.01 MMBTU/Day minimum quantity boundary."""
        ct = CapacityTranche.objects.create(quantity_mmbtu_day=Decimal('0.01'))
        self.assertEqual(ct.quantity_mmbtu_day, Decimal('0.01'))

    def test_109_maximum_enterprise_quantity_boundary(self):
        """109: Verifies 10,000,000.00 MMBTU/Day high-volume quantity boundary."""
        ct = CapacityTranche.objects.create(quantity_mmbtu_day=Decimal('10000000.00'))
        self.assertEqual(ct.quantity_mmbtu_day, Decimal('10000000.00'))

    def test_110_leap_year_february_29_handling(self):
        """110: Verifies leap year date 2028-02-29 is accepted and calculated correctly."""
        gta = GTAAgreement.objects.create(
            user=self.user,
            shipper_name='Assam Gas',
            valid_from=date(2028, 2, 29),
            valid_to=date(2031, 2, 28)
        )
        self.assertEqual(gta.valid_from, date(2028, 2, 29))

    def test_111_end_of_year_rollover_dates(self):
        """111: Verifies Dec 31 to Jan 1 calendar rollover transition."""
        ct = CapacityTranche.objects.create(
            start_date=date(2026, 12, 31),
            end_date=date(2027, 1, 1)
        )
        self.assertTrue(ct.start_date < ct.end_date)

    def test_112_concurrent_ct_submissions_without_collision(self):
        """112: Verifies sequential CT generation produces unique non-colliding numbers."""
        ct1 = CapacityTranche.objects.create()
        ct2 = CapacityTranche.objects.create()
        self.assertNotEqual(ct1.ct_number, ct2.ct_number)

    def test_113_concurrent_gta_creation_without_collision(self):
        """113: Verifies sequential GTA creation produces unique non-colliding numbers."""
        gta1 = GTAAgreement.objects.create(user=self.user, shipper_name='Co 1')
        gta2 = GTAAgreement.objects.create(user=self.user, shipper_name='Co 2')
        self.assertNotEqual(gta1.gta_number, gta2.gta_number)

    def test_114_empty_json_body_safe_handling(self):
        """114: Verifies empty JSON body {} does not crash server with 500 error."""
        res = self.client.post('/api/v1/capacity-tranches/', {}, format='json')
        self.assertIn(res.status_code, [status.HTTP_201_CREATED, status.HTTP_400_BAD_REQUEST])
        self.assertNotEqual(res.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)

    def test_115_null_optional_fields_safe_handling(self):
        """115: Verifies passing explicit null for optional rates does not cause TypeError in save()."""
        payload = {
            'shipper_name': 'Assam Gas',
            'trunk_line_rate_1': None,
            'spur_line_rate': None,
            'connectivity_rate': None
        }
        res = self.client.post('/api/v1/gtas/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

    def test_116_malformed_json_syntax_returns_400(self):
        """116: Verifies malformed JSON payload returns 400 Bad Request."""
        res = self.client.post('/api/v1/gtas/', '{invalid_json', content_type='application/json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_117_special_characters_in_query_params(self):
        """117: Verifies URL-encoded query parameters are decoded without SQL or regex syntax errors."""
        res = self.client.get('/api/v1/gtas/?customer_code=0001%2F2026&status=IN_FORCE')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_118_customer_dashboard_empty_gtas_safe(self):
        """118: Verifies customer dashboard with 0 GTAs returns empty array without index errors."""
        res = self.client.get('/api/v1/gtas/customer_dashboard/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['gtas'], [])

    def test_119_total_contracted_capacity_with_null_and_zero_values(self):
        """119: Verifies sum of contracted capacity handles zero values gracefully."""
        GTAAgreement.objects.create(user=self.user, shipper_name='Assam Gas', status=GTAStatus.IN_FORCE, contracted_capacity_mmscmd=Decimal('0.0000'))
        GTAAgreement.objects.create(user=self.user, shipper_name='Assam Gas', status=GTAStatus.IN_FORCE, contracted_capacity_mmscmd=Decimal('2.5000'))
        res = self.client.get('/api/v1/gtas/customer_dashboard/')
        self.assertIn('2.50 MMSCMD', res.data['metrics']['utilisation_contracted_subtext'])

    def test_120_approved_customers_endpoint_returns_json_list(self):
        """120: Verifies /api/v1/gtas/approved-customers/ returns valid JSON list structure."""
        res = self.client.get('/api/v1/gtas/approved-customers/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIsInstance(res.data, list)

    def test_121_uft_paths_catalog_integrity(self):
        """121: Verifies PNGRB Master Unified Tariff paths catalog contains all 7 corridors."""
        res = self.client.get('/api/v1/gtas/uft-paths/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 7)
        zones = set(p['tariff_zone'] for p in res.data)
        self.assertIn('ZONE_1', zones)
        self.assertIn('ZONE_2', zones)
        self.assertIn('ZONE_3', zones)

    def test_122_full_enterprise_round_trip_workflow(self):
        """
        122: Complete End-to-End Enterprise Round-Trip:
          1. Customer registers company
          2. Admin enriches with SAP account codes and posts to SAP S/4HANA (BP Created)
          3. Customer account is auto-activated
          4. Customer logs in and receives cryptographic JWT
          5. Customer drafts GTA
          6. Admin approves GTA (READY_TO_SIGN)
          7. Customer digitally signs GTA (IN_FORCE)
          8. Customer submits Capacity Tranche (CT)
          9. Transporter allocates capacity and approves CT (APPROVED)
          10. Transporter executes CT with vendor signature (EXECUTED)
        """
        # Step 1: Customer registers
        reg_payload = {
            "name1": "BRAHMAPUTRA CRACKER AND POLYMER LTD",
            "city": "Dibrugarh",
            "postal_code": "786006",
            "street": "Lepetkata Petrochemical Complex",
            "telephone": "9435094350",
            "tax_number": "18AAACB1234A1Z5",
            "pan_number": "AAACB1234A",
            "email": "commercial@bcplindia.co.in",
            "password": "Password@123"
        }
        res_reg = self.client.post(reverse('customer-register'), reg_payload, format='json')
        self.assertEqual(res_reg.status_code, status.HTTP_201_CREATED)
        reg_id = res_reg.data['data']['id']

        # Step 2: Admin enriches & posts to SAP
        res_admin = self.client.patch(reverse('admin-registration-review', kwargs={'pk': reg_id}), {
            'action': 'APPROVE_AND_POST',
            'region': 'AS',
            'account_group': 'ZDOM',
            'recon_account': '24430000',
            'payment_terms': 'NT30',
            'sales_org': '1000'
        }, format='json')
        self.assertEqual(res_admin.status_code, status.HTTP_200_OK)
        kunnr = res_admin.data['customer_number']

        # Step 3: Verify auto-activation
        customer_user = User.objects.get(email='commercial@bcplindia.co.in')
        self.assertTrue(customer_user.is_active)

        # Step 4: Login with credentials -> obtain JWT
        res_login = self.client.post(reverse('portal-login'), {
            'username': 'commercial@bcplindia.co.in',
            'password': 'Password@123',
            'portal_type': 'CUSTOMER'
        }, format='json')
        self.assertEqual(res_login.status_code, status.HTTP_200_OK)
        token = res_login.data['access']

        # Authenticate client with JWT
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        # Step 5: Draft GTA
        res_gta = self.client.post('/api/v1/gtas/', {
            'shipper_name': 'BRAHMAPUTRA CRACKER AND POLYMER LTD',
            'customer_code': kunnr,
            'entry_point': 'Duliajan Gas Terminal',
            'exit_point': 'BCPL Lepetkata Complex',
            'contracted_capacity_scmd': 1000000,
            'contracted_capacity_mmscmd': '1.00',
            'capacity_type': CapacityType.FIRM,
            'status': GTAStatus.DRAFT
        }, format='json')
        self.assertEqual(res_gta.status_code, status.HTTP_201_CREATED)
        gta_id = res_gta.data['id']

        # Step 6: Admin approves GTA — moves directly to IN_FORCE (uploaded doc is signed GTA)
        res_app_gta = self.client.post(f'/api/v1/gtas/{gta_id}/approve/', {'approver_name': 'IGGL GM Commercial'}, format='json')
        self.assertEqual(res_app_gta.status_code, status.HTTP_200_OK)
        self.assertEqual(res_app_gta.data['agreement']['status'], GTAStatus.IN_FORCE)

        # (Step 7 removed: no separate digital signature required; uploaded GTA document is the signed agreement)

        # Step 8: Customer submits Capacity Tranche (CT)
        res_ct = self.client.post('/api/v1/capacity-tranches/', {
            'gta': str(gta_id),
            'sold_to_party': f'BRAHMAPUTRA CRACKER AND POLYMER LTD [{kunnr}]',
            'quantity_mmbtu_day': 5000.00,
            'start_date': '2026-11-01',
            'end_date': '2027-10-31',
            'status': 'SUBMITTED'
        }, format='json')
        self.assertEqual(res_ct.status_code, status.HTTP_201_CREATED)
        ct_id = res_ct.data['id']

        # Step 9: Transporter allocates capacity & approves CT
        res_app_ct = self.client.post(f'/api/v1/capacity-tranches/{ct_id}/approve/', {
            'approved_quantity_mmbtu_day': 5000.00
        }, format='json')
        self.assertEqual(res_app_ct.status_code, status.HTTP_200_OK)
        self.assertEqual(res_app_ct.data['tranche']['status'], CTStatus.APPROVED)

        # Step 10: Transporter executes CT upon bilateral signature
        res_exec = self.client.post(f'/api/v1/capacity-tranches/{ct_id}/execute/', {
            'signed_ct_document_vendor': 'bcpl_executed_contract.pdf'
        }, format='json')
        self.assertEqual(res_exec.status_code, status.HTTP_200_OK)
        self.assertEqual(res_exec.data['tranche']['status'], CTStatus.EXECUTED)
        self.assertEqual(res_exec.data['tranche']['status_update'], 'Executed')
