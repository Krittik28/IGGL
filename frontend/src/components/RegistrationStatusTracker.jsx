import React, { useState, useEffect } from 'react';
import { checkRegistrationStatus, resubmitCustomerRegistration, resolveFileUrl } from '../api';
import {
  Search,
  Building,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  Edit3,
  Send,
  ArrowRight,
  FileCheck,
  FileText,
  ExternalLink,
} from 'lucide-react';

export const RegistrationStatusTracker = ({ initialQuery = '' }) => {
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // In-place correction state for RETURNED applications
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [resubmitting, setResubmitting] = useState(false);
  const [resubmitSuccess, setResubmitSuccess] = useState(null);
  const [resubmitError, setResubmitError] = useState(null);

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      handleSearch(initialQuery);
    }
  }, [initialQuery]);

  const handleSearch = async (searchTerm) => {
    const q = searchTerm || query;
    if (!q.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setIsEditing(false);
    setResubmitSuccess(null);

    try {
      const data = await checkRegistrationStatus(q.trim());
      setResult(data);
      setEditFormData({
        name1: data.name1 || '',
        name2: data.name2 || '',
        city: data.city || '',
        postal_code: data.postal_code || '',
        street: data.street || '',
        telephone: data.telephone || '',
        tax_number: data.tax_number || '',
        pan_number: data.pan_number || '',
        email: data.email || '',
      });
    } catch (err) {
      setError(err.data?.error || 'No matching registration found. Please verify your reference number, PAN, or GSTIN.');
    } finally {
      setLoading(false);
    }
  };

  const handleResubmit = async (e) => {
    e.preventDefault();
    if (!result?.id) return;

    setResubmitting(true);
    setResubmitError(null);

    try {
      const res = await resubmitCustomerRegistration(result.id, editFormData);
      setResubmitSuccess(res.message);
      setIsEditing(false);
      // Reload status
      handleSearch(result.registration_number);
    } catch (err) {
      setResubmitError(err.data?.details ? JSON.stringify(err.data.details) : 'Resubmission failed. Please check inputs.');
    } finally {
      setResubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'BP_CREATED':
        return <span className="badge badge-green"><CheckCircle size={13} /> Active (BP Created)</span>;
      case 'APPROVED':
        return <span className="badge badge-green"><CheckCircle size={13} /> Approved</span>;
      case 'UNDER_REVIEW':
        return <span className="badge badge-blue"><Clock size={13} /> Under Review</span>;
      case 'RETURNED':
        return <span className="badge badge-orange"><AlertTriangle size={13} /> Action Required: Returned</span>;
      case 'REJECTED':
        return <span className="badge badge-red"><XCircle size={13} /> Rejected</span>;
      default:
        return <span className="badge badge-gray"><Clock size={13} /> Submitted</span>;
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Registration Status Tracking (Screen A6)</h2>
            <p className="card-subtitle">
              Track your onboarding progress, view reviewer remarks, or resubmit corrected details.
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter Application Reference (e.g. IGGL-REG-2026-XXXXX), GSTIN, PAN, or Email"
              className="form-input"
              style={{ paddingLeft: '2.5rem' }}
            />
            <Search size={18} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ minWidth: '120px' }}>
            {loading ? 'Searching...' : 'Track Status'}
          </button>
        </form>

        {error && (
          <div style={{ padding: '1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        {resubmitSuccess && (
          <div style={{ padding: '1rem', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', color: '#065f46', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
            {resubmitSuccess}
          </div>
        )}

        {result && (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '14px', padding: '1.75rem', background: '#ffffff', marginTop: '1rem' }}>
            {/* Header info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f1f5f9', paddingBottom: '1.25rem', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                  Application Reference Number
                </span>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: '1.4rem', fontWeight: 800, color: '#00823b' }}>
                  {result.registration_number}
                </div>
              </div>
              <div>{getStatusBadge(result.status)}</div>
            </div>

            {/* Stepper Progress Bar */}
            <div style={{ margin: '1.5rem 0', background: '#f8fafc', padding: '1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
                {/* Step 1 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, zIndex: 2 }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#00823b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem' }}>
                    ✓
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, marginTop: '0.35rem', color: '#0f172a' }}>Submitted</span>
                  <span style={{ fontSize: '0.65rem', color: '#64748b' }}>{new Date(result.submitted_at).toLocaleDateString()}</span>
                </div>

                {/* Step 2 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, zIndex: 2 }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: result.status === 'SUBMITTED' ? '#e2e8f0' : result.status === 'RETURNED' ? '#f59e0b' : '#00823b',
                    color: result.status === 'SUBMITTED' ? '#64748b' : '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.85rem'
                  }}>
                    {result.status === 'BP_CREATED' ? '✓' : result.status === 'RETURNED' ? '!' : '2'}
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, marginTop: '0.35rem', color: '#0f172a' }}>
                    {result.status === 'RETURNED' ? 'Needs Correction' : 'IGGL Review'}
                  </span>
                  <span style={{ fontSize: '0.65rem', color: '#64748b' }}>Commercial / Finance</span>
                </div>

                {/* Step 3 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, zIndex: 2 }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: result.status === 'BP_CREATED' ? '#00823b' : '#e2e8f0',
                    color: result.status === 'BP_CREATED' ? '#fff' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.85rem'
                  }}>
                    {result.status === 'BP_CREATED' ? '✓' : '3'}
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, marginTop: '0.35rem', color: '#0f172a' }}>SAP Activation</span>
                  <span style={{ fontSize: '0.65rem', color: '#64748b' }}>Customer Master (BP)</span>
                </div>
              </div>
            </div>

            {/* Entity Summary Details */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Legal Entity Name</span>
                <div style={{ fontWeight: 600, color: '#1e293b' }}>{result.name1}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>GSTIN</span>
                <div style={{ fontFamily: 'JetBrains Mono', color: '#1e293b' }}>{result.tax_number}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>PAN</span>
                <div style={{ fontFamily: 'JetBrains Mono', color: '#1e293b' }}>{result.pan_number}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Registered City</span>
                <div style={{ color: '#1e293b' }}>{result.city} ({result.postal_code})</div>
              </div>
            </div>

            {/* Submitted Statutory Documents */}
            {result.documents && result.documents.length > 0 && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', marginBottom: '1.25rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '0.6rem' }}>
                  Submitted KYC Documents ({result.documents.length})
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.6rem' }}>
                  {result.documents.map((doc) => (
                    <div
                      key={doc.id}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        padding: '0.5rem 0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                        <FileText size={16} color="#00823b" style={{ flexShrink: 0 }} />
                        <div style={{ overflow: 'hidden' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0f172a', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {doc.document_type_display}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: '#64748b' }}>
                            {doc.file_name}
                          </span>
                        </div>
                      </div>
                      {doc.file_url && (
                        <a
                          href={resolveFileUrl(doc.file_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#0284c7', marginLeft: '0.5rem', display: 'flex', alignItems: 'center' }}
                          title="View document"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* If SAP BP Created */}
            {result.customer_number && (
              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px', padding: '1.5rem', marginTop: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#065f46', fontWeight: 700, marginBottom: '0.5rem' }}>
                  <ShieldCheck size={22} />
                  <span style={{ fontSize: '1rem' }}>SAP S/4HANA Customer Master Record Activated</span>
                </div>
                <div style={{ display: 'flex', gap: '3rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#047857', fontWeight: 600, textTransform: 'uppercase' }}>
                      Customer Code
                    </span>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: '1.6rem', fontWeight: 800, color: '#065f46' }}>
                      {result.customer_number}
                    </div>
                  </div>
                  {result.address_number && (
                    <div>
                      <span style={{ fontSize: '0.75rem', color: '#047857', fontWeight: 600, textTransform: 'uppercase' }}>
                        Address Code
                      </span>
                      <div style={{ fontFamily: 'JetBrains Mono', fontSize: '1.6rem', fontWeight: 800, color: '#065f46' }}>
                        {result.address_number}
                      </div>
                    </div>
                  )}
                </div>
                <p style={{ fontSize: '0.85rem', color: '#047857', marginTop: '1rem' }}>
                  Your organization is now fully registered in IGGL's SAP S/4HANA system. You can now execute your Gas Transportation Agreement (GTA) and submit Capacity Tranche (CT) booking requests.
                </p>
              </div>
            )}

            {/* If RETURNED: Show Reviewer remarks + Allow in-place editing! */}
            {result.status === 'RETURNED' && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '1.5rem', marginTop: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#92400e', fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.5rem' }}>
                  <AlertTriangle size={20} />
                  <span>Action Required: Application Returned for Correction</span>
                </div>
                <div style={{ color: '#78350f', fontSize: '0.9rem', marginBottom: '1.25rem', padding: '0.75rem', background: 'rgba(255,255,255,0.7)', borderRadius: '6px' }}>
                  <strong>Reviewer Remarks:</strong> {result.remarks || 'Please verify and correct your submitted details.'}
                </div>

                {!isEditing ? (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="btn btn-warning"
                    style={{ fontSize: '0.875rem' }}
                  >
                    <Edit3 size={15} /> Edit Flagged Fields & Resubmit
                  </button>
                ) : (
                  <form onSubmit={handleResubmit} style={{ marginTop: '1rem', borderTop: '1px solid #fde68a', paddingTop: '1rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#92400e', marginBottom: '1rem' }}>
                      Update Your Details:
                    </div>

                    {resubmitError && (
                      <div style={{ padding: '0.75rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '0.8rem', marginBottom: '1rem' }}>
                        {resubmitError}
                      </div>
                    )}

                    <div className="form-grid">
                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>Legal Name</label>
                        <input
                          type="text"
                          maxLength={70}
                          value={editFormData.name1}
                          onChange={(e) => setEditFormData({ ...editFormData, name1: e.target.value })}
                          className="form-input"
                          required
                        />
                      </div>
                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>Street Address</label>
                        <input
                          type="text"
                          maxLength={35}
                          value={editFormData.street}
                          onChange={(e) => setEditFormData({ ...editFormData, street: e.target.value })}
                          className="form-input"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>City</label>
                        <input
                          type="text"
                          maxLength={35}
                          value={editFormData.city}
                          onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                          className="form-input"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>Postal Code</label>
                        <input
                          type="text"
                          maxLength={6}
                          value={editFormData.postal_code}
                          onChange={(e) => setEditFormData({ ...editFormData, postal_code: e.target.value })}
                          className="form-input"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>Telephone</label>
                        <input
                          type="text"
                          maxLength={16}
                          value={editFormData.telephone}
                          onChange={(e) => setEditFormData({ ...editFormData, telephone: e.target.value })}
                          className="form-input"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>GSTIN</label>
                        <input
                          type="text"
                          maxLength={15}
                          value={editFormData.tax_number}
                          onChange={(e) => setEditFormData({ ...editFormData, tax_number: e.target.value.toUpperCase() })}
                          className="form-input"
                          required
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="btn btn-secondary"
                        disabled={resubmitting}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn btn-warning"
                        disabled={resubmitting}
                      >
                        <Send size={14} /> {resubmitting ? 'Submitting...' : 'Save & Resubmit'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
