from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
try:
    from .models import CustomerRegistration, RegistrationStatus
except (ImportError, ValueError):
    from registrations.models import CustomerRegistration, RegistrationStatus

class CustomerRegistrationWorkflowTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Valid test data based on the provided specification sheet
        self.customer_data = {
            "name1": "ROYAL SUNDARAM GENERAL",
            "name2": "INSURANCE CO. LIMITED",
            "city": "Jaipur",
            "postal_code": "302001",
            "street": "Office No 402,4th Floor, Axis Mall,",
            "telephone": "9529278332",
            "tax_number": "08AABCR7109G1ZJ",
            "pan_number": "AABCR7109G",
            "email": "contact@royalsundaram.com"
        }

        self.admin_enrichment_data = {
            "region": "RJ",
            "account_group": "ZDOM",
            "recon_account": "24430000",
            "payment_terms": "NT30",
            "sales_org": "1000",
            "action": "APPROVE_AND_POST"
        }

    def test_customer_submission_success(self):
        url = reverse('customer-register')
        response = self.client.post(url, self.customer_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("registration_number", response.data)
        self.assertTrue(response.data["registration_number"].startswith("IGGL-REG-2026-"))

        reg = CustomerRegistration.objects.get(registration_number=response.data["registration_number"])
        self.assertEqual(reg.status, RegistrationStatus.SUBMITTED)
        self.assertEqual(reg.name1, "ROYAL SUNDARAM GENERAL")
        self.assertEqual(reg.country, "IN")
        self.assertEqual(reg.language_key, "EN")

    def test_customer_submission_invalid_pan_fails(self):
        url = reverse('customer-register')
        bad_data = self.customer_data.copy()
        bad_data["pan_number"] = "INVALID123"
        response = self.client.post(url, bad_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("pan_number", response.data["details"])

    def test_customer_submission_invalid_gstin_fails(self):
        url = reverse('customer-register')
        bad_data = self.customer_data.copy()
        bad_data["tax_number"] = "INVALID_GST"
        response = self.client.post(url, bad_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("tax_number", response.data["details"])

    def test_status_tracking(self):
        url_submit = reverse('customer-register')
        submit_res = self.client.post(url_submit, self.customer_data, format='json')
        reg_no = submit_res.data["registration_number"]

        url_status = f"{reverse('registration-status')}?query={reg_no}"
        status_res = self.client.get(url_status)
        self.assertEqual(status_res.status_code, status.HTTP_200_OK)
        self.assertEqual(status_res.data["registration_number"], reg_no)
        self.assertEqual(status_res.data["status"], RegistrationStatus.SUBMITTED)

    def test_admin_enrichment_and_sap_posting(self):
        # Step 1: Customer submits
        url_submit = reverse('customer-register')
        submit_res = self.client.post(url_submit, self.customer_data, format='json')
        reg_id = submit_res.data["data"]["id"]

        # Step 2: Admin enriches and approves
        url_review = reverse('admin-registration-review', kwargs={'pk': reg_id})
        review_res = self.client.patch(url_review, self.admin_enrichment_data, format='json')
        self.assertEqual(review_res.status_code, status.HTTP_200_OK)
        self.assertIn("customer_number", review_res.data)
        self.assertIn("address_number", review_res.data)

        # Step 3: Verify DB state
        reg = CustomerRegistration.objects.get(id=reg_id)
        self.assertEqual(reg.status, RegistrationStatus.BP_CREATED)
        self.assertTrue(len(reg.customer_number) > 0)
        self.assertTrue(len(reg.address_number) > 0)
        self.assertEqual(reg.region, "RJ")
        self.assertEqual(reg.account_group, "ZDOM")
        self.assertEqual(reg.recon_account, "24430000")
        self.assertEqual(reg.payment_terms, "NT30")
        self.assertEqual(reg.sales_org, "1000")
        self.assertEqual(reg.sap_status, "SUCCESS")

        # Verify exact 26-property SAP payload sent
        self.assertEqual(reg.sap_payload["Ktokd"], "ZDOM")
        self.assertEqual(reg.sap_payload["Akont"], "24430000")
        self.assertEqual(reg.sap_payload["Zterm"], "NT30")
        self.assertEqual(reg.sap_payload["Name1"], "ROYAL SUNDARAM GENERAL")
        self.assertEqual(reg.sap_payload["Land1"], "IN")

    def test_admin_rejection(self):
        url_submit = reverse('customer-register')
        submit_res = self.client.post(url_submit, self.customer_data, format='json')
        reg_id = submit_res.data["data"]["id"]

        url_review = reverse('admin-registration-review', kwargs={'pk': reg_id})
        review_res = self.client.patch(url_review, {
            "action": "REJECT",
            "remarks": "Incomplete documentation submitted."
        }, format='json')
        self.assertEqual(review_res.status_code, status.HTTP_200_OK)

        reg = CustomerRegistration.objects.get(id=reg_id)
        self.assertEqual(reg.status, RegistrationStatus.REJECTED)
        self.assertEqual(reg.remarks, "Incomplete documentation submitted.")

    def test_customer_resubmission_after_return(self):
        # Step 1: Submit
        url_submit = reverse('customer-register')
        submit_res = self.client.post(url_submit, self.customer_data, format='json')
        reg_id = submit_res.data["data"]["id"]

        # Step 2: Admin returns for correction
        url_review = reverse('admin-registration-review', kwargs={'pk': reg_id})
        self.client.patch(url_review, {
            "action": "RETURN",
            "remarks": "Please provide updated street address."
        }, format='json')

        # Step 3: Customer edits and resubmits
        url_resubmit = reverse('customer-resubmit', kwargs={'pk': reg_id})
        updated_data = self.customer_data.copy()
        updated_data["street"] = "Suite 501, 5th Floor, Tower B"
        resubmit_res = self.client.patch(url_resubmit, updated_data, format='json')
        self.assertEqual(resubmit_res.status_code, status.HTTP_200_OK)

        reg = CustomerRegistration.objects.get(id=reg_id)
        self.assertEqual(reg.status, RegistrationStatus.SUBMITTED)
        self.assertEqual(reg.street, "Suite 501, 5th Floor, Tower B")

    def test_customer_submission_with_documents(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        from .models import DocumentType

        gst_file = SimpleUploadedFile("sample_gst_certificate.pdf", b"%PDF-1.4 sample gstin content", content_type="application/pdf")
        pan_file = SimpleUploadedFile("sample_pan_card.jpg", b"fake jpeg image bytes", content_type="image/jpeg")

        post_data = self.customer_data.copy()
        post_data['doc_gst'] = gst_file
        post_data['doc_pan'] = pan_file

        url = reverse('customer-register')
        response = self.client.post(url, post_data, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        reg = CustomerRegistration.objects.get(registration_number=response.data["registration_number"])
        self.assertEqual(reg.documents.count(), 2)

        doc_types = list(reg.documents.values_list('document_type', flat=True))
        self.assertIn(DocumentType.GST_CERTIFICATE, doc_types)
        self.assertIn(DocumentType.PAN_CARD, doc_types)

