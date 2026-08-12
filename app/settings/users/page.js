'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Sidebar from '@/app/components/Sidebar';

export default function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [brands, setBrands] = useState([]);
  const [allMenus, setAllMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Main Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user',
    allowedMenuKeys: [],
    assignedBrandIds: []
  });

  // Dedicated Password Modal State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordTargetUser, setPasswordTargetUser] = useState(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordModalError, setPasswordModalError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [userRes, brandRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/brand-profiles')
      ]);

      const userData = await userRes.json();
      const brandData = await brandRes.json();

      if (userData.success) {
        setUsers(userData.users || []);
        setAllMenus(userData.allMenus || []);
      } else {
        setError(userData.error || 'Gagal memuat data pengguna');
      }

      if (Array.isArray(brandData)) {
        setBrands(brandData);
      } else if (brandData.success && Array.isArray(brandData.brands)) {
        setBrands(brandData.brands);
      }
    } catch (err) {
      setError('Terjadi kesalahan koneksi saat memuat data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({
      username: '',
      email: '',
      password: '',
      role: 'user',
      allowedMenuKeys: allMenus.map(m => m.key),
      assignedBrandIds: brands.map(b => b.id)
    });
    setIsModalOpen(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      email: user.email || '',
      password: '',
      role: user.role,
      allowedMenuKeys: (user.menuPermissions || []).map(m => m.menu_key),
      assignedBrandIds: (user.assignedBrands || []).map(b => b.brand_id)
    });
    setIsModalOpen(true);
  };

  const openPasswordModal = (user) => {
    setPasswordTargetUser(user);
    setNewPasswordInput('');
    setPasswordModalError('');
    setIsPasswordModalOpen(true);
  };

  const closePasswordModal = () => {
    setIsPasswordModalOpen(false);
    setPasswordTargetUser(null);
    setNewPasswordInput('');
    setPasswordModalError('');
  };

  const handleMenuToggle = (key) => {
    setFormData(prev => {
      const exists = prev.allowedMenuKeys.includes(key);
      return {
        ...prev,
        allowedMenuKeys: exists
          ? prev.allowedMenuKeys.filter(k => k !== key)
          : [...prev.allowedMenuKeys, key]
      };
    });
  };

  const handleBrandToggle = (brandId) => {
    setFormData(prev => {
      const exists = prev.assignedBrandIds.includes(brandId);
      return {
        ...prev,
        assignedBrandIds: exists
          ? prev.assignedBrandIds.filter(id => id !== brandId)
          : [...prev.assignedBrandIds, brandId]
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    try {
      const url = editingUser ? `/api/admin/users/${editingUser.id}` : '/api/admin/users';
      const method = editingUser ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(data.message || 'Pengguna berhasil disimpan');
        setIsModalOpen(false);
        fetchData();
      } else {
        setError(data.error || 'Gagal menyimpan pengguna');
      }
    } catch (err) {
      setError('Terjadi kesalahan jaringan saat menyimpan');
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordModalError('');

    if (!newPasswordInput || newPasswordInput.trim() === '') {
      setPasswordModalError('Password baru tidak boleh kosong');
      return;
    }

    setPasswordSubmitting(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await fetch(`/api/admin/users/${passwordTargetUser.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: newPasswordInput.trim() })
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(data.message || `Password ${passwordTargetUser.username} berhasil diubah!`);
        closePasswordModal();
        fetchData();
      } else {
        setPasswordModalError(data.error || 'Gagal mereset password');
      }
    } catch (err) {
      setPasswordModalError('Kesalahan jaringan saat mereset password');
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const handleDelete = async (userId, username) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus user '${username}'?`)) return;

    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`User '${username}' berhasil dihapus`);
        fetchData();
      } else {
        setError(data.error || 'Gagal menghapus user');
      }
    } catch (err) {
      setError('Kesalahan jaringan saat menghapus user');
    }
  };

  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        <div className="page-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
            <div>
              <h1 style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0, background: 'linear-gradient(135deg, var(--link) 0%, var(--status-neutral) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                👥 User Management & Menu Privileges
              </h1>
              <p style={{ color: 'var(--text-secondary, var(--text-muted))', fontSize: '0.9rem', marginTop: '6px' }}>
                Kelola pengguna, ubah password, matriks izin menu, dan penugasan Akun Brand (Multi-Tenant RBAC)
              </p>
            </div>
            <button
              onClick={openCreateModal}
              className="content-action content-action-download"
              style={{
                padding: '10px 18px',
              }}
            >
              ➕ Tambah User Baru
            </button>
          </div>

          {error && (
            <div style={{ background: 'var(--status-danger-soft)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#fca5a5', padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>
              ⚠️ {error}
            </div>
          )}

          {successMsg && (
            <div style={{ background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.4)', color: '#86efac', padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>
              ✅ {successMsg}
            </div>
          )}

          {/* Users Table */}
          <div className="user-table-shell" style={{ borderRadius: '12px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr className="user-table-head" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '14px 16px' }}>Username</th>
                  <th style={{ padding: '14px 16px' }}>Role</th>
                  <th style={{ padding: '14px 16px' }}>Akun Brand Ter-assign</th>
                  <th style={{ padding: '14px 16px' }}>Izin Menu Utama</th>
                  <th style={{ padding: '14px 16px', textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="user-table-row">
                    <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                      👤 {u.username}
                      {u.email && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.email}</div>}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span className={u.role === 'admin' ? 'user-role-admin' : 'user-role-user'} style={{
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}>
                        {u.role.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {u.role === 'admin' ? (
                        <span style={{ color: 'var(--link)', fontSize: '0.8rem' }}>🌟 Access All Brands</span>
                      ) : u.assignedBrands && u.assignedBrands.length > 0 ? (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {u.assignedBrands.map(b => (
                            <span key={b.brand_id} className="user-brand-badge" style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>
                              🏷️ {b.brand_name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Belum ada brand</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {u.role === 'admin' ? (
                        <span style={{ color: 'var(--status-neutral)', fontSize: '0.8rem' }}>🔒 Full All Menus</span>
                      ) : (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {(u.menuPermissions || []).length} / {allMenus.length} Menu Diizinkan
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <button
                        onClick={() => openPasswordModal(u)}
                        title="Ubah Password User"
                        style={{ background: 'rgba(234, 179, 8, 0.2)', color: 'var(--status-warning)', border: '1px solid rgba(234, 179, 8, 0.4)', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', marginRight: '6px', fontSize: '0.8rem' }}
                      >
                        🔑 Ubah Password
                      </button>
                      <button
                        onClick={() => openEditModal(u)}
                        style={{ background: 'var(--status-info-soft)', color: 'var(--link)', border: '1px solid rgba(59, 130, 246, 0.4)', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', marginRight: '6px', fontSize: '0.8rem' }}
                      >
                        ✏️ Edit
                      </button>
                      {u.id !== 'usr_admin_default' && (
                        <button
                          onClick={() => handleDelete(u.id, u.username)}
                          style={{ background: 'var(--status-danger-soft)', color: 'var(--status-danger)', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}
                        >
                          🗑️ Hapus
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Edit User Modal */}
          {isModalOpen && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--overlay-backdrop)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto' }}>
                <h2 style={{ fontSize: '1.4rem', margin: '0 0 20px 0', color: 'var(--text-primary)' }}>
                  {editingUser ? `✏️ Edit Pengguna: ${editingUser.username}` : '➕ Tambah Pengguna Baru'}
                </h2>

                <form onSubmit={handleSubmit}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Username</label>
                      <input
                        type="text"
                        required
                        disabled={!!editingUser}
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        style={{ width: '100%', padding: '10px', background: 'rgba(30, 41, 59, 0.8)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Password {editingUser && '(Kosongkan jika tak diubah)'}</label>
                      <input
                        type="password"
                        required={!editingUser}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder={editingUser ? '••••••••' : 'Masukkan password'}
                        style={{ width: '100%', padding: '10px', background: 'rgba(30, 41, 59, 0.8)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)' }}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Role</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      style={{ width: '100%', padding: '10px', background: 'rgba(30, 41, 59, 0.8)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)' }}
                    >
                      <option value="user">User Biasa (Terbatas per Brand & Menu)</option>
                      <option value="admin">Admin (Akses Full All System & Global View)</option>
                    </select>
                  </div>

                  {formData.role !== 'admin' && (
                    <>
                      {/* Brand Assignment Section */}
                      <div style={{ marginBottom: '20px', background: 'rgba(30, 41, 59, 0.5)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', color: 'var(--link)', marginBottom: '10px' }}>
                          🏷️ Penugasan Akun Brand (Multi-Brand Mapping)
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          {brands.map(b => (
                            <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                              <input
                                type="checkbox"
                                checked={formData.assignedBrandIds.includes(b.id)}
                                onChange={() => handleBrandToggle(b.id)}
                              />
                              {b.brand_name}
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Menu Access Matrix */}
                      <div style={{ marginBottom: '20px', background: 'rgba(30, 41, 59, 0.5)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', color: 'var(--status-neutral)', marginBottom: '10px' }}>
                          🔒 Access Permission
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          {allMenus.map(m => (
                            <label key={m.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                              <input
                                type="checkbox"
                                checked={formData.allowedMenuKeys.includes(m.key)}
                                onChange={() => handleMenuToggle(m.key)}
                              />
                              {m.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      style={{ padding: '10px 16px', background: 'rgba(148, 163, 184, 0.2)', border: 'none', borderRadius: '6px', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)', border: 'none', borderRadius: '6px', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Simpan Pengguna
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Dedicated Password Change Modal */}
          {isPasswordModalOpen && passwordTargetUser && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--overlay-backdrop)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1010, padding: '20px' }}>
              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '450px' }}>
                <h2 style={{ fontSize: '1.3rem', margin: '0 0 8px 0', color: 'var(--status-warning)' }}>
                  🔑 Ubah Password: {passwordTargetUser.username}
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Masukkan password baru untuk akun pengguna ini.
                </p>

                {passwordModalError && (
                  <div style={{ background: 'var(--status-danger-soft)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#fca5a5', padding: '10px', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '16px' }}>
                    ⚠️ {passwordModalError}
                  </div>
                )}

                <form onSubmit={handlePasswordSubmit}>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Password Baru
                    </label>
                    <input
                      type="password"
                      required
                      autoFocus
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      placeholder="Ketik password baru"
                      style={{ width: '100%', padding: '12px', background: 'rgba(30, 41, 59, 0.8)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.95rem' }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button
                      type="button"
                      onClick={closePasswordModal}
                      style={{ padding: '10px 16px', background: 'rgba(148, 163, 184, 0.2)', border: 'none', borderRadius: '6px', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={passwordSubmitting}
                      style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)', border: 'none', borderRadius: '6px', color: '#000', fontWeight: 700, cursor: passwordSubmitting ? 'wait' : 'pointer' }}
                    >
                      {passwordSubmitting ? 'Memproses...' : 'Simpan Password Baru'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
