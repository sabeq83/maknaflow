import { execSync } from 'child_process';

async function deployDev() {
  console.log('================================================================');
  console.log('🚀 DEPLOYMENT TO DEVELOPER SERVER (Port 5000 & 6000)');
  console.log('================================================================');
  console.log('📌 Server IP: 100.118.178.93 | Target User: sabeq83');

  const currentBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  let currentTag = '';
  try {
    currentTag = execSync('git describe --tags --exact-match HEAD 2>/dev/null').toString().trim();
  } catch (_) {}

  const checkoutTarget = currentTag || currentBranch || 'main';
  console.log(`📦 Active Local Target: ${checkoutTarget} (Tag: "${currentTag}", Branch: "${currentBranch}")`);

  const remoteScript = `
    export PATH=/home/sabeq83/.local/bin:$PATH
    cd /home/sabeq83/maknaflow
    echo "[1/4] Pulling latest code (${checkoutTarget}) from GitHub..."
    git fetch --all --tags || true
    git checkout ${checkoutTarget} || git checkout -b ${checkoutTarget} origin/${checkoutTarget} || true
    git pull origin ${checkoutTarget} || git reset --hard origin/${checkoutTarget} || git reset --hard ${checkoutTarget} || true

    echo "[2/4] Building Next.js developer bundle..."
    fuser -k -9 5000/tcp 2>/dev/null || true
    fuser -k -9 6000/tcp 2>/dev/null || true
    npm run build

    echo "[3/4] Restarting Developer UI (5000) & API Server (6000)..."
    fuser -k -9 5000/tcp 2>/dev/null || true
    fuser -k -9 6000/tcp 2>/dev/null || true
    sleep 1

    HOSTNAME=0.0.0.0 API_PORT=6000 nohup /home/sabeq83/.local/bin/node --env-file=.env.local apps/api/server.js < /dev/null > backend-api.log 2>&1 &
    HOSTNAME=0.0.0.0 PORT=5000 nohup /home/sabeq83/.local/bin/node node_modules/next/dist/bin/next start -H 0.0.0.0 -p 5000 < /dev/null > gateway.log 2>&1 &

    echo "[4/4] Developer Server Services Deployment Complete!"
  `;

  console.log('📡 Executing single-pass deployment to DEVELOPER via SSH...');
  try {
    const cmd = `ssh -o ServerAliveInterval=15 -o ServerAliveCountMax=10 -o ConnectTimeout=30 sabeq83@100.118.178.93 "${remoteScript.replace(/"/g, '\\"')}"`;
    execSync(cmd, { stdio: 'inherit', timeout: 300000 });
    console.log('\n🎉 Developer Server Deployment completed successfully!');
  } catch (err) {
    console.error('❌ Developer Server Deployment error:', err.message);
    process.exit(1);
  }
}

deployDev().catch(console.error);
