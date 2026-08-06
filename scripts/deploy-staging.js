import { execSync } from 'child_process';

async function deployStaging() {
  console.log('================================================================');
  console.log('🚀 DEPLOYMENT TO STAGING GATEWAY (Port 5010 & 7010)');
  console.log('================================================================');
  console.log('📌 Specs: Intel Core i3 | RAM 16GB | Estimated Build Time: ~45-90s');

  const currentBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  let currentTag = '';
  try {
    currentTag = execSync('git describe --tags --exact-match HEAD 2>/dev/null').toString().trim();
  } catch (_) {}

  const checkoutTarget = currentTag || currentBranch || 'main';
  console.log(`📦 Active Local Target: ${checkoutTarget} (Tag: "${currentTag}", Branch: "${currentBranch}")`);

  const remoteScript = `
    export PATH=/home/sabeqmursyid/.local/bin:$PATH
    cd /home/sabeqmursyid/maknaflow-staging
    echo "[1/4] Pulling latest code (${checkoutTarget}) from GitHub..."
    git fetch --all --tags || true
    git checkout ${checkoutTarget} || git checkout -b ${checkoutTarget} origin/${checkoutTarget} || true
    git pull origin ${checkoutTarget} || git reset --hard origin/${checkoutTarget} || git reset --hard ${checkoutTarget} || true

    echo "[2/4] Building Next.js staging bundle..."
    npm run build

    echo "[3/4] Restarting Staging UI & API Server via systemd..."
    systemctl --user daemon-reload
    systemctl --user restart maknaflow-staging-api.service maknaflow-staging-ui.service

    echo "[4/4] Node 1 Staging Services Deployment Complete!"
  `;

  console.log('📡 Executing single-pass deployment to STAGING via SSH...');
  try {
    const cmd = `ssh -o ServerAliveInterval=15 -o ServerAliveCountMax=10 -o ConnectTimeout=30 makna-ui "${remoteScript.replace(/"/g, '\\"')}"`;
    execSync(cmd, { stdio: 'inherit', timeout: 300000 });
    console.log('\n🎉 Staging Deployment completed successfully!');
  } catch (err) {
    console.error('❌ Staging Deployment error:', err.message);
    process.exit(1);
  }
}

deployStaging().catch(console.error);
