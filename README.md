# IGGL Customer Transmission Portal — Phase 1 Customer Registration

Customer-facing gas transmission portal for **Indradhanush Gas Grid Limited (IGGL)** under the PNGRB Unified Tariff regime, interfacing with **SAP S/4HANA (RISE)** via **OData**.

## Tech Stack
* **Backend**: Python 3 / Django 6 + Django REST Framework (DRF)
* **Frontend**: React 19 + Vite + Lucide Icons + Responsive Enterprise CSS
* **Database**: MySQL (PyMySQL driver) with local SQLite mode support for zero-friction setup
* **Integration**: SAP S/4HANA Customer Master OData Service (`API_BUSINESS_PARTNER` / Custom Customer OData)

---

## Customer Master Specification Mapping (from Excel Sheet)

| Field Name | SAP Field | Type (Length) | Category | Description | Example |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Name 1** | `NAME1` | CHAR(35) | 🟢 Customer | Legal Entity Name | `ROYAL SUNDARAM GENERAL` |
| **Name 2** | `NAME2` | CHAR(35) | 🟢 Customer | Continuation / Division | `INSURANCE CO. LIMITED` |
| **City** | `ORT01` | CHAR(35) | 🟢 Customer | City | `Jaipur` |
| **Postal Code** | `PSTLZ` | CHAR(10) | 🟢 Customer | PIN / Postal Code | `302001` |
| **Street** | `STRAS` | CHAR(35) | 🟢 Customer | Street Address | `Office No 402,4th Floor...` |
| **Telephone** | `TELF1` | CHAR(16) | 🟢 Customer | Telephone / Mobile | `9529278332` |
| **Tax Number** | `STCD3` | CHAR(18) | 🟢 Customer | GSTIN (India) | `08AABCR7109G1ZJ` |
| **Permanent A/c** | `J_1IPANNO`| CHAR(40) | 🟢 Customer | PAN Number | `AABCR7109G` |
| **Email** | — | VARCHAR | 🟢 Customer | Contact / Portal Credential | `contact@domain.com` |
| **Region** | `REGIO` | CHAR(3) | 🟠 Admin | State / Region Code | `RJ` |
| **Account Group** | `KTOKD` | CHAR(4) | 🟠 Admin | Customer Account Group | `ZDOM` |
| **Recon Account** | `AKONT` | CHAR(10) | 🟠 Admin | G/L Reconciliation Account| `24430000` |
| **Terms of Payment**| `ZTERM` | CHAR(4) | 🟠 Admin | Payment Terms Code | `NT30` |
| **Sales Org** | `VKORG` | CHAR(4) | 🟠 Admin | Sales Organization | `1000` |
| **Country** | `LAND1` | CHAR(3) | ⚪ System | Default: India | `IN` |
| **Language Key** | `SPRAS` | CHAR(3) | 🔴 System | Default: English | `EN` |
| **Customer No.** | `KUNNR` | CHAR(10) | ⚪ SAP Auto | SAP Customer Number | `1126846` |
| **Address No.** | `ADRNR` | CHAR(10) | ⚪ SAP Auto | SAP Address Number | `355321` |

---

## Workflow Implemented

```text
[Customer Self-Registration (Screen A5)]
  ↓ (Fills 🟢 Green Fields: Name1, Name2, City, PIN, Street, Phone, GSTIN, PAN, Email)
[MySQL DB: Status = SUBMITTED] (Generates ref: IGGL-REG-2026-XXXXX)
  ↓
[IGGL Back-Office Review Queue (Screens C2 / C3)]
  ↓ (Admin enriches 🟠 Orange Fields: REGIO, KTOKD, AKONT, ZTERM, VKORG)
[Approve & Dispatch via OData]
  ↓ (Sends full payload to SAP S/4HANA OData endpoint)
[SAP S/4HANA Generates KUNNR & ADRNR]
  ↓ (Stores KUNNR=1126846, ADRNR=355321 in DB)
[Status = BP_CREATED]
  ↓
[Customer Track Status (Screen A6)]
  (Customer enters Reference No, PAN, or GSTIN and sees SAP Customer Number activated)
```

---

## Running the Project

### Backend (Django)
```bash
cd backend
source venv/bin/activate
python manage.py runserver 8000
```
*API Base URL*: `http://localhost:8000/api/v1/`

### Frontend (React)
```bash
cd frontend
npm run dev
```
*Frontend URL*: `http://localhost:5173/`

### Running Backend Tests
```bash
./backend/venv/bin/python backend/manage.py test registrations
```
