/**
 * MAKNA Flow — Database Sync Script (Macbook Local Staging -> Node 2 WSL Staging)
 * File: scripts/sync-local-db-to-server.js
 *
 * Jalankan dari Macbook:
 *   node scripts/sync-local-db-to-server.js
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// ── Config ───────────────────────────────────────────────────────────────────
const LOCAL_PG_DUMP = '/Applications/Postgres.app/Contents/Versions/latest/bin/pg_dump';
const LOCAL_DB = {
  host: '127.0.0.1',
  port: 5432,
  user: 'maknaflow_staging',
  pass: 'makna_staging_local_2026',
  name: 'maknaflow_staging',
};

const REMOTE_SSH = {
  host: '100.117.59.92',
  user: 'Sabeq',
  port: 2222,
};

const REMOTE_DB = {
  user: 'maknaflow_staging',
  pass: 'MaknaStg2026!',
  name: 'maknaflow_staging',
};

const LOCAL_DUMP_FILE = path.join(process.cwd(), 'local_staging_dump.sql');
const REMOTE_DUMP_PATH_WIN = 'local_staging_dump.sql'; // Ditransfer ke Home default Windows (C:\Users\Sabeq\)
const REMOTE_DUMP_PATH_WSL = '/mnt/c/Users/Sabeq/local_staging_dump.sql'; // Diakses WSL via mount C:

async function syncDb() {
  console.log('================================================================');
  console.log('🔄 SYNC DATABASE: Local Macbook -> Node 2 Staging Server');
  console.log('================================================================');

  // 1. Verifikasi pg_dump lokal
  if (!fs.existsSync(LOCAL_PG_DUMP)) {
    console.error(`❌ pg_dump tidak ditemukan di path: ${LOCAL_PG_DUMP}`);
    console.log('💡 Silakan sesuaikan path pg_dump di dalam file script ini.');
    process.exit(1);
  }

  try {
    // 2. Dump database lokal
    console.log('📥 1. Dumping local PostgreSQL database...');
    const dumpCmd = `PGPASSWORD="${LOCAL_DB.pass}" "${LOCAL_PG_DUMP}" -h ${LOCAL_DB.host} -p ${LOCAL_DB.port} -U ${LOCAL_DB.user} -d ${LOCAL_DB.name} --clean --if-exists --no-owner --no-privileges -f "${LOCAL_DUMP_FILE}"`;
    execSync(dumpCmd, { stdio: 'inherit' });
    console.log('   ✓ Dump file berhasil dibuat lokal.');

    // 3. Transfer file via SCP ke server
    console.log('📡 2. Sending dump file to remote server via SCP...');
    const scpCmd = `scp -P ${REMOTE_SSH.port} -o StrictHostKeyChecking=no "${LOCAL_DUMP_FILE}" ${REMOTE_SSH.user}@${REMOTE_SSH.host}:${REMOTE_DUMP_PATH_WIN}`;
    execSync(scpCmd, { stdio: 'inherit' });
    console.log('   ✓ File berhasil dikirim ke server.');

    // 4. Restore file di level WSL server
    console.log('📤 3. Restoring database inside WSL server...');
    const wslRestoreCmd = `PGPASSWORD="${REMOTE_DB.pass}" psql -h 127.0.0.1 -U ${REMOTE_DB.user} -d ${REMOTE_DB.name} -f "${REMOTE_DUMP_PATH_WSL}"`;
    const sshCmd = `ssh -F /dev/null -p ${REMOTE_SSH.port} -o StrictHostKeyChecking=no ${REMOTE_SSH.user}@${REMOTE_SSH.host} "wsl -u sabeq83 -- bash -c '${wslRestoreCmd}'"`;
    execSync(sshCmd, { stdio: 'inherit' });
    console.log('   ✓ Database berhasil di-restore ke server.');

    // 5. Cleanup file
    console.log('🧹 4. Cleaning up temporary files...');
    if (fs.existsSync(LOCAL_DUMP_FILE)) {
      fs.unlinkSync(LOCAL_DUMP_FILE);
    }
    const cleanRemoteCmd = `ssh -F /dev/null -p ${REMOTE_SSH.port} -o StrictHostKeyChecking=no ${REMOTE_SSH.user}@${REMOTE_SSH.host} "wsl -u sabeq83 -- rm -f ${REMOTE_DUMP_PATH_WSL}"`;
    execSync(cleanRemoteCmd, { stdio: 'inherit' });
    console.log('   ✓ Cleanup selesai.');

    console.log('================================================================');
    console.log('🎉 SINKRONISASI DATABASE SELESAI DENGAN SUKSES!');
    console.log('================================================================');
  } catch (err) {
    console.error('\n❌ Gagal melakukan sinkronisasi database:', err.message);
    // Cleanup local file jika ada error
    if (fs.existsSync(LOCAL_DUMP_FILE)) {
      fs.unlinkSync(LOCAL_DUMP_FILE);
    }
    process.exit(1);
  }
}

syncDb();
