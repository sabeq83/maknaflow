import { execSync } from 'child_process';

async function deployMacMiniProd() {
  console.log('================================================================');
  console.log('🚀 LOCAL BUILD & DEPLOYMENT TO MAC MINI PRODUCTION (Port 5000 & 6000)');
  console.log('================================================================');

  // Step 1: Build Next.js bundle locally
  console.log('📦 [1/3] Building Next.js production bundle locally...');
  execSync('npm run build', { stdio: 'inherit' });

  // Step 2: Rsync files to Mac Mini (excl node_modules, git, env logs)
  console.log('\n📡 [2/3] Transferring build files to Mac Mini via Rsync...');
  const rsyncCmd = `rsync -avz --delete \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude '.env*' \
    --exclude 'logs' \
    ./ masbenu@100.73.95.3:~/maknaflow-production/`;
  execSync(rsyncCmd, { stdio: 'inherit' });

  // Step 3: Run production startup on Mac Mini via SSH
  console.log('\n🔄 [3/3] Triggering dependencies install and PM2 reload on Mac Mini...');
  const remoteScript = `
    export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
    
    cd ~/maknaflow-production
    echo "Installing production node dependencies..."
    npm install --production --no-audit --no-fund

    echo "Reloading production processes in PM2..."
    mkdir -p logs
    pm2 startOrGracefulReload ecosystem.macmini-prod.config.cjs --env production
  `;

  try {
    const sshCmd = `ssh -o ServerAliveInterval=15 -o ServerAliveCountMax=10 -o ConnectTimeout=30 masbenu@100.73.95.3 "${remoteScript.replace(/"/g, '\\"')}"`;
    execSync(sshCmd, { stdio: 'inherit', timeout: 300000 });
    console.log('\n🎉 Production Deployment completed successfully!');
  } catch (err) {
    console.error('❌ Production Deployment error:', err.message);
    process.exit(1);
  }
}

deployMacMiniProd().catch(console.error);
