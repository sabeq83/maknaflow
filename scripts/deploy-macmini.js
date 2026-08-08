import { execSync } from 'child_process';

async function deployMacMiniStaging() {
  console.log('================================================================');
  console.log('🚀 LOCAL BUILD & DEPLOYMENT TO MAC MINI STAGING (Port 5010 & 7010)');
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
    ./ masbenu@100.73.95.3:~/maknaflow-staging/`;
  execSync(rsyncCmd, { stdio: 'inherit' });

  // Step 2: Run build and startup on Mac Mini via SSH
  console.log('\n🔄 [2/2] Triggering remote build and PM2 reload on Mac Mini...');
  const remoteScript = `
    export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
    
    cd ~/maknaflow-staging
    echo "Installing node dependencies..."
    npm install --no-audit --no-fund

    echo "Building Next.js bundle on remote server..."
    npm run build

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
