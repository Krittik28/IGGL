import React, { useState, useEffect } from 'react';
import {
  Users,
  Building,
  FileText,
  Layers,
  ArrowRight,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { fetchAdminDashboard } from '../api';

export const AdminDashboard = ({ onNavigateSection }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetchAdminDashboard();
      setData(res);
    } catch (err) {
      console.error('Failed to load admin dashboard data', err);
      // Empty dynamic state - no fake dummy data!
      setData({
        metrics: {
          new_registrations_7d: 0,
          new_registrations_subtext: '0 require action',
          active_customers: 0,
          active_customers_subtext: '0 onboarded total',
          active_gtas: 0,
          active_gtas_subtext: 'Across all shippers',
          ct_requests_pending: 0,
          ct_requests_subtext: '0 awaiting review'
        },
        registration_funnel: {
          'New': 0,
          'Under Review': 0,
          'Returned': 0,
          'Approved': 0,
          'Rejected': 0
        },
        gta_status_distribution: {
          'In Force': 0,
          'Ready to Sign': 0,
          'Under Review': 0,
          'Draft': 0
        },
        capacity_utilisation: {
          technical: 93.0,
          booked_firm: 0.0,
          booked_interruptible: 0.0,
          available: 93.0
        },
        workflow_pending: {
          'Registration Review': 0,
          'CT Approval': 0,
          'GTA Activation': 0,
          'Document Verification': 0
        },
        recent_registrations: [],
        recent_activity: []
      });
    } finally {
      setLoading(false);
    }
  };

  const metrics = data?.metrics || {};
  const funnel = data?.registration_funnel || {};
  const gtaStatus = data?.gta_status_distribution || {};
  const capacity = data?.capacity_utilisation || {};
  const workflows = data?.workflow_pending || {};
  const recentRegs = data?.recent_registrations || [];
  const activities = data?.recent_activity || [];

  return (
    <div style={{ maxWidth: '1360px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 1. Top 4 Metric KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
        <div style={kpiCardStyle}>
          <div>
            <div style={kpiLabelStyle}>NEW REGISTRATIONS (7D)</div>
            <div style={kpiValueStyle}>{metrics.new_registrations_7d ?? 0}</div>
            <div style={kpiSubtextStyle}>{metrics.new_registrations_subtext || '0 require action'}</div>
          </div>
          <div style={{ ...iconCircleStyle, background: '#e0f2fe' }}>
            <Users size={18} color="#0284c7" />
          </div>
        </div>

        <div style={kpiCardStyle}>
          <div>
            <div style={kpiLabelStyle}>ACTIVE CUSTOMERS</div>
            <div style={kpiValueStyle}>{metrics.active_customers ?? 0}</div>
            <div style={kpiSubtextStyle}>{metrics.active_customers_subtext || '0 onboarded total'}</div>
          </div>
          <div style={{ ...iconCircleStyle, background: '#eef2ff' }}>
            <Building size={18} color="#4f46e5" />
          </div>
        </div>

        <div style={kpiCardStyle}>
          <div>
            <div style={kpiLabelStyle}>ACTIVE GTAS</div>
            <div style={kpiValueStyle}>{metrics.active_gtas ?? 0}</div>
            <div style={kpiSubtextStyle}>{metrics.active_gtas_subtext || 'Across all shippers'}</div>
          </div>
          <div style={{ ...iconCircleStyle, background: '#e8f5e9' }}>
            <FileText size={18} color="#00823b" />
          </div>
        </div>

        <div style={kpiCardStyle}>
          <div>
            <div style={kpiLabelStyle}>CT REQUESTS PENDING</div>
            <div style={kpiValueStyle}>{metrics.ct_requests_pending ?? 0}</div>
            <div style={kpiSubtextStyle}>{metrics.ct_requests_subtext || '0 awaiting review'}</div>
          </div>
          <div style={{ ...iconCircleStyle, background: '#fef3c7' }}>
            <Layers size={18} color="#d97706" />
          </div>
        </div>
      </div>

      {/* 2. Middle Row: Registration Funnel & CT Request Trend */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '1rem' }}>
        {/* Registration Funnel */}
        <div style={{ ...whiteCardStyle, flexDirection: 'column', alignItems: 'stretch' }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>Registration Funnel</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Current status distribution</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {Object.entries(funnel).map(([stage, count]) => {
              const max = Math.max(1, ...Object.values(funnel));
              const pct = Math.min(100, Math.round((count / max) * 100));
              return (
                <div key={stage}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#475569', marginBottom: '0.25rem' }}>
                    <span>{stage}</span>
                    <span style={{ fontWeight: 600, color: '#1e293b' }}>{count}</span>
                  </div>
                  <div style={{ height: '7px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: '#00823b', borderRadius: '4px' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Capacity Utilisation */}
        <div style={{ ...whiteCardStyle, flexDirection: 'column', alignItems: 'stretch' }}>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>Capacity Utilisation</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Total network contracted baseline (MMSCMD)</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.75rem' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', marginBottom: '0.25rem' }}>
                <span>Technical Capacity</span>
                <span style={{ fontWeight: 600, color: '#1e293b' }}>{capacity.technical || 93.0} MMSCMD</span>
              </div>
              <div style={{ height: '7px', background: '#e2e8f0', borderRadius: '4px' }} />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', marginBottom: '0.25rem' }}>
                <span>Booked (Firm)</span>
                <span style={{ fontWeight: 600, color: '#1e293b' }}>{capacity.booked_firm || 0.0} MMSCMD</span>
              </div>
              <div style={{ height: '7px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, ((capacity.booked_firm || 0) / 93) * 100)}%`, background: '#00823b', borderRadius: '4px' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', marginBottom: '0.25rem' }}>
                <span>Booked (Interruptible)</span>
                <span style={{ fontWeight: 600, color: '#1e293b' }}>{capacity.booked_interruptible || 0.0} MMSCMD</span>
              </div>
              <div style={{ height: '7px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, ((capacity.booked_interruptible || 0) / 93) * 100)}%`, background: '#10b981', borderRadius: '4px' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', marginBottom: '0.25rem' }}>
                <span>Available Transmission Capacity</span>
                <span style={{ fontWeight: 600, color: '#1e293b' }}>{capacity.available || 93.0} MMSCMD</span>
              </div>
              <div style={{ height: '7px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, ((capacity.available || 93) / 93) * 100)}%`, background: '#f97316', borderRadius: '4px' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Row 3: GTA Status Breakdown + Workflow Pending */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {/* GTA Status Breakdown */}
        <div style={{ ...whiteCardStyle, flexDirection: 'column', alignItems: 'stretch' }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b', marginBottom: '0.75rem' }}>
            GTA Status Breakdown
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.75rem' }}>
            {Object.entries(gtaStatus).map(([label, count]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #f8fafc', color: '#475569' }}>
                <span>{label}</span>
                <span style={{ fontWeight: 700, color: '#1e293b' }}>{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Workflow Pending */}
        <div style={{ ...whiteCardStyle, flexDirection: 'column', alignItems: 'stretch' }}>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>Workflow Pending</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>By department</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.75rem' }}>
            {[
              { label: 'Registration Review', count: workflows['Registration Review'] ?? 0, color: '#f97316' },
              { label: 'CT Approval', count: workflows['CT Approval'] ?? 0, color: '#00823b' },
              { label: 'GTA Activation', count: workflows['GTA Activation'] ?? 0, color: '#2563eb' },
              { label: 'Document Verification', count: workflows['Document Verification'] ?? 0, color: '#0d9488' },
            ].map((w) => (
              <div key={w.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', marginBottom: '0.25rem' }}>
                  <span>{w.label}</span>
                  <span style={{ fontWeight: 600, color: '#1e293b' }}>{w.count}</span>
                </div>
                <div style={{ height: '7px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, (w.count / 10) * 100)}%`, background: w.color, borderRadius: '4px' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Bottom Row: Recent Registrations & Recent Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem' }}>
        {/* Recent Registrations */}
        <div style={{ ...whiteCardStyle, flexDirection: 'column', alignItems: 'stretch' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>Recent Registrations</div>
            <button
              onClick={() => onNavigateSection && onNavigateSection('registrations')}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#00823b',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              View All
            </button>
          </div>

          {recentRegs.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.8rem', background: '#f8fafc', borderRadius: '8px' }}>
              No customer registrations in queue.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {recentRegs.map((reg) => (
                <div
                  key={reg.ref}
                  onClick={() => onNavigateSection && onNavigateSection('registrations')}
                  style={{
                    border: '1px solid #f1f5f9',
                    borderRadius: '8px',
                    padding: '0.75rem 0.95rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#fafbfc',
                    cursor: 'pointer'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.825rem', color: '#1e293b' }}>{reg.company_name}</div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                      {reg.ref} · {reg.date}
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      padding: '0.2rem 0.55rem',
                      borderRadius: '4px',
                      background:
                        reg.status_code === 'APPROVED' || reg.status_code === 'BP_CREATED' ? '#dcfce7' :
                        reg.status_code === 'RETURNED' ? '#fff7ed' : '#eff6ff',
                      color:
                        reg.status_code === 'APPROVED' || reg.status_code === 'BP_CREATED' ? '#15803d' :
                        reg.status_code === 'RETURNED' ? '#c2410c' : '#1d4ed8'
                    }}
                  >
                    {reg.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div style={{ ...whiteCardStyle, flexDirection: 'column', alignItems: 'stretch' }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b', marginBottom: '1rem' }}>
            Recent Activity
          </div>

          {activities.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.8rem', background: '#f8fafc', borderRadius: '8px' }}>
              No recent activity recorded.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {activities.map((act, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', fontSize: '0.75rem' }}>
                  <span
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      marginTop: '5px',
                      flexShrink: 0,
                      background:
                        act.type === 'success' ? '#00823b' :
                        act.type === 'warning' ? '#f59e0b' : '#3b82f6'
                    }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>{act.title}</div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.1rem' }}>{act.meta}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
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

const whiteCardStyle = {
  background: '#ffffff',
  borderRadius: '12px',
  border: '1px solid #e5e7eb',
  padding: '1.1rem 1.25rem',
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
