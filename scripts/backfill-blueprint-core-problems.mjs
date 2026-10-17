/**
 * Standalone Backfill Script: Blueprint Core Problem & Solution
 * Mengisi kolom core_problem, core_solution, dan target_audience_pain_point
 * pada seluruh data dekonstruksi (re_deconstructed_assets) di schema dev & staging.
 * 
 * Penggunaan:
 *   node --env-file=.env.local scripts/backfill-blueprint-core-problems.mjs
 *   node --env-file=.env.local scripts/backfill-blueprint-core-problems.mjs --schema=staging
 *   node --env-file=.env.local scripts/backfill-blueprint-core-problems.mjs --dry-run
 */

import { getPgPool } from '../lib/db-pg.js';

// Heuristik ekstraksi cerdas dari summary, narasi scene 1, dan caption
export function extractCoreProblemHeuristics(asset = {}) {
  const summary = (asset.viral_pattern_summary || '').trim();
  const caption = (asset.original_caption || '').trim();
  
  let sb = [];
  try {
    if (asset.original_storyboard_json) {
      sb = typeof asset.original_storyboard_json === 'string'
        ? JSON.parse(asset.original_storyboard_json)
        : asset.original_storyboard_json;
    }
  } catch (_) {}

  const scene1Vo = sb[0]?.narration_transcript || sb[0]?.voice_over || sb[0]?.narration || '';
  const scene1Visual = sb[0]?.visual_description || sb[0]?.scene_summary || '';
  const allVo = sb.map(s => s.narration_transcript || s.voice_over || s.narration || '').join(' ');

  let coreProblem = asset.core_problem || '';
  let coreSolution = asset.core_solution || '';
  let targetAudience = asset.target_audience_pain_point || '';

  // 1. Ekstraksi Core Problem jika belum terisi
  if (!coreProblem) {
    // A. Prioritas Utama: Ekstraksi frasa masalah/topik dari narasi adegan (Scene 1 atau seluruh VO)
    const painRegexList = [
      /(?:rontokkan|bakar|membakar|menghilangkan|susut)\s+(?:lemak|perut|buncit)[^,.]*/i,
      /(?:knee\s+and\s+joint\s+pain|joint\s+pain|arthritis|nyeri\s+sendi|sakit\s+lutut)[^,.]*/i,
      /(?:improve\s+your\s+memory|daya\s+ingat|otak|fokus|pikun)[^,.]*/i,
      /(?:breathe\s+more\s+comfortably|pernapasan|sesak\s+napas|batuk|lendir|paru-paru)[^,.]*/i,
      /(?:spend\s+money\s+on\s+bug\s+sprays|nyamuk|serangga|racun\s+serangga)[^,.]*/i,
      /(?:stop\s+buying\s+sugary\s+desserts|stop\s+buying\s+chocolate\s+desserts|camilan\s+manis|ketergantungan\s+gula)[^,.]*/i,
      /(?:bantu|untuk|buat kamu yang|mengatasi|meredakan|mencegah|keluhan)\s+([^,.]+)/i,
      /(?:help\s+with|prevent|relieve|cure|fight|reduce)\s+([^,.]+)/i
    ];

    for (const rx of painRegexList) {
      const m = (scene1Vo + ' ' + allVo).match(rx);
      if (m) {
        coreProblem = (m[1] || m[0]).trim();
        break;
      }
    }

    // B. Cari pola spesifik dari viral_pattern_summary jika VO belum mendeteksi
    if (!coreProblem && summary) {
      const summaryPatterns = [
        /(?:terkait|seputar|fokus pada|solusi untuk|masalah)\s+([^,.]+)/i,
        /hook\s+(?:masalah-solusi|masalah|keluhan|solusi)\s+(?:yang kuat\s+)?(?:terkait|seputar)?\s*([^,.]+)/i,
        /audiens\s+yang\s+(?:ingin|mengalami|punya keluhan)\s+([^,.]+)/i
      ];

      for (const pattern of summaryPatterns) {
        const match = summary.match(pattern);
        if (match && match[1] && match[1].trim().length > 10 && !match[1].toLowerCase().includes("video ini")) {
          coreProblem = match[1].trim();
          break;
        }
      }
    }

    // C. Jika masih belum ditemukan, deteksi kategori umum berdasarkan kata kunci teks
    if (!coreProblem) {
      const combinedText = (summary + ' ' + scene1Vo + ' ' + caption).toLowerCase();
      if (combinedText.includes('lemak') || combinedText.includes('buncit') || combinedText.includes('diet') || combinedText.includes('fat burn')) {
        coreProblem = 'Membakar lemak perut & menurunkan berat badan secara alami';
      } else if (combinedText.includes('sendi') || combinedText.includes('knee') || combinedText.includes('joint')) {
        coreProblem = 'Mengatasi nyeri sendi, sakit lutut, dan peradangan tubuh';
      } else if (combinedText.includes('memory') || combinedText.includes('ingat') || combinedText.includes('otak')) {
        coreProblem = 'Menjaga ketajaman daya ingat dan fungsi otak';
      } else if (combinedText.includes('breathe') || combinedText.includes('paru') || combinedText.includes('batuk')) {
        coreProblem = 'Meredakan masalah pernapasan, lendir paru-paru, dan batuk';
      } else if (combinedText.includes('nyamuk') || combinedText.includes('bug')) {
        coreProblem = 'Membasmi nyamuk dan serangga di rumah secara alami tanpa semprotan kimia';
      } else if (combinedText.includes('dessert') || combinedText.includes('cake') || combinedText.includes('manis') || combinedText.includes('sugar')) {
        coreProblem = 'Keinginan makan manis/dessert tanpa khawatir gula berlebih dan berat badan naik';
      } else if (combinedText.includes('sarapan') || combinedText.includes('oat') || combinedText.includes('breakfast') || combinedText.includes('roti')) {
        coreProblem = 'Sarapan praktis, sehat, bergizi tinggi tanpa ribet dan tanpa bahan kimia';
      } else if (scene1Vo) {
        coreProblem = scene1Vo.slice(0, 100).trim();
      } else if (caption) {
        coreProblem = caption.split('\n')[0].slice(0, 100).trim();
      } else {
        coreProblem = 'Kesehatan, kebugaran, dan nutrisi alami seimbang';
      }
    }
  }

  // Rapikan teks coreProblem jika diawali frasa teknis
  coreProblem = coreProblem
    .replace(/^video ini (?:menggunakan|memanfaatkan|mengombinasikan|mengusung)[^:]*?:?\s*/i, '')
    .replace(/^pola viral (?:hook|yang)?\s*/i, '')
    .trim();
  if (coreProblem.length > 0) {
    coreProblem = coreProblem.charAt(0).toUpperCase() + coreProblem.slice(1);
  }

  // 2. Ekstraksi Core Solution
  if (!coreSolution) {
    const combined = (scene1Vo + ' ' + summary).toLowerCase();
    if (combined.includes('kayu manis') && combined.includes('lemon')) {
      coreSolution = 'Rebusan kayu manis cengkeh dengan perasan lemon segar';
    } else if (combined.includes('chia') && combined.includes('yogurt')) {
      coreSolution = 'Puding chia seed dengan greek yogurt rendah gula';
    } else if (combined.includes('oat') || combined.includes('oatmeal')) {
      coreSolution = 'Olahan oatmeal sehat bernutrisi tinggi';
    } else if (scene1Vo) {
      const matchSol = scene1Vo.match(/^([^,.]+?(?:minuman|resep|ramuan|rebusan|olahan|smoothie|sarapan|jus|snack|makanan|cake|pudding)[^,.]*)/i);
      if (matchSol && matchSol[1]) {
        coreSolution = matchSol[1].trim();
      } else {
        coreSolution = scene1Vo.slice(0, 90).trim();
      }
    } else if (scene1Visual) {
      coreSolution = scene1Visual.slice(0, 90).trim();
    } else {
      coreSolution = 'Resep dan racikan herbal / bahan alami bergizi tinggi';
    }
  }
  if (coreSolution.length > 0) {
    coreSolution = coreSolution.charAt(0).toUpperCase() + coreSolution.slice(1);
  }

  // 3. Ekstraksi Target Audience Pain Point
  if (!targetAudience) {
    if (summary) {
      const matchAud = summary.match(/menargetkan\s+audiens\s+([^,.]+)/i);
      if (matchAud && matchAud[1]) {
        targetAudience = `Audiens yang ${matchAud[1].trim()}`;
      }
    }
    if (!targetAudience) {
      targetAudience = `Masyarakat yang mengalami keluhan ${coreProblem.toLowerCase()} dan mencari alternatif alami yang aman`;
    }
  }

  return {
    core_problem: coreProblem,
    core_solution: coreSolution,
    target_audience_pain_point: targetAudience
  };
}

async function runBackfill() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const schemaArg = args.find(a => a.startsWith('--schema='));
  const targetSchemas = schemaArg ? [schemaArg.split('=')[1]] : ['staging', 'dev'];

  console.log(`\n======================================================`);
  console.log(`🚀 MAKNA Flow: Standalone Backfill Blueprint Core Problem`);
  console.log(`   Schemas: ${targetSchemas.join(', ')}`);
  console.log(`   Mode: ${isDryRun ? 'DRY-RUN (Simulasi saja)' : 'APPLY (Menyimpan ke DB)'}`);
  console.log(`======================================================\n`);

  const pool = getPgPool();
  const client = await pool.connect();

  try {
    for (const schema of targetSchemas) {
      console.log(`\n📂 Memeriksa schema: [${schema}]...`);
      await client.query(`SET search_path TO ${schema}`);

      // Pastikan kolom tersedia
      await client.query(`ALTER TABLE re_deconstructed_assets ADD COLUMN IF NOT EXISTS core_problem TEXT;`);
      await client.query(`ALTER TABLE re_deconstructed_assets ADD COLUMN IF NOT EXISTS core_solution TEXT;`);
      await client.query(`ALTER TABLE re_deconstructed_assets ADD COLUMN IF NOT EXISTS target_audience_pain_point TEXT;`);

      // Ambil seluruh aset dekonstruksi yang butuh backfill
      const res = await client.query(`
        SELECT id, original_caption, viral_pattern_summary, original_storyboard_json, product_ideas_json,
               core_problem, core_solution, target_audience_pain_point
        FROM re_deconstructed_assets
        WHERE status = 'deconstructed'
        ORDER BY created_at DESC
      `);

      console.log(`   Ditemukan ${res.rowCount} aset berstatus 'deconstructed' di schema [${schema}].`);

      let updatedCount = 0;
      let skippedCount = 0;

      for (const asset of res.rows) {
        if (asset.core_problem && asset.core_problem.trim().length > 5) {
          skippedCount++;
          continue;
        }

        const extracted = extractCoreProblemHeuristics(asset);

        if (isDryRun) {
          console.log(`   [DRY-RUN Preview] ID: ${asset.id.slice(0, 8)}...`);
          console.log(`     🎯 Problem : ${extracted.core_problem}`);
          console.log(`     💡 Solution: ${extracted.core_solution}`);
          console.log(`     👥 Audience: ${extracted.target_audience_pain_point}`);
        } else {
          await client.query(`
            UPDATE re_deconstructed_assets
            SET core_problem = $1,
                core_solution = $2,
                target_audience_pain_point = $3,
                updated_at = NOW()
            WHERE id = $4
          `, [
            extracted.core_problem,
            extracted.core_solution,
            extracted.target_audience_pain_point,
            asset.id
          ]);
        }

        updatedCount++;
      }

      console.log(`\n   📊 Hasil Schema [${schema}]:`);
      console.log(`      - Diperbarui: ${updatedCount} aset`);
      console.log(`      - Sudah Terisi (Dilewati): ${skippedCount} aset`);
    }

    console.log(`\n✅ Seluruh proses backfill selesai dengan sukses!\n`);
  } catch (err) {
    console.error(`❌ Terjadi kesalahan saat backfill:`, err);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

if (process.argv[1].endsWith('backfill-blueprint-core-problems.mjs')) {
  runBackfill();
}
