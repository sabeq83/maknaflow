'use client';

import React, { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/Sidebar';

export default function ProductBridgeInjectPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [products, setProducts] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [isSchedulerActive, setIsSchedulerActive] = useState(true);
  const [terminalLogs, setTerminalLogs] = useState('');
  
  // Accordion form visibility
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('active'); // 'active' or 'draft'

  // Form input states
  const [accountName, setAccountName] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [brandProfiles, setBrandProfiles] = useState([]);
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [filterBrandId, setFilterBrandId] = useState('all');
  
  // Bulk Campaign State
  const [formMode, setFormMode] = useState('single'); // 'single' or 'bulk'
  const [parsedRows, setParsedRows] = useState([]);
  const [bulkCsvFileName, setBulkCsvFileName] = useState('');
  const [bulkCsvFile, setBulkCsvFile] = useState(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verifiedRows, setVerifiedRows] = useState([]);
  const [isVerificationComplete, setIsVerificationComplete] = useState(false);
  const [originalScript, setOriginalScript] = useState('');
  const [sourceMode, setSourceMode] = useState('select_existing');
  const [targetProductId, setTargetProductId] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [manualProductName, setManualProductName] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualUsp, setManualUsp] = useState('');
  const [productUrl, setProductUrl] = useState('');
  const [targetDemographic, setTargetDemographic] = useState('genz_casual');
  const [targetDemographicCustom, setTargetDemographicCustom] = useState('');
  const [customInstruction, setCustomInstruction] = useState('');
  const [enableVoAudit, setEnableVoAudit] = useState(1); // Default 1 (Yes)

  // Expandable campaign ID to show its Workbench
  const [expandedCampaignId, setExpandedCampaignId] = useState(null);

  // Edit states for currently expanded campaign
  const [vo1, setVo1] = useState('');
  const [vo2, setVo2] = useState('');
  const [vo3, setVo3] = useState('');
  const [vo4, setVo4] = useState('');
  const [t2iPrompt, setT2iPrompt] = useState('');
  const [i2vPrompt, setI2vPrompt] = useState('');
  const [savingTexts, setSavingTexts] = useState(false);

  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);

  // Expanded output
  const [activeOutput, setActiveOutput] = useState(null);

  // Action loaders
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const terminalRef = useRef(null);

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setFileSize(file.size);

    const reader = new FileReader();
    reader.onload = (event) => {
      setOriginalScript(event.target.result || '');
      showToast('Naskah markdown berhasil dibaca!');
    };
    reader.onerror = () => {
      showToast('Gagal membaca file markdown', 'error');
    };
    reader.readAsText(file);
  }

  const handleBulkFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBulkCsvFileName(file.name);
    setBulkCsvFile(file);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const XLSX = await import('xlsx');
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { defval: "" });

        const getRowVal = (row, aliases) => {
          for (const alias of aliases) {
            const key = Object.keys(row).find(k => k.trim().toLowerCase() === alias.trim().toLowerCase());
            if (key) return String(row[key]).trim();
          }
          return '';
        };

        const mapped = data.map((row, idx) => {
          return {
            row_number: idx + 1,
            original_script_url: getRowVal(row, [
              'url folder aset',
              'url folder asset',
              'folder aset',
              'folder asset',
              'url naskah.md',
              'url naskah',
              'naskah_url',
              'url_naskah',
              'script_url',
              'script url'
            ]),
            product_url: getRowVal(row, ['url produk', 'url_produk', 'produk_url', 'produk url', 'product_url', 'product url']),
            nextcloud_folder: getRowVal(row, ['folder nextcloud', 'nextcloud_folder', 'folder_nextcloud', 'nextcloud folder']),
            custom_instruction: getRowVal(row, ['custom_instruction', 'custom instruction', 'instruksi khusus', 'instruksi', 'catatan', 'instruction']),
            account_name: getRowVal(row, ['nama akun', 'akun brand', 'account_name', 'account name', 'brand_account', 'brand'])
          };
        });

        const validMapped = mapped.filter(r => r.original_script_url && r.product_url);
        if (validMapped.length === 0) {
          showToast('File tidak valid atau tidak memiliki kolom url folder aset dan url produk.', 'error');
          return;
        }

        setParsedRows(validMapped);
        showToast(`Berhasil membaca ${validMapped.length} baris dari file.`);

        // Lakukan pencocokan otomatis dengan database produk lokal untuk verifikasi manual
        const matched = validMapped.map(row => {
          const cleanUrl = (row.product_url || '').trim().toLowerCase().replace(/\/$/, "");
          const matchedProd = products.find(p => {
            const pUrl = (p.input_source || p.source_url || '').trim().toLowerCase().replace(/\/$/, "");
            return pUrl && pUrl === cleanUrl;
          });

          return {
            ...row,
            matched_product_name: matchedProd ? matchedProd.product_name : '⚠️ Tidak Ditemukan di Database (Mesin akan melakukan JIT)',
            matched_product_image: matchedProd ? matchedProd.photo_url : null,
            matched_product_id: matchedProd ? matchedProd.id : null,
            is_matched: !!matchedProd
          };
        });

        setVerifiedRows(matched);
        setIsVerificationComplete(false); // Kunci submit button sampai terkonfirmasi
      } catch (err) {
        showToast(`Gagal membaca file: ${err.message}`, 'error');
      }
    };
    reader.readAsBinaryString(file);
  };

  async function handleCreateBulkCampaign(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!campaignName.trim()) {
      showToast('Nama Kampanye wajib diisi.', 'error');
      return;
    }
    if (parsedRows.length === 0) {
      showToast('Silakan pilih/unggah file CSV/XLSX terlebih dahulu.', 'error');
      return;
    }

    setLoadingSetup(true);
    showToast('Mengimpor kampanye bulk ke database...', 'info');

    try {
      const res = await fetch('/api/v2/bridge-injector', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_name: campaignName,
          campaign_type: 'bulk',
          items: parsedRows,
          custom_instruction: customInstruction,
          enable_vo_audit: enableVoAudit,
          account_name: accountName,
          status: submitStatus === 'draft' ? 'draft' : 'active',
          brand_profile_id: selectedBrandId
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast('Kampanye bulk berhasil diluncurkan!');
        setCampaignName('');
        setParsedRows([]);
        setBulkCsvFileName('');
        setBulkCsvFile(null);
        setCustomInstruction('');
        setShowConfigForm(false);
        await fetchCampaigns();
      } else {
        showToast(data.error, 'error');
      }
    } catch (err) {
      showToast('Terjadi kesalahan koneksi', 'error');
    }
    setLoadingSetup(false);
  }

  function showToast(message, type = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  // Fetch initial logs, list campaigns, products
  useEffect(() => {
    fetchCampaigns();
    fetchProducts();
    fetchBrandProfiles();
    pollLogs();

    const logInterval = setInterval(pollLogs, 3000);
    const listInterval = setInterval(() => {
      fetchCampaigns(true);
    }, 5000);

    return () => {
      clearInterval(logInterval);
      clearInterval(listInterval);
    };
  }, []);

  // Scroll terminal logs automatically to the bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  async function fetchCampaigns(silent = false) {
    if (!silent) setLoadingList(true);
    try {
      const res = await fetch('/api/v2/bridge-injector');
      const data = await res.json();
      if (data.success) {
        setCampaigns(data.data);
        if (data.isSchedulerActive !== undefined) {
          setIsSchedulerActive(data.isSchedulerActive);
        }
      }
    } catch (err) {
      if (!silent) showToast('Gagal memuat riwayat kampanye', 'error');
    }
    if (!silent) setLoadingList(false);
  }

  async function fetchProducts() {
    try {
      const res = await fetch('/api/v2/products');
      const data = await res.json();
      if (data.success) {
        setProducts(data.data);
      }
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  }

  async function fetchBrandProfiles() {
    try {
      const res = await fetch('/api/v2/brand-profiles');
      const data = await res.json();
      if (data.success) {
        setBrandProfiles(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load brand profiles:', err);
    }
  }

  async function pollLogs() {
    try {
      const res = await fetch(`/api/system-logs?type=bridge_injector&t=${Date.now()}`);
      if (res.ok) {
        const text = await res.text();
        const lines = text.split('\n');
        const last200 = lines.slice(-200).join('\n');
        setTerminalLogs(last200 || 'Belum ada log aktivitas bridge injector.');
      }
    } catch (e) {
      // Ignore network errors
    }
  }

  async function toggleGlobalScheduler() {
    try {
      const res = await fetch('/api/v2/bridge-injector', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedulerActive: !isSchedulerActive })
      });
      const data = await res.json();
      if (data.success) {
        setIsSchedulerActive(!isSchedulerActive);
        showToast(`Skeduler berhasil ${!isSchedulerActive ? 'diaktifkan' : 'dimatikan'}`);
        pollLogs();
      }
    } catch (err) {
      showToast('Gagal mengubah status skeduler', 'error');
    }
  }

  async function handleToggleExpand(campaignId) {
    if (expandedCampaignId === campaignId) {
      setExpandedCampaignId(null);
      setActiveOutput(null);
      return;
    }

    try {
      const res = await fetch(`/api/v2/bridge-injector/${campaignId}`);
      const data = await res.json();
      if (data.success) {
        setExpandedCampaignId(campaignId);
        setActiveOutput(data.data.output);
        
        if (data.data.output) {
          setVo1(data.data.output.injected_vo_1 || '');
          setVo2(data.data.output.injected_vo_2 || '');
          setVo3(data.data.output.injected_vo_3 || '');
          setVo4(data.data.output.injected_vo_4 || '');
          setT2iPrompt(data.data.output.clip2_t2i_prompt || '');
          setI2vPrompt(data.data.output.clip2_i2v_prompt || '');
        }
      } else {
        showToast(data.error, 'error');
      }
    } catch (err) {
      showToast('Gagal memuat detail workbench', 'error');
    }
  }

  async function handleCreateCampaign(e) {
    e.preventDefault();
    setLoadingSetup(true);

    let finalBridgingMode = sourceMode;
    let finalTargetProductId = sourceMode === 'select_existing' ? targetProductId : null;
    let ephemeralData = null;

    if (sourceMode === 'manual_input') {
      ephemeralData = {
        product_name: manualProductName,
        product_description: manualDescription,
        unique_selling_point: manualUsp
      };
    } else if (sourceMode === 'url_extract') {
      ephemeralData = productUrl;

      // Cari apakah URL sudah ada di database produk lokal
      const sanitizedUrl = productUrl.trim().toLowerCase().replace(/\/$/, "");
      const matchedProduct = products.find(p => {
        // Kolom input_source atau source_url menyimpan URL asli produk
        const pUrl = (p.input_source || p.source_url || '').trim().toLowerCase().replace(/\/$/, "");
        return pUrl && pUrl === sanitizedUrl;
      });

      if (matchedProduct) {
        showToast(`Produk ditemukan di database: "${matchedProduct.product_name}". Menggunakan data eksis.`);
        finalBridgingMode = 'select_existing';
        finalTargetProductId = matchedProduct.id;
        ephemeralData = null;
      } else {
        const proceed = window.confirm("produk tidak ada didatabase, mesin akan melakukan JIT.");
        if (!proceed) {
          setLoadingSetup(false);
          return;
        }
      }
    }

    showToast('Memulai proses injeksi otonom Gemini...', 'info');

    try {
      const res = await fetch('/api/v2/bridge-injector', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_name: campaignName,
          original_script_md: originalScript,
          bridging_mode: finalBridgingMode,
          target_product_id: finalTargetProductId,
          ephemeral_product_data: ephemeralData,
          custom_instruction: customInstruction,
          enable_vo_audit: enableVoAudit,
          status: submitStatus === 'draft' ? 'draft' : 'active',
          brand_profile_id: selectedBrandId
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast('Naskah baru berhasil dirajut otonom!');
        setCampaignName('');
        setOriginalScript('');
        setFileName('');
        setFileSize(0);
        setTargetProductId('');
        setManualProductName('');
        setManualDescription('');
        setManualUsp('');
        setProductUrl('');
        setCustomInstruction('');
        setShowConfigForm(false);
        
        await fetchCampaigns();
        handleToggleExpand(data.data.campaign_id);
      } else {
        showToast(data.error, 'error');
      }
    } catch (err) {
      showToast('Terjadi kesalahan koneksi', 'error');
    }
    setLoadingSetup(false);
  }

  async function handleSaveChanges(campaignId) {
    setSavingTexts(true);
    try {
      const res = await fetch(`/api/v2/bridge-injector/${campaignId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          injected_vo_1: vo1,
          injected_vo_2: vo2,
          injected_vo_3: vo3,
          injected_vo_4: vo4,
          clip2_t2i_prompt: t2iPrompt,
          clip2_i2v_prompt: i2vPrompt
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Naskah & prompt berhasil disimpan!');
        pollLogs();
      } else {
        showToast(data.error, 'error');
      }
    } catch (err) {
      showToast('Gagal menyimpan perubahan naskah', 'error');
    }
    setSavingTexts(false);
  }

  async function handleGenerateStartFrame(campaignId) {
    setActionLoading(true);
    showToast('Mengirim tugas T2I ke G-Labs...', 'info');
    try {
      const res = await fetch('/api/v2/bridge-injector/generate-t2i', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Tugas T2I berhasil didaftarkan!');
        updateLocalCampaignStatus(campaignId, 'polling_t2i');
      } else {
        showToast(data.error, 'error');
      }
    } catch (err) {
      showToast('Gagal mengirim tugas T2I', 'error');
    }
    setActionLoading(false);
  }

  async function handleGenerateVideo(campaignId) {
    setActionLoading(true);
    showToast('Mengirim tugas I2V ke G-Labs...', 'info');
    try {
      const res = await fetch('/api/v2/bridge-injector/generate-i2v', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Tugas I2V berhasil didaftarkan!');
        updateLocalCampaignStatus(campaignId, 'generating_i2v');
      } else {
        showToast(data.error, 'error');
      }
    } catch (err) {
      showToast('Gagal mengirim tugas I2V', 'error');
    }
    setActionLoading(false);
  }

  async function handleDeleteCampaign(campaignId) {
    if (!confirm('Hapus kampanye bridging ini secara permanen?')) return;
    try {
      const res = await fetch(`/api/v2/bridge-injector/${campaignId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        showToast('Kampanye berhasil dihapus!');
        if (expandedCampaignId === campaignId) {
          setExpandedCampaignId(null);
          setActiveOutput(null);
        }
        fetchCampaigns();
      }
    } catch (err) {
      showToast('Gagal menghapus kampanye', 'error');
    }
  }

  async function handleSyncContentFlow(campaignId) {
    showToast('Menyinkronkan kampanye ke Content Flow...', 'info');
    try {
      const res = await fetch(`/api/v2/bridge-injector/${campaignId}/sync-contentflow`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Kampanye berhasil disinkronkan ke Content Flow!');
      } else {
        showToast(data.error || 'Gagal sinkronisasi Content Flow', 'error');
      }
    } catch (err) {
      showToast('Gagal menyinkronkan kampanye ke Content Flow', 'error');
    }
  }

  async function handleToggleCampaignStatus(campaign) {
    let nextStatus;
    if (campaign.status === 'draft') {
      nextStatus = 'running'; // Akan berlanjut ke status aktif bulk/single di backend
    } else {
      nextStatus = campaign.status === 'paused' ? 'running' : 'paused';
    }

    showToast(`Mengubah status kampanye ke ${nextStatus === 'running' ? 'aktif' : 'jeda'}...`, 'info');
    try {
      const res = await fetch(`/api/v2/bridge-injector/${campaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json();
      if (data.success) {
        showToast(campaign.status === 'draft' ? 'Kampanye berhasil dijalankan!' : `Kampanye berhasil ${nextStatus === 'running' ? 'dilanjutkan' : 'dijeda'}.`);
        await fetchCampaigns();
      } else {
        showToast(data.error || 'Gagal mengubah status kampanye', 'error');
      }
    } catch (err) {
      showToast('Gagal mengubah status kampanye', 'error');
    }
  }

  function updateLocalCampaignStatus(campaignId, status) {
    setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, status } : c));
    handleToggleExpand(campaignId); // Refresh output detail status
  }

  function getStatusBadgeStyle(status) {
    const styles = {
      draft: { color: '#9ca3af', bg: 'rgba(156, 163, 175, 0.12)' },
      paused: { color: '#fdcb6e', bg: 'rgba(253, 203, 110, 0.12)' },
      pending_storyboard: { color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.06)' },
      waiting_t2i: { color: '#fdcb6e', bg: 'rgba(253, 203, 110, 0.12)' },
      polling_t2i: { color: '#0984e3', bg: 'rgba(9, 132, 227, 0.12)' },
      waiting_user: { color: '#e17055', bg: 'rgba(225, 112, 85, 0.12)' },
      generating_i2v: { color: '#a29bfe', bg: 'rgba(162, 155, 254, 0.12)' },
      completed: { color: '#2ecc71', bg: 'rgba(46, 204, 113, 0.15)' },
      failed: { color: '#e74c3c', bg: 'rgba(231, 76, 60, 0.15)' }
    };
    return styles[status] || { color: 'var(--text-primary)', bg: 'rgba(255,255,255,0.1)' };
  }

  return (
    <div className="app-container" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-app)' }}>
      <Sidebar />
      
      <main className="main-content" style={{ flex: 1, padding: '24px 32px', overflowY: 'auto' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          
          {toast && (
            <div style={{
              position: 'fixed',
              top: '20px',
              right: '20px',
              zIndex: 9999,
              padding: '12px 24px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.88rem',
              fontWeight: 500,
              boxShadow: 'var(--shadow-lg)',
              background: toast.type === 'error' ? 'var(--danger)' : (toast.type === 'info' ? 'var(--accent)' : 'var(--success)'),
              color: '#fff',
              transition: 'all 0.3s ease'
            }}>
              {toast.type === 'error' ? '❌ ' : (toast.type === 'info' ? 'ℹ️ ' : '✅ ')} {toast.message}
            </div>
          )}

          {/* Verification Modal Popup */}
          {showVerificationModal && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(5px)',
              zIndex: 9998,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '20px'
            }}>
              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                width: '100%',
                maxWidth: '850px',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
              }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', padding: '16px 24px' }}>
                  <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🔍 Verifikasi Manual Produk (Bulk Matcher)
                  </h3>
                  <button 
                    onClick={() => setShowVerificationModal(false)}
                    style={{ border: 'none', background: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>

                {/* Content Area */}
                <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 0, marginBottom: '20px' }}>
                    Sistem mencocokkan URL produk dari CSV dengan database lokal. Silakan verifikasi kesesuaian gambar dan detail produk sebelum melanjutkan.
                  </p>

                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                        <th style={{ padding: '10px', color: 'var(--text-muted)' }}>Row</th>
                        <th style={{ padding: '10px', color: 'var(--text-muted)' }}>URL Produk (Trimmed)</th>
                        <th style={{ padding: '10px', color: 'var(--text-muted)' }}>Status Match</th>
                        <th style={{ padding: '10px', color: 'var(--text-muted)' }}>Produk Database</th>
                        <th style={{ padding: '10px', color: 'var(--text-muted)', textAlign: 'center' }}>Foto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {verifiedRows.map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '12px 10px', color: '#fff', fontWeight: 600 }}>{row.row_number}</td>
                          <td style={{ padding: '12px 10px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                            {row.product_url ? (row.product_url.length > 40 ? row.product_url.substring(0, 40) + '...' : row.product_url) : '-'}
                          </td>
                          <td style={{ padding: '12px 10px' }}>
                            {row.is_matched ? (
                              <span style={{ background: 'rgba(46, 204, 113, 0.15)', color: '#2ecc71', padding: '3px 8px', borderRadius: '4px', fontWeight: 700, fontSize: '0.7rem' }}>
                                MATCHED
                              </span>
                            ) : (
                              <span style={{ background: 'rgba(241, 196, 15, 0.15)', color: '#f1c40f', padding: '3px 8px', borderRadius: '4px', fontWeight: 700, fontSize: '0.7rem' }}>
                                UNMATCHED (JIT)
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '12px 10px', color: row.is_matched ? '#fff' : 'var(--text-muted)', fontWeight: row.is_matched ? 600 : 400 }}>
                            {row.matched_product_name}
                          </td>
                          <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                            {row.matched_product_image ? (
                              <img 
                                src={row.matched_product_image} 
                                alt={row.matched_product_name} 
                                style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border)' }} 
                              />
                            ) : (
                              <div style={{ width: '40px', height: '40px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', fontSize: '1rem', color: 'var(--text-muted)' }}>
                                📦
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer Buttons */}
                <div style={{ borderTop: '1px solid var(--border)', padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button 
                    type="button" 
                    onClick={() => setShowVerificationModal(false)}
                    className="btn btn-secondary"
                    style={{ padding: '8px 18px', fontSize: '0.8rem' }}
                  >
                    Batal
                  </button>
                  <button 
                    type="button" 
                    onClick={() => {
                      setIsVerificationComplete(true);
                      setShowVerificationModal(false);
                      showToast('Kesesuaian produk berhasil diverifikasi secara manual.');
                    }}
                    className="btn btn-success"
                    style={{ padding: '8px 24px', fontSize: '0.8rem', background: '#2ecc71', border: 'none', color: '#fff', fontWeight: 700 }}
                  >
                    💾 Simpan Verifikasi & Lanjutkan
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 1. Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.6rem', display: 'flex', alignItems: 'center', gap: '10px', color: '#fff' }}>
                🎯 Product Bridging Injector Lab
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '4px' }}>
                Sisipkan klip promosi produk baru ke dalam naskah lama (3 klip) secara otonom dan otomatis.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                type="button" 
                onClick={() => fetchCampaigns()} 
                className="btn btn-secondary"
                style={{ fontSize: '0.78rem', padding: '8px 14px' }}
              >
                🔄 Refresh Antrean
              </button>
              <button 
                type="button" 
                onClick={() => setShowConfigForm(v => !v)} 
                className="btn btn-primary"
                style={{ fontSize: '0.78rem', padding: '8px 14px', background: showConfigForm ? '#e74c3c' : 'var(--accent)', border: 'none' }}
              >
                {showConfigForm ? '✕ Tutup Form' : '➕ New Bridging Campaign'}
              </button>
            </div>
          </div>

          {/* 2. Global Scheduler Control Card */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '16px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '6px', color: '#fff' }}>
                ⚙️ Status Skeduler Bridging Injector
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                Mengontrol jalannya skeduler render visual dan download otomatis untuk klip 2 baru.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '4px 10px',
                borderRadius: '12px',
                background: isSchedulerActive ? 'rgba(46, 204, 113, 0.15)' : 'rgba(235, 77, 75, 0.15)',
                color: isSchedulerActive ? 'var(--success)' : 'var(--danger)',
                border: `1px solid ${isSchedulerActive ? 'rgba(46, 204, 113, 0.3)' : 'rgba(235, 77, 75, 0.3)'}`
              }}>
                {isSchedulerActive ? '🟢 SKEDULER AKTIF' : '🔴 SKEDULER MATI'}
              </span>
              <button
                type="button"
                onClick={toggleGlobalScheduler}
                className={`btn ${isSchedulerActive ? 'btn-danger' : 'btn-success'}`}
                style={{
                  fontSize: '0.8rem',
                  padding: '6px 16px',
                  fontWeight: 600,
                  boxShadow: isSchedulerActive ? '0 0 15px rgba(235, 77, 75, 0.4)' : '0 0 15px rgba(46, 204, 113, 0.4)',
                  border: isSchedulerActive ? '1px solid rgba(235, 77, 75, 0.6)' : '1px solid rgba(46, 204, 113, 0.6)'
                }}
              >
                {isSchedulerActive ? '🛑 STOP SKEDULER' : '▶️ START SKEDULER'}
              </button>
            </div>
          </div>

          {/* 3. Activity Terminal (System Poller Logger) */}
          <div className="card" style={{ padding: '0', background: '#07070a', border: '1px solid var(--border)', marginBottom: '24px' }}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0b0b12' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#00b894', display: 'inline-block', boxShadow: '0 0 8px #00b894' }}></span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)' }}>SYSTEM POLLER LOGGER</span>
              </div>
              <button 
                onClick={pollLogs} 
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
              >
                [Refresh Log]
              </button>
            </div>
            <pre 
              ref={terminalRef}
              style={{ 
                margin: 0, 
                padding: '20px', 
                background: '#07070a', 
                color: '#20c20e', 
                fontFamily: 'var(--font-mono)', 
                fontSize: '0.82rem', 
                maxHeight: '180px', 
                overflowY: 'auto', 
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap'
              }}
            >
              {terminalLogs}
            </pre>
          </div>

          {showConfigForm && (
            <div className="card" style={{ marginBottom: '24px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '14px', marginBottom: '18px' }}>
                <strong style={{ fontSize: '0.95rem', color: '#fff' }}>⚙️ Form Konfigurasi Bridging Baru</strong>
              </div>

              {/* Form Mode Tabs */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={() => setFormMode('single')}
                  style={{
                    flex: 1,
                    padding: '8px 16px',
                    borderRadius: '4px',
                    border: '1px solid var(--border)',
                    background: formMode === 'single' ? 'var(--accent)' : 'transparent',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  👤 Single Production
                </button>
                <button
                  type="button"
                  onClick={() => setFormMode('bulk')}
                  style={{
                    flex: 1,
                    padding: '8px 16px',
                    borderRadius: '4px',
                    border: '1px solid var(--border)',
                    background: formMode === 'bulk' ? 'var(--accent)' : 'transparent',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  👥 Bulk Production (CSV/XLSX)
                </button>
              </div>

              {formMode === 'single' ? (
                <form onSubmit={handleCreateCampaign} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div className="form-group">
                        <label className="form-label">🏷️ Nama Akun (Brand Account)</label>
                        <select
                          className="form-input"
                          value={accountName}
                          onChange={e => {
                            const newAcc = e.target.value;
                            setAccountName(newAcc);
                            const now = new Date();
                            const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
                            setCampaignName(`[ BRIDGE ${dateStr} ] - ${newAcc ? newAcc + ' - ' : ''}`);
                          }}
                          style={{ background: 'var(--bg-primary)' }}
                        >
                          <option value="">-- Pilih Nama Akun Brand --</option>
                          {brandProfiles.map(bp => (
                            <option key={bp.id} value={bp.account_name || bp.brand_name}>
                              {bp.brand_name} ({bp.account_name || bp.brand_name})
                            </option>
                          ))}
                          <option value="nutribake">nutribake</option>
                          <option value="siasatsehat">siasatsehat</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Nama Kampanye Bridging</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Contoh: Inject Madu ke Video Diet Viral"
                          value={campaignName}
                          onChange={e => setCampaignName(e.target.value)}
                          required
                        />
                      </div>

                      {brandProfiles.length > 0 && (
                        <div className="form-group">
                          <label className="form-label">🧬 Brand Profile (Opsional)</label>
                          <select
                            className="form-input"
                            value={selectedBrandId}
                            onChange={e => setSelectedBrandId(e.target.value)}
                          >
                            <option value="">-- Tanpa Brand (Generik) --</option>
                            {brandProfiles.map(bp => (
                              <option key={bp.id} value={bp.id}>
                                {bp.brand_name} ({bp.tone_of_voice})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="form-group">
                        <label className="form-label">Metode Sourcing Produk</label>
                        <select
                          className="form-input"
                          value={sourceMode}
                          onChange={e => setSourceMode(e.target.value)}
                          style={{ background: 'var(--bg-primary)' }}
                        >
                          <option value="select_existing">Pilih dari Pustaka Produk</option>
                          <option value="manual_input">Tulis Detail Manual</option>
                          <option value="url_extract">Ekstrak Otomatis via URL</option>
                        </select>
                      </div>

                      {sourceMode === 'select_existing' && (
                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <label className="form-label">Pilih Produk Terdaftar</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Cari nama produk di pustaka..."
                            value={productSearchQuery}
                            onChange={e => setProductSearchQuery(e.target.value)}
                            style={{ background: 'var(--bg-primary)', marginBottom: '4px' }}
                          />
                          <select
                            className="form-input"
                            value={targetProductId}
                            onChange={e => setTargetProductId(e.target.value)}
                            style={{ background: 'var(--bg-primary)' }}
                            required
                          >
                            <option value="">-- Pilih Produk --</option>
                            {products
                              .filter(p =>
                                (p.product_name || '').toLowerCase().includes(productSearchQuery.toLowerCase()) ||
                                (p.brand_name || '').toLowerCase().includes(productSearchQuery.toLowerCase())
                              )
                              .map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.brand_name ? `${p.brand_name} - ` : ''}{p.product_name}
                                </option>
                              ))}
                          </select>
                          {targetProductId && (() => {
                            const sel = products.find(p => String(p.id) === String(targetProductId));
                            if (!sel) return null;
                            const img = sel.photo_url || sel.clean_photo_url || sel.generated_photo_url || sel.raw_photo_url;
                            const fname = sel.filename_declare || (sel.product_name ? `${sel.product_name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_ref.jpg` : 'product_ref.jpg');
                            return (
                              <div style={{ marginTop: 8, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: 10, borderRadius: 8 }}>
                                <div style={{ color: '#10b981', fontWeight: 600, fontSize: '0.8rem' }}>
                                  ✨ Foto Produk & Deklarasi Mandate 88 Otomatis Terhubung dari Database
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                                  {img && <img src={img} alt="Product Ref" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }} />}
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-primary)' }}>
                                    <div><b>Deklarasi Filename:</b> <code>{fname}</code></div>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {sourceMode === 'manual_input' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(255,255,255,0.01)', padding: '16px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                          <div className="form-group">
                            <label className="form-label">Nama Produk</label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Contoh: Madu Hutan Murni"
                              value={manualProductName}
                              onChange={e => setManualProductName(e.target.value)}
                              required
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Deskripsi Produk</label>
                            <textarea
                              className="form-input"
                              rows="2"
                              placeholder="Detail kegunaan produk..."
                              value={manualDescription}
                              onChange={e => setManualDescription(e.target.value)}
                              required
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">USP (Unique Selling Point)</label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Meningkatkan stamina, 100% organik"
                              value={manualUsp}
                              onChange={e => setManualUsp(e.target.value)}
                              required
                            />
                          </div>
                        </div>
                      )}

                      {sourceMode === 'url_extract' && (
                        <div className="form-group">
                          <label className="form-label">URL Halaman Produk</label>
                          <input
                            type="url"
                            className="form-input"
                            placeholder="https://toko.com/produk-madu"
                            value={productUrl}
                            onChange={e => setProductUrl(e.target.value)}
                            required
                          />
                        </div>
                      )}
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="md-file-input">Unggah Naskah Asli (.md)</label>
                      <input
                        id="md-file-input"
                        type="file"
                        className="form-input"
                        accept=".md"
                        onChange={handleFileUpload}
                        required
                        style={{ padding: '8px', cursor: 'pointer' }}
                      />
                      {fileName && (
                        <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>📄 File terpilih:</span> <strong>{fileName}</strong> <span style={{ color: 'var(--text-secondary)' }}>({fileSize} bytes)</span>
                        </div>
                      )}
                      {originalScript && (
                        <div style={{
                          marginTop: '8px',
                          padding: '10px',
                          background: 'rgba(255,255,255,0.03)',
                          borderRadius: '4px',
                          border: '1px dashed var(--border)',
                          maxHeight: '120px',
                          overflowY: 'auto',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.75rem',
                          color: 'var(--text-secondary)',
                          whiteSpace: 'pre-wrap'
                        }}>
                          {originalScript.slice(0, 300) + (originalScript.length > 300 ? '...' : '')}
                        </div>
                      )}
                    </div>

                  </div>

                  <div className="form-group" style={{ marginTop: '4px' }}>
                    <label className="form-label">Audit Kepatuhan TikTok Safe</label>
                    <select
                      className="form-input"
                      value={enableVoAudit}
                      onChange={e => setEnableVoAudit(Number(e.target.value))}
                      style={{ background: 'var(--bg-primary)' }}
                    >
                      <option value={1}>✅ Yes (Audit Compliance & Render 2 Versi VO)</option>
                      <option value={0}>❌ No (Tanpa Audit Compliance)</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginTop: '4px' }}>
                    <label className="form-label">Custom Instruction (Instruksi Khusus untuk Gemini AI)</label>
                    <textarea
                      className="form-input"
                      rows="3"
                      placeholder="Catatan tambahan untuk mengontrol gaya bahasa, visual prompt, dsb... (Opsional)"
                      value={customInstruction}
                      onChange={e => setCustomInstruction(e.target.value)}
                      style={{ background: 'var(--bg-primary)' }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button 
                      type="submit" 
                      onClick={() => setSubmitStatus('draft')} 
                      className="btn" 
                      style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.25)', padding: '10px 24px' }} 
                      disabled={loadingSetup}
                    >
                      💾 Save as Draft
                    </button>
                    <button 
                      type="submit" 
                      onClick={() => setSubmitStatus('active')} 
                      className="btn btn-primary" 
                      style={{ padding: '10px 24px' }} 
                      disabled={loadingSetup}
                    >
                      {loadingSetup ? '⏳ Sedang Merajut Naskah...' : '⚡ Proses Injeksi Awal'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleCreateBulkCampaign} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">🏷️ Nama Akun (Brand Account) - Global Fallback</label>
                    <select
                      className="form-input"
                      value={accountName}
                      onChange={e => setAccountName(e.target.value)}
                      style={{ background: 'var(--bg-primary)' }}
                    >
                      <option value="">-- Pilih Nama Akun Brand --</option>
                      {brandProfiles.map(bp => (
                        <option key={bp.id} value={bp.account_name || bp.brand_name}>
                          {bp.brand_name} ({bp.account_name || bp.brand_name})
                        </option>
                      ))}
                      <option value="nutribake">nutribake</option>
                      <option value="siasatsehat">siasatsehat</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Nama Kampanye Bridging Massal</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Contoh: Kampanye Bulk Bridging Madu v1"
                      value={campaignName}
                      onChange={e => setCampaignName(e.target.value)}
                      required
                    />
                  </div>

                  {brandProfiles.length > 0 && (
                    <div className="form-group">
                      <label className="form-label">🧬 Brand Profile (Opsional)</label>
                      <select
                        className="form-input"
                        value={selectedBrandId}
                        onChange={e => setSelectedBrandId(e.target.value)}
                      >
                        <option value="">-- Tanpa Brand (Generik) --</option>
                        {brandProfiles.map(bp => (
                          <option key={bp.id} value={bp.id}>
                            {bp.brand_name} ({bp.tone_of_voice})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="form-group" style={{ 
                    border: '2px dashed var(--border)', 
                    borderRadius: 'var(--radius-sm)', 
                    padding: '24px', 
                    textAlign: 'center',
                    background: 'rgba(255,255,255,0.01)',
                    position: 'relative'
                  }}>
                    <input 
                      type="file" 
                      accept=".csv,.xlsx" 
                      onChange={handleBulkFileUpload}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        opacity: 0,
                        cursor: 'pointer',
                        zIndex: 2
                      }}
                    />
                    <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>📥</div>
                    <div style={{ fontWeight: 500, color: '#fff', marginBottom: '4px' }}>
                      {bulkCsvFileName ? `File terpilih: ${bulkCsvFileName}` : 'Seret & Lepas file .csv atau .xlsx Anda di sini'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Atau klik untuk menelusuri berkas dari komputer Anda
                    </div>
                    <div style={{ marginTop: '12px', position: 'relative', zIndex: 3 }}>
                      <a 
                        href="/bridge_bulk_template.csv" 
                        download
                        style={{ fontSize: '0.78rem', color: 'var(--accent-light)', textDecoration: 'underline' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        📥 Unduh Template CSV Bridging Massal
                      </a>
                    </div>
                  </div>

                  {parsedRows.length > 0 && (
                    <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '4px', background: 'rgba(0,0,0,0.2)' }}>
                      <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '8px 12px' }}>No</th>
                            <th style={{ padding: '8px 12px' }}>URL Folder Aset</th>
                            <th style={{ padding: '8px 12px' }}>URL Produk</th>
                            <th style={{ padding: '8px 12px' }}>Folder Nextcloud</th>
                            <th style={{ padding: '8px 12px' }}>Akun Brand (Row)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsedRows.map((row, index) => (
                            <tr key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                              <td style={{ padding: '6px 12px' }}>{row.row_number}</td>
                              <td style={{ padding: '6px 12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>{row.original_script_url}</td>
                              <td style={{ padding: '6px 12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>{row.product_url}</td>
                              <td style={{ padding: '6px 12px' }}>{row.nextcloud_folder}</td>
                              <td style={{ padding: '6px 12px' }}>{row.account_name || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="form-group" style={{ marginTop: '16px' }}>
                    <label className="form-label">Global Custom Instruction (Instruksi Khusus untuk Seluruh Baris Kampanye)</label>
                    <textarea
                      className="form-input"
                      rows="3"
                      placeholder="Catatan tambahan untuk mengontrol gaya bahasa, visual prompt, dsb... (Opsional)"
                      value={customInstruction}
                      onChange={e => setCustomInstruction(e.target.value)}
                      style={{ background: 'var(--bg-primary)' }}
                    />
                  </div>

                  {parsedRows.length > 0 && !isVerificationComplete && (
                    <div style={{ display: 'flex', justifyContent: 'center', margin: '14px 0' }}>
                      <button
                        type="button"
                        onClick={() => setShowVerificationModal(true)}
                        className="btn btn-warning"
                        style={{ padding: '12px 30px', fontWeight: 700, fontSize: '0.9rem', width: '100%', boxShadow: '0 0 15px rgba(241, 196, 15, 0.2)' }}
                      >
                        🔍 Verifikasi Produk Massal ({parsedRows.length} item)
                      </button>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button 
                      type="submit" 
                      onClick={() => setSubmitStatus('draft')} 
                      className="btn" 
                      style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.25)', padding: '10px 24px', opacity: isVerificationComplete ? 1 : 0.4 }} 
                      disabled={loadingSetup || !isVerificationComplete}
                    >
                      💾 Save as Draft
                    </button>
                    <button 
                      type="submit" 
                      onClick={() => setSubmitStatus('active')} 
                      className="btn btn-primary" 
                      style={{ padding: '10px 24px', opacity: isVerificationComplete ? 1 : 0.4 }} 
                      disabled={loadingSetup || !isVerificationComplete}
                    >
                      {loadingSetup ? '⏳ Sedang Mengimpor...' : '⚡ Luncurkan Kampanye Massal'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* 5. Campaign Queue (Riwayat Kampanye) - Expandable Vertical List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12
            }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff' }}>📁 Daftar Antrean & Status Kampanye</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>🔍 FILTER BRAND:</span>
                <select
                  value={filterBrandId}
                  onChange={e => setFilterBrandId(e.target.value)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 600
                  }}
                >
                  <option value="all">Semua Brand</option>
                  {brandProfiles.map(bp => (
                    <option key={bp.id} value={bp.id}>{bp.brand_name}</option>
                  ))}
                </select>
              </div>
            </div>
            
            {loadingList && campaigns.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Memuat daftar kampanye...</p>
            ) : campaigns.filter(c => filterBrandId === 'all' || c.brand_profile_id === filterBrandId).length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Tidak ada kampanye yang cocok dengan filter brand ini.</p>
            ) : (
              campaigns
                .filter(c => filterBrandId === 'all' || c.brand_profile_id === filterBrandId)
                .map(c => {
                const isExpanded = expandedCampaignId === c.id;
                const badge = getStatusBadgeStyle(c.status);
                
                return (
                  <div 
                    key={c.id} 
                    style={{
                      background: 'var(--bg-card)',
                      border: `1px solid ${isExpanded ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden',
                      transition: 'all 0.25s ease'
                    }}
                  >
                    
                    {/* Header Row */}
                    <div 
                      onClick={() => {
                        if (c.campaign_type === 'bulk') {
                          window.location.href = `/product-bridge-inject/${c.id}`;
                        } else {
                          handleToggleExpand(c.id);
                        }
                      }}
                      style={{
                        padding: '16px 20px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        background: isExpanded ? 'rgba(52, 152, 219, 0.04)' : 'transparent',
                        transition: 'background 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <span style={{ fontSize: '1.2rem' }}>
                          {c.campaign_type === 'bulk' ? '🔗' : (isExpanded ? '▼' : '▶')}
                        </span>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              background: c.brand_name ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                              border: c.brand_name ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
                              color: c.brand_name ? '#d8b4fe' : 'var(--text-muted)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              🏷️ Brand: {c.brand_name || 'Tidak Ditentukan'}
                            </span>
                          </div>
                          <strong style={{ fontSize: '0.95rem', color: '#fff' }}>{c.campaign_name}</strong>
                          {c.campaign_type === 'bulk' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                              <span style={{
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                background: 'rgba(108, 92, 231, 0.2)',
                                border: '1px solid var(--accent)',
                                color: 'var(--accent-light)',
                                padding: '1px 5px',
                                borderRadius: '4px'
                              }}>BULK</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                Progress: <strong>{c.completed_items || 0} / {c.total_items || 0}</strong> Baris Selesai | ID: <span style={{ fontFamily: 'var(--font-mono)' }}>{c.id}</span>
                              </span>
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                              🔑 ID: <span style={{ fontFamily: 'var(--font-mono)' }}>{c.id}</span> | Produk: {c.product_name || 'Input Manual/URL'}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {c.status === 'draft' ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleToggleCampaignStatus(c); }}
                            className="btn btn-success"
                            style={{
                              fontSize: '0.7rem',
                              padding: '4px 10px',
                              borderRadius: '4px',
                              fontWeight: 700,
                              background: '#2ecc71',
                              border: 'none',
                              color: '#fff',
                              cursor: 'pointer'
                            }}
                          >
                            ▶️ Run
                          </button>
                        ) : (c.status !== 'completed' && c.status !== 'failed' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleToggleCampaignStatus(c); }}
                            className="btn"
                            style={{
                              fontSize: '0.7rem',
                              padding: '4px 10px',
                              borderRadius: '4px',
                              fontWeight: 700,
                              background: c.status === 'paused' ? '#2ecc71' : '#f1c40f',
                              border: 'none',
                              color: '#000',
                              cursor: 'pointer'
                            }}
                          >
                            {c.status === 'paused' ? '▶️ Resume' : '⏸️ Pause'}
                          </button>
                        ))}

                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: '12px',
                          background: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.color}33`
                        }}>
                          {c.status.toUpperCase()}
                        </span>

                        {(c.status === 'completed' || c.campaign_type === 'bulk') && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleSyncContentFlow(c.id); }}
                            title="Push ke Content Flow"
                            style={{
                              background: 'rgba(52, 152, 219, 0.1)',
                              border: '1px solid var(--accent-light)',
                              color: 'var(--accent-light)',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              padding: '3px 8px',
                              borderRadius: '4px'
                            }}
                          >
                            🔄 Sync Content Flow
                          </button>
                        )}

                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteCampaign(c.id); }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--danger)',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            padding: '4px'
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {/* Expandable Workbench Editor Area */}
                    {isExpanded && activeOutput && (
                      <div style={{
                        padding: '24px',
                        borderTop: '1px solid var(--border)',
                        background: 'rgba(0, 0, 0, 0.15)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px'
                      }}>
                        
                        {/* 4 Storyboard Clips in a clean grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                          
                          {/* Klip 1 */}
                          <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--accent-light)', marginBottom: '8px' }}>
                              🎬 KLIP 1: HOOK (ORIGINAL)
                            </div>
                            <textarea
                              className="form-input"
                              rows="4"
                              value={vo1}
                              onChange={e => setVo1(e.target.value)}
                              style={{ fontSize: '0.82rem', lineHeight: '1.4' }}
                            />
                          </div>

                          {/* Klip 2 (Injected Product) */}
                          <div style={{
                            background: 'var(--bg-primary)',
                            padding: '16px',
                            borderRadius: 'var(--radius-sm)',
                            border: '2px solid #2ecc71',
                            boxShadow: '0 0 12px rgba(46, 204, 113, 0.08)'
                          }}>
                            <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#2ecc71', marginBottom: '8px' }}>
                              ✨ KLIP 2: PRODUCT INSERTION (NEW)
                            </div>

                            {/* Start Frame Image Preview */}
                            <div style={{
                              width: '100%',
                              height: '180px',
                              background: '#0a0a0e',
                              borderRadius: '4px',
                              border: '1px solid var(--border)',
                              marginBottom: '10px',
                              display: 'flex',
                              justifyContent: 'center',
                              alignItems: 'center',
                              overflow: 'hidden',
                              position: 'relative'
                            }}>
                              {activeOutput.clip2_t2i_image_path ? (
                                <img
                                  src={activeOutput.clip2_t2i_image_path}
                                  alt="Start Frame"
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                              ) : c.status === 'polling_t2i' ? (
                                <div style={{ textAlign: 'center' }}>
                                  <div className="spinner" />
                                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Menge-render Start Frame...</span>
                                </div>
                              ) : (
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Belum ada gambar acuan (Start Frame)</span>
                              )}
                            </div>

                            <textarea
                              className="form-input"
                              rows="3"
                              value={vo2}
                              onChange={e => setVo2(e.target.value)}
                              style={{ fontSize: '0.82rem', lineHeight: '1.4', fontWeight: 'bold', marginBottom: '10px' }}
                            />

                            <div className="form-group" style={{ marginBottom: '8px' }}>
                              <label className="form-label" style={{ fontSize: '0.7rem' }}>T2I Prompt (Start Frame)</label>
                              <input
                                type="text"
                                className="form-input"
                                value={t2iPrompt}
                                onChange={e => setT2iPrompt(e.target.value)}
                                style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}
                              />
                            </div>

                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '0.7rem' }}>I2V Prompt (Video Animation)</label>
                              <input
                                type="text"
                                className="form-input"
                                value={i2vPrompt}
                                onChange={e => setI2vPrompt(e.target.value)}
                                style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}
                              />
                            </div>
                          </div>

                          {/* Klip 3 */}
                          <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--accent-light)', marginBottom: '8px' }}>
                              🎬 KLIP 3: CONTINUATION
                            </div>
                            <textarea
                              className="form-input"
                              rows="4"
                              value={vo3}
                              onChange={e => setVo3(e.target.value)}
                              style={{ fontSize: '0.82rem', lineHeight: '1.4' }}
                            />
                          </div>

                          {/* Klip 4 */}
                          <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--accent-light)', marginBottom: '8px' }}>
                              🎬 KLIP 4: CTA (RESOLUTION)
                            </div>
                            <textarea
                              className="form-input"
                              rows="4"
                              value={vo4}
                              onChange={e => setVo4(e.target.value)}
                              style={{ fontSize: '0.82rem', lineHeight: '1.4' }}
                            />
                          </div>

                        </div>

                        {/* Interactive Action Controls */}
                        <div style={{
                          borderTop: '1px solid var(--border)',
                          paddingTop: '20px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '16px'
                        }}>
                          
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => handleSaveChanges(c.id)}
                              disabled={savingTexts}
                            >
                              {savingTexts ? '⏳ Menyimpan...' : '💾 Simpan Perubahan Teks'}
                            </button>
                            
                            {activeOutput.injected_script_md_path && (
                              <a
                                href={activeOutput.injected_script_md_path}
                                download="naskah_bridging.md"
                                className="btn btn-secondary"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
                              >
                                📥 Unduh Naskah (.MD)
                              </a>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            {c.status === 'waiting_t2i' && (
                              <button
                                type="button"
                                className="btn btn-success"
                                onClick={() => handleGenerateStartFrame(c.id)}
                                disabled={actionLoading}
                              >
                                📷 Generate Start Frame (T2I)
                              </button>
                            )}

                            {c.status === 'waiting_user' && (
                              <button
                                type="button"
                                className="btn btn-success"
                                onClick={() => handleGenerateVideo(c.id)}
                                disabled={actionLoading}
                              >
                                🎥 Generate Video Klip 2 (I2V)
                              </button>
                            )}

                            {c.status === 'generating_i2v' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                                <div className="spinner" />
                                <span>Menge-render Video G-Labs...</span>
                              </div>
                            )}
                          </div>

                        </div>

                        {/* HD Video output segment */}
                        {activeOutput.clip2_video_path && (
                          <div style={{
                            padding: '16px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'rgba(46, 204, 113, 0.06)',
                            border: '1px solid rgba(46, 204, 113, 0.2)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '16px'
                          }}>
                            <div>
                              <h4 style={{ margin: '0 0 4px 0', color: '#2ecc71' }}>🎉 Klip 2 Baru Berhasil Dirender!</h4>
                              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                Unduh file video berkualitas HD ini dan sisipkan ke posisi track ke-2 di timeline CapCut Anda.
                              </p>
                            </div>
                            
                            <a
                              href={activeOutput.clip2_video_path}
                              download="clip2_video.mp4"
                              className="btn btn-primary"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
                            >
                              📥 Unduh Klip .MP4
                            </a>
                          </div>
                        )}

                      </div>
                    )}
                  </div>
                );
              })
            )}

          </div>

        </div>
      </main>

      {/* Embedded Spinner CSS */}
      <style jsx global>{`
        .spinner {
          border: 3px solid rgba(255,255,255,0.1);
          border-top: 3px solid var(--accent);
          borderRadius: 50%;
          width: 30px;
          height: 30px;
          animation: spin 1s linear infinite;
          margin: 0 auto 10px auto;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

    </div>
  );
}
