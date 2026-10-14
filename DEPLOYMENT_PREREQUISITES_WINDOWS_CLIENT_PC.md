# IGGL Portal — Setup Checklist for Windows PC

Hi team,

Here is a quick checklist of things needed on the Windows machine before we deploy the IGGL portal. Since this is an existing office PC, the entire app will run from its own dedicated folder (e.g. `C:\IGGL_Portal`) inside a sandboxed virtual environment, so it won't affect any existing files or software.

---

### 1. Machine & Power Settings
Since the PC will act as an internal host for other users in the office:
* **Sleep Mode**: Please set Sleep and Hibernate to **"Never"** (under *Power & Sleep settings*) so the site stays online when the PC is idle.
* **IP Address**: Assign a fixed/static local IP (or DHCP reservation) so the link doesn't break when the machine restarts.

---

### 2. IIS Configuration
Please make sure **IIS** is enabled in *Turn Windows features on or off*.

Also, IIS needs two standard Microsoft add-ons so it can route API requests:
1. **URL Rewrite 2.1**: https://www.iis.net/downloads/microsoft/url-rewrite
2. **Application Request Routing (ARR) 3.0**: https://www.iis.net/downloads/microsoft/application-request-routing
   * *After installing ARR, open IIS Manager -> Application Request Routing Cache -> Server Proxy Settings -> Check "Enable proxy" -> Apply.*

---

### 3. Software to Install
* **Python (3.11 or 3.12)**: https://www.python.org/downloads/windows/  
  *(Make sure to tick **"Add python.exe to PATH"** during setup)*
* **MySQL 8.0**: Community Server (if database is running locally on this PC)
* **NSSM**: https://nssm.cc/download  
  *(Small tool to keep the backend running automatically in the background. Just unzip `nssm.exe` into `C:\Windows\System32`)*

---

### 4. Firewall / Network
* Allow inbound traffic on **Port 80** (or an alternate port like **8080** if 80 is already used) in Windows Firewall so other office PCs can open the portal in their browser.
* Ensure the machine has network access to reach the SAP server endpoint.

---

### 5. For the Remote Session
When we connect remotely, we will just need:
* Administrator access (to set up IIS and register the background service).
* MySQL root or database user credentials.
* Remote Desktop (RDP) or AnyDesk access.

Let me know once these are ready, and we can hop on a call to finish the deployment!
