'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';

export default function ProductDatabasePage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scrapingCount, setScrapingCount] = useState(0);
  const [viewTabs, setViewTabs] = useState({}); // productId -> 'raw' | 'cleaned' | 'generated'
  const [zoomedImage, setZoomedImage] = useState(null);
  const [uploadingProductId, setUploadingProductId] = useState(null);
  
  // Search & Filter
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  
  // Modals visibility
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [showScraperModal, setShowScraperModal] = useState(false);
  
  // Editing state
  const [editingProduct, setEditingProduct] = useState(null);
  const [inlineAffiliateLinks, setInlineAffiliateLinks] = useState({});
  const [savingAffiliateId, setSavingAffiliateId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  
  // Form fields for Add/Edit full product
  const [formData, setFormData] = useState({
    product_name: '',
    category: '',
    tags: '',
    product_description: '',
    unique_selling_point: '',
    affiliate_link: '',
    photo_url: '',
    source_url: '',
    is_in_packaging: 0,
    packaging_type: '',
    i2v_action_prompt: '',
    t2i_prompt: '',
    product_truth: '',
    geometric_truth: '',
  });

  // Scraper fields
  const [scraperUrls, setScraperUrls] = useState('');
  const [scraperCategory, setScraperCategory] = useState('');
  const [scraperTags, setScraperTags] = useState('');
  const [isSubmittingScraper, setIsSubmittingScraper] = useState(false);
  const [repairMode, setRepairMode] = useState(true);

  // Import/Export portability states
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [regeneratingTruths, setRegeneratingTruths] = useState(false);
  const [regeneratingPhotos, setRegeneratingPhotos] = useState(false);

  // CSV Import and Logging states (v10.14.0)
  const [showCsvImportModal, setShowCsvImportModal] = useState(false);
  const [csvImportFile, setCsvImportFile] = useState(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [showLogConsole, setShowLogConsole] = useState(false);
  const [systemLogs, setSystemLogs] = useState('Belum ada log log aktivitas.');

  const [toast, setToast] = useState(null);

  // CSV scraper states & Sheets export states
  const [scraperInputType, setScraperInputType] = useState('urls'); // 'urls' or 'csv'
  const [scraperCsvFile, setScraperCsvFile] = useState(null);
  const [exportingSheets, setExportingSheets] = useState(false);
  const [exportedSheetUrl, setExportedSheetUrl] = useState('');

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  // Fetch products and active queue status
  async function fetchProducts() {
    try {
      const res = await fetch(`/api/v2/products?search=${encodeURIComponent(search)}&category=${encodeURIComponent(selectedCategory)}`);
      const data = await res.json();
      if (data.success) {
        setProducts(data.data || []);
        setScrapingCount(data.scraping_count || 0);
        
        // Populate inline affiliate links map
        const linksMap = {};
        data.data.forEach(p => {
          linksMap[p.id] = p.affiliate_link || '';
        });
        setInlineAffiliateLinks(linksMap);
      }
    } catch (e) {
      console.error('Fetch products error:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory]);

  // Run search on Enter key
  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      fetchProducts();
    }
  };

  const hasBulkQueueActive = products.some(p => p.extraction_status && ['pending', 'pending_image', 'generating_image'].includes(p.extraction_status));

  // Poll for updates if scraper queue or bulk queue is active
  useEffect(() => {
    let timer;
    if (scrapingCount > 0 || hasBulkQueueActive) {
      timer = setInterval(() => {
        fetchProducts();
      }, 4000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [scrapingCount, hasBulkQueueActive]);

  // Poll logs for product bulk worker
  useEffect(() => {
    let logTimer;
    async function fetchLogs() {
      try {
        const res = await fetch('/api/system-logs?type=product_bulk');
        const text = await res.text();
        setSystemLogs(text);
      } catch (err) {
        console.error('Failed to fetch system logs:', err);
      }
    }

    if (showLogConsole || hasBulkQueueActive) {
      fetchLogs();
      logTimer = setInterval(fetchLogs, 3000);
    }

    return () => {
      if (logTimer) clearInterval(logTimer);
    };
  }, [showLogConsole, hasBulkQueueActive]);

  // Extract unique categories for filter dropdown
  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));

  // Manual save for full add/edit product
  async function handleSaveProduct(e) {
    e.preventDefault();
    if (!formData.product_name.trim()) {
      showToast('Nama produk wajib diisi!', 'error');
      return;
    }

    try {
      const url = editingProduct 
        ? `/api/v2/products/${editingProduct.id}` 
        : '/api/v2/products';
      
      const method = editingProduct ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (data.success) {
        showToast(editingProduct ? '✅ Produk berhasil diperbarui!' : '✅ Produk berhasil ditambahkan!');
        setShowAddEditModal(false);
        setEditingProduct(null);
        resetForm();
        fetchProducts();
      } else {
        showToast(data.error || 'Gagal menyimpan produk', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Quick save for affiliate link inline
  async function handleQuickSaveAffiliate(productId) {
    const affiliateLink = inlineAffiliateLinks[productId] || '';
    setSavingAffiliateId(productId);
    try {
      const res = await fetch(`/api/v2/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affiliate_link: affiliateLink.trim() })
      });
      const data = await res.json();
      if (data.success) {
        showToast('✅ Link afiliasi disimpan!');
        // Refresh local cache data
        setProducts(prev => prev.map(p => p.id === productId ? { ...p, affiliate_link: affiliateLink } : p));
      } else {
        showToast(data.error || 'Gagal menyimpan', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingAffiliateId(null);
    }
  }

  // Copy affiliate link
  function handleCopyLink(productId) {
    const link = inlineAffiliateLinks[productId] || '';
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopiedId(productId);
    showToast('📋 Link disalin ke clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  }

  // Set selected photo type as active
  async function handleSetActivePhoto(productId, tabType) {
    const colName = tabType === 'raw' ? 'raw_photo_url' : (tabType === 'cleaned' ? 'cleaned_photo_url' : 'generated_photo_url');
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    let relativePath = '';
    const rawUrl = tabType === 'raw' 
      ? product.raw_photo_url 
      : (tabType === 'cleaned' ? (product.cleaned_photo_url || product.clean_photo_url) : product.generated_photo_url);
    
    if (rawUrl && rawUrl.includes('path=')) {
      const match = rawUrl.match(/path=([^&]+)/);
      if (match) {
        relativePath = decodeURIComponent(match[1]);
      }
    } else {
      relativePath = rawUrl;
    }

    try {
      const res = await fetch(`/api/v2/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          active_photo: colName,
          photo_url: relativePath
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✅ Foto ${tabType === 'raw' ? 'Raw' : tabType === 'cleaned' ? 'Clean' : 'Studio'} aktif digunakan!`);
        fetchProducts();
      } else {
        showToast(data.error || 'Gagal mengubah foto aktif', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Upload and replace photo
  async function handleUploadPhoto(productId, tabType, file) {
    setUploadingProductId(productId);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('productId', productId);
    formData.append('type', tabType);

    try {
      const res = await fetch('/api/v2/products/image', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✅ Foto ${tabType === 'raw' ? 'Raw' : tabType === 'cleaned' ? 'Clean' : 'Studio'} berhasil diunggah!`);
        // Force the UI view tab to switch to the newly uploaded image tab
        setViewTabs(prev => ({ ...prev, [productId]: tabType }));
        fetchProducts();
      } else {
        showToast(data.error || 'Gagal mengunggah foto', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUploadingProductId(null);
    }
  }


  // Parse CSV client-side
  function parseCSV(text) {
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
    if (lines.length < 2) return { error: 'File CSV kosong atau tidak memiliki baris data.' };

    // Detect delimiter: check if semicolon occurs more than comma in the header row
    const headerLine = lines[0];
    const commaCount = (headerLine.match(/,/g) || []).length;
    const semicolonCount = (headerLine.match(/;/g) || []).length;
    const delimiter = semicolonCount > commaCount ? ';' : ',';

    const parseCSVLine = (line, delim = ',') => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delim && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result.map(val => val.replace(/^"|"$/g, '').trim());
    };

    const headers = parseCSVLine(headerLine, delimiter);
    const affiliateIdx = headers.findIndex(h => {
      const norm = h.toLowerCase();
      return norm.includes('affiliate') || norm.includes('afiliasi') || norm.includes('partner');
    });

    const productIdx = headers.findIndex((h, idx) => {
      if (idx === affiliateIdx) return false; // Prevent choosing the affiliate column as product url
      const norm = h.toLowerCase();
      return norm.includes('product') || norm.includes('produk') || norm === 'url' || norm.includes('link') || norm.includes('url');
    });

    if (productIdx === -1 || affiliateIdx === -1 || productIdx === affiliateIdx) {
      return { error: 'Gagal mendeteksi kolom. Pastikan file CSV Anda memiliki kolom "URL Product" dan "URL Affiliates".' };
    }

    const dataRows = lines.slice(1);
    if (dataRows.length > 50) {
      return { error: `Maksimal data yang diperbolehkan adalah 50 baris. File Anda berisi ${dataRows.length} baris.` };
    }

    const records = [];
    for (const rowLine of dataRows) {
      const cols = parseCSVLine(rowLine, delimiter);
      const urlProduct = cols[productIdx] ? cols[productIdx].trim() : '';
      const urlAffiliate = cols[affiliateIdx] ? cols[affiliateIdx].trim() : '';
      if (urlProduct && (urlProduct.startsWith('http://') || urlProduct.startsWith('https://'))) {
        records.push({ url: urlProduct, affiliate_link: urlAffiliate });
      }
    }

    if (records.length === 0) {
      return { error: 'Tidak ada URL produk valid yang ditemukan di file CSV.' };
    }

    return { records };
  }

  // Submit batch scraping URLs or CSV file
  async function handleSubmitScraper(e) {
    e.preventDefault();

    let payload = {
      category: scraperCategory.trim() || null,
      tags: scraperTags.trim() || null,
      repair_mode: repairMode
    };

    if (scraperInputType === 'csv') {
      if (!scraperCsvFile) {
        showToast('Pilih file CSV terlebih dahulu!', 'error');
        return;
      }
      setIsSubmittingScraper(true);
      try {
        const text = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target.result);
          reader.onerror = (err) => reject(err);
          reader.readAsText(scraperCsvFile);
        });

        const parsed = parseCSV(text);
        if (parsed.error) {
          showToast(parsed.error, 'error');
          setIsSubmittingScraper(false);
          return;
        }

        payload.csv_data = parsed.records;
      } catch (err) {
        showToast(`Gagal membaca file: ${err.message}`, 'error');
        setIsSubmittingScraper(false);
        return;
      }
    } else {
      if (!scraperUrls.trim()) {
        showToast('Masukkan setidaknya satu URL!', 'error');
        return;
      }
      payload.urls = scraperUrls;
    }

    setIsSubmittingScraper(true);
    try {
      const res = await fetch('/api/v2/products/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || '🚀 Scraper diantrekan!');
        setScraperUrls('');
        setScraperCsvFile(null);
        setScraperCategory('');
        setScraperTags('');
        setShowScraperModal(false);
        fetchProducts();
      } else {
        showToast(data.error || 'Gagal memproses scraper', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmittingScraper(false);
    }
  }

  // Export to Google Sheets
  async function handleExportSheets() {
    setExportingSheets(true);
    setExportedSheetUrl('');
    try {
      const res = await fetch('/api/v2/products/export-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds.length > 0 ? selectedIds : null })
      });
      const data = await res.json();
      if (data.success) {
        setExportedSheetUrl(data.spreadsheetUrl);
        showToast('✅ Berhasil mengekspor produk ke Google Sheets!');
      } else {
        showToast(data.error || 'Gagal mengekspor produk', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setExportingSheets(false);
    }
  }

  // Regenerate Product Truths & Geometry Truths in a batch
  async function handleBulkRegenerateTruths() {
    if (selectedIds.length === 0) return;
    setRegeneratingTruths(true);
    try {
      const res = await fetch('/api/v2/products/regenerate-truths', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✅ ${data.message}`);
        fetchProducts(); // Refresh list
        setSelectedIds([]);
      } else {
        showToast(data.error || 'Gagal men-generate ulang truths', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setRegeneratingTruths(false);
    }
  }

  // Regenerate clean studio photos and prompts in a batch
  async function handleBulkRegeneratePhotos() {
    if (selectedIds.length === 0) return;
    setRegeneratingPhotos(true);
    try {
      const res = await fetch('/api/v2/products/regenerate-photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✅ ${data.message}`);
        fetchProducts(); // Refresh list
        setSelectedIds([]);
      } else {
        showToast(data.error || 'Gagal men-generate ulang foto & prompt', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setRegeneratingPhotos(false);
    }
  }

  // Submit product database ZIP import
  async function handleImportSubmit(e) {
    e.preventDefault();
    if (!importFile) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('products_file', importFile);

      const res = await fetch('/api/v2/products/import', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Gagal mengimpor produk');

      showToast(data.message || '✅ Produk berhasil diimpor!');
      setShowImportModal(false);
      setImportFile(null);
      fetchProducts();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setImporting(false);
    }
  }

  // Submit product CSV import
  async function handleCsvImportSubmit(e) {
    e.preventDefault();
    if (!csvImportFile) return;
    setCsvImporting(true);
    
    const formData = new FormData();
    formData.append('file', csvImportFile);

    try {
      const res = await fetch('/api/v2/products/import-csv', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message);
        setShowCsvImportModal(false);
        setCsvImportFile(null);
        setShowLogConsole(true); // Auto-open console log to show progress
        fetchProducts();
      } else {
        showToast(data.error || 'Gagal mengimpor CSV raw', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setCsvImporting(false);
    }
  }

  // Edit action
  function handleEditProduct(product) {
    setEditingProduct(product);
    setFormData({
      product_name: product.product_name || '',
      category: product.category || '',
      tags: product.tags || '',
      product_description: product.product_description || '',
      unique_selling_point: product.unique_selling_point || '',
      affiliate_link: product.affiliate_link || '',
      photo_url: product.photo_url || '',
      source_url: product.source_url || '',
      is_in_packaging: product.is_in_packaging || 0,
      packaging_type: product.packaging_type || '',
      i2v_action_prompt: product.i2v_action_prompt || '',
      t2i_prompt: product.t2i_prompt || '',
      product_truth: product.product_truth || '',
      geometric_truth: product.geometric_truth || '',
    });
    setShowAddEditModal(true);
  }

  // Delete action
  async function handleDeleteProduct(productId) {
    if (!confirm('Hapus produk ini secara permanen dari database?')) return;
    try {
      const res = await fetch(`/api/v2/products/${productId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('🗑 Produk dihapus!');
        setSelectedIds(prev => prev.filter(id => id !== productId));
        fetchProducts();
      } else {
        showToast(data.error || 'Gagal menghapus produk', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function resetForm() {
    setFormData({
      product_name: '',
      category: '',
      tags: '',
      product_description: '',
      unique_selling_point: '',
      affiliate_link: '',
      photo_url: '',
      source_url: '',
      is_in_packaging: 0,
      packaging_type: '',
      i2v_action_prompt: '',
      t2i_prompt: '',
      product_truth: '',
      geometric_truth: '',
    });
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-container">
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
            <div>
              <h1 className="page-title">📦 Product Database</h1>
              <p className="page-subtitle">Manage single source of truth for products. Automatically scrape details and extract 3 bullet-point USPs via Gemini.</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button 
                className="btn" 
                style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                onClick={() => setShowImportModal(true)}
              >
                📥 Import ZIP
              </button>
              <button 
                className="btn" 
                style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                onClick={() => setShowCsvImportModal(true)}
              >
                📥 Import CSV Raw
              </button>
              <a 
                href={selectedIds.length > 0 ? `/api/v2/products/export?ids=${selectedIds.join(',')}` : `/api/v2/products/export`} 
                className="btn" 
                style={{ 
                  background: selectedIds.length > 0 ? 'rgba(108, 92, 231, 0.2)' : 'rgba(255, 255, 255, 0.05)', 
                  border: selectedIds.length > 0 ? '1px solid var(--accent)' : '1px solid var(--border)', 
                  color: selectedIds.length > 0 ? 'var(--accent-light)' : 'var(--text-primary)', 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  textDecoration: 'none' 
                }}
              >
                📤 Export ZIP {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
              </a>
              <button 
                className="btn" 
                style={{ 
                  background: 'rgba(0, 184, 148, 0.15)', 
                  border: '1px solid var(--success)', 
                  color: 'var(--success-light)',
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  justifyContent: 'center'
                }}
                onClick={handleExportSheets}
                disabled={exportingSheets}
              >
                📊 Export Sheets {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
              </button>
              <button className="btn btn-secondary" onClick={() => { resetForm(); setEditingProduct(null); setShowAddEditModal(true); }}>
                + Add Product
              </button>
              <button className="btn btn-primary" onClick={() => { setScraperInputType('urls'); setScraperCsvFile(null); setShowScraperModal(true); }}>
                ⚡ Batch Scraper
              </button>
            </div>
          </div>

          {/* Toast Notification */}
          {toast && (
            <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`} style={{ zIndex: 1010 }}>
              {toast.msg}
            </div>
          )}

          {/* Background Scraping Status banner */}
          {scrapingCount > 0 && (
            <div className="card" style={{
              background: 'linear-gradient(135deg, rgba(108, 92, 231, 0.15), rgba(0, 184, 148, 0.15))',
              border: '1px solid var(--accent)',
              borderRadius: 'var(--radius)',
              padding: '16px 20px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              animation: 'pulse 2s infinite ease-in-out'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="spinner" style={{ width: '20px', height: '20px', borderTopColor: 'var(--accent-light)' }}></div>
                <div style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                  Scraper aktif di latar belakang: <strong style={{ color: 'var(--accent-light)' }}>{scrapingCount} tugas</strong> sedang dianalisis...
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Halaman akan ter-refresh otomatis.
              </div>
            </div>
          )}

          {/* Export Sheets Loading Banner */}
          {exportingSheets && (
            <div className="card" style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '16px 20px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div className="spinner" style={{ width: '20px', height: '20px', borderTopColor: 'var(--success)' }}></div>
              <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                Sedang mengekspor produk ke Google Sheets... Sistem sedang mengunggah gambar produk ke Google Drive dan membuat Spreadsheet. Mohon tunggu beberapa saat.
              </div>
            </div>
          )}

          {/* Export Sheets Success Banner */}
          {exportedSheetUrl && (
            <div className="card" style={{
              background: 'rgba(0, 184, 148, 0.15)',
              border: '1px solid var(--success)',
              borderRadius: 'var(--radius)',
              padding: '16px 20px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                🟢 Ekspor Google Sheets selesai! Klik tautan berikut untuk membuka: {' '}
                <a href={exportedSheetUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--success-light)', textDecoration: 'underline', fontWeight: 700, marginLeft: '5px' }}>
                  Buka Google Sheets Export
                </a>
              </div>
              <button className="btn btn-sm" onClick={() => setExportedSheetUrl('')} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                ✕
              </button>
            </div>
          )}

          {/* System Poller Log Console (v10.14.0) */}
          <div className="card" style={{ marginBottom: '24px', padding: '14px 18px', background: 'var(--bg-panel)', border: '1px solid var(--border)' }}>
            <div 
              onClick={() => setShowLogConsole(!showLogConsole)} 
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                <span>🖥️ System Poller Log Console (Product Bulk Worker)</span>
                {hasBulkQueueActive && (
                  <span style={{
                    padding: '2px 8px', borderRadius: '10px', background: 'rgba(0, 184, 148, 0.2)',
                    color: 'var(--success-light)', fontSize: '0.7rem', fontWeight: 700, display: 'inline-flex',
                    alignItems: 'center', gap: '4px', animation: 'pulse 1.5s infinite ease-in-out'
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }}></span>
                    Active Processing
                  </span>
                )}
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {showLogConsole ? '▲ Sembunyikan' : '▼ Tampilkan'}
              </span>
            </div>
            
            {showLogConsole && (
              <div style={{ marginTop: '14px' }}>
                <pre style={{
                  padding: '12px 16px', background: '#121214', color: '#a2a2ad',
                  borderRadius: 'var(--radius-xs)', fontSize: '0.75rem', maxHeight: '240px',
                  overflowY: 'auto', border: '1px solid var(--border)', fontFamily: 'monospace',
                  lineHeight: '1.6', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all'
                }}>
                  {systemLogs || 'Belum ada log aktivitas.'}
                </pre>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'right' }}>
                  Auto-sync log aktif setiap 3 detik.
                </div>
              </div>
            )}
          </div>

          {/* Filters & Search Bar */}
          <div className="card" style={{ padding: '16px 20px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: '280px', position: 'relative' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="🔎 Cari berdasarkan nama produk, USP, atau tags..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={handleSearchKeyPress}
                  style={{ width: '100%', height: '40px' }}
                />
              </div>
              <div style={{ width: '180px' }}>
                <select
                  className="form-select"
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  style={{ margin: 0, height: '40px' }}
                >
                  <option value="">Semua Kategori</option>
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <button className="btn btn-secondary" onClick={fetchProducts} style={{ height: '40px' }}>
                Search
              </button>
              {(search || selectedCategory) && (
                <button
                  className="btn"
                  style={{ background: 'transparent', color: 'var(--text-muted)', border: 'none', height: '40px' }}
                  onClick={() => { setSearch(''); setSelectedCategory(''); setTimeout(fetchProducts, 100); }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Grid View */}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px' }}>
              <div className="spinner" style={{ width: '40px', height: '40px' }}></div>
              <span style={{ marginTop: '16px', color: 'var(--text-muted)' }}>Memuat data produk...</span>
            </div>
          ) : products.length === 0 ? (
            <div className="empty-state" style={{ padding: '64px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '3.5rem', marginBottom: '16px' }}>📦</div>
              <h3>Belum ada produk di database</h3>
              <p style={{ color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto 20px' }}>
                Tambahkan produk baru secara manual atau jalankan batch scraper dengan menempelkan link produk marketplace Shopee atau Tokopedia.
              </p>
            </div>
          ) : (
            <div>
              {/* Selection / Action Bar */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 16px',
                fontSize: '0.85rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500, color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={products.length > 0 && selectedIds.length === products.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(products.map(p => p.id));
                        } else {
                          setSelectedIds([]);
                        }
                      }}
                      style={{
                        width: '16px',
                        height: '16px',
                        cursor: 'pointer',
                        accentColor: 'var(--accent)'
                      }}
                    />
                    Pilih Semua ({products.length} produk)
                  </label>
                  {selectedIds.length > 0 && (
                    <button
                      className="btn"
                      onClick={() => setSelectedIds([])}
                      style={{
                        fontSize: '0.72rem',
                        padding: '4px 10px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-muted)'
                      }}
                    >
                      Batal Pilihan
                    </button>
                  )}
                </div>
                {selectedIds.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ color: 'var(--accent-light)', fontWeight: 600, fontSize: '0.82rem' }}>
                      🔔 {selectedIds.length} produk terpilih untuk diekspor
                    </div>
                    <button
                      type="button"
                      onClick={handleBulkRegenerateTruths}
                      disabled={regeneratingTruths}
                      style={{
                        background: 'linear-gradient(135deg, #a855f7 0%, #6c5ce7 100%)',
                        border: 'none',
                        color: '#fff',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '6px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 8px rgba(108, 92, 231, 0.4)'
                      }}
                    >
                      {regeneratingTruths ? (
                        <>
                          <div className="spinner" style={{ width: '12px', height: '12px', borderTopColor: '#fff' }} />
                          Memproses...
                        </>
                      ) : (
                        <>🔄 RE-Generate Truths</>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleBulkRegeneratePhotos}
                      disabled={regeneratingPhotos}
                      style={{
                        background: 'linear-gradient(135deg, #ffa502 0%, #ff7f50 100%)',
                        border: 'none',
                        color: '#fff',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '6px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 8px rgba(255, 127, 80, 0.4)'
                      }}
                    >
                      {regeneratingPhotos ? (
                        <>
                          <div className="spinner" style={{ width: '12px', height: '12px', borderTopColor: '#fff' }} />
                          Rendering...
                        </>
                      ) : (
                        <>📷 RE-Generate Photos</>
                      )}
                    </button>
                  </div>
                )}
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                gap: '20px'
              }}>
                {products.map(p => {
                // Parse tags
                const tagsList = p.tags 
                  ? p.tags.split(',').map(t => t.trim()).filter(Boolean)
                  : [];
                
                // Parse USP points
                let uspPoints = [];
                if (p.unique_selling_point) {
                  const rawUsp = p.unique_selling_point;
                  if (rawUsp.startsWith('-') || rawUsp.includes('\n')) {
                    uspPoints = rawUsp.split('\n').map(l => l.replace(/^-\s*/, '').trim()).filter(Boolean);
                  } else {
                    try {
                      const parsed = JSON.parse(rawUsp);
                      uspPoints = Array.isArray(parsed) ? parsed : [parsed];
                    } catch (e) {
                      uspPoints = [rawUsp];
                    }
                  }
                }

                // Resolve active tab and display URL
                const activeTab = viewTabs[p.id] || (p.active_photo === 'raw_photo_url' ? 'raw' : ((p.active_photo === 'cleaned_photo_url' || p.active_photo === 'clean_photo_url') ? 'cleaned' : 'generated'));
                const displayPhotoUrl = activeTab === 'raw' 
                  ? p.raw_photo_url 
                  : (activeTab === 'cleaned' ? (p.cleaned_photo_url || p.clean_photo_url) : p.generated_photo_url);
                const isTabAvailable = (tab) => tab === 'raw' ? !!p.raw_photo_url : (tab === 'cleaned' ? (!!p.cleaned_photo_url || !!p.clean_photo_url) : !!p.generated_photo_url);
                const isCurrentlyActive = (tab) => p.active_photo === (tab === 'raw' ? 'raw_photo_url' : (tab === 'cleaned' ? 'cleaned_photo_url' : 'generated_photo_url')) || (tab === 'cleaned' && p.active_photo === 'clean_photo_url');

                return (
                  <div key={p.id} className="card product-card" style={{
                    padding: 0,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    border: '1px solid var(--border)',
                    transition: 'all 0.25s ease',
                  }}>
                    {/* Upper content */}
                    <div>
                      {/* Image Header */}
                      <div style={{
                        height: '180px',
                        background: 'rgba(0,0,0,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        position: 'relative',
                        borderBottom: '1px solid var(--border)'
                      }}>
                        {/* Glassmorphic Background Processing Status Overlay */}
                        {p.extraction_status && p.extraction_status !== 'completed' && (
                          <div style={{
                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                            background: 'rgba(18, 18, 20, 0.88)', display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: '16px',
                            textAlign: 'center', backdropFilter: 'blur(4px)'
                          }}>
                            {p.extraction_status === 'pending' && (
                              <>
                                <div className="spinner" style={{ width: '22px', height: '22px', marginBottom: '8px', borderTopColor: '#0984e3' }}></div>
                                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#74b9ff' }}>⏳ AI Enrichment Pending</div>
                                <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.4' }}>Mengantre untuk dianalisis oleh Gemini...</div>
                              </>
                            )}
                            {p.extraction_status === 'pending_image' && (
                              <>
                                <div className="spinner" style={{ width: '22px', height: '22px', marginBottom: '8px', borderTopColor: '#e17055' }}></div>
                                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#ff7675' }}>🎨 Visual Rendering Queued</div>
                                <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.4' }}>Mengantre untuk render studio G-Labs...</div>
                              </>
                            )}
                            {p.extraction_status === 'generating_image' && (
                              <>
                                <div className="spinner" style={{ width: '22px', height: '22px', marginBottom: '8px', borderTopColor: '#fdcb6e' }}></div>
                                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#ffeaa7' }}>⚡ Generating Studio Shot</div>
                                <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.4' }}>G-Labs sedang memproses visual...</div>
                              </>
                            )}
                            {p.extraction_status === 'failed' && (
                              <>
                                <div style={{ fontSize: '1.4rem', marginBottom: '4px' }}>❌</div>
                                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--danger)' }}>Proses Gagal</div>
                                <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.4' }}>Terjadi kesalahan saat pengayaan AI/visual.</div>
                              </>
                            )}
                          </div>
                        )}

                        {displayPhotoUrl ? (
                          <div 
                            style={{ width: '100%', height: '100%', position: 'relative', cursor: 'zoom-in' }} 
                            className="thumbnail-container"
                            onClick={() => {
                              console.log("Zooming product photo:", displayPhotoUrl);
                              setZoomedImage(displayPhotoUrl);
                            }}
                          >
                            <img
                              src={displayPhotoUrl}
                              alt={p.product_name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            <div className="zoom-overlay" style={{
                              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                              background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center',
                              justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s', pointerEvents: 'none'
                            }}>
                              <span style={{ fontSize: '1.5rem', color: '#fff' }}>🔍 Zoom</span>
                            </div>
                          </div>
                        ) : (
                          <div 
                            onClick={() => document.getElementById(`upload-${p.id}-${activeTab}`).click()}
                            style={{ 
                              display: 'flex', 
                              flexDirection: 'column', 
                              alignItems: 'center', 
                              gap: '6px', 
                              cursor: 'pointer', 
                              width: '100%', 
                              height: '100%', 
                              justifyContent: 'center',
                              background: 'rgba(255,255,255,0.02)',
                              border: '2px dashed rgba(255,255,255,0.1)',
                              padding: '12px',
                              textAlign: 'center'
                            }}
                          >
                            <div style={{ fontSize: '2rem', opacity: 0.5 }}>📤</div>
                            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                              {uploadingProductId === p.id ? 'Mengunggah...' : `Unggah Foto ${activeTab === 'raw' ? 'Raw' : activeTab === 'cleaned' ? 'Clean' : 'Studio'}`}
                            </div>
                            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Belum ada foto. Klik untuk menambahkan.</div>
                          </div>
                        )}

                        {/* Hidden file inputs for upload */}
                        {['raw', 'cleaned', 'generated'].map(tab => (
                          <input
                            key={tab}
                            id={`upload-${p.id}-${tab}`}
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (file) {
                                handleUploadPhoto(p.id, tab, file);
                              }
                            }}
                            style={{ display: 'none' }}
                          />
                        ))}

                        {/* Use selected photo as active */}
                        {isTabAvailable(activeTab) && !isCurrentlyActive(activeTab) && (
                          <button
                            type="button"
                            onClick={() => handleSetActivePhoto(p.id, activeTab)}
                            style={{
                              position: 'absolute',
                              top: '12px',
                              right: '12px',
                              background: 'var(--accent)',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              fontSize: '0.62rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              zIndex: 12,
                              boxShadow: '0 2px 8px rgba(0,0,0,0.5)'
                            }}
                          >
                            ✓ Use {activeTab === 'raw' ? 'Raw' : activeTab === 'cleaned' ? 'Clean' : 'Studio'}
                          </button>
                        )}

                        {/* Replace photo button overlay */}
                        {isTabAvailable(activeTab) && (
                          <button
                            type="button"
                            onClick={() => document.getElementById(`upload-${p.id}-${activeTab}`).click()}
                            style={{
                              position: 'absolute',
                              top: '12px',
                              right: isTabAvailable(activeTab) && !isCurrentlyActive(activeTab) ? '95px' : '12px',
                              background: 'rgba(0, 0, 0, 0.65)',
                              border: '1px solid rgba(255,255,255,0.2)',
                              color: '#fff',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              fontSize: '0.62rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              zIndex: 12,
                              boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            disabled={uploadingProductId === p.id}
                          >
                            ✏️ {uploadingProductId === p.id ? 'Uploading...' : 'Ganti Foto'}
                          </button>
                        )}

                        {/* View Tab Selector overlay */}
                        <div style={{
                          position: 'absolute',
                          bottom: '0',
                          left: '0',
                          right: '0',
                          background: 'rgba(0, 0, 0, 0.75)',
                          display: 'flex',
                          justifyContent: 'space-around',
                          padding: '4px 0',
                          zIndex: 10,
                          backdropFilter: 'blur(4px)',
                          borderTop: '1px solid rgba(255,255,255,0.08)'
                        }}>
                          {['raw', 'cleaned', 'generated'].map(tab => {
                            const avail = isTabAvailable(tab);
                            const active = isCurrentlyActive(tab);
                            const selected = activeTab === tab;
                            return (
                              <button
                                key={tab}
                                type="button"
                                onClick={() => setViewTabs(prev => ({ ...prev, [p.id]: tab }))}
                                style={{
                                  background: selected ? 'rgba(108, 92, 231, 0.3)' : 'transparent',
                                  color: selected ? 'var(--accent-light)' : avail ? 'var(--text-secondary)' : 'rgba(255,255,255,0.4)',
                                  border: selected ? '1px solid var(--accent)' : 'none',
                                  borderRadius: '3px',
                                  padding: '2px 8px',
                                  fontSize: '0.65rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                {tab === 'raw' ? 'Raw' : tab === 'cleaned' ? 'Clean' : 'Studio'}
                                {active && <span style={{ color: 'var(--success-light)', fontSize: '8px' }}>●</span>}
                                {!avail && <span style={{ color: 'var(--text-muted)', fontSize: '9px', fontWeight: 'normal' }}>(kosong)</span>}
                              </button>
                            );
                          })}
                        </div>
                        
                        {/* Selection Checkbox */}
                        <div style={{
                          position: 'absolute',
                          top: '12px',
                          left: '12px',
                          zIndex: 10,
                          background: 'rgba(0, 0, 0, 0.5)',
                          borderRadius: '4px',
                          width: '24px',
                          height: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backdropFilter: 'blur(4px)',
                          border: selectedIds.includes(p.id) ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.2)'
                        }}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(p.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedIds(prev => [...prev, p.id]);
                              } else {
                                setSelectedIds(prev => prev.filter(id => id !== p.id));
                              }
                            }}
                            style={{
                              width: '14px',
                              height: '14px',
                              cursor: 'pointer',
                              margin: 0,
                              accentColor: 'var(--accent)'
                            }}
                          />
                        </div>

                        {/* Category badge */}
                        {p.category && (
                          <span style={{
                            position: 'absolute',
                            top: '12px',
                            left: '42px',
                            background: 'rgba(108, 92, 231, 0.85)',
                            color: '#fff',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: '4px',
                            backdropFilter: 'blur(4px)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            {p.category}
                          </span>
                        )}

                        {/* Marketplace icon badge */}
                        {p.source_url && (
                          <span style={{
                            position: 'absolute',
                            top: '12px',
                            right: '12px',
                            background: 'rgba(0,0,0,0.6)',
                            color: '#ccc',
                            fontSize: '0.65rem',
                            padding: '3px 6px',
                            borderRadius: '3px',
                          }}>
                            {p.source_url.includes('shopee') ? '🛒 Shopee' : p.source_url.includes('tokopedia') ? '🛒 Tokopedia' : '🛒 Store'}
                          </span>
                        )}
                      </div>

                      {/* Info body */}
                      <div style={{ padding: '16px 18px' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)', lineHeight: 1.3 }}>
                          {p.product_name}
                        </h3>

                        {/* Tampilkan Product UUID */}
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginBottom: '10px',
                          fontSize: '0.68rem',
                          fontFamily: 'var(--font-mono)',
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          color: 'var(--text-muted)'
                        }}>
                          <span>ID: {p.id.slice(0, 8)}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(p.id);
                              alert('ID produk berhasil disalin!');
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--accent-light)',
                              cursor: 'pointer',
                              padding: 0,
                              fontSize: '0.68rem',
                              display: 'inline-flex',
                              alignItems: 'center'
                            }}
                            title="Salin ID Lengkap"
                          >
                            📋
                          </button>
                        </div>

                        {/* Tags list */}
                        {tagsList.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '12px' }}>
                            {tagsList.map((t, idx) => (
                              <span key={idx} style={{
                                fontSize: '0.62rem',
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: 'var(--text-muted)',
                                padding: '2px 6px',
                                borderRadius: '10px'
                              }}>
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Physical State / Packaging info */}
                        {(p.packaging_type || p.is_in_packaging !== undefined) && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '12px',
                            fontSize: '0.72rem',
                            color: 'var(--text-secondary)'
                          }}>
                            <span style={{
                              background: 'rgba(255, 165, 0, 0.1)',
                              border: '1px solid rgba(255, 165, 0, 0.2)',
                              color: '#ffa502',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: 600
                            }}>
                              📦 {p.packaging_type || 'Tanpa Kemasan'}
                            </span>
                            <span style={{
                              background: (p.is_in_packaging === 1 || p.is_in_packaging === true) ? 'rgba(46, 204, 113, 0.1)' : 'rgba(231, 76, 60, 0.1)',
                              border: (p.is_in_packaging === 1 || p.is_in_packaging === true) ? '1px solid rgba(46, 204, 113, 0.2)' : '1px solid rgba(231, 76, 60, 0.2)',
                              color: (p.is_in_packaging === 1 || p.is_in_packaging === true) ? '#2ecc71' : '#e74c3c',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: 600
                            }}>
                              {(p.is_in_packaging === 1 || p.is_in_packaging === true) ? 'Di dalam Wadah' : 'Tembus Pandang/Terbuka'}
                            </span>
                          </div>
                        )}

                        {/* Status Badges for Product Truth & Geometric Truth */}
                        <div style={{
                          display: 'flex',
                          gap: '8px',
                          marginBottom: '12px',
                          fontSize: '0.68rem'
                        }}>
                          <span style={{
                            background: p.product_truth ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                            border: p.product_truth ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(255, 255, 255, 0.08)',
                            color: p.product_truth ? '#10b981' : 'var(--text-muted)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontWeight: 600
                          }}>
                            🛡️ {p.product_truth ? 'Product Truth OK' : 'No Product Truth'}
                          </span>
                          <span style={{
                            background: p.geometric_truth ? 'rgba(168, 85, 247, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                            border: p.geometric_truth ? '1px solid rgba(168, 85, 247, 0.2)' : '1px solid rgba(255, 255, 255, 0.08)',
                            color: p.geometric_truth ? '#a855f7' : 'var(--text-muted)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontWeight: 600
                          }}>
                            📐 {p.geometric_truth ? 'Geometry Truth OK' : 'No Geometry Truth'}
                          </span>
                        </div>

                        {/* Description */}
                        {p.product_description && (
                          <p style={{
                            fontSize: '0.78rem',
                            color: 'var(--text-muted)',
                            marginBottom: '14px',
                            lineHeight: 1.4,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}>
                            {p.product_description}
                          </p>
                        )}

                        {/* USP Points */}
                        {uspPoints.length > 0 && (
                          <div style={{
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.04)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '10px 14px',
                            marginBottom: '8px'
                          }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--accent-light)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              🌟 Unique Selling Proposition
                            </div>
                            <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {uspPoints.map((point, index) => (
                                <li key={index}>{point}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {p.source_url && (
                          <div style={{
                            fontSize: '0.7rem',
                            color: 'var(--text-muted)',
                            marginTop: '10px',
                            wordBreak: 'break-all',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <span style={{ fontWeight: 500 }}>🔗 Source:</span>
                            <a
                              href={p.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: 'var(--accent-light)', textDecoration: 'underline' }}
                              title={p.source_url}
                            >
                              {p.source_url.length > 38 ? p.source_url.substring(0, 35) + '...' : p.source_url}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Affiliate Link Input Area */}
                    <div style={{
                      padding: '12px 18px',
                      borderTop: '1px solid var(--border)',
                      background: 'rgba(0,0,0,0.08)'
                    }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '6px' }}>
                        Affiliate Link:
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Paste link afiliasi Anda..."
                          value={inlineAffiliateLinks[p.id] || ''}
                          onChange={e => {
                            const val = e.target.value;
                            setInlineAffiliateLinks(prev => ({ ...prev, [p.id]: val }));
                          }}
                          style={{ flex: 1, fontSize: '0.75rem', height: '32px', padding: '0 8px' }}
                        />
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleQuickSaveAffiliate(p.id)}
                          disabled={savingAffiliateId === p.id}
                          style={{ height: '32px', fontSize: '0.7rem', padding: '0 10px' }}
                        >
                          {savingAffiliateId === p.id ? '⏳' : 'Save'}
                        </button>
                        {inlineAffiliateLinks[p.id] && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleCopyLink(p.id)}
                            style={{ height: '32px', fontSize: '0.7rem', padding: '0 10px' }}
                          >
                            {copiedId === p.id ? '✓ Copied' : '📋 Copy'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Actions panel */}
                    <div style={{
                      padding: '10px 18px',
                      borderTop: '1px solid var(--border)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        Dibuat: {new Date(p.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                      </span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => handleEditProduct(p)} style={{ fontSize: '0.72rem', padding: '4px 10px' }}>
                          ✏️ Edit
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDeleteProduct(p.id)} style={{ fontSize: '0.72rem', padding: '4px 8px' }}>
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        </div>
      </main>

      {/* MODAL 1: BATCH SCRAPER */}
      {showScraperModal && (
        <div className="modal-backdrop" style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.8)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(6px)',
        }} onClick={() => setShowScraperModal(false)}>
          <div className="card" style={{
            width: '90%', maxWidth: '560px',
            maxHeight: '90vh',
            overflowY: 'auto',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '24px'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}><span style={{ color: 'var(--accent-light)' }}>⚡</span> Batch Product Scraper</h3>
              <button onClick={() => setShowScraperModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleSubmitScraper}>
              {/* Selector Tipe Input */}
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                  <input
                    type="radio"
                    name="scraperInputType"
                    value="urls"
                    checked={scraperInputType === 'urls'}
                    onChange={() => setScraperInputType('urls')}
                  />
                  Tulis URL Manual
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                  <input
                    type="radio"
                    name="scraperInputType"
                    value="csv"
                    checked={scraperInputType === 'csv'}
                    onChange={() => setScraperInputType('csv')}
                  />
                  Unggah File CSV
                </label>
              </div>

              {scraperInputType === 'csv' ? (
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Unggah Berkas CSV (Maks 50 baris data) *</label>
                  <input
                    type="file"
                    accept=".csv"
                    className="form-input"
                    onChange={e => setScraperCsvFile(e.target.files[0])}
                    required
                    style={{ width: '100%' }}
                  />
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.4 }}>
                    Pastikan berkas CSV memiliki kolom bertajuk <strong>URL Product</strong> dan <strong>URL Affiliates</strong>.
                  </div>
                </div>
              ) : (
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Daftar URL Produk (Maks 50 URL, Satu per Baris) *</label>
                  <textarea
                    className="form-textarea"
                    value={scraperUrls}
                    onChange={e => setScraperUrls(e.target.value)}
                    placeholder="Tempel link Shopee atau Tokopedia di sini...&#10;https://shopee.co.id/product-url-1&#10;https://tokopedia.com/product-url-2"
                    style={{ minHeight: '140px', fontSize: '0.82rem', fontFamily: 'monospace' }}
                    required
                  />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Kategori (Opsional)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={scraperCategory}
                    onChange={e => setScraperCategory(e.target.value)}
                    placeholder="Contoh: Skincare"
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Tags (Opsional, pisah koma)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={scraperTags}
                    onChange={e => setScraperTags(e.target.value)}
                    placeholder="Contoh: glowing, serum, lokal"
                  />
                </div>
              </div>

              {/* Repair Mode Checkbox Toggle */}
              <div style={{ 
                background: 'rgba(255, 255, 255, 0.03)', 
                border: '1px solid var(--border)', 
                borderRadius: '8px', 
                padding: '12px 16px', 
                marginBottom: '20px' 
              }}>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  gap: '10px', 
                  cursor: 'pointer', 
                  fontSize: '0.85rem', 
                  color: 'var(--text-primary)',
                  userSelect: 'none'
                }}>
                  <input
                    type="checkbox"
                    checked={repairMode}
                    onChange={(e) => setRepairMode(e.target.checked)}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <span style={{ fontWeight: '600' }}>Perbaiki & Lengkapi Data Produk yang Sudah Ada</span>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      Jika diaktifkan, URL produk yang sudah ada di database namun kekurangan aset visual (raw/clean/studio) atau USP/Kemasan akan di-scrape ulang/dilengkapi secara otomatis.
                    </p>
                  </div>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowScraperModal(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmittingScraper}>
                  {isSubmittingScraper ? '⏳ Mengantrekan...' : '🚀 Scrape Sekarang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD / EDIT FULL PRODUCT */}
      {showAddEditModal && (
        <div className="modal-backdrop" style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.8)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(6px)',
        }} onClick={() => { setShowAddEditModal(false); setEditingProduct(null); }}>
          <div className="card" style={{
            width: '90%', maxWidth: '640px',
            maxHeight: '90vh',
            overflowY: 'auto',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '24px'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>
                {editingProduct ? '✏️ Edit Data Produk' : '📦 Tambah Produk Manual'}
              </h3>
              <button onClick={() => { setShowAddEditModal(false); setEditingProduct(null); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleSaveProduct}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Nama Produk *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.product_name}
                    onChange={e => setFormData({ ...formData, product_name: e.target.value })}
                    placeholder="Nama produk..."
                    required
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Kategori</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Contoh: Skincare"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Tags (Pisah koma)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.tags}
                    onChange={e => setFormData({ ...formData, tags: e.target.value })}
                    placeholder="serum, glowing, lokal"
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Affiliate Link</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.affiliate_link}
                    onChange={e => setFormData({ ...formData, affiliate_link: e.target.value })}
                    placeholder="https://shope.ee/..."
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Deskripsi Produk</label>
                <textarea
                  className="form-textarea"
                  value={formData.product_description}
                  onChange={e => setFormData({ ...formData, product_description: e.target.value })}
                  placeholder="Deskripsi singkat mengenai produk..."
                  style={{ minHeight: '60px' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Unique Selling Proposition (USP) - Satu Poin per Baris</label>
                <textarea
                  className="form-textarea"
                  value={formData.unique_selling_point}
                  onChange={e => setFormData({ ...formData, unique_selling_point: e.target.value })}
                  placeholder="- Poin ke-1&#10;- Poin ke-2&#10;- Poin ke-3"
                  style={{ minHeight: '80px', fontFamily: 'monospace' }}
                />
              </div>

              {/* Seksi Pengaturan Kemasan & Prompts AI */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '16px',
                marginBottom: '16px'
              }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-light)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  📦 Kemasan & Prompt AI
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginBottom: '12px', alignItems: 'center' }}>
                  <div className="form-group" style={{ margin: 0, display: 'flex', alignItems: 'center', height: '40px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={formData.is_in_packaging === 1 || formData.is_in_packaging === true}
                        onChange={e => setFormData({ ...formData, is_in_packaging: e.target.checked ? 1 : 0 })}
                        style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--accent)' }}
                      />
                      Dalam Kemasan
                    </label>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.packaging_type}
                      onChange={e => setFormData({ ...formData, packaging_type: e.target.value })}
                      placeholder="Tipe Kemasan (misal: Botol Kaca, Kotak Kardus)"
                      disabled={!(formData.is_in_packaging === 1 || formData.is_in_packaging === true)}
                      style={{ opacity: (formData.is_in_packaging === 1 || formData.is_in_packaging === true) ? 1 : 0.5 }}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label" style={{ color: '#10b981', fontWeight: 600 }}>🛡️ Product Truth (T2I Physics & Packaging Lock)</label>
                  <textarea
                    className="form-textarea"
                    value={formData.product_truth}
                    onChange={e => setFormData({ ...formData, product_truth: e.target.value })}
                    placeholder="Deskripsi fisik kemasan resmi (misal: Official Omura Premium Cocoa Powder in an authentic standing aluminium foil sachet packaging...)"
                    style={{ minHeight: '60px', fontSize: '0.82rem', borderColor: 'rgba(16, 185, 129, 0.3)' }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label" style={{ color: '#a855f7', fontWeight: 600 }}>📐 Geometric Truth (I2V Geometry & Material Lock)</label>
                  <textarea
                    className="form-textarea"
                    value={formData.geometric_truth}
                    onChange={e => setFormData({ ...formData, geometric_truth: e.target.value })}
                    placeholder="Deskripsi geometri wadah & fisika permukaan (misal: Flexible standing sachet pouch, rectangular front face, metallic matte foil...)"
                    style={{ minHeight: '60px', fontSize: '0.82rem', borderColor: 'rgba(168, 85, 247, 0.3)' }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Prompt Studio Generator (T2I Prompt)</label>
                  <textarea
                    className="form-textarea"
                    value={formData.t2i_prompt}
                    onChange={e => setFormData({ ...formData, t2i_prompt: e.target.value })}
                    placeholder="Deskripsi visual untuk studio photo generator..."
                    style={{ minHeight: '60px', fontSize: '0.82rem' }}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Prompt Aksi Video (I2V Action Prompt)</label>
                  <textarea
                    className="form-textarea"
                    value={formData.i2v_action_prompt}
                    onChange={e => setFormData({ ...formData, i2v_action_prompt: e.target.value })}
                    placeholder="Petunjuk pergerakan kamera / aksi produk..."
                    style={{ minHeight: '60px', fontSize: '0.82rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Photo URL / Path</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.photo_url}
                    onChange={e => setFormData({ ...formData, photo_url: e.target.value })}
                    placeholder="/uploads/products/image.png"
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Original Source URL</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.source_url}
                    onChange={e => setFormData({ ...formData, source_url: e.target.value })}
                    placeholder="https://shopee.co.id/..."
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowAddEditModal(false); setEditingProduct(null); }}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary">
                  💾 Simpan Produk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: IMPORT PRODUCTS ZIP */}
      {showImportModal && (
        <div className="modal-backdrop" style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.8)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(6px)',
        }} onClick={() => setShowImportModal(false)}>
          <div className="card" style={{
            width: '90%', maxWidth: '480px',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '24px'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>📥 Import Product Database</h3>
              <button onClick={() => setShowImportModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px', lineHeight: 1.4 }}>
              Unggah berkas ZIP hasil ekspor untuk memindahkan daftar produk beserta gambar fisiknya. Produk yang tautan aslinya sudah ada di database ini akan secara otomatis dilewati untuk mencegah duplikasi.
            </p>

            <form onSubmit={handleImportSubmit}>
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label">Berkas ZIP Produk *</label>
                <input
                  type="file"
                  accept=".zip"
                  className="form-input"
                  onChange={e => setImportFile(e.target.files[0])}
                  required
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowImportModal(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={importing}>
                  {importing ? '⏳ Mengimpor...' : 'Mulai Impor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: IMPORT PRODUCTS CSV (v10.14.0) */}
      {showCsvImportModal && (
        <div className="modal-backdrop" style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.8)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(6px)',
        }} onClick={() => setShowCsvImportModal(false)}>
          <div className="card" style={{
            width: '90%', maxWidth: '500px',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '24px'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>📥 Import Raw CSV / Excel</h3>
              <button onClick={() => setShowCsvImportModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '16px', lineHeight: 1.4 }}>
              Unggah berkas CSV atau Excel mentah. Kolom yang wajib diisi adalah <b>Nama Produk Raw</b>. Kolom opsional: <b>Deskripsi Produk Raw</b>, <b>Link Produk</b>, dan <b>URL Foto Produk Raw</b>.
            </p>

            <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '4px', marginBottom: '20px', fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              💡 <b>Tips Kolom CSV/Excel:</b>
              <ul style={{ paddingLeft: '16px', margin: '4px 0 0 0' }}>
                <li><b>Nama Produk Raw</b> (nama_produk, product_name)</li>
                <li><b>Deskripsi Produk Raw</b> (deskripsi, description)</li>
                <li><b>Link Produk</b> (link_produk, source_url)</li>
                <li><b>URL Foto Produk Raw</b> (photo_url, image_url)</li>
              </ul>
            </div>

            <form onSubmit={handleCsvImportSubmit}>
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label">Berkas CSV/Excel (.csv, .xlsx) *</label>
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  className="form-input"
                  onChange={e => setCsvImportFile(e.target.files[0])}
                  required
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCsvImportModal(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={csvImporting}>
                  {csvImporting ? '⏳ Mengimpor...' : 'Mulai Impor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: IMAGE ZOOM PREVIEW */}
      {zoomedImage && (
        <div className="modal-backdrop" style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.85)', zIndex: 1050,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(10px)',
        }} onClick={() => setZoomedImage(null)}>
          <div style={{
            position: 'relative',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '20px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }} onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setZoomedImage(null)} 
              style={{ 
                position: 'absolute',
                top: '-15px',
                right: '-15px',
                background: 'var(--accent)',
                border: 'none',
                color: '#fff',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                fontSize: '1.1rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
                zIndex: 10
              }}
            >
              ✕
            </button>
            <div style={{
              width: '600px',
              height: '600px',
              maxWidth: '90vw',
              maxHeight: '90vw',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(0,0,0,0.4)'
            }}>
              <img 
                src={zoomedImage} 
                alt="Product Preview" 
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Pratinjau Foto Produk (600x600 px)
            </div>
          </div>
        </div>
      )}

      {/* Custom Styles for Product Database */}
      <style jsx global>{`
        .product-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 10px 20px rgba(0,0,0,0.3);
          border-color: rgba(108, 92, 231, 0.4) !important;
        }
        .thumbnail-container:hover .zoom-overlay {
          opacity: 1 !important;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
