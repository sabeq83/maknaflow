import { execSync } from 'child_process';

async function deployMacMiniDev() {
  console.log('================================================================');
  console.log('🚀 LOCAL BUILD & DEPLOYMENT TO MAC MINI DEV (Port 5020 & 7020)');
  console.log('================================================================');

  // Step 1: Build Next.js bundle locally
  console.log('📦 [1/3] Building Next.js dev bundle locally...');
  execSync('npm run build', { stdio: 'inherit' });

  // Step 2: Rsync files to Mac Mini (excl node_modules, git, env logs)
  console.log('\n📡 [2/3] Transferring build files to Mac Mini via Rsync...');
  const rsyncCmd = `rsync -avz --delete \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude '.env*' \
    --exclude 'logs' \
    ./ masbenu@100.73.95.3:~/maknaflow-dev/`;
  execSync(rsyncCmd, { stdio: 'inherit' });

  // Step 3: Run dev startup on Mac Mini via SSH
  console.log('\n🔄 [3/3] Triggering dependencies install and PM2 reload on Mac Mini...');
  const remoteScript = `
    export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
    
    cd ~/maknaflow-dev
    echo "Installing dev node dependencies..."
    npm install --production --no-audit --no-fund

    echo "Reloading dev processes in PM2..."
    mkdir -p logs
    pm2 startOrGracefulReload ecosystem.macmini.config.cjs --only maknaflow-dev-ui,maknaflow-dev-api
  `;

  try {
    const sshCmd = `ssh -o ServerAliveInterval=15 -o ServerAliveCountMax=10 -o ConnectTimeout=30 masbenu@100.73.95.3 "${remoteScript.replace(/"/g, '\\"')}"`;
    execSync(sshCmd, { stdio: 'inherit', timeout: 300000 });
    console.log('\n🎉 Dev Deployment completed successfully!');
  } catch (err) {
    console.error('❌ Dev Deployment error:', err.message);
    process.exit(1);
  }
}

deployMacMiniDev().catch(console.error);
