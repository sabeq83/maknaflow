/**
 * Log Sanitizer Engine - MAKNA GRID
 * Mengubah log teknis backend poller/worker menjadi bahasa sederhana & ramah pengguna.
 * Melindungi detail arsitektur internal (API, AI Model, Vendor TTS, Database, Storage).
 */

const SANITIZER_RULES = [
  // 1. Inisiasi Kampanye & Mesin Poller
  { pattern: /=== MESIN (.*?) SINKRONISASI MULAI ===/i, replace: '🚀 === PROSES OTOMASI KAMPANYE DIMULAI ===' },
  { pattern: /=== MESIN (.*?) SINKRONISASI SELESAI ===/i, replace: '✅ === PROSES OTOMASI KAMPANYE SELESAI ===' },
  { pattern: /\[Scheduler\] Polling database for active jobs/i, replace: '⏳ Memeriksa antrean pekerjaan kampanye baru...' },
  { pattern: /Starting processing for task (.*?) \(Status: (.*?)\)/i, replace: '🚀 Memulai pembuatan materi video kampanye...' },
  
  // 2. Sourcing & Ekstraksi DNA Produk
  { pattern: /Scraping and extracting DNA for URL: (.*)/i, replace: '🔍 Mengestrak informasi produk dari tautan toko...' },
  { pattern: /Mengunduh gambar produk langsung dari URL: (.*)/i, replace: '🖼️ Memuat berkas gambar produk...' },
  { pattern: /Product image self-healing failed/i, replace: '⚠️ Menyesuaikan kembali pratinjau gambar produk...' },

  // 3. Scripting & Storyboard AI Generation
  { pattern: /Prompting Gemini for storyboard remake/i, replace: '📝 Merancang naskah narasi dan susunan adegan storyboard...' },
  { pattern: /Prompting Gemini Phase (.*)/i, replace: '📝 Memproses pembuatan ide cerita dan visual...' },
  { pattern: /Running Gemini script injection/i, replace: '✍️ Merajut naskah promosi produk ke dalam cerita...' },
  { pattern: /Executing executeWithKeyPool (.*)/i, replace: '💡 Menyusun konten naskah narasi...' },
  { pattern: /Storyboard successfully generated/i, replace: '✨ Naskah narasi dan storyboard adegan berhasil dibuat!' },

  // 4. Compliance & Audit TikTok Safe
  { pattern: /Running TikTok safe VO compliance audit/i, replace: '🛡️ Melakukan audit kepatuhan kebijakan TikTok Shop...' },
  { pattern: /TikTok safe VO audit completed/i, replace: '✅ Audit kepatuhan kebijakan TikTok selesai.' },

  // 5. Text-To-Speech (TTS) Voiceover Generation
  { pattern: /Creating TTS batch (.*)/i, replace: '🎙️ Menyiapkan sistem pembacaan suara narasi (Voiceover)...' },
  { pattern: /Rendering TTS clip (\d+)\/(\d+)/i, replace: '🎙️ Menggenerasi suara narasi adegan $1 dari $2...' },
  { pattern: /Concatenating TTS audio clips/i, replace: '🎵 Menyelaraskan ritme dan penggabungan audio narasi...' },
  { pattern: /Calling MiniMax (.*)/i, replace: '🎙️ Memproses audio narasi dengan karakter suara pilihan...' },
  { pattern: /Generating exact 8s audio/i, replace: '⏱️ Mempresisikan durasi waktu suara narasi adegan...' },

  // 6. Visual Animation & G-Labs Generation
  { pattern: /Submitting video tasks to G-Labs/i, replace: '🎬 Memproses pembuatan visual animasi adegan video...' },
  { pattern: /Hybrid Lock Clip: Generating start frame image for clip (\d+)/i, replace: '🖼️ Membuat gambar visual awal adegan $1...' },
  { pattern: /Hybrid Lock Clip: Generating video from start frame for clip (\d+)/i, replace: '📹 Menghasilkan pergerakan animasi adegan $1 dari gambar awal...' },
  { pattern: /Submitting T2V video task for clip (\d+)/i, replace: '🎬 Menghasilkan animasi visual adegan $1...' },
  { pattern: /Polling G-Labs visual task IDs/i, replace: '⏳ Rendering animasi visual sedang berlangsung...' },
  { pattern: /All visual generation completed/i, replace: '🎨 Seluruh adegan animasi visual berhasil di-render!' },
  { pattern: /Downloading visual clip (\d+) from/i, replace: '📥 Memuat berkas klip video adegan $1...' },

  // 7. Video Muxing & FFmpeg Processing
  { pattern: /Merging video clips without voiceover/i, replace: '🎞️ Penggabungan klip visual sedang diproses...' },
  { pattern: /Running FFmpeg Smart Sync Studio Muxing/i, replace: '✂️ Penggabungan akhir video, audio narasi, dan musik latar...' },
  { pattern: /FFmpeg video render completed/i, replace: '🎬 Render video final studio berhasil diselesaikan!' },

  // 8. Storage & Cloud Syncing
  { pattern: /Uploading narrative \.md to Nextcloud/i, replace: '☁️ Menyimpan dokumen naskah ke penyimpanan cloud...' },
  { pattern: /Uploading video to Nextcloud/i, replace: '☁️ Mengunggah video hasil produksi ke penyimpanan cloud...' },
  { pattern: /Nextcloud upload completed/i, replace: '✅ Berkas video dan dokumen berhasil disimpan di cloud!' },
  { pattern: /Writing data to TAB "(.*?)" in Google Sheet/i, replace: '📊 Menuliskan tautan hasil video ke Google Sheet ($1)...' },

  // 9. Task Status & Completions
  { pattern: /Task (.*?) completely finished/i, replace: '🎉 Materi video kampanye telah selesai diproduksi!' },
  { pattern: /Batch Mass Production "(.*?)" berhasil didaftarkan/i, replace: '🚀 Kampanye massal "$1" berhasil didaftarkan!' },

  // 10. OPC & Campaign Scheduler Log Sanitization
  { pattern: /OPC Scheduler status changed to: ACTIVE/i, replace: '⚙️ Status Mesin OPC Scheduler: AKTIF' },
  { pattern: /OPC Scheduler status changed to: INACTIVE/i, replace: '⚙️ Status Mesin OPC Scheduler: NON-AKTIF' },
  { pattern: /Campaign "(.*?)" updated: \[status: (.*?)\]/i, replace: '📋 Status Kampanye "$1" diperbarui: $2' },
  { pattern: /🚀 \[Campaign Scheduler\] Starting step \[(.*?)] for item #(\d+)\.\.\./i, replace: '🚀 Memulai tahapan $1 adegan #$2...' },
  { pattern: /✅ \[Campaign Scheduler\] Finished step \[(.*?)] for item #(\d+): (.*)/i, replace: '✅ Tahapan $1 adegan #$2 selesai.' },
  { pattern: /\[OPC Sourcing\] Menemukan cache produk di database untuk URL: (.*)\. Melewati JIT Sourcing\./i, replace: '📦 Memuat data produk terverifikasi dari database...' },
  { pattern: /\[Gemini API\] Menjalankan standard request menggunakan (.*)/i, replace: '💡 Merancang naskah narasi & adegan visual oleh AI...' },
  { pattern: /\[OPC Generator\] Item #(\d+): Running TikTok safe VO compliance checker\.\.\./i, replace: '🛡️ Memeriksa kepatuhan naskah TikTok Shop adegan #$1...' },
  { pattern: /\[OPC Generator\] Item #(\d+): Compliance audit finished with verdict (.*)/i, replace: '🛡️ Audit kepatuhan adegan #$1 selesai: Lolos Verifikasi Kepatuhan ($2).' },
  { pattern: /\[OPC Generator\] Item #(\d+): Applying Closed-Loop Auto-Rewrite for compliance/i, replace: '✍️ Menyesuaikan naskah adegan #$1 otomatis agar 100% patuh aturan TikTok Shop.' },
  { pattern: /\[OPC Analyzer T2I\] Mode hybrid_lock aktif\. Memulai pre-rendering T2I untuk seluruh (\d+) klip\.\.\./i, replace: '🎨 Mode Hybrid Lock aktif. Memulai pembuatan gambar start frame untuk $1 klip...' },
  { pattern: /\[OPC Analyzer T2I\] ✅ Product Base64 resolved successfully for bridging clip reference\./i, replace: '📸 Foto produk studio terverifikasi berhasil dimuat sebagai referensi visual.' },
  { pattern: /\[OPC Analyzer T2I\] Using Pola T2I: (.*)/i, replace: '⚡ Mengaktifkan mode pemrosesan gambar paralel (Pola: $1).' },
  { pattern: /\[OPC Analyzer T2I\] (?:\[(?:Threading|Sequential)\]\s*)?Submitting T2I task for clip (\d+)\.\.\./i, replace: '🚀 Mengirimkan permintaan pembuatan gambar start frame Klip $1 ke AI Studio...' },
  { pattern: /\[OPC Analyzer T2I\] (?:\[(?:Threading|Sequential)\]\s*)?T2I task (.*?) submitted for clip (\d+)\./i, replace: '🚀 Permintaan gambar start frame Klip $2 terdaftar di antrean AI Studio.' },
  { pattern: /\[OPC Analyzer T2I\] (?:\[(?:Threading|Sequential)\]\s*)?Starting batch polling for (\d+) T2I tasks\.\.\./i, replace: '⏳ Memantau proses rendering paralel untuk $1 gambar adegan...' },
  { pattern: /\[OPC Analyzer T2I\] (?:\[(?:Threading|Sequential)\]\s*)?T2I task (.*?) for clip (\d+) completed!/i, replace: '✅ Gambar start frame Klip $2 selesai dibuat oleh AI.' },
  { pattern: /\[OPC Analyzer T2I\] (?:\[(?:Threading|Sequential)\]\s*)?Downloading start frame for clip (\d+) from (.*)/i, replace: '💾 Menyimpan gambar start frame Klip $1 ke media storage server...' },
  { pattern: /\[INFO\] \[Webhook Client\] Safety delay active\. Waiting (\d+)s before submitting request to G-Labs\.\.\./i, replace: '⏳ Jeda keamanan $1s aktif sebelum pemicuan adegan berikutnya...' },
  { pattern: /\[ContentFlow Client\] Direct DB upsert item (.*?) successfully\./i, replace: '🔄 Berhasil menyinkronkan data video ke ContentFlow Internal.' },
  { pattern: /\[WARN\] \[Pillar Generator\] Failed to update Google Sheets: (.*)/i, replace: '' },

  // 11. General Technical Filtering, URL Masking & Cleanups
  { pattern: /\[(Scheduler Error|ERROR|G-Labs Warning)\] (.*)/i, replace: '⚠️ Catatan sistem: $2' },
  { pattern: /SELECT \* FROM (.*)/i, replace: '🔍 Memproses sinkronisasi data...' },
  { pattern: /https?:\/\/(shopee\.co\.id|tokopedia\.com|lazada\.co\.id|tiktok\.com|[\w.-]+\.com|[\w.-]+\.id)\/[^\s]+/gi, replace: '[Tautan Produk]' },
  { pattern: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, replace: '...' },
  { pattern: /id: [a-zA-Z0-9_-]{15,}/gi, replace: '' }
];

/**
 * Sanitizes a single log line into human-friendly language.
 */
export function sanitizeLogLine(line) {
  if (!line || typeof line !== 'string') return '';
  
  let sanitized = line;

  // Apply replacement rules
  for (const rule of SANITIZER_RULES) {
    if (rule.pattern.test(sanitized)) {
      sanitized = sanitized.replace(rule.pattern, rule.replace);
    }
  }

  // Remove raw technical headers if present
  sanitized = sanitized
    .replace(/^\[(Multiplier Worker|Bridge Bulk Scheduler|IFC Generator|IFC Sourcing|Scheduler|Scheduler Worker|OPC Sourcing|OPC Generator|Pillar Generator|Campaign Scheduler|Gemini API)\]\s*/i, '')
    .trim();

  return sanitized;
}

/**
 * Sanitizes full log content (multiline text).
 */
export function sanitizeLogContent(content) {
  if (!content || typeof content !== 'string') return '';

  const lines = content.split('\n');
  const processed = lines
    .map(line => sanitizeLogLine(line))
    .filter(line => line.length > 0);

  return processed.join('\n');
}
