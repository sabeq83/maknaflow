#!/usr/bin/env node
/**
 * scripts/inject-opc-youtube-titles.js
 * Batch injection YouTube Title untuk kampanye OPC eksisting.
 *
 * Usage:
 *   node scripts/inject-opc-youtube-titles.js --dry-run
 *   node scripts/inject-opc-youtube-titles.js --apply
 *   node scripts/inject-opc-youtube-titles.js --campaigns opc_261012_lyg6eh,opc_261012_9ibcvk --schema staging --apply
 */

process.env.DISABLE_AUTO_MIGRATIONS = 'true';

import { pgQuery } from '../lib/db-pg.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    campaigns: ['opc_261012_lyg6eh', 'opc_261012_9ibcvk'],
    schema: 'staging',
    dryRun: true,
    apply: false,
    limit: null
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--apply') {
      options.apply = true;
      options.dryRun = false;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
      options.apply = false;
    } else if (arg === '--schema' && args[i + 1]) {
      options.schema = args[++i];
    } else if (arg === '--campaigns' && args[i + 1]) {
      options.campaigns = args[++i].split(',').map(s => s.trim()).filter(Boolean);
    } else if (arg === '--limit' && args[i + 1]) {
      options.limit = parseInt(args[++i], 10);
    }
  }

  return options;
}

function cleanTitle(rawTitle) {
  if (!rawTitle) return '';
  let clean = rawTitle;

  // Hapus format markdown tebal, kutip, atau pengantar
  clean = clean.replace(/\*\*(.*?)\*\*/g, '$1');
  clean = clean.replace(/\["(.*?)"\]/g, '$1');
  clean = clean.replace(/^.*?(?:judul|title)[:\s]+/i, '');
  clean = clean.replace(/\(.*?\)/g, ''); // Hapus catatan kurung (67 karakter)
  clean = clean.replace(/^["'`“‘\s]+|["'`”’\s]+$/g, '').trim();

  // Ambil hanya baris pertama jika model menghasilkan multi-baris
  clean = clean.split('\n')[0].trim();

  // Pastikan akhiran #Shorts
  if (!/#shorts/i.test(clean)) {
    clean = `${clean} #Shorts`;
  } else {
    clean = clean.replace(/#shorts/gi, '#Shorts');
  }

  // Jika melebihi 85 karakter, pangkas rapi pada batas kata
  if (clean.length > 85) {
    const withoutTag = clean.replace(/\s*#Shorts/gi, '').trim();
    const truncated = withoutTag.slice(0, 68).replace(/\s+\S*$/, '');
    clean = `${truncated} #Shorts`;
  }

  return clean;
}

function fallbackGenerateTitle(brandName, hook) {
  if (!hook) return `${brandName} Tips #Shorts`;
  let base = hook.replace(/[.?!\s]+$/, '').trim();
  if (base.length > 60) {
    base = base.slice(0, 60).replace(/\s+\S*$/, '');
  }
  return cleanTitle(`${base} #Shorts`);
}

async function getTenantApiKey(schema, tenantId) {
  try {
    const res = await pgQuery(
      `SELECT setting_value FROM ${schema}.tenant_settings WHERE tenant_id = $1 AND setting_key = 'gemini_api_key'`,
      [tenantId]
    );
    if (res.rows[0]?.setting_value) return res.rows[0].setting_value;

    const fallback = await pgQuery(
      `SELECT setting_value FROM ${schema}.tenant_settings WHERE tenant_id = 'default_tenant' AND setting_key = 'gemini_api_key'`
    );
    return fallback.rows[0]?.setting_value || process.env.GEMINI_API_KEY || null;
  } catch (_) {
    return process.env.GEMINI_API_KEY || null;
  }
}

async function generateTitleWithAI(genAI, brandName, hook, narration) {
  if (!genAI) return fallbackGenerateTitle(brandName, hook);

  const prompt = `Anda adalah YouTube Shorts Title Strategist.
Rumuskan 1 Judul YouTube Shorts yang click-worthy, memicu rasa penasaran (curiosity hook), tajam, dan viral untuk konten berikut:
- Brand/Topik: ${brandName}
- Hook Masalah: ${hook}
- Narasi Pembuka: ${narration.slice(0, 150)}

ATURAN WAJIB:
1. Panjang judul HARUS antara 50 sampai 70 karakter (MAKSIMAL 80 karakter).
2. Tulis dalam Bahasa Indonesia yang natural dan memikat penonton di feed Shorts.
3. WAJIB diakhiri tag #Shorts.
4. Output HANYA teks judul polos 1 baris tanpa tanda kutip, tanpa penjelasan, dan tanpa markdown tebal.`;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    const text = result?.response?.text();
    if (text) {
      return cleanTitle(text);
    }
  } catch (err) {
    // Retry dengan gemini-2.0-flash
    try {
      const model2 = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const result2 = await model2.generateContent(prompt);
      const text2 = result2?.response?.text();
      if (text2) return cleanTitle(text2);
    } catch (_) {}
  }

  return fallbackGenerateTitle(brandName, hook);
}

async function main() {
  const options = parseArgs();
  console.log('================================================================');
  console.log('🎬 INJECT YOUTUBE TITLES — PILAR CAMPAIGN & CONTENT FLOW');
  console.log('================================================================');
  console.log(`Schema Database  : ${options.schema}`);
  console.log(`Target Kampanye  : ${options.campaigns.join(', ')}`);
  console.log(`Mode Eksekusi    : ${options.apply ? '✅ APPLY (PERMANENT UPDATE)' : '🔍 DRY-RUN (SIMULASI PREVIEW)'}`);
  if (options.limit) console.log(`Limit Proses     : ${options.limit} item`);
  console.log('----------------------------------------------------------------');

  const query = `
    SELECT 
      i.id,
      i.campaign_id,
      c.account_name,
      c.campaign_name,
      c.tenant_id,
      i.row_creative_payload,
      i.result_json,
      i.workflow_status
    FROM ${options.schema}.pillar_campaign_items i
    JOIN ${options.schema}.pillar_campaigns c ON c.id = i.campaign_id
    WHERE i.campaign_id = ANY($1)
    ORDER BY i.campaign_id, i.id
    ${options.limit ? `LIMIT ${options.limit}` : ''}
  `;

  const { rows: items } = await pgQuery(query, [options.campaigns]);
  console.log(`Ditemukan ${items.length} item untuk diproses.\n`);

  if (items.length === 0) {
    console.log('Tidak ada item yang ditemukan.');
    process.exit(0);
  }

  // Siapkan koneksi GenAI per tenant
  const tenantKeyMap = {};
  for (const item of items) {
    const tId = item.tenant_id || 'default_tenant';
    if (!tenantKeyMap[tId]) {
      const key = await getTenantApiKey(options.schema, tId);
      tenantKeyMap[tId] = key ? new GoogleGenerativeAI(key) : null;
    }
  }

  const results = [];
  let processedCount = 0;

  for (const item of items) {
    processedCount++;
    let payload = {};
    try { payload = JSON.parse(item.row_creative_payload || '{}'); } catch (_) {}
    let result = {};
    try { result = JSON.parse(item.result_json || '{}'); } catch (_) {}

    const brandName = item.account_name || 'Brand';
    const hook = payload.custom_hook || payload.hook || payload.content_subject || '';
    const narration = (result.voiceover && result.voiceover[0]?.narration) || '';
    const caption = result.caption || result.social_media_package?.caption || '';

    const genAI = tenantKeyMap[item.tenant_id || 'default_tenant'];

    process.stdout.write(`[${processedCount}/${items.length}] Item #${item.id} (${brandName}) ... `);
    const ytTitle = await generateTitleWithAI(genAI, brandName, hook, narration);
    const charCount = ytTitle.length;
    const isOptimal = charCount >= 50 && charCount <= 75;
    const statusTag = isOptimal ? 'OPTIMAL' : (charCount < 50 ? 'PENDEK' : 'PANJANG');

    console.log(`[${charCount} char | ${statusTag}] "${ytTitle}"`);

    results.push({
      item,
      brandName,
      hook,
      caption,
      ytTitle,
      charCount,
      statusTag
    });
  }

  console.log('\n================================================================');
  console.log('📋 RINGKASAN HASIL GENERASI JUDUL YOUTUBE SHORTS (39 ITEM)');
  console.log('================================================================');
  console.table(
    results.map(r => ({
      ID: r.item.id,
      Brand: r.brandName.slice(0, 16),
      'Karakter': r.charCount,
      'Status': r.statusTag,
      'Judul YouTube Shorts': r.ytTitle
    }))
  );

  if (options.apply) {
    console.log('\n🚀 MENGEKSEKUSI PEMBARUAN KE DATABASE...');
    let updatedItemsCount = 0;
    let updatedCfCount = 0;

    for (const r of results) {
      let resultObj = {};
      try { resultObj = JSON.parse(r.item.result_json || '{}'); } catch (_) {}

      resultObj.yt_title = r.ytTitle;
      resultObj.yt_desc = resultObj.yt_desc || r.caption || resultObj.caption || '';
      resultObj.social_media_package = {
        ...(resultObj.social_media_package || {}),
        title: r.ytTitle,
        caption: resultObj.caption || resultObj.yt_desc || ''
      };

      // 1. Update staging.pillar_campaign_items
      await pgQuery(
        `UPDATE ${options.schema}.pillar_campaign_items
         SET result_json = $1
         WHERE id = $2`,
        [JSON.stringify(resultObj), r.item.id]
      );
      updatedItemsCount++;

      // 2. Update staging.content_flow_items
      const cfRes = await pgQuery(
        `UPDATE ${options.schema}.content_flow_items
         SET social_media_package_json = jsonb_set(
               COALESCE(social_media_package_json, '{}'::jsonb),
               '{title}',
               to_jsonb($1::text)
             ),
             hook = $1
         WHERE source_item_id = $2::text
         RETURNING id`,
        [r.ytTitle, String(r.item.id)]
      );

      if (cfRes.rowCount > 0) {
        updatedCfCount += cfRes.rowCount;
      }
    }

    console.log(`✅ Berhasil memperbarui ${updatedItemsCount} baris di ${options.schema}.pillar_campaign_items`);
    console.log(`✅ Berhasil menyinkronkan ${updatedCfCount} baris di ${options.schema}.content_flow_items`);
    console.log('🎉 Penyuntikan judul YouTube selesai 100%!');
  } else {
    console.log('\n💡 INI ADALAH MODE DRY-RUN. Tidak ada data yang diubah di database.');
    console.log('Jalankan dengan perintah berikut untuk menerapkan perubahan secara permanen:');
    console.log(`node scripts/inject-opc-youtube-titles.js --campaigns ${options.campaigns.join(',')} --schema ${options.schema} --apply`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('\n❌ Fatal Error:', err);
  process.exit(1);
});
