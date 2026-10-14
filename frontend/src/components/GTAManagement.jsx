import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Search,
  CheckCircle,
  Clock,
  AlertCircle,
  Download,
  Eye,
  FileCheck,
  ShieldCheck,
  Building,
  ArrowRight,
  Filter,
  X,
  Layers,
  Calendar,
  Zap,
  Send,
  HelpCircle,
  Check,
  ChevronRight,
  Info,
  ExternalLink,
  Calculator,
  Mail,
  MapPin,
  Briefcase,
  Upload
} from 'lucide-react';
import {
  fetchGTAList,
  createGTARequest,
  approveGTAAgreement,
  revertGTAAgreement,
  fetchApprovedCustomers,
  resolveFileUrl
} from '../api';

export const GTAManagement = ({ role = 'CUSTOMER', currentUser, onNavigateCTs }) => {
  const [gtas, setGtas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Dropdown Master Data
  const [approvedCustomers, setApprovedCustomers] = useState([]);

  // Modals
  const [selectedGta, setSelectedGta] = useState(null); // Detail / Document modal (B5)
  const [showCreateModal, setShowCreateModal] = useState(false); // C4 modal
  const [showRevertModal, setShowRevertModal] = useState(null); // GTA object being reverted

  // File Upload State
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = React.useRef(null);

  // Revert Form State
  const [revertRemark, setRevertRemark] = useState('');
  const [isReverting, setIsReverting] = useState(false);

  // Shipper Identification & Master Data Form State
  const [newGtaForm, setNewGtaForm] = useState({
    customer_registration: '',
    shipper_name: '',
    customer_code: '',
    gstin: '',
    pan: '',
    agreement_date: new Date().toISOString().split('T')[0],
    valid_from: new Date().toISOString().split('T')[0],
    valid_to: '',
    shipper_entity_type: 'Private Limited Company',
    governing_statute_and_year: 'Companies Act, 2013',
    shipper_registered_office_address: '',
    reference_number: '',
    gta_document: null,
    remarks: ''
  });

  const isCustomer = role === 'CUSTOMER';
  const isAdmin = !isCustomer;

  useEffect(() => {
    loadInitialData();
  }, [currentUser?.email, currentUser?.sap_customer_code]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const gtasData = await fetchGTAList('', currentUser);
      setGtas(gtasData);

      if (isAdmin) {
        const customersData = await fetchApprovedCustomers().catch(() => []);
        setApprovedCustomers(customersData);
        if (customersData.length > 0) {
          applyCustomerToForm(customersData[0]);
        }
      } else if (currentUser) {
        setNewGtaForm((prev) => ({
          ...prev,
          shipper_name: currentUser.company_name || currentUser.full_name || '',
          customer_code: currentUser.sap_customer_code || '',
        }));
      }
    } catch (err) {
      console.error('Failed to load initial GTA data', err);
    } finally {
      setLoading(false);
    }
  };

  const loadGTAs = async () => {
    try {
      setLoading(true);
      const data = await fetchGTAList(activeTab !== 'ALL' ? activeTab : '', currentUser);
      setGtas(data);
    } catch (err) {
      console.error('Failed to load GTAs', err);
    } finally {
      setLoading(false);
    }
  };

  const applyCustomerToForm = (cust) => {
    if (!cust) return;
    setNewGtaForm((prev) => ({
      ...prev,
      customer_registration: cust.id,
      shipper_name: cust.company_name,
      customer_code: cust.customer_code !== 'PENDING_SAP' ? cust.customer_code : '',
      gstin: cust.gstin || '',
      pan: cust.pan || '',
      shipper_registered_office_address: cust.registered_office_address || prev.shipper_registered_office_address,
    }));
  };

  const handleCustomerSelectChange = (custId) => {
    const cust = approvedCustomers.find((c) => c.id === custId);
    if (cust) {
      applyCustomerToForm(cust);
    }
  };

  const handleFileSelected = (file) => {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      alert('File size exceeds the 25MB limit. Please upload a smaller document.');
      return;
    }
    setSelectedFile(file);
    setNewGtaForm((prev) => ({ ...prev, gta_document: file }));
  };

  const resetForm = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    const initialCust = approvedCustomers.length > 0 && isAdmin ? approvedCustomers[0] : null;
    setNewGtaForm({
      customer_registration: initialCust ? initialCust.id : '',
      shipper_name: initialCust ? initialCust.company_name : (currentUser?.company_name || currentUser?.full_name || ''),
      customer_code: initialCust ? (initialCust.customer_code !== 'PENDING_SAP' ? initialCust.customer_code : '') : (currentUser?.sap_customer_code || ''),
      gstin: initialCust ? (initialCust.gstin || '') : (currentUser?.tax_number || ''),
      pan: initialCust ? (initialCust.pan || '') : (currentUser?.pan_number || ''),
      agreement_date: new Date().toISOString().split('T')[0],
      valid_from: new Date().toISOString().split('T')[0],
      valid_to: '',
      shipper_entity_type: 'Private Limited Company',
      governing_statute_and_year: 'Companies Act, 2013',
      shipper_registered_office_address: initialCust?.registered_office_address || '',
      reference_number: '',
      gta_document: null,
      remarks: ''
    });
  };

  const handleCreateGTA = async (targetStatus = 'UNDER_REVIEW') => {
    if (!newGtaForm.shipper_name.trim()) {
      alert('Shipper Name is required.');
      return;
    }
    if (!newGtaForm.reference_number.trim()) {
      alert('GTA Reference Number is required. Please enter the reference number.');
      return;
    }
    if (!newGtaForm.valid_from) {
      alert('Agreement Valid From Date is required.');
      return;
    }
    if (!newGtaForm.valid_to) {
      alert('Agreement Valid To Date is required.');
      return;
    }
    if (newGtaForm.valid_from && newGtaForm.valid_to && newGtaForm.valid_from > newGtaForm.valid_to) {
      alert('Agreement Valid To Date cannot be earlier than Agreement Valid From Date.');
      return;
    }
    if (!newGtaForm.shipper_registered_office_address.trim()) {
      alert('Shipper Registered Office Address is required.');
      return;
    }
    if (targetStatus !== 'DRAFT' && !newGtaForm.gta_document) {
      alert('Please upload your GTA document file.');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        customer_registration: newGtaForm.customer_registration || null,
        shipper_name: newGtaForm.shipper_name.trim(),
        customer_code: newGtaForm.customer_code || '',
        gstin: newGtaForm.gstin || '',
        pan: newGtaForm.pan || '',
        agreement_date: newGtaForm.agreement_date || new Date().toISOString().split('T')[0],
        valid_from: newGtaForm.valid_from,
        valid_to: newGtaForm.valid_to,
        shipper_entity_type: newGtaForm.shipper_entity_type,
        governing_statute_and_year: newGtaForm.governing_statute_and_year,
        shipper_registered_office_address: newGtaForm.shipper_registered_office_address.trim(),
        reference_number: newGtaForm.reference_number.trim(),
        gta_number: newGtaForm.reference_number.trim(),
        gta_document: newGtaForm.gta_document,
        remarks: newGtaForm.remarks || '',
        status: targetStatus
      };

      await createGTARequest(payload, currentUser);
      setShowCreateModal(false);
      resetForm();
      await loadGTAs();
      alert(
        targetStatus === 'DRAFT'
          ? 'GTA saved as Draft successfully.'
          : `GTA (Ref: ${payload.reference_number}) uploaded and submitted for review successfully!`
      );
    } catch (err) {
      console.error('Error creating GTA:', err);
      let errMsg = 'Failed to submit GTA.';
      if (err.data) {
        if (typeof err.data === 'string') {
          errMsg = err.data;
        } else if (err.data.error) {
          errMsg = err.data.error;
        } else if (err.data.detail) {
          errMsg = err.data.detail;
        } else {
          errMsg = Object.entries(err.data)
            .map(([field, msgs]) => `${field.replace(/_/g, ' ')}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
            .join('\n');
        }
      } else if (err.message) {
        errMsg = err.message;
      }
      alert('Error submitting GTA:\n' + errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveGTA = async (gta) => {
    if (!window.confirm(`Approve GTA ${gta.gta_number}? It will become In Force immediately.`)) return;
    try {
      setLoading(true);
      await approveGTAAgreement(gta.id, currentUser?.full_name || 'Commercial Head IGGL');
      await loadGTAs();
      alert(`GTA ${gta.gta_number} has been approved and is now In Force.`);
    } catch (err) {
      alert('Failed to approve GTA: ' + (err?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleRevertGTA = async () => {
    if (!revertRemark.trim()) {
      alert('Please enter a remark before reverting.');
      return;
    }
    try {
      setIsReverting(true);
      await revertGTAAgreement(showRevertModal.id, revertRemark.trim());
      setShowRevertModal(null);
      setRevertRemark('');
      await loadGTAs();
      alert(`GTA ${showRevertModal.gta_number} has been reverted. The customer will see your remark.`);
    } catch (err) {
      alert('Failed to revert GTA: ' + (err?.data?.error || err.message));
    } finally {
      setIsReverting(false);
    }
  };

  // Helper for expiry calculation
  const getExpiryDetails = (validTo) => {
    if (!validTo) return { daysLeft: null, isExpiringSoon: false, isExpired: false };
    const today = new Date();
    const expiryDate = new Date(validTo);
    const diffTime = expiryDate - today;
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return {
      daysLeft,
      isExpired: daysLeft <= 0,
      isExpiringSoon: daysLeft > 0 && daysLeft <= 60
    };
  };

  // Filtered List
  const filteredGTAs = gtas.filter((g) => {
    if (activeTab === 'IN_FORCE' && g.status !== 'IN_FORCE') return false;
    if (activeTab === 'UNDER_REVIEW' && g.status !== 'UNDER_REVIEW' && g.status !== 'SUBMITTED') return false;
    if (activeTab === 'REVERTED' && g.status !== 'REVERTED') return false;
    if (activeTab === 'DRAFT' && g.status !== 'DRAFT') return false;
    if (activeTab === 'EXPIRED' && g.status !== 'EXPIRED') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNum = g.gta_number?.toLowerCase().includes(q);
      const matchRef = g.reference_number?.toLowerCase().includes(q);
      const matchShipper = g.shipper_name?.toLowerCase().includes(q);
      const matchEntity = g.shipper_entity_type?.toLowerCase().includes(q);
      const matchSap = g.sap_contract_number?.toLowerCase().includes(q);
      if (!matchNum && !matchRef && !matchShipper && !matchEntity && !matchSap) return false;
    }
    return true;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'IN_FORCE':
        return (
          <span style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', ...badgeStyle }}>
            ● In Force
          </span>
        );
      case 'READY_TO_SIGN':
      case 'ISSUED_FOR_SIGNATURE':
        return (
          <span style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', ...badgeStyle }}>
            ✍ Ready to Sign
          </span>
        );
      case 'UNDER_REVIEW':
      case 'SUBMITTED':
        return (
          <span style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a', ...badgeStyle }}>
            ⏱ Pending Review
          </span>
        );
      case 'REVERTED':
        return (
          <span style={{ background: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3', ...badgeStyle }}>
            ↩ Reverted
          </span>
        );
      case 'DRAFT':
        return (
          <span style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', ...badgeStyle }}>
            Draft
          </span>
        );
      case 'EXPIRED':
        return (
          <span style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', ...badgeStyle }}>
            Expired
          </span>
        );
      case 'TERMINATED':
        return (
          <span style={{ background: '#334155', color: '#ffffff', ...badgeStyle }}>
            Terminated
          </span>
        );
      default:
        return (
          <span style={{ background: '#f1f5f9', color: '#64748b', ...badgeStyle }}>
            {status}
          </span>
        );
    }
  };

  const inForceCount = gtas.filter((g) => g.status === 'IN_FORCE').length;
  const pendingReviewCount = gtas.filter((g) => g.status === 'UNDER_REVIEW' || g.status === 'SUBMITTED').length;
  const revertedCount = gtas.filter((g) => g.status === 'REVERTED').length;
  const draftCount = gtas.filter((g) => g.status === 'DRAFT').length;

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header Banner - Clean, flat, professional */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          padding: '1.15rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{ background: '#f8fafc', padding: '0.45rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <FileText size={20} color="#00823b" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Gas Transportation Agreements (GTAs)
              </h1>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
                Manage Master Gas Transportation Agreements, Shipper Master Data, and uploaded GTA documents.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
            style={{
              background: '#00823b',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '0.55rem 1.1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontSize: '0.825rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Plus size={16} />
            <span>{isAdmin ? 'Upload / Issue GTA' : 'Upload GTA Agreement'}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Bar - Simple, clean, professional */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div style={statCardStyle}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Total GTAs</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', marginTop: '0.25rem' }}>
            {gtas.length}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.15rem' }}>In Database</div>
        </div>

        <div style={statCardStyle}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>In Force (Active)</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', marginTop: '0.25rem' }}>
            {inForceCount}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.15rem' }}>Can Raise CT Requests</div>
        </div>

        <div style={statCardStyle}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Pending Review</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#d97706', marginTop: '0.25rem' }}>
            {pendingReviewCount}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.15rem' }}>Awaiting Admin Approval</div>
        </div>

        <div style={statCardStyle}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Reverted</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#be123c', marginTop: '0.25rem' }}>
            {revertedCount}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.15rem' }}>Returned to Customer</div>
        </div>
      </div>

      {/* Tabs & Search Controls */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          padding: '0.75rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.85rem'
        }}
      >
        <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto' }}>
          {[
            { id: 'ALL', label: `All (${gtas.length})` },
            { id: 'IN_FORCE', label: `In Force (${inForceCount})` },
            { id: 'UNDER_REVIEW', label: `Pending Review (${pendingReviewCount})` },
            { id: 'REVERTED', label: `Reverted (${revertedCount})` },
            { id: 'DRAFT', label: `Draft (${draftCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: activeTab === tab.id ? '#e8f5e9' : 'transparent',
                color: activeTab === tab.id ? '#00823b' : '#64748b',
                fontWeight: activeTab === tab.id ? 700 : 500,
                fontSize: '0.8rem',
                border: 'none',
                borderRadius: '6px',
                padding: '0.4rem 0.8rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', width: '320px' }}>
          <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
          <input
            type="text"
            placeholder="Search Shipper, GTA Reference #, Entity..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.45rem 0.75rem 0.45rem 2rem',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '0.8rem',
              outline: 'none'
            }}
          />
        </div>
      </div>

      {/* GTAs Table (Screen B4) */}
      <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
            <Clock size={24} color="#00823b" style={{ margin: '0 auto 0.75rem auto', animation: 'spin 1s linear infinite' }} />
            Loading Gas Transportation Agreements...
          </div>
        ) : filteredGTAs.length === 0 ? (
          <div style={{ padding: '3.5rem', textAlign: 'center', color: '#64748b' }}>
            <FileText size={42} color="#cbd5e1" style={{ margin: '0 auto 0.75rem auto' }} />
            <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.95rem' }}>No agreements found</div>
            <div style={{ fontSize: '0.8rem', marginTop: '0.25rem', color: '#64748b' }}>
              {searchQuery ? 'No GTAs match your filter criteria.' : 'No Gas Transportation Agreements recorded in the database.'}
            </div>
            {!searchQuery && (
              <button
                onClick={() => {
                  resetForm();
                  setShowCreateModal(true);
                }}
                style={{
                  marginTop: '1rem',
                  background: '#00823b',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.45rem 1rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {isAdmin ? '+ Create / Issue GTA' : '+ Upload GTA Agreement'}
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.825rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700, fontSize: '0.725rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '0.85rem 1.25rem' }}>GTA Reference / ID</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Agreement & Validity</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Shipper & Entity Type</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Registered Office Address</th>
                  <th style={{ padding: '0.85rem 1rem' }}>GTA Document</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredGTAs.map((g) => {
                  const docUrl = g.gta_document_url || g.document_url;
                  const fullDocUrl = docUrl ? resolveFileUrl(docUrl) : null;
                  return (
                    <tr
                      key={g.id}
                      style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s ease' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#fafbfc')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* GTA Reference / ID */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>
                            {g.reference_number || g.gta_number}
                          </span>
                          <span style={{ fontSize: '0.65rem', background: '#f1f5f9', color: '#64748b', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 600 }}>
                            v{g.version || '1.0'}
                          </span>
                        </div>
                        {g.reference_number && g.reference_number !== g.gta_number && (
                          <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '0.15rem' }}>
                            ID: {g.gta_number}
                          </div>
                        )}
                        {g.sap_contract_number && (
                          <div style={{ fontSize: '0.68rem', color: '#0369a1', marginTop: '0.15rem', fontWeight: 500 }}>
                            Contract No: {g.sap_contract_number}
                          </div>
                        )}
                      </td>

                      {/* Agreement & Validity Dates */}
                      <td style={{ padding: '1rem 1rem', color: '#334155' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{g.agreement_date || '—'}</div>
                        {(g.valid_from || g.valid_to) && (
                          <div style={{ fontSize: '0.7rem', color: '#059669', marginTop: '0.2rem', fontWeight: 500 }}>
                            {g.valid_from || '—'} to {g.valid_to || '—'}
                          </div>
                        )}
                      </td>

                      {/* Shipper & Entity Type */}
                      <td style={{ padding: '1rem 1rem' }}>
                        <div style={{ fontWeight: 700, color: '#1e293b' }}>{g.shipper_name}</div>
                        <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '0.15rem' }}>
                          {g.shipper_entity_type || 'Corporate Shipper'}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                          {g.governing_statute_and_year || 'Companies Act'}
                        </div>
                      </td>

                      {/* Registered Office Address */}
                      <td style={{ padding: '1rem 1rem', maxWidth: '240px' }}>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: '#475569',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                          title={g.shipper_registered_office_address}
                        >
                          {g.shipper_registered_office_address || '—'}
                        </div>
                      </td>

                      {/* Uploaded GTA Document */}
                      <td style={{ padding: '1rem 1rem' }}>
                        {fullDocUrl ? (
                          <a
                            href={fullDocUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.3rem 0.6rem',
                              background: '#f0fdf4',
                              color: '#15803d',
                              border: '1px solid #bbf7d0',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              textDecoration: 'none'
                            }}
                          >
                            <FileText size={13} />
                            <span>{g.gta_document_name || 'View GTA'}</span>
                            <ExternalLink size={11} />
                          </a>
                        ) : (
                          <span style={{ fontSize: '0.725rem', color: '#94a3b8', fontStyle: 'italic' }}>
                            Not attached
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '1rem 1rem' }}>
                        {getStatusBadge(g.status)}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.45rem', alignItems: 'center' }}>
                          <button
                            onClick={() => setSelectedGta(g)}
                            title="View Agreement Details"
                            style={{
                              background: '#ffffff',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              padding: '0.35rem 0.6rem',
                              cursor: 'pointer',
                              color: '#334155',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              fontSize: '0.75rem',
                              fontWeight: 600
                            }}
                          >
                            <Eye size={13} />
                            <span>View</span>
                          </button>

                          {/* Rule §5.1: Raise CT button enabled ONLY if GTA is IN FORCE */}
                          <button
                            onClick={() => onNavigateCTs && onNavigateCTs(g)}
                            disabled={!g.is_in_force}
                            title={g.is_in_force ? "Raise Capacity Tranche against this GTA" : "Capacity Tranches can only be requested against an in-force GTA"}
                            style={{
                              background: g.is_in_force ? '#00823b' : '#f1f5f9',
                              color: g.is_in_force ? '#ffffff' : '#94a3b8',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '0.35rem 0.65rem',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: g.is_in_force ? 'pointer' : 'not-allowed',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem'
                            }}
                          >
                            <Plus size={13} />
                            <span>+ Raise CT</span>
                          </button>

                          {/* Admin: Approve + Revert buttons for pending GTAs */}
                          {isAdmin && (g.status === 'UNDER_REVIEW' || g.status === 'SUBMITTED') && (
                            <>
                              <button
                                onClick={() => handleApproveGTA(g)}
                                style={{
                                  background: '#00823b',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '0.35rem 0.65rem',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  fontSize: '0.75rem',
                                  fontWeight: 700
                                }}
                              >
                                <CheckCircle size={13} />
                                <span>Approve</span>
                              </button>
                              <button
                                onClick={() => { setShowRevertModal(g); setRevertRemark(''); }}
                                style={{
                                  background: '#fff1f2',
                                  color: '#be123c',
                                  border: '1px solid #fecdd3',
                                  borderRadius: '6px',
                                  padding: '0.35rem 0.65rem',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  fontSize: '0.75rem',
                                  fontWeight: 700
                                }}
                              >
                                <X size={13} />
                                <span>Revert</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Create / Upload Gas Transportation Agreement */}
      {showCreateModal && (
        <div style={modalBackdropStyle}>
          <div style={{ ...modalContentStyle, maxWidth: '780px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.9rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ background: '#f8fafc', padding: '0.45rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <Building size={20} color="#00823b" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                    {isAdmin ? 'Upload / Issue GTA Agreement' : 'Upload Gas Transportation Agreement (GTA)'}
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Shipper Identification & Master Data
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleCreateGTA('UNDER_REVIEW'); }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem', fontSize: '0.825rem' }}>
                
                {/* Shipper Identification & Master Data */}
                <div style={sectionBoxStyle}>
                  <div style={sectionTitleStyle}>Shipper Identification & Master Data</div>

                  {isAdmin && approvedCustomers.length > 0 && (
                    <div style={{ marginBottom: '0.85rem' }}>
                      <label style={formLabelStyle}>Select Approved Customer / Shipper *</label>
                      <select
                        value={newGtaForm.customer_registration}
                        onChange={(e) => handleCustomerSelectChange(e.target.value)}
                        style={formInputStyle}
                      >
                        {approvedCustomers.map((cust) => (
                          <option key={cust.id} value={cust.id}>
                            {cust.company_name} — Customer Code: {cust.customer_code} (Reg: {cust.registration_number})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '0.85rem' }}>
                    <div>
                      <label style={formLabelStyle}>Shipper Legal Name *</label>
                      <input
                        type="text"
                        required
                        value={newGtaForm.shipper_name}
                        onChange={(e) => setNewGtaForm({ ...newGtaForm, shipper_name: e.target.value })}
                        style={formInputStyle}
                      />
                    </div>

                    <div>
                      <label style={formLabelStyle}>GTA Reference Number *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. IGGL/GTA/2026/001 or Customer Ref No."
                        value={newGtaForm.reference_number}
                        onChange={(e) => setNewGtaForm({ ...newGtaForm, reference_number: e.target.value })}
                        style={formInputStyle}
                      />
                    </div>

                    <div>
                      <label style={formLabelStyle}>Agreement Date *</label>
                      <input
                        type="date"
                        required
                        value={newGtaForm.agreement_date}
                        onChange={(e) => setNewGtaForm({ ...newGtaForm, agreement_date: e.target.value })}
                        style={formInputStyle}
                      />
                    </div>

                    <div>
                      <label style={formLabelStyle}>Agreement From Date *</label>
                      <input
                        type="date"
                        required
                        value={newGtaForm.valid_from}
                        onChange={(e) => setNewGtaForm({ ...newGtaForm, valid_from: e.target.value })}
                        style={formInputStyle}
                      />
                    </div>

                    <div>
                      <label style={formLabelStyle}>Agreement To Date *</label>
                      <input
                        type="date"
                        required
                        value={newGtaForm.valid_to}
                        onChange={(e) => setNewGtaForm({ ...newGtaForm, valid_to: e.target.value })}
                        style={formInputStyle}
                      />
                    </div>

                    <div>
                      <label style={formLabelStyle}>Shipper Entity Type *</label>
                      <select
                        value={newGtaForm.shipper_entity_type}
                        onChange={(e) => setNewGtaForm({ ...newGtaForm, shipper_entity_type: e.target.value })}
                        style={formInputStyle}
                      >
                        <option value="Private Limited Company">Private Limited Company</option>
                        <option value="Public Limited Company">Public Limited Company</option>
                        <option value="Public Sector Undertaking (PSU)">Public Sector Undertaking (PSU)</option>
                        <option value="Partnership Firm">Partnership Firm</option>
                        <option value="Limited Liability Partnership (LLP)">Limited Liability Partnership (LLP)</option>
                        <option value="Sole Proprietorship">Sole Proprietorship</option>
                        <option value="Statutory Corporation">Statutory Corporation</option>
                      </select>
                    </div>

                    <div>
                      <label style={formLabelStyle}>Governing Statute and Year *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Companies Act, 2013"
                        value={newGtaForm.governing_statute_and_year}
                        onChange={(e) => setNewGtaForm({ ...newGtaForm, governing_statute_and_year: e.target.value })}
                        style={formInputStyle}
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: '0.85rem' }}>
                    <label style={formLabelStyle}>Shipper Registered Office Address *</label>
                    <textarea
                      rows="2"
                      required
                      placeholder="Full postal address of registered office"
                      value={newGtaForm.shipper_registered_office_address}
                      onChange={(e) => setNewGtaForm({ ...newGtaForm, shipper_registered_office_address: e.target.value })}
                      style={{ ...formInputStyle, resize: 'vertical' }}
                    />
                  </div>

                  {/* Direct GTA Document Upload */}
                  <div style={{ marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                    <label style={{ ...formLabelStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Upload GTA Agreement Document (PDF, Word, or Scanned copy) *</span>
                      <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Max size: 25 MB</span>
                    </label>

                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const file = e.dataTransfer.files?.[0];
                        if (file) handleFileSelected(file);
                      }}
                      style={{
                        border: selectedFile ? '2px solid #22c55e' : '2px dashed #cbd5e1',
                        borderRadius: '8px',
                        padding: '1.25rem',
                        textAlign: 'center',
                        background: selectedFile ? '#f0fdf4' : '#f8fafc',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        minHeight: '120px'
                      }}
                    >
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileSelected(file);
                        }}
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        style={{ display: 'none' }}
                      />

                      {selectedFile ? (
                        <>
                          <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Check size={22} color="#15803d" />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: '#15803d', fontSize: '0.875rem' }}>
                              {selectedFile.name}
                            </div>
                            <div style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '0.15rem' }}>
                              {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB · Click or drag new file to replace
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Upload size={20} color="#00823b" />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.85rem' }}>
                              Click to browse or drag & drop your GTA agreement document
                            </div>
                            <div style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '0.2rem' }}>
                              Supports PDF, DOC, DOCX, JPG, PNG
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div style={{ marginTop: '0.85rem' }}>
                    <label style={formLabelStyle}>Remarks / Notes (Optional)</label>
                    <input
                      type="text"
                      placeholder="Any additional notes or comments"
                      value={newGtaForm.remarks}
                      onChange={(e) => setNewGtaForm({ ...newGtaForm, remarks: e.target.value })}
                      style={formInputStyle}
                    />
                  </div>
                </div>

              </div>

              {/* Form Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  style={{
                    padding: '0.55rem 1.15rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleCreateGTA('DRAFT')}
                    style={{
                      padding: '0.55rem 1.15rem',
                      borderRadius: '6px',
                      border: '1px solid #94a3b8',
                      background: '#f8fafc',
                      color: '#334155',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Save as Draft
                  </button>
                )}

                <button
                  type="submit"
                  style={{
                    padding: '0.55rem 1.35rem',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#00823b',
                    color: '#ffffff',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {isAdmin ? 'Submit GTA for Review' : 'Upload & Submit GTA'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View Agreement Contract Details (Screen B5) */}
      {selectedGta && (
        <div style={modalBackdropStyle}>
          <div style={{ ...modalContentStyle, maxWidth: '800px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.9rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ background: '#f8fafc', padding: '0.45rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <FileText size={20} color="#00823b" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                      Gas Transportation Agreement: {selectedGta.reference_number || selectedGta.gta_number}
                    </h3>
                    <span style={{ fontSize: '0.7rem', background: '#f1f5f9', color: '#475569', padding: '0.1rem 0.45rem', borderRadius: '4px', fontWeight: 600 }}>
                      v{selectedGta.version || '1.0'}
                    </span>
                    {getStatusBadge(selectedGta.status)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                    Shipper: <strong>{selectedGta.shipper_name}</strong> {selectedGta.customer_code ? `· Customer Code: ${selectedGta.customer_code}` : ''} {selectedGta.sap_contract_number ? `· Contract No: ${selectedGta.sap_contract_number}` : ''}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedGta(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* B5 Content Body */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem', fontSize: '0.825rem' }}>
              
              {/* Shipper Identification & Master Data */}
              <div style={sectionBoxStyle}>
                <div style={sectionTitleStyle}>Shipper Identification & Master Data</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
                  <div>
                    <span style={specLabelStyle}>Shipper Legal Name:</span>
                    <div style={specValueStyle}>{selectedGta.shipper_name}</div>
                  </div>
                  <div>
                    <span style={specLabelStyle}>GTA Reference Number:</span>
                    <div style={{ ...specValueStyle, fontWeight: 700, color: '#00823b' }}>
                      {selectedGta.reference_number || selectedGta.gta_number}
                    </div>
                  </div>
                  <div>
                    <span style={specLabelStyle}>Agreement Date:</span>
                    <div style={specValueStyle}>{selectedGta.agreement_date || '—'}</div>
                  </div>
                  <div>
                    <span style={specLabelStyle}>Agreement Valid From:</span>
                    <div style={{ ...specValueStyle, color: '#059669', fontWeight: 600 }}>{selectedGta.valid_from || '—'}</div>
                  </div>
                  <div>
                    <span style={specLabelStyle}>Agreement Valid To:</span>
                    <div style={{ ...specValueStyle, color: '#059669', fontWeight: 600 }}>{selectedGta.valid_to || '—'}</div>
                  </div>
                  <div>
                    <span style={specLabelStyle}>Shipper Entity Type:</span>
                    <div style={specValueStyle}>{selectedGta.shipper_entity_type || 'Private Limited Company'}</div>
                  </div>
                  <div>
                    <span style={specLabelStyle}>Governing Statute & Year:</span>
                    <div style={specValueStyle}>{selectedGta.governing_statute_and_year || 'Companies Act, 2013'}</div>
                  </div>
                  {selectedGta.customer_code && (
                    <div>
                      <span style={specLabelStyle}>Customer Code:</span>
                      <div style={specValueStyle}>{selectedGta.customer_code}</div>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '0.85rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                  <span style={specLabelStyle}>Shipper Registered Office Address:</span>
                  <div style={{ ...specValueStyle, color: '#334155', fontWeight: 500 }}>
                    {selectedGta.shipper_registered_office_address || '—'}
                  </div>
                </div>
              </div>

              {/* Uploaded GTA Document Card */}
              <div style={sectionBoxStyle}>
                <div style={sectionTitleStyle}>Uploaded GTA Document</div>
                {(selectedGta.gta_document_url || selectedGta.document_url) ? (
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '1rem',
                      flexWrap: 'wrap'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ background: '#dcfce7', padding: '0.55rem', borderRadius: '8px', color: '#15803d' }}>
                        <FileText size={24} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.875rem' }}>
                          {selectedGta.gta_document_name || `${selectedGta.reference_number || selectedGta.gta_number}_Agreement.pdf`}
                        </div>
                        <div style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '0.15rem' }}>
                          Uploaded GTA Agreement Document File
                        </div>
                      </div>
                    </div>

                    <a
                      href={resolveFileUrl(selectedGta.gta_document_url || selectedGta.document_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        background: '#00823b',
                        color: '#ffffff',
                        padding: '0.5rem 0.95rem',
                        borderRadius: '6px',
                        textDecoration: 'none',
                        fontSize: '0.8rem',
                        fontWeight: 600
                      }}
                    >
                      <Download size={14} />
                      <span>Download / View GTA</span>
                    </a>
                  </div>
                ) : (
                  <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '6px', color: '#94a3b8', fontSize: '0.78rem', fontStyle: 'italic' }}>
                    No GTA document file attached to this record.
                  </div>
                )}

                {selectedGta.remarks && (
                  <div style={{ marginTop: '0.85rem' }}>
                    <span style={specLabelStyle}>Remarks / Notes:</span>
                    <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '0.2rem' }}>
                      {selectedGta.remarks}
                    </div>
                  </div>
                )}

                {selectedGta.admin_remark && (
                  <div style={{ marginTop: '0.85rem', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '6px', padding: '0.75rem' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#be123c', marginBottom: '0.25rem' }}>↩ Admin Remark (Revert Note):</div>
                    <div style={{ fontSize: '0.78rem', color: '#9f1239' }}>{selectedGta.admin_remark}</div>
                  </div>
                )}
              </div>


            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
              <div>
                {/* Show admin remark to customer when reverted */}
                {isCustomer && selectedGta.status === 'REVERTED' && selectedGta.admin_remark && (
                  <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '6px', padding: '0.7rem 1rem', maxWidth: '420px' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#be123c', marginBottom: '0.3rem' }}>↩ Reverted by IGGL Admin</div>
                    <div style={{ fontSize: '0.8rem', color: '#9f1239' }}>{selectedGta.admin_remark}</div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => setSelectedGta(null)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
                {(selectedGta.gta_document_url || selectedGta.document_url) && (
                  <a
                    href={resolveFileUrl(selectedGta.gta_document_url || selectedGta.document_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '0.5rem 1.15rem',
                      borderRadius: '6px',
                      border: 'none',
                      background: '#00823b',
                      color: '#ffffff',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      textDecoration: 'none'
                    }}
                  >
                    <Download size={14} />
                    <span>Download GTA (PDF)</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Revert GTA with Remark (Admin) */}
      {showRevertModal && (
        <div style={modalBackdropStyle}>
          <div style={{ ...modalContentStyle, maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.9rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ background: '#fff1f2', padding: '0.45rem', borderRadius: '6px', border: '1px solid #fecdd3' }}>
                  <AlertCircle size={20} color="#be123c" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                    Revert GTA with Remark
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {showRevertModal.gta_number} · {showRevertModal.shipper_name}
                  </div>
                </div>
              </div>
              <button
                onClick={() => { setShowRevertModal(null); setRevertRemark(''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '6px', padding: '0.75rem', fontSize: '0.8rem', color: '#9f1239' }}>
                The GTA will be returned to the customer as <strong>Reverted</strong>. Your remark will be visible to them on their portal so they know what to fix and resubmit.
              </div>

              <div>
                <label style={formLabelStyle}>Remark for Customer *</label>
                <textarea
                  rows={4}
                  placeholder="e.g. Please re-upload a clearer copy of the signed GTA document. The uploaded file is not legible."
                  value={revertRemark}
                  onChange={(e) => setRevertRemark(e.target.value)}
                  style={{ ...formInputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                />
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                  This remark will be shown to the shipper on their GTA Management page.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
              <button
                onClick={() => { setShowRevertModal(null); setRevertRemark(''); }}
                style={{
                  padding: '0.55rem 1.15rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRevertGTA}
                disabled={!revertRemark.trim() || isReverting}
                style={{
                  padding: '0.55rem 1.35rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: revertRemark.trim() ? '#be123c' : '#94a3b8',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: revertRemark.trim() && !isReverting ? 'pointer' : 'not-allowed'
                }}
              >
                {isReverting ? 'Reverting...' : 'Revert GTA'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Styling definitions - Clean, flat, enterprise
const badgeStyle = {
  fontSize: '0.7rem',
  fontWeight: 700,
  padding: '0.2rem 0.55rem',
  borderRadius: '4px',
  display: 'inline-block'
};

const statCardStyle = {
  background: '#ffffff',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  padding: '1rem 1.25rem'
};

const modalBackdropStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(15, 23, 42, 0.45)',
  zIndex: 100,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1.5rem'
};

const modalContentStyle = {
  background: '#ffffff',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  width: '100%',
  maxHeight: '92vh',
  overflowY: 'auto',
  padding: '1.75rem',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.08)'
};

const sectionBoxStyle = {
  border: '1px solid #e2e8f0',
  borderRadius: '6px',
  padding: '1rem',
  background: '#ffffff'
};

const sectionTitleStyle = {
  fontWeight: 700,
  fontSize: '0.825rem',
  color: '#0f172a',
  marginBottom: '0.75rem'
};

const specLabelStyle = {
  fontSize: '0.7rem',
  color: '#64748b',
  fontWeight: 600,
  display: 'block'
};

const specValueStyle = {
  fontSize: '0.825rem',
  color: '#0f172a',
  fontWeight: 600,
  marginTop: '0.15rem'
};

const formLabelStyle = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: '#334155',
  marginBottom: '0.3rem'
};

const formInputStyle = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  borderRadius: '6px',
  border: '1px solid #cbd5e1',
  fontSize: '0.825rem',
  outline: 'none',
  background: '#ffffff',
  boxSizing: 'border-box'
};
