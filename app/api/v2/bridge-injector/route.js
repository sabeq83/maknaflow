import { NextResponse } from 'next/server';
import { getDb, getSetting, setSetting } from '@/lib/db';
import { generateCampaignId } from '@/lib/id-generator';
import { resolveProductData } from '@/lib/scheduler-processors';
import { buildProductBridgingInjectorPrompt } from '@/lib/prompts';
import { getGeminiModel } from '@/lib/gemini';
import { parseGeminiJSON } from '@/lib/json-parser';
import { logToBridgeInjector } from '@/lib/bridge-injector-logger';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const db = getDb();
    const campaigns = await db.prepare(`
      SELECT c.*, p.product_name, o.injected_script_md_path, o.clip2_video_path, b.brand_name,
             (SELECT COUNT(*) FROM bridge_injector_items WHERE campaign_id = c.id) as total_items,
             (SELECT COUNT(*) FROM bridge_injector_items WHERE campaign_id = c.id AND workflow_status = 'completed') as completed_items
      FROM bridge_injector_campaigns c
      LEFT JOIN product_extractions p ON c.target_product_id = p.id
      LEFT JOIN bridge_injector_outputs o ON c.id = o.campaign_id
      LEFT JOIN brand_profiles b ON c.brand_profile_id = b.id
      ORDER BY c.created_at DESC
    `).all();

    const isSchedulerActiveSetting = await getSetting('bridge_injector_scheduler_active');
    const isSchedulerActive = isSchedulerActiveSetting === null ? true : isSchedulerActiveSetting === 'true';

    return NextResponse.json({
      success: true,
      data: campaigns,
      isSchedulerActive
    });
  } catch (error) {
    console.error('[Bridge Injector List GET Error]:', error);
    logToBridgeInjector(`[ERROR] Gagal memuat daftar kampanye: ${error.message}`);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { schedulerActive } = body;

    if (schedulerActive !== undefined) {
      await setSetting('bridge_injector_scheduler_active', schedulerActive ? 'true' : 'false');
      logToBridgeInjector(`Status skeduler lokal diubah menjadi: ${schedulerActive ? 'AKTIF' : 'NON-AKTIF'}`);
      return NextResponse.json({ success: true, isSchedulerActive: schedulerActive });
    }
    return NextResponse.json({ success: false, error: 'Field "schedulerActive" wajib diisi' }, { status: 400 });
  } catch (error) {
    console.error('[Bridge Injector PATCH Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      campaign_name,
      campaign_type = 'single',
      items,
      original_script_md,
      bridging_mode,
      target_product_id,
      ephemeral_product_data,
      custom_instruction,
      account_name,
      status,
      brand_profile_id // Tambahkan brand_profile_id
    } = body;

    if (campaign_type === 'bulk') {
      if (!campaign_name || !items || !Array.isArray(items) || items.length === 0) {
        return NextResponse.json({ success: false, error: 'Nama kampanye dan daftar baris (items) wajib disertakan untuk tipe bulk.' }, { status: 400 });
      }

      const campaignId = generateCampaignId('bridge');
      logToBridgeInjector(`[NEW BULK CAMPAIGN] Memulai inisiasi kampanye bulk baru "${campaign_name}" (ID: ${campaignId}) dengan ${items.length} baris...`);

      const db = getDb();
      const initialStatus = status === 'draft' ? 'draft' : 'running';

      // 1. Simpan kampanye ke database dengan default Minimax
      await db.prepare(`
        INSERT INTO bridge_injector_campaigns (id, campaign_name, original_script_md, status, campaign_type, custom_instruction, account_name, voice_provider, voice_persona, brand_profile_id)
        VALUES (?, ?, '[CSV Bulk Campaign]', ?, 'bulk', ?, ?, 'minimax', 'Indonesian_casual_reporter_vv2', ?)
      `).run(campaignId, campaign_name, initialStatus, custom_instruction || null, account_name || null, brand_profile_id || null);

      // 2. Simpan items ke database
      const insertItem = await db.prepare(`
        INSERT INTO bridge_injector_items (campaign_id, original_script_url, product_url, nextcloud_folder, custom_instruction, workflow_status, account_name, voice_provider, voice_persona, target_product_id, brand_profile_id)
        VALUES (?, ?, ?, ?, ?, 'pending', ?, 'minimax', 'Indonesian_casual_reporter_vv2', ?, ?)
      `);

      const insertMany = db.transaction((campaignId, itemsList, globalAccount, globalBrandId) => {
        for (const item of itemsList) {
          const scriptUrl = (item.original_script_url || '').trim();
          const prodUrl = (item.product_url || '').trim();
          const ncFolder = (item.nextcloud_folder || '').trim();
          const rowInstruction = item.custom_instruction ? String(item.custom_instruction).trim() : null;
          const rowAccount = item.account_name ? String(item.account_name).trim() : globalAccount;
          const rowBrandId = item.brand_profile_id || globalBrandId;
          const rowProductId = item.target_product_id || null;
          if (scriptUrl && prodUrl) {
            insertItem.run(campaignId, scriptUrl, prodUrl, ncFolder, rowInstruction, rowAccount || null, rowProductId, rowBrandId);
          }
        }
      });

      insertMany(campaignId, items, account_name, brand_profile_id);

      logToBridgeInjector(`[${campaignId}] Sukses mengimpor ${items.length} baris ke bridge_injector_items. Status kampanye diatur ke ${initialStatus}.`);

      return NextResponse.json({
        success: true,
        message: 'Kampanye bulk berhasil dibuat!',
        data: {
          campaign_id: campaignId
        }
      });
    }

    if (!campaign_name || !original_script_md || !bridging_mode) {
      return NextResponse.json({ success: false, error: 'Nama kampanye, naskah lama, dan mode bridging wajib diisi.' }, { status: 400 });
    }

    const campaignId = generateCampaignId('bridge');
    logToBridgeInjector(`[NEW CAMPAIGN] Memulai inisiasi kampanye baru "${campaign_name}" (ID: ${campaignId})...`);

    const db = getDb();
    const initialStatus = status === 'draft' ? 'draft' : 'pending_storyboard';

    // 1. Simpan kampanye ke database dengan default Minimax
    await db.prepare(`
      INSERT INTO bridge_injector_campaigns (id, campaign_name, original_script_md, bridging_mode, target_product_id, ephemeral_product_data, custom_instruction, status, account_name, voice_provider, voice_persona, brand_profile_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'minimax', 'Indonesian_casual_reporter_vv2', ?)
    `).run(
      campaignId,
      campaign_name,
      original_script_md,
      bridging_mode,
      target_product_id || null,
      ephemeral_product_data ? (typeof ephemeral_product_data === 'object' ? JSON.stringify(ephemeral_product_data) : ephemeral_product_data) : null,
      custom_instruction || null,
      initialStatus,
      account_name || null,
      brand_profile_id || null
    );

    // 2. Selesaikan polymorphic data produk
    logToBridgeInjector(`[${campaignId}] Memetakan data produk dengan mode sourcing: ${bridging_mode}...`);
    let productData;
    try {
      productData = await resolveProductData({
        id: campaignId,
        bridging_mode,
        target_product_id,
        ephemeral_product_data: ephemeral_product_data ? (typeof ephemeral_product_data === 'object' ? JSON.stringify(ephemeral_product_data) : ephemeral_product_data) : null,
        is_bridging_active: true
      });
      logToBridgeInjector(`[${campaignId}] Data produk terpetakan: "${productData.product_name}"`);
    } catch (resolveErr) {
      logToBridgeInjector(`[${campaignId}] [ERROR] Gagal memetakan data produk: ${resolveErr.message}`);
      await db.prepare('UPDATE bridge_injector_campaigns SET status = ? WHERE id = ?').run('failed', campaignId);
      return NextResponse.json({ success: false, error: `Gagal memetakan data produk: ${resolveErr.message}` }, { status: 400 });
    }

    // 3. Panggil Gemini AI untuk merajut naskah & membuat visual prompts
    logToBridgeInjector(`[${campaignId}] Mengirim naskah asli (3 klip) & data produk ke Gemini AI untuk rajutan 4 klip...`);
    const prompt = buildProductBridgingInjectorPrompt(original_script_md, productData, custom_instruction || '');
    const model = await getGeminiModel();
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsed = parseGeminiJSON(responseText);

    const {
      injected_vo_1,
      injected_vo_2,
      injected_vo_3,
      injected_vo_4,
      clip2_t2i_prompt,
      clip2_i2v_prompt
    } = parsed;

    if (!injected_vo_1 || !injected_vo_2 || !injected_vo_3 || !injected_vo_4 || !clip2_t2i_prompt || !clip2_i2v_prompt) {
      logToBridgeInjector(`[${campaignId}] [ERROR] Hasil parsing Gemini AI tidak lengkap.`);
      throw new Error('Gemini AI mengembalikan data yang tidak lengkap atau format JSON salah.');
    }

    logToBridgeInjector(`[${campaignId}] Gemini AI sukses memecah & merajut naskah menjadi 4 klip!`);

    // 4. Buat file markdown naskah_bridging.md secara lokal
    const outputDir = path.join(process.cwd(), 'public', 'uploads', 'bridge-injector', campaignId);
    fs.mkdirSync(outputDir, { recursive: true });
    
    const mdContent = `# ${campaign_name} - Naskah Bridging Product

## Klip 1: Hook (Original)
${injected_vo_1}

## Klip 2: Product (New Injected)
${injected_vo_2}

## Klip 3: Continuation
${injected_vo_3}

## Klip 4: CTA
${injected_vo_4}
`;

    const mdFilePath = path.join(outputDir, 'naskah_bridging.md');
    fs.writeFileSync(mdFilePath, mdContent);
    const relativeMdPath = `/uploads/bridge-injector/${campaignId}/naskah_bridging.md`;
    logToBridgeInjector(`[${campaignId}] Berkas naskah kompilasi sukses disimpan ke ${relativeMdPath}`);

    // 5. Simpan output ke database
    const outputId = `brio_${Date.now()}`;
    await db.prepare(`
      INSERT INTO bridge_injector_outputs (id, campaign_id, injected_vo_1, injected_vo_2, injected_vo_3, injected_vo_4, clip2_t2i_prompt, clip2_i2v_prompt, injected_script_md_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      outputId,
      campaignId,
      injected_vo_1,
      injected_vo_2,
      injected_vo_3,
      injected_vo_4,
      clip2_t2i_prompt,
      clip2_i2v_prompt,
      relativeMdPath
    );

    // 6. Update status kampanye menjadi waiting_t2i
    await db.prepare('UPDATE bridge_injector_campaigns SET status = ? WHERE id = ?').run('waiting_t2i', campaignId);
    logToBridgeInjector(`[${campaignId}] Sukses menginisiasi campaign. Siap memproses visual (T2I).`);

    return NextResponse.json({
      success: true,
      message: 'Injeksi awal naskah berhasil diproses!',
      data: {
        campaign_id: campaignId,
        output_id: outputId,
        injected_script_md_path: relativeMdPath
      }
    });

  } catch (error) {
    console.error('[Bridge Injector POST Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
