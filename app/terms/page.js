'use client';

import React from 'react';
import Link from 'next/link';
import ContentFlowLogo from '../components/ContentFlowLogo';
import ThemeToggle from '../components/ThemeToggle';

export default function TermsOfServicePage() {
  const lastUpdated = '10 September 2026';
  const siteUrl = 'https://contentflow-stg.ast402.my.id';

  const sections = [
    { id: 'penerimaan-syarat', title: '1. Penerimaan Syarat & Pembatasan Akses Internal' },
    { id: 'deskripsi-layanan', title: '2. Deskripsi Layanan Platform' },
    { id: 'keamanan-akun', title: '3. Keamanan Akun & Tanggung Jawab Pengguna' },
    { id: 'hak-cipta', title: '4. Hak Kekayaan Intelektual & Kepemilikan Konten' },
    { id: 'etika-penggunaan', title: '5. Kebijakan Penggunaan yang Diizinkan (AUP)' },
    { id: 'layanan-pihak-ketiga', title: '6. Integrasi & Batasan Kuota API Pihak Ketiga' },
    { id: 'sla-pemeliharaan', title: '7. Ketersediaan Sistem & Pemeliharaan Node' },
    { id: 'batasan-tanggung-jawab', title: '8. Batasan Tanggung Jawab & Sanksi' },
    { id: 'pengakhiran-akses', title: '9. Penangguhan & Pengakhiran Akses' },
    { id: 'hukum-berlaku', title: '10. Hukum yang Berlaku & Yurisdiksi' },
    { id: 'kontak-layanan', title: '11. Kontak Resmi & Dukungan Teknis' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column' }}>

      {/* HEADER */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 80,
          background: 'color-mix(in srgb, var(--canvas) 85%, transparent)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '14px 28px'
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <ContentFlowLogo variant="horizontal" size="sm" showTagline={true} />
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link
              href="/"
              style={{
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                fontSize: '0.88rem',
                fontWeight: 500,
                padding: '6px 12px',
                borderRadius: '8px',
                transition: 'background 0.2s'
              }}
            >
              ← Kembali ke Beranda
            </Link>
            <div style={{ width: '130px' }}>
              <ThemeToggle />
            </div>
            <Link
              href="/login"
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                background: 'var(--action-primary)',
                color: 'var(--on-action-primary)',
                textDecoration: 'none',
                fontSize: '0.85rem',
                fontWeight: 700
              }}
            >
              Portal Login
            </Link>
          </div>
        </div>
      </header>

      {/* HERO BANNER */}
      <div
        style={{
          background: 'linear-gradient(180deg, var(--surface-raised) 0%, var(--canvas) 100%)',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '48px 24px 36px 24px'
        }}
      >
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '20px', background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.3)', color: '#C084FC', fontSize: '0.78rem', fontWeight: 700, marginBottom: '12px' }}>
            📜 Syarat &amp; Ketentuan Layanan
          </div>
          <h1 style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)', fontWeight: 800, margin: '0 0 12px 0', letterSpacing: '-0.03em' }}>
            Syarat &amp; Ketentuan Layanan ContentFlow
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <span>Versi: <strong>2.0 (Enterprise Internal Terms)</strong></span>
            <span>•</span>
            <span>Terakhir Diperbarui: <strong>{lastUpdated}</strong></span>
            <span>•</span>
            <span>Domain: <a href={siteUrl} style={{ color: 'var(--link)', textDecoration: 'none' }}>{siteUrl}</a></span>
          </div>

          <div
            style={{
              marginTop: '20px',
              padding: '14px 18px',
              borderRadius: '12px',
              background: 'rgba(234, 179, 8, 0.1)',
              border: '1px solid rgba(234, 179, 8, 0.3)',
              color: '#fef08a',
              fontSize: '0.85rem',
              lineHeight: 1.5
            }}
          >
            ⚠️ <strong>Akses Khusus Internal Perusahaan:</strong> Syarat &amp; Ketentuan ini mengatur hak serta kewajiban operasional staf internal, pembuat konten terotorisasi, dan administrator. Penggunaan oleh publik/pihak luar yang tidak memiliki izin tertulis dilarang keras.
          </div>
        </div>
      </div>

      {/* MAIN CONTENT BODY WITH TOC */}
      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '48px 24px', flex: 1, width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 260px) minmax(0, 1fr)', gap: '40px', alignItems: 'start' }}>

          {/* STICKY TOC */}
          <aside
            style={{
              position: 'sticky',
              top: '90px',
              background: 'var(--surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '14px',
              padding: '20px',
              boxShadow: 'var(--shadow-card)'
            }}
          >
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>
              Daftar Pasal
            </div>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sections.map((sec) => (
                <a
                  key={sec.id}
                  href={`#${sec.id}`}
                  style={{
                    color: 'var(--text-muted)',
                    textDecoration: 'none',
                    fontSize: '0.82rem',
                    lineHeight: 1.4,
                    padding: '4px 6px',
                    borderRadius: '6px',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--link)';
                    e.currentTarget.style.background = 'var(--surface-raised)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-muted)';
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {sec.title}
                </a>
              ))}
            </nav>
          </aside>

          {/* TERMS TEXT ARTICLES */}
          <article style={{ lineHeight: 1.7, fontSize: '0.94rem', color: 'var(--text-secondary)' }}>

            {/* Section 1 */}
            <section id="penerimaan-syarat" style={{ marginBottom: '40px', scrollMarginTop: '100px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px' }}>
                1. Penerimaan Syarat &amp; Pembatasan Akses Internal
              </h2>
              <p>
                Dengan mengakses atau menggunakan platform <strong>ContentFlow</strong> (<a href={siteUrl} style={{ color: 'var(--link)' }}>{siteUrl}</a>), Anda menyatakan setuju untuk terikat oleh Syarat &amp; Ketentuan Layanan ini.
              </p>
              <p>
                Platform ini disediakan <strong>secara eksklusif untuk staf, karyawan, operator konten, dan divisi bisnis terotorisasi</strong> di lingkungan internal perusahaan. Akses oleh pihak umum tanpa persetujuan tertulis resmi dari pimpinan/administrator merupakan pelanggaran kebijakan keamanan informasi perusahaan.
              </p>
            </section>

            {/* Section 2 */}
            <section id="deskripsi-layanan" style={{ marginBottom: '40px', scrollMarginTop: '100px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px' }}>
                2. Deskripsi Layanan Platform
              </h2>
              <p>
                ContentFlow menyediakan lingkungan terintegrasi untuk:
              </p>
              <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li>Generasi naskah video dan visual prompts menggunakan <strong>Single-Pass AI Engine</strong>.</li>
                <li>Penyusunan naskah narasi sinematik multi-speaker melalui <strong>YouTube Studio</strong>.</li>
                <li>Analisis dan multiplikasi hook konten viral melalui <strong>Deconstruct &amp; Multiplier Labs</strong>.</li>
                <li>Penjadwalan massal melalui <strong>Sheets Autopilot</strong> dan distribusi otomatis ke TikTok, Facebook, dan Instagram.</li>
                <li>Perenderan video terdistribusi melalui kluster server 3-node (Mac Mini, Windows GPU Worker, dan Database PostgreSQL).</li>
              </ul>
            </section>

            {/* Section 3 */}
            <section id="keamanan-akun" style={{ marginBottom: '40px', scrollMarginTop: '100px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px' }}>
                3. Keamanan Akun &amp; Tanggung Jawab Pengguna
              </h2>
              <p>
                Setiap pengguna bertanggung jawab penuh atas kerahasiaan username dan kata sandi yang diterbitkan untuk akunnya. Dilarang keras membagikan kredensial login kepada pihak ketiga atau pihak non-karyawan. Segala aktivitas yang terjadi melalui akun Anda dianggap sebagai tindakan sah dari pemilik akun.
              </p>
            </section>

            {/* Section 4 */}
            <section id="hak-cipta" style={{ marginBottom: '40px', scrollMarginTop: '100px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px' }}>
                4. Hak Kekayaan Intelektual &amp; Kepemilikan Konten
              </h2>
              <p>
                Seluruh hak cipta, merek dagang, naskah narasi, suara sintetis, komposisi video, dan materi kreatif yang dihasilkan melalui ContentFlow merupakan <strong>hak milik eksklusif perusahaan/organisasi pemilik akun</strong>. Pengguna perorangan tidak berhak mengklaim kepemilikan pribadi atas aset internal yang dibuat menggunakan fasilitas platform ini di luar lingkup penugasan kerja resmi.
              </p>
            </section>

            {/* Section 5 */}
            <section id="etika-penggunaan" style={{ marginBottom: '40px', scrollMarginTop: '100px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px' }}>
                5. Kebijakan Penggunaan yang Diizinkan (Acceptable Use Policy)
              </h2>
              <p>Dalam memanfaatkan kapabilitas AI ContentFlow, seluruh pengguna dilarang keras untuk:</p>
              <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li>Menghasilkan konten yang melanggar hukum, memuat ujaran kebencian, pencemaran nama baik, atau materi pornografi/ilegal.</li>
                <li>Melakukan reverse-engineering atau membocorkan source code dan model prompt rahasia ContentFlow.</li>
                <li>Melakukan eksploitasi beban berlebih (DDoS, spam looping API, atau bypass batasan alokasi komputasi GPU).</li>
                <li>Mengunggah materi pihak ketiga yang melanggar hak cipta tanpa lisensi yang sah.</li>
              </ul>
            </section>

            {/* Section 6 */}
            <section id="layanan-pihak-ketiga" style={{ marginBottom: '40px', scrollMarginTop: '100px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px' }}>
                6. Integrasi &amp; Batasan Kuota API Pihak Ketiga
              </h2>
              <p>
                Layanan ini memanfaatkan API resmi dari mitra pihak ketiga (Google Gemini, ElevenLabs, Repliz, Meta Graph API, TikTok API). Ketersediaan fitur terkait bergantung pada kuota akun korporat dan SLA masing-masing penyedia layanan. Pengguna wajib mematuhi ketentuan batas laju pemanggilan (*rate limits*) yang telah dikonfigurasi.
              </p>
            </section>

            {/* Section 7 */}
            <section id="sla-pemeliharaan" style={{ marginBottom: '40px', scrollMarginTop: '100px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px' }}>
                7. Ketersediaan Sistem &amp; Pemeliharaan Node
              </h2>
              <p>
                Tim administrator berhak melakukan pemeliharaan rutin, pembaruan versi engine, atau pengalihan rute rendering antar-node server untuk menjaga performa optimal. Pemeliharaan terjadwal akan diinformasikan sebelumnya melalui saluran komunikasi internal.
              </p>
            </section>

            {/* Section 8 */}
            <section id="batasan-tanggung-jawab" style={{ marginBottom: '40px', scrollMarginTop: '100px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px' }}>
                8. Batasan Tanggung Jawab &amp; Sanksi
              </h2>
              <p>
                Platform disediakan *"sebagaimana adanya"* (*as-is*) untuk mendukung kelancaran operasional internal. Pelanggaran terhadap Syarat &amp; Ketentuan ini, terutama terkait kebocoran data rahasia atau penyalahgunaan API, dapat berakibat pada penonaktifan akun secara permanen dan tindakan disipliner internal sesuai peraturan perusahaan.
              </p>
            </section>

            {/* Section 9 */}
            <section id="pengakhiran-akses" style={{ marginBottom: '40px', scrollMarginTop: '100px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px' }}>
                9. Penangguhan &amp; Pengakhiran Akses
              </h2>
              <p>
                Superadministrator berhak menangguhkan atau mencabut hak akses pengguna kapan saja apabila terdeteksi aktivitas mencurigakan, mutasi penugasan kerja, atau berakhirnya masa kontrak operasional.
              </p>
            </section>

            {/* Section 10 */}
            <section id="hukum-berlaku" style={{ marginBottom: '40px', scrollMarginTop: '100px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px' }}>
                10. Hukum yang Berlaku &amp; Yurisdiksi
              </h2>
              <p>
                Syarat &amp; Ketentuan ini diatur dan ditafsirkan berdasarkan hukum Negara Kesatuan Republik Indonesia. Setiap perselisihan yang timbul akan diselesaikan secara musyawarah internal terlebih dahulu sebelum menempuh jalur hukum formal yang berwenang.
              </p>
            </section>

            {/* Section 11 */}
            <section id="kontak-layanan" style={{ marginBottom: '40px', scrollMarginTop: '100px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px' }}>
                11. Kontak Resmi &amp; Dukungan Teknis
              </h2>
              <p>
                Untuk permohonan penerbitan akun baru, pelaporan masalah teknis, atau pertanyaan seputar syarat operasional sistem internal, silakan hubungi:
              </p>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '16px 20px', marginTop: '12px' }}>
                <div><strong>Administrator Sistem &amp; IT Support ContentFlow</strong></div>
                <div>Email Bantuan: <a href="mailto:support@ast402.my.id" style={{ color: 'var(--link)' }}>support@ast402.my.id</a></div>
                <div>Domain Resmi: <a href={siteUrl} style={{ color: 'var(--link)' }}>{siteUrl}</a></div>
              </div>
            </section>

          </article>
        </div>
      </main>

      {/* FOOTER */}
      <footer style={{ background: 'var(--canvas)', borderTop: '1px solid var(--border-subtle)', padding: '24px', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>© 2026 ContentFlow Platform. Proprietary Internal System.</div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <Link href="/privacy" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Privacy Policy</Link>
            <Link href="/" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Beranda</Link>
            <Link href="/login" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Portal Login</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
