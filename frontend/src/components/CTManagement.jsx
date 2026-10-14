import React, { useState, useEffect } from 'react';
import {
  Layers,
  Plus,
  Search,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileCheck,
  ArrowRight,
  Filter,
  X,
  FileText,
  Send,
  Upload,
  Download,
  Eye,
  Edit,
  ExternalLink,
  Building,
  Check,
  ChevronRight,
  Zap,
  Info,
  Gauge,
  Calendar
} from 'lucide-react';
import {
  fetchCTList,
  createCTRequest,
  updateCTRequest,
  approveCTRequest,
  executeCTRequest,
  fetchCTMasterData,
  fetchGTAList,
  checkUFTCapacityAvailability
} from '../api';

// Daily Line-Item Nomination Schedule Helpers
const generateDailyBreakdown = (startDateStr, endDateStr, baseQty, existingDaily = []) => {
  if (!startDateStr || !endDateStr) return [];
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return [];

  const existingMap = new Map();
  if (Array.isArray(existingDaily)) {
    existingDaily.forEach((item) => {
      if (item && item.date) {
        existingMap.set(item.date, item.quantity_mmbtu);
      }
    });
  }

  const result = [];
  const curr = new Date(start);
  const fallbackVal = parseFloat(baseQty) || 0;
  let count = 0;
  while (curr <= end && count < 366) {
    const dStr = curr.toISOString().split('T')[0];
    const qty = existingMap.has(dStr) ? existingMap.get(dStr) : fallbackVal;
    result.push({
      date: dStr,
      quantity_mmbtu: qty
    });
    curr.setDate(curr.getDate() + 1);
    count++;
  }
  return result;
};

const formatScheduleDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

export const CTManagement = ({ role = 'CUSTOMER', currentUser, initialPreFill = null, onClearPreFill = null }) => {
  const [cts, setCts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Master Data
  const [masterData, setMasterData] = useState({
    sold_to_parties: [],
    gta_options: [],
    uft_master_paths: [],
    entry_points: [],
    unified_paths: []
  });

  // Modals
  const [showNewCTModal, setShowNewCTModal] = useState(false);
  const [selectedCT, setSelectedCT] = useState(null); // View Detail
  const [editingCT, setEditingCT] = useState(null); // Transporter Edit / Process modal

  const defaultStart = new Date().toISOString().split('T')[0];
  const defaultEnd = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  // 1. Customer New CT Form State
  const [customerForm, setCustomerForm] = useState({
    gta: '',
    gta_no: '',
    uft_path_id: '',
    unified_path: 'IGGL',
    sold_to_party: '',
    delivery_entry_point: 'ONGC-KSAB',
    new_exit_point: 'NRL',
    start_date: defaultStart,
    end_date: defaultEnd,
    quantity_mmbtu_day: '10',
    daily_quantities: generateDailyBreakdown(defaultStart, defaultEnd, '10')
  });

  const [customerCapacityCheck, setCustomerCapacityCheck] = useState(null);
  const [checkingCustomerCapacity, setCheckingCustomerCapacity] = useState(false);

  // 2. Transporter Processing Form State
  const [transporterForm, setTransporterForm] = useState({
    gta_no: '',
    gta_date: '',
    approved_ct_start_date: '',
    approved_ct_end_date: '',
    approved_quantity_mmbtu_day: '',
    ct_created_by: '',
    ct_date: '',
    overdelivery_tolerance: '2.00',
    underdelivery_tolerance: '5.00',

    // UFT Path Tariff Parameters (Auto-populated from UFT Path Id)
    uft_path_id: '',
    path_id_desc: '',
    unified_entry_point: '',
    unified_exit_point: '',
    delivery_redelivery_point: '',
    total_km: '',
    zone_pngrb: '',
    applicable_tariff_regime: '',
    price_applicable_date: '',
    entity_transporter: '',
    km_share: '',
    uft_ratio_pct: '',
    amt_for_invoice_per_mmbtu: '',
    iggl_zonal_entity_id: '',
    revenue_entitlement: '',
    daily_quantities: []
  });

  const isCustomer = role === 'CUSTOMER';
  const isAdmin = !isCustomer;

  useEffect(() => {
    loadAllData();
  }, [currentUser?.email, currentUser?.sap_customer_code]);

  useEffect(() => {
    if (initialPreFill) {
      const start = initialPreFill.start_date || new Date().toISOString().split('T')[0];
      const end = initialPreFill.end_date || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
      const qty = (initialPreFill.quantity_mmbtu_day || '10').toString();
      const daily = generateDailyBreakdown(start, end, qty);

      setCustomerForm((prev) => ({
        ...prev,
        gta: initialPreFill.gta || prev.gta,
        gta_no: initialPreFill.gta_no || prev.gta_no,
        sold_to_party: initialPreFill.sold_to_party || prev.sold_to_party,
        uft_path_id: initialPreFill.uft_path_id || prev.uft_path_id,
        unified_path: initialPreFill.unified_path || prev.unified_path,
        delivery_entry_point: initialPreFill.delivery_entry_point || prev.delivery_entry_point,
        new_exit_point: initialPreFill.new_exit_point || prev.new_exit_point,
        start_date: start,
        end_date: end,
        quantity_mmbtu_day: qty,
        daily_quantities: daily
      }));

      setShowNewCTModal(true);
      if (initialPreFill.uft_path_id) {
        checkCustomerAvailability(initialPreFill.uft_path_id, start, end, qty);
      }
      if (onClearPreFill) {
        onClearPreFill();
      }
    }
  }, [initialPreFill]);

  useEffect(() => {
    if (showNewCTModal && (!customerForm.daily_quantities || customerForm.daily_quantities.length === 0)) {
      setCustomerForm((prev) => ({
        ...prev,
        daily_quantities: generateDailyBreakdown(prev.start_date, prev.end_date, prev.quantity_mmbtu_day)
      }));
    }
  }, [showNewCTModal]);

  const handleUpdateDailyQuantity = (date, val) => {
    setCustomerForm((prev) => {
      const parsed = val === '' ? '' : (parseFloat(val) || 0);
      const updated = (prev.daily_quantities || []).map((item) =>
        item.date === date ? { ...item, quantity_mmbtu: parsed } : item
      );
      const totalVol = updated.reduce((sum, item) => sum + (parseFloat(item.quantity_mmbtu) || 0), 0);
      const avgDaily = updated.length > 0 ? (totalVol / updated.length).toFixed(2) : prev.quantity_mmbtu_day;
      return {
        ...prev,
        daily_quantities: updated,
        quantity_mmbtu_day: avgDaily
      };
    });
  };

  const handleApplyBaseToAllDays = () => {
    const base = parseFloat(customerForm.quantity_mmbtu_day) || 0;
    setCustomerForm((prev) => {
      const updated = (prev.daily_quantities || []).map((item) => ({
        ...item,
        quantity_mmbtu: base
      }));
      return {
        ...prev,
        daily_quantities: updated
      };
    });
  };

  const handleUpdateTransporterDailyQuantity = (date, val) => {
    setTransporterForm((prev) => {
      const parsed = val === '' ? '' : (parseFloat(val) || 0);
      const updated = (prev.daily_quantities || []).map((item) =>
        item.date === date ? { ...item, quantity_mmbtu: parsed } : item
      );
      const totalVol = updated.reduce((sum, item) => sum + (parseFloat(item.quantity_mmbtu) || 0), 0);
      const avgDaily = updated.length > 0 ? (totalVol / updated.length).toFixed(2) : prev.approved_quantity_mmbtu_day;
      const amt = parseFloat(prev.amt_for_invoice_per_mmbtu) || 34.0;
      return {
        ...prev,
        daily_quantities: updated,
        approved_quantity_mmbtu_day: avgDaily,
        revenue_entitlement: (amt * (parseFloat(avgDaily) || 0)).toFixed(2)
      };
    });
  };

  const handleApplyTransporterBaseToAllDays = () => {
    const base = parseFloat(transporterForm.approved_quantity_mmbtu_day) || 0;
    const amt = parseFloat(transporterForm.amt_for_invoice_per_mmbtu) || 34.0;
    setTransporterForm((prev) => {
      const updated = (prev.daily_quantities || []).map((item) => ({
        ...item,
        quantity_mmbtu: base
      }));
      return {
        ...prev,
        daily_quantities: updated,
        revenue_entitlement: (amt * base).toFixed(2)
      };
    });
  };

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [ctData, mData] = await Promise.all([
        fetchCTList(currentUser),
        fetchCTMasterData(currentUser).catch(() => ({
          sold_to_parties: [],
          gta_options: [],
          uft_master_paths: [],
          entry_points: [],
          unified_paths: []
        }))
      ]);
      setCts(ctData);
      setMasterData(mData);

      if (mData.sold_to_parties?.length > 0 && !customerForm.sold_to_party) {
        setCustomerForm((prev) => ({ ...prev, sold_to_party: mData.sold_to_parties[0].label }));
      }

      if (mData.gta_options?.length > 0) {
        setCustomerForm((prev) => {
          if (prev.gta_no || prev.gta) return prev;
          const firstGta = mData.gta_options[0];
          return {
            ...prev,
            gta: firstGta.id,
            gta_no: firstGta.gta_no,
            sold_to_party: prev.sold_to_party || firstGta.shipper_name || ''
          };
        });
      }

      if (mData.uft_master_paths?.length > 0) {
        const defaultPath = mData.uft_master_paths[0];
        setCustomerForm((prev) => {
          const selected = prev.uft_path_id ? prev : {
            ...prev,
            uft_path_id: defaultPath.uft_path_id,
            unified_path: defaultPath.path_id_desc || defaultPath.unified_path || 'IGGL',
            delivery_entry_point: defaultPath.unified_entry_point || prev.delivery_entry_point,
            new_exit_point: defaultPath.unified_exit_point || prev.new_exit_point
          };
          checkCustomerAvailability(selected.uft_path_id, selected.start_date, selected.end_date, selected.quantity_mmbtu_day);
          return selected;
        });
      }
    } catch (err) {
      console.error('Failed to load CT data', err);
    } finally {
      setLoading(false);
    }
  };

  const checkCustomerAvailability = async (pathId, start, end, qty) => {
    if (!pathId || !start || !end) return;
    try {
      setCheckingCustomerCapacity(true);
      const res = await checkUFTCapacityAvailability(pathId, start, end, parseFloat(qty) || 0);
      setCustomerCapacityCheck(res);
    } catch (err) {
      console.error('Failed to check capacity availability', err);
    } finally {
      setCheckingCustomerCapacity(false);
    }
  };

  const handleUftPathSelectInCustomer = (pathId) => {
    const p = masterData.uft_master_paths?.find((item) => item.uft_path_id === pathId);
    if (!p) {
      setCustomerForm((prev) => ({ ...prev, uft_path_id: pathId }));
      return;
    }
    setCustomerForm((prev) => ({
      ...prev,
      uft_path_id: p.uft_path_id,
      unified_path: p.path_id_desc || p.unified_path || 'IGGL',
      delivery_entry_point: p.unified_entry_point || prev.delivery_entry_point,
      new_exit_point: p.unified_exit_point || prev.new_exit_point
    }));
    checkCustomerAvailability(p.uft_path_id, customerForm.start_date, customerForm.end_date, customerForm.quantity_mmbtu_day);
  };

  const handleUftPathSelectInTransporter = (pathId) => {
    const p = masterData.uft_master_paths?.find((item) => item.uft_path_id === pathId);
    if (!p) return;
    const tariff = parseFloat(p.applicable_tariff_regime) || 34.0;
    const ratio = (parseFloat(p.uft_ratio_pct) || 100.0) / 100;
    const amtInvoice = (tariff * ratio).toFixed(2);
    const qty = parseFloat(transporterForm.approved_quantity_mmbtu_day) || 10;
    const revEntitlement = (parseFloat(amtInvoice) * qty).toFixed(2);

    setTransporterForm((prev) => ({
      ...prev,
      uft_path_id: p.uft_path_id,
      path_id_desc: p.path_id_desc,
      unified_entry_point: p.unified_entry_point,
      unified_exit_point: p.unified_exit_point,
      delivery_redelivery_point: p.delivery_redelivery_point,
      total_km: p.total_km?.toString() || '0.00',
      zone_pngrb: p.zone_pngrb || 'Zone 1',
      applicable_tariff_regime: p.applicable_tariff_regime?.toString() || '34.00',
      price_applicable_date: p.price_applicable_date || '2024-04-01',
      entity_transporter: p.entity_transporter || 'GAIL',
      km_share: p.km_share?.toString() || '100.00',
      uft_ratio_pct: p.uft_ratio_pct?.toString() || '100.00',
      amt_for_invoice_per_mmbtu: amtInvoice,
      iggl_zonal_entity_id: p.iggl_zonal_entity_id || 'IGGL-ZONE-NE1',
      revenue_entitlement: revEntitlement
    }));
  };

  const handleGtaSelectInTransporter = (gtaNo) => {
    const g = masterData.gta_options?.find((item) => item.gta_no === gtaNo);
    if (g) {
      setTransporterForm((prev) => ({
        ...prev,
        gta_no: g.gta_no,
        gta_date: g.gta_date || prev.gta_date
      }));
    }
  };

  const handleCreateCustomerCT = async (e) => {
    e.preventDefault();
    if (!customerForm.gta_no && !customerForm.gta) {
      alert('Associated GTA Agreement is required. Each Capacity Tranche must be linked to an active GTA.');
      return;
    }
    if (!customerForm.sold_to_party) {
      alert('Sold To Party / Shipper is required.');
      return;
    }
    if (!customerForm.start_date || !customerForm.end_date) {
      alert('Start Date and End Date are required.');
      return;
    }
    if (!customerForm.quantity_mmbtu_day || parseFloat(customerForm.quantity_mmbtu_day) <= 0) {
      alert('Valid Quantity (MMBTU/Day) is required.');
      return;
    }

    if (customerCapacityCheck && !customerCapacityCheck.is_available) {
      const confirmProceed = window.confirm(
        `Warning: Requested quantity (${customerForm.quantity_mmbtu_day} MMBTU/Day) exceeds available line capacity (${customerCapacityCheck.available_capacity_mmbtu_day?.toLocaleString()} MMBTU/Day) for the selected dates.\n\nDo you want to submit anyway for Transporter assessment?`
      );
      if (!confirmProceed) return;
    }

    try {
      setLoading(true);
      const dailySchedule = (customerForm.daily_quantities && customerForm.daily_quantities.length > 0)
        ? customerForm.daily_quantities
        : generateDailyBreakdown(customerForm.start_date, customerForm.end_date, customerForm.quantity_mmbtu_day);
      const totalVol = dailySchedule.reduce((sum, item) => sum + (parseFloat(item.quantity_mmbtu) || 0), 0);
      const avgDaily = dailySchedule.length > 0 ? (totalVol / dailySchedule.length).toFixed(2) : customerForm.quantity_mmbtu_day;

      await createCTRequest({
        ...customerForm,
        daily_quantities: dailySchedule,
        quantity_mmbtu_day: parseFloat(avgDaily),
        status: 'SUBMITTED',
        status_update: 'Underprocess'
      }, currentUser);
      setShowNewCTModal(false);
      await loadAllData();
      alert('Capacity Tranche (CT) Request successfully submitted to Transporter.');
    } catch (err) {
      alert('Error creating CT request: ' + (err.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenTransporterModal = (ct) => {
    setEditingCT(ct);
    const start = ct.approved_ct_start_date || ct.start_date || '';
    const end = ct.approved_ct_end_date || ct.end_date || '';
    const baseQty = ct.approved_quantity_mmbtu_day?.toString() || ct.quantity_mmbtu_day?.toString() || '10';
    const daily = (Array.isArray(ct.daily_quantities) && ct.daily_quantities.length > 0)
      ? ct.daily_quantities
      : generateDailyBreakdown(start, end, baseQty);
    const totalVol = daily.reduce((sum, item) => sum + (parseFloat(item.quantity_mmbtu) || 0), 0);
    const avgDaily = daily.length > 0 ? (totalVol / daily.length).toFixed(2) : baseQty;
    const amtInvoice = ct.amt_for_invoice_per_mmbtu?.toString() || '34.00';
    const revEntitlement = (parseFloat(amtInvoice) * (parseFloat(avgDaily) || 0)).toFixed(2);

    setTransporterForm({
      gta_no: ct.gta_no || ct.gta_number || '',
      gta_date: ct.gta_date || '',
      approved_ct_start_date: start,
      approved_ct_end_date: end,
      approved_quantity_mmbtu_day: avgDaily,
      ct_created_by: ct.ct_created_by || currentUser?.full_name || '',
      ct_date: ct.ct_date || new Date().toISOString().split('T')[0],
      overdelivery_tolerance: ct.overdelivery_tolerance?.toString() || '2.00',
      underdelivery_tolerance: ct.underdelivery_tolerance?.toString() || '5.00',
      uft_path_id: ct.uft_path_id || '',
      path_id_desc: ct.path_id_desc || '',
      unified_entry_point: ct.unified_entry_point || ct.delivery_entry_point || '',
      unified_exit_point: ct.unified_exit_point || ct.new_exit_point || '',
      delivery_redelivery_point: ct.delivery_redelivery_point || '',
      total_km: ct.total_km?.toString() || '',
      zone_pngrb: ct.zone_pngrb || '',
      applicable_tariff_regime: ct.applicable_tariff_regime?.toString() || '',
      price_applicable_date: ct.price_applicable_date || '',
      entity_transporter: ct.entity_transporter || '',
      km_share: ct.km_share?.toString() || '',
      uft_ratio_pct: ct.uft_ratio_pct?.toString() || '',
      amt_for_invoice_per_mmbtu: amtInvoice,
      iggl_zonal_entity_id: ct.iggl_zonal_entity_id || '',
      revenue_entitlement: ct.revenue_entitlement?.toString() || revEntitlement,
      daily_quantities: daily
    });
  };

  const handleSaveTransporterForm = async (markAsExecuted = false) => {
    if (!editingCT) return;
    try {
      setLoading(true);
      const dailySchedule = (transporterForm.daily_quantities && transporterForm.daily_quantities.length > 0)
        ? transporterForm.daily_quantities
        : generateDailyBreakdown(transporterForm.approved_ct_start_date, transporterForm.approved_ct_end_date, transporterForm.approved_quantity_mmbtu_day);
      const totalVol = dailySchedule.reduce((sum, item) => sum + (parseFloat(item.quantity_mmbtu) || 0), 0);
      const avgDaily = dailySchedule.length > 0 ? (totalVol / dailySchedule.length).toFixed(2) : transporterForm.approved_quantity_mmbtu_day;

      const payload = {
        ...transporterForm,
        daily_quantities: dailySchedule,
        approved_quantity_mmbtu_day: parseFloat(avgDaily) || 0,
        overdelivery_tolerance: parseFloat(transporterForm.overdelivery_tolerance) || 0,
        underdelivery_tolerance: parseFloat(transporterForm.underdelivery_tolerance) || 0,
        applicable_tariff_regime: parseFloat(transporterForm.applicable_tariff_regime) || 34.0,
        total_km: parseFloat(transporterForm.total_km) || 0,
        km_share: parseFloat(transporterForm.km_share) || 100.0,
        uft_ratio_pct: parseFloat(transporterForm.uft_ratio_pct) || 100.0,
        amt_for_invoice_per_mmbtu: parseFloat(transporterForm.amt_for_invoice_per_mmbtu) || 34.0,
        revenue_entitlement: parseFloat(transporterForm.revenue_entitlement) || 0,
        status_update: markAsExecuted ? 'Executed' : transporterForm.status_update,
        status: markAsExecuted ? 'EXECUTED' : (editingCT.status === 'DRAFT' ? 'UNDER_PROCESS' : editingCT.status)
      };

      await updateCTRequest(editingCT.id, payload);
      setEditingCT(null);
      await loadAllData();
      alert(markAsExecuted ? 'Capacity Tranche successfully EXECUTED in SAP!' : 'Transporter parameters updated successfully.');
    } catch (err) {
      alert('Failed to update CT: ' + (err.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };



  const handleApproveCT = async (ct) => {
    if (!ct) return;
    if (!window.confirm(`Approve CT ${ct.ct_number}? This will move it to APPROVED and generate a CT ID visible to the customer.`)) return;
    try {
      setLoading(true);
      const dailySchedule = (transporterForm.daily_quantities && transporterForm.daily_quantities.length > 0)
        ? transporterForm.daily_quantities
        : generateDailyBreakdown(transporterForm.approved_ct_start_date, transporterForm.approved_ct_end_date, transporterForm.approved_quantity_mmbtu_day);
      const totalVol = dailySchedule.reduce((sum, item) => sum + (parseFloat(item.quantity_mmbtu) || 0), 0);
      const avgDaily = dailySchedule.length > 0 ? (totalVol / dailySchedule.length).toFixed(2) : transporterForm.approved_quantity_mmbtu_day;

      // First save the transporter fields (GTA, dates, quantity, tolerances, daily quantities)
      const payload = {
        ...transporterForm,
        daily_quantities: dailySchedule,
        approved_quantity_mmbtu_day: parseFloat(avgDaily) || 0,
        overdelivery_tolerance: parseFloat(transporterForm.overdelivery_tolerance) || 0,
        underdelivery_tolerance: parseFloat(transporterForm.underdelivery_tolerance) || 0,
        status: 'APPROVED'
      };
      await updateCTRequest(ct.id, payload);
      // Then call the dedicated approve action which generates the CT ID
      const result = await approveCTRequest(ct.id, {
        approved_ct_start_date: payload.approved_ct_start_date,
        approved_ct_end_date: payload.approved_ct_end_date,
        approved_quantity_mmbtu_day: payload.approved_quantity_mmbtu_day,
        daily_quantities: dailySchedule
      });
      setEditingCT(null);
      await loadAllData();
      const ctId = result?.ct?.sap_contract_number || result?.sap_contract_number || ct.ct_number;
      alert(`CT approved successfully!\nCT ID: ${ctId}\nThe customer can now view this on their portal.`);
    } catch (err) {
      alert('Failed to approve CT: ' + (err.data?.error || err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  // Filtered CTs
  const filteredCTs = cts.filter((c) => {
    const isApproved = c.status === 'APPROVED' || c.status === 'EXECUTED';
    if (activeTab === 'APPROVED' && !isApproved) return false;
    if (activeTab === 'PENDING' && isApproved) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNum = c.ct_number?.toLowerCase().includes(q);
      const matchSold = c.sold_to_party?.toLowerCase().includes(q);
      const matchGta = (c.gta_no || c.gta_number)?.toLowerCase().includes(q);
      const matchSap = c.sap_contract_id?.toLowerCase().includes(q);
      if (!matchNum && !matchSold && !matchGta && !matchSap) return false;
    }
    return true;
  });

  const getStatusBadge = (ct) => {
    const isApproved = ct.status === 'APPROVED' || ct.status === 'EXECUTED';
    if (isApproved) {
      return (
        <span style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', ...badgeStyle }}>
          ● Approved
        </span>
      );
    }
    if (ct.status === 'REVERTED' || ct.status === 'RETURNED') {
      return (
        <span style={{ background: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3', ...badgeStyle }}>
          ↩ Reverted
        </span>
      );
    }
    return (
      <span style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', ...badgeStyle }}>
        ⏳ Pending Review
      </span>
    );
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header Banner - Flat & Professional */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          padding: '1.15rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{ background: '#f8fafc', padding: '0.45rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <Layers size={20} color="#00823b" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Capacity Tranche (CT) Management
              </h1>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
                Pipeline capacity allocation, UFT route tariff pricing, and SAP transmission contract execution.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowNewCTModal(true)}
          style={{
            background: '#00823b',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '0.55rem 1.1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            fontSize: '0.825rem',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <Plus size={16} />
          <span>Request Capacity Tranche</span>
        </button>
      </div>

      {/* KPI Stats Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div style={statCardStyle}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Total CT Requests</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', marginTop: '0.25rem' }}>
            {cts.length}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.15rem' }}>Registered in SAP / Portal</div>
        </div>

        <div style={statCardStyle}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Approved CTs</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#15803d', marginTop: '0.25rem' }}>
            {cts.filter((c) => c.status === 'APPROVED' || c.status === 'EXECUTED').length}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.15rem' }}>Capacity Allocated & In Force</div>
        </div>

        <div style={statCardStyle}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Pending Review</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1d4ed8', marginTop: '0.25rem' }}>
            {cts.filter((c) => c.status !== 'APPROVED' && c.status !== 'EXECUTED').length}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.15rem' }}>Awaiting Transporter Approval</div>
        </div>

        <div style={statCardStyle}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Total Booked Quantity</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', marginTop: '0.25rem' }}>
            {cts.reduce((sum, c) => sum + (parseFloat(c.approved_quantity_mmbtu_day || c.quantity_mmbtu_day) || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
            <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#64748b' }}>MMBTU/D</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#00823b', fontWeight: 700, marginTop: '0.2rem' }}>
            📦 {cts.reduce((sum, c) => {
              const v = c.total_volume_mmbtu ?? (Array.isArray(c.daily_quantities) && c.daily_quantities.length > 0 ? c.daily_quantities.reduce((a, it) => a + (parseFloat(it.quantity_mmbtu) || 0), 0) : 0);
              return sum + v;
            }, 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} MMBTU Total
          </div>
        </div>
      </div>

      {/* Tabs & Search Controls */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          padding: '0.75rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.85rem'
        }}
      >
        <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto' }}>
          {[
            { id: 'ALL', label: `All (${cts.length})` },
            { id: 'PENDING', label: `Pending Review (${cts.filter((c) => c.status !== 'APPROVED' && c.status !== 'EXECUTED').length})` },
            { id: 'APPROVED', label: `Approved (${cts.filter((c) => c.status === 'APPROVED' || c.status === 'EXECUTED').length})` }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: activeTab === tab.id ? '#e8f5e9' : 'transparent',
                color: activeTab === tab.id ? '#00823b' : '#64748b',
                fontWeight: activeTab === tab.id ? 700 : 500,
                fontSize: '0.8rem',
                border: 'none',
                borderRadius: '6px',
                padding: '0.4rem 0.8rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', width: '320px' }}>
          <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
          <input
            type="text"
            placeholder="Search CT #, Sold To Party, GTA #, SAP ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.45rem 0.75rem 0.45rem 2rem',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '0.8rem',
              outline: 'none'
            }}
          />
        </div>
      </div>

      {/* Capacity Tranches Table */}
      <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
            <Clock size={24} color="#00823b" style={{ margin: '0 auto 0.75rem auto', animation: 'spin 1s linear infinite' }} />
            Loading Capacity Tranches...
          </div>
        ) : filteredCTs.length === 0 ? (
          <div style={{ padding: '3.5rem', textAlign: 'center', color: '#64748b' }}>
            <Layers size={42} color="#cbd5e1" style={{ margin: '0 auto 0.75rem auto' }} />
            <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.95rem' }}>No Capacity Tranches found</div>
            <div style={{ fontSize: '0.8rem', marginTop: '0.25rem', color: '#64748b' }}>
              {searchQuery ? 'No CTs match your search query.' : 'No Capacity Tranche requests submitted yet.'}
            </div>
            <button
              onClick={() => setShowNewCTModal(true)}
              style={{
                marginTop: '1rem',
                background: '#00823b',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '0.45rem 1rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              + Create First CT Request
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.825rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700, fontSize: '0.725rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '0.85rem 1.25rem' }}>CT Reference / Dates</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Sold To Party / Shipper</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Entry → Exit Route</th>
                  <th style={{ padding: '0.85rem 1rem' }}>GTA # / CT ID</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Quantity (MMBTU/D)</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Tariff & Entitlement</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCTs.map((ct) => {
                  const qty = ct.approved_quantity_mmbtu_day || ct.quantity_mmbtu_day || 0;
                  const amtInvoice = ct.amt_for_invoice_per_mmbtu || 0;
                  const rev = ct.revenue_entitlement || (amtInvoice * qty).toFixed(2);
                  const isApproved = ct.status === 'APPROVED' || ct.status === 'EXECUTED';
                  const totalVol = ct.total_volume_mmbtu !== undefined && ct.total_volume_mmbtu !== null
                    ? ct.total_volume_mmbtu
                    : (Array.isArray(ct.daily_quantities) && ct.daily_quantities.length > 0
                      ? ct.daily_quantities.reduce((a, c) => a + (parseFloat(c.quantity_mmbtu) || 0), 0)
                      : null);
                  return (
                    <tr
                      key={ct.id}
                      style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s ease' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#fafbfc')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* CT Ref & Date */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{ct.ct_number}</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
                          CT Date: {ct.ct_date || '—'}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: '0.15rem' }}>
                          Period: {ct.approved_ct_start_date || ct.start_date || '—'} → {ct.approved_ct_end_date || ct.end_date || '—'}
                        </div>
                      </td>

                      {/* Sold To Party */}
                      <td style={{ padding: '1rem 1rem' }}>
                        <div style={{ fontWeight: 700, color: '#1e293b' }}>
                          {ct.sold_to_party || ct.shipper_name || '—'}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#0369a1', marginTop: '0.25rem', fontWeight: 500 }}>
                          Path: {ct.unified_path || '—'}
                        </div>
                      </td>

                      {/* Entry -> Exit */}
                      <td style={{ padding: '1rem 1rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1e293b' }}>
                          {ct.delivery_entry_point || ct.unified_entry_point || '—'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', color: '#64748b', marginTop: '0.15rem' }}>
                          <ArrowRight size={12} color="#00823b" />
                          <span>{ct.new_exit_point || ct.unified_exit_point || '—'}</span>
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                          Zone: {ct.zone_pngrb || '—'}{ct.total_km ? ` · ${ct.total_km} km` : ''}
                        </div>
                      </td>

                      {/* GTA # & CT ID */}
                      <td style={{ padding: '1rem 1rem' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>
                          GTA: {ct.gta_no || ct.gta_number || '—'}
                        </div>
                        {ct.gta_date && (
                          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.15rem' }}>
                            GTA Date: {ct.gta_date}
                          </div>
                        )}
                        {ct.sap_contract_id && (
                          <div style={{ fontSize: '0.72rem', color: '#00823b', marginTop: '0.2rem', fontWeight: 700 }}>
                            CT ID: {ct.sap_contract_id}
                          </div>
                        )}
                      </td>

                      {/* Quantity */}
                      <td style={{ padding: '1rem 1rem' }}>
                        <div style={{ fontWeight: 800, color: '#00823b', fontSize: '0.95rem' }}>
                          {qty} <span style={{ fontSize: '0.7rem', fontWeight: 500, color: '#64748b' }}>MMBTU/Day</span>
                        </div>
                        {totalVol !== null && (
                          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0284c7', marginTop: '0.15rem' }}>
                            📦 {Number(totalVol).toLocaleString(undefined, { maximumFractionDigits: 2 })} MMBTU Total
                            {ct.daily_quantities?.length ? (
                              <span style={{ fontWeight: 500, color: '#64748b', marginLeft: '0.25rem' }}>({ct.daily_quantities.length}d)</span>
                            ) : null}
                          </div>
                        )}
                        <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '0.15rem' }}>
                          Tol: +{ct.overdelivery_tolerance || '0'}% / -{ct.underdelivery_tolerance || '0'}%
                        </div>
                      </td>

                      {/* Tariff & Revenue Entitlement */}
                      <td style={{ padding: '1rem 1rem' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>
                          ₹ {amtInvoice} <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 400 }}>/ MMBTU</span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: 600, marginTop: '0.15rem' }}>
                          ₹ {rev} Total / Day
                        </div>
                        <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                          UFT Ratio: {ct.uft_ratio_pct || '0'}%
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '1rem 1rem' }}>
                        {getStatusBadge(ct)}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                          <button
                            onClick={() => setSelectedCT(ct)}
                            title="View Full Parameters"
                            style={{
                              background: '#ffffff',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              padding: '0.35rem 0.6rem',
                              cursor: 'pointer',
                              color: '#334155',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              fontSize: '0.75rem',
                              fontWeight: 600
                            }}
                          >
                            <Eye size={13} />
                            <span>View</span>
                          </button>

                          {isAdmin && !isApproved && (
                            <button
                              onClick={() => handleOpenTransporterModal(ct)}
                              title="Review capacity, parameters, and approve CT"
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
                                whiteSpace: 'nowrap'
                              }}
                            >
                              <FileCheck size={13} />
                              <span>Review & Approve</span>
                            </button>
                          )}
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

      {/* MODAL 1: Customer CT Request Modal */}
      {showNewCTModal && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalContainerStyle, maxWidth: '780px', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={modalHeaderStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ background: '#f8fafc', padding: '0.45rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <Layers size={20} color="#00823b" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                    Request Capacity Tranche (CT)
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Customer Application per SAP Transmission Contract Guidelines
                  </div>
                </div>
              </div>
              <button onClick={() => setShowNewCTModal(false)} style={closeBtnStyle}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateCustomerCT} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={sectionBoxStyle}>
                <div style={sectionTitleStyle}>1. Customer Capacity Terms</div>

                {/* Associated GTA Agreement & Sold To Party */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '1rem' }}>
                  <div>
                    <label style={{ ...labelStyle, color: '#00823b' }}>
                      Associated GTA Agreement *
                    </label>
                    <select
                      value={customerForm.gta_no}
                      onChange={(e) => {
                        const val = e.target.value;
                        const match = masterData.gta_options?.find((g) => g.gta_no === val);
                        setCustomerForm((prev) => ({
                          ...prev,
                          gta_no: val,
                          gta: match?.id || '',
                          sold_to_party: match?.shipper_name || prev.sold_to_party
                        }));
                      }}
                      style={{ ...inputStyle, borderColor: '#86efac', background: '#f0fdf4', fontWeight: 600 }}
                      required
                    >
                      <option value="">Select Associated GTA</option>
                      {masterData.gta_options?.map((g, idx) => (
                        <option key={idx} value={g.gta_no}>
                          {g.gta_no} - {g.shipper_name} ({g.gta_date ? `Dated ${g.gta_date}` : (g.status || 'Active')})
                        </option>
                      ))}
                    </select>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.25rem' }}>
                      Each CT is created and governed under an active Gas Transmission Agreement (GTA).
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Sold To Party / Shipper *</label>
                    <select
                      value={customerForm.sold_to_party}
                      onChange={(e) => setCustomerForm({ ...customerForm, sold_to_party: e.target.value })}
                      style={inputStyle}
                      required
                    >
                      <option value="">Select Sold To Party</option>
                      {masterData.sold_to_parties?.map((p, idx) => (
                        <option key={idx} value={p.label}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* UFT Path */}
                <div style={{ marginTop: '0.75rem' }}>
                  <label style={{ ...labelStyle, color: '#00823b' }}>
                    UFT Transmission Line / Corridor *
                  </label>
                  <select
                    value={customerForm.uft_path_id}
                    onChange={(e) => handleUftPathSelectInCustomer(e.target.value)}
                    style={{ ...inputStyle, borderColor: '#86efac', background: '#f0fdf4' }}
                    required
                  >
                    <option value="">Select UFT Path</option>
                    {masterData.uft_master_paths?.map((p, idx) => (
                      <option key={idx} value={p.uft_path_id}>
                        {p.uft_path_id} - {p.path_id_desc || p.unified_path} ({p.zone_pngrb})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Delivery / Entry Point & Add New Exit Point */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.75rem' }}>
                  <div>
                    <label style={labelStyle}>Delivery / Entry Point *</label>
                    <input
                      type="text"
                      value={customerForm.delivery_entry_point}
                      onChange={(e) => setCustomerForm({ ...customerForm, delivery_entry_point: e.target.value })}
                      style={inputStyle}
                      required
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Exit / Redelivery Point *</label>
                    <input
                      type="text"
                      value={customerForm.new_exit_point}
                      onChange={(e) => setCustomerForm({ ...customerForm, new_exit_point: e.target.value })}
                      placeholder="e.g. NRL, Numaligarh"
                      style={inputStyle}
                      required
                    />
                  </div>
                </div>

                {/* Start Date, End Date, Quantity */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginTop: '0.75rem' }}>
                  <div>
                    <label style={labelStyle}>Start Date *</label>
                    <input
                      type="date"
                      value={customerForm.start_date}
                      onChange={(e) => {
                        const val = e.target.value;
                        const updatedDaily = generateDailyBreakdown(val, customerForm.end_date, customerForm.quantity_mmbtu_day, customerForm.daily_quantities);
                        const totalVol = updatedDaily.reduce((sum, item) => sum + (parseFloat(item.quantity_mmbtu) || 0), 0);
                        const avgDaily = updatedDaily.length > 0 ? (totalVol / updatedDaily.length).toFixed(2) : customerForm.quantity_mmbtu_day;
                        setCustomerForm({ ...customerForm, start_date: val, daily_quantities: updatedDaily, quantity_mmbtu_day: avgDaily });
                        checkCustomerAvailability(customerForm.uft_path_id, val, customerForm.end_date, avgDaily);
                      }}
                      style={inputStyle}
                      required
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>End Date *</label>
                    <input
                      type="date"
                      value={customerForm.end_date}
                      onChange={(e) => {
                        const val = e.target.value;
                        const updatedDaily = generateDailyBreakdown(customerForm.start_date, val, customerForm.quantity_mmbtu_day, customerForm.daily_quantities);
                        const totalVol = updatedDaily.reduce((sum, item) => sum + (parseFloat(item.quantity_mmbtu) || 0), 0);
                        const avgDaily = updatedDaily.length > 0 ? (totalVol / updatedDaily.length).toFixed(2) : customerForm.quantity_mmbtu_day;
                        setCustomerForm({ ...customerForm, end_date: val, daily_quantities: updatedDaily, quantity_mmbtu_day: avgDaily });
                        checkCustomerAvailability(customerForm.uft_path_id, customerForm.start_date, val, avgDaily);
                      }}
                      style={inputStyle}
                      required
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Base Quantity (MMBTU/Day) *</label>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      value={customerForm.quantity_mmbtu_day}
                      onChange={(e) => {
                        const val = e.target.value;
                        const parsed = val === '' ? '' : (parseFloat(val) || 0);
                        const updatedDaily = (customerForm.daily_quantities || []).map((item) => ({
                          ...item,
                          quantity_mmbtu: parsed
                        }));
                        setCustomerForm({ ...customerForm, quantity_mmbtu_day: val, daily_quantities: updatedDaily });
                        checkCustomerAvailability(customerForm.uft_path_id, customerForm.start_date, customerForm.end_date, val);
                      }}
                      placeholder="e.g. 1000"
                      style={inputStyle}
                      required
                    />
                  </div>
                </div>

                {/* Live Capacity Availability Indicator */}
                {checkingCustomerCapacity ? (
                  <div style={{ marginTop: '0.85rem', padding: '0.65rem 1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.75rem', color: '#64748b' }}>
                    Computing pipeline line capacity availability...
                  </div>
                ) : customerCapacityCheck ? (
                  <div
                    style={{
                      marginTop: '0.85rem',
                      padding: '0.85rem 1rem',
                      borderRadius: '8px',
                      background: customerCapacityCheck.is_available ? '#f0fdf4' : '#fef2f2',
                      border: `1px solid ${customerCapacityCheck.is_available ? '#86efac' : '#fca5a5'}`
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <Gauge size={16} color={customerCapacityCheck.is_available ? '#16a34a' : '#dc2626'} />
                        <span style={{ fontWeight: 700, fontSize: '0.8rem', color: customerCapacityCheck.is_available ? '#166534' : '#991b1b' }}>
                          Pipeline Capacity Availability ({customerCapacityCheck.uft_id}):
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          background: customerCapacityCheck.is_available ? '#dcfce7' : '#fee2e2',
                          color: customerCapacityCheck.is_available ? '#15803d' : '#b91c1c'
                        }}
                      >
                        {customerCapacityCheck.is_available ? 'CAPACITY AVAILABLE' : 'INSUFFICIENT CAPACITY'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginTop: '0.5rem', fontSize: '0.75rem' }}>
                      <div>
                        <span style={{ color: '#64748b' }}>Total Line Capacity: </span>
                        <strong>{customerCapacityCheck.total_capacity_mmbtu_day?.toLocaleString()}</strong> MMBTU/D
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Booked in Period: </span>
                        <strong style={{ color: '#ea580c' }}>{customerCapacityCheck.peak_booked_capacity_mmbtu_day?.toLocaleString()}</strong> MMBTU/D
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Available Capacity: </span>
                        <strong style={{ color: '#16a34a' }}>{customerCapacityCheck.available_capacity_mmbtu_day?.toLocaleString()}</strong> MMBTU/D
                      </div>
                    </div>

                    {customerCapacityCheck.is_available ? (
                      <div style={{ fontSize: '0.72rem', color: '#15803d', marginTop: '0.4rem' }}>
                        ✓ Requested {parseFloat(customerForm.quantity_mmbtu_day || 0).toLocaleString()} MMBTU/Day can be accommodated. Remaining buffer: {customerCapacityCheck.remaining_after_requested?.toLocaleString()} MMBTU/Day.
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.72rem', color: '#b91c1c', marginTop: '0.4rem', fontWeight: 600 }}>
                        ⚠ Requested {parseFloat(customerForm.quantity_mmbtu_day || 0).toLocaleString()} MMBTU/Day exceeds available capacity ({customerCapacityCheck.available_capacity_mmbtu_day?.toLocaleString()} MMBTU/Day) on this line for selected dates.
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Section 2: Daily Capacity Schedule Breakdown */}
              <div style={sectionBoxStyle}>
                <div style={{ ...sectionTitleStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <Calendar size={16} color="#00823b" />
                    <span>2. Daily Nomination Schedule (Per-Day Line Item Schedule)</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyBaseToAllDays}
                    style={{
                      background: '#f0fdf4',
                      border: '1px solid #86efac',
                      borderRadius: '6px',
                      padding: '0.3rem 0.65rem',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: '#166534',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                    title="Reset all days to base quantity"
                  >
                    <span>Apply Base ({customerForm.quantity_mmbtu_day || 0} MMBTU) to All Days</span>
                  </button>
                </div>

                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.75rem' }}>
                  Each date in the requested period is listed below with its daily nominated MMBTU. Adjust individual days as required for your schedule.
                </div>

                {/* Summary Metric Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '0.85rem' }}>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.65rem 0.85rem' }}>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>SCHEDULE DURATION</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginTop: '0.15rem' }}>
                      {customerForm.daily_quantities?.length || 0} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b' }}>Days</span>
                    </div>
                  </div>

                  <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '0.65rem 0.85rem' }}>
                    <div style={{ fontSize: '0.68rem', color: '#047857', fontWeight: 600 }}>TOTAL CONTRACT VOLUME</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#00823b', marginTop: '0.15rem' }}>
                      {(customerForm.daily_quantities?.reduce((acc, curr) => acc + (parseFloat(curr.quantity_mmbtu) || 0), 0) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
                      <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#047857' }}>MMBTU</span>
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.65rem 0.85rem' }}>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>AVERAGE DAILY VOLUME</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0284c7', marginTop: '0.15rem' }}>
                      {customerForm.daily_quantities?.length
                        ? (customerForm.daily_quantities.reduce((acc, curr) => acc + (parseFloat(curr.quantity_mmbtu) || 0), 0) / customerForm.daily_quantities.length).toLocaleString(undefined, { maximumFractionDigits: 2 })
                        : '0'}{' '}
                      <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b' }}>MMBTU/D</span>
                    </div>
                  </div>
                </div>

                {/* Scrollable Line Items Table */}
                <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, borderBottom: '1px solid #e2e8f0', zIndex: 2 }}>
                      <tr style={{ color: '#475569', textAlign: 'left' }}>
                        <th style={{ padding: '0.5rem 0.85rem', width: '70px' }}>Day</th>
                        <th style={{ padding: '0.5rem 0.85rem' }}>Date & Day</th>
                        <th style={{ padding: '0.5rem 0.85rem', textAlign: 'right' }}>Daily Quantity (MMBTU/Day)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerForm.daily_quantities && customerForm.daily_quantities.length > 0 ? (
                        customerForm.daily_quantities.map((item, idx) => (
                          <tr
                            key={item.date || idx}
                            style={{ borderBottom: '1px solid #f1f5f9' }}
                          >
                            <td style={{ padding: '0.45rem 0.85rem', color: '#64748b', fontWeight: 600 }}>
                              #{idx + 1}
                            </td>
                            <td style={{ padding: '0.45rem 0.85rem', fontWeight: 600, color: '#1e293b' }}>
                              <span>{formatScheduleDate(item.date)}</span>
                              <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginLeft: '0.4rem' }}>({item.date})</span>
                            </td>
                            <td style={{ padding: '0.45rem 0.85rem', textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  value={item.quantity_mmbtu}
                                  onChange={(e) => handleUpdateDailyQuantity(item.date, e.target.value)}
                                  style={{
                                    width: '130px',
                                    padding: '0.35rem 0.55rem',
                                    textAlign: 'right',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '6px',
                                    fontSize: '0.825rem',
                                    fontWeight: 700,
                                    color: '#0f172a',
                                    background: '#ffffff'
                                  }}
                                />
                                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>MMBTU</span>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} style={{ padding: '1.25rem', textAlign: 'center', color: '#94a3b8' }}>
                            Select valid Start Date and End Date above to populate daily schedule.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowNewCTModal(false)}
                  style={{ ...btnStyle, background: '#f1f5f9', color: '#475569' }}
                >
                  Cancel
                </button>
                <button type="submit" style={{ ...btnStyle, background: '#00823b', color: '#ffffff' }}>
                  Submit CT Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Transporter / Admin Processing Modal (Sections 2 & 3) */}
      {editingCT && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalContainerStyle, maxWidth: '880px', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={modalHeaderStyle}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                  Fields added by the Transporter (Admin / Zonal Officer)
                </h3>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  CT Reference: <strong>{editingCT.ct_number}</strong> · Shipper: {editingCT.sold_to_party}
                </div>
              </div>
              <button onClick={() => setEditingCT(null)} style={closeBtnStyle}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Section 2: Transporter Fields */}
              <div style={sectionBoxStyle}>
                <div style={sectionTitleStyle}>2. Transporter & GTA Association</div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={labelStyle}>GTA No (Dropdown)</label>
                    <select
                      value={transporterForm.gta_no}
                      onChange={(e) => handleGtaSelectInTransporter(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">Select GTA Agreement</option>
                      {masterData.gta_options?.map((g, idx) => (
                        <option key={idx} value={g.gta_no}>
                          {g.gta_no} {g.shipper_name ? `(${g.shipper_name})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>GTA Date (Date picker)</label>
                    <input
                      type="date"
                      value={transporterForm.gta_date}
                      onChange={(e) => setTransporterForm({ ...transporterForm, gta_date: e.target.value })}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>CT Created by</label>
                    <input
                      type="text"
                      value={transporterForm.ct_created_by}
                      onChange={(e) => setTransporterForm({ ...transporterForm, ct_created_by: e.target.value })}
                      placeholder="Officer / User Name"
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', marginTop: '0.75rem' }}>
                  <div>
                    <label style={labelStyle}>Approved CT Start Date</label>
                    <input
                      type="date"
                      value={transporterForm.approved_ct_start_date}
                      onChange={(e) => {
                        const val = e.target.value;
                        const updatedDaily = generateDailyBreakdown(val, transporterForm.approved_ct_end_date, transporterForm.approved_quantity_mmbtu_day, transporterForm.daily_quantities);
                        const totalVol = updatedDaily.reduce((sum, item) => sum + (parseFloat(item.quantity_mmbtu) || 0), 0);
                        const avgDaily = updatedDaily.length > 0 ? (totalVol / updatedDaily.length).toFixed(2) : transporterForm.approved_quantity_mmbtu_day;
                        const amt = parseFloat(transporterForm.amt_for_invoice_per_mmbtu) || 34.0;
                        setTransporterForm({
                          ...transporterForm,
                          approved_ct_start_date: val,
                          daily_quantities: updatedDaily,
                          approved_quantity_mmbtu_day: avgDaily,
                          revenue_entitlement: (amt * (parseFloat(avgDaily) || 0)).toFixed(2)
                        });
                      }}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Approved CT End Date</label>
                    <input
                      type="date"
                      value={transporterForm.approved_ct_end_date}
                      onChange={(e) => {
                        const val = e.target.value;
                        const updatedDaily = generateDailyBreakdown(transporterForm.approved_ct_start_date, val, transporterForm.approved_quantity_mmbtu_day, transporterForm.daily_quantities);
                        const totalVol = updatedDaily.reduce((sum, item) => sum + (parseFloat(item.quantity_mmbtu) || 0), 0);
                        const avgDaily = updatedDaily.length > 0 ? (totalVol / updatedDaily.length).toFixed(2) : transporterForm.approved_quantity_mmbtu_day;
                        const amt = parseFloat(transporterForm.amt_for_invoice_per_mmbtu) || 34.0;
                        setTransporterForm({
                          ...transporterForm,
                          approved_ct_end_date: val,
                          daily_quantities: updatedDaily,
                          approved_quantity_mmbtu_day: avgDaily,
                          revenue_entitlement: (amt * (parseFloat(avgDaily) || 0)).toFixed(2)
                        });
                      }}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Approved Quantity (MMBTU/D)</label>
                    <input
                      type="number"
                      step="any"
                      value={transporterForm.approved_quantity_mmbtu_day}
                      onChange={(e) => {
                        const val = e.target.value;
                        const amt = parseFloat(transporterForm.amt_for_invoice_per_mmbtu) || 34.0;
                        const parsed = val === '' ? '' : (parseFloat(val) || 0);
                        const updatedDaily = (transporterForm.daily_quantities || []).map((item) => ({
                          ...item,
                          quantity_mmbtu: parsed
                        }));
                        setTransporterForm({
                          ...transporterForm,
                          approved_quantity_mmbtu_day: val,
                          daily_quantities: updatedDaily,
                          revenue_entitlement: (amt * (parseFloat(val) || 0)).toFixed(2)
                        });
                      }}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>CT Date</label>
                    <input
                      type="date"
                      value={transporterForm.ct_date}
                      onChange={(e) => setTransporterForm({ ...transporterForm, ct_date: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.75rem' }}>
                  <div>
                    <label style={labelStyle}>Overdelivery Tolerance (%)</label>
                    <input
                      type="number"
                      step="any"
                      value={transporterForm.overdelivery_tolerance}
                      onChange={(e) => setTransporterForm({ ...transporterForm, overdelivery_tolerance: e.target.value })}
                      placeholder="2.00"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Underdelivery Tolerance (%)</label>
                    <input
                      type="number"
                      step="any"
                      value={transporterForm.underdelivery_tolerance}
                      onChange={(e) => setTransporterForm({ ...transporterForm, underdelivery_tolerance: e.target.value })}
                      placeholder="5.00"
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: UFT Path Tariff Parameters (Auto-Populate) */}
              <div style={sectionBoxStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={sectionTitleStyle}>3. UFT Path Tariff Parameters</div>
                  <div style={{ fontSize: '0.725rem', color: '#00823b', fontWeight: 600 }}>
                    ⚡ Auto-populates from UFT Path selection
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                  <div>
                    <label style={{ ...labelStyle, color: '#0369a1' }}>UFT Path ID *</label>
                    <select
                      value={transporterForm.uft_path_id}
                      onChange={(e) => handleUftPathSelectInTransporter(e.target.value)}
                      style={{ ...inputStyle, borderColor: '#38bdf8' }}
                    >
                      <option value="">Select UFT Path</option>
                      {masterData.uft_master_paths?.map((p, idx) => (
                        <option key={idx} value={p.uft_path_id}>
                          {p.uft_path_id} ({p.path_id_desc})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>Path ID Des</label>
                    <input
                      type="text"
                      value={transporterForm.path_id_desc}
                      onChange={(e) => setTransporterForm({ ...transporterForm, path_id_desc: e.target.value })}
                      style={readOnlyInputStyle}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginTop: '0.75rem' }}>
                  <div>
                    <label style={labelStyle}>Unified Entry Point</label>
                    <input
                      type="text"
                      value={transporterForm.unified_entry_point}
                      onChange={(e) => setTransporterForm({ ...transporterForm, unified_entry_point: e.target.value })}
                      style={readOnlyInputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Unified Exit Point</label>
                    <input
                      type="text"
                      value={transporterForm.unified_exit_point}
                      onChange={(e) => setTransporterForm({ ...transporterForm, unified_exit_point: e.target.value })}
                      style={readOnlyInputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Delivery / Redelivery Point</label>
                    <input
                      type="text"
                      value={transporterForm.delivery_redelivery_point}
                      onChange={(e) => setTransporterForm({ ...transporterForm, delivery_redelivery_point: e.target.value })}
                      style={readOnlyInputStyle}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', marginTop: '0.75rem' }}>
                  <div>
                    <label style={labelStyle}>Total KM</label>
                    <input
                      type="number"
                      value={transporterForm.total_km}
                      onChange={(e) => setTransporterForm({ ...transporterForm, total_km: e.target.value })}
                      style={readOnlyInputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Zone (as per PNGRB)</label>
                    <input type="text" value={transporterForm.zone_pngrb} readOnly style={readOnlyInputStyle} />
                  </div>

                  <div>
                    <label style={labelStyle}>Applicable Tariff (Rs./MMBtu)</label>
                    <input type="text" value={transporterForm.applicable_tariff_regime} readOnly style={readOnlyInputStyle} />
                  </div>

                  <div>
                    <label style={labelStyle}>Price Applicable Date</label>
                    <input type="text" value={transporterForm.price_applicable_date} readOnly style={readOnlyInputStyle} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', marginTop: '0.75rem' }}>
                  <div>
                    <label style={labelStyle}>Entity / Transporter</label>
                    <input type="text" value={transporterForm.entity_transporter} readOnly style={readOnlyInputStyle} />
                  </div>

                  <div>
                    <label style={labelStyle}>KM Share (%)</label>
                    <input type="text" value={transporterForm.km_share} readOnly style={readOnlyInputStyle} />
                  </div>

                  <div>
                    <label style={labelStyle}>UFT Ratio (%)</label>
                    <input type="text" value={transporterForm.uft_ratio_pct} readOnly style={readOnlyInputStyle} />
                  </div>

                  <div>
                    <label style={{ ...labelStyle, color: '#00823b' }}>Amt for Invoice / MMBtu</label>
                    <input
                      type="text"
                      value={`₹ ${transporterForm.amt_for_invoice_per_mmbtu}`}
                      readOnly
                      style={{ ...readOnlyInputStyle, fontWeight: 700, color: '#00823b' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.75rem' }}>
                  <div>
                    <label style={labelStyle}>IGGL Zonal Entity ID</label>
                    <input type="text" value={transporterForm.iggl_zonal_entity_id} readOnly style={readOnlyInputStyle} />
                  </div>

                  <div>
                    <label style={{ ...labelStyle, color: '#00823b' }}>Revenue Entitlement (Total / Day)</label>
                    <input
                      type="text"
                      value={`₹ ${transporterForm.revenue_entitlement}`}
                      readOnly
                      style={{ ...readOnlyInputStyle, fontWeight: 800, color: '#00823b' }}
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Daily Nomination Schedule Breakdown & Allocation */}
              <div style={sectionBoxStyle}>
                <div style={{ ...sectionTitleStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <Calendar size={16} color="#00823b" />
                    <span>4. Daily Nomination Schedule & Allocation ({transporterForm.daily_quantities?.length || 0} Days)</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyTransporterBaseToAllDays}
                    style={{
                      background: '#f0fdf4',
                      color: '#15803d',
                      border: '1px solid #bbf7d0',
                      borderRadius: '6px',
                      padding: '0.25rem 0.65rem',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Apply Approved ({transporterForm.approved_quantity_mmbtu_day || 0}) to All Days
                  </button>
                </div>

                {/* Summary Metric Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '0.85rem' }}>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.65rem 0.85rem' }}>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>SCHEDULE DURATION</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginTop: '0.15rem' }}>
                      {transporterForm.daily_quantities?.length || 0} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b' }}>Days</span>
                    </div>
                  </div>

                  <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '0.65rem 0.85rem' }}>
                    <div style={{ fontSize: '0.68rem', color: '#047857', fontWeight: 600 }}>TOTAL CONTRACT VOLUME</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#00823b', marginTop: '0.15rem' }}>
                      {(transporterForm.daily_quantities?.reduce((acc, curr) => acc + (parseFloat(curr.quantity_mmbtu) || 0), 0) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
                      <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#047857' }}>MMBTU</span>
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.65rem 0.85rem' }}>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>APPROVED DAILY AVERAGE</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0284c7', marginTop: '0.15rem' }}>
                      {transporterForm.daily_quantities?.length
                        ? (transporterForm.daily_quantities.reduce((acc, curr) => acc + (parseFloat(curr.quantity_mmbtu) || 0), 0) / transporterForm.daily_quantities.length).toLocaleString(undefined, { maximumFractionDigits: 2 })
                        : '0'}{' '}
                      <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b' }}>MMBTU/D</span>
                    </div>
                  </div>

                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.65rem 0.85rem' }}>
                    <div style={{ fontSize: '0.68rem', color: '#15803d', fontWeight: 600 }}>TOTAL CONTRACT REVENUE</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#00823b', marginTop: '0.15rem' }}>
                      ₹ {((parseFloat(transporterForm.amt_for_invoice_per_mmbtu) || 34.0) * (transporterForm.daily_quantities?.reduce((acc, curr) => acc + (parseFloat(curr.quantity_mmbtu) || 0), 0) || 0)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                {/* Editable Table */}
                <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, borderBottom: '1px solid #e2e8f0', zIndex: 1 }}>
                      <tr style={{ color: '#475569', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase' }}>
                        <th style={{ padding: '0.5rem 0.85rem', width: '60px' }}>#</th>
                        <th style={{ padding: '0.5rem 0.85rem' }}>Date & Day</th>
                        <th style={{ padding: '0.5rem 0.85rem', textAlign: 'right' }}>Approved Daily Allocation (MMBTU/Day)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transporterForm.daily_quantities && transporterForm.daily_quantities.length > 0 ? (
                        transporterForm.daily_quantities.map((item, idx) => (
                          <tr
                            key={item.date || idx}
                            style={{ borderBottom: '1px solid #f1f5f9' }}
                          >
                            <td style={{ padding: '0.45rem 0.85rem', color: '#64748b', fontWeight: 600 }}>#{idx + 1}</td>
                            <td style={{ padding: '0.45rem 0.85rem', fontWeight: 600, color: '#1e293b' }}>
                              <span>{formatScheduleDate(item.date)}</span>
                              <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginLeft: '0.4rem' }}>({item.date})</span>
                            </td>
                            <td style={{ padding: '0.35rem 0.85rem', textAlign: 'right' }}>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={item.quantity_mmbtu === '' ? '' : item.quantity_mmbtu}
                                onChange={(e) => handleUpdateTransporterDailyQuantity(item.date, e.target.value)}
                                style={{
                                  width: '140px',
                                  textAlign: 'right',
                                  padding: '0.3rem 0.5rem',
                                  borderRadius: '5px',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  color: '#00823b',
                                  background: '#ffffff'
                                }}
                              />
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>
                            No daily schedule dates available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setEditingCT(null)}
                  style={{ ...btnStyle, background: '#f1f5f9', color: '#475569' }}
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={() => handleApproveCT(editingCT)}
                  disabled={loading}
                  style={{ ...btnStyle, background: '#00823b', color: '#ffffff', fontWeight: 700 }}
                >
                  {loading ? 'Approving...' : '✓ Approve CT'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: View Full Details Modal */}
      {selectedCT && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalContainerStyle, maxWidth: '840px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={modalHeaderStyle}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                  Capacity Tranche Details ({selectedCT.ct_number})
                </h3>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  GTA: {selectedCT.gta_no || selectedCT.gta_number || '—'} · Status: {selectedCT.status || '—'}
                </div>
              </div>
              <button onClick={() => setSelectedCT(null)} style={closeBtnStyle}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Section 1: Customer */}
              <div style={sectionBoxStyle}>
                <div style={sectionTitleStyle}>1. Customer Request Parameters</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', fontSize: '0.8rem' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Associated GTA Agreement:</span>
                    <div style={{ fontWeight: 700, color: '#00823b' }}>{selectedCT.gta_no || selectedCT.gta_number || '—'}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Unified Path:</span>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{selectedCT.unified_path || '—'}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Sold To Party:</span>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{selectedCT.sold_to_party || '—'}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Delivery / Entry Point:</span>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{selectedCT.delivery_entry_point || selectedCT.unified_entry_point || '—'}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Exit Point:</span>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{selectedCT.new_exit_point || selectedCT.unified_exit_point || '—'}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Quantity:</span>
                    <div style={{ fontWeight: 700, color: '#00823b' }}>{selectedCT.quantity_mmbtu_day} MMBTU/Day</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Requested Period:</span>
                    <div style={{ fontWeight: 500, color: '#0f172a' }}>
                      {selectedCT.start_date || '—'} to {selectedCT.end_date || '—'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Transporter & GTA Association */}
              <div style={sectionBoxStyle}>
                <div style={sectionTitleStyle}>2. Transporter & GTA Association</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', fontSize: '0.8rem' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>GTA No:</span>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{selectedCT.gta_no || selectedCT.gta_number || '—'}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>GTA Date:</span>
                    <div style={{ fontWeight: 500, color: '#0f172a' }}>{selectedCT.gta_date || '—'}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>CT Created By:</span>
                    <div style={{ fontWeight: 500, color: '#0f172a' }}>{selectedCT.ct_created_by || selectedCT.user_email || '—'}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Approved Period:</span>
                    <div style={{ fontWeight: 500, color: '#0f172a' }}>
                      {selectedCT.approved_ct_start_date || selectedCT.start_date || '—'} to {selectedCT.approved_ct_end_date || selectedCT.end_date || '—'}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Approved Quantity:</span>
                    <div style={{ fontWeight: 800, color: '#00823b' }}>
                      {selectedCT.approved_quantity_mmbtu_day || selectedCT.quantity_mmbtu_day} MMBTU/Day
                    </div>
                  </div>
                  {selectedCT.sap_contract_id && (
                    <div>
                      <span style={{ color: '#64748b' }}>CT ID:</span>
                      <div style={{ fontWeight: 700, color: '#00823b' }}>{selectedCT.sap_contract_id}</div>
                    </div>
                  )}
                  <div>
                    <span style={{ color: '#64748b' }}>Over / Under Tolerance:</span>
                    <div style={{ fontWeight: 500, color: '#0f172a' }}>
                      +{selectedCT.overdelivery_tolerance || '0'}% / -{selectedCT.underdelivery_tolerance || '0'}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: UFT Tariff */}
              <div style={sectionBoxStyle}>
                <div style={sectionTitleStyle}>3. UFT Path Tariff Parameters</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', fontSize: '0.8rem' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>UFT Path Id:</span>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{selectedCT.uft_path_id || '—'}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Path Description:</span>
                    <div style={{ fontWeight: 500, color: '#0f172a' }}>{selectedCT.path_id_desc || '—'}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Zone (PNGRB):</span>
                    <div style={{ fontWeight: 500, color: '#0f172a' }}>{selectedCT.zone_pngrb || '—'}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Applicable Tariff:</span>
                    <div style={{ fontWeight: 700, color: '#00823b' }}>₹ {selectedCT.applicable_tariff_regime || '0.00'} / MMBTU</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>UFT Ratio:</span>
                    <div style={{ fontWeight: 500, color: '#0f172a' }}>{selectedCT.uft_ratio_pct || '0.00'}%</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Amt for Invoice / MMBtu:</span>
                    <div style={{ fontWeight: 800, color: '#00823b' }}>₹ {selectedCT.amt_for_invoice_per_mmbtu || '0.00'}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>IGGL Zonal Entity ID:</span>
                    <div style={{ fontWeight: 500, color: '#0f172a' }}>{selectedCT.iggl_zonal_entity_id || '—'}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Revenue Entitlement:</span>
                    <div style={{ fontWeight: 800, color: '#00823b' }}>₹ {selectedCT.revenue_entitlement || '0.00'} / Day</div>
                  </div>
                </div>
              </div>

              {/* Section 4: Daily Capacity Schedule Breakdown */}
              {selectedCT.daily_quantities && Array.isArray(selectedCT.daily_quantities) && selectedCT.daily_quantities.length > 0 && (
                <div style={sectionBoxStyle}>
                  <div style={{ ...sectionTitleStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <Calendar size={16} color="#00823b" />
                      <span>4. Daily Nomination Schedule ({selectedCT.daily_quantities.length} Days)</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#00823b' }}>
                      Total Volume: {selectedCT.daily_quantities.reduce((a, c) => a + (parseFloat(c.quantity_mmbtu) || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} MMBTU
                    </span>
                  </div>
                  <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                      <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, borderBottom: '1px solid #e2e8f0', zIndex: 1 }}>
                        <tr style={{ color: '#475569', textAlign: 'left' }}>
                          <th style={{ padding: '0.45rem 0.75rem', width: '60px' }}>#</th>
                          <th style={{ padding: '0.45rem 0.75rem' }}>Date & Day</th>
                          <th style={{ padding: '0.45rem 0.75rem', textAlign: 'right' }}>Daily MMBTU</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedCT.daily_quantities.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.45rem 0.75rem', color: '#64748b', fontWeight: 600 }}>#{idx + 1}</td>
                            <td style={{ padding: '0.45rem 0.75rem', fontWeight: 600, color: '#1e293b' }}>
                              <span>{formatScheduleDate(item.date)}</span>
                              <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginLeft: '0.4rem' }}>({item.date})</span>
                            </td>
                            <td style={{ padding: '0.45rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#00823b' }}>
                              {(parseFloat(item.quantity_mmbtu) || 0).toLocaleString()} MMBTU
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  onClick={() => setSelectedCT(null)}
                  style={{ ...btnStyle, background: '#f1f5f9', color: '#475569' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Clean styling constants
const badgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '0.2rem 0.55rem',
  borderRadius: '4px',
  fontSize: '0.72rem',
  fontWeight: 600
};

const statCardStyle = {
  background: '#ffffff',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  padding: '1rem 1.25rem'
};

const sectionBoxStyle = {
  background: '#f8fafc',
  borderRadius: '6px',
  border: '1px solid #e2e8f0',
  padding: '1rem 1.25rem'
};

const sectionTitleStyle = {
  fontSize: '0.825rem',
  fontWeight: 700,
  color: '#0f172a',
  marginBottom: '0.75rem',
  letterSpacing: '0.02em',
  textTransform: 'uppercase'
};

const labelStyle = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: '#475569',
  marginBottom: '0.25rem',
  display: 'block'
};

const inputStyle = {
  width: '100%',
  padding: '0.45rem 0.65rem',
  borderRadius: '6px',
  border: '1px solid #cbd5e1',
  fontSize: '0.8rem',
  background: '#ffffff',
  outline: 'none',
  boxSizing: 'border-box'
};

const readOnlyInputStyle = {
  width: '100%',
  padding: '0.45rem 0.65rem',
  borderRadius: '6px',
  border: '1px solid #e2e8f0',
  fontSize: '0.8rem',
  background: '#f1f5f9',
  color: '#334155',
  outline: 'none',
  boxSizing: 'border-box'
};

const btnStyle = {
  padding: '0.5rem 1rem',
  borderRadius: '6px',
  border: 'none',
  fontSize: '0.8rem',
  fontWeight: 600,
  cursor: 'pointer'
};

const modalOverlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(15, 23, 42, 0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: '1.5rem'
};

const modalContainerStyle = {
  background: '#ffffff',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  width: '100%',
  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
  overflow: 'hidden'
};

const modalHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '1rem 1.5rem',
  borderBottom: '1px solid #e2e8f0'
};

const closeBtnStyle = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: '#64748b'
};

export default CTManagement;
