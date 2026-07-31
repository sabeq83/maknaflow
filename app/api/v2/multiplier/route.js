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

export async function GET() {
  try {
    const tasks = await getMultiplierTasks();
    const isSchedulerActive = await getSetting('multiplier_scheduler_active') !== 'false';
    return NextResponse.json({ success: true, tasks, isSchedulerActive });
  } catch (error) {
    console.error('[Multiplier API] GET error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
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
}

export async function POST(request) {
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
    const vsoConfig = typeof vso_config_json === 'string' ? JSON.parse(vso_config_json) : vso_config_json;
    const bridgingConfig = typeof bridging_config_json === 'string' ? JSON.parse(bridging_config_json) : bridging_config_json;
    const audioConfig = typeof audio_config_json === 'string' ? JSON.parse(audio_config_json) : audio_config_json;

    // Inject resolved image path if uploaded
    if (productRefImagePath) {
      bridgingConfig.productRefImagePath = productRefImagePath;
    }

    const tasksCreated = [];

    if (production_mode === 'mass' && csv_data_json) {
      const rows = JSON.parse(csv_data_json); // [{ url, affiliate_url }]
      
      for (const row of rows) {
        const rowTaskId = uuidv4();
        const rowBridging = { ...bridgingConfig };
        
        // For mass mode, override product resolver to url_extract
        rowBridging.bridgingMode = 'url_extract';
        rowBridging.productUrl = row.url;

        await createMultiplierTask({
          id: rowTaskId,
          deconstruct_asset_id,
          target_product_url: row.url,
          affiliate_url: row.affiliate_url || '',
          vso_config_json: JSON.stringify(vsoConfig),
          bridging_config_json: JSON.stringify(rowBridging),
          audio_config_json: JSON.stringify(audioConfig),
          status: 'pending_resolution',
          enable_vo_audit: Number(enable_vo_audit !== undefined ? enable_vo_audit : 1)
        });
        tasksCreated.push(rowTaskId);
      }
    } else {
      // Single task mode
      await createMultiplierTask({
        id: batchTaskId,
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
}
