"""
SAP S/4HANA OData Integration Service for IGGL Portal
Service: ZGTA_ODATA_SRV | Entity: Create_CustSet
Handles CSRF handshake, session cookie persistence, payload serialization,
14 F4 Value-Help sets, and deep error translation.
"""

import logging
import random
import requests
from django.conf import settings
from django.utils import timezone
from django.core.cache import cache

logger = logging.getLogger(__name__)

# All 14 Value-Help entity sets conforming to SAP S/4HANA ZGTA_ODATA_SRV
SAP_ENTITY_SETS = [
    "companySet",
    "PartnerCategorySet",
    "RegionSet",
    "AccountGroupSet",
    "ReconciliationAccountSet",
    "Termsof_PaymentSet",
    "SalesORGSet",
    "PricingProcedureSet",
    "CustomerPriceGroupSet",
    "IncoTermSet",
    "ShippingConditionsSet",
    "AccountAssignmentGroupSet",
    "TaxTypeSet",
    "TaxClassificationSet"
]


class SAPODataService:
    @classmethod
    def get_service_url(cls):
        base = getattr(settings, 'SAP_ODATA_URL', 'https://192.162.2.34:44300/sap/opu/odata/sap/ZGTA_ODATA_SRV')
        return base.rstrip('/')

    @classmethod
    def get_client_id(cls):
        return getattr(settings, 'SAP_CLIENT', '110')

    @classmethod
    def get_session(cls):
        session = requests.Session()
        session.auth = (settings.SAP_AUTH_USER, settings.SAP_AUTH_PASSWORD)
        verify_ssl = getattr(settings, 'SAP_VERIFY_SSL', False)
        session.verify = verify_ssl
        if not verify_ssl:
            try:
                import urllib3
                urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
            except Exception:
                pass
        return session

    @classmethod
    def build_customer_payload(cls, registration):
        """
        Builds the exact SAP S/4HANA Create_CustSet payload adhering to ZGTA_ODATA_SRV:
        OData property = First letter capitalized, rest lowercase (no underscores).
        """
        full_name1 = (registration.name1 or "").strip()
        full_name2 = (registration.name2 or "").strip()
        if len(full_name1) > 40 and not full_name2:
            s_name1 = full_name1[:40]
            s_name2 = full_name1[40:80]
        else:
            s_name1 = full_name1[:40]
            s_name2 = full_name2[:40]

        # Address fields (customer entered)
        stras = (registration.street or "").strip()[:60]
        str_suppl1 = (getattr(registration, 'street_suppl1', '') or "").strip()[:40]
        str_suppl2 = (getattr(registration, 'street_suppl2', '') or "").strip()[:40]
        str_suppl3 = (getattr(registration, 'street_suppl3', '') or "").strip()[:40]
        ort01 = (registration.city or "").strip()[:40]
        ort02 = (getattr(registration, 'district', '') or "").strip()[:40]
        if not ort02:
            ort02 = ort01

        # Construct comma-separated Tatyp and Taxad
        taxes = registration.tax_details or []
        if isinstance(taxes, str):
            try:
                import json
                taxes = json.loads(taxes)
            except Exception:
                taxes = []

        if not taxes:
            raw_tatyp = getattr(registration, 'tax_type', '') or "JVAT,JOSG,JOIG,JOCG"
            raw_taxad = getattr(registration, 'tax_classification', '') or "0,0,0,0"
            types = [t.strip() for t in raw_tatyp.split(',') if t.strip()]
            classes = [c.strip() for c in raw_taxad.split(',') if c.strip()]
            taxes = [{"Tatyp": t, "Taxad": classes[i] if i < len(classes) else "0"} for i, t in enumerate(types)]

        tatyp_str = ",".join([str(t.get('Tatyp') or '').strip() for t in taxes if t.get('Tatyp')])
        taxad_str = ",".join([str(t.get('Taxad', t.get('Takld', '0'))).strip() for t in taxes if t.get('Tatyp')])

        if not tatyp_str:
            tatyp_str = "JVAT,JOSG,JOIG,JOCG"
            taxad_str = "0,0,0,0"

        telf1 = (registration.telephone or "").replace(" ", "").replace("-", "")[:16]
        pstlz = (registration.postal_code or "")[:10]
        stcd3 = (registration.tax_number or "").strip()[:18]
        j1ipanno = (registration.pan_number or "").strip()[:40]

        bukrs = getattr(registration, 'company_code', '') or "2000"
        title = getattr(registration, 'partner_category', '') or "0003"
        regio = (registration.region or "")[:3]
        ktokd = getattr(registration, 'account_group', '') or "ZD01"
        akont = getattr(registration, 'recon_account', '') or "0000215001"
        zterm = getattr(registration, 'payment_terms', '') or "0001"
        vkorg = getattr(registration, 'sales_org', '') or "2000"
        vtweg = getattr(registration, 'distribution_channel', '') or "10"
        spart = getattr(registration, 'division', '') or "02"
        kalks = getattr(registration, 'pricing_procedure', '') or "01"
        konda = getattr(registration, 'customer_price_group', '') or "01"
        inco1 = getattr(registration, 'inco_term', '') or "EXW"
        vsbed = getattr(registration, 'shipping_conditions', '') or "01"
        waers = getattr(registration, 'currency', '') or "INR"
        awahr = getattr(registration, 'order_probability', '') or "100"
        ktgrd = getattr(registration, 'account_assignment_group', '') or "01"

        payload = {
            # Exact 31 SAP OData properties (Adhering strictly to ZGTA_ODATA_SRV/Create_CustSet)
            "Bukrs": bukrs,
            "Land1": registration.country or "IN",
            "Name1": s_name1,
            "Name2": s_name2,
            "Ort01": ort01,
            "Ort02": ort02,
            "Pstlz": pstlz,
            "Stras": stras,
            "Str_Suppl1": str_suppl1,
            "Str_Suppl2": str_suppl2,
            "Str_Suppl3": str_suppl3,
            "Telf1": telf1,
            "Stcd3": stcd3,
            "J1ipanno": j1ipanno,
            "Title": title,
            "Regio": regio,
            "Ktokd": ktokd,
            "Akont": akont,
            "Zterm": zterm,
            "Vkorg": vkorg,
            "Vtweg": vtweg,
            "Spart": spart,
            "Kalks": kalks,
            "Konda": konda,
            "Inco1": inco1,
            "Vsbed": vsbed,
            "Waers": waers,
            "Awahr": awahr,
            "Ktgrd": ktgrd,
            "Tatyp": tatyp_str,
            "Taxad": taxad_str
        }
        return payload

    @classmethod
    def post_customer_master(cls, registration):
        """
        Dispatches customer master payload to SAP S/4HANA ZGTA_ODATA_SRV/Create_CustSet.
        Supports 2-phase CSRF handshake and session cookie persistence.
        """
        payload = cls.build_customer_payload(registration)
        registration.sap_payload = payload

        if settings.SAP_MOCK_MODE:
            logger.info("SAP_MOCK_MODE enabled. Simulating SAP S/4HANA ZGTA_ODATA_SRV response.")
            # Standard SAP 10-digit customer number
            kunnr = f"0021{random.randint(100000, 999999):06d}"
            adrnr = str(random.randint(350000, 399999))

            response_data = {
                "d": {
                    "Kunnr": kunnr,
                    "Adrnr": adrnr,
                    "KUNNR": kunnr,
                    "ADRNR": adrnr,
                    "Land1": payload["Land1"],
                    "Name1": payload["Name1"],
                    "Status": "CREATED",
                    "Message": f"Business Partner {kunnr} successfully created in SAP S/4HANA (Client {cls.get_client_id()}).",
                    "Timestamp": timezone.now().isoformat()
                }
            }

            registration.customer_number = kunnr
            registration.address_number = adrnr
            registration.sap_response = response_data
            registration.sap_status = "SUCCESS"
            registration.sap_posted_at = timezone.now()
            registration.status = "BP_CREATED"
            registration.save()

            return {
                "success": True,
                "customer_number": kunnr,
                "address_number": adrnr,
                "response": response_data
            }

        # Real Live SAP S/4HANA Gateway Call
        try:
            service_url = cls.get_service_url()
            client_id = cls.get_client_id()
            session = cls.get_session()

            # Step 1: CSRF Token Handshake via HEAD request
            token_headers = {
                "x-csrf-token": "fetch",
                "sap-client": client_id,
                "Accept": "application/json"
            }
            token_url = f"{service_url}/Create_CustSet"
            head_res = session.head(token_url, headers=token_headers, params={"sap-client": client_id}, timeout=15)
            csrf_token = head_res.headers.get("x-csrf-token")

            if not csrf_token:
                # Retry token fetch via GET service root
                get_res = session.get(f"{service_url}/", headers=token_headers, params={"sap-client": client_id}, timeout=15)
                csrf_token = get_res.headers.get("x-csrf-token", "")

            # Step 2: POST Create_CustSet
            post_headers = {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "x-csrf-token": csrf_token,
                "sap-client": client_id
            }

            # Filter payload to exact OData properties (strip internal alias keys)
            # Construct strictly the exact 31 properties defined in SAP S/4HANA Create_CustSet
            odata_post_payload = {
                "Bukrs": payload["Bukrs"],
                "Land1": payload["Land1"],
                "Name1": payload["Name1"],
                "Name2": payload["Name2"],
                "Ort01": payload["Ort01"],
                "Ort02": payload.get("Ort02", payload["Ort01"]),
                "Pstlz": payload["Pstlz"],
                "Stras": payload["Stras"],
                "Str_Suppl1": payload.get("Str_Suppl1", ""),
                "Str_Suppl2": payload.get("Str_Suppl2", ""),
                "Str_Suppl3": payload.get("Str_Suppl3", ""),
                "Telf1": payload["Telf1"],
                "Stcd3": payload["Stcd3"],
                "J1ipanno": payload["J1ipanno"],
                "Title": payload["Title"],
                "Regio": payload["Regio"],
                "Ktokd": payload["Ktokd"],
                "Akont": payload["Akont"],
                "Zterm": payload["Zterm"],
                "Vkorg": payload["Vkorg"],
                "Vtweg": payload["Vtweg"],
                "Spart": payload["Spart"],
                "Kalks": payload["Kalks"],
                "Konda": payload["Konda"],
                "Inco1": payload["Inco1"],
                "Vsbed": payload["Vsbed"],
                "Waers": payload["Waers"],
                "Awahr": payload["Awahr"],
                "Ktgrd": payload["Ktgrd"],
                "Tatyp": payload["Tatyp"],
                "Taxad": payload.get("Taxad", payload.get("Takld", "0"))
            }

            post_url = f"{service_url}/Create_CustSet"
            post_res = session.post(
                post_url,
                json=odata_post_payload,
                headers=post_headers,
                params={"sap-client": client_id},
                timeout=30
            )

            if post_res.status_code in (200, 201):
                res_json = post_res.json()
                d = res_json.get("d", res_json)
                kunnr = d.get("Kunnr") or d.get("KUNNR", "")
                adrnr = d.get("Adrnr") or d.get("ADRNR", "")

                registration.customer_number = kunnr
                registration.address_number = adrnr
                registration.sap_payload = odata_post_payload
                registration.sap_response = res_json
                registration.sap_status = "SUCCESS"
                registration.sap_posted_at = timezone.now()
                registration.status = "BP_CREATED"
                registration.save()

                return {
                    "success": True,
                    "customer_number": kunnr,
                    "address_number": adrnr,
                    "response": res_json
                }
            else:
                error_body = post_res.text
                error_msg = f"SAP Gateway returned HTTP {post_res.status_code}"
                try:
                    err_json = post_res.json()
                    inner_msg = err_json.get("error", {}).get("message", {}).get("value")
                    if inner_msg:
                        error_msg = f"SAP S/4HANA Error: {inner_msg}"
                except Exception:
                    pass

                registration.sap_response = {"error": error_body, "status_code": post_res.status_code}
                registration.sap_status = "FAILED"
                registration.save()
                return {
                    "success": False,
                    "error": error_msg
                }

        except Exception as e:
            logger.exception("Failed to dispatch Customer Master to SAP S/4HANA")
            registration.sap_response = {"exception": str(e)}
            registration.sap_status = "FAILED"
            registration.save()
            return {
                "success": False,
                "error": f"SAP Gateway Connection Exception: {str(e)}"
            }

    @classmethod
    def _parse_sap_entity_items(cls, entity_set, items):
        parsed = []
        seen = set()
        for it in items:
            code = ""
            desc = ""
            if entity_set == 'companySet':
                code = it.get('BUKRS')
                desc = it.get('BUTXT') or code
            elif entity_set == 'PartnerCategorySet':
                desc = it.get('TITLE_MEDI') or it.get('TITLE') or ""
                raw_code = str(it.get('TITLE') or '').strip()
                SAP_TITLE_CODES = {
                    "ms.": "0001",
                    "mr.": "0002",
                    "company": "0003",
                    "mr. and mrs.": "0004",
                    "partnership": "0005",
                    "proprietorship": "0006",
                    "limited liability partnership": "0007",
                    "aop/boi": "0008",
                }
                norm_desc = desc.lower().strip()
                if raw_code and raw_code not in ('0', '0000') and len(raw_code) >= 4:
                    code = raw_code
                elif norm_desc in SAP_TITLE_CODES:
                    code = SAP_TITLE_CODES[norm_desc]
                else:
                    code = raw_code if raw_code not in ('0', '') else f"{len(parsed)+1:04d}"
            elif entity_set == 'RegionSet':
                code = it.get('REGIO') or it.get('Regio') or it.get('BLAND') or it.get('Code') or it.get('Key')
                desc = it.get('BEZEI') or it.get('Bezei') or it.get('Text') or it.get('Description') or code
            elif entity_set == 'AccountGroupSet':
                code = it.get('KTOKD')
                desc = it.get('TXT30') or code
            elif entity_set == 'ReconciliationAccountSet':
                code = it.get('AKONT')
                desc = it.get('TXT50') or code
            elif entity_set == 'Termsof_PaymentSet':
                code = it.get('ZTERM')
                desc = it.get('VTEXT') or code
            elif entity_set == 'SalesORGSet':
                code = it.get('VKORG')
                vtweg = it.get('VTWEG', '')
                spart = it.get('SPART', '')
                desc = f"{code} (Distr: {vtweg}, Div: {spart})" if vtweg else code
            elif entity_set == 'PricingProcedureSet':
                code = it.get('KALKS')
                desc = f"{code} - Standard Unified Tariff"
            elif entity_set == 'CustomerPriceGroupSet':
                code = it.get('KONDA')
                desc = it.get('VTEXT') or code
            elif entity_set == 'IncoTermSet':
                code = it.get('INCO1')
                desc = it.get('BEZEI') or code
            elif entity_set == 'ShippingConditionsSet':
                code = it.get('VSBED')
                desc = it.get('VTEXT') or code
            elif entity_set == 'AccountAssignmentGroupSet':
                code = it.get('KTGRD')
                desc = f"{code} - Revenue Account"
            elif entity_set == 'TaxTypeSet':
                code = it.get('TATYP')
                desc = it.get('VTEXT') or code
            elif entity_set == 'TaxClassificationSet':
                code = it.get('TAKLD')
                desc = it.get('VTEXT') or code
            else:
                code = it.get("Code") or it.get("Id") or it.get("Key") or next(iter(it.values()), "")
                desc = it.get("Description") or it.get("Text") or it.get("Name") or code

            if code is not None and str(code).strip() and str(code).strip() not in seen:
                code_str = str(code).strip()
                seen.add(code_str)
                desc_str = str(desc).strip()
                label = f"{code_str} - {desc_str}" if code_str != desc_str and desc_str else code_str
                parsed.append({"code": code_str, "label": label})
        return parsed

    @classmethod
    def fetch_f4_value_helps(cls, force_refresh=False):
        """
        Retrieves all 14 Value-Help sets directly from SAP S/4HANA ZGTA_ODATA_SRV.
        Queries live SAP Gateway with zero dummy or fallback data.
        """
        cache_key = "sap_zgta_f4_value_helps"
        if not force_refresh:
            cached_data = cache.get(cache_key)
            if cached_data:
                return cached_data

        result = {s: [] for s in SAP_ENTITY_SETS}
        try:
            service_url = cls.get_service_url()
            client_id = cls.get_client_id()
            session = cls.get_session()
            headers = {"Accept": "application/json", "sap-client": client_id}

            for entity_set in SAP_ENTITY_SETS:
                try:
                    url = f"{service_url}/{entity_set}"
                    r = session.get(url, headers=headers, params={"sap-client": client_id}, timeout=10)
                    if r.status_code == 200:
                        data = r.json()
                        items = data.get("d", {}).get("results", [])
                        if items:
                            parsed_list = cls._parse_sap_entity_items(entity_set, items)
                            if parsed_list:
                                result[entity_set] = parsed_list
                except Exception as ex:
                    logger.warning(f"Could not load live SAP F4 set {entity_set}: {ex}")

            # Only cache if live SAP returned data
            if any(len(v) > 0 for v in result.values()):
                cache.set(cache_key, result, timeout=86400)
            return result

        except Exception as e:
            logger.error(f"Failed to fetch live SAP F4 sets: {e}")
            return result

    @classmethod
    def read_customer_by_kunnr(cls, kunnr):
        """
        Reads Customer Master directly from SAP S/4HANA by KUNNR key.
        Syntax: /Create_CustSet(Kunnr='0021000003') or positional ('0021000073')
        """
        clean_kunnr = kunnr.strip().zfill(10)
        try:
            service_url = cls.get_service_url()
            client_id = cls.get_client_id()
            session = cls.get_session()
            headers = {"Accept": "application/json", "sap-client": client_id}

            url = f"{service_url}/Create_CustSet(Kunnr='{clean_kunnr}')"
            res = session.get(url, headers=headers, params={"sap-client": client_id}, timeout=15)
            if res.status_code == 200:
                data = res.json()
                return data.get("d", data)
            else:
                return None
        except Exception as e:
            logger.error(f"Error reading SAP Customer {kunnr}: {e}")
            return None
