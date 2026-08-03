#!/usr/bin/env bash
# =============================================================================
# MAKNA FLOW — NODE 2 (Windows/WSL 2) BOOTSTRAP SCRIPT
# Server  : 100.117.59.92  |  SSH Alias: vibe-server  |  Port: 2222
# Distro  : Ubuntu 22.04 LTS (WSL 2)
# Role    : Staging (isolated PostgreSQL lokal, port 5010 & 7010)
# Run     : Jalankan sekali saja di dalam shell WSL 2 Ubuntu Node 2
# Usage   : bash setup-node2-wsl.sh [username]
# =============================================================================
set -e

# ── Config ───────────────────────────────────────────────────────────────────
LINUX_USER="${1:-$(whoami)}"
APP_DIR="/mnt/d/server/maknaflow-staging"   # Drive D:\server\maknaflow-staging
GITHUB_REPO="https://github.com/sabeq83/maknaflow.git"
GITHUB_BRANCH="main"
NODE_VERSION="20"
PG_USER="maknaflow_staging"
PG_DB="maknaflow_staging"
WEB_PORT="5010"
API_PORT="7010"

echo "================================================================"
echo "  🚀 MAKNA Flow Node 2 (WSL 2) — One-Time Bootstrap"
echo "================================================================"
echo "  User     : ${LINUX_USER}"
echo "  App Dir  : ${APP_DIR}"
echo "  Branch   : ${GITHUB_BRANCH}"
echo "  Ports    : Web=${WEB_PORT}, API=${API_PORT}"
echo "================================================================"
echo ""

# ── Step 1: Update System ────────────────────────────────────────────────────
echo "[1/9] Updating system packages..."
sudo apt-get update -qq
sudo apt-get install -y -qq \
  curl wget git build-essential python3 python3-pip \
  ffmpeg ca-certificates gnupg lsb-release

# ── Step 2: Install PostgreSQL 15 ────────────────────────────────────────────
echo "[2/9] Installing PostgreSQL 15..."
if ! command -v psql &>/dev/null; then
  sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
  wget -qO- https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo tee /etc/apt/trusted.gpg.d/postgresql.asc > /dev/null
  sudo apt-get update -qq
  sudo apt-get install -y -qq postgresql-15 postgresql-client-15
else
  echo "  ✓ PostgreSQL sudah terinstall: $(psql --version)"
fi

# Start PostgreSQL (WSL 2 tidak punya systemd otomatis)
echo "  Starting PostgreSQL service..."
sudo service postgresql start || true
sleep 2

# ── Step 3: Setup PostgreSQL Role & Database ──────────────────────────────────
echo "[3/9] Setting up PostgreSQL staging database..."
# Generate password aman secara acak jika belum ada
PG_PASS=$(openssl rand -hex 20)

sudo -u postgres psql -c "
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${PG_USER}') THEN
      CREATE ROLE ${PG_USER} LOGIN PASSWORD '${PG_PASS}';
      RAISE NOTICE 'Role created';
    ELSE
      ALTER ROLE ${PG_USER} PASSWORD '${PG_PASS}';
      RAISE NOTICE 'Role password updated';
    END IF;
  END
  \$\$;
" 2>&1 | grep -v "^$" || true

sudo -u postgres psql -c "
  SELECT 1 FROM pg_database WHERE datname = '${PG_DB}';
" | grep -q 1 || sudo -u postgres psql -c "
  CREATE DATABASE ${PG_DB} OWNER ${PG_USER};
"

echo ""
echo "  ┌─────────────────────────────────────────────┐"
echo "  │  PostgreSQL Credentials (SIMPAN INI!)        │"
echo "  │  PGUSER     = ${PG_USER}          │"
echo "  │  PGPASSWORD = ${PG_PASS}          │"
echo "  │  PGDATABASE = ${PG_DB}          │"
echo "  └─────────────────────────────────────────────┘"
echo ""

# Simpan credentials ke file sementara agar setup berikutnya bisa baca
echo "${PG_PASS}" > /tmp/.makna_pg_pass_tmp

# ── Step 4: Install Node.js via NVM ──────────────────────────────────────────
echo "[4/9] Installing Node.js ${NODE_VERSION} via NVM..."
if [ ! -d "${HOME}/.nvm" ]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi

# Load nvm ke session sekarang
export NVM_DIR="${HOME}/.nvm"
# shellcheck source=/dev/null
[ -s "${NVM_DIR}/nvm.sh" ] && \. "${NVM_DIR}/nvm.sh"

nvm install "${NODE_VERSION}"
nvm use "${NODE_VERSION}"
nvm alias default "${NODE_VERSION}"

echo "  ✓ Node.js: $(node --version)"
echo "  ✓ npm: $(npm --version)"

# ── Step 5: Install PM2 globally ─────────────────────────────────────────────
echo "[5/9] Installing PM2 process manager..."
npm install -g pm2 --silent
echo "  ✓ PM2: $(pm2 --version)"

# ── Step 6: Clone Repository ──────────────────────────────────────────────────
echo "[6/9] Cloning MaknaFlow Staging repository..."
if [ -d "${APP_DIR}/.git" ]; then
  echo "  Repo sudah ada, melakukan pull terbaru..."
  cd "${APP_DIR}"
  git fetch origin "${GITHUB_BRANCH}"
  git reset --hard "origin/${GITHUB_BRANCH}"
else
  git clone --branch "${GITHUB_BRANCH}" "${GITHUB_REPO}" "${APP_DIR}"
  cd "${APP_DIR}"
fi

# ── Step 7: Generate .env.staging.local ──────────────────────────────────────
echo "[7/9] Generating .env.staging.local..."
PG_PASS_FINAL=$(cat /tmp/.makna_pg_pass_tmp 2>/dev/null || echo "CHANGE_ME")
ADMIN_PASS=$(openssl rand -hex 12)
OPERATOR_TOKEN=$(openssl rand -hex 32)

cat > "${APP_DIR}/.env.staging.local" << EOF
APP_ENV=staging
NODE_ENV=production
NODE_ROLE=standalone
TZ=Asia/Jakarta

HOSTNAME=127.0.0.1
PORT=${WEB_PORT}
API_HOST=127.0.0.1
API_PORT=${API_PORT}
STAGING_WEB_ORIGIN=http://127.0.0.1:${WEB_PORT}

PGHOST=127.0.0.1
PGPORT=5432
PGUSER=${PG_USER}
PGPASSWORD=${PG_PASS_FINAL}
PGDATABASE=${PG_DB}
PG_SEARCH_PATH=public
PGPOOL_MAX=4

STAGING_ADMIN_USERNAME=admin
STAGING_ADMIN_PASSWORD=${ADMIN_PASS}

ENABLE_BACKGROUND_SERVICES=true
ENABLE_CAMPAIGN_SCHEDULER=false
ENABLE_SCHEDULER_WORKER=false
ENABLE_OPERATOR_WORKER=true
MAKNA_SCHEDULER=0

MAKNA_OPERATOR_API_TOKEN=${OPERATOR_TOKEN}
MAKNA_OPERATOR_TENANT_ID=default_tenant
MAKNA_OPERATOR_BASE_URL=http://127.0.0.1:${WEB_PORT}
OPERATOR_WORKER_INTERVAL_MS=3000
OPERATOR_JOB_LOCK_TIMEOUT_MS=300000

REDIS_ENABLED=false
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
WEBHOOK_ENABLED=false
WEBHOOK_HOST=127.0.0.1
WEBHOOK_PORT=8765
CONTENT_FLOW_SYNC_ENABLED=false
NEXTCLOUD_SYNC_ENABLED=false
GOOGLE_INTEGRATION_ENABLED=false
SOCIAL_POSTING_ENABLED=false
ENABLE_CONTENT_AUTOMATION_WORKER=true
CONTENT_AUTOMATION_INTERVAL_MS=15000
ENABLE_CONTENT_AUTOMATION_NOTIFICATIONS=true
CONTENT_AUTOMATION_NOTIFICATION_INTERVAL_MS=10000
STAGING_WEB_ORIGIN=http://100.117.59.92:${WEB_PORT}
MAKNA_PUBLIC_BASE_URL=http://100.117.59.92:${WEB_PORT}
EOF

echo "  ✓ .env.staging.local generated"
echo ""
echo "  ┌──────────────────────────────────────────────────────────┐"
echo "  │  Admin Credentials untuk Login Staging                    │"
echo "  │  Username : admin                                          │"
echo "  │  Password : ${ADMIN_PASS}                    │"
echo "  └──────────────────────────────────────────────────────────┘"
echo ""

# ── Step 8: Install Dependencies & Build ─────────────────────────────────────
echo "[8/9] Installing npm dependencies (native rebuild untuk Linux)..."
cd "${APP_DIR}"
npm install --no-audit --no-fund

echo "  Running staging DB setup..."
node --input-type=module <<'SETUP_EOF'
import { execSync } from 'child_process';
execSync('node --experimental-vm-modules scripts/local-staging/setup.js 2>&1', { stdio: 'inherit', cwd: process.cwd() });
SETUP_EOF
npm run staging:setup || echo "  ⚠️  DB setup error — cek log di atas"

echo "  Building Next.js bundle (estimasi 3-8 menit di Windows/WSL)..."
npm run staging:build

# ── Step 9: Setup PM2 & Startup ───────────────────────────────────────────────
echo "[9/9] Configuring PM2 for staging..."
# Hentikan proses lama jika ada
pm2 delete maknaflow-staging-ui 2>/dev/null || true
pm2 delete maknaflow-staging-api 2>/dev/null || true

# Load env dari .env.staging.local ke proses PM2
set -a
# shellcheck source=/dev/null
source "${APP_DIR}/.env.staging.local"
set +a

pm2 start "${APP_DIR}/ecosystem.staging.config.cjs" --env staging
pm2 save

# Coba setup startup (mungkin tidak berjalan di WSL tanpa systemd)
echo "  Configuring PM2 auto-start on WSL launch..."
PM2_STARTUP=$(pm2 startup 2>&1 | grep "sudo env" || true)
if [ -n "${PM2_STARTUP}" ]; then
  eval "${PM2_STARTUP}" 2>/dev/null || echo "  ℹ️  Jalankan perintah startup PM2 secara manual jika diperlukan"
fi

# Buat script startup untuk WSL (karena systemd mungkin tidak aktif)
cat > "/home/${LINUX_USER}/start-makna-staging.sh" << 'STARTUP_EOF'
#!/usr/bin/env bash
sudo service postgresql start
export NVM_DIR="${HOME}/.nvm"
[ -s "${NVM_DIR}/nvm.sh" ] && \. "${NVM_DIR}/nvm.sh"
cd /mnt/d/server/maknaflow-staging
pm2 resurrect || pm2 start /mnt/d/server/maknaflow-staging/ecosystem.staging.config.cjs --env staging
pm2 logs --nostream
STARTUP_EOF
chmod +x "/home/${LINUX_USER}/start-makna-staging.sh"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "================================================================"
echo "  ✅ MAKNA Flow Node 2 WSL Bootstrap SELESAI!"
echo "================================================================"
echo ""
echo "  📡 Akses Staging:"
echo "    - Web UI  : http://127.0.0.1:${WEB_PORT} (dari dalam WSL)"
echo "    - API     : http://127.0.0.1:${API_PORT}/health"
echo "    - Tailscale: http://100.117.59.92:${WEB_PORT} (langsung via Tailscale)"
echo ""
echo "  📁 Lokasi File:"
echo "    - App     : /mnt/d/server/maknaflow-staging (= D:\\server\\maknaflow-staging)"
echo "    - Logs    : /mnt/d/server/maknaflow-staging/logs/"
echo ""
echo "  🔧 Perintah Berguna:"
echo "    pm2 status                   → lihat status proses"
echo "    pm2 logs                     → lihat semua log"
echo "    pm2 logs maknaflow-staging-ui → log web"
echo "    pm2 restart all              → restart semua"
echo "    ~/start-makna-staging.sh     → start ulang setelah Windows restart"
echo ""
echo "  ⚠️  PENTING — Simpan credentials ini:"
echo "    PG Password  : ${PG_PASS_FINAL}"
echo "    Admin Pass   : ${ADMIN_PASS}"
echo ""
echo "  📌 Langkah selanjutnya (dari Mac):"
echo "    1. Buka port di Windows Firewall (port ${WEB_PORT} & ${API_PORT})"
echo "    2. Jalankan: npm run deploy:node2-wsl"
echo "================================================================"

rm -f /tmp/.makna_pg_pass_tmp
