import styles from './YouTubeStudioWorkspace.module.css';

export function GuideView() {
  return (
    <article className={styles.guideContainer} style={{ padding: '24px', color: 'var(--text)' }}>
      <header style={{ marginBottom: '32px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--link)' }}>
          📖 Panduan Penggunaan YouTube Studio MAKNA Flow
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Panduan langkah-demi-langkah dari penyiapan dunia (Universe) hingga publikasi video final multi-speaker.
        </p>
      </header>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🌌</span> Langkah 1: Membuat &amp; Mengatur Universe
        </h2>
        <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '18px' }}>
          <p style={{ margin: '0 0 12px 0', fontSize: '0.9rem', lineHeight: '1.5' }}>
            Sebelum memulai produksi video, Anda wajib menyiapkan <strong>Universe (Dunia Cerita)</strong>. Universe berfungsi sebagai basis pengetahuan AI mengenai karakter, lokasi, dan latar belakang visual agar video yang dihasilkan konsisten.
          </p>
          <p style={{ margin: '0 0 12px 0', fontSize: '0.9rem', lineHeight: '1.5', padding: '10px 14px', background: 'rgba(52, 199, 89, 0.05)', border: '1px solid rgba(52, 199, 89, 0.2)', borderRadius: '6px' }}>
            <strong>💡 Fitur Unggulan: Build Universe with AI</strong><br />
            Anda tidak perlu membuat semuanya manual. Klik tombol <strong>Build Universe with AI</strong>, masukkan creative brief ringkas (misal: dongeng detektif kucing di kota tua), dan Gemini AI akan secara instan menyusun draf profil universe, karakter lengkap dengan canonical prompts, dan lokasi yang siap di-review.
          </p>
          <ol style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.88rem' }}>
            <li>Buka menu <strong>Settings &gt; Universes</strong> di sidebar utama.</li>
            <li>Klik <strong>Build Universe with AI</strong> untuk pembuatan otomatis, atau <strong>Create New Universe</strong> untuk manual.</li>
            <li>Saat me-review atau membuat karakter di tab <strong>Characters</strong>, perhatikan bidang <strong>Key / Speaker ID</strong> (misal: <code>cat_detective</code>):
              <ul style={{ paddingLeft: '20px', marginTop: '4px', listStyleType: 'circle' }}>
                <li><strong>Sangat Penting:</strong> Nilai <code>character_key</code> ini berfungsi sebagai <code>speaker_id</code> unik saat naskah dihasilkan oleh AI.</li>
                <li>Gunakan <code>speaker_id</code> ini pada konfigurasi <strong>Voice Overrides</strong> di series atau episode untuk menetapkan persona suara/TTS khusus bagi karakter tersebut.</li>
                <li>Tulis <strong>Canonical Prompt</strong> (detail pakaian, wajah, dan gaya visual subjek) untuk konsistensi AI Image generator.</li>
              </ul>
            </li>
            <li>Tambahkan <strong>Locations</strong> (Lokasi cerita) lengkap dengan deskripsi visual untuk memandu AI saat membuat scene.</li>
          </ol>
        </div>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📺</span> Langkah 2: Membuat Channel Strategy &amp; Brief
        </h2>
        <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '18px' }}>
          <p style={{ margin: '0 0 12px 0', fontSize: '0.9rem', lineHeight: '1.5' }}>
            Setiap channel memiliki positioning strategi unik yang memandu arah konten visual dan audio.
          </p>
          <ol style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.88rem' }}>
            <li>Masuk ke menu <strong>YouTube Studio</strong>, pilih channel Anda atau klik <strong>Create New Channel</strong>.</li>
            <li>Isi formulir <strong>Strategy Brief</strong>: topik (niche), target audience, durasi default, tautkan Universe yang sesuai, dan pilih preset Visual Identity.</li>
            <li>Klik <strong>Generate Strategy Draft (AI)</strong>. AI akan merumuskan content pillars, positioning, persona penonton, dan tone of voice.</li>
            <li>Review draf hasil formulasi, lalu klik <strong>Activate Strategy</strong>.</li>
            <li>Di bawah active strategy, klik <strong>✏️ Edit Narrative Defaults</strong> untuk menyetel setelan suara default (Mode Narasi, POV, Dialogue Ratio) yang akan diwarisi oleh naskah video Anda.</li>
          </ol>
        </div>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🎬</span> Langkah 3: Menyiapkan Series &amp; Episode Backlog
        </h2>
        <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '18px' }}>
          <p style={{ margin: '0 0 12px 0', fontSize: '0.9rem', lineHeight: '1.5' }}>
            Series merangkum daftar episode yang bertopik sama dalam satu playlist tematik.
          </p>
          <ol style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.88rem' }}>
            <li>Klik <strong>Create New Series</strong> di halaman detail Channel.</li>
            <li>Tentukan <strong>Series Narrative Format</strong> (misal: <em>Dialogue Driven</em>) dan daftarkan <strong>Recurring Cast Roster</strong> (pemeran tetap beserta pengisi suara default mereka).</li>
            <li>Klik <strong>Suggest Episode Ideas (AI)</strong> untuk menghasilkan backlog ide video otomatis berdasarkan content pillars.</li>
            <li>Klik tombol <strong>Adopt Idea</strong> pada salah satu draf ide untuk memindahkannya ke antrean episode aktif.</li>
          </ol>
        </div>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⚙️</span> Langkah 4: Story Setup &amp; AI Research (Tahap A &amp; B)
        </h2>
        <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '18px' }}>
          <p style={{ margin: '0 0 12px 0', fontSize: '0.9rem', lineHeight: '1.5' }}>
            Sebelum riset dimulai, Anda dapat mengkustomisasi alur narasi khusus untuk episode tersebut.
          </p>
          <ol style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.88rem' }}>
            <li>Buka Episode dari antrean backlog.</li>
            <li>Pada panel <strong>Episode Story Setup &amp; Cast Overrides</strong>:
              <ul style={{ paddingLeft: '20px', marginTop: '4px', listStyleType: 'circle' }}>
                <li>Tentukan mode narasi khusus, intensitas dialog (light/heavy), dan POV cerita.</li>
                <li>Tulis instruksi khusus pada bidang <strong>Special Narrative Instructions</strong>.</li>
                <li>Kelola daftar pemeran tamu (guest cast) khusus episode ini pada bagian <strong>Episode Cast</strong>.</li>
              </ul>
            </li>
            <li>Klik <strong>Save Story Setup</strong>.</li>
            <li>Klik <strong>Start AI Research</strong> untuk memulai analisis fakta, sudut pandang (angle), pemetaan pengetahuan karakter, dan mitigasi resiko narasi.</li>
          </ol>
        </div>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📐</span> Langkah 5: Blueprint &amp; Script Generation (Tahap C)
        </h2>
        <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '18px' }}>
          <p style={{ margin: '0 0 12px 0', fontSize: '0.9rem', lineHeight: '1.5' }}>
            Transformasi hasil riset menjadi timing alur video dan dialog suara yang seimbang.
          </p>
          <ol style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.88rem' }}>
            <li>Setelah riset selesai, klik <strong>Generate Blueprint</strong> untuk membagi alur video ke dalam chapters, lengkap dengan penempatan retensi visual dan outline dialog. Klik <strong>Approve Blueprint</strong>.</li>
            <li>Picu <strong>Generate Script</strong> untuk menulis naskah penuh (Script v2). AI akan menghasilkan scene detail beserta giliran dialog dalam format <strong>Audio Blocks</strong>.</li>
            <li>Periksa total kata dan estimasi durasi suara. Jika terlalu panjang/pendek, gunakan fitur <strong>Auto-Fit Script</strong> agar AI menulis ulang teks secara otomatis agar pas dengan durasi visual.</li>
            <li>Klik <strong>Approve Script</strong> untuk masuk ke tahap produksi visual dan audio.</li>
          </ol>
        </div>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🎙️</span> Langkah 6: Produksi Media &amp; Assembly (Tahap D &amp; E)
        </h2>
        <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '18px' }}>
          <p style={{ margin: '0 0 12px 0', fontSize: '0.9rem', lineHeight: '1.5' }}>
            Kini tiba waktunya menghasilkan gambar, video klip, dan suara TTS.
          </p>
          <ol style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.88rem' }}>
            <li>Pilih profil model generasi dan klik <strong>Generate Production Assets</strong>.</li>
            <li>Sistem akan mendaftarkan pekerjaan di antrean background worker:
              <ul style={{ paddingLeft: '20px', marginTop: '4px', listStyleType: 'circle' }}>
                <li><strong>Voiceover</strong>: Segmen suara per giliran bicara (TTS) dihasilkan menggunakan strategi segmented-turns (MiniMax / Google TTS). Pengisi suara ditentukan secara otomatis oleh resolver auto-casting.</li>
                <li><strong>Visuals</strong>: Menghasilkan gambar (T2I) dan video klip (I2V / T2V) secara paralel.</li>
              </ul>
            </li>
            <li>Anda dapat meninjau (play) hasil trek suara per segmen di tab Asset Progress. Bila pelafalannya salah, klik tombol <strong>Regen</strong> pada baris trek tersebut untuk merender ulang segmen suara itu saja.</li>
            <li>Setelah seluruh aset visual dan audio selesai digenerate, klik <strong>Trigger Assembly</strong>. FFmpeg akan menggabungkan trek audio block per scene, menyelaraskannya dengan visual, merender video final, dan menyusun file SRT subtitle secara otomatis.</li>
            <li>Tonton hasil render video final Anda di halaman review!</li>
          </ol>
        </div>
      </section>

      <footer style={{ marginTop: '48px', borderTop: '1px solid var(--border)', paddingTop: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        MAKNA Flow YouTube Studio Engine • Staging Environment
      </footer>
    </article>
  );
}
