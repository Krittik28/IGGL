import React, { useState, useEffect } from 'react';
import {
  Building,
  Search,
  Key,
  Eye,
  RefreshCw,
  Mail,
  Phone,
  MapPin,
  FileText,
  Layers,
  CheckCircle,
  X,
  Lock,
  ShieldCheck,
  Check,
  AlertCircle
} from 'lucide-react';
import { fetchAdminCustomers, adminChangeCustomerPassword } from '../api';

export const AdminCustomerDirectory = ({ currentUser }) => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Selected customer for View Details modal
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Selected customer for Change Password modal
  const [pwdCustomer, setPwdCustomer] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAdminCustomers();
      setCustomers(data || []);
    } catch (err) {
      console.error('Failed to load customers:', err);
      setError(err.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPasswordModal = (customer) => {
    setPwdCustomer(customer);
    setNewPassword('');
    setConfirmPassword('');
    setPwdError('');
    setPwdSuccess('');
  };

  const handleClosePasswordModal = () => {
    setPwdCustomer(null);
    setNewPassword('');
    setConfirmPassword('');
    setPwdError('');
    setPwdSuccess('');
  };

  const handleSavePassword = async (e) => {
    e.preventDefault();
    if (!newPassword) {
      setPwdError('Please enter a new password.');
      return;
    }
    if (newPassword.length < 4) {
      setPwdError('Password must be at least 4 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError('Passwords do not match. Please verify and retype.');
      return;
    }

    try {
      setPwdLoading(true);
      setPwdError('');
      const targetId = pwdCustomer.id || pwdCustomer.user_id || pwdCustomer.email;
      const res = await adminChangeCustomerPassword(targetId, newPassword);
      setPwdSuccess(res.message || `Password for ${pwdCustomer.company_name} updated successfully!`);
      setTimeout(() => {
        handleClosePasswordModal();
      }, 1500);
    } catch (err) {
      setPwdError(err.message || 'Failed to update password');
    } finally {
      setPwdLoading(false);
    }
  };

  // Filtered customer list
  const filteredCustomers = customers.filter((c) => {
    const term = searchTerm.toLowerCase();
    return (
      (c.company_name || '').toLowerCase().includes(term) ||
      (c.customer_code || '').toLowerCase().includes(term) ||
      (c.email || '').toLowerCase().includes(term) ||
      (c.city || '').toLowerCase().includes(term) ||
      (c.gstin || '').toLowerCase().includes(term) ||
      (c.pan || '').toLowerCase().includes(term)
    );
  });

  const totalCustomers = customers.length;
  const totalWithSAP = customers.filter((c) => c.customer_code && c.customer_code !== 'PENDING_SAP').length;
  const totalGTAs = customers.reduce((sum, c) => sum + (c.gta_count || 0), 0);
  const totalCTs = customers.reduce((sum, c) => sum + (c.ct_count || 0), 0);

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 1. Header Banner */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Building size={22} color="#00823b" />
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              Customer Directory
            </h1>
            <span
              style={{
                background: '#e8f5e9',
                color: '#00823b',
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '0.2rem 0.6rem',
                borderRadius: '12px',
                border: '1px solid #c8e6c9'
              }}
            >
              {totalCustomers} Onboarded
            </span>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.825rem', marginTop: '0.25rem', marginBottom: 0 }}>
            Master directory of onboarded shippers, SAP Business Partners, and portal credentials.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={loadCustomers}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0.85rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              color: '#334155',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* 2. Top Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div style={kpiCardStyle}>
          <div>
            <div style={kpiLabelStyle}>TOTAL ONBOARDED SHIPPERS</div>
            <div style={kpiValueStyle}>{totalCustomers}</div>
            <div style={kpiSubtextStyle}>Active portal users</div>
          </div>
          <div style={{ ...iconCircleStyle, background: '#e0f2fe' }}>
            <Building size={18} color="#0284c7" />
          </div>
        </div>

        <div style={kpiCardStyle}>
          <div>
            <div style={kpiLabelStyle}>SAP BUSINESS PARTNERS</div>
            <div style={kpiValueStyle}>{totalWithSAP}</div>
            <div style={kpiSubtextStyle}>Assigned Customer Code</div>
          </div>
          <div style={{ ...iconCircleStyle, background: '#e8f5e9' }}>
            <ShieldCheck size={18} color="#00823b" />
          </div>
        </div>

        <div style={kpiCardStyle}>
          <div>
            <div style={kpiLabelStyle}>ACTIVE GTAS</div>
            <div style={kpiValueStyle}>{totalGTAs}</div>
            <div style={kpiSubtextStyle}>Gas Transmission Agreements</div>
          </div>
          <div style={{ ...iconCircleStyle, background: '#fef3c7' }}>
            <FileText size={18} color="#d97706" />
          </div>
        </div>

        <div style={kpiCardStyle}>
          <div>
            <div style={kpiLabelStyle}>CAPACITY TRANCHES (CTS)</div>
            <div style={kpiValueStyle}>{totalCTs}</div>
            <div style={kpiSubtextStyle}>Allocated tranches</div>
          </div>
          <div style={{ ...iconCircleStyle, background: '#ede9fe' }}>
            <Layers size={18} color="#7c3aed" />
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e5e7eb',
          padding: '0.85rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}
      >
        <Search size={16} color="#94a3b8" />
        <input
          type="text"
          placeholder="Search by company name, SAP customer code, email, PAN, GSTIN or city..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            border: 'none',
            outline: 'none',
            width: '100%',
            fontSize: '0.85rem',
            color: '#1e293b'
          }}
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* 4. Customer Directory Table */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}
      >
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
            <RefreshCw size={24} className="spin" style={{ margin: '0 auto 0.75rem auto', color: '#00823b' }} />
            Loading customer master directory...
          </div>
        ) : error ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: '#dc2626' }}>
            <AlertCircle size={24} style={{ margin: '0 auto 0.5rem auto' }} />
            <div style={{ fontWeight: 600 }}>Error loading customer data</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>{error}</div>
            <button onClick={loadCustomers} style={{ marginTop: '1rem', padding: '0.4rem 0.85rem' }} className="btn btn-primary">
              Retry
            </button>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            <Building size={32} color="#cbd5e1" style={{ margin: '0 auto 0.75rem auto' }} />
            <div style={{ fontWeight: 600, color: '#1e293b' }}>No customers found</div>
            <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
              {searchTerm ? 'No results matched your search term.' : 'No onboarded customers in database.'}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.825rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '0.85rem 1.25rem', fontWeight: 600 }}>Company / Shipper</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>SAP Customer Code</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Contact Details</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Location</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Agreements</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '0.85rem 1.25rem', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((cust, idx) => {
                  const hasSAP = cust.customer_code && cust.customer_code !== 'PENDING_SAP';
                  return (
                    <tr
                      key={cust.id || cust.email || idx}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#fafbfc')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                    >
                      {/* Company Name */}
                      <td style={{ padding: '0.95rem 1.25rem' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.875rem' }}>
                          {cust.company_name}
                        </div>
                        {cust.registration_number && (
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                            Ref: {cust.registration_number}
                          </div>
                        )}
                        {cust.pan && (
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                            PAN: <span style={{ fontWeight: 600 }}>{cust.pan}</span>
                          </div>
                        )}
                      </td>

                      {/* SAP Customer Code */}
                      <td style={{ padding: '0.95rem 1rem' }}>
                        {hasSAP ? (
                          <span
                            style={{
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              fontWeight: 700,
                              fontSize: '0.78rem',
                              padding: '0.25rem 0.65rem',
                              borderRadius: '6px',
                              border: '1px solid #bfdbfe',
                              fontFamily: 'monospace',
                              letterSpacing: '0.04em'
                            }}
                          >
                            {cust.customer_code}
                          </span>
                        ) : (
                          <span
                            style={{
                              background: '#fff7ed',
                              color: '#c2410c',
                              fontSize: '0.72rem',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px'
                            }}
                          >
                            Pending SAP
                          </span>
                        )}
                      </td>

                      {/* Contact */}
                      <td style={{ padding: '0.95rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#334155' }}>
                          <Mail size={13} color="#64748b" />
                          <span>{cust.email || '—'}</span>
                        </div>
                        {cust.phone && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#64748b', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                            <Phone size={12} color="#94a3b8" />
                            <span>{cust.phone}</span>
                          </div>
                        )}
                      </td>

                      {/* Location */}
                      <td style={{ padding: '0.95rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#334155' }}>
                          <MapPin size={13} color="#00823b" />
                          <span>{cust.city || '—'}</span>
                        </div>
                        {cust.region && (
                          <div style={{ fontSize: '0.72rem', color: '#64748b', marginLeft: '1.05rem' }}>
                            State Code: {cust.region}
                          </div>
                        )}
                      </td>

                      {/* Agreements */}
                      <td style={{ padding: '0.95rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span
                            style={{
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              color: '#334155'
                            }}
                          >
                            {cust.gta_count || 0} GTA
                          </span>
                          <span
                            style={{
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              color: '#334155'
                            }}
                          >
                            {cust.ct_count || 0} CT
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '0.95rem 1rem' }}>
                        <span
                          style={{
                            background: '#dcfce7',
                            color: '#15803d',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.55rem',
                            borderRadius: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}
                        >
                          <CheckCircle size={11} />
                          Active
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '0.95rem 1.25rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                          <button
                            onClick={() => setSelectedCustomer(cust)}
                            style={{
                              background: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              padding: '0.35rem 0.65rem',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              color: '#334155',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem'
                            }}
                            title="View Customer Master Details"
                          >
                            <Eye size={13} /> Details
                          </button>

                          <button
                            onClick={() => handleOpenPasswordModal(cust)}
                            style={{
                              background: '#00823b',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '0.35rem 0.65rem',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              boxShadow: '0 1px 2px rgba(0, 130, 59, 0.2)'
                            }}
                            title="Change Customer Password"
                          >
                            <Key size={13} /> Change Password
                          </button>
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

      {/* ========================================================================= */}
      {/* 5. View Customer Details Modal */}
      {/* ========================================================================= */}
      {selectedCustomer && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            {/* Modal Header */}
            <div style={modalHeaderStyle}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Building size={20} color="#00823b" />
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    {selectedCustomer.company_name}
                  </h2>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>
                  SAP BP: <strong>{selectedCustomer.customer_code || 'Pending'}</strong> · Registered Customer
                </div>
              </div>

              <button onClick={() => setSelectedCustomer(null)} style={closeBtnStyle}>
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '70vh', overflowY: 'auto' }}>
              {/* Top Banner Box */}
              <div
                style={{
                  background: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  padding: '1rem',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '0.85rem'
                }}
              >
                <div>
                  <div style={detailLabelStyle}>Customer Code</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0369a1', fontFamily: 'monospace' }}>
                    {selectedCustomer.customer_code || 'PENDING_SAP'}
                  </div>
                </div>

                <div>
                  <div style={detailLabelStyle}>Portal User / Email</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>
                    {selectedCustomer.email}
                  </div>
                </div>

                <div>
                  <div style={detailLabelStyle}>Registered Phone</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>
                    {selectedCustomer.phone || '—'}
                  </div>
                </div>

                <div>
                  <div style={detailLabelStyle}>Account Status</div>
                  <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                    Active
                  </span>
                </div>
              </div>

              {/* Tax & Registration Data */}
              <div>
                <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.65rem' }}>
                  Tax & Regulatory Identifiers
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div style={detailCardStyle}>
                    <span style={detailLabelStyle}>GSTIN:</span>
                    <span style={{ fontWeight: 600, color: '#0f172a', fontFamily: 'monospace' }}>
                      {selectedCustomer.gstin || '—'}
                    </span>
                  </div>
                  <div style={detailCardStyle}>
                    <span style={detailLabelStyle}>Permanent Account Number (PAN):</span>
                    <span style={{ fontWeight: 600, color: '#0f172a', fontFamily: 'monospace' }}>
                      {selectedCustomer.pan || '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Registered Address */}
              <div>
                <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.65rem' }}>
                  Registered Office Address
                </h3>
                <div style={{ ...detailCardStyle, flexDirection: 'column', alignItems: 'flex-start', gap: '0.35rem' }}>
                  <div><strong>Street:</strong> {selectedCustomer.street || '—'}</div>
                  <div><strong>City:</strong> {selectedCustomer.city || '—'}</div>
                  <div><strong>State / Region:</strong> {selectedCustomer.region || '—'}</div>
                  <div><strong>Postal Code:</strong> {selectedCustomer.postal_code || '—'}</div>
                  <div><strong>Country:</strong> {selectedCustomer.country || 'IN'}</div>
                </div>
              </div>

              {/* Contract Summary */}
              <div>
                <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.65rem' }}>
                  Gas Transmission Agreement (GTA) Summary
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div style={detailCardStyle}>
                    <span style={detailLabelStyle}>Executed GTAs:</span>
                    <span style={{ fontWeight: 700, color: '#00823b' }}>
                      {selectedCustomer.gta_count || 0} Agreement(s)
                    </span>
                  </div>
                  <div style={detailCardStyle}>
                    <span style={detailLabelStyle}>Capacity Tranches (CTs):</span>
                    <span style={{ fontWeight: 700, color: '#0284c7' }}>
                      {selectedCustomer.ct_count || 0} Tranche(s)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={modalFooterStyle}>
              <button
                onClick={() => {
                  const cust = selectedCustomer;
                  setSelectedCustomer(null);
                  handleOpenPasswordModal(cust);
                }}
                className="btn btn-primary"
                style={{ background: '#00823b', padding: '0.5rem 1rem', fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Key size={14} /> Change Password
              </button>
              <button
                onClick={() => setSelectedCustomer(null)}
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '0.5rem 1rem',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  color: '#334155',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. Change Password Modal */}
      {/* ========================================================================= */}
      {pwdCustomer && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalContentStyle, maxWidth: '480px' }}>
            {/* Modal Header */}
            <div style={modalHeaderStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Key size={18} color="#00823b" />
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Change Customer Password
                </h2>
              </div>
              <button onClick={handleClosePasswordModal} style={closeBtnStyle}>
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSavePassword}>
              <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Target Customer Info Box */}
                <div
                  style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '8px',
                    padding: '0.85rem',
                    fontSize: '0.8rem'
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#166534' }}>{pwdCustomer.company_name}</div>
                  <div style={{ color: '#4b5563', marginTop: '0.2rem' }}>
                    Email: <strong>{pwdCustomer.email}</strong> · SAP: <strong>{pwdCustomer.customer_code}</strong>
                  </div>
                </div>

                {pwdError && (
                  <div
                    style={{
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      color: '#b91c1c',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}
                  >
                    <AlertCircle size={15} />
                    <span>{pwdError}</span>
                  </div>
                )}

                {pwdSuccess && (
                  <div
                    style={{
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      color: '#15803d',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}
                  >
                    <Check size={15} />
                    <span>{pwdSuccess}</span>
                  </div>
                )}

                {/* New Password */}
                <div>
                  <label style={labelStyle}>New Password *</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password (e.g. password)"
                      style={inputStyle}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: '#64748b',
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label style={labelStyle}>Confirm New Password *</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    style={inputStyle}
                  />
                </div>

                {/* Quick preset button */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
                  <span>Quick default password:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setNewPassword('password');
                      setConfirmPassword('password');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#00823b',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    Set to "password"
                  </button>
                </div>
              </div>

              {/* Modal Footer */}
              <div style={modalFooterStyle}>
                <button
                  type="button"
                  onClick={handleClosePasswordModal}
                  disabled={pwdLoading}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '0.5rem 1rem',
                    fontSize: '0.825rem',
                    fontWeight: 600,
                    color: '#334155',
                    cursor: pwdLoading ? 'not-allowed' : 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pwdLoading || !!pwdSuccess}
                  style={{
                    background: '#00823b',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.5rem 1.25rem',
                    fontSize: '0.825rem',
                    fontWeight: 600,
                    cursor: pwdLoading || pwdSuccess ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    boxShadow: '0 1px 3px rgba(0, 130, 59, 0.25)'
                  }}
                >
                  {pwdLoading ? (
                    <>
                      <RefreshCw size={14} className="spin" /> Updating...
                    </>
                  ) : (
                    <>
                      <Lock size={14} /> Update Password
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Styles
const kpiCardStyle = {
  background: '#ffffff',
  borderRadius: '12px',
  border: '1px solid #e5e7eb',
  padding: '1.1rem 1.25rem',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
};

const kpiLabelStyle = {
  fontSize: '0.68rem',
  fontWeight: 700,
  color: '#64748b',
  letterSpacing: '0.04em'
};

const kpiValueStyle = {
  fontSize: '1.65rem',
  fontWeight: 800,
  color: '#0f172a',
  margin: '0.25rem 0 0.15rem 0',
  lineHeight: 1.1
};

const kpiSubtextStyle = {
  fontSize: '0.72rem',
  color: '#64748b',
  fontWeight: 500
};

const iconCircleStyle = {
  width: '36px',
  height: '36px',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const modalOverlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(15, 23, 42, 0.55)',
  backdropFilter: 'blur(3px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
  padding: '1rem'
};

const modalContentStyle = {
  background: '#ffffff',
  borderRadius: '12px',
  width: '100%',
  maxWidth: '680px',
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden'
};

const modalHeaderStyle = {
  padding: '1.1rem 1.5rem',
  borderBottom: '1px solid #f1f5f9',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
};

const modalFooterStyle = {
  padding: '0.85rem 1.5rem',
  borderTop: '1px solid #f1f5f9',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '0.75rem',
  background: '#fafbfc'
};

const closeBtnStyle = {
  background: 'none',
  border: 'none',
  color: '#64748b',
  cursor: 'pointer',
  padding: '0.25rem',
  borderRadius: '6px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const detailCardStyle = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '6px',
  padding: '0.75rem 1rem',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: '0.825rem'
};

const detailLabelStyle = {
  fontSize: '0.7rem',
  color: '#64748b',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.03em'
};

const labelStyle = {
  display: 'block',
  fontSize: '0.78rem',
  fontWeight: 600,
  color: '#334155',
  marginBottom: '0.35rem'
};

const inputStyle = {
  width: '100%',
  padding: '0.6rem 0.85rem',
  borderRadius: '6px',
  border: '1px solid #cbd5e1',
  fontSize: '0.825rem',
  outline: 'none',
  boxSizing: 'border-box'
};

export default AdminCustomerDirectory;
