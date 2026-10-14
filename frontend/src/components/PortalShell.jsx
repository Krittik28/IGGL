import React, { useState } from 'react';
import {
  LayoutDashboard,
  FileCheck,
  FileText,
  Layers,
  Building,
  Bell,
  LogOut,
  ChevronLeft,
  Route
} from 'lucide-react';

export const PortalShell = ({
  role = 'CUSTOMER',
  currentUser = null,
  currentSection = 'dashboard',
  onSelectSection,
  onLogout,
  children
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const isCustomer = role === 'CUSTOMER';
  const isAdmin = !isCustomer;

  // Navigation Items
  const customerNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'registration', label: 'Registration', icon: FileCheck },
    { id: 'gtas', label: 'Agreements (GTAs)', icon: FileText },
    { id: 'cts', label: 'CT Requests', icon: Layers },
    { id: 'uft', label: 'UFT Routes & Capacity', icon: Route },
  ];

  const adminNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'registrations', label: 'Registrations', icon: FileCheck },
    { id: 'customers', label: 'Customers', icon: Building },
    { id: 'gtas', label: 'GTA Management', icon: FileText },
    { id: 'cts', label: 'CT Management', icon: Layers },
    { id: 'uft', label: 'UFT & Capacity Master', icon: Route },
  ];

  const navItems = isCustomer ? customerNavItems : adminNavItems;

  const displayName = currentUser?.full_name || currentUser?.username || currentUser?.email || (isCustomer ? 'Customer User' : 'IGGL Admin');
  const userRoleSubtitle = currentUser?.designation || currentUser?.company_name || (isCustomer ? 'Shipper Customer' : 'IGGL Administration');
  const initial = (displayName.charAt(0) || 'U').toUpperCase();

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f4f6f8', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* Left Sidebar Menu */}
      <aside
        style={{
          width: collapsed ? '72px' : '260px',
          background: '#ffffff',
          borderRight: '1px solid #e5e7eb',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.2s ease',
          zIndex: 40,
          position: 'sticky',
          top: 0,
          height: '100vh',
          flexShrink: 0,
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}
      >
        {/* Top Header Logo */}
        <div
          style={{
            padding: collapsed ? '1rem 0.5rem' : '1.1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            borderBottom: '1px solid #f1f5f9',
            minHeight: '68px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', overflow: 'hidden' }}>
            <img
              src="/assets/iggl_logo_animated.gif"
              alt="IGGL Animated Logo"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                objectFit: 'contain',
                flexShrink: 0
              }}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/assets/iggl_logo.png';
              }}
            />
            {!collapsed && (
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#00823b', letterSpacing: '0.02em', lineHeight: 1.1 }}>
                  {isCustomer ? 'IGGL' : 'IGGL'}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
                  {isCustomer ? 'Gas Transmission' : 'ADMIN PORTAL'}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              padding: '0.3rem',
              cursor: 'pointer',
              display: collapsed ? 'none' : 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b'
            }}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronLeft size={16} />
          </button>
        </div>

        {/* User Profile Pill in Sidebar */}
        {!collapsed && (
          <div
            style={{
              margin: '0.85rem 1rem 0.5rem 1rem',
              padding: '0.65rem 0.8rem',
              background: '#f8fafc',
              borderRadius: '10px',
              border: '1px solid #edf2f7',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem'
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: '#00823b',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              {initial}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#1e293b', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {displayName}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {userRoleSubtitle}
              </div>
            </div>
          </div>
        )}

        {/* Navigation List */}
        <nav style={{ flex: 1, padding: '0.5rem 0.75rem', overflowY: 'auto' }}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentSection === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => onSelectSection(item.id)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: collapsed ? 'center' : 'space-between',
                      gap: '0.75rem',
                      padding: collapsed ? '0.7rem 0' : '0.6rem 0.85rem',
                      borderRadius: '8px',
                      border: 'none',
                      background: isActive ? '#e8f5e9' : 'transparent',
                      color: isActive ? '#00823b' : '#475569',
                      fontWeight: isActive ? 600 : 500,
                      fontSize: '0.825rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      textAlign: 'left'
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'transparent';
                    }}
                    title={collapsed ? item.label : undefined}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Icon size={17} color={isActive ? '#00823b' : '#64748b'} />
                      {!collapsed && <span>{item.label}</span>}
                    </div>

                    {!collapsed && item.badge && (
                      <span
                        style={{
                          background: item.badgeColor || '#00823b',
                          color: '#ffffff',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          borderRadius: '10px',
                          padding: '0.1rem 0.45rem',
                          minWidth: '18px',
                          textAlign: 'center'
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Bottom Logout */}
        <div style={{ padding: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
          <button
            onClick={onLogout}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap: '0.65rem',
              padding: '0.55rem 0.85rem',
              borderRadius: '8px',
              border: 'none',
              background: 'transparent',
              color: '#64748b',
              fontSize: '0.825rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#dc2626';
              e.currentTarget.style.background = '#fee2e2';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#64748b';
              e.currentTarget.style.background = 'transparent';
            }}
            title="Logout"
          >
            <LogOut size={16} />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Header Bar */}
        <header
          style={{
            height: '60px',
            background: '#ffffff',
            borderBottom: '1px solid #e5e7eb',
            padding: '0 1.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 30,
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
          }}
        >
          {/* Left info / Admin pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            {isAdmin && (
              <span
                style={{
                  background: '#e8f5e9',
                  color: '#00823b',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '0.25rem 0.65rem',
                  borderRadius: '6px',
                  border: '1px solid #c8e6c9'
                }}
              >
                IGGL Admin
              </span>
            )}
            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
              {isCustomer ? 'Gas Transmission Portal' : 'Transmission Administration'}
            </span>
          </div>

          {/* Right Header: Notification & User Pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              style={{
                position: 'relative',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '50%',
                width: '34px',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#64748b'
              }}
              title="Notifications"
            >
              <Bell size={16} />
              <span
                style={{
                  position: 'absolute',
                  top: '6px',
                  right: '6px',
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: '#ef4444'
                }}
              />
            </button>

            {/* Profile Avatar Pill */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                background: '#ffffff',
                padding: '0.25rem 0.5rem',
                borderRadius: '20px'
              }}
            >
              <div
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  background: isCustomer ? '#00823b' : '#047857',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {initial}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e293b' }}>
                  {displayName}
                </span>
                <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                  {userRoleSubtitle}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Body Content */}
        <main style={{ flex: 1, padding: '1.5rem 1.75rem', overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
};
