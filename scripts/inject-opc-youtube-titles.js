#!/usr/bin/env node
/**
 * scripts/inject-opc-youtube-titles.js
 * Batch injection / pembaruan YouTube Title berkualitas High CTR untuk kampanye OPC.
 *
 * Usage:
 *   node scripts/inject-opc-youtube-titles.js --dry-run
 *   node scripts/inject-opc-youtube-titles.js --apply
 *   node scripts/inject-opc-youtube-titles.js --campaigns opc_261012_lyg6eh,opc_261012_9ibcvk --schema staging --apply
 */

process.env.DISABLE_AUTO_MIGRATIONS = 'true';

import { pgQuery } from '../lib/db-pg.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Mapping 39 Judul High CTR Terkurasi (Utuh, Tidak Terpotong, <= 100 Karakter)
const CURATED_TITLES_MAP = {
  // Kampanye opc_261012_9ibcvk (Ruang Akustik ID - 21 Item)
  1624: 'Latar Belakang Zoom Menentukan Karirmu? Jangan Sepelekan! #Shorts',
  1625: 'Bising Luar Rusak Fokus Kerja? Bukti Rockwool Mampu Redam Suara! #Shorts',
  1626: 'Presentasi Hancur Karena Gema Ruangan? Atasi Dengan Cara Ini! #Shorts',
  1627: 'Peredam Suara VS Akustik Ruang: Jangan Salah Beli Saat Renovasi! #Shorts',
  1628: 'Makin Padat Makin Kedap Suara? Mitos Densitas Peredam Terbongkar! #Shorts',
  1629: 'Kamar Berisik Bikin Stres? Ubah Jadi Ruang Kerja Super Hening! #Shorts',
  1630: 'Dinding Tebal Tapi Suara Bocor? Kesalahan Fatal Soal Airgap Ini! #Shorts',
  1631: 'Bikin Studio Podcast Mewah & Suara Bebas Gema: Ini Rahasianya! #Shorts',
  1632: 'Uji Kebisingan Nyata: Turun Berapa Desibel Pakai Insulasi Ini? #Shorts',
  1633: 'Kafe Berisik Bikin Pelanggan Kabur? Solusi Kendalikan Gema Ruang! #Shorts',
  1634: 'Karpet Tebal Bisa Redam Suara? Jangan Percaya Mitos Sesat Ini! #Shorts',
  1635: 'Bass Menggema Bikin Pusing di Studio? Ini Trik Pasang Bass Trap! #Shorts',
  1636: 'Suara Rapat Menggema Tak Jelas? Atasi Masalah Akustik Ruang Ini! #Shorts',
  1637: 'Home Theater Menggelegar Tanpa Ganggu Tetangga? Begini Caranya! #Shorts',
  1638: 'Kantor Open-Space Bising & Bergema? Redam Suara Tanpa Rusak Estetika #Shorts',
  1639: 'Bukan Tebak-Tebakan! Tahap Uji Akustik Presisi Standar Profesional #Shorts',
  1640: 'Dinding Tebal Tapi Suara Tembus? Waspada Bocor Flanking Transmission #Shorts',
  1641: 'Rahasia Rekaman Vokal Jernih & Warm Tanpa Suara Ruang Mengganggu! #Shorts',
  1642: 'Glasswool VS Rockwool: Mana Yang Lebih Kuat Redam Suara & Panas? #Shorts',
  1643: 'Suara Khutbah & Pidato Menggema di Aula? Solusi Artikulasi Jernih! #Shorts',
  1644: 'Celah Pintu Bikin Suara Bocor? Cara Mudah Isolasi Pintu Studio! #Shorts',

  // Kampanye opc_261012_lyg6eh (Solusi Thermal ID - 18 Item)
  1651: 'Insulasi Mahal Tapi Tetap Panas? Fatalnya Kawat Penopang Kendur! #Shorts',
  1652: 'Makin Tebal Makin Dingin? Jangan Salah Paham Soal Nilai R-Value! #Shorts',
  1653: 'AC Nyala Non-Stop Tapi Ruangan Gerah? Sumber Masalahnya di Atap! #Shorts',
  1654: 'Serat Mineral VS Polimer: Mana Penahan Panas Atap Terbaik? #Shorts',
  1655: 'Bekerja di Bawah Atap Panas Bagai Dalam Oven! Selamatkan Pabrikmu #Shorts',
  1656: 'Panas Atap Seng Rusak Kargo Gudang? Lindungi Area Loading Dock! #Shorts',
  1657: 'Uji Lampu Halogen: Bukti Insulasi Termal Mampu Blokir Panas Ekstrem #Shorts',
  1658: 'Celah 2 Cm Bocor Bikin Gedung Gerah! Bahaya Sambungan Insulasi Bolong #Shorts',
  1659: 'Insulasi Atap Bikin Rangka Baja Berkarat? Hati-Hati Kondensasi! #Shorts',
  1660: 'Plafon Tinggi Tapi Tetap Gerah? Terjebak Kantung Panas di Atap! #Shorts',
  1661: '1 Solusi Untuk 2 Masalah: Redam Bising Hujan Sekaligus Blokir Panas! #Shorts',
  1662: 'Polimer Foil VS Serat Komposit: Jangan Terkecoh Emisivitas Panas! #Shorts',
  1663: 'Suhu Pabrik Di Atas 30°C? Produktivitas Karyawan Anjlok Akibat Panas! #Shorts',
  1664: 'Bukti Uji Termal: Suhu Atap Turun Drastis Pakai Insulasi Aluminium! #Shorts',
  1665: 'Rahasia Insulasi Atap Awet Puluhan Tahun: Kuncinya Ada di Kawat Ini! #Shorts',
  1666: 'Takut Serat Insulasi Rontok & Berdebu? Lihat Uji Tarik Sampel Ini! #Shorts',
  1667: 'Atap Pabrik Berbunyi Denting? Tanda Bahaya Rangka Memuai Karena Panas! #Shorts',
  1668: 'Sama-Sama Mengkilap, Tapi Aluminium Murni Pantulkan 97% Radiasi Panas! #Shorts'
};

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    campaigns: ['opc_261012_lyg6eh', 'opc_261012_9ibcvk'],
    schemas: ['staging'],
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
    } else if ((arg === '--schema' || arg === '--schemas') && args[i + 1]) {
      options.schemas = args[++i].split(',').map(s => s.trim()).filter(Boolean);
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
  clean = clean.replace(/\(.*?\)/g, '');
  clean = clean.replace(/^["'`“‘\s]+|["'`”’\s]+$/g, '').trim();

  clean = clean.split('\n')[0].trim();

  // Pastikan akhiran #Shorts
  if (!/#shorts/i.test(clean)) {
    clean = `${clean} #Shorts`;
  } else {
    clean = clean.replace(/#shorts/gi, '#Shorts');
  }

  return clean;
}

function fallbackGenerateTitle(brandName, hook) {
  if (!hook) return `${brandName} Tips #Shorts`;
  // Jika hook terlalu panjang, ambil kalimat pertama utuh yang diakhiri tanda titik/tanya
  const sentences = hook.split(/[.?!]/).map(s => s.trim()).filter(Boolean);
  if (sentences.length > 0 && sentences[0].length >= 25 && sentences[0].length <= 75) {
    return cleanTitle(`${sentences[0]}! #Shorts`);
  }
  return cleanTitle(`${hook.slice(0, 65).trim()} #Shorts`);
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
1. Panjang judul HARUS antara 55 sampai 75 karakter (MAKSIMAL 85 karakter).
2. Tulis kalimat UTUH dalam Bahasa Indonesia yang memikat, TIDAK BOLEH menggantung.
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
    try {
      const model2 = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const result2 = await model2.generateContent(prompt);
      const text2 = result2?.response?.text();
      if (text2) return cleanTitle(text2);
    } catch (_) {}
  }

  return fallbackGenerateTitle(brandName, hook);
}

async function processSchema(schema, options) {
  console.log(`\n================================================================`);
  console.log(`🎬 MEMPROSES SCHEMA: [${schema.toUpperCase()}]`);
  console.log(`================================================================`);

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
    FROM ${schema}.pillar_campaign_items i
    JOIN ${schema}.pillar_campaigns c ON c.id = i.campaign_id
    WHERE i.campaign_id = ANY($1)
    ORDER BY i.campaign_id, i.id
    ${options.limit ? `LIMIT ${options.limit}` : ''}
  `;

  let items = [];
  try {
    const res = await pgQuery(query, [options.campaigns]);
    items = res.rows;
  } catch (err) {
    console.error(`Gagal query item di schema ${schema}:`, err.message);
    return;
  }

  console.log(`Ditemukan ${items.length} item di ${schema}.pillar_campaign_items.\n`);
  if (items.length === 0) return;

  const tenantKeyMap = {};
  for (const item of items) {
    const tId = item.tenant_id || 'default_tenant';
    if (!tenantKeyMap[tId]) {
      const key = await getTenantApiKey(schema, tId);
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

    let ytTitle = '';
    let source = '';

    // Prioritaskan curated title jika ada mapping
    if (CURATED_TITLES_MAP[item.id]) {
      ytTitle = CURATED_TITLES_MAP[item.id];
      source = 'CURATED';
    } else {
      const genAI = tenantKeyMap[item.tenant_id || 'default_tenant'];
      ytTitle = await generateTitleWithAI(genAI, brandName, hook, narration);
      source = 'AI_GENERATED';
    }

    const charCount = ytTitle.length;
    const isOptimal = charCount >= 50 && charCount <= 85;
    const statusTag = isOptimal ? 'OPTIMAL' : (charCount < 50 ? 'PENDEK' : 'PANJANG');

    console.log(`[${processedCount}/${items.length}] #${item.id} [${charCount} char | ${source} | ${statusTag}] "${ytTitle}"`);

    results.push({
      item,
      brandName,
      hook,
      caption,
      ytTitle,
      charCount,
      source,
      statusTag
    });
  }

  console.log(`\n📋 RINGKASAN HASIL (${results.length} ITEM) DI SCHEMA ${schema}:`);
  console.table(
    results.map(r => ({
      ID: r.item.id,
      Brand: r.brandName.slice(0, 16),
      Karakter: r.charCount,
      Sumber: r.source,
      'Judul YouTube Shorts': r.ytTitle
    }))
  );

  if (options.apply) {
    console.log(`\n🚀 MENGEKSEKUSI PEMBARUAN KE SCHEMA ${schema}...`);
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

      // 1. Update pillar_campaign_items
      await pgQuery(
        `UPDATE ${schema}.pillar_campaign_items
         SET result_json = $1
         WHERE id = $2`,
        [JSON.stringify(resultObj), r.item.id]
      );
      updatedItemsCount++;

      // 2. Update content_flow_items
      const cfRes = await pgQuery(
        `UPDATE ${schema}.content_flow_items
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

    console.log(`✅ Berhasil memperbarui ${updatedItemsCount} baris di ${schema}.pillar_campaign_items`);
    console.log(`✅ Berhasil menyinkronkan ${updatedCfCount} baris di ${schema}.content_flow_items`);
  }
}

async function main() {
  const options = parseArgs();
  console.log('================================================================');
  console.log('🎬 BATCH UPDATE YOUTUBE TITLES (HIGH CTR & UTUH)');
  console.log('================================================================');
  console.log(`Schemas Target   : ${options.schemas.join(', ')}`);
  console.log(`Target Kampanye  : ${options.campaigns.join(', ')}`);
  console.log(`Mode Eksekusi    : ${options.apply ? '✅ APPLY (PERMANENT UPDATE)' : '🔍 DRY-RUN (SIMULASI PREVIEW)'}`);
  if (options.limit) console.log(`Limit Proses     : ${options.limit} item`);

  for (const schema of options.schemas) {
    await processSchema(schema, options);
  }

  if (!options.apply) {
    console.log('\n💡 INI ADALAH MODE DRY-RUN. Tidak ada data yang diubah di database.');
    console.log('Jalankan dengan perintah berikut untuk menerapkan perubahan secara permanen:');
    console.log(`node scripts/inject-opc-youtube-titles.js --campaigns ${options.campaigns.join(',')} --schemas ${options.schemas.join(',')} --apply`);
  } else {
    console.log('\n🎉 Seluruh pembaruan judul High CTR selesai 100%!');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('\n❌ Fatal Error:', err);
  process.exit(1);
});
