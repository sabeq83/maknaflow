import { execSync } from 'child_process';

async function deployStaging() {
  console.log('================================================================');
  console.log('🚀 DEPLOYMENT TO STAGING GATEWAY (Port 3010 & 4010)');
  console.log('================================================================');
  console.log('📌 Specs: Intel Core i3 | RAM 16GB | Estimated Build Time: ~45-90s');

  const remoteScript = `
    export PATH=/home/sabeqmursyid/.local/bin:$PATH
    cd /home/sabeqmursyid/maknaflow-staging
    echo "[1/4] Pulling latest main code from GitHub..."
    git fetch origin main || true
    git reset --hard origin/main || true

    echo "[2/4] Building Next.js staging bundle..."
    fuser -k -9 3010/tcp 2>/dev/null || true
    fuser -k -9 4010/tcp 2>/dev/null || true
    npm run build

    echo "[3/4] Restarting Staging UI (3010) & API Server (4010)..."
    fuser -k -9 3010/tcp 2>/dev/null || true
    fuser -k -9 4010/tcp 2>/dev/null || true
    sleep 1

    HOSTNAME=0.0.0.0 PORT=4010 nohup /home/sabeqmursyid/.local/bin/node apps/api/server.js < /dev/null > backend-api.log 2>&1 &
    HOSTNAME=0.0.0.0 PORT=3010 nohup /home/sabeqmursyid/.local/bin/node node_modules/next/dist/bin/next start -H 0.0.0.0 -p 3010 < /dev/null > gateway.log 2>&1 &

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
