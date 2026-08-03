/**
 * MAKNA Flow — Deploy Script Node 2 (Windows/WSL 2)
 * Server   : 100.117.59.92 | SSH Alias: vibe-server | Port: 2222
 * Role     : Staging (isolated, PostgreSQL lokal di WSL 2)
 * Usage    : npm run deploy:node2-wsl
 *
 * Arsitektur eksekusi:
 *   Mac → SSH ke Windows (vibe-server:2222) → wsl -- bash -lc "..." → Ubuntu WSL
 *
 * ATURAN: Single-pass deployment (1x SSH call, no polling loop).
 */

import { execSync } from 'child_process';

// ── Konfigurasi ────────────────────────────────────────────────────────────
const SSH_HOST = 'vibe-server';          // ssh alias dari ~/.ssh/config
const SSH_PORT = 2222;                   // Port SSH Windows/WSL
const WSL_DISTRO = '';                   // Kosong = pakai default distro WSL
const LINUX_USER = 'sabeq83';           // Username Linux di dalam WSL (hasil: whoami = sabeq83)
const APP_DIR = '/mnt/d/server/maknaflow-staging'; // Drive D:\\server\\maknaflow-staging
const GITHUB_BRANCH = 'main';
const WEB_PORT = 5010;
const API_PORT = 7010;

// Estimasi waktu build di Windows/WSL: 3-8 menit
const SSH_TIMEOUT_MS = 600_000; // 10 menit

// ── Helper ─────────────────────────────────────────────────────────────────
function log(msg) {
  const ts = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' });
  console.log(`[${ts}] ${msg}`);
}

/**
 * Bungkus bash script untuk dieksekusi di WSL 2 via SSH ke Windows.
 * Perintah Windows: ssh vibe-server -p 2222 "wsl -- bash -lc '...'"
 */
function buildSshCommand(bashScript) {
  // Escape single quotes dalam bash script untuk shell Windows
  const escapedScript = bashScript.replace(/'/g, "'\\''");
  const wslCmd = WSL_DISTRO
    ? `wsl -d ${WSL_DISTRO} -- bash -lc '${escapedScript}'`
    : `wsl -- bash -lc '${escapedScript}'`;

  return [
    'ssh',
    `-p ${SSH_PORT}`,
    '-o ServerAliveInterval=30',
    '-o ServerAliveCountMax=20',
    '-o ConnectTimeout=30',
    '-o StrictHostKeyChecking=accept-new',
    SSH_HOST,
    `"${wslCmd}"`,
  ].join(' ');
}

// ── Main Deploy ────────────────────────────────────────────────────────────
async function deployNode2Wsl() {
  console.log('');
  console.log('================================================================');
  console.log('🚀 DEPLOY TO NODE 2 — Windows/WSL 2 Staging (Single-Pass)');
  console.log('================================================================');
  console.log(`📌 Target  : ${SSH_HOST} (100.117.59.92) port ${SSH_PORT}`);
  console.log(`📌 App Dir : ${APP_DIR} (WSL Ubuntu)`);
  console.log(`📌 Ports   : Web=${WEB_PORT}, API=${API_PORT}`);
  console.log(`📌 Timeout : ${SSH_TIMEOUT_MS / 1000}s`);
  console.log('');

  // ── Bash script yang berjalan di dalam WSL Ubuntu ─────────────────────
  const remoteScript = `
set -e

# Load NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"

echo ""
echo "================================================================"
echo "[Node 2 WSL] Starting single-pass deployment..."
echo "================================================================"

# Pastikan PostgreSQL berjalan
echo "[1/5] Ensuring PostgreSQL is running..."
sudo service postgresql start 2>/dev/null || true
sleep 1

# Pull kode terbaru
echo "[2/5] Pulling latest code from branch ${GITHUB_BRANCH}..."
cd ${APP_DIR}
git fetch origin ${GITHUB_BRANCH} 2>&1 | tail -5
git reset --hard origin/${GITHUB_BRANCH}
echo "  ✓ Git reset ke origin/${GITHUB_BRANCH}: $(git log -1 --format='%h %s')"

# Install/update dependencies (hanya jika package.json berubah)
echo "[3/5] Installing/updating npm dependencies..."
npm install --no-audit --no-fund --prefer-offline 2>&1 | tail -5
echo "  ✓ Dependencies up to date"

# Kill proses lama di port
echo "[4/5] Stopping old processes on ports ${WEB_PORT} & ${API_PORT}..."
pm2 delete maknaflow-staging-ui 2>/dev/null || true
pm2 delete maknaflow-staging-api 2>/dev/null || true
fuser -k -9 ${WEB_PORT}/tcp 2>/dev/null || true
fuser -k -9 ${API_PORT}/tcp 2>/dev/null || true
sleep 2
echo "  ✓ Old processes stopped"

# Build Next.js
echo "[5/5] Building Next.js bundle (estimasi 3-8 menit)..."
echo "  Started at: $(date '+%H:%M:%S')"
npm run staging:build
echo "  ✓ Build selesai: $(date '+%H:%M:%S')"

# Start via PM2 dengan env dari .env.staging.local
echo ""
echo "🔄 Starting services via PM2..."
set -a
source ${APP_DIR}/.env.staging.local
set +a
pm2 start ${APP_DIR}/ecosystem.staging.config.cjs --env staging
pm2 save

# Beri waktu proses naik
sleep 3

# Verifikasi
echo ""
echo "🩺 Verifying services..."
WEB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://127.0.0.1:${WEB_PORT} 2>/dev/null || echo "TIMEOUT")
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://127.0.0.1:${API_PORT}/health 2>/dev/null || echo "TIMEOUT")
echo "  Web UI  (${WEB_PORT}) → HTTP ${WEB_STATUS}"
echo "  API     (${API_PORT}) → HTTP ${API_STATUS}"

echo ""
echo "================================================================"
echo "📋 PM2 Status:"
pm2 list --no-color 2>/dev/null || true

echo ""
echo "================================================================"
echo "✅ Node 2 Staging Deployment SELESAI!"
echo "   Web : http://127.0.0.1:${WEB_PORT}"
echo "   API : http://127.0.0.1:${API_PORT}/health"
echo "================================================================"
`;

  // ── Eksekusi SSH (Single Call) ─────────────────────────────────────────
  log('📡 Mengirim single-pass deployment ke Node 2 via SSH...');
  log('⏳ Tunggu hingga selesai (build ~3-8 menit di Windows/WSL)...');
  console.log('');

  try {
    const cmd = buildSshCommand(remoteScript);
    execSync(cmd, { stdio: 'inherit', timeout: SSH_TIMEOUT_MS });

    console.log('');
    log('🎉 Deploy Node 2 WSL berhasil!');
    log(`🌐 Akses staging: http://100.117.59.92:${WEB_PORT} (butuh port forwarding Windows Firewall)`);
    log(`🌐 Akses dari WSL: http://127.0.0.1:${WEB_PORT}`);
  } catch (err) {
    console.error('');
    log(`❌ Deploy Node 2 gagal: ${err.message}`);
    log('💡 Tips:');
    log('   - Pastikan ssh alias "vibe-server" ada di ~/.ssh/config');
    log('   - Pastikan WSL 2 Ubuntu sudah di-setup (npm run setup:node2-wsl)');
    log('   - Cek: ssh -p 2222 vibe-server "wsl -- echo OK"');
    process.exit(1);
  }
}

deployNode2Wsl().catch(console.error);
