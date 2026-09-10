'use client';

import React from 'react';
import Link from 'next/link';
import ContentFlowLogo from '../components/ContentFlowLogo';
import ThemeToggle from '../components/ThemeToggle';

export default function PrivacyPolicyPage() {
  const lastUpdated = '10 September 2026';
  const siteUrl = 'https://contentflow-stg.ast402.my.id';

  const sections = [
    { id: 'ruang-lingkup', title: '1. Ruang Lingkup & Penegasan Akses Internal' },
    { id: 'data-dikumpulkan', title: '2. Data & Informasi yang Dikumpulkan' },
    { id: 'pemrosesan-ai', title: '3. Prinsip AI & Jaminan Non-Training' },
    { id: 'sub-processor', title: '4. Integrasi Pihak Ketiga & Sub-Processor' },
    { id: 'keamanan-data', title: '5. Keamanan Data & Isolasi Multi-Tenant' },
    { id: 'retensi-data', title: '6. Retensi & Penghapusan Berkas' },
    { id: 'hak-pengguna', title: '7. Hak Pengguna & Kepatuhan Regulasi' },
    { id: 'kebijakan-cookie', title: '8. Cookie Sesi & Local Storage' },
    { id: 'kontak-dpo', title: '9. Pembaruan Kebijakan & Kontak Tim IT' },
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
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '20px', background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#93C5FD', fontSize: '0.78rem', fontWeight: 700, marginBottom: '12px' }}>
            🔒 Kebijakan Privasi &amp; Perlindungan Data
          </div>
          <h1 style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)', fontWeight: 800, margin: '0 0 12px 0', letterSpacing: '-0.03em' }}>
            Kebijakan Privasi ContentFlow
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <span>Versi: <strong>2.0 (Enterprise Internal)</strong></span>
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
            ⚠️ <strong>Pemberitahuan Sistem Internal:</strong> Platform ContentFlow saat ini beroperasi eksklusif untuk kepentingan operasional internal perusahaan, unit bisnis, dan staf terverifikasi. Sistem ini belum dibuka untuk pendaftaran akun oleh publik/umum.
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
              Daftar Isi
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

          {/* POLICY TEXT ARTICLES */}
          <article style={{ lineHeight: 1.7, fontSize: '0.94rem', color: 'var(--text-secondary)' }}>

            {/* Section 1 */}
            <section id="ruang-lingkup" style={{ marginBottom: '40px', scrollMarginTop: '100px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px' }}>
                1. Ruang Lingkup &amp; Penegasan Akses Internal
              </h2>
              <p>
                Kebijakan Privasi ini menjelaskan bagaimana platform <strong>ContentFlow</strong> (diakses melalui <a href={siteUrl} style={{ color: 'var(--link)' }}>{siteUrl}</a>) mengelola, memproses, menyimpan, dan melindungi informasi data yang digunakan dalam operasional platform.
              </p>
              <p>
                ContentFlow adalah platform proprietary yang dikembangkan dan dioperasikan secara eksklusif untuk kebutuhan produksi konten internal perusahaan, manajemen kampanye digital, dan orkestrasi multimedia terdistribusi. Layanan ini <strong>tidak terbuka untuk pendaftaran publik mandiri</strong>, dan setiap akses pengguna tunduk pada verifikasi langsung oleh Administrator Sistem.
              </p>
            </section>

            {/* Section 2 */}
            <section id="data-dikumpulkan" style={{ marginBottom: '40px', scrollMarginTop: '100px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px' }}>
                2. Data &amp; Informasi yang Dikumpulkan
              </h2>
              <p>Dalam menjalankan fungsinya, ContentFlow memproses kategori data berikut:</p>
              <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li>
                  <strong>Informasi Autentikasi Pengguna:</strong> Username, email korporat, peran pengguna (Role: superadmin, admin, operator), dan log sesi terenkripsi.
                </li>
                <li>
                  <strong>Data Masukan Kreatif &amp; Naskah:</strong> Prompt AI, konsep storyboard, transkrip dialog multi-speaker, instruksi gaya visual, dan deskripsi produk.
                </li>
                <li>
                  <strong>Aset Multimedia &amp; Universe:</strong> Sampel audio untuk kloning suara (Voice Over reference), gambar identitas brand, thumbnail, dan video template yang diunggah.
                </li>
                <li>
                  <strong>Kredensial &amp; Token Integrasi Kanal:</strong> Access token API untuk distribusi konten otomatis (TikTok, Facebook Graph API, Instagram Graph API, Google Sheets).
                </li>
                <li>
                  <strong>Log Operasional &amp; Metrik Mesin:</strong> Log eksekusi render, status node PM2, metrik waktu pembuatan video, dan error diagnosis kluster.
                </li>
              </ul>
            </section>

            {/* Section 3 */}
            <section id="pemrosesan-ai" style={{ marginBottom: '40px', scrollMarginTop: '100px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px' }}>
                3. Prinsip AI &amp; Jaminan Non-Training (Zero Public AI Training)
              </h2>
              <p>
                Kami memegang teguh komitmen perlindungan kekayaan intelektual dan kerahasiaan perusahaan:
              </p>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '16px 20px', margin: '16px 0' }}>
                <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>
                  🔒 <strong>Jaminan Bebas Pelatihan Publik (Zero Data Training SLA):</strong> Seluruh naskah, ide kampanye, prompt, dan materi audio-visual internal yang diproses melalui API AI (termasuk Google Gemini, Anthropic Claude, dan ElevenLabs) <strong>TIDAK PERNAH</strong> digunakan untuk melatih model AI publik atau dibagikan ke pihak ketiga tanpa hak.
                </p>
              </div>
              <p>
                Pemrosesan kecerdasan buatan dilakukan melalui jalur API korporat resmi dengan isolasi sesi dan enkripsi TLS 1.3 selama transit.
              </p>
            </section>

            {/* Section 4 */}
            <section id="sub-processor" style={{ marginBottom: '40px', scrollMarginTop: '100px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px' }}>
                4. Integrasi Pihak Ketiga &amp; Sub-Processor
              </h2>
              <p>
                Untuk menghasilkan output multimedia berkualitas tinggi, ContentFlow berintegrasi dengan sub-processor berlisensi berikut:
              </p>
              <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li><strong>Google Cloud &amp; Gemini API:</strong> Pemrosesan Single-Pass Storyboard dan penalaran teks terstruktur.</li>
                <li><strong>ElevenLabs &amp; EdgeTTS:</strong> Sintesis suara multi-speaker dan text-to-speech berkualitas sinematik.</li>
                <li><strong>Repliz &amp; Video Automation Engines:</strong> Komposisi visual dan perenderan video otomatis.</li>
                <li><strong>Meta / TikTok / Google YouTube APIs:</strong> Distribusi konten terjadwal dan pelacakan status tayang.</li>
              </ul>
            </section>

            {/* Section 5 */}
            <section id="keamanan-data" style={{ marginBottom: '40px', scrollMarginTop: '100px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px' }}>
                5. Keamanan Data &amp; Isolasi Multi-Tenant
              </h2>
              <p>
                Infrastruktur ContentFlow beroperasi di atas kluster multi-node dengan mekanisme keamanan berlapis:
              </p>
              <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li><strong>Database Schema Isolation:</strong> Setiap lingkungan (Staging, Dev, dan Production) dan entitas tenant dipisahkan secara logis dalam schema PostgreSQL terisolasi.</li>
                <li><strong>Enkripsi Kredensial:</strong> Seluruh kata sandi akun dan API keys disimpan menggunakan hashing kriptografi satu arah (bcrypt) dan enkripsi level env.</li>
                <li><strong>Pembatasan Jaringan Node:</strong> Komunikasi antar-node (Mac Mini, Windows Worker, Database) dilindungi melalui jaringan privat terotentikasi.</li>
              </ul>
            </section>

            {/* Section 6 */}
            <section id="retensi-data" style={{ marginBottom: '40px', scrollMarginTop: '100px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px' }}>
                6. Retensi &amp; Penghapusan Berkas Sementara
              </h2>
              <p>
                Berkas audio/video sementara (*temp files*) yang dihasilkan selama proses kompilasi dihapus secara berkala oleh sistem pembersih otomatis (*cron housekeeping*) untuk menjaga performa penyimpanan dan kepatuhan data. Arsip konten yang telah terbit disimpan sesuai kebutuhan siklus hidup kampanye internal perusahaan.
              </p>
            </section>

            {/* Section 7 */}
            <section id="hak-pengguna" style={{ marginBottom: '40px', scrollMarginTop: '100px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px' }}>
                7. Hak Pengguna &amp; Kepatuhan Regulasi
              </h2>
              <p>
                ContentFlow mematuhi ketentuan perlindungan data yang berlaku di Republik Indonesia (termasuk Undang-Undang No. 27 Tahun 2022 tentang Perlindungan Data Pribadi / UU PDP) serta prinsip-prinsip umum GDPR:
              </p>
              <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li>Hak untuk mengetahui data apa saja yang disimpan mengenai akun Anda.</li>
                <li>Hak untuk meminta koreksi data yang tidak akurat melalui Administrator.</li>
                <li>Hak untuk meminta penonaktifan akun dan pembersihan data saat masa penugasan berakhir.</li>
              </ul>
            </section>

            {/* Section 8 */}
            <section id="kebijakan-cookie" style={{ marginBottom: '40px', scrollMarginTop: '100px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px' }}>
                8. Cookie Sesi &amp; Local Storage
              </h2>
              <p>
                Platform kami menggunakan cookie sesi (*Session Cookie*) bertanda <code>HttpOnly</code> semata-mata untuk memvalidasi status login yang aman, serta <code>localStorage</code> untuk menyimpan preferensi tema tampilan (Dark/Light mode). Kami <strong>tidak menggunakan cookie pelacak iklan pihak ketiga</strong>.
              </p>
            </section>

            {/* Section 9 */}
            <section id="kontak-dpo" style={{ marginBottom: '40px', scrollMarginTop: '100px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px' }}>
                9. Pembaruan Kebijakan &amp; Kontak Tim IT
              </h2>
              <p>
                Kebijakan Privasi ini dapat diperbarui sewaktu-waktu seiring pengembangan kapabilitas platform. Untuk pertanyaan, permohonan akses data, atau kendala terkait privasi sistem internal, silakan hubungi tim administrator melalui:
              </p>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '16px 20px', marginTop: '12px' }}>
                <div><strong>Tim IT &amp; Data Protection ContentFlow</strong></div>
                <div>Email Bantuan: <a href="mailto:support@ast402.my.id" style={{ color: 'var(--link)' }}>support@ast402.my.id</a></div>
                <div>Target URL: <a href={siteUrl} style={{ color: 'var(--link)' }}>{siteUrl}</a></div>
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
            <Link href="/terms" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Terms of Service</Link>
            <Link href="/" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Beranda</Link>
            <Link href="/login" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Portal Login</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
