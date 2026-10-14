from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from datetime import date
from decimal import Decimal
from gta.models import GTAAgreement, CapacityTranche, GTAStatus, CTStatus, TariffZone, CapacityType
from gta.serializers import CapacityTrancheSerializer

class GTATestCase(TestCase):
    def setUp(self):
        from django.contrib.auth.models import User
        from portal_auth.models import UserProfile, UserRole
        self.client = APIClient()
        self.user = User.objects.create_user(username='shipper_test', email='test@shipper.com', password='Password@123')
        self.profile = UserProfile.objects.create(user=self.user, role=UserRole.CUSTOMER, company_name="Test Shipper Industries")
        self.client.force_authenticate(user=self.user)

        self.gta = GTAAgreement.objects.create(
            user=self.user,
            gta_number="GTA-2024-TEST",
            shipper_name="Test Shipper Industries",
            entry_point="Vijaipur",
            exit_point="Delhi NCR",
            contracted_capacity_scmd=500000,
            contracted_capacity_mmscmd=0.5000,
            capacity_type=CapacityType.FIRM,
            valid_from=date(2024, 4, 1),
            valid_to=date(2027, 3, 31),
            tariff_zone=TariffZone.ZONE_1,
            unified_tariff_rate=45.50,
            status=GTAStatus.READY_TO_SIGN
        )

    def test_customer_dashboard_api(self):
        response = self.client.get('/api/v1/gtas/customer_dashboard/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('metrics', response.data)
        self.assertIn('action_required', response.data)
        self.assertIn('monthly_utilisation', response.data)

    def test_admin_dashboard_api(self):
        response = self.client.get('/api/v1/gtas/admin_dashboard/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('metrics', response.data)
        self.assertIn('registration_funnel', response.data)
        self.assertIn('capacity_utilisation', response.data)

    def test_gta_sign_action(self):
        response = self.client.post(f'/api/v1/gtas/{self.gta.id}/sign/', {'signer_name': 'Test Director'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.gta.refresh_from_db()
        self.assertEqual(self.gta.status, GTAStatus.IN_FORCE)
        self.assertEqual(self.gta.signed_by_shipper, 'Test Director')

    def test_create_gta_with_reference_and_document(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        test_file = SimpleUploadedFile("sample_gta.pdf", b"%PDF-1.4 sample gta content", content_type="application/pdf")
        data = {
            'shipper_name': 'Test Shipper Industries',
            'reference_number': 'IGGL/REF/2026/042',
            'agreement_date': '2026-10-01',
            'shipper_entity_type': 'Private Limited Company',
            'governing_statute_and_year': 'Companies Act, 2013',
            'shipper_registered_office_address': 'Guwahati, Assam',
            'gta_document': test_file,
            'status': GTAStatus.UNDER_REVIEW
        }
        response = self.client.post('/api/v1/gtas/', data, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['reference_number'], 'IGGL/REF/2026/042')
        self.assertEqual(response.data['gta_number'], 'IGGL/REF/2026/042')
        self.assertTrue(response.data['gta_document_url'].endswith('sample_gta.pdf') or 'sample_gta' in response.data['gta_document_url'])
        self.assertEqual(response.data['shipper_name'], 'Test Shipper Industries')

    def test_uft_path_sync_and_capacity_availability(self):
        from gta.models import UFTPath, CapacityTranche, CTStatus
        from decimal import Decimal
        # 1. Sync UFT paths from seed
        sync_resp = self.client.post('/api/v1/uft-paths/sync-odata/', {'force_seed': True}, format='json')
        self.assertEqual(sync_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(sync_resp.data['count'], 7)
        self.assertTrue(UFTPath.objects.filter(uft_id='01').exists())

        path = UFTPath.objects.get(uft_id='01')
        self.assertEqual(path.path_id_desc, 'GAIL-IGGL-Z3')
        self.assertEqual(path.unified_entry_point, 'DAHEJ')
        self.assertEqual(path.unified_exit_point, 'RT,NRL')
        self.assertEqual(path.applicable_tariff_regime, Decimal('106.77'))

        # 2. Update total capacity from Web API
        patch_resp = self.client.patch(f'/api/v1/uft-paths/{path.id}/', {'total_capacity_mmbtu_day': 80000.00}, format='json')
        self.assertEqual(patch_resp.status_code, status.HTTP_200_OK)
        path.refresh_from_db()
        self.assertEqual(path.total_capacity_mmbtu_day, Decimal('80000.00'))

        # 3. Check initial availability: full capacity available
        avail_resp = self.client.get(f'/api/v1/uft-paths/{path.id}/availability/?start_date=2026-10-01&end_date=2026-10-31&quantity=10000')
        self.assertEqual(avail_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(avail_resp.data['total_capacity_mmbtu_day'], 80000.0)
        self.assertEqual(avail_resp.data['peak_booked_capacity_mmbtu_day'], 0.0)
        self.assertEqual(avail_resp.data['available_capacity_mmbtu_day'], 80000.0)
        self.assertTrue(avail_resp.data['is_available'])

        # 4. Book capacity with a CapacityTranche
        CapacityTranche.objects.create(
            gta=self.gta,
            uft_path_id='UFT04',
            path_id_desc=path.path_id_desc,
            start_date=date(2026, 10, 5),
            end_date=date(2026, 10, 20),
            quantity_mmbtu_day=Decimal('60000.00'),
            status=CTStatus.APPROVED
        )

        # 5. Check updated availability during overlapping period:
        # Total = 80,000, Booked = 60,000, Available = 20,000
        avail_resp_2 = self.client.get(f'/api/v1/uft-paths/{path.id}/availability/?start_date=2026-10-01&end_date=2026-10-31&quantity=25000')
        self.assertEqual(avail_resp_2.status_code, status.HTTP_200_OK)
        self.assertEqual(avail_resp_2.data['peak_booked_capacity_mmbtu_day'], 60000.0)
        self.assertEqual(avail_resp_2.data['available_capacity_mmbtu_day'], 20000.0)
        # 25,000 requested exceeds 20,000 available:
        self.assertFalse(avail_resp_2.data['is_available'])
        self.assertEqual(avail_resp_2.data['overlapping_cts_count'], 1)

    def test_capacity_tranche_daily_quantities_and_total_volume(self):
        """Verify per-day capacity schedule updates total_volume_mmbtu and syncs rate."""
        daily_schedule = [
            {'date': '2026-11-01', 'quantity_mmbtu': 100.0},
            {'date': '2026-11-02', 'quantity_mmbtu': 200.0},
            {'date': '2026-11-03', 'quantity_mmbtu': 300.0},
        ]
        ct = CapacityTranche.objects.create(
            gta=self.gta,
            start_date=date(2026, 11, 1),
            end_date=date(2026, 11, 3),
            daily_quantities=daily_schedule,
            status=CTStatus.SUBMITTED
        )

        # Total volume should be 100 + 200 + 300 = 600 MMBTU
        self.assertEqual(ct.total_volume_mmbtu, 600.0)
        # Average daily quantity should be 600 / 3 = 200.00
        self.assertEqual(ct.quantity_mmbtu_day, Decimal('200.00'))

        # Serializer check
        serializer = CapacityTrancheSerializer(ct)
        self.assertEqual(serializer.data['total_volume_mmbtu'], 600.0)
        self.assertEqual(len(serializer.data['daily_quantities']), 3)



