import { pgQuery } from '../lib/db-pg.js';
import { listReplizAccounts } from '../lib/repliz-client.js';

// Format ISO string untuk tanggal (YYYY-MM-DD) dan jam:menit WIB (UTC+7)
function createWibDate(year, month, day, hourWib, minuteWib) {
  // WIB adalah UTC+7.
  const d = new Date(Date.UTC(year, month - 1, day, hourWib - 7, minuteWib, 0, 0));
  return d.toISOString();
}

const WIB_SLOTS = [
  { hour: 5, minute: 9 },   // 05:09 WIB
  { hour: 7, minute: 9 },   // 07:09 WIB
  { hour: 9, minute: 9 },   // 09:09 WIB
  { hour: 11, minute: 9 },  // 11:09 WIB
  { hour: 13, minute: 9 },  // 13:09 WIB
  { hour: 15, minute: 9 },  // 15:09 WIB
  { hour: 17, minute: 9 },  // 17:09 WIB
  { hour: 19, minute: 9 },  // 19:09 WIB
  { hour: 21, minute: 9 },  // 21:09 WIB
];

export async function syncAccountsAndRescheduleBacklog() {
  console.log('🚀 Memulai Sinkronisasi Akun Repliz dan Penjadwalan Ulang Backlog FB...');

  const credentials = {
    apiUrl: 'https://api.repliz.com',
    accessKey: '8595255560',
    secretKey: '6zcQWtZNlC2aweSsXpt1NZh6MzmLEvYE'
  };

  const schemas = ['staging', 'dev'];

  // 1. Fetch live Repliz accounts
  let liveReplizAccounts = [];
  try {
    liveReplizAccounts = await listReplizAccounts(credentials);
    console.log(`✅ Berhasil mengambil ${liveReplizAccounts.length} akun dari Repliz API.`);
  } catch (err) {
    console.error('❌ Gagal mengambil akun dari Repliz:', err.message);
    throw err;
  }

  for (const schema of schemas) {
    console.log(`\n=================== MEMPROSES SCHEMA: ${schema} ===================`);

    // A. Sinkronisasi Akun Repliz
    for (const remote of liveReplizAccounts) {
      const providerAccountId = String(remote.id || remote._id);
      const isConnected = remote.isConnected !== false && remote.status !== 'disconnected';
      const status = isConnected ? 'active' : 'disconnected';

      const updateRes = await pgQuery(`
        UPDATE ${schema}.publishing_accounts
        SET
          status = $1,
          last_error_code = CASE WHEN $1 = 'active' THEN NULL ELSE last_error_code END,
          last_error_message = CASE WHEN $1 = 'active' THEN NULL ELSE last_error_message END,
          last_verified_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE provider = 'repliz' AND provider_account_id = $2
        RETURNING id, display_name, platform, status
      `, [status, providerAccountId]);

      if (updateRes.rowCount > 0) {
        for (const row of updateRes.rows) {
          console.log(`  🟢 [${schema}] Akun synced: ${row.display_name} (${row.platform}) -> status: ${row.status}`);
        }
      }
    }

    // B. Reschedule Backlog Job Facebook
    const targetTenants = ['tnt_sy-dodot_4ba27b', 'tnt_sy-benu_415f99', 'default_tenant'];
    
    // Ambil semua job Facebook yang statusnya 'scheduled' atau 'needs_review'/'failed' yang belum dipublikasikan
    const fbJobsRes = await pgQuery(`
      SELECT pj.id, pj.tenant_id, pj.account_id, pj.content_id, pj.scheduled_at, pj.status,
             pa.display_name as account_name
      FROM ${schema}.publishing_jobs pj
      LEFT JOIN ${schema}.publishing_accounts pa ON pa.id = pj.account_id
      WHERE pj.tenant_id = ANY($1)
        AND pj.platform = 'facebook'
        AND pj.status IN ('scheduled', 'needs_review', 'failed')
      ORDER BY pj.tenant_id, pj.account_id, pj.created_at ASC
    `, [targetTenants]);

    const jobs = fbJobsRes.rows;
    console.log(`\n📋 Ditemukan ${jobs.length} job FB yang perlu dijadwalkan ulang di schema ${schema}.`);

    if (jobs.length === 0) continue;

    // Kelompokkan jobs per account_id
    const groupedByAccount = {};
    for (const job of jobs) {
      const accKey = `${job.tenant_id}_${job.account_id}`;
      if (!groupedByAccount[accKey]) {
        groupedByAccount[accKey] = [];
      }
      groupedByAccount[accKey].push(job);
    }

    // Penjadwalan per akun mulai 10 September 2026 pukul 05:09 WIB
    for (const [accKey, accJobs] of Object.entries(groupedByAccount)) {
      const accName = accJobs[0]?.account_name || accKey;
      console.log(`\n👉 Menjadwalkan ${accJobs.length} job untuk akun: ${accName}`);

      let currentDay = 10;
      let slotIndex = 0;

      for (let i = 0; i < accJobs.length; i++) {
        const job = accJobs[i];
        const slot = WIB_SLOTS[slotIndex];

        // Format waktu ISO untuk slot ini
        const newScheduledAt = createWibDate(2026, 9, currentDay, slot.hour, slot.minute);
        const wibTimeStr = `${String(slot.hour).padStart(2, '0')}:${String(slot.minute).padStart(2, '0')}`;
        const wibDateStr = `2026-09-${String(currentDay).padStart(2, '0')}`;

        // Update publishing_jobs
        await pgQuery(`
          UPDATE ${schema}.publishing_jobs
          SET
            scheduled_at = $1,
            status = 'scheduled',
            approval_status = 'approved',
            attempt_count = 0,
            next_attempt_at = NULL,
            locked_at = NULL,
            locked_by = NULL,
            last_error_code = NULL,
            last_error_message = NULL,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [newScheduledAt, job.id]);

        // Update content_flow_items jika ada
        if (job.content_id) {
          await pgQuery(`
            UPDATE ${schema}.content_flow_items
            SET
              facebook_status = 'Scheduled',
              updated_at = CURRENT_TIMESTAMP
            WHERE video_id = $1 AND tenant_id = $2
          `, [job.content_id, job.tenant_id]);
        }

        console.log(`    📅 Job ${job.id} (${job.content_id}) -> ${wibDateStr} ${wibTimeStr} WIB (${newScheduledAt})`);

        // Maju ke slot berikutnya
        slotIndex++;
        if (slotIndex >= WIB_SLOTS.length) {
          slotIndex = 0;
          currentDay++;
        }
      }
    }
  }

  console.log('\n🎉 Selesai! Seluruh akun Repliz telah disinkronkan dan backlog FB berhasil dijadwalkan ulang.');
}

if (process.argv[1]?.endsWith('sync-and-reschedule-fb-backlog.mjs')) {
  syncAccountsAndRescheduleBacklog()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
