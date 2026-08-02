'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/app/components/Sidebar';

const emptyForm = { name: '', slug: '', timezone: 'Asia/Jakarta', admin_username: '', admin_email: '', admin_password: '' };

export default function TenantManagementPage() {
  const [tenants, setTenants] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

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

  const field = (name, label, type = 'text') => (
    <label style={{ display: 'grid', gap: 6 }}>
      <span style={{ fontSize: 12, color: '#a1a1aa' }}>{label}</span>
      <input className="form-input" type={type} value={form[name]} onChange={event => setForm({ ...form, [name]: event.target.value })} required={['name', 'admin_username', 'admin_password'].includes(name)} />
    </label>
  );

  return (
    <div className="layout-with-sidebar">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div><h1>Tenant Management</h1><p>Control-plane untuk tenant dan admin pertamanya.</p></div>
        </div>
        {message && <div className="card" style={{ marginBottom: 16, padding: 14 }}>{message}</div>}
        <form className="card" onSubmit={createTenant} style={{ padding: 20, marginBottom: 20 }}>
          <h2 style={{ marginTop: 0 }}>Buat Tenant</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
            {field('name', 'Nama tenant')}{field('slug', 'Slug (opsional)')}{field('timezone', 'Zona waktu')}
            {field('admin_username', 'Username admin')}{field('admin_email', 'Email admin', 'email')}{field('admin_password', 'Password admin (min. 12)', 'password')}
          </div>
          <button className="btn btn-primary" disabled={saving} style={{ marginTop: 16 }}>{saving ? 'Membuat…' : 'Buat Tenant + Admin'}</button>
        </form>
        <div className="card" style={{ padding: 20, overflowX: 'auto' }}>
          <h2 style={{ marginTop: 0 }}>Daftar Tenant</h2>
          {loading ? <p>Memuat…</p> : <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Tenant', 'Status', 'Timezone', 'User', 'Brand', 'API Key', 'Aksi'].map(label => <th key={label} style={{ textAlign: 'left', padding: 10 }}>{label}</th>)}</tr></thead>
            <tbody>{tenants.map(tenant => <tr key={tenant.id} style={{ borderTop: '1px solid rgba(255,255,255,.08)' }}>
              <td style={{ padding: 10 }}><strong>{tenant.name}</strong><div style={{ fontSize: 11, color: '#a1a1aa' }}>{tenant.slug} · {tenant.id}</div></td>
              <td style={{ padding: 10 }}>{tenant.status}</td><td style={{ padding: 10 }}>{tenant.timezone}</td>
              <td style={{ padding: 10 }}>{tenant.user_count}</td><td style={{ padding: 10 }}>{tenant.brand_count}</td><td style={{ padding: 10 }}>{tenant.key_count}</td>
              <td style={{ padding: 10 }}><button className="btn btn-secondary" onClick={() => setStatus(tenant, tenant.status === 'active' ? 'suspended' : 'active')}>{tenant.status === 'active' ? 'Suspend' : 'Aktifkan'}</button></td>
            </tr>)}</tbody>
          </table>}
        </div>
      </main>
    </div>
  );
}
