import { execSync } from 'child_process';

async function deployMacMiniProd() {
  console.log('================================================================');
  console.log('🚀 LOCAL BUILD & DEPLOYMENT TO MAC MINI PRODUCTION (Port 5000 & 6000)');
  console.log('================================================================');

  // Step 1: Rsync source files to Mac Mini (excl node_modules, git, build dirs)
  console.log('\n📡 [1/2] Transferring source files to Mac Mini via Rsync...');
  const rsyncCmd = `rsync -avz --delete \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude '.env*' \
    --exclude 'logs' \
    --exclude '.next' \
    --exclude 'public/uploads' \
    --exclude 'public/temp' \
    ./ masbenu@100.95.245.55:~/maknaflow-production/`;
  execSync(rsyncCmd, { stdio: 'inherit' });

  // Step 2: Run build and startup on Mac Mini via SSH
  console.log('\n🔄 [2/2] Triggering remote build and PM2 reload on Mac Mini...');
  const remoteScript = `
    export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
    
    cd ~/maknaflow-production
    echo "Installing node dependencies..."
    npm install --no-audit --no-fund

    echo "Building Next.js bundle on remote server..."
    npm run build

    echo "Reloading production processes in PM2..."
    mkdir -p logs
    pm2 startOrGracefulReload ecosystem.macmini-prod.config.cjs --env production
  `;

  try {
    const sshCmd = `ssh -o ServerAliveInterval=15 -o ServerAliveCountMax=10 -o ConnectTimeout=30 masbenu@100.95.245.55 "${remoteScript.replace(/"/g, '\\"')}"`;
    execSync(sshCmd, { stdio: 'inherit', timeout: 300000 });
    console.log('\n🎉 Production Deployment completed successfully!');
  } catch (err) {
    console.error('❌ Production Deployment error:', err.message);
    process.exit(1);
  }
}

deployMacMiniProd().catch(console.error);
