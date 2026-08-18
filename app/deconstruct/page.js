'use client';

import Sidebar from '../components/Sidebar';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function DeconstructPage() {
  const router = useRouter();

  // Library state
  const [assets, setAssets] = useState([]);
  const [niches, setNiches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [pages, setPages] = useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNiche, setSelectedNiche] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Form Modals
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showEnqueueModal, setShowEnqueueModal] = useState(false);

  // Save Form States
  const [nicheInput, setNicheInput] = useState('');
  const [urlsInput, setUrlsInput] = useState('');
  const [captionsInput, setCaptionsInput] = useState('');
  const [inputMode, setInputMode] = useState('manual'); // 'manual' | 'csv'
  const [csvFile, setCsvFile] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [csvDebug, setCsvDebug] = useState(null);

  // Enqueue Config
  const [recommCount, setRecommCount] = useState(3);
  
  // UI States
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const pollingRef = useRef(null);
  const csvRef = useRef(null);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  // --- Data Fetching ---
  async function fetchLibrary(silent = false) {
    if (!silent) setLoading(true);
    try {
      const query = new URLSearchParams({
        q: searchQuery,
        niche: selectedNiche,
        status: selectedStatus,
        page: page.toString(),
        limit: limit.toString()
      });
      const res = await fetch(`/api/v2/deconstruct?${query.toString()}`);
      const data = await res.json();
      if (data.success) {
        setAssets(data.assets || []);
        setNiches(data.niches || []);
        if (data.pagination) {
          setTotal(data.pagination.total);
          setPages(data.pagination.pages);
        }
      } else {
        if (!silent) showToast(data.error || 'Gagal memuat pustaka URL', 'error');
      }
    } catch (err) {
      if (!silent) showToast('Gagal memuat data dari server', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    fetchLibrary();
  }, [searchQuery, selectedNiche, selectedStatus, page]);

  // Polling logic for actively downloading, uploading, or analyzing assets
  useEffect(() => {
    const hasActiveProcess = assets.some(a =>
      ['pending_download', 'downloading', 'uploading', 'analyzing'].includes(a.status)
    );

    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    if (hasActiveProcess) {
      pollingRef.current = setInterval(() => {
        fetchLibrary(true);
      }, 4000);
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [assets]);

  // --- CSV Parser ---
  function handleCsvUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (evt) => {
      let text = evt.target.result.replace(/^\uFEFF/, '');
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) {
        showToast('CSV harus memiliki header dan minimal 1 baris data', 'error');
        return;
      }

      const headerLine = lines[0];
      const commaCount = (headerLine.match(/,/g) || []).length;
      const semicolonCount = (headerLine.match(/;/g) || []).length;
      const delimiter = semicolonCount > commaCount ? ';' : ',';

      const headerRaw = parseCSVLine(headerLine, delimiter);
      const header = headerRaw.map(h => h.toLowerCase().trim().replace(/"/g, '').replace(/\s+/g, '_'));

      const urlIdx = header.findIndex(h =>
        h === 'url' || h === 'video_url' || h === 'link' ||
        (h.includes('url') && !h.includes('caption')) ||
        (h.includes('link') && !h.includes('caption'))
      );
      const captionIdx = header.findIndex(h =>
        h === 'caption' || h === 'caption_ori' || h === 'original_caption' ||
        h.includes('caption')
      );

      if (urlIdx === -1) {
        showToast(`Kolom URL tidak ditemukan. Header: [${headerRaw.join(' | ')}]`, 'error');
        return;
      }

      const rows = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i], delimiter);
        const url = (cols[urlIdx] || '').trim();
        if (!url) continue;
        rows.push({
          url,
          caption: captionIdx !== -1 && captionIdx !== urlIdx ? (cols[captionIdx] || '').trim() : ''
        });
      }

      setCsvData(rows);
      setCsvDebug({
        headers: headerRaw,
        urlCol: headerRaw[urlIdx] || '—',
        captionCol: captionIdx !== -1 ? headerRaw[captionIdx] : '(tidak ada)',
        delimiter
      });
      showToast(`${rows.length} video berhasil dimuat.`);
    };
    reader.readAsText(file);
  }

  function parseCSVLine(line, delimiter = ',') {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === delimiter && !inQuotes) {
        result.push(current);
        current = '';
        continue;
      }
      current += ch;
    }
    result.push(current);
    return result;
  }

  // --- Actions ---
  async function handleSaveUrls(e) {
    e.preventDefault();
    if (!nicheInput.trim()) {
      showToast('Niche wajib diisi', 'error');
      return;
    }

    const body = { niche: nicheInput.trim() };
    if (inputMode === 'csv') {
      if (csvData.length === 0) {
        showToast('Unggah CSV yang valid terlebih dahulu', 'error');
        return;
      }
      body.csv_data = csvData;
    } else {
      if (!urlsInput.trim()) {
        showToast('Setidaknya satu URL wajib diisi', 'error');
        return;
      }
      body.urls = urlsInput;
      body.captions = captionsInput;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/v2/deconstruct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Berhasil menyimpan ke Library! ${data.saved_count} baru, ${data.duplicate_count} duplikat diabaikan.`);
        setShowSaveModal(false);
        setNicheInput('');
        setUrlsInput('');
        setCaptionsInput('');
        setCsvFile(null);
        setCsvData([]);
        fetchLibrary();
      } else {
        showToast(data.error || 'Gagal menyimpan URL', 'error');
      }
    } catch {
      showToast('Gagal melakukan request ke server', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEnqueueSelected() {
    if (selectedIds.size === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/v2/deconstruct/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_ids: Array.from(selectedIds),
          target_recommendation_count: recommCount
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Antrean dimulai untuk ${data.enqueued_count} URL.`);
        setSelectedIds(new Set());
        setShowEnqueueModal(false);
        fetchLibrary();
      } else {
        showToast(data.error || 'Gagal memulai antrean', 'error');
      }
    } catch {
      showToast('Gagal terhubung ke server', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  // --- Selection Utilities ---
  const eligibleAssets = assets.filter(a => ['saved', 'failed'].includes(a.status));
  
  const handleSelectAll = (checked) => {
    if (checked) {
      const newSelected = new Set(selectedIds);
      eligibleAssets.forEach(a => newSelected.add(a.id));
      setSelectedIds(newSelected);
    } else {
      const newSelected = new Set(selectedIds);
      eligibleAssets.forEach(a => newSelected.delete(a.id));
      setSelectedIds(newSelected);
    }
  };

  const handleSelectOne = (id, checked) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const isAllSelected = eligibleAssets.length > 0 && eligibleAssets.every(a => selectedIds.has(a.id));

  // --- Badge styling ---
  function getStatusStyle(status) {
    const styles = {
      saved: { color: 'var(--text-muted)', bg: 'rgba(255, 255, 255, 0.05)', label: 'Belum' },
      pending_download: { color: 'var(--info)', bg: 'rgba(116, 185, 255, 0.12)', label: 'Antrean' },
      downloading: { color: 'var(--info)', bg: 'rgba(116, 185, 255, 0.15)', label: 'Downloading' },
      uploading: { color: 'var(--info)', bg: 'rgba(116, 185, 255, 0.15)', label: 'Uploading' },
      analyzing: { color: 'var(--info)', bg: 'rgba(116, 185, 255, 0.2)', label: 'Analyzing' },
      deconstructed: { color: 'var(--success)', bg: 'rgba(46, 204, 113, 0.12)', label: 'Selesai' },
      failed: { color: 'var(--danger)', bg: 'rgba(231, 76, 60, 0.12)', label: 'Gagal' }
    };
    return styles[status] || { color: 'var(--text-muted)', bg: 'var(--surface-interactive)', label: status };
  }

  return (
    <div className="app-layout">
      <Sidebar />
      
      <main className="main-content">
        <div className="page-container">
        {/* Header Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0, background: 'linear-gradient(135deg, var(--text-primary) 0%, #a4b0be 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Deconstruct Lab
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
              Library riset pola video viral dan blueprint konsep konten kreatif.
            </p>
          </div>
          <button
            onClick={() => setShowSaveModal(true)}
            className="btn btn-primary"
            style={{
              padding: '10px 18px',
              fontSize: '0.85rem',
              fontWeight: 600,
              background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              boxShadow: '0 4px 15px rgba(108, 92, 231, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer'
            }}
          >
            <span>+</span> Simpan URL
          </button>
        </div>

        {/* Toolbar & Filters */}
        <div style={{
          background: 'var(--overlay-subtle)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          padding: 16,
          marginBottom: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 280 }}>
            {/* Search Input */}
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="text"
                placeholder="Cari URL atau deskripsi..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                style={{
                  width: '100%',
                  background: 'var(--surface-interactive)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                  outline: 'none'
                }}
              />
            </div>

            {/* Niche Filter */}
            <select
              value={selectedNiche}
              onChange={(e) => { setSelectedNiche(e.target.value); setPage(1); }}
              style={{
                background: 'var(--surface-interactive)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                outline: 'none',
                minWidth: 140
              }}
            >
              <option value="">Semua Niche</option>
              {niches.map((n, i) => (
                <option key={i} value={n}>{n}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
              style={{
                background: 'var(--surface-interactive)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                outline: 'none',
                minWidth: 140
              }}
            >
              <option value="">Semua Status</option>
              <option value="saved">Belum (Saved)</option>
              <option value="pending_download">Antrean</option>
              <option value="downloading">Downloading</option>
              <option value="uploading">Uploading</option>
              <option value="analyzing">Analyzing</option>
              <option value="deconstructed">Selesai</option>
              <option value="failed">Gagal</option>
            </select>
          </div>

          {/* Contextual Bulk Action */}
          {selectedIds.size > 0 && (
            <button
              onClick={() => setShowEnqueueModal(true)}
              className="btn btn-secondary"
              style={{
                background: 'linear-gradient(135deg, #10ac84 0%, #01a3a4 100%)',
                color: '#fff',
                border: 'none',
                padding: '8px 16px',
                fontSize: '0.82rem',
                fontWeight: 600,
                borderRadius: 'var(--radius-sm)',
                boxShadow: '0 4px 12px rgba(16, 172, 132, 0.2)',
                cursor: 'pointer'
              }}
            >
              🚀 Dekonstruksi Terpilih ({selectedIds.size})
            </button>
          )}
        </div>

        {/* Library Table */}
        <div style={{
          background: 'var(--overlay-subtle)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden'
        }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', gap: 12 }}>
              <div className="spinner" style={{ width: 30, height: 30, borderWidth: 3 }}></div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Memuat pustaka URL...</span>
            </div>
          ) : assets.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: '2.5rem', marginBottom: 12 }}>📁</span>
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Pustaka URL kosong</span>
              <span style={{ fontSize: '0.8rem', marginTop: 4 }}>Simpan URL baru untuk memulai dekonstruksi.</span>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="ideas-table" style={{ width: '100%', fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th style={{ width: 40, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        disabled={eligibleAssets.length === 0}
                      />
                    </th>
                    <th>URL</th>
                    <th style={{ width: 130 }}>Niche</th>
                    <th style={{ width: 110 }}>Proses</th>
                    <th style={{ width: 220 }}>Keterangan</th>
                    <th style={{ width: 140 }}>Tgl Input</th>
                    <th style={{ width: 140 }}>Tgl Analisis</th>
                    <th style={{ width: 100, textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset) => {
                    const statusOpt = getStatusStyle(asset.status);
                    const isEligible = ['saved', 'failed'].includes(asset.status);
                    return (
                      <tr key={asset.id} style={{ opacity: ['downloading', 'uploading', 'analyzing'].includes(asset.status) ? 0.85 : 1 }}>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(asset.id)}
                            onChange={(e) => handleSelectOne(asset.id, e.target.checked)}
                            disabled={!isEligible}
                          />
                        </td>
                        <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <a
                            href={asset.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--accent-light)', textDecoration: 'none', fontWeight: 500 }}
                          >
                            {asset.source_url.replace(/https?:\/\/(www\.)?/, '')}
                          </a>
                        </td>
                        <td>
                          <span style={{
                            display: 'inline-block',
                            background: 'rgba(108, 92, 231, 0.08)',
                            color: 'var(--accent-light)',
                            padding: '3px 8px',
                            borderRadius: 4,
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            border: '1px solid rgba(108, 92, 231, 0.15)'
                          }}>
                            {asset.niche || '—'}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            display: 'inline-block',
                            color: statusOpt.color,
                            background: statusOpt.bg,
                            padding: '3px 8px',
                            borderRadius: 4,
                            fontSize: '0.72rem',
                            fontWeight: 700
                          }}>
                            {statusOpt.label}
                          </span>
                        </td>
                        <td>
                          <div style={{
                            maxWidth: 220,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: 'var(--text-secondary)'
                          }}>
                            {asset.viral_pattern_summary || asset.original_caption || '—'}
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                          {asset.created_at ? new Date(asset.created_at).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                          {asset.deconstructed_at ? new Date(asset.deconstructed_at).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => router.push(`/deconstruct/${asset.id}`)}
                            className="btn btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '0.75rem', height: 28 }}
                          >
                            Detail
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

        {/* Pagination Section */}
        {pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
            <button
              onClick={() => setPage(p => Math.max(p - 1, 1))}
              disabled={page === 1}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.78rem' }}
            >
              Prev
            </button>
            <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '0 8px' }}>
              Halaman {page} dari {pages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(p + 1, pages))}
              disabled={page === pages}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.78rem' }}
            >
              Next
            </button>
          </div>
        )}

        {/* Modal: Simpan URL */}
        {showSaveModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999
          }}>
            <div style={{
              background: 'var(--overlay-subtle)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              width: 500,
              padding: 24,
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  📥 Simpan URL ke Library
                </h3>
                <button
                  onClick={() => setShowSaveModal(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleSaveUrls}>
                {/* Niche Input */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Niche Konten (Wajib)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Skincare, Gadget, Kuliner"
                    value={nicheInput}
                    onChange={(e) => setNicheInput(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--surface-interactive)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: 10,
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Tabs Input Mode */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 14, gap: 16 }}>
                  <button
                    type="button"
                    onClick={() => setInputMode('manual')}
                    style={{
                      background: 'none',
                      border: 'none',
                      borderBottom: inputMode === 'manual' ? '2px solid var(--accent)' : 'none',
                      color: inputMode === 'manual' ? 'var(--accent-light)' : 'var(--text-muted)',
                      padding: '8px 0',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Input Manual
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode('csv')}
                    style={{
                      background: 'none',
                      border: 'none',
                      borderBottom: inputMode === 'csv' ? '2px solid var(--accent)' : 'none',
                      color: inputMode === 'csv' ? 'var(--accent-light)' : 'var(--text-muted)',
                      padding: '8px 0',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Unggah CSV
                  </button>
                </div>

                {inputMode === 'manual' ? (
                  <>
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                        Video URLs (satu per baris)
                      </label>
                      <textarea
                        rows={5}
                        required={inputMode === 'manual'}
                        placeholder="https://tiktok.com/..."
                        value={urlsInput}
                        onChange={(e) => setUrlsInput(e.target.value)}
                        style={{
                          width: '100%',
                          background: 'var(--surface-interactive)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          padding: 10,
                          color: 'var(--text-primary)',
                          fontSize: '0.82rem',
                          outline: 'none',
                          resize: 'none',
                          fontFamily: 'var(--font-mono)'
                        }}
                      />
                    </div>
                    <div style={{ marginBottom: 18 }}>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                        Keterangan/Caption (opsional, satu per baris)
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Caption video pertama&#10;Caption video kedua"
                        value={captionsInput}
                        onChange={(e) => setCaptionsInput(e.target.value)}
                        style={{
                          width: '100%',
                          background: 'var(--surface-interactive)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          padding: 10,
                          color: 'var(--text-primary)',
                          fontSize: '0.82rem',
                          outline: 'none',
                          resize: 'none'
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <div style={{ marginBottom: 18 }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                      File CSV
                    </label>
                    <input
                      type="file"
                      ref={csvRef}
                      accept=".csv"
                      onChange={handleCsvUpload}
                      style={{
                        width: '100%',
                        background: 'var(--surface-interactive)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        padding: 10,
                        color: 'var(--text-primary)',
                        fontSize: '0.82rem',
                        outline: 'none'
                      }}
                    />
                    {csvDebug && (
                      <div style={{ marginTop: 8, fontSize: '0.7rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', padding: 8, borderRadius: 4 }}>
                        Delim: "{csvDebug.delimiter}" | URL: {csvDebug.urlCol} | Cap: {csvDebug.captionCol} | Data: {csvData.length} baris
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setShowSaveModal(false)}
                    className="btn btn-secondary"
                    style={{ padding: '8px 16px', fontSize: '0.82rem' }}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn btn-primary"
                    style={{ padding: '8px 16px', fontSize: '0.82rem', fontWeight: 600 }}
                  >
                    {submitting ? 'Menyimpan...' : 'Simpan ke Library'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Konfirmasi Enqueue */}
        {showEnqueueModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999
          }}>
            <div style={{
              background: 'var(--overlay-subtle)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              width: 440,
              padding: 24,
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  🚀 Jalankan Analisis Dekonstruksi
                </h3>
                <button
                  onClick={() => setShowEnqueueModal(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}
                >
                  &times;
                </button>
              </div>

              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  Anda memilih <strong>{selectedIds.size} URL</strong> untuk dimasukkan ke antrean proses dekonstruksi massal serial (satu per satu).
                </p>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Target Jumlah Ide Rekomendasi (per video)
                </label>
                <select
                  value={recommCount}
                  onChange={(e) => setRecommCount(Number(e.target.value))}
                  style={{
                    width: '100%',
                    background: 'var(--surface-interactive)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: 8,
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem',
                    outline: 'none'
                  }}
                >
                  <option value={1}>1 Ide Produk</option>
                  <option value={3}>3 Ide Produk (Standar)</option>
                  <option value={5}>5 Ide Produk</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowEnqueueModal(false)}
                  className="btn btn-secondary"
                  style={{ padding: '8px 16px', fontSize: '0.82rem' }}
                >
                  Batal
                </button>
                <button
                  onClick={handleEnqueueSelected}
                  disabled={submitting}
                  className="btn btn-primary"
                  style={{ padding: '8px 16px', fontSize: '0.82rem', fontWeight: 600, background: 'var(--success)', borderColor: 'var(--success)' }}
                >
                  {submitting ? 'Memproses...' : 'Mulai Antrean'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Global Toast */}
        {toast && (
          <div style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            padding: '12px 20px',
            background: toast.type === 'error' ? 'var(--danger)' : 'var(--success)',
            color: '#fff',
            borderRadius: 'var(--radius-sm)',
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
            fontSize: '0.82rem',
            fontWeight: 600,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            animation: 'slideDownFadeIn 0.25s ease-out'
          }}>
            <span>{toast.type === 'error' ? '⚠' : '✓'}</span>
            {toast.msg}
          </div>
        )}
        <footer style={{ marginTop: '80px', padding: '24px 0', borderTop: '1px solid var(--border-subtle)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          © 2026 MaknaFlow
        </footer>
      </div>
    </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .spinner {
          border: 3px solid rgba(255,255,255,0.05);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes slideDownFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
}
