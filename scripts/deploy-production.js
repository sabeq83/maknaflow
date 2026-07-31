import { execSync } from 'child_process';

async function deployProduction() {
  console.log('================================================================');
  console.log('🚀 DEPLOYMENT TO PRODUCTION GATEWAY (Port 5000 & 6000)');
  console.log('================================================================');
  console.log('📌 Specs: Intel Core i3 | RAM 16GB | Estimated Build Time: ~45-90s');

  const remoteScript = `
    export PATH=/home/sabeqmursyid/.local/bin:$PATH
    cd /home/sabeqmursyid/maknaflow
    echo "[1/4] Pulling latest main code from GitHub..."
    git fetch origin main || true
    git reset --hard origin/main || true

    echo "[2/4] Building Next.js production bundle..."
    fuser -k -9 5000/tcp 2>/dev/null || true
    fuser -k -9 6000/tcp 2>/dev/null || true
    npm run build

    echo "[3/4] Restarting Production UI (5000) & API Server (6000)..."
    fuser -k -9 5000/tcp 2>/dev/null || true
    fuser -k -9 6000/tcp 2>/dev/null || true
    sleep 1

    HOSTNAME=0.0.0.0 PORT=6000 nohup /home/sabeqmursyid/.local/bin/node apps/api/server.js < /dev/null > backend-api.log 2>&1 &
    HOSTNAME=0.0.0.0 PORT=5000 nohup /home/sabeqmursyid/.local/bin/node node_modules/next/dist/bin/next start -H 0.0.0.0 -p 5000 < /dev/null > gateway.log 2>&1 &

    echo "[4/4] Node 1 Production Services Deployment Complete!"
  `;

  console.log('📡 Executing single-pass deployment to PRODUCTION via SSH...');
  try {
    const cmd = `ssh -o ServerAliveInterval=15 -o ServerAliveCountMax=10 -o ConnectTimeout=30 makna-ui "${remoteScript.replace(/"/g, '\\"')}"`;
    execSync(cmd, { stdio: 'inherit', timeout: 300000 });
    console.log('\n🎉 Production Deployment completed successfully!');
  } catch (err) {
    console.error('❌ Production Deployment error:', err.message);
    process.exit(1);
  }
}

deployProduction().catch(console.error);
