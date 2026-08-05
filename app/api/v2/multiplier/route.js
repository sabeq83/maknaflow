import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { 
  getMultiplierTasks, 
  createMultiplierTask,
  getSetting,
  setSetting
} from '@/lib/db';

import { withTenantContext } from '@/lib/auth';

export const GET = withTenantContext(async () => {
  try {
    const tasks = await getMultiplierTasks();
    const isSchedulerActive = await getSetting('multiplier_scheduler_active') !== 'false';
    return NextResponse.json({ success: true, tasks, isSchedulerActive });
  } catch (error) {
    console.error('[Multiplier API] GET error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const PATCH = withTenantContext(async (request) => {
  try {
    const body = await request.json();
    const { schedulerActive } = body;

    if (schedulerActive !== undefined) {
      await setSetting('multiplier_scheduler_active', schedulerActive ? 'true' : 'false');
      return NextResponse.json({ success: true, isSchedulerActive: schedulerActive });
    }

    return NextResponse.json({ success: false, error: 'Field "schedulerActive" wajib diisi' }, { status: 400 });
  } catch (error) {
    console.error('[Multiplier API] PATCH error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const POST = withTenantContext(async (request) => {
  try {
    const contentType = request.headers.get('content-type') || '';
    let parsedBody = {};
    let productRefImagePath = null;
    const batchTaskId = uuidv4();

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      parsedBody = {
        deconstruct_asset_id: formData.get('deconstruct_asset_id'),
        target_product_url: formData.get('target_product_url') || '',
        affiliate_url: formData.get('affiliate_url') || '',
        production_mode: formData.get('production_mode') || 'single', // 'single' or 'mass'
        csv_data_json: formData.get('csv_data_json') || null, // mass mode json array
        vso_config_json: formData.get('vso_config_json') || '{}',
        bridging_config_json: formData.get('bridging_config_json') || '{}',
        audio_config_json: formData.get('audio_config_json') || '{}',
        enable_vo_audit: Number(formData.get('enable_vo_audit') || 1)
      };

      // Handle product media file upload
      const file = formData.get('product_media');
      if (file && typeof file !== 'string' && file.name) {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'products');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const ext = path.extname(file.name) || '.png';
        const filename = `product_ref_multiplier_${batchTaskId}${ext}`;
        const filePath = path.join(uploadsDir, filename);
        fs.writeFileSync(filePath, buffer);
        productRefImagePath = `/uploads/products/${filename}`;
      } else {
        productRefImagePath = formData.get('product_ref_image_path') || null;
      }
    } else {
      parsedBody = await request.json();
    }

    const {
      deconstruct_asset_id,
      target_product_url,
      affiliate_url,
      production_mode = 'single',
      csv_data_json,
      vso_config_json,
      bridging_config_json,
      audio_config_json,
      enable_vo_audit = 1
    } = parsedBody;

    if (!deconstruct_asset_id) {
      return NextResponse.json({ success: false, error: 'deconstruct_asset_id wajib diisi' }, { status: 400 });
    }

    // Parse sub configs
    let vsoConfig = {};
    let bridgingConfig = {};
    let audioConfig = {};
    try { vsoConfig = typeof vso_config_json === 'string' ? JSON.parse(vso_config_json) : (vso_config_json || {}); } catch(_) {}
    try { bridgingConfig = typeof bridging_config_json === 'string' ? JSON.parse(bridging_config_json) : (bridging_config_json || {}); } catch(_) {}
    try { audioConfig = typeof audio_config_json === 'string' ? JSON.parse(audio_config_json) : (audio_config_json || {}); } catch(_) {}

    // Make sure we attach product image if uploaded
    if (productRefImagePath) {
      bridgingConfig.product_ref_image_path = productRefImagePath;
    }

    const tasksCreated = [];

    if (production_mode === 'mass' && csv_data_json) {
      let rows = [];
      try {
        rows = typeof csv_data_json === 'string' ? JSON.parse(csv_data_json) : csv_data_json;
      } catch(_) {}

      if (Array.isArray(rows) && rows.length > 0) {
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rowTaskId = `${batchTaskId}_row${i + 1}`;
          
          // Clone configs for this row
          const rowVso = { ...vsoConfig };
          const rowBridge = { ...bridgingConfig };
          const rowAudio = { ...audioConfig };

          // Override specific fields if present in CSV row
          const rowAffiliate = row.affiliate_url || affiliate_url || '';
          const rowProductUrl = row.target_product_url || row.product_url || target_product_url || bridgingConfig.productUrl || '';

          await createMultiplierTask({
            id: rowTaskId,
            batch_id: batchTaskId,
            deconstruct_asset_id,
            target_product_url: rowProductUrl,
            affiliate_url: rowAffiliate,
            vso_config_json: JSON.stringify(rowVso),
            bridging_config_json: JSON.stringify(rowBridge),
            audio_config_json: JSON.stringify(rowAudio),
            status: 'pending_resolution',
            enable_vo_audit: Number(enable_vo_audit !== undefined ? enable_vo_audit : 1)
          });
          tasksCreated.push(rowTaskId);
        }
      }
    }

    // Fallback or single mode
    if (tasksCreated.length === 0) {
      await createMultiplierTask({
        id: batchTaskId,
        batch_id: batchTaskId,
        deconstruct_asset_id,
        target_product_url: target_product_url || bridgingConfig.productUrl || '',
        affiliate_url: affiliate_url || '',
        vso_config_json: JSON.stringify(vsoConfig),
        bridging_config_json: JSON.stringify(bridgingConfig),
        audio_config_json: JSON.stringify(audioConfig),
        status: 'pending_resolution',
        enable_vo_audit: Number(enable_vo_audit !== undefined ? enable_vo_audit : 1)
      });
      tasksCreated.push(batchTaskId);
    }

    return NextResponse.json({
      success: true,
      message: `${tasksCreated.length} task(s) berhasil dibuat.`,
      task_ids: tasksCreated
    });

  } catch (error) {
    console.error('[Multiplier API] POST error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
