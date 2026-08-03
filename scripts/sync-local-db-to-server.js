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
const LOCAL_PG_DUMP = process.env.MAKNA_SYNC_PG_DUMP || '/Applications/Postgres.app/Contents/Versions/latest/bin/pg_dump';
const LOCAL_DB = {
  host: process.env.MAKNA_SYNC_LOCAL_PGHOST || '127.0.0.1',
  port: Number(process.env.MAKNA_SYNC_LOCAL_PGPORT || 5432),
  user: process.env.MAKNA_SYNC_LOCAL_PGUSER || 'maknaflow_staging',
  pass: process.env.MAKNA_SYNC_LOCAL_PGPASSWORD || '',
  name: process.env.MAKNA_SYNC_LOCAL_PGDATABASE || 'maknaflow_staging',
};

const REMOTE_SSH = {
  host: process.env.MAKNA_SYNC_SSH_HOST || '100.117.59.92',
  user: process.env.MAKNA_SYNC_SSH_USER || 'Sabeq',
  port: Number(process.env.MAKNA_SYNC_SSH_PORT || 2222),
};

const REMOTE_DB = {
  user: process.env.MAKNA_SYNC_REMOTE_PGUSER || 'maknaflow_staging',
  pass: process.env.MAKNA_SYNC_REMOTE_PGPASSWORD || '',
  name: process.env.MAKNA_SYNC_REMOTE_PGDATABASE || 'maknaflow_staging',
};

const LOCAL_DUMP_FILE = path.join(process.cwd(), 'local_staging_dump.sql');
const REMOTE_DUMP_PATH_WIN = 'local_staging_dump.sql'; // Ditransfer ke Home default Windows (C:\Users\Sabeq\)
const REMOTE_DUMP_PATH_WSL = '/mnt/c/Users/Sabeq/local_staging_dump.sql'; // Diakses WSL via mount C:

async function syncDb() {
  console.log('================================================================');
  console.log('🔄 SYNC DATABASE: Local Macbook -> Node 2 Staging Server');
  console.log('================================================================');

  const args = new Set(process.argv.slice(2));
  const confirmedTarget = process.argv.find(value => value.startsWith('--confirm-target='))?.split('=')[1];
  if (!LOCAL_DB.pass || !REMOTE_DB.pass) {
    console.error('❌ Password database wajib diberikan melalui MAKNA_SYNC_LOCAL_PGPASSWORD dan MAKNA_SYNC_REMOTE_PGPASSWORD.');
    process.exit(1);
  }
  if (!args.has('--allow-clean-restore') || confirmedTarget !== REMOTE_DB.name) {
    console.error(`❌ Restore dibatalkan. Jalankan dengan --allow-clean-restore --confirm-target=${REMOTE_DB.name} setelah memastikan backup.`);
    process.exit(1);
  }

  // 1. Verifikasi pg_dump lokal
  if (!fs.existsSync(LOCAL_PG_DUMP)) {
    console.error(`❌ pg_dump tidak ditemukan di path: ${LOCAL_PG_DUMP}`);
    console.log('💡 Silakan sesuaikan path pg_dump di dalam file script ini.');
    process.exit(1);
  }

  try {
    // 2. Dump database lokal. --clean hanya diizinkan setelah safety gate di atas lolos.
    console.log('📥 1. Dumping local PostgreSQL database...');
    const dumpCmd = `PGPASSWORD="${LOCAL_DB.pass}" "${LOCAL_PG_DUMP}" -h ${LOCAL_DB.host} -p ${LOCAL_DB.port} -U ${LOCAL_DB.user} -d ${LOCAL_DB.name} --clean --if-exists --no-owner --no-privileges -f "${LOCAL_DUMP_FILE}"`;
    execSync(dumpCmd, { stdio: 'inherit' });
    console.log('   ✓ Dump file berhasil dibuat lokal.');

    // 3. Transfer file via SCP ke server
    console.log('📡 2. Sending dump file to remote server via SCP...');
    const scpCmd = `scp -P ${REMOTE_SSH.port} -o StrictHostKeyChecking=no "${LOCAL_DUMP_FILE}" ${REMOTE_SSH.user}@${REMOTE_SSH.host}:${REMOTE_DUMP_PATH_WIN}`;
    execSync(scpCmd, { stdio: 'inherit' });
    console.log('   ✓ File berhasil dikirim ke server.');

    // 4. Backup target lalu restore file di level WSL server
    console.log('🛟 3. Backing up remote database before restore...');
    const backupCmd = `PGPASSWORD="${REMOTE_DB.pass}" pg_dump -h 127.0.0.1 -U ${REMOTE_DB.user} -d ${REMOTE_DB.name} --no-owner --no-privileges -f /tmp/${REMOTE_DB.name}_pre_restore.sql`;
    const sshBackupCmd = `ssh -F /dev/null -p ${REMOTE_SSH.port} -o StrictHostKeyChecking=no ${REMOTE_SSH.user}@${REMOTE_SSH.host} "wsl -u sabeq83 -- bash -c '${backupCmd}'"`;
    execSync(sshBackupCmd, { stdio: 'inherit' });
    console.log('   ✓ Backup remote tersedia di /tmp sebelum restore.');

    console.log('📤 4. Restoring database inside WSL server...');
    const wslRestoreCmd = `PGPASSWORD="${REMOTE_DB.pass}" psql -h 127.0.0.1 -U ${REMOTE_DB.user} -d ${REMOTE_DB.name} -f "${REMOTE_DUMP_PATH_WSL}"`;
    const sshCmd = `ssh -F /dev/null -p ${REMOTE_SSH.port} -o StrictHostKeyChecking=no ${REMOTE_SSH.user}@${REMOTE_SSH.host} "wsl -u sabeq83 -- bash -c '${wslRestoreCmd}'"`;
    execSync(sshCmd, { stdio: 'inherit' });
    console.log('   ✓ Database berhasil di-restore ke server.');

    // 5. Cleanup file
    console.log('🧹 5. Cleaning up temporary files...');
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
