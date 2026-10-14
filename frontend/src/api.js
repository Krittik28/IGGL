const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const resolveFileUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://localhost:8000') || url.startsWith('http://127.0.0.1:8000')) {
    const relativePath = url.replace(/^http:\/\/(localhost|127\.0\.0\.1):8000/, '');
    const backendBase = import.meta.env.VITE_BACKEND_URL || '';
    return `${backendBase}${relativePath}`;
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const backendBase = import.meta.env.VITE_BACKEND_URL || '';
  return `${backendBase}${url.startsWith('/') ? '' : '/'}${url}`;
};

export const submitCustomerRegistration = async (formData, files = {}) => {
  let body;
  let headers = {};

  const hasFiles = files && Object.values(files).some(f => f instanceof File);

  if (hasFiles) {
    const fd = new FormData();
    Object.keys(formData).forEach(key => {
      if (formData[key] !== undefined && formData[key] !== null) {
        fd.append(key, formData[key]);
      }
    });
    Object.keys(files).forEach(fileKey => {
      if (files[fileKey] instanceof File) {
        fd.append(fileKey, files[fileKey]);
      }
    });
    body = fd;
  } else {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(formData);
  }

  const response = await fetch(`${API_BASE_URL}/register/`, {
    method: 'POST',
    headers,
    body
  });
  const data = await response.json();
  if (!response.ok) {
    throw { status: response.status, data };
  }
  return data;
};

export const uploadRegistrationDocument = async (registrationId, file, documentType = 'OTHER') => {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('document_type', documentType);

  const response = await fetch(`${API_BASE_URL}/registrations/${registrationId}/documents/`, {
    method: 'POST',
    body: fd
  });
  const data = await response.json();
  if (!response.ok) {
    throw { status: response.status, data };
  }
  return data;
};

export const checkRegistrationStatus = async (query) => {
  const response = await fetch(`${API_BASE_URL}/status/?query=${encodeURIComponent(query)}`);
  const data = await response.json();
  if (!response.ok) {
    throw { status: response.status, data };
  }
  return data;
};

export const fetchAdminRegistrations = async (status = '', search = '') => {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  if (search) params.append('search', search);

  const response = await fetch(`${API_BASE_URL}/admin/registrations/?${params.toString()}`, {
    credentials: 'include',
    headers: getAuthHeaders()
  });
  if (!response.ok) {
    throw new Error('Failed to fetch registrations');
  }
  return await response.json();
};

export const fetchRegistrationDetail = async (id) => {
  const response = await fetch(`${API_BASE_URL}/admin/registrations/${id}/`, {
    credentials: 'include',
    headers: getAuthHeaders()
  });
  if (!response.ok) {
    throw new Error('Failed to fetch registration details');
  }
  return await response.json();
};

export const reviewAndEnrichRegistration = async (id, reviewData) => {
  const response = await fetch(`${API_BASE_URL}/admin/registrations/${id}/review/`, {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify(reviewData)
  });
  const data = await response.json();
  if (!response.ok) {
    throw { status: response.status, data };
  }
  return data;
};

export const retrySAPPosting = async (id) => {
  const response = await fetch(`${API_BASE_URL}/admin/registrations/${id}/retry-sap/`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({})
  });
  const data = await response.json();
  if (!response.ok) {
    throw { status: response.status, data };
  }
  return data;
};

export const fetchSAPMasterData = async (forceRefresh = false) => {
  const url = `${API_BASE_URL}/admin/sap/master-data/${forceRefresh ? '?refresh=true' : ''}`;
  const response = await fetch(url, {
    credentials: 'include',
    headers: getAuthHeaders()
  });
  if (!response.ok) {
    throw new Error('Failed to fetch SAP master data');
  }
  return await response.json();
};

export const fetchPublicMasterData = async (forceRefresh = false) => {
  const url = `${API_BASE_URL}/sap/master-data/${forceRefresh ? '?refresh=true' : ''}`;
  const response = await fetch(url, {
    credentials: 'include',
    headers: getAuthHeaders()
  });
  if (!response.ok) {
    throw new Error('Failed to fetch SAP master data');
  }
  return await response.json();
};

export const fetchSAPCustomer = async (kunnr) => {
  const response = await fetch(`${API_BASE_URL}/admin/sap/customer/${encodeURIComponent(kunnr)}/`, {
    credentials: 'include',
    headers: getAuthHeaders()
  });
  const data = await response.json();
  if (!response.ok) {
    throw { status: response.status, data };
  }
  return data;
};

export const resubmitCustomerRegistration = async (id, updatedData) => {
  const response = await fetch(`${API_BASE_URL}/registrations/${id}/resubmit/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatedData)
  });
  const data = await response.json();
  if (!response.ok) {
    throw { status: response.status, data };
  }
  return data;
};

const getCurrentUserFromStorage = () => {
  try {
    const saved = localStorage.getItem('iggl_user');
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

export const getAuthHeaders = (customUser = null) => {
  const token = localStorage.getItem('iggl_access_token');
  const user = customUser || getCurrentUserFromStorage();
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (user) {
    if (user.role) headers['X-User-Role'] = user.role;
    // Only send customer-specific headers for CUSTOMER role users.
    // Sending these for admin/staff users causes the backend to misidentify
    // them as customers and filter results to their own records only.
    if (user.role === 'CUSTOMER') {
      if (user.email) headers['X-Customer-Email'] = user.email;
      if (user.sap_customer_code) headers['X-Customer-Code'] = user.sap_customer_code;
      if (user.company_name) headers['X-Company-Name'] = user.company_name;
    }
  }
  return headers;
};

const getCustomerHeaders = (customUser = null) => {
  return getAuthHeaders(customUser);
};

export const loginPortalUser = async ({ username, password, portalType }) => {
  const response = await fetch(`${API_BASE_URL}/auth/login/`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      password,
      portal_type: portalType
    })
  });
  const data = await response.json();
  if (!response.ok) {
    throw { status: response.status, data };
  }
  if (data.access) {
    localStorage.setItem('iggl_access_token', data.access);
  }
  if (data.refresh) {
    localStorage.setItem('iggl_refresh_token', data.refresh);
  }
  return data;
};

export const logoutPortalUser = async () => {
  try {
    const token = localStorage.getItem('iggl_access_token');
    await fetch(`${API_BASE_URL}/auth/logout/`, {
      method: 'POST',
      credentials: 'include',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
  } catch (e) {
    console.error(e);
  } finally {
    localStorage.removeItem('iggl_access_token');
    localStorage.removeItem('iggl_refresh_token');
    localStorage.removeItem('iggl_user');
  }
};

// GTA & Capacity Tranche Endpoints
export const fetchCustomerDashboard = async (customUser = null) => {
  const user = customUser || getCurrentUserFromStorage();
  const params = new URLSearchParams();
  if (user) {
    if (user.email) params.append('customer_email', user.email);
    if (user.sap_customer_code) params.append('customer_code', user.sap_customer_code);
    if (user.company_name) params.append('company_name', user.company_name);
    if (user.role) params.append('role', user.role);
  }
  const queryStr = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`${API_BASE_URL}/gtas/customer_dashboard/${queryStr}`, {
    credentials: 'include',
    headers: getCustomerHeaders(user)
  });
  if (!response.ok) throw new Error('Failed to load customer dashboard');
  return await response.json();
};

export const fetchAdminDashboard = async () => {
  const response = await fetch(`${API_BASE_URL}/gtas/admin_dashboard/`, {
    credentials: 'include',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Failed to load admin dashboard');
  return await response.json();
};

export const fetchApprovedCustomers = async () => {
  const response = await fetch(`${API_BASE_URL}/gtas/approved-customers/`, {
    credentials: 'include',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Failed to fetch approved customers');
  return await response.json();
};

export const fetchAdminCustomers = async () => {
  const response = await fetch(`${API_BASE_URL}/admin/customers/`, {
    credentials: 'include',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Failed to fetch customers list');
  return await response.json();
};

export const adminChangeCustomerPassword = async (customerId, newPassword) => {
  const response = await fetch(`${API_BASE_URL}/admin/customers/${customerId}/change-password/`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ new_password: newPassword })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to update customer password');
  }
  return data;
};

export const fetchGTAList = async (status = '', customUser = null) => {
  const user = customUser || getCurrentUserFromStorage();
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  if (user?.role === 'CUSTOMER') {
    params.append('role', 'CUSTOMER');
    if (user.email) params.append('customer_email', user.email);
    if (user.sap_customer_code) params.append('customer_code', user.sap_customer_code);
    if (user.company_name) params.append('company_name', user.company_name);
  }
  const queryStr = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`${API_BASE_URL}/gtas/${queryStr}`, {
    credentials: 'include',
    headers: getCustomerHeaders(user)
  });
  if (!response.ok) throw new Error('Failed to fetch GTAs');
  return await response.json();
};

export const fetchGTADetail = async (id) => {
  const response = await fetch(`${API_BASE_URL}/gtas/${id}/`, {
    credentials: 'include',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Failed to fetch GTA detail');
  return await response.json();
};

export const createGTARequest = async (gtaData, customUser = null) => {
  const user = customUser || getCurrentUserFromStorage();
  const payload = {
    ...gtaData,
    customer_email: user?.email || gtaData.customer_email || gtaData.shipper_notice_email,
    customer_code: user?.sap_customer_code || gtaData.customer_code,
    company_name: user?.company_name || gtaData.shipper_name
  };

  const hasFile = payload.gta_document instanceof File;
  let body;
  const headers = { ...getCustomerHeaders(user) };

  if (hasFile) {
    const fd = new FormData();
    Object.keys(payload).forEach((key) => {
      if (payload[key] !== undefined && payload[key] !== null) {
        fd.append(key, payload[key]);
      }
    });
    body = fd;
  } else {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(payload);
  }

  const response = await fetch(`${API_BASE_URL}/gtas/`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body
  });
  const data = await response.json();
  if (!response.ok) throw { status: response.status, data };
  return data;
};

export const signGTAAgreement = async (id, signerName) => {
  const response = await fetch(`${API_BASE_URL}/gtas/${id}/sign/`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({ signer_name: signerName })
  });
  const data = await response.json();
  if (!response.ok) throw { status: response.status, data };
  return data;
};

export const approveGTAAgreement = async (id, approverName) => {
  const response = await fetch(`${API_BASE_URL}/gtas/${id}/approve/`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({ approver_name: approverName })
  });
  const data = await response.json();
  if (!response.ok) throw { status: response.status, data };
  return data;
};

export const revertGTAAgreement = async (id, remark) => {
  const response = await fetch(`${API_BASE_URL}/gtas/${id}/revert/`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({ remark })
  });
  const data = await response.json();
  if (!response.ok) throw { status: response.status, data };
  return data;
};

export const fetchCTList = async (customUser = null) => {
  const user = customUser || getCurrentUserFromStorage();
  const params = new URLSearchParams();
  if (user?.role === 'CUSTOMER') {
    params.append('role', 'CUSTOMER');
    if (user.email) params.append('customer_email', user.email);
    if (user.sap_customer_code) params.append('customer_code', user.sap_customer_code);
    if (user.company_name) params.append('company_name', user.company_name);
  }
  const queryStr = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`${API_BASE_URL}/capacity-tranches/${queryStr}`, {
    credentials: 'include',
    headers: getCustomerHeaders(user)
  });
  if (!response.ok) throw new Error('Failed to fetch CTs');
  return await response.json();
};

export const createCTRequest = async (ctData, customUser = null) => {
  const user = customUser || getCurrentUserFromStorage();
  const payload = {
    ...ctData,
    customer_email: user?.email || ctData.customer_email,
    customer_code: user?.sap_customer_code || ctData.customer_code,
    company_name: user?.company_name || ctData.company_name
  };
  const response = await fetch(`${API_BASE_URL}/capacity-tranches/`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getCustomerHeaders(user)
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) throw { status: response.status, data };
  return data;
};

export const updateCTRequest = async (id, ctData) => {
  const response = await fetch(`${API_BASE_URL}/capacity-tranches/${id}/`, {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify(ctData)
  });
  const data = await response.json();
  if (!response.ok) throw { status: response.status, data };
  return data;
};

export const approveCTRequest = async (id, approvalData = {}) => {
  const response = await fetch(`${API_BASE_URL}/capacity-tranches/${id}/approve/`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify(approvalData)
  });
  const data = await response.json();
  if (!response.ok) throw { status: response.status, data };
  return data;
};

export const executeCTRequest = async (id, executionData = {}) => {
  const response = await fetch(`${API_BASE_URL}/capacity-tranches/${id}/execute/`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify(executionData)
  });
  const data = await response.json();
  if (!response.ok) throw { status: response.status, data };
  return data;
};

export const fetchCTMasterData = async (customUser = null) => {
  const user = customUser || getCurrentUserFromStorage();
  const response = await fetch(`${API_BASE_URL}/capacity-tranches/master-data/`, {
    credentials: 'include',
    headers: getAuthHeaders(user)
  });
  if (!response.ok) throw new Error('Failed to fetch CT master data');
  return await response.json();
};

// UFT Path & Capacity Availability Endpoints
export const fetchUFTPaths = async () => {
  const response = await fetch(`${API_BASE_URL}/uft-paths/`, {
    credentials: 'include',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Failed to fetch UFT paths');
  return await response.json();
};

export const updateUFTPathCapacity = async (id, totalCapacity) => {
  const response = await fetch(`${API_BASE_URL}/uft-paths/${id}/`, {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({ total_capacity_mmbtu_day: totalCapacity })
  });
  const data = await response.json();
  if (!response.ok) throw { status: response.status, data };
  return data;
};

export const syncUFTPathsFromOData = async (forceSeed = false) => {
  const response = await fetch(`${API_BASE_URL}/uft-paths/sync-odata/`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({ force_seed: forceSeed })
  });
  const data = await response.json();
  if (!response.ok) throw { status: response.status, data };
  return data;
};

export const checkUFTCapacityAvailability = async (uftId, startDate, endDate, quantity = 0) => {
  const params = new URLSearchParams();
  if (uftId) params.append('uft_id', uftId);
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  if (quantity) params.append('quantity', quantity);

  const response = await fetch(`${API_BASE_URL}/uft-paths/check-availability/?${params.toString()}`, {
    credentials: 'include',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Failed to check capacity availability');
  return await response.json();
};



