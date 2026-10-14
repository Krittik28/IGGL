import React, { useState } from 'react';
import { Eye, EyeOff, ArrowRight, ArrowLeft, Search, FileText, CheckCircle2, ShieldCheck, AlertCircle, Sparkles } from 'lucide-react';
import { loginPortalUser } from '../api';
import { CaptchaWidget } from './CaptchaWidget';

export const LoginScreen = ({ onNavigate, onTrackStatus, onLoginSuccess }) => {
  const [loginRole, setLoginRole] = useState('customer'); // 'customer' or 'admin'
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [captchaInput, setCaptchaInput] = useState('');
  const [generatedCaptcha, setGeneratedCaptcha] = useState('');
  const [captchaError, setCaptchaError] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!captchaInput.trim() || captchaInput.trim().toUpperCase() !== generatedCaptcha.toUpperCase()) {
      setCaptchaError(true);
      setErrorMessage('Captcha verification failed. Please enter the correct characters shown.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await loginPortalUser({
        username: userId.trim(),
        password: password,
        portalType: loginRole === 'admin' ? 'IGGL_ADMIN' : 'CUSTOMER'
      });
      // Pass logged in user and permissions up to App
      onLoginSuccess(res.user);
    } catch (err) {
      const msg = err.data?.error || err.data?.non_field_errors?.[0] || 'Authentication failed. Please verify credentials.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-wrapper">
      <div className="login-container-card">
        {/* Left Green Panel */}
        <div className="login-green-panel">
          {/* Subtle concentric wave SVG background */}
          <div className="wave-bg-overlay">
            <svg viewBox="0 0 400 400" className="wave-circles">
              <circle cx="200" cy="200" r="80" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" fill="none" />
              <circle cx="200" cy="200" r="140" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" fill="none" />
              <circle cx="200" cy="200" r="200" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" fill="none" />
              <circle cx="200" cy="200" r="260" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" fill="none" />
              <circle cx="200" cy="200" r="320" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" fill="none" />
            </svg>
          </div>

          <div className="green-panel-content">
            {/* Header logo */}
            <div className="panel-logo" onClick={() => onNavigate('home')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <img
                src="/assets/iggl_logo.png"
                alt="IGGL Logo"
                style={{ height: '42px', width: 'auto', background: '#ffffff', borderRadius: '6px', padding: '3px' }}
              />
              <span className="panel-logo-text" style={{ fontSize: '1rem', fontWeight: 700 }}>Gas Transmission</span>
            </div>

            {/* Title & Description */}
            <div className="panel-body">
              <h1 className="panel-title">Gas Transmission<br />Customer Portal</h1>
              <p className="panel-desc">
                Manage your Gas Transportation Agreements, Capacity Tranches, and nominations through a single integrated platform.
              </p>

              <ul className="panel-bullet-list">
                <li>
                  <span className="bullet-dot">•</span> Secure access to your GTAs and CTs
                </li>
                <li>
                  <span className="bullet-dot">•</span> Real-time capacity availability
                </li>
                <li>
                  <span className="bullet-dot">•</span> Digital document management
                </li>
                <li>
                  <span className="bullet-dot">•</span> Online nomination submission
                </li>
              </ul>
            </div>

            <div className="panel-footer-note">
              PNGRB Unified Tariff Regime • Indradhanush Gas Grid Limited
            </div>
          </div>
        </div>

        {/* Right White Panel */}
        <div className="login-form-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <button
              type="button"
              onClick={() => onNavigate('home')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'none',
                border: 'none',
                color: '#64748b',
                fontSize: '0.825rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <ArrowLeft size={16} /> Back to Portal Home
            </button>
          </div>

          {/* Segmented Role Switcher */}
          <div className="login-segmented-tabs">
            <button
              type="button"
              className={`segmented-tab ${loginRole === 'customer' ? 'active' : ''}`}
              onClick={() => {
                setLoginRole('customer');
                setErrorMessage(null);
                setUserId('');
                setPassword('');
              }}
            >
              Customer Login
            </button>
            <button
              type="button"
              className={`segmented-tab ${loginRole === 'admin' ? 'active' : ''}`}
              onClick={() => {
                setLoginRole('admin');
                setErrorMessage(null);
                setUserId('');
                setPassword('');
              }}
            >
              IGGL Admin Login
            </button>
          </div>

          {/* Heading */}
          <div className="login-header-group">
            <h2 className="login-title">Welcome back</h2>
            <p className="login-subtitle">
              {loginRole === 'customer'
                ? 'Sign in to Customer Shipper Portal'
                : 'Sign in with your IGGL Departmental Credentials (RBAC)'}
            </p>
          </div>

          {errorMessage && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.75rem', color: '#991b1b', fontSize: '0.825rem', marginBottom: '1.25rem' }}>
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSignIn} className="login-form">
            {/* User ID / Email / Phone / Customer No */}
            <div className="form-group">
              <label className="form-label-compact">
                {loginRole === 'customer'
                  ? 'Email, Phone Number, or Customer Number'
                  : 'IGGL Employee / Admin ID'} <span className="req">*</span>
              </label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder={
                  loginRole === 'customer'
                    ? 'Enter registered Email, Mobile, or Customer No.'
                    : 'admin@iggl.co.in'
                }
                className="login-input"
                required
              />
              {loginRole === 'customer' && (
                <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
                  Sign in using your registered Email, 10-digit Phone, or SAP Customer Number.
                </span>
              )}
            </div>

            {/* Password */}
            <div className="form-group">
              <label className="form-label-compact">
                Password <span className="req">*</span>
              </label>
              <div className="input-with-eye">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="login-input"
                  required
                />
                <button
                  type="button"
                  className="eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex="-1"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Security Captcha */}
            <CaptchaWidget
              value={captchaInput}
              onChange={(val) => {
                setCaptchaInput(val);
                setCaptchaError(false);
              }}
              onCodeChange={(code) => setGeneratedCaptcha(code)}
              error={captchaError}
              label="Security Verification Captcha"
              placeholder="Enter Captcha code"
            />

            {/* Remember Me & Forgot Password */}
            <div className="remember-forgot-row">
              <label className="remember-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember me</span>
              </label>
              <a href="#forgot" className="forgot-link" onClick={(e) => e.preventDefault()}>
                Forgot Password?
              </a>
            </div>

            {/* Sign In CTA */}
            <button type="submit" className="btn-signin-green" disabled={loading}>
              <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
              <ArrowRight size={16} />
            </button>

            {/* Register link */}
            <div className="register-redirect">
              New to IGGL?{' '}
              <button
                type="button"
                className="link-btn-green"
                onClick={() => onNavigate('register')}
              >
                Register your company
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
