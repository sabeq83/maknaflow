'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/app/components/Sidebar';
import { ALL_MENU_KEYS } from '@/lib/schema/user-schema';

const emptyForm = { name: '', slug: '', timezone: 'Asia/Jakarta', admin_username: '', admin_email: '', admin_password: '' };

export default function TenantManagementPage() {
  const [tenants, setTenants] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Module / Menu Modal State
  const [menuModalTenant, setMenuModalTenant] = useState(null);
  const [currentDisabledMenus, setCurrentDisabledMenus] = useState([]);
  const [savingMenus, setSavingMenus] = useState(false);

  async function loadTenants() {
    setLoading(true);
    const response = await fetch('/api/admin/tenants', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) setMessage(data.error || 'Gagal memuat tenant.');
    else setTenants(data.tenants || []);
    setLoading(false);
  }

  useEffect(() => { loadTenants(); }, []);

  async function createTenant(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    const response = await fetch('/api/admin/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    const data = await response.json();
    if (!response.ok) setMessage(data.error || 'Gagal membuat tenant.');
    else {
      setMessage(`Tenant ${data.tenant.name} dan admin ${data.admin.username} berhasil dibuat.`);
      setForm(emptyForm);
      await loadTenants();
    }
    setSaving(false);
  }

  async function setStatus(tenant, status) {
    const response = await fetch(`/api/admin/tenants/${tenant.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const data = await response.json();
    setMessage(response.ok ? `Status ${tenant.name} menjadi ${status}.` : (data.error || 'Gagal mengubah status.'));
    if (response.ok) await loadTenants();
  }

  function openMenuModal(tenant) {
    setMenuModalTenant(tenant);
    let disabled = [];
    if (tenant.disabled_menus) {
      disabled = Array.isArray(tenant.disabled_menus)
        ? tenant.disabled_menus
        : (typeof tenant.disabled_menus === 'string' ? JSON.parse(tenant.disabled_menus) : []);
    }
    setCurrentDisabledMenus(disabled);
  }

  function toggleMenu(menuKey) {
    setCurrentDisabledMenus(prev => {
      if (prev.includes(menuKey)) {
        return prev.filter(k => k !== menuKey); // Un-disable (Enable)
      } else {
        return [...prev, menuKey]; // Disable (Lock)
      }
    });
  }

  async function saveTenantMenus() {
    if (!menuModalTenant) return;
    setSavingMenus(true);
    try {
      const response = await fetch(`/api/admin/tenants/${menuModalTenant.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disabled_menus: currentDisabledMenus })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal menyimpan modul menu.');
      setMessage(`Konfigurasi modul menu untuk tenant "${menuModalTenant.name}" berhasil disimpan.`);
      setMenuModalTenant(null);
      await loadTenants();
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingMenus(false);
    }
  }

  const field = (name, label, type = 'text') => (
    <label style={{ display: 'grid', gap: 6 }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
      <input className="form-input" type={type} value={form[name]} onChange={event => setForm({ ...form, [name]: event.target.value })} required={['name', 'admin_username', 'admin_password'].includes(name)} />
    </label>
  );

  // Group ALL_MENU_KEYS by category for clean presentation
  const categories = Array.from(new Set(ALL_MENU_KEYS.map(m => m.category)));

  return (
    <div className="layout-with-sidebar">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div><h1>Tenant Management</h1><p>Control-plane untuk tenant, modul sidebar, dan admin organisasi.</p></div>
        </div>
        {message && <div className="card" style={{ marginBottom: 16, padding: 14, background: 'var(--status-info-soft)', border: '1px solid var(--status-info-soft)' }}>{message}</div>}
        <form className="card" onSubmit={createTenant} style={{ padding: 20, marginBottom: 20 }}>
          <h2 style={{ marginTop: 0 }}>Buat Tenant Baru</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
            {field('name', 'Nama tenant')}{field('slug', 'Slug (opsional)')}{field('timezone', 'Zona waktu')}
            {field('admin_username', 'Username admin')}{field('admin_email', 'Email admin', 'email')}{field('admin_password', 'Password admin (min. 12)', 'password')}
          </div>
          <button className="btn btn-primary" disabled={saving} style={{ marginTop: 16 }}>{saving ? 'Membuat…' : 'Buat Tenant + Admin'}</button>
        </form>
        <div className="card" style={{ padding: 20, overflowX: 'auto' }}>
          <h2 style={{ marginTop: 0 }}>Daftar Tenant Platform</h2>
          {loading ? <p>Memuat…</p> : <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Tenant', 'Status', 'Timezone', 'User', 'Brand', 'Modul Terkunci', 'Aksi'].map(label => (
                  <th key={label} style={{ textAlign: 'left', padding: 10 }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>{tenants.map(tenant => {
              let disabledCount = 0;
              if (tenant.disabled_menus) {
                const arr = Array.isArray(tenant.disabled_menus) ? tenant.disabled_menus : JSON.parse(tenant.disabled_menus || '[]');
                disabledCount = arr.length;
              }
              return (
                <tr key={tenant.id} style={{ borderTop: '1px solid rgba(255,255,255,.08)' }}>
                  <td style={{ padding: 10 }}>
                    <strong>{tenant.name}</strong>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tenant.slug} · {tenant.id}</div>
                  </td>
                  <td style={{ padding: 10 }}>
                    <span style={{
                      fontSize: '0.75rem',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: tenant.status === 'active' ? 'var(--status-success-soft)' : 'var(--status-danger-soft)',
                      color: tenant.status === 'active' ? 'var(--status-success)' : 'var(--status-danger)',
                      fontWeight: 600
                    }}>
                      {tenant.status}
                    </span>
                  </td>
                  <td style={{ padding: 10 }}>{tenant.timezone}</td>
                  <td style={{ padding: 10 }}>{tenant.user_count}</td>
                  <td style={{ padding: 10 }}>{tenant.brand_count}</td>
                  <td style={{ padding: 10 }}>
                    {disabledCount > 0 ? (
                      <span style={{ fontSize: '0.8rem', color: 'var(--status-warning)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        🔒 {disabledCount} modul terkunci
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: 'var(--status-success)' }}>✓ Semua Aktif</span>
                    )}
                  </td>
                  <td style={{ padding: 10 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="btn"
                        style={{ background: 'var(--status-info-soft)', color: 'var(--status-info)', border: '1px solid var(--status-info-soft)', padding: '6px 12px', fontSize: '0.82rem' }}
                        onClick={() => openMenuModal(tenant)}
                      >
                        ⚙️ Modul Menu
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                        onClick={() => setStatus(tenant, tenant.status === 'active' ? 'suspended' : 'active')}
                      >
                        {tenant.status === 'active' ? 'Suspend' : 'Aktifkan'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}</tbody>
          </table>}
        </div>

        {/* MODAL KELOLA MODUL MENU TENANT */}
        {menuModalTenant && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'var(--overlay-backdrop)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: 20
          }}>
            <div className="card" style={{ width: '100%', maxWidth: '750px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>

              {/* Modal Header */}
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.25rem' }}>⚙️ Kelola Modul & Menu Sidebar</h2>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Tenant: <strong>{menuModalTenant.name}</strong> ({menuModalTenant.slug})
                  </p>
                </div>
                <button type="button" className="btn btn-secondary" onClick={() => setMenuModalTenant(null)} style={{ padding: '4px 10px' }}>✕</button>
              </div>

              {/* Quick Actions Bar */}
              <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border-color)', background: 'var(--surface-interactive)', display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Pintas:</span>
                <button
                  type="button"
                  className="btn"
                  style={{ background: 'var(--status-success-soft)', color: 'var(--status-success)', border: '1px solid var(--status-success-soft)', padding: '4px 10px', fontSize: '0.78rem' }}
                  onClick={() => setCurrentDisabledMenus([])}
                >
                  ✓ Aktifkan Semua Modul
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{ background: 'var(--status-danger-soft)', color: 'var(--status-danger)', border: '1px solid var(--status-danger-soft)', padding: '4px 10px', fontSize: '0.78rem' }}
                  onClick={() => setCurrentDisabledMenus(ALL_MENU_KEYS.map(m => m.key))}
                >
                  🔒 Kunci Semua Modul
                </button>
              </div>

              {/* Module List Body */}
              <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
                {categories.map(category => {
                  const categoryMenus = ALL_MENU_KEYS.filter(m => m.category === category);
                  return (
                    <div key={category} style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: '14px 18px', background: 'var(--surface-interactive)' }}>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--accent-color)' }}>{category}</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
                        {categoryMenus.map(menu => {
                          const isDisabled = currentDisabledMenus.includes(menu.key);
                          return (
                            <div
                              key={menu.key}
                              onClick={() => toggleMenu(menu.key)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 12px',
                                borderRadius: 6,
                                border: `1px solid ${isDisabled ? 'var(--status-danger-soft)' : 'var(--status-success-soft)'}`,
                                background: isDisabled ? 'rgba(239, 68, 68, 0.05)' : 'rgba(16, 185, 129, 0.05)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: '0.85rem' }}>{isDisabled ? '🔒' : '✅'}</span>
                                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: isDisabled ? 'var(--status-danger)' : 'var(--text-primary)' }}>{menu.label}</span>
                              </div>
                              <span style={{
                                fontSize: '0.72rem',
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: isDisabled ? 'var(--status-danger-soft)' : 'var(--status-success-soft)',
                                color: isDisabled ? 'var(--status-danger)' : 'var(--status-success)',
                                fontWeight: 700
                              }}>
                                {isDisabled ? 'TERKUNCI' : 'AKTIF'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Modal Footer */}
              <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setMenuModalTenant(null)}>Batal</button>
                <button type="button" className="btn btn-primary" disabled={savingMenus} onClick={saveTenantMenus}>
                  {savingMenus ? 'Menyimpan…' : '💾 Simpan Konfigurasi Modul'}
                </button>
              </div>

            </div>
          </div>
        )}

      </main>
    </div>
  );
}
