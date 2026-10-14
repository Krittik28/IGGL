import React, { useState, useEffect } from 'react';
import {
  fetchAdminRegistrations,
  fetchRegistrationDetail,
  reviewAndEnrichRegistration,
  retrySAPPosting,
  fetchSAPMasterData,
  resolveFileUrl,
} from '../api';
import {
  CheckCircle,
  AlertTriangle,
  Clock,
  XCircle,
  Eye,
  Send,
  RotateCw,
  FileCode,
  ShieldCheck,
  Building,
  Check,
  X,
  FileText,
  Download,
  ExternalLink,
  Plus,
  Trash2,
  Layers,
  Receipt,
} from 'lucide-react';

const EMPTY_MASTER_DATA = {
  companySet: [],
  PartnerCategorySet: [],
  RegionSet: [],
  AccountGroupSet: [],
  ReconciliationAccountSet: [],
  Termsof_PaymentSet: [],
  SalesORGSet: [],
  PricingProcedureSet: [],
  CustomerPriceGroupSet: [],
  IncoTermSet: [],
  ShippingConditionsSet: [],
  AccountAssignmentGroupSet: [],
  TaxTypeSet: [],
  TaxClassificationSet: []
};

export const AdminRegistrationQueue = ({ currentUser }) => {
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedReg, setSelectedReg] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [masterData, setMasterData] = useState(EMPTY_MASTER_DATA);
  const [masterDataLoading, setMasterDataLoading] = useState(false);

  // Admin form state for currently opened registration
  const [adminFields, setAdminFields] = useState({
    company_code: '',
    partner_category: '',
    region: '',
    account_group: '',
    recon_account: '',
    payment_terms: '',
    sales_org: '',
    distribution_channel: '',
    division: '',
    pricing_procedure: '',
    customer_price_group: '',
    inco_term: '',
    shipping_conditions: '',
    currency: 'INR',
    order_probability: '100',
    account_assignment_group: '',
    tax_details: [],
    remarks: '',
  });

  const [showPayload, setShowPayload] = useState(false);

  const isSapConnected = Object.values(masterData).some(arr => Array.isArray(arr) && arr.length > 0);

  const renderSelectOptions = (options, currentValue, placeholder = 'Select from SAP') => {
    const list = Array.isArray(options) ? options : [];
    if (list.length === 0) {
      return (
        <option value={currentValue || ''}>
          {currentValue ? `${currentValue} (Current)` : '-- No SAP Data (Connect VPN) --'}
        </option>
      );
    }
    const hasCurrent = currentValue && list.some(opt => String(opt.code) === String(currentValue));
    return (
      <>
        <option value="">-- {placeholder} --</option>
        {currentValue && !hasCurrent && (
          <option value={currentValue}>{currentValue} (Current)</option>
        )}
        {list.map(opt => (
          <option key={opt.code} value={opt.code}>{opt.label}</option>
        ))}
      </>
    );
  };

  const loadMasterData = async (force = false) => {
    try {
      setMasterDataLoading(true);
      const data = await fetchSAPMasterData(force);
      if (data && Object.keys(data).length > 0) {
        setMasterData(prev => ({ ...prev, ...data }));
      }
    } catch (err) {
      console.warn('Could not fetch live SAP master data (VPN may be disconnected):', err);
    } finally {
      setMasterDataLoading(false);
    }
  };

  useEffect(() => {
    loadRegistrations();
    loadMasterData();
  }, [statusFilter]);

  const loadRegistrations = async () => {
    setLoading(true);
    try {
      const data = await fetchAdminRegistrations(statusFilter, search);
      setRegistrations(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReview = async (id) => {
    setModalLoading(true);
    setMessage(null);
    setShowPayload(false);
    try {
      loadMasterData();
      const detail = await fetchRegistrationDetail(id);
      setSelectedReg(detail);

      let initialTaxes = [
        { Tatyp: 'JOIG', Taxad: '0', Takld: '0' }
      ];

      if (Array.isArray(detail.tax_details) && detail.tax_details.length > 0) {
        initialTaxes = detail.tax_details.map(t => ({
          Tatyp: t.Tatyp || 'JVAT',
          Taxad: String(t.Taxad !== undefined ? t.Taxad : (t.Takld !== undefined ? t.Takld : '0')),
          Takld: String(t.Takld !== undefined ? t.Takld : (t.Taxad !== undefined ? t.Taxad : '0'))
        }));
      } else if (typeof detail.tax_details === 'string') {
        try {
          const parsed = JSON.parse(detail.tax_details);
          if (Array.isArray(parsed) && parsed.length > 0) {
            initialTaxes = parsed.map(t => ({
              Tatyp: t.Tatyp || 'JVAT',
              Taxad: String(t.Taxad !== undefined ? t.Taxad : (t.Takld !== undefined ? t.Takld : '0')),
              Takld: String(t.Takld !== undefined ? t.Takld : (t.Taxad !== undefined ? t.Taxad : '0'))
            }));
          }
        } catch (e) {}
      } else if (detail.tax_type) {
        const types = detail.tax_type.split(',').map(s => s.trim()).filter(Boolean);
        const rawClasses = (detail.tax_classification || detail.tax_ad || '').split(',').map(s => s.trim());
        if (types.length > 0) {
          initialTaxes = types.map((t, i) => {
            const cls = rawClasses[i] !== undefined && rawClasses[i] !== '' ? rawClasses[i] : '0';
            return {
              Tatyp: t,
              Taxad: cls,
              Takld: cls
            };
          });
        }
      }

      setAdminFields({
        company_code: detail.company_code || '',
        partner_category: detail.partner_category || '',
        region: detail.region || '',
        account_group: detail.account_group || '',
        recon_account: detail.recon_account || '',
        payment_terms: detail.payment_terms || '',
        sales_org: detail.sales_org || '',
        distribution_channel: detail.distribution_channel || '',
        division: detail.division || '',
        pricing_procedure: detail.pricing_procedure || '',
        customer_price_group: detail.customer_price_group || '',
        inco_term: detail.inco_term || '',
        shipping_conditions: detail.shipping_conditions || '',
        currency: detail.currency || 'INR',
        order_probability: detail.order_probability || '100',
        account_assignment_group: detail.account_assignment_group || '',
        tax_details: initialTaxes,
        remarks: detail.remarks || '',
      });
    } catch (err) {
      console.error(err);
    } finally {
      setModalLoading(false);
    }
  };

  const handleAction = async (actionType) => {
    if (!selectedReg) return;
    setActionLoading(true);
    setMessage(null);

    try {
      const taxes = adminFields.tax_details && adminFields.tax_details.length > 0
        ? adminFields.tax_details
        : [{ Tatyp: 'JOIG', Taxad: '0', Takld: '0' }];

      const tatypStr = taxes.map(t => t.Tatyp).filter(Boolean).join(',');
      const taxadStr = taxes.map(t => t.Taxad !== undefined ? t.Taxad : (t.Takld || '0')).join(',');

      const payload = {
        ...adminFields,
        tax_type: tatypStr || 'JOIG',
        tax_classification: taxadStr || '0',
        tax_ad: taxadStr || '0',
        tax_details: taxes.map(t => ({
          Tatyp: t.Tatyp,
          Taxad: t.Taxad !== undefined ? t.Taxad : (t.Takld || '0'),
          Takld: t.Taxad !== undefined ? t.Taxad : (t.Takld || '0')
        })),
        action: actionType,
      };
      const res = await reviewAndEnrichRegistration(selectedReg.id, payload);
      setMessage({ type: 'success', text: res.message });
      setSelectedReg(res.data);
      loadRegistrations();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.data?.error || err.data?.message || 'Action failed. Please verify required fields.'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetrySAP = async () => {
    if (!selectedReg) return;
    setActionLoading(true);
    try {
      const res = await retrySAPPosting(selectedReg.id);
      setMessage({ type: 'success', text: res.message });
      setSelectedReg(res.data);
      loadRegistrations();
    } catch (err) {
      setMessage({ type: 'error', text: err.data?.details || 'SAP retry failed' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddTaxLine = () => {
    setAdminFields(prev => ({
      ...prev,
      tax_details: [...(prev.tax_details || []), { Tatyp: 'JVAT', Taxad: '0', Takld: '0' }]
    }));
  };

  const handleUpdateTaxLine = (index, field, value) => {
    setAdminFields(prev => {
      const list = [...(prev.tax_details || [])];
      list[index] = { ...list[index], [field]: value };
      if (field === 'Taxad') list[index].Takld = value;
      if (field === 'Takld') list[index].Taxad = value;
      return { ...prev, tax_details: list };
    });
  };

  const handleRemoveTaxLine = (index) => {
    setAdminFields(prev => {
      const list = (prev.tax_details || []).filter((_, i) => i !== index);
      return { ...prev, tax_details: list.length > 0 ? list : [{ Tatyp: 'JOIG', Taxad: '0', Takld: '0' }] };
    });
  };



  const getStatusBadge = (status) => {
    switch (status) {
      case 'BP_CREATED':
        return <span className="badge badge-green"><CheckCircle size={12} /> BP Created</span>;
      case 'APPROVED':
        return <span className="badge badge-green"><Check size={12} /> Approved</span>;
      case 'UNDER_REVIEW':
        return <span className="badge badge-blue"><Clock size={12} /> Under Review</span>;
      case 'RETURNED':
        return <span className="badge badge-orange"><AlertTriangle size={12} /> Returned</span>;
      case 'REJECTED':
        return <span className="badge badge-red"><XCircle size={12} /> Rejected</span>;
      default:
        return <span className="badge badge-gray"><Clock size={12} /> Submitted</span>;
    }
  };

  return (
    <div>
      {/* Legend Header */}
      <div className="legend-bar">
        <span style={{ fontWeight: 600, color: '#0f172a' }}>Field Ownership:</span>
        <div className="legend-item">
          <div className="legend-dot green"></div>
          <span>Green = Customer Entered</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot orange"></div>
          <span>Orange = Admin Enriched</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot gray"></div>
          <span>Grey = System Auto Generated</span>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Customer Registration Work Queue (Screen C2/C3)</h2>
            <p className="card-subtitle">
              Review customer submissions, enrich master data fields, and dispatch payload to SAP S/4HANA.
            </p>
          </div>
          <button onClick={loadRegistrations} className="btn btn-secondary" style={{ fontSize: '0.8rem' }}>
            <RotateCw size={14} /> Refresh Queue
          </button>
        </div>

        {/* Filter Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {[
              { label: 'All', value: '' },
              { label: 'Submitted', value: 'SUBMITTED' },
              { label: 'Under Review', value: 'UNDER_REVIEW' },
              { label: 'BP Created', value: 'BP_CREATED' },
              { label: 'Returned', value: 'RETURNED' },
              { label: 'Rejected', value: 'REJECTED' },
            ].map(f => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`btn ${statusFilter === f.value ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); loadRegistrations(); }} style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, PAN, GSTIN, ref..."
              className="form-input"
              style={{ width: '260px', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
            />
            <button type="submit" className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}>
              Filter
            </button>
          </form>
        </div>

        {/* Table */}
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Reference No.</th>
                <th>Company Name</th>
                <th>City</th>
                <th>GSTIN</th>
                <th>PAN</th>
                <th>Status</th>
                <th>Customer Number</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    Loading registrations...
                  </td>
                </tr>
              ) : registrations.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    No customer registrations found matching filter criteria.
                  </td>
                </tr>
              ) : (
                registrations.map(reg => (
                  <tr key={reg.id}>
                    <td style={{ fontFamily: 'JetBrains Mono', fontWeight: 600, color: '#0284c7' }}>
                      {reg.registration_number}
                    </td>
                    <td style={{ fontWeight: 600 }}>{reg.name1}</td>
                    <td>{reg.city}</td>
                    <td style={{ fontFamily: 'JetBrains Mono', fontSize: '0.8rem' }}>{reg.tax_number}</td>
                    <td style={{ fontFamily: 'JetBrains Mono', fontSize: '0.8rem' }}>{reg.pan_number}</td>
                    <td>{getStatusBadge(reg.status)}</td>
                    <td style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: '#059669' }}>
                      {reg.customer_number || '—'}
                    </td>
                    <td>
                      <button
                        onClick={() => handleOpenReview(reg.id)}
                        className="btn btn-secondary"
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                      >
                        <Eye size={14} /> Review & Enrich
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review & Enrichment Modal */}
      {selectedReg && (
        <div className="modal-overlay" onClick={() => setSelectedReg(null)}>
          <div className="modal-content" style={{ maxWidth: '960px', width: '95%' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                  Customer Master Review & SAP Enrichment
                </span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                  {selectedReg.name1}
                </h3>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.85rem', color: '#0284c7', fontWeight: 600 }}>
                  Ref: {selectedReg.registration_number}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {getStatusBadge(selectedReg.status)}
                <button
                  onClick={() => setSelectedReg(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {message && (
              <div
                style={{
                  padding: '0.875rem',
                  borderRadius: '8px',
                  marginBottom: '1.25rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  background: message.type === 'success' ? '#ecfdf5' : '#fef2f2',
                  border: `1px solid ${message.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
                  color: message.type === 'success' ? '#065f46' : '#991b1b',
                }}
              >
                {message.text}
              </div>
            )}

            {/* If BP Already Created */}
            {selectedReg.customer_number && (
              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '1rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#065f46', fontWeight: 700, fontSize: '0.9rem' }}>
                    <ShieldCheck size={18} />
                    <span>Customer Master Created in SAP S/4HANA</span>
                  </div>
                  <div style={{ display: 'flex', gap: '2rem', marginTop: '0.35rem' }}>
                    <div>
                      <span style={{ fontSize: '0.7rem', color: '#047857', textTransform: 'uppercase' }}>Customer Number:</span>
                      <strong style={{ fontFamily: 'JetBrains Mono', marginLeft: '0.35rem', color: '#065f46' }}>{selectedReg.customer_number}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.7rem', color: '#047857', textTransform: 'uppercase' }}>Address Number:</span>
                      <strong style={{ fontFamily: 'JetBrains Mono', marginLeft: '0.35rem', color: '#065f46' }}>{selectedReg.address_number}</strong>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowPayload(!showPayload)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                >
                  <FileCode size={13} /> {showPayload ? 'Hide SAP Payload' : 'View SAP Payload'}
                </button>
              </div>
            )}

            {showPayload && selectedReg.sap_payload && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>
                  DISPATCHED ODATA JSON PAYLOAD:
                </div>
                <pre className="code-box">{JSON.stringify(selectedReg.sap_payload, null, 2)}</pre>
                {selectedReg.sap_response && (
                  <>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginTop: '0.75rem', marginBottom: '0.25rem' }}>
                      SAP S/4HANA ODATA RESPONSE:
                    </div>
                    <pre className="code-box">{JSON.stringify(selectedReg.sap_response, null, 2)}</pre>
                  </>
                )}
              </div>
            )}

            {/* Section 1: Customer Data (Read Only for Admin) */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="badge badge-green">Customer Submitted Master & Address Data</span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Read-only (Captured via Self-Registration Portal)</span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.75rem', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Company Name:</span>
                  <div style={{ fontWeight: 600 }}>{selectedReg.name1}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Name (continuation):</span>
                  <div style={{ fontWeight: 500, color: selectedReg.name2 ? '#0f172a' : '#94a3b8' }}>{selectedReg.name2 || '—'}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Address Line 1:</span>
                  <div>{selectedReg.street}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Address Line 2:</span>
                  <div style={{ color: selectedReg.street_suppl1 ? '#0f172a' : '#94a3b8' }}>{selectedReg.street_suppl1 || '—'}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Address Line 3:</span>
                  <div style={{ color: selectedReg.street_suppl2 ? '#0f172a' : '#94a3b8' }}>{selectedReg.street_suppl2 || '—'}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Address Line 4:</span>
                  <div style={{ color: selectedReg.street_suppl3 ? '#0f172a' : '#94a3b8' }}>{selectedReg.street_suppl3 || '—'}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem' }}>City:</span>
                  <div>{selectedReg.city}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem' }}>District:</span>
                  <div>{selectedReg.district || selectedReg.city || '—'}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Region / State:</span>
                  <div style={{ fontWeight: 600 }}>{selectedReg.region || '08'}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Country:</span>
                  <div>{selectedReg.country || 'IN'}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Postal Code / PIN:</span>
                  <div style={{ fontFamily: 'JetBrains Mono' }}>{selectedReg.postal_code}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Telephone / Mobile:</span>
                  <div>{selectedReg.telephone}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem' }}>GSTIN:</span>
                  <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{selectedReg.tax_number}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem' }}>PAN:</span>
                  <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{selectedReg.pan_number}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Login / Contact Email:</span>
                  <div>{selectedReg.email}</div>
                </div>
              </div>
            </div>

            {/* Section: Uploaded Statutory Documents (KYC Attachments) */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="badge badge-blue">Statutory KYC Attachments</span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {selectedReg.documents && selectedReg.documents.length > 0
                      ? `${selectedReg.documents.length} document(s) uploaded`
                      : 'No documents attached'}
                  </span>
                </div>
              </div>

              {selectedReg.documents && selectedReg.documents.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
                  {selectedReg.documents.map((doc) => (
                    <div
                      key={doc.id}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        padding: '0.75rem 1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', overflow: 'hidden' }}>
                        <FileText size={20} color="#00823b" style={{ flexShrink: 0 }} />
                        <div style={{ overflow: 'hidden' }}>
                          <span style={{ fontSize: '0.7rem', color: '#00823b', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>
                            {doc.document_type_display}
                          </span>
                          <span
                            style={{
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              color: '#0f172a',
                              display: 'block',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: '180px',
                            }}
                            title={doc.file_name}
                          >
                            {doc.file_name}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: '#64748b' }}>
                            {doc.file_size ? `${(doc.file_size / (1024 * 1024)).toFixed(2)} MB` : ''}
                          </span>
                        </div>
                      </div>

                      {doc.file_url ? (
                        <a
                          href={resolveFileUrl(doc.file_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary"
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.35rem 0.65rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            flexShrink: 0,
                            color: '#0284c7',
                            borderColor: '#7dd3fc',
                          }}
                        >
                          <ExternalLink size={13} /> View
                        </a>
                      ) : (
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Unavailable</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '1rem', color: '#64748b', fontSize: '0.825rem', background: '#ffffff', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
                  No statutory KYC documents were uploaded with this registration.
                </div>
              )}
            </div>

            {/* Section 2: Admin Enrichment Fields (Orange) */}
            <div style={{ border: '1px solid #fed7aa', background: '#fffbeb', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="badge badge-orange">SAP Master Data Enrichment</span>
                  <span style={{ fontSize: '0.75rem', color: '#92400e', fontWeight: 600 }}>
                    ZGTA_ODATA_SRV (Client 110)
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => loadMasterData(true)}
                    className="btn btn-secondary"
                    disabled={masterDataLoading}
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', background: '#fff' }}
                  >
                    <RotateCw size={12} className={masterDataLoading ? 'spin' : ''} /> Refresh Dropdowns
                  </button>
                </div>
              </div>

              {/* Live SAP Gateway Connection Status Banner */}
              {masterDataLoading ? (
                <div style={{ marginBottom: '1rem', padding: '0.65rem 0.85rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', color: '#1e40af', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <RotateCw size={14} className="spin" />
                  <span>Connecting to SAP S/4HANA (ZGTA_ODATA_SRV) and fetching live F4 master data...</span>
                </div>
              ) : isSapConnected ? (
                <div style={{ marginBottom: '1rem', padding: '0.65rem 0.85rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', color: '#166534', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={14} color="#16a34a" />
                  <span><strong>Connected to SAP S/4HANA:</strong> Live master data options loaded from ZGTA_ODATA_SRV (Client 110). Zero dummy data used.</span>
                </div>
              ) : (
                <div style={{ marginBottom: '1rem', padding: '0.65rem 0.85rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertTriangle size={14} color="#dc2626" />
                  <span><strong>SAP Gateway Unreachable (VPN Disconnected):</strong> Live master data options cannot be fetched. Connect your SAP VPN and click &quot;Refresh Dropdowns&quot; to load live options from SAP S/4HANA. No fallback/dummy values are shown.</span>
                </div>
              )}

              {/* Subsection A: Company & Financial Accounting (FI) */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#92400e', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Financial Accounting (FI) Master Data
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.875rem' }}>
                  {/* Company Code */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>
                      <span>Company Code *</span>
                    </label>
                    <select
                      value={adminFields.company_code}
                      onChange={(e) => setAdminFields(p => ({ ...p, company_code: e.target.value }))}
                      className="form-input"
                      disabled={selectedReg.status === 'BP_CREATED'}
                    >
                      {renderSelectOptions(masterData.companySet, adminFields.company_code, 'Select Company Code')}
                    </select>
                  </div>

                  {/* Partner Category */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>
                      <span>Partner Category *</span>
                    </label>
                    <select
                      value={adminFields.partner_category}
                      onChange={(e) => setAdminFields(p => ({ ...p, partner_category: e.target.value }))}
                      className="form-input"
                      disabled={selectedReg.status === 'BP_CREATED'}
                    >
                      {renderSelectOptions(masterData.PartnerCategorySet, adminFields.partner_category, 'Select Partner Category')}
                    </select>
                  </div>

                  {/* Region (From Customer Address) */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>
                      <span>Region / State Code *</span>
                    </label>
                    <select
                      value={adminFields.region || selectedReg.region || ''}
                      onChange={(e) => setAdminFields(p => ({ ...p, region: e.target.value }))}
                      className="form-input"
                      disabled={selectedReg.status === 'BP_CREATED'}
                    >
                      {renderSelectOptions(masterData.RegionSet, adminFields.region || selectedReg.region, 'Select State / Region')}
                    </select>
                  </div>

                  {/* Account Group */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>
                      <span>Account Group *</span>
                    </label>
                    <select
                      value={adminFields.account_group}
                      onChange={(e) => setAdminFields(p => ({ ...p, account_group: e.target.value }))}
                      className="form-input"
                      disabled={selectedReg.status === 'BP_CREATED'}
                    >
                      {renderSelectOptions(masterData.AccountGroupSet, adminFields.account_group, 'Select Account Group')}
                    </select>
                  </div>

                  {/* Recon Account */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>
                      <span>Reconciliation Account *</span>
                    </label>
                    <select
                      value={adminFields.recon_account}
                      onChange={(e) => setAdminFields(p => ({ ...p, recon_account: e.target.value }))}
                      className="form-input"
                      disabled={selectedReg.status === 'BP_CREATED'}
                    >
                      {renderSelectOptions(masterData.ReconciliationAccountSet, adminFields.recon_account, 'Select Recon Account')}
                    </select>
                  </div>

                  {/* Terms of Payment */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>
                      <span>Terms of Payment *</span>
                    </label>
                    <select
                      value={adminFields.payment_terms}
                      onChange={(e) => setAdminFields(p => ({ ...p, payment_terms: e.target.value }))}
                      className="form-input"
                      disabled={selectedReg.status === 'BP_CREATED'}
                    >
                      {renderSelectOptions(masterData.Termsof_PaymentSet, adminFields.payment_terms, 'Select Payment Terms')}
                    </select>
                  </div>
                </div>
              </div>

              {/* Subsection B: Sales & Distribution (SD) */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#92400e', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Sales & Distribution (SD) Area Master Data
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.875rem' }}>
                  {/* Sales Org */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>
                      <span>Sales Org *</span>
                    </label>
                    <select
                      value={adminFields.sales_org}
                      onChange={(e) => setAdminFields(p => ({ ...p, sales_org: e.target.value }))}
                      className="form-input"
                      disabled={selectedReg.status === 'BP_CREATED'}
                    >
                      {renderSelectOptions(masterData.SalesORGSet, adminFields.sales_org, 'Select Sales Org')}
                    </select>
                  </div>

                  {/* Distribution Channel */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>
                      <span>Distr. Channel</span>
                    </label>
                    <input
                      type="text"
                      maxLength={2}
                      value={adminFields.distribution_channel}
                      onChange={(e) => setAdminFields(p => ({ ...p, distribution_channel: e.target.value }))}
                      placeholder="e.g. 01"
                      className="form-input"
                      disabled={selectedReg.status === 'BP_CREATED'}
                    />
                  </div>

                  {/* Division */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>
                      <span>Division</span>
                    </label>
                    <input
                      type="text"
                      maxLength={2}
                      value={adminFields.division}
                      onChange={(e) => setAdminFields(p => ({ ...p, division: e.target.value }))}
                      placeholder="e.g. 01"
                      className="form-input"
                      disabled={selectedReg.status === 'BP_CREATED'}
                    />
                  </div>

                  {/* Pricing Procedure */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>
                      <span>Pricing Procedure</span>
                    </label>
                    <select
                      value={adminFields.pricing_procedure}
                      onChange={(e) => setAdminFields(p => ({ ...p, pricing_procedure: e.target.value }))}
                      className="form-input"
                      disabled={selectedReg.status === 'BP_CREATED'}
                    >
                      {renderSelectOptions(masterData.PricingProcedureSet, adminFields.pricing_procedure, 'Select Pricing Procedure')}
                    </select>
                  </div>

                  {/* Customer Price Group */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>
                      <span>Customer Price Group</span>
                    </label>
                    <select
                      value={adminFields.customer_price_group}
                      onChange={(e) => setAdminFields(p => ({ ...p, customer_price_group: e.target.value }))}
                      className="form-input"
                      disabled={selectedReg.status === 'BP_CREATED'}
                    >
                      {renderSelectOptions(masterData.CustomerPriceGroupSet, adminFields.customer_price_group, 'Select Customer Price Group')}
                    </select>
                  </div>

                  {/* Incoterms */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>
                      <span>Incoterms</span>
                    </label>
                    <select
                      value={adminFields.inco_term}
                      onChange={(e) => setAdminFields(p => ({ ...p, inco_term: e.target.value }))}
                      className="form-input"
                      disabled={selectedReg.status === 'BP_CREATED'}
                    >
                      {renderSelectOptions(masterData.IncoTermSet, adminFields.inco_term, 'Select Incoterms')}
                    </select>
                  </div>

                  {/* Shipping Conditions */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>
                      <span>Shipping Conditions</span>
                    </label>
                    <select
                      value={adminFields.shipping_conditions}
                      onChange={(e) => setAdminFields(p => ({ ...p, shipping_conditions: e.target.value }))}
                      className="form-input"
                      disabled={selectedReg.status === 'BP_CREATED'}
                    >
                      {renderSelectOptions(masterData.ShippingConditionsSet, adminFields.shipping_conditions, 'Select Shipping Conditions')}
                    </select>
                  </div>

                  {/* Account Assignment Group */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>
                      <span>Account Assignment Grp</span>
                    </label>
                    <select
                      value={adminFields.account_assignment_group}
                      onChange={(e) => setAdminFields(p => ({ ...p, account_assignment_group: e.target.value }))}
                      className="form-input"
                      disabled={selectedReg.status === 'BP_CREATED'}
                    >
                      {renderSelectOptions(masterData.AccountAssignmentGroupSet, adminFields.account_assignment_group, 'Select Account Assignment Grp')}
                    </select>
                  </div>

                  {/* Order Probability */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>
                      <span>Order Probability (%)</span>
                    </label>
                    <input
                      type="text"
                      maxLength={3}
                      value={adminFields.order_probability}
                      onChange={(e) => setAdminFields(p => ({ ...p, order_probability: e.target.value }))}
                      placeholder="100"
                      className="form-input"
                      disabled={selectedReg.status === 'BP_CREATED'}
                    />
                  </div>

                  {/* Currency */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>
                      <span>Currency</span>
                    </label>
                    <input
                      type="text"
                      maxLength={5}
                      value={adminFields.currency}
                      onChange={(e) => setAdminFields(p => ({ ...p, currency: e.target.value.toUpperCase() }))}
                      placeholder="INR"
                      className="form-input"
                      disabled={selectedReg.status === 'BP_CREATED'}
                    />
                  </div>
                </div>
              </div>

              {/* Subsection C: Repeatable Tax Classification Matrix */}
              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px dashed #cbd5e1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Receipt size={16} color="#b45309" />
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#92400e' }}>
                        Tax Classifications Matrix
                      </span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                      Specify statutory tax categories and classification indicators for customer billing.
                    </p>
                  </div>
                  {selectedReg.status !== 'BP_CREATED' && (
                    <button
                      type="button"
                      onClick={handleAddTaxLine}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem', background: '#fff', borderColor: '#f59e0b', color: '#b45309' }}
                    >
                      <Plus size={13} /> Add Tax Classification Line
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {adminFields.tax_details.map((taxRow, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'auto 1fr 1fr auto',
                        gap: '0.75rem',
                        alignItems: 'center',
                        background: '#ffffff',
                        border: '1px solid #fde68a',
                        borderRadius: '8px',
                        padding: '0.65rem 0.85rem'
                      }}
                    >
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b45309', minWidth: '24px' }}>
                        #{idx + 1}
                      </span>
                      <div>
                        <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.2rem', fontWeight: 600 }}>
                          Tax Category
                        </label>
                        <select
                          className="form-input"
                          style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
                          value={taxRow.Tatyp}
                          onChange={(e) => handleUpdateTaxLine(idx, 'Tatyp', e.target.value)}
                          disabled={selectedReg.status === 'BP_CREATED'}
                        >
                          {renderSelectOptions(masterData.TaxTypeSet, taxRow.Tatyp, 'Select Tax Category')}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.2rem', fontWeight: 600 }}>
                          Tax Classification
                        </label>
                        <select
                          className="form-input"
                          style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
                          value={taxRow.Taxad !== undefined ? taxRow.Taxad : (taxRow.Takld || '0')}
                          onChange={(e) => {
                            handleUpdateTaxLine(idx, 'Taxad', e.target.value);
                            handleUpdateTaxLine(idx, 'Takld', e.target.value);
                          }}
                          disabled={selectedReg.status === 'BP_CREATED'}
                        >
                          {renderSelectOptions(masterData.TaxClassificationSet, taxRow.Taxad !== undefined ? taxRow.Taxad : (taxRow.Takld || '0'), 'Select Classification')}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.7rem', display: 'block', marginBottom: '0.2rem', visibility: 'hidden' }}>
                          Action
                        </label>
                        <button
                          type="button"
                          onClick={() => handleRemoveTaxLine(idx)}
                          disabled={adminFields.tax_details.length <= 1 || selectedReg.status === 'BP_CREATED'}
                          className="btn btn-secondary"
                          title="Remove Tax Line"
                          style={{
                            padding: '0.4rem',
                            color: adminFields.tax_details.length <= 1 ? '#cbd5e1' : '#ef4444',
                            borderColor: adminFields.tax_details.length <= 1 ? '#e2e8f0' : '#fecaca',
                            cursor: adminFields.tax_details.length <= 1 ? 'not-allowed' : 'pointer'
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Remarks */}
              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>
                  <span>Admin Remarks / Audit Notes</span>
                </label>
                <textarea
                  rows={2}
                  value={adminFields.remarks}
                  onChange={(e) => setAdminFields(p => ({ ...p, remarks: e.target.value }))}
                  placeholder="Notes for approval, or reason if returning/rejecting..."
                  className="form-input"
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {selectedReg.status === 'BP_CREATED' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600 }}>
                    <CheckCircle size={16} /> SAP Customer Created: {selectedReg.customer_number || 'Synced'}
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleAction('RETURN')}
                      className="btn btn-warning"
                      disabled={actionLoading}
                      style={{ fontSize: '0.8rem' }}
                    >
                      <AlertTriangle size={14} /> Return for Correction
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction('REJECT')}
                      className="btn btn-danger"
                      disabled={actionLoading}
                      style={{ fontSize: '0.8rem' }}
                    >
                      <XCircle size={14} /> Reject
                    </button>
                  </>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {selectedReg.status !== 'BP_CREATED' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleAction('SAVE_DRAFT')}
                      className="btn btn-secondary"
                      disabled={actionLoading}
                    >
                      Save Draft
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction('APPROVE_AND_POST')}
                      className="btn btn-success"
                      disabled={actionLoading}
                    >
                      <Send size={15} /> {actionLoading ? 'Dispatching to SAP...' : 'Approve & Post to SAP'}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setSelectedReg(null)}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.85rem' }}
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={handleRetrySAP}
                      className="btn btn-outline"
                      disabled={actionLoading}
                      style={{ fontSize: '0.85rem' }}
                      title="Re-send OData payload to SAP S/4HANA"
                    >
                      <RotateCw size={14} /> Re-dispatch to SAP
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
