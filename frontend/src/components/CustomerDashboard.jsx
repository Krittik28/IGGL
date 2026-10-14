import React, { useState, useEffect } from 'react';
import {
  FileText,
  FileCheck,
  Layers,
  Activity,
  Receipt,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Plus
} from 'lucide-react';
import { fetchCustomerDashboard } from '../api';

export const CustomerDashboard = ({ currentUser, onNavigateSection }) => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [currentUser?.email, currentUser?.sap_customer_code]);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchCustomerDashboard(currentUser);
      setDashboardData(data);
    } catch (err) {
      console.error('Failed to load customer dashboard data', err);
      // Empty state - no fake dummy data!
      setDashboardData({
        metrics: {
          active_gtas: 0,
          active_gtas_label: 'In Force',
          active_cts: 0,
          active_cts_label: 'Firm + Interruptible',
          utilisation_today_pct: 0,
          utilisation_contracted_subtext: 'No contracted capacity',
          outstanding_invoices: '₹ 0.00',
          outstanding_invoices_subtext: '0 invoices pending',
          cumulative_imbalance: '0.00 MMSCMD',
          cumulative_imbalance_status: 'Balanced',
          overrun_position: 'None',
          overrun_position_status: 'Within contracted qty'
        },
        monthly_utilisation: [],
        ct_status_distribution: {},
        action_required: [],
        gtas: []
      });
    } finally {
      setLoading(false);
    }
  };

  const metrics = dashboardData?.metrics || {};
  const gtas = dashboardData?.gtas || [];
  const actionItems = dashboardData?.action_required || [];
  const ctStatusDist = dashboardData?.ct_status_distribution || {};
  const monthlyUtil = dashboardData?.monthly_utilisation || [];

  return (
    <div style={{ maxWidth: '1360px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 1. Top 4 Metric KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
        {/* Card 1: ACTIVE GTAS */}
        <div style={kpiCardStyle}>
          <div>
            <div style={kpiLabelStyle}>ACTIVE GTAS</div>
            <div style={kpiValueStyle}>{metrics.active_gtas ?? 0}</div>
            <div style={kpiSubtextStyle}>{metrics.active_gtas_label || 'In Force'}</div>
          </div>
          <div style={{ ...iconCircleStyle, background: '#e8f5e9' }}>
            <FileText size={18} color="#00823b" />
          </div>
        </div>

        {/* Card 2: ACTIVE CTS */}
        <div style={kpiCardStyle}>
          <div>
            <div style={kpiLabelStyle}>ACTIVE CTS</div>
            <div style={kpiValueStyle}>{metrics.active_cts ?? 0}</div>
            <div style={kpiSubtextStyle}>{metrics.active_cts_label || 'Firm + Interruptible'}</div>
          </div>
          <div style={{ ...iconCircleStyle, background: '#e0f2fe' }}>
            <Layers size={18} color="#0284c7" />
          </div>
        </div>

        {/* Card 3: UTILISATION TODAY */}
        <div style={kpiCardStyle}>
          <div>
            <div style={kpiLabelStyle}>UTILISATION TODAY</div>
            <div style={kpiValueStyle}>{metrics.utilisation_today_pct ?? 0}%</div>
            <div style={kpiSubtextStyle}>{metrics.utilisation_contracted_subtext || 'vs Contracted 0 MMSCMD'}</div>
          </div>
          <div style={{ ...iconCircleStyle, background: '#eef2ff' }}>
            <Activity size={18} color="#4f46e5" />
          </div>
        </div>

        {/* Card 4: OUTSTANDING INVOICES */}
        <div style={kpiCardStyle}>
          <div>
            <div style={kpiLabelStyle}>OUTSTANDING INVOICES</div>
            <div style={kpiValueStyle}>{metrics.outstanding_invoices || '₹ 0.00'}</div>
            <div style={kpiSubtextStyle}>{metrics.outstanding_invoices_subtext || '0 invoices pending'}</div>
          </div>
          <div style={{ ...iconCircleStyle, background: '#fef3c7' }}>
            <Receipt size={18} color="#d97706" />
          </div>
        </div>
      </div>

      {/* 2. Middle Row: Imbalance/Overrun pills + Utilisation Chart + CT Donut */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
        {/* Left Sub-column: Imbalance/Overrun pills + Monthly Utilisation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Quick Health Pills */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={whiteCardStyle}>
              <div>
                <div style={kpiLabelStyle}>CUMULATIVE IMBALANCE</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#00823b', marginTop: '0.2rem' }}>
                  {metrics.cumulative_imbalance || '0.00 MMSCMD'}
                </div>
                <div style={kpiSubtextStyle}>{metrics.cumulative_imbalance_status || 'Balanced'}</div>
              </div>
              <div style={{ ...iconCircleStyle, background: '#e8f5e9' }}>
                <TrendingUp size={18} color="#00823b" />
              </div>
            </div>

            <div style={whiteCardStyle}>
              <div>
                <div style={kpiLabelStyle}>OVERRUN POSITION</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', marginTop: '0.2rem' }}>
                  {metrics.overrun_position || 'None'}
                </div>
                <div style={kpiSubtextStyle}>{metrics.overrun_position_status || 'Within contracted qty'}</div>
              </div>
              <div style={{ ...iconCircleStyle, background: '#e8f5e9' }}>
                <CheckCircle size={18} color="#00823b" />
              </div>
            </div>
          </div>

          {/* Monthly Capacity Utilisation Bar Chart */}
          <div style={{ ...whiteCardStyle, flexDirection: 'column', alignItems: 'stretch' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>Monthly Capacity Utilisation</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Contracted vs. Actual (MMSCMD)</div>
              </div>
              {monthlyUtil.length > 0 && (
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.72rem', color: '#64748b' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '8px', height: '8px', background: '#00823b', borderRadius: '2px' }} /> Contracted
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '8px', height: '8px', background: '#a7f3d0', borderRadius: '2px' }} /> Actual
                  </span>
                </div>
              )}
            </div>

            {monthlyUtil.length === 0 ? (
              <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.8rem', background: '#f8fafc', borderRadius: '8px' }}>
                No active gas transmission agreements to display monthly utilisation.
              </div>
            ) : (
              <div style={{ height: '140px', width: '100%', position: 'relative' }}>
                <svg width="100%" height="100%" viewBox="0 0 500 130" preserveAspectRatio="none">
                  <line x1="30" y1="20" x2="490" y2="20" stroke="#f1f5f9" strokeDasharray="3 3" />
                  <line x1="30" y1="50" x2="490" y2="50" stroke="#f1f5f9" strokeDasharray="3 3" />
                  <line x1="30" y1="80" x2="490" y2="80" stroke="#f1f5f9" strokeDasharray="3 3" />
                  <line x1="30" y1="110" x2="490" y2="110" stroke="#e2e8f0" />

                  {monthlyUtil.map((col, idx) => {
                    const x = 60 + idx * 75;
                    const scale = 1.0;
                    const cY = 110 - (col.contracted * 100 * scale);
                    const aY = 110 - (col.actual * 100 * scale);

                    return (
                      <g key={col.month}>
                        <rect x={x} y={Math.max(20, cY)} width="11" height={Math.min(90, col.contracted * 100 * scale)} fill="#00823b" rx="2" />
                        <rect x={x + 13} y={Math.max(20, aY)} width="11" height={Math.min(90, col.actual * 100 * scale)} fill="#a7f3d0" rx="2" />
                        <text x={x + 12} y="125" fontSize="10" fill="#64748b" textAnchor="middle">{col.month}</text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Right Sub-column: CT Request Status Donut Chart */}
        <div style={{ ...whiteCardStyle, flexDirection: 'column', alignItems: 'stretch' }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b', marginBottom: '1rem' }}>
            CT Request Status
          </div>

          {Object.keys(ctStatusDist).length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.8rem', minHeight: '180px', textAlign: 'center' }}>
              No Capacity Tranches requested yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '1rem' }}>
              <div style={{ width: '130px', height: '130px', position: 'relative' }}>
                <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                  <circle cx="18" cy="18" r="14" fill="transparent" stroke="#00823b" strokeWidth="5.5" strokeDasharray="33.3 66.7" strokeDashoffset="0" />
                  <circle cx="18" cy="18" r="14" fill="transparent" stroke="#2563eb" strokeWidth="5.5" strokeDasharray="16.7 83.3" strokeDashoffset="-33.3" />
                  <circle cx="18" cy="18" r="14" fill="transparent" stroke="#0d9488" strokeWidth="5.5" strokeDasharray="16.7 83.3" strokeDashoffset="-50" />
                  <circle cx="18" cy="18" r="14" fill="transparent" stroke="#f97316" strokeWidth="5.5" strokeDasharray="16.7 83.3" strokeDashoffset="-66.7" />
                  <circle cx="18" cy="18" r="14" fill="transparent" stroke="#e2e8f0" strokeWidth="5.5" strokeDasharray="16.6 83.4" strokeDashoffset="-83.4" />
                </svg>
              </div>

              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.75rem' }}>
                {Object.entries(ctStatusDist).map(([label, count]) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#475569' }}>
                    <span>{label}</span>
                    <span style={{ fontWeight: 600, color: '#1e293b' }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Action Required Section */}
      <div style={{ ...whiteCardStyle, flexDirection: 'column', alignItems: 'stretch' }}>
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>Action Required</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Items requiring your attention</div>
        </div>

        {actionItems.length === 0 ? (
          <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', color: '#64748b', fontSize: '0.8rem', textAlign: 'center' }}>
            No pending action items required. All agreements and requests are in order.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {actionItems.map((act) => {
              const isWarning = act.type === 'warning' || act.type === 'CT_RETURNED';
              return (
                <div
                  key={act.id}
                  onClick={() => onNavigateSection && onNavigateSection(act.link)}
                  style={{
                    background: isWarning ? '#fffbeb' : '#eff6ff',
                    border: `1px solid ${isWarning ? '#fde68a' : '#bfdbfe'}`,
                    borderRadius: '8px',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: isWarning ? '#fef3c7' : '#dbeafe',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <AlertTriangle size={15} color={isWarning ? '#d97706' : '#2563eb'} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.825rem', color: '#1e293b' }}>{act.title}</div>
                      <div style={{ fontSize: '0.73rem', color: '#64748b' }}>{act.description}</div>
                    </div>
                  </div>

                  <ArrowRight size={16} color={isWarning ? '#d97706' : '#2563eb'} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Bottom Row: Gas Transportation Agreements + Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem' }}>
        {/* Left: Gas Transportation Agreements */}
        <div style={{ ...whiteCardStyle, flexDirection: 'column', alignItems: 'stretch' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>
              Gas Transportation Agreements
            </div>
            <button
              onClick={() => onNavigateSection && onNavigateSection('gtas')}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#00823b',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
            >
              View All
            </button>
          </div>

          {gtas.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.8rem', background: '#f8fafc', borderRadius: '8px' }}>
              No executed Gas Transportation Agreements found.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {gtas.map((g) => (
                <div
                  key={g.id || g.gta_number}
                  onClick={() => onNavigateSection && onNavigateSection('gtas')}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.83rem', color: '#0f172a' }}>{g.gta_number}</span>
                      <span
                        style={{
                          background: '#dcfce7',
                          color: '#15803d',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '0.1rem 0.45rem',
                          borderRadius: '4px'
                        }}
                      >
                        In Force
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.2rem' }}>
                      {g.entry_point} → {g.exit_point}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.1rem' }}>
                      Valid to: {g.valid_to}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
                      {g.active_cts_count || 0} CTs
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Quick Actions */}
        <div style={{ ...whiteCardStyle, flexDirection: 'column', alignItems: 'stretch' }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b', marginBottom: '0.85rem' }}>
            Quick Actions
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', flex: 1 }}>
            <button
              onClick={() => onNavigateSection && onNavigateSection('cts')}
              style={{
                gridColumn: 'span 1',
                background: '#00823b',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.8rem',
                boxShadow: '0 2px 4px rgba(0, 130, 59, 0.15)'
              }}
            >
              <Plus size={20} />
              <span>New CT Request</span>
            </button>

            <button
              onClick={() => onNavigateSection && onNavigateSection('gtas')}
              style={{
                background: '#ffffff',
                color: '#1e293b',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.8rem'
              }}
            >
              <FileText size={20} color="#00823b" />
              <span>View All GTAs</span>
            </button>

            <button
              onClick={() => onNavigateSection && onNavigateSection('cts')}
              style={{
                background: '#ffffff',
                color: '#1e293b',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.8rem'
              }}
            >
              <Layers size={20} color="#0284c7" />
              <span>View CT Requests</span>
            </button>

            <button
              onClick={() => onNavigateSection && onNavigateSection('registration')}
              style={{
                background: '#ffffff',
                color: '#1e293b',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.8rem'
              }}
            >
              <FileCheck size={20} color="#00823b" />
              <span>Registration Status</span>
            </button>
          </div>
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
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
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
