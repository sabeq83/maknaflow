import { execSync } from 'child_process';

async function deployMacMiniStaging() {
  console.log('================================================================');
  console.log('🚀 LOCAL BUILD & DEPLOYMENT TO MAC MINI STAGING (Port 5010 & 7010)');
  console.log('================================================================');

  // Step 1: Build Next.js bundle locally
  console.log('📦 [1/3] Building Next.js staging bundle locally...');
  execSync('npm run build', { stdio: 'inherit' });

  // Step 2: Rsync files to Mac Mini (excl node_modules, git, env logs)
  console.log('\n📡 [2/3] Transferring build files to Mac Mini via Rsync...');
  const rsyncCmd = `rsync -avz --delete \
    --exclude 'node_modules/' \
    --exclude '.git/' \
    --exclude '.env*' \
    --exclude 'logs/' \
    ./ masbenu@100.73.95.3:~/maknaflow-staging/`;
  execSync(rsyncCmd, { stdio: 'inherit' });

  // Step 3: Run staging startup on Mac Mini via SSH
  console.log('\n🔄 [3/3] Triggering dependencies install and PM2 reload on Mac Mini...');
  const remoteScript = `
    export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
    
    cd ~/maknaflow-staging
    echo "Installing staging node dependencies..."
    npm install --production --no-audit --no-fund

    echo "Reloading staging processes in PM2..."
    mkdir -p logs
    pm2 startOrGracefulReload ecosystem.macmini.config.cjs --env staging
  `;

  try {
    const sshCmd = `ssh -o ServerAliveInterval=15 -o ServerAliveCountMax=10 -o ConnectTimeout=30 masbenu@100.73.95.3 "${remoteScript.replace(/"/g, '\\"')}"`;
    execSync(sshCmd, { stdio: 'inherit', timeout: 300000 });
    console.log('\n🎉 Staging Deployment completed successfully!');
  } catch (err) {
    console.error('❌ Staging Deployment error:', err.message);
    process.exit(1);
  }
}

deployMacMiniStaging().catch(console.error);
