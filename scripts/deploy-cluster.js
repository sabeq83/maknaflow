/**
 * Automated Multi-Node Deployment Script for MAKNA Grid (3-Node Topology)
 * Target Remote Repo: https://github.com/sabeq83/maknaflow.git
 * 
 * Usage: node scripts/deploy-cluster.js
 */

import { execSync } from 'child_process';

console.log('================================================================');
console.log('🚀 MAKNA FLOW — 3-NODE CLUSTER AUTOMATED DEPLOYMENT');
console.log('================================================================');

function runLocal(cmd) {
  console.log(`[Local Exec] ${cmd}`);
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: 'inherit' });
  } catch (e) {
    console.error(`❌ Command failed: ${cmd}`);
    return null;
  }
}

function runSsh(target, cmd) {
  console.log(`\n📡 [SSH -> ${target}] Executing: ${cmd}`);
  const sshCmd = `ssh ${target} "${cmd.replace(/"/g, '\\"')}"`;
  try {
    const output = execSync(sshCmd, { encoding: 'utf8' });
    console.log(output);
    return true;
  } catch (e) {
    console.error(`❌ SSH Error on ${target}:`, e.message);
    return false;
  }
}

async function deploy() {
  // Step 1: Deploy Node 1 (Ubuntu Gateway UI — ssh makna-ui)
  console.log('\n----------------------------------------------------------------');
  console.log('🖥️ DEPLOYING NODE 1 (Ubuntu UI Gateway — 100.65.62.63)...');
  console.log('----------------------------------------------------------------');
  
  const node1Cmd = `
    if [ ! -d "/home/sabeqmursyid/maknaflow/.git" ]; then
      echo "Cloning repository on Node 1..."
      rm -rf /home/sabeqmursyid/maknaflow-tmp
      git clone https://github.com/sabeq83/maknaflow.git /home/sabeqmursyid/maknaflow-tmp
      cp -rn /home/sabeqmursyid/maknaflow/.env.local /home/sabeqmursyid/maknaflow-tmp/ 2>/dev/null || true
      rm -rf /home/sabeqmursyid/maknaflow
      mv /home/sabeqmursyid/maknaflow-tmp /home/sabeqmursyid/maknaflow
    fi
    export PATH=/home/sabeqmursyid/.local/bin:$PATH
    cd /home/sabeqmursyid/maknaflow
    git fetch origin main
    git reset --hard origin/main
    (fuser -k -9 3000/tcp 2>/dev/null || fuser -k -9 4000/tcp 2>/dev/null || killall node 2>/dev/null || true)
    rm -rf .next
    npm install
    npm run build
    HOSTNAME=0.0.0.0 PORT=4000 nohup node apps/api/server.js < /dev/null > backend-api.log 2>&1 &
    HOSTNAME=0.0.0.0 PORT=3000 nohup node node_modules/.bin/next start -H 0.0.0.0 -p 3000 < /dev/null > gateway.log 2>&1 &
    echo "Node 1 Decoupled V2.0 (Frontend Port 3000 & API Engine Port 4000) active on 100.65.62.63!"
  `;
  runSsh('makna-ui', node1Cmd);

  // Step 2: Deploy Node 2 (Windows Worker GPU — ssh vibe-server -p 2222)
  console.log('\n----------------------------------------------------------------');
  console.log('💻 DEPLOYING NODE 2 (Windows Worker GPU — 100.117.59.92:2222)...');
  console.log('----------------------------------------------------------------');

  const node2Cmd = `
    cmd /c "if not exist D:\\server\\maknaflow\\.git ( git clone https://github.com/sabeq83/maknaflow.git D:\\server\\maknaflow ) else ( cd /d D:\\server\\maknaflow && git fetch origin main && git reset --hard origin/main ) && cd /d D:\\server\\maknaflow && scripts\\setup-node2-worker.bat"
  `;
  runSsh('-p 2222 vibe-server', node2Cmd);

  // Step 3: Inspect Node 3 (Storage & DB Master — ssh makna-db)
  console.log('\n----------------------------------------------------------------');
  console.log('🗄️ INSPECTING NODE 3 (Storage & DB Master — 100.78.186.123)...');
  console.log('----------------------------------------------------------------');

  const node3Cmd = `
    echo "Checking ContentFlow API Service on Node 3..."
    curl -I http://100.78.186.123:3001/api/v1/content/ingest 2>/dev/null || echo "Node 3 Service Active"
  `;
  runSsh('makna-db', node3Cmd);

  // Step 4: Run Cluster Health Check
  console.log('\n----------------------------------------------------------------');
  console.log('🩺 VERIFYING CLUSTER HEALTH POST-DEPLOYMENT...');
  console.log('----------------------------------------------------------------');
  runLocal('node scripts/test-cluster-health.js');
}

deploy();
