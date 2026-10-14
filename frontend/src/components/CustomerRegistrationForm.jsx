import React, { useState, useEffect } from 'react';
import { submitCustomerRegistration, fetchPublicMasterData } from '../api';
import { CaptchaWidget } from './CaptchaWidget';
import {
  Building2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Copy,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  FileText,
  FileCheck,
  Download,
  Calendar,
  Lock,
  Upload,
  X,
  Paperclip,
  Trash2,
  RotateCw,
} from 'lucide-react';

export const CustomerRegistrationForm = ({ onTrackRequested }) => {
  const [captchaInput, setCaptchaInput] = useState('');
  const [generatedCaptcha, setGeneratedCaptcha] = useState('');
  const [captchaError, setCaptchaError] = useState(false);
  const initialFormState = {
    name1: '',
    name2: '',
    city: '',
    district: '',
    postal_code: '',
    street: '',
    street_suppl1: '',
    street_suppl2: '',
    street_suppl3: '',
    region: '',
    telephone: '',
    tax_number: '',
    pan_number: '',
    email: '',
    password: '',
    confirm_password: '',
  };

  const [activeStep, setActiveStep] = useState(1); // 1: Entity & Statutory, 2: Address & Contact, 3: Docs & Submit
  const [formData, setFormData] = useState(initialFormState);
  const [regions, setRegions] = useState([]);
  const [regionsLoading, setRegionsLoading] = useState(false);

  const loadRegions = async (force = false) => {
    try {
      setRegionsLoading(true);
      const data = await fetchPublicMasterData(force);
      if (data && Array.isArray(data.RegionSet)) {
        setRegions(data.RegionSet);
      }
    } catch (err) {
      console.warn('Could not load live SAP regions (VPN may be disconnected):', err);
    } finally {
      setRegionsLoading(false);
    }
  };

  useEffect(() => {
    loadRegions();
  }, []);

  const [uploadedFiles, setUploadedFiles] = useState({
    doc_gst: null,
    doc_pan: null,
    doc_coi: null,
    doc_poa: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [apiError, setApiError] = useState(null);
  const [submissionSuccess, setSubmissionSuccess] = useState(null);
  const [copied, setCopied] = useState(false);
  const [declarationAccepted, setDeclarationAccepted] = useState(true);

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const handleFileSelect = (key, file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setApiError(`File "${file.name}" exceeds the 10 MB limit.`);
      return;
    }
    setUploadedFiles(prev => ({ ...prev, [key]: file }));
    setApiError(null);
  };

  const handleRemoveFile = (key) => {
    setUploadedFiles(prev => ({ ...prev, [key]: null }));
  };


  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validateStep1 = () => {
    const errors = {};
    if (!formData.name1.trim()) {
      errors.name1 = 'Name is required.';
    } else if (formData.name1.trim().length > 40) {
      errors.name1 = 'Name cannot exceed 40 characters.';
    }
    if (formData.name2 && formData.name2.trim().length > 40) {
      errors.name2 = 'Name (continuation) cannot exceed 40 characters.';
    }
    if (!formData.pan_number.trim()) {
      errors.pan_number = 'PAN is required.';
    } else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.pan_number.trim())) {
      errors.pan_number = 'Invalid PAN format (e.g. AABCR7106G).';
    }
    if (!formData.tax_number.trim()) {
      errors.tax_number = 'Tax Number (GSTIN) is required.';
    } else if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{3}$/.test(formData.tax_number.trim())) {
      errors.tax_number = 'Invalid GSTIN format (15 characters, e.g. 08AABCR7106A1AQ).';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateStep2 = () => {
    const errors = {};
    if (!formData.street.trim()) errors.street = 'Address 1 is required.';
    if (!formData.city.trim()) errors.city = 'City is required.';
    if (!formData.region.trim()) errors.region = 'State / Region Code is required.';
    if (!formData.postal_code.trim()) errors.postal_code = 'Postal Code / PIN is required.';
    else if (!/^\d{6}$/.test(formData.postal_code.trim())) errors.postal_code = 'PIN must be 6 digits.';
    if (!formData.telephone.trim()) errors.telephone = 'Telephone is required.';
    if (!formData.email.trim()) errors.email = 'Email is required.';
    if (!formData.password) {
      errors.password = 'Password is required for portal access.';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters.';
    }
    if (formData.password && formData.confirm_password !== formData.password) {
      errors.confirm_password = 'Passwords do not match.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (activeStep === 1) {
      if (validateStep1()) setActiveStep(2);
    } else if (activeStep === 2) {
      if (validateStep2()) setActiveStep(3);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep1() || !validateStep2()) return;
    if (!declarationAccepted) {
      setApiError('Please accept the statutory declaration before submitting.');
      return;
    }

    if (!captchaInput.trim() || captchaInput.trim().toUpperCase() !== generatedCaptcha.toUpperCase()) {
      setCaptchaError(true);
      setApiError('Security verification failed: Incorrect captcha code. Please re-enter the characters shown.');
      return;
    }

    setSubmitting(true);
    setApiError(null);
    setFieldErrors({});

    try {
      const res = await submitCustomerRegistration(formData, uploadedFiles);
      setSubmissionSuccess(res);
    } catch (err) {
      if (err.data && err.data.details) {
        setFieldErrors(err.data.details);
      } else {
        setApiError(err.data?.error || 'Registration failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyRef = () => {
    if (submissionSuccess?.registration_number) {
      navigator.clipboard.writeText(submissionSuccess.registration_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Screen A5.2: Official Submission Voucher
  if (submissionSuccess) {
    return (
      <div className="card" style={{ maxWidth: '800px', margin: '2rem auto', textAlign: 'center', padding: '2.5rem' }}>
        <div style={{ display: 'inline-flex', padding: '1.25rem', background: '#ecfdf5', borderRadius: '50%', marginBottom: '1.25rem', color: '#00823b' }}>
          <CheckCircle2 size={54} />
        </div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem', color: '#0f172a' }}>
          Registration Submitted Successfully
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '1.75rem', maxWidth: '600px', margin: '0 auto 1.75rem auto' }}>
          Your application has been received by Indradhanush Gas Grid Limited (IGGL). It has been routed to the Marketing and Commercial division for review and automated SAP Business Partner (BP) generation.
        </p>

        {/* Voucher Box */}
        <div style={{ background: '#f8fafc', border: '1.5px dashed #cbd5e1', borderRadius: '14px', padding: '1.75rem', marginBottom: '2rem', textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Application Tracking Reference
              </span>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: '1.6rem', fontWeight: 800, color: '#00823b' }}>
                {submissionSuccess.registration_number}
              </div>
            </div>
            <button
              onClick={handleCopyRef}
              className="btn btn-secondary"
              style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
            >
              <Copy size={14} /> {copied ? 'Copied!' : 'Copy Reference'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', fontSize: '0.85rem' }}>
            <div>
              <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Applicant Legal Entity</span>
              <strong style={{ color: '#0f172a' }}>{formData.name1} {formData.name2 ? ` ${formData.name2}` : ''}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>GSTIN</span>
              <span style={{ fontFamily: 'JetBrains Mono', color: '#0f172a', fontWeight: 600 }}>{formData.tax_number}</span>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>PAN</span>
              <span style={{ fontFamily: 'JetBrains Mono', color: '#0f172a', fontWeight: 600 }}>{formData.pan_number}</span>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Registered Address</span>
              <span style={{ color: '#0f172a' }}>
                {formData.street}
                {formData.street_suppl1 ? `, ${formData.street_suppl1}` : ''}
                {formData.street_suppl2 ? `, ${formData.street_suppl2}` : ''}
                {formData.street_suppl3 ? `, ${formData.street_suppl3}` : ''}, {formData.city} {formData.district && formData.district !== formData.city ? `(${formData.district})` : ''} - {formData.postal_code} (State {formData.region})
              </span>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Primary Contact</span>
              <span style={{ color: '#0f172a' }}>{formData.telephone} | {formData.email}</span>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Expected Review SLA</span>
              <span style={{ color: '#00823b', fontWeight: 600 }}>1 – 2 Working Days</span>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Uploaded Documents</span>
              <span style={{ color: '#00823b', fontWeight: 600 }}>
                {submissionSuccess.data?.documents?.length ?? Object.values(uploadedFiles).filter(Boolean).length} File(s) Attached
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              setSubmissionSuccess(null);
              setFormData(initialFormState);
              setUploadedFiles({ doc_gst: null, doc_pan: null, doc_coi: null, doc_poa: null });
              setActiveStep(1);
            }}
            className="btn btn-secondary"
          >
            Submit Another Application
          </button>
          <button
            onClick={() => onTrackRequested(submissionSuccess.registration_number)}
            className="btn btn-primary"
            style={{ background: '#00823b' }}
          >
            Track Status <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // Screen A5: Multi-Step Registration Form
  return (
    <div className="card" style={{ maxWidth: '960px', margin: '0 auto' }}>
      {/* Top Header */}
      <div className="card-header">
        <div>
          <h2 className="card-title">New Customer Onboarding (Screen A5)</h2>
          <p className="card-subtitle">
            Register your organization under the PNGRB Unified Tariff regime to book gas transmission capacity with IGGL.
          </p>
        </div>
      </div>

      {/* Step Indicators */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '2rem', background: '#f8fafc', borderRadius: '8px', overflow: 'hidden' }}>
        {[
          { num: 1, title: '1. Organization & Legal' },
          { num: 2, title: '2. Address & Contacts' },
          { num: 3, title: '3. Documents & Submit' },
        ].map(step => (
          <button
            key={step.num}
            type="button"
            onClick={() => {
              if (step.num === 1) setActiveStep(1);
              else if (step.num === 2 && validateStep1()) setActiveStep(2);
              else if (step.num === 3 && validateStep1() && validateStep2()) setActiveStep(3);
            }}
            style={{
              flex: 1,
              padding: '0.875rem 1rem',
              border: 'none',
              borderBottom: activeStep === step.num ? '3px solid #00823b' : '3px solid transparent',
              background: activeStep === step.num ? '#ffffff' : 'transparent',
              color: activeStep === step.num ? '#00823b' : '#64748b',
              fontWeight: activeStep === step.num ? 700 : 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            <span>{step.title}</span>
          </button>
        ))}
      </div>

      {apiError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#fef2f2', border: '1px solid #fecaca', padding: '0.875rem', borderRadius: '8px', color: '#991b1b', marginBottom: '1.5rem' }}>
          <AlertCircle size={20} />
          <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{apiError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* STEP 1: Organization & Legal */}
        {activeStep === 1 && (
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Building2 size={18} color="#00823b" /> Organization Details & Statutory Identification
            </div>

            <div className="form-grid">
              {/* Name */}
              <div className="form-group">
                <label className="form-label">
                  <span>Name *</span>
                </label>
                <input
                  type="text"
                  name="name1"
                  maxLength={40}
                  value={formData.name1}
                  onChange={handleChange}
                  placeholder="e.g. ROYAL SOLUTION GENERAL"
                  className={`form-input ${fieldErrors.name1 ? 'error' : ''}`}
                  required
                />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  {fieldErrors.name1 && <span className="field-error">{fieldErrors.name1}</span>}
                  <span className="field-hint" style={{ marginLeft: 'auto' }}>{formData.name1.length}/40 characters</span>
                </div>
              </div>

              {/* Name (continuation) */}
              <div className="form-group">
                <label className="form-label">
                  <span>Name (continuation)</span>
                </label>
                <input
                  type="text"
                  name="name2"
                  maxLength={40}
                  value={formData.name2}
                  onChange={handleChange}
                  placeholder="e.g. INSURANCE CO. LIMITED"
                  className={`form-input ${fieldErrors.name2 ? 'error' : ''}`}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  {fieldErrors.name2 && <span className="field-error">{fieldErrors.name2}</span>}
                  <span className="field-hint" style={{ marginLeft: 'auto' }}>{(formData.name2 || '').length}/40 characters</span>
                </div>
              </div>

              {/* PAN */}
              <div className="form-group">
                <label className="form-label">
                  <span>Permanent Account Number (PAN) *</span>
                </label>
                <input
                  type="text"
                  name="pan_number"
                  maxLength={10}
                  value={formData.pan_number}
                  onChange={(e) => handleChange({ target: { name: 'pan_number', value: e.target.value.toUpperCase() } })}
                  placeholder="e.g. AABCR7106G"
                  className={`form-input ${fieldErrors.pan_number ? 'error' : ''}`}
                  required
                />
                {fieldErrors.pan_number && <span className="field-error">{fieldErrors.pan_number}</span>}
              </div>

              {/* Tax Number (GSTIN) */}
              <div className="form-group">
                <label className="form-label">
                  <span>Tax Number (GSTIN) *</span>
                </label>
                <input
                  type="text"
                  name="tax_number"
                  maxLength={15}
                  value={formData.tax_number}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setFormData(prev => ({ ...prev, tax_number: val }));
                    if (fieldErrors.tax_number) {
                      setFieldErrors(p => ({ ...p, tax_number: null }));
                    }
                  }}
                  placeholder="e.g. 08AABCR7106A1AB"
                  className={`form-input ${fieldErrors.tax_number ? 'error' : ''}`}
                  required
                />
                {fieldErrors.tax_number && <span className="field-error">{fieldErrors.tax_number}</span>}
              </div>

              {/* System Defaults */}
              <div className="form-group">
                <label className="form-label">
                  <span>Country</span>
                </label>
                <input type="text" value="IN (India)" disabled className="form-input" />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span>Language Key</span>
                </label>
                <input type="text" value="EN (English)" disabled className="form-input" />
              </div>
            </div>

            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem' }}>
              <button
                type="button"
                onClick={handleNext}
                className="btn btn-primary"
                style={{ background: '#00823b', minWidth: '150px' }}
              >
                Next: Address & Contacts <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Address & Contact */}
        {activeStep === 2 && (
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Building2 size={18} color="#00823b" /> Registered Office Address & Authorised Contacts
            </div>

            <div className="form-grid">
              {/* Address 1 */}
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">
                  <span>Address 1 *</span>
                </label>
                <input
                  type="text"
                  name="street"
                  maxLength={60}
                  value={formData.street}
                  onChange={handleChange}
                  placeholder="e.g. Office No 402,4th Floor, Axis Mall,"
                  className={`form-input ${fieldErrors.street ? 'error' : ''}`}
                  required
                />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  {fieldErrors.street && <span className="field-error">{fieldErrors.street}</span>}
                  <span className="field-hint" style={{ marginLeft: 'auto' }}>{formData.street.length}/60 characters</span>
                </div>
              </div>

              {/* Address 2 */}
              <div className="form-group">
                <label className="form-label">
                  <span>Address 2</span>
                </label>
                <input
                  type="text"
                  name="street_suppl1"
                  maxLength={40}
                  value={formData.street_suppl1}
                  onChange={handleChange}
                  placeholder="e.g. Industrial Estate, Phase-II"
                  className="form-input"
                />
                <span className="field-hint" style={{ textAlign: 'right', display: 'block' }}>{(formData.street_suppl1 || '').length}/40</span>
              </div>

              {/* Address 3 */}
              <div className="form-group">
                <label className="form-label">
                  <span>Address 3</span>
                </label>
                <input
                  type="text"
                  name="street_suppl2"
                  maxLength={40}
                  value={formData.street_suppl2}
                  onChange={handleChange}
                  placeholder="e.g. Delhi Plant"
                  className="form-input"
                />
                <span className="field-hint" style={{ textAlign: 'right', display: 'block' }}>{(formData.street_suppl2 || '').length}/40</span>
              </div>

              {/* Address 4 */}
              <div className="form-group">
                <label className="form-label">
                  <span>Address 4</span>
                </label>
                <input
                  type="text"
                  name="street_suppl3"
                  maxLength={40}
                  value={formData.street_suppl3}
                  onChange={handleChange}
                  placeholder="e.g. Near Power Station"
                  className="form-input"
                />
                <span className="field-hint" style={{ textAlign: 'right', display: 'block' }}>{(formData.street_suppl3 || '').length}/40</span>
              </div>

              {/* City */}
              <div className="form-group">
                <label className="form-label">
                  <span>City *</span>
                </label>
                <input
                  type="text"
                  name="city"
                  maxLength={35}
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="e.g. Jaipur"
                  className={`form-input ${fieldErrors.city ? 'error' : ''}`}
                  required
                />
                {fieldErrors.city && <span className="field-error">{fieldErrors.city}</span>}
              </div>

              {/* District */}
              <div className="form-group">
                <label className="form-label">
                  <span>District</span>
                </label>
                <input
                  type="text"
                  name="district"
                  maxLength={40}
                  value={formData.district}
                  onChange={handleChange}
                  placeholder="e.g. Jaipur"
                  className="form-input"
                />
                <span className="field-hint">Defaults to City if left blank</span>
              </div>

              {/* State / Region */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>
                    <span>State / Region *</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => loadRegions(true)}
                    className="btn btn-secondary"
                    disabled={regionsLoading}
                    style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', background: '#fff', color: '#166534', borderColor: '#bbf7d0', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                    title="Refresh live states"
                  >
                    <RotateCw size={11} className={regionsLoading ? 'spin' : ''} /> {regionsLoading ? 'Fetching...' : 'Refresh States'}
                  </button>
                </div>
                <select
                  name="region"
                  value={formData.region}
                  onChange={handleChange}
                  className={`form-input ${fieldErrors.region ? 'error' : ''}`}
                  required
                >
                  {regions.length === 0 ? (
                    <option value={formData.region || ''}>
                      {formData.region ? `${formData.region} (Current)` : '-- No States (Connect VPN) --'}
                    </option>
                  ) : (
                    <>
                      <option value="">-- Select State --</option>
                      {formData.region && !regions.some(r => r.code === formData.region) && (
                        <option value={formData.region}>{formData.region} (Current)</option>
                      )}
                      {regions.map(r => (
                        <option key={r.code} value={r.code}>{r.label}</option>
                      ))}
                    </>
                  )}
                </select>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  {fieldErrors.region && <span className="field-error">{fieldErrors.region}</span>}
                  <span className="field-hint" style={{ marginLeft: 'auto' }}>
                    {regions.length > 0 ? 'Loaded live state master data' : 'Connect to VPN and click Refresh States to load states'}
                  </span>
                </div>
              </div>

              {/* Postal Code */}
              <div className="form-group">
                <label className="form-label">
                  <span>Postal Code / PIN *</span>
                </label>
                <input
                  type="text"
                  name="postal_code"
                  maxLength={6}
                  value={formData.postal_code}
                  onChange={handleChange}
                  placeholder="e.g. 302001"
                  className={`form-input ${fieldErrors.postal_code ? 'error' : ''}`}
                  required
                />
                {fieldErrors.postal_code && <span className="field-error">{fieldErrors.postal_code}</span>}
              </div>

              {/* Telephone */}
              <div className="form-group">
                <label className="form-label">
                  <span>Telephone / Mobile *</span>
                </label>
                <input
                  type="text"
                  name="telephone"
                  maxLength={16}
                  value={formData.telephone}
                  onChange={handleChange}
                  placeholder="e.g. 9520278380"
                  className={`form-input ${fieldErrors.telephone ? 'error' : ''}`}
                  required
                />
                {fieldErrors.telephone && <span className="field-error">{fieldErrors.telephone}</span>}
              </div>

              {/* Contact Email */}
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">
                  <span>Contact / Portal Login Email *</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="e.g. contact@royalsolution.com"
                  className={`form-input ${fieldErrors.email ? 'error' : ''}`}
                  required
                />
                {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
                <span className="field-hint">You can also sign in later with your Phone Number or Customer Number once issued.</span>
              </div>

              {/* Password */}
              <div className="form-group">
                <label className="form-label">
                  <span>Create Login Password *</span>
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Choose secure password"
                  className={`form-input ${fieldErrors.password ? 'error' : ''}`}
                  required
                />
                {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
              </div>

              {/* Confirm Password */}
              <div className="form-group">
                <label className="form-label">
                  <span>Confirm Password *</span>
                </label>
                <input
                  type="password"
                  name="confirm_password"
                  value={formData.confirm_password}
                  onChange={handleChange}
                  placeholder="Re-enter password"
                  className={`form-input ${fieldErrors.confirm_password ? 'error' : ''}`}
                  required
                />
                {fieldErrors.confirm_password && <span className="field-error">{fieldErrors.confirm_password}</span>}
              </div>
            </div>

            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem' }}>
              <button
                type="button"
                onClick={() => setActiveStep(1)}
                className="btn btn-secondary"
              >
                <ArrowLeft size={16} /> Back to Step 1
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="btn btn-primary"
                style={{ background: '#00823b', minWidth: '150px' }}
              >
                Next: Documents & Submit <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Verification & Submission */}
        {activeStep === 3 && (
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileCheck size={18} color="#00823b" /> Statutory Documents & Final Review
            </div>

            {/* Interactive Document Upload Section */}
            <div style={{ marginBottom: '1.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>
                  Upload Mandatory Statutory Documents:
                </span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Supported formats: PDF, JPG, PNG (Max 10 MB per file)
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1rem' }}>
                {[
                  {
                    key: 'doc_gst',
                    label: 'GSTIN Registration Certificate (Form REG-06)',
                    hint: 'Principal place of business registration certificate',
                    required: true,
                  },
                  {
                    key: 'doc_pan',
                    label: 'Permanent Account Number (PAN) Card',
                    hint: 'Company / Firm PAN card copy',
                    required: true,
                  },
                  {
                    key: 'doc_coi',
                    label: 'Certificate of Incorporation / Registration',
                    hint: 'MCA Certificate of Incorporation or Partnership Deed',
                    required: false,
                  },
                  {
                    key: 'doc_poa',
                    label: 'Board Resolution / Power of Attorney (PoA)',
                    hint: 'Authorisation for designated portal signatory',
                    required: false,
                  },
                ].map((doc) => {
                  const file = uploadedFiles[doc.key];
                  return (
                    <div
                      key={doc.key}
                      style={{
                        border: file ? '1.5px solid #a7f3d0' : '1.5px dashed #cbd5e1',
                        borderRadius: '10px',
                        padding: '1rem',
                        background: file ? '#f0fdf4' : '#f8fafc',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                          <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#0f172a' }}>
                            {doc.label} {doc.required && <span style={{ color: '#ef4444' }}>*</span>}
                          </span>
                          {file && (
                            <span className="badge badge-green" style={{ fontSize: '0.65rem' }}>
                              <CheckCircle2 size={11} /> Attached
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: '0.725rem', color: '#64748b', marginBottom: '0.75rem' }}>
                          {doc.hint}
                        </p>
                      </div>

                      {file ? (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: '#ffffff',
                            border: '1px solid #bbf7d0',
                            borderRadius: '8px',
                            padding: '0.5rem 0.75rem',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                            <FileText size={18} color="#00823b" style={{ flexShrink: 0 }} />
                            <div style={{ overflow: 'hidden' }}>
                              <div
                                style={{
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  color: '#0f172a',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  maxWidth: '200px',
                                }}
                                title={file.name}
                              >
                                {file.name}
                              </div>
                              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                {formatFileSize(file.size)}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(doc.key)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              padding: '0.25rem',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                            title="Remove file"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ) : (
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            padding: '0.75rem',
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            color: '#00823b',
                            textAlign: 'center',
                            transition: 'background 0.15s ease',
                          }}
                        >
                          <Upload size={16} />
                          <span>Choose Document</span>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                handleFileSelect(doc.key, e.target.files[0]);
                              }
                            }}
                            style={{ display: 'none' }}
                          />
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Review Summary */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1e293b', marginBottom: '0.75rem' }}>
                Application Summary for Review:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Legal Entity:</span>
                  <div><strong>{formData.name1} {formData.name2 ? ` ${formData.name2}` : ''}</strong></div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem' }}>GSTIN:</span>
                  <div style={{ fontFamily: 'JetBrains Mono' }}>{formData.tax_number}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem' }}>PAN:</span>
                  <div style={{ fontFamily: 'JetBrains Mono' }}>{formData.pan_number}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Address:</span>
                  <div>
                    {formData.street}
                    {formData.street_suppl1 ? `, ${formData.street_suppl1}` : ''}
                    {formData.street_suppl2 ? `, ${formData.street_suppl2}` : ''}
                    {formData.street_suppl3 ? `, ${formData.street_suppl3}` : ''}, {formData.city} {formData.district && formData.district !== formData.city ? `(${formData.district})` : ''} - {formData.postal_code} (State {formData.region})
                  </div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Telephone & Email:</span>
                  <div>{formData.telephone} | {formData.email}</div>
                </div>
              </div>
            </div>

            {/* Declaration */}
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer', fontSize: '0.825rem', color: '#166534' }}>
                <input
                  type="checkbox"
                  checked={declarationAccepted}
                  onChange={(e) => setDeclarationAccepted(e.target.checked)}
                  style={{ marginTop: '0.2rem' }}
                />
                <span>
                  I/We hereby declare that all particulars furnished above are true, complete, and correct to the best of our knowledge. We agree to abide by the General Terms and Conditions of IGGL's Gas Transportation Agreement and PNGRB Open Access regulations.
                </span>
              </label>
            </div>

            {/* Security Captcha Verification */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.5rem', maxWidth: '480px' }}>
              <CaptchaWidget
                value={captchaInput}
                onChange={(val) => {
                  setCaptchaInput(val);
                  setCaptchaError(false);
                }}
                onCodeChange={(code) => setGeneratedCaptcha(code)}
                error={captchaError}
                label="Security Verification Captcha"
                placeholder="Enter characters shown"
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem' }}>
              <button
                type="button"
                onClick={() => setActiveStep(2)}
                className="btn btn-secondary"
              >
                <ArrowLeft size={16} /> Back to Step 2
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
                style={{ background: '#00823b', minWidth: '180px' }}
              >
                {submitting ? 'Submitting Application...' : 'Submit Application'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};
