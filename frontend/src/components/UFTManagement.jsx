import React, { useState, useEffect } from 'react';
import {
  Route,
  RefreshCw,
  Search,
  Sliders,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  ArrowRight,
  Database,
  Gauge,
  Calendar,
  Layers,
  Edit2,
  X,
  Info,
  PlusCircle
} from 'lucide-react';
import { fetchUFTPaths, updateUFTPathCapacity, syncUFTPathsFromOData, checkUFTCapacityAvailability } from '../api';

export const UFTManagement = ({ currentUser = null, onBookCapacity = null }) => {
  const [paths, setPaths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedZone, setSelectedZone] = useState('ALL');
  const [alert, setAlert] = useState(null);

  // Edit Capacity Modal State
  const [editingPath, setEditingPath] = useState(null);
  const [newCapacity, setNewCapacity] = useState('');
  const [savingCapacity, setSavingCapacity] = useState(false);

  // Availability Simulator Modal State
  const [simPath, setSimPath] = useState(null);
  const [simStartDate, setSimStartDate] = useState('');
  const [simEndDate, setSimEndDate] = useState('');
  const [simQuantity, setSimQuantity] = useState('10000');
  const [simResult, setSimResult] = useState(null);
  const [simLoading, setSimLoading] = useState(false);

  useEffect(() => {
    loadPaths();
    const today = new Date().toISOString().split('T')[0];
    const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    setSimStartDate(today);
    setSimEndDate(nextMonth);
  }, []);

  const loadPaths = async () => {
    try {
      setLoading(true);
      const data = await fetchUFTPaths();
      setPaths(data);
    } catch (err) {
      console.error('Failed to load UFT paths', err);
      showAlert('danger', 'Failed to load UFT paths from database master.');
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 6000);
  };

  const handleSyncOData = async () => {
    try {
      setSyncing(true);
      const res = await syncUFTPathsFromOData(false);
      showAlert('success', `Synchronized ${res.count} UFT paths from ${res.source}. Master database updated.`);
      await loadPaths();
    } catch (err) {
      console.error('OData sync error', err);
      showAlert('danger', 'Failed to synchronize with SAP OData service. Please verify network credentials.');
    } finally {
      setSyncing(false);
    }
  };

  const handleOpenEditCapacity = (path) => {
    setEditingPath(path);
    setNewCapacity(path.total_capacity_mmbtu_day?.toString() || '164685.28');
  };

  const handleSaveCapacity = async (e) => {
    e.preventDefault();
    if (!editingPath) return;
    try {
      setSavingCapacity(true);
      const val = parseFloat(newCapacity);
      if (isNaN(val) || val <= 0) {
        showAlert('danger', 'Please enter a valid positive capacity in MMBTU/Day.');
        return;
      }
      await updateUFTPathCapacity(editingPath.id, val);
      showAlert('success', `Pipeline capacity for ${editingPath.uft_id} updated to ${val.toLocaleString()} MMBTU/Day.`);
      setEditingPath(null);
      await loadPaths();
    } catch (err) {
      console.error('Failed to update capacity', err);
      showAlert('danger', 'Error updating pipeline capacity on server.');
    } finally {
      setSavingCapacity(false);
    }
  };

  const handleOpenSimulator = async (path) => {
    setSimPath(path);
    runAvailabilitySimulation(path.uft_id, simStartDate, simEndDate, simQuantity);
  };

  const runAvailabilitySimulation = async (uftId, start, end, qty) => {
    try {
      setSimLoading(true);
      const res = await checkUFTCapacityAvailability(uftId, start, end, parseFloat(qty) || 0);
      setSimResult(res);
    } catch (err) {
      console.error('Availability check failed', err);
    } finally {
      setSimLoading(false);
    }
  };

  // Filtered Paths
  const filteredPaths = paths.filter((p) => {
    const matchesSearch =
      searchTerm === '' ||
      p.uft_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.path_id_desc?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.unified_entry_point?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.unified_exit_point?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesZone = selectedZone === 'ALL' || p.zone_pngrb === selectedZone;
    return matchesSearch && matchesZone;
  });

  // Aggregate Metrics
  const totalRoutesCount = paths.length;
  const totalCapacitySum = paths.reduce((acc, p) => acc + (parseFloat(p.total_capacity_mmbtu_day) || 0), 0);
  const zonesList = Array.from(new Set(paths.map((p) => p.zone_pngrb).filter(Boolean)));

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Alert Banner */}
      {alert && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderRadius: '8px',
            background: alert.type === 'success' ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${alert.type === 'success' ? '#86efac' : '#fca5a5'}`,
            color: alert.type === 'success' ? '#166534' : '#991b1b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.85rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            {alert.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{alert.message}</span>
          </div>
          <button
            onClick={() => setAlert(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Top Banner / Actions */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          padding: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ background: '#ecfdf5', padding: '0.45rem', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
              <Route size={22} color="#00823b" />
            </div>
            <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
              Unified Tariff (UFT) Path & Capacity Master
            </h2>
          </div>
          <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.825rem', color: '#64748b' }}>
            Master pipeline routes synchronized from SAP OData (ZGTA_ODATA_SRV/Uft_detailsSet). Total pipeline line capacity is maintained here to calculate tranche availability.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={loadPaths}
            disabled={loading}
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '0.55rem 0.9rem',
              fontSize: '0.825rem',
              fontWeight: 600,
              color: '#334155',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem'
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Reload</span>
          </button>

          <button
            onClick={handleSyncOData}
            disabled={syncing}
            style={{
              background: '#00823b',
              border: 'none',
              borderRadius: '8px',
              padding: '0.55rem 1.1rem',
              fontSize: '0.825rem',
              fontWeight: 700,
              color: '#ffffff',
              cursor: syncing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 2px 4px rgba(0,130,59,0.2)'
            }}
          >
            <Database size={15} />
            <span>{syncing ? 'Syncing SAP OData...' : 'Sync from SAP OData'}</span>
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.15rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Synchronized UFT Routes
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', marginTop: '0.35rem' }}>
            {totalRoutesCount} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#00823b' }}>Lines</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem' }}>
            OData feed: ZGTA_ODATA_SRV
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.15rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Total Pipeline Capacity
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#00823b', marginTop: '0.35rem' }}>
            {totalCapacitySum.toLocaleString()} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>MMBTU/D</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem' }}>
            Configured across all line paths
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.15rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            PNGRB Tariff Zones
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0284c7', marginTop: '0.35rem' }}>
            {zonesList.length} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#64748b' }}>Active</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem' }}>
            {zonesList.join(', ')}
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.15rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Capacity Tranche Engine
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#16a34a', marginTop: '0.35rem' }}>
            ACTIVE
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem' }}>
            Live overlap validation enabled
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e5e7eb',
          padding: '0.85rem 1.25rem',
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '260px' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '380px' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search by UFT ID, Corridor, Entry/Exit point..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem 0.75rem 0.45rem 2rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '0.825rem',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.775rem', fontWeight: 600, color: '#475569' }}>Zone:</span>
            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              style={{
                padding: '0.45rem 0.75rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '0.825rem',
                background: '#ffffff'
              }}
            >
              <option value="ALL">All Zones</option>
              {zonesList.map((z, idx) => (
                <option key={idx} value={z}>{z}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ fontSize: '0.775rem', color: '#64748b' }}>
          Showing <strong>{filteredPaths.length}</strong> of <strong>{paths.length}</strong> UFT paths
        </div>
      </div>

      {/* Main Table */}
      <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.75rem auto' }} />
            <div>Loading UFT Master Paths...</div>
          </div>
        ) : filteredPaths.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            <Info size={28} style={{ margin: '0 auto 0.5rem auto', color: '#94a3b8' }} />
            <div style={{ fontWeight: 600 }}>No UFT paths match your criteria</div>
            <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Click "Sync from SAP OData" to load master paths.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.825rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700, fontSize: '0.725rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '0.85rem 1.25rem' }}>UFT ID & Corridor</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Entry → Exit Route</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Zone & Distance</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Tariff & Invoice Rate</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Transporter</th>
                  <th style={{ padding: '0.85rem 1rem', background: '#ecfdf5', color: '#065f46' }}>
                    Total Capacity (MMBTU/D)
                  </th>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPaths.map((p) => {
                  const capacityNum = parseFloat(p.total_capacity_mmbtu_day) || 164685.28;
                  return (
                    <tr
                      key={p.id}
                      style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s ease' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#fafbfc')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* UFT ID & Corridor */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ display: 'inline-block', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 800, fontSize: '0.78rem' }}>
                          {p.uft_id}
                        </div>
                        <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '0.3rem' }}>
                          {p.path_id_desc || 'Corridor Route'}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.15rem' }}>
                          Zonal Entity: {p.iggl_zonal_entity_id || 'ZONE1/001'}
                        </div>
                      </td>

                      {/* Entry -> Exit */}
                      <td style={{ padding: '1rem 1rem' }}>
                        <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.8rem' }}>
                          {p.unified_entry_point}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#64748b', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                          <ArrowRight size={13} color="#00823b" />
                          <span>{p.unified_exit_point}</span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                          Deliv: {p.delivery_point || p.unified_entry_point}
                        </div>
                      </td>

                      {/* Zone & Distance */}
                      <td style={{ padding: '1rem 1rem' }}>
                        <div style={{ display: 'inline-block', background: '#eff6ff', color: '#1e40af', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 700, fontSize: '0.72rem' }}>
                          {p.zone_pngrb}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#334155', fontWeight: 600, marginTop: '0.25rem' }}>
                          {parseFloat(p.total_km || 0).toFixed(1)} km
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                          Shared: {parseFloat(p.shared_km || 0).toFixed(1)} km
                        </div>
                      </td>

                      {/* Tariff & Invoice Rate */}
                      <td style={{ padding: '1rem 1rem' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>
                          ₹ {parseFloat(p.applicable_tariff_regime || 0).toFixed(2)} <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 400 }}>/ MMBTU</span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#0284c7', marginTop: '0.15rem', fontWeight: 600 }}>
                          Invoice: ₹ {parseFloat(p.amt_for_invoice_per_mmbtu || 0).toFixed(2)}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                          UFT Ratio: {parseFloat(p.uft_ratio_pct || 100).toFixed(2)}%
                        </div>
                      </td>

                      {/* Transporter */}
                      <td style={{ padding: '1rem 1rem' }}>
                        <div style={{ fontWeight: 700, color: '#334155' }}>
                          {p.transporter || 'IGGL'}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.15rem' }}>
                          Entitlement: {parseFloat(p.revenue_entitlement || 100).toFixed(0)}%
                        </div>
                      </td>

                      {/* Total Capacity (Configured from Web) */}
                      <td style={{ padding: '1rem 1rem', background: '#f0fdf4' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <div>
                            <div style={{ fontWeight: 800, color: '#00823b', fontSize: '0.95rem' }}>
                              {capacityNum.toLocaleString()}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                              MMBTU / Day
                            </div>
                          </div>
                          <button
                            onClick={() => handleOpenEditCapacity(p)}
                            title="Edit Total Line Capacity"
                            style={{
                              background: '#ffffff',
                              border: '1px solid #86efac',
                              borderRadius: '6px',
                              padding: '0.35rem 0.5rem',
                              cursor: 'pointer',
                              color: '#00823b',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }}
                          >
                            <Edit2 size={12} />
                            <span>Edit</span>
                          </button>
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                        <button
                          onClick={() => handleOpenSimulator(p)}
                          style={{
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '0.35rem 0.65rem',
                            cursor: 'pointer',
                            color: '#0284c7',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            fontSize: '0.75rem',
                            fontWeight: 600
                          }}
                        >
                          <Gauge size={13} />
                          <span>Check Availability</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: Edit Total Line Capacity */}
      {editingPath && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalContainerStyle, maxWidth: '460px' }}>
            <div style={modalHeaderStyle}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                  Update Total Pipeline Capacity
                </h3>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Line: <strong>{editingPath.uft_id}</strong> ({editingPath.path_id_desc})
                </div>
              </div>
              <button onClick={() => setEditingPath(null)} style={closeBtnStyle}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCapacity} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#475569' }}>
                  Route: <strong>{editingPath.unified_entry_point}</strong> → <strong>{editingPath.unified_exit_point}</strong>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
                  Zone: {editingPath.zone_pngrb} · Tariff: ₹{editingPath.applicable_tariff_regime}/MMBTU
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.4rem' }}>
                  Total Line Capacity (MMBTU/Day) *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    value={newCapacity}
                    onChange={(e) => setNewCapacity(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      border: '2px solid #00823b',
                      borderRadius: '8px',
                      fontSize: '1.1rem',
                      fontWeight: 800,
                      color: '#0f172a',
                      outline: 'none'
                    }}
                  />
                  <span style={{ position: 'absolute', right: '12px', top: '10px', fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>
                    MMBTU/D
                  </span>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.4rem' }}>
                  This capacity threshold will be used to calculate real-time available capacity when shippers book Capacity Tranches on this line.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setEditingPath(null)}
                  style={{ ...btnStyle, background: '#f1f5f9', color: '#475569' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCapacity}
                  style={{ ...btnStyle, background: '#00823b', color: '#ffffff' }}
                >
                  {savingCapacity ? 'Saving...' : 'Save Capacity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Capacity Availability Inspector / Simulator */}
      {simPath && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalContainerStyle, maxWidth: '620px' }}>
            <div style={modalHeaderStyle}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                  Pipeline Capacity Availability Inspector
                </h3>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Evaluating Route: <strong>{simPath.uft_id}</strong> · {simPath.path_id_desc}
                </div>
              </div>
              <button onClick={() => setSimPath(null)} style={closeBtnStyle}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Parameter Controls */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem' }}>
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={simStartDate}
                    onChange={(e) => {
                      setSimStartDate(e.target.value);
                      runAvailabilitySimulation(simPath.uft_id, e.target.value, simEndDate, simQuantity);
                    }}
                    style={{ width: '100%', padding: '0.45rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.8rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem' }}>
                    End Date
                  </label>
                  <input
                    type="date"
                    value={simEndDate}
                    onChange={(e) => {
                      setSimEndDate(e.target.value);
                      runAvailabilitySimulation(simPath.uft_id, simStartDate, e.target.value, simQuantity);
                    }}
                    style={{ width: '100%', padding: '0.45rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.8rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem' }}>
                    Test Quantity (MMBTU/D)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={simQuantity}
                    onChange={(e) => {
                      setSimQuantity(e.target.value);
                      runAvailabilitySimulation(simPath.uft_id, simStartDate, simEndDate, e.target.value);
                    }}
                    style={{ width: '100%', padding: '0.45rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.8rem' }}
                  />
                </div>
              </div>

              {/* Simulation Result */}
              {simLoading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                  <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 0.5rem auto' }} />
                  <div>Computing overlapping capacity commitments...</div>
                </div>
              ) : simResult ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Status Banner */}
                  <div
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: '8px',
                      background: simResult.is_available ? '#f0fdf4' : '#fef2f2',
                      border: `1px solid ${simResult.is_available ? '#86efac' : '#fca5a5'}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem'
                    }}
                  >
                    {simResult.is_available ? (
                      <CheckCircle2 size={24} color="#16a34a" />
                    ) : (
                      <AlertCircle size={24} color="#dc2626" />
                    )}
                    <div>
                      <div style={{ fontWeight: 800, color: simResult.is_available ? '#166534' : '#991b1b', fontSize: '0.95rem' }}>
                        {simResult.is_available
                          ? 'Capacity Available for Allocation'
                          : 'Pipeline Capacity Over-committed / Insufficient'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: simResult.is_available ? '#15803d' : '#b91c1c' }}>
                        {simResult.is_available
                          ? `Requested ${simResult.requested_quantity_mmbtu_day.toLocaleString()} MMBTU/D can be fully accommodated. Remaining buffer: ${simResult.remaining_after_requested.toLocaleString()} MMBTU/D.`
                          : `Requested ${simResult.requested_quantity_mmbtu_day.toLocaleString()} MMBTU/D exceeds available capacity (${simResult.available_capacity_mmbtu_day.toLocaleString()} MMBTU/D).`}
                      </div>
                    </div>
                  </div>

                  {/* 3 Metric Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem' }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Total Line Capacity</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
                        {simResult.total_capacity_mmbtu_day.toLocaleString()}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#64748b' }}>MMBTU / Day</div>
                    </div>

                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem' }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Peak Booked in Period</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ea580c', marginTop: '0.2rem' }}>
                        {simResult.peak_booked_capacity_mmbtu_day.toLocaleString()}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#64748b' }}>{simResult.utilization_pct}% Utilized</div>
                    </div>

                    <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '0.75rem' }}>
                      <div style={{ fontSize: '0.7rem', color: '#047857', fontWeight: 600 }}>Net Available</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#00823b', marginTop: '0.2rem' }}>
                        {simResult.available_capacity_mmbtu_day.toLocaleString()}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#047857' }}>MMBTU / Day</div>
                    </div>
                  </div>

                  {/* Overlapping Tranches breakdown */}
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                      Active Overlapping Tranches ({simResult.overlapping_cts_count})
                    </div>
                    {simResult.overlapping_cts.length === 0 ? (
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', padding: '0.5rem', background: '#f8fafc', borderRadius: '6px' }}>
                        No existing CTs booked during this date range. Full pipeline capacity is available.
                      </div>
                    ) : (
                      <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                          <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                            <tr>
                              <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left' }}>CT #</th>
                              <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left' }}>Shipper</th>
                              <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left' }}>Period</th>
                              <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>Booked (MMBTU/D)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {simResult.overlapping_cts.map((item, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '0.4rem 0.6rem', fontWeight: 600 }}>{item.ct_number}</td>
                                <td style={{ padding: '0.4rem 0.6rem' }}>{item.shipper}</td>
                                <td style={{ padding: '0.4rem 0.6rem', color: '#64748b' }}>{item.start_date} → {item.end_date}</td>
                                <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right', fontWeight: 700, color: '#ea580c' }}>
                                  {item.quantity.toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setSimPath(null)}
                  style={{ ...btnStyle, background: '#f1f5f9', color: '#475569' }}
                >
                  Close
                </button>
                {simResult?.is_available && onBookCapacity && (
                  <button
                    type="button"
                    onClick={() => {
                      onBookCapacity({
                        uft_path_id: simPath.uft_id,
                        unified_path: simPath.path_id_desc || simPath.uft_id,
                        delivery_entry_point: simPath.unified_entry_point,
                        new_exit_point: simPath.unified_exit_point,
                        start_date: simStartDate,
                        end_date: simEndDate,
                        quantity_mmbtu_day: simQuantity
                      });
                      setSimPath(null);
                    }}
                    style={{
                      ...btnStyle,
                      background: '#00823b',
                      color: '#ffffff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      boxShadow: '0 2px 4px rgba(0,130,59,0.2)'
                    }}
                  >
                    <PlusCircle size={15} />
                    <span>Book Capacity Tranche (Create CT)</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Styles
const modalOverlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(15, 23, 42, 0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1050,
  padding: '1rem',
  backdropFilter: 'blur(3px)'
};

const modalContainerStyle = {
  background: '#ffffff',
  borderRadius: '12px',
  width: '100%',
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  overflow: 'hidden'
};

const modalHeaderStyle = {
  padding: '1.25rem 1.5rem',
  borderBottom: '1px solid #f1f5f9',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
};

const closeBtnStyle = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: '#94a3b8',
  padding: '0.25rem',
  borderRadius: '4px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const btnStyle = {
  border: 'none',
  borderRadius: '6px',
  padding: '0.5rem 1rem',
  fontSize: '0.825rem',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background 0.15s ease'
};
