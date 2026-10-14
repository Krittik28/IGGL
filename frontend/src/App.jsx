import React, { useState } from 'react';
import { MainDashboard } from './components/MainDashboard';
import { LoginScreen } from './components/LoginScreen';
import { CustomerRegistrationForm } from './components/CustomerRegistrationForm';
import { RegistrationStatusTracker } from './components/RegistrationStatusTracker';
import { AdminRegistrationQueue } from './components/AdminRegistrationQueue';
import { AdminCustomerDirectory } from './components/AdminCustomerDirectory';
import { CustomerDashboard } from './components/CustomerDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { GTAManagement } from './components/GTAManagement';
import { CTManagement } from './components/CTManagement';
import { UFTManagement } from './components/UFTManagement';
import { PortalShell } from './components/PortalShell';
import { logoutPortalUser } from './api';
import { ArrowLeft, Home, Lock } from 'lucide-react';

export function App() {
  // Persisted user profile or null
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('iggl_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Top level view: 'portal', 'home', 'login', 'register', 'track'
  const [currentView, setCurrentView] = useState(() => {
    const saved = localStorage.getItem('iggl_user');
    return saved ? 'portal' : 'home';
  });

  // Active section inside the portal
  const [portalSection, setPortalSection] = useState('dashboard');
  const [trackQuery, setTrackQuery] = useState('');
  const [ctPreFill, setCtPreFill] = useState(null);

  const navigateTo = (view) => {
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBookCapacityFromUFT = (preFillData) => {
    setCtPreFill(preFillData);
    setPortalSection('cts');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateCTsFromGTA = (gtaData) => {
    if (gtaData) {
      if (typeof gtaData === 'object') {
        setCtPreFill({
          gta: gtaData.id,
          gta_no: gtaData.gta_number || gtaData.gta_no,
          sold_to_party: gtaData.shipper_name
        });
      } else {
        setCtPreFill({
          gta: gtaData
        });
      }
    }
    setPortalSection('cts');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTrackRequested = (query) => {
    setTrackQuery(query);
    setCurrentView('track');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLoginSuccess = (userProfile) => {
    setCurrentUser(userProfile);
    localStorage.setItem('iggl_user', JSON.stringify(userProfile));
    setCurrentView('portal');
    setPortalSection('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = async () => {
    await logoutPortalUser();
    setCurrentUser(null);
    localStorage.removeItem('iggl_user');
    setCurrentView('home');
    setPortalSection('dashboard');
  };

  const isCustomer = currentUser?.role === 'CUSTOMER';
  const roleMode = isCustomer ? 'CUSTOMER' : 'ADMIN';

  // 1. Logged-in Portal Experience (Left Sidebar + Header + Dynamic Section)
  if (currentView === 'portal' && currentUser) {
    return (
      <PortalShell
        role={roleMode}
        currentUser={currentUser}
        currentSection={portalSection}
        onSelectSection={(sec) => setPortalSection(sec)}
        onLogout={handleLogout}
      >
        {/* Render Customer Sections */}
        {isCustomer ? (
          <>
            {portalSection === 'dashboard' && (
              <CustomerDashboard currentUser={currentUser} onNavigateSection={(sec) => setPortalSection(sec)} />
            )}
            {portalSection === 'gtas' && (
              <GTAManagement
                role="CUSTOMER"
                currentUser={currentUser}
                onNavigateCTs={handleNavigateCTsFromGTA}
              />
            )}
            {portalSection === 'cts' && (
              <CTManagement
                role="CUSTOMER"
                currentUser={currentUser}
                initialPreFill={ctPreFill}
                onClearPreFill={() => setCtPreFill(null)}
              />
            )}
            {portalSection === 'uft' && (
              <UFTManagement
                currentUser={currentUser}
                onBookCapacity={handleBookCapacityFromUFT}
              />
            )}
            {portalSection === 'registration' && (
              <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <RegistrationStatusTracker initialQuery={currentUser?.sap_customer_code || currentUser?.email || ''} />
              </div>
            )}
            {(portalSection === 'capacity' || portalSection === 'tariff' || portalSection === 'documents' || portalSection === 'users' || portalSection === 'organization' || portalSection === 'notifications' || portalSection === 'settings') && (
              <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '2.5rem', textAlign: 'center' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', textTransform: 'capitalize' }}>
                  {portalSection.replace('_', ' ')}
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                  This module is integrated with the North-East Gas Grid (NEGG) & PNGRB Unified Transmission Tariff system.
                </p>
                <div style={{ marginTop: '1.5rem' }}>
                  <button
                    onClick={() => setPortalSection('dashboard')}
                    className="btn btn-primary"
                    style={{ background: '#00823b', padding: '0.5rem 1rem', fontSize: '0.825rem' }}
                  >
                    Back to Dashboard
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Render Admin Sections */
          <>
            {portalSection === 'dashboard' && (
              <AdminDashboard onNavigateSection={(sec) => setPortalSection(sec)} />
            )}
            {portalSection === 'registrations' && (
              <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                <AdminRegistrationQueue currentUser={currentUser} />
              </div>
            )}
            {portalSection === 'gtas' && (
              <GTAManagement
                role="ADMIN"
                currentUser={currentUser}
                onNavigateCTs={handleNavigateCTsFromGTA}
              />
            )}
            {portalSection === 'cts' && (
              <CTManagement
                role="ADMIN"
                currentUser={currentUser}
                initialPreFill={ctPreFill}
                onClearPreFill={() => setCtPreFill(null)}
              />
            )}
            {portalSection === 'uft' && (
              <UFTManagement
                currentUser={currentUser}
                onBookCapacity={handleBookCapacityFromUFT}
              />
            )}
            {portalSection === 'customers' && (
              <AdminCustomerDirectory currentUser={currentUser} />
            )}
            {(portalSection === 'capacity' || portalSection === 'tariff' || portalSection === 'documents' || portalSection === 'notices' || portalSection === 'users' || portalSection === 'audit' || portalSection === 'settings') && (
              <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '2.5rem', textAlign: 'center' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', textTransform: 'capitalize' }}>
                  {portalSection.replace('_', ' ')}
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                  Commercial and administrative control panel for IGGL transmission operations.
                </p>
                <div style={{ marginTop: '1.5rem' }}>
                  <button
                    onClick={() => setPortalSection('dashboard')}
                    className="btn btn-primary"
                    style={{ background: '#00823b', padding: '0.5rem 1rem', fontSize: '0.825rem' }}
                  >
                    Back to Admin Dashboard
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </PortalShell>
    );
  }

  // 2. Unauthenticated & Standalone Views
  return (
    <div className="app-container">
      {/* Clean minimal Top Bar for public standalone sub-screens (Register & Track) */}
      {(currentView === 'register' || currentView === 'track') && (
        <header
          style={{
            background: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            padding: '0.75rem 2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 30
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={() => navigateTo('home')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'none',
                border: 'none',
                color: '#00823b',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              <Home size={15} /> IGGL Home
            </button>
            <span style={{ color: '#cbd5e1' }}>|</span>
            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
              {currentView === 'register' && 'New Customer Onboarding (Screen A5)'}
              {currentView === 'track' && 'Application Status Tracking (Screen A6)'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => navigateTo('login')}
              className="btn btn-primary"
              style={{ background: '#00823b', padding: '0.35rem 0.85rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Lock size={13} /> Sign In
            </button>
          </div>
        </header>
      )}

      {/* Main Views */}
      {currentView === 'home' && (
        <MainDashboard
          onNavigate={(view) => {
            if (view === 'login') navigateTo('login');
            else if (view === 'register') navigateTo('register');
            else if (view === 'track') navigateTo('track');
            else navigateTo(view);
          }}
        />
      )}

      {currentView === 'login' && (
        <LoginScreen
          onNavigate={navigateTo}
          onTrackStatus={handleTrackRequested}
          onLoginSuccess={handleLoginSuccess}
        />
      )}

      {currentView === 'register' && (
        <div style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1.5rem', width: '100%' }}>
          <CustomerRegistrationForm onTrackRequested={handleTrackRequested} />
        </div>
      )}

      {currentView === 'track' && (
        <div style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1.5rem', width: '100%' }}>
          <RegistrationStatusTracker initialQuery={trackQuery} />
        </div>
      )}

      {/* Public Footer */}
      {currentView !== 'login' && (
        <footer style={{ marginTop: 'auto', borderTop: '1px solid #e2e8f0', background: '#ffffff', padding: '1.25rem 2rem', textAlign: 'center', fontSize: '0.8rem', color: '#64748b' }}>
          <p>
            Indradhanush Gas Grid Limited (IGGL) • North-East Gas Grid (NEGG) • PNGRB Unified Tariff Regime
          </p>
        </footer>
      )}
    </div>
  );
}

export default App;
