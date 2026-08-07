import { execSync } from 'child_process';

async function deployMacMini() {
  console.log('================================================================');
  console.log('🚀 DEPLOYMENT TO MAC MINI STAGING (Port 5010 & 7010)');
  console.log('================================================================');

  const currentBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  let currentTag = '';
  try {
    currentTag = execSync('git describe --tags --exact-match HEAD 2>/dev/null').toString().trim();
  } catch (_) {}

  const checkoutTarget = currentTag || currentBranch || 'main';
  console.log(`📦 Active Local Target: ${checkoutTarget} (Tag: "${currentTag}", Branch: "${currentBranch}")`);

  const remoteScript = `
    # Force PATH to include Homebrew bin directory on Apple Silicon and Intel Macs
    export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

    # Load profile to make brew, node, npm, pm2 accessible
    [ -f ~/.zprofile ] && source ~/.zprofile
    [ -f ~/.bash_profile ] && source ~/.bash_profile
    [ -f ~/.profile ] && source ~/.profile

    cd ~/maknaflow-staging
    echo "[1/4] Pulling latest code (${checkoutTarget}) from GitHub..."
    git fetch --all --tags || true
    git checkout ${checkoutTarget} || git checkout -b ${checkoutTarget} origin/${checkoutTarget} || true
    git pull origin ${checkoutTarget} || git reset --hard origin/${checkoutTarget} || git reset --hard ${checkoutTarget} || true

    echo "[2/4] Installing dependencies & building staging bundle..."
    npm install --production=false
    npm run build

    echo "[3/4] Restarting Staging UI & API Server via PM2..."
    mkdir -p logs
    pm2 startOrGracefulReload ecosystem.macmini.config.cjs --env staging

    echo "[4/4] Mac Mini Staging Services Deployment Complete!"
  `;

  console.log('📡 Executing single-pass deployment to MAC MINI via SSH...');
  try {
    const cmd = `ssh -o ServerAliveInterval=15 -o ServerAliveCountMax=10 -o ConnectTimeout=30 masbenu@100.73.95.3 "${remoteScript.replace(/"/g, '\\"')}"`;
    execSync(cmd, { stdio: 'inherit', timeout: 300000 });
    console.log('\n🎉 Mac Mini Staging Deployment completed successfully!');
  } catch (err) {
    console.error('❌ Mac Mini Staging Deployment error:', err.message);
    process.exit(1);
  }
}

deployMacMini().catch(console.error);
