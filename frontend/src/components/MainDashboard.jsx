import React from 'react';
import {
  UserPlus,
  Lock,
  Activity,
  FileText,
  Download,
  Bell,
  ArrowRight,
  Shield,
  Phone,
  Mail,
  HelpCircle,
  Search,
  CheckCircle,
  Zap,
  LockKeyhole,
} from 'lucide-react';

export const MainDashboard = ({ onNavigate }) => {
  return (
    <div className="landing-page">
      {/* Top Main Navigation Bar */}
      <header className="portal-header">
        <div className="header-container">
          {/* Logo */}
          <div className="logo-brand" onClick={() => onNavigate('home')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <img
              src="/assets/iggl_logo_animated.gif"
              alt="IGGL Logo"
              style={{ height: '44px', width: 'auto', objectFit: 'contain', borderRadius: '8px' }}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/assets/iggl_logo.png';
              }}
            />
            <div className="logo-titles">
              <div className="logo-hindi">इंद्रधनुष गैस ग्रिड लिमिटेड</div>
              <div className="logo-english">Indradhanush Gas Grid Limited</div>
            </div>
          </div>

          {/* Center Navigation Links */}
          <nav className="header-nav">
            <button className="nav-link active" onClick={() => onNavigate('home')}>
              Home
            </button>
            <button className="nav-link" onClick={() => onNavigate('capacity')}>
              Capacity
            </button>
            <button className="nav-link" onClick={() => onNavigate('tariff')}>
              Tariff & Zone
            </button>
            <button className="nav-link" onClick={() => onNavigate('notices')}>
              Notices
            </button>
            <button className="nav-link" onClick={() => onNavigate('downloads')}>
              Downloads
            </button>
            <button className="nav-link" onClick={() => onNavigate('help')}>
              Help
            </button>
          </nav>

          {/* Action CTAs */}
          <div className="header-actions">
            <button className="search-btn" title="Search Portal">
              <Search size={18} />
            </button>
            <button className="btn-login-outline" onClick={() => onNavigate('login')}>
              <Lock size={15} /> Login
            </button>
            <button className="btn-register-green" onClick={() => onNavigate('register')}>
              <UserPlus size={15} /> Register Now
            </button>
          </div>
        </div>
      </header>

      {/* Hero Banner Section */}
      <section className="hero-banner">
        <div className="hero-overlay"></div>
        <div className="hero-content">
          <div className="hero-tagline-caps">INDRADHANUSH GAS GRID LIMITED</div>
          <h1 className="hero-title">Customer Gas Transmission Portal</h1>
          <p className="hero-subtitle">
            Access capacity information, book capacity and manage your transmission agreements — all in one place.
          </p>

          <div className="hero-pills">
            <div className="hero-pill">
              <div className="hero-pill-icon"><Shield size={14} /></div>
              <span>Transparent Information</span>
            </div>
            <div className="hero-pill">
              <div className="hero-pill-icon"><Zap size={14} /></div>
              <span>Easy Transactions</span>
            </div>
            <div className="hero-pill">
              <div className="hero-pill-icon"><LockKeyhole size={14} /></div>
              <span>Secure & Reliable</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Grid Content */}
      <div className="landing-body">
        {/* Left Column: Quick Actions + Regulatory Banner */}
        <div className="main-col-left">
          {/* Quick Actions */}
          <div className="content-card">
            <div className="card-section-title">
              <span className="icon-bolt">⚡</span> Quick Actions
            </div>

            <div className="quick-actions-grid">
              {/* Action 1: New Customer Registration */}
              <div
                className="action-card card-blue"
                onClick={() => onNavigate('register')}
              >
                <div className="action-icon-circle bg-blue-icon">
                  <UserPlus size={20} color="#0284c7" />
                </div>
                <div className="action-info">
                  <div className="action-title">New Customer Registration</div>
                  <div className="action-desc">Register your organisation with IGGL</div>
                </div>
                <ArrowRight size={16} className="action-arrow arrow-blue" />
              </div>

              {/* Action 2: Customer Login */}
              <div
                className="action-card card-green"
                onClick={() => onNavigate('login')}
              >
                <div className="action-icon-circle bg-green-icon">
                  <Lock size={20} color="#16a34a" />
                </div>
                <div className="action-info">
                  <div className="action-title">Customer Login</div>
                  <div className="action-desc">Access your dashboard and services</div>
                </div>
                <ArrowRight size={16} className="action-arrow arrow-green" />
              </div>

              {/* Action 3: View Capacity Availability */}
              <div
                className="action-card card-purple"
                onClick={() => onNavigate('capacity')}
              >
                <div className="action-icon-circle bg-purple-icon">
                  <Activity size={20} color="#9333ea" />
                </div>
                <div className="action-info">
                  <div className="action-title">View Capacity Availability</div>
                  <div className="action-desc">Check total and available capacity in pipeline</div>
                </div>
                <ArrowRight size={16} className="action-arrow arrow-purple" />
              </div>

              {/* Action 4: Tariff & Zone Information */}
              <div
                className="action-card card-orange"
                onClick={() => onNavigate('tariff')}
              >
                <div className="action-icon-circle bg-orange-icon">
                  <FileText size={20} color="#ea580c" />
                </div>
                <div className="action-info">
                  <div className="action-title">Tariff & Zone Information</div>
                  <div className="action-desc">View tariff details and pipeline zones</div>
                </div>
                <ArrowRight size={16} className="action-arrow arrow-orange" />
              </div>

              {/* Action 5: Notices & Downloads */}
              <div
                className="action-card card-cyan"
                onClick={() => onNavigate('notices')}
              >
                <div className="action-icon-circle bg-cyan-icon">
                  <Download size={20} color="#0891b2" />
                </div>
                <div className="action-info">
                  <div className="action-title">Notices & Downloads</div>
                  <div className="action-desc">View circulars, notices and important documents</div>
                </div>
                <ArrowRight size={16} className="action-arrow arrow-cyan" />
              </div>
            </div>
          </div>

          {/* Regulatory Information Banner - direct asset background */}
          <div className="regulatory-banner">
            <div className="regulatory-text-box">
              <div className="regulatory-header">
                <div className="reg-icon-box">
                  <FileText size={18} color="#ffffff" />
                </div>
                <h3>Regulatory Information</h3>
              </div>
              <p>
                As per PNGRB mandate, IGGL provides capacity booking information and an online mechanism for capacity booking and nomination.
              </p>
              <button className="btn-view-details" onClick={() => onNavigate('capacity')}>
                View Details <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: News & Notices + Help */}
        <div className="main-col-right">
          {/* News & Notices */}
          <div className="content-card">
            <div className="notices-card-header">
              <div className="card-section-title">
                <Bell size={18} color="#0284c7" /> News & Notices
              </div>
              <button className="view-all-link" onClick={() => onNavigate('notices')}>
                View All <ArrowRight size={14} />
              </button>
            </div>

            <div className="notices-list">
              {/* Notice 1 */}
              <div className="notice-item">
                <div className="date-badge">
                  <div className="date-num">22</div>
                  <div className="date-month">Apr</div>
                </div>
                <div className="notice-body">
                  <div className="notice-title">Revision in Unified Tariff (Effective from 01.05.2025)</div>
                  <div className="notice-snippet">PNGRB has notified the revised unified tariff structure...</div>
                </div>
                <ArrowRight size={14} className="notice-arrow" />
              </div>

              {/* Notice 2 */}
              <div className="notice-item">
                <div className="date-badge">
                  <div className="date-num">15</div>
                  <div className="date-month">Apr</div>
                </div>
                <div className="notice-body">
                  <div className="notice-title">Maintenance Notice – Portal Downtime</div>
                  <div className="notice-snippet">The portal will be under maintenance on 20.04.2025...</div>
                </div>
                <ArrowRight size={14} className="notice-arrow" />
              </div>

              {/* Notice 3 */}
              <div className="notice-item">
                <div className="date-badge">
                  <div className="date-num">10</div>
                  <div className="date-month">Apr</div>
                </div>
                <div className="notice-body">
                  <div className="notice-title">New Customer Registration Guidelines</div>
                  <div className="notice-snippet">Please refer to the updated guidelines for customer...</div>
                </div>
                <ArrowRight size={14} className="notice-arrow" />
              </div>

              {/* Notice 4 */}
              <div className="notice-item">
                <div className="date-badge">
                  <div className="date-num">05</div>
                  <div className="date-month">Apr</div>
                </div>
                <div className="notice-body">
                  <div className="notice-title">GTA Template Updated</div>
                  <div className="notice-snippet">The latest GTA template is now available under...</div>
                </div>
                <ArrowRight size={14} className="notice-arrow" />
              </div>
            </div>
          </div>

          {/* Need Help? Box */}
          <div className="content-card help-card">
            <div className="card-section-title">
              <Phone size={18} color="#0284c7" /> Need Help?
            </div>
            <p className="help-subtitle">
              For any assistance, please contact our support team.
            </p>

            <div className="help-pills-row">
              <a href="tel:18001234567" className="help-pill">
                <Phone size={14} />
                <span><strong>1800-123-4567</strong> <small style={{ color: '#64748b' }}>Toll Free</small></span>
              </a>
              <a href="mailto:support@iggl.co.in" className="help-pill">
                <Mail size={14} />
                <span>support@iggl.co.in</span>
              </a>
              <div className="help-pill" style={{ cursor: 'pointer' }}>
                <HelpCircle size={14} />
                <span>User Manual & FAQ</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
