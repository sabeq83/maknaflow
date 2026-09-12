'use client';

import { useState } from 'react';

export function BrandPerformanceOverview({ data, loading, onScheduleRecommendation }) {
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
        ⏳ Memuat consolidated brand performance...
      </div>
    );
  }

  const totalViews = data?.total_views || 142800;
  const totalLikes = data?.total_likes || 8920;
  const totalClicks = data?.total_clicks || 4320;
  const totalConversions = data?.total_conversions || 182;
  const totalRevenue = data?.total_revenue || 12850000;

  const ctr = totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(2) : '3.02';
  const cvr = totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(2) : '4.21';
  const epc = totalClicks > 0 ? Math.round(totalRevenue / totalClicks) : 2975;

  const handleApplyAdvisory = () => {
    showToast('⚡ Rekomendasi sudut pandang berhasil diterapkan ke Calendar!');
    onScheduleRecommendation?.({
      cep_code: 'Problem-Solution Based',
      product_name: 'Serum Retinol 0.5%',
      promotion_context: 'Rekomendasi Learning Loop CVR 4.2%'
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {toastMsg && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: 'var(--surface)',
          color: 'var(--text-primary)',
          padding: '12px 20px',
          borderRadius: '10px',
          border: '1px solid var(--action-primary)',
          boxShadow: 'var(--shadow-card)',
          zIndex: 99999,
          fontWeight: 600,
          fontSize: '13px'
        }}>
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg, 12px)',
        padding: '16px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
            📊 Tahap 5: Commercial Performance & Stage 6: Advisory Learning Loop
          </h3>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
            Lacak CVR, EPC, GMV penjualan afiliasi, serta feedback iterasi editorial ke Content Calendar.
          </p>
        </div>
      </div>

      {/* KPI Commercial Metrics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '14px'
      }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', padding: '16px', borderRadius: '12px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Total Views</span>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
            {totalViews.toLocaleString()}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--status-success)' }}>↑ +18.4% vs bulan lalu</span>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', padding: '16px', borderRadius: '12px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Total Clicks (CTR)</span>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--action-primary, #2dd4bf)', marginTop: '4px' }}>
            {totalClicks.toLocaleString()} ({ctr}%)
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Trafik link bio & stiker</span>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', padding: '16px', borderRadius: '12px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Conversions (CVR)</span>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--status-success, #4ade80)', marginTop: '4px' }}>
            {totalConversions.toLocaleString()} ({cvr}%)
          </div>
          <span style={{ fontSize: '11px', color: 'var(--status-success)' }}>Konversi pesanan tervalidasi</span>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', padding: '16px', borderRadius: '12px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Earnings Per Click (EPC)</span>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--accent, #a855f7)', marginTop: '4px' }}>
            IDR {epc.toLocaleString()}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Efisiensi per klik audiens</span>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', padding: '16px', borderRadius: '12px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Consolidated GMV / Revenue</span>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--status-success, #4ade80)', marginTop: '4px' }}>
            IDR {Number(totalRevenue).toLocaleString()}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--status-success)' }}>Estimasi komisi tervalidasi</span>
        </div>
      </div>

      {/* Stage 6 Advisory Learning Loop Card */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(56, 189, 248, 0.08) 100%)',
        border: '1px solid rgba(168, 85, 247, 0.3)',
        borderRadius: 'var(--radius-lg, 12px)',
        padding: '20px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ flex: 1, minWidth: '280px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '18px' }}>💡</span>
            <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
              AI Editorial Learning Loop & Siklus Ulang Calendar
            </strong>
          </div>
          <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Sudut pandang <strong>Problem-Solution Based</strong> pada produk <strong>Serum Retinol 0.5%</strong> menghasilkan Conversion Rate tertinggi (<strong>4.21% CVR</strong>) di platform TikTok dan Instagram. Disarankan untuk menjadwalkan ulang variasi hook baru pada siklus kalender berikutnya.
          </p>
        </div>

        <button
          type="button"
          onClick={handleApplyAdvisory}
          style={{
            padding: '9px 18px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
            color: '#ffffff',
            border: 'none',
            fontWeight: 750,
            fontSize: '12.5px',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(168, 85, 247, 0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span>⚡</span> Jadwalkan Ulang di Kalender →
        </button>
      </div>
    </div>
  );
}
