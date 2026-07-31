import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';

async function upsertRow(db, tableName, rowData) {
  if (!rowData) return;
  const keys = Object.keys(rowData);
  const columns = keys.map(k => `"${k}"`).join(', ');
  const placeholders = keys.map(() => '?').join(', ');
  const values = keys.map(k => rowData[k]);
  const sql = `INSERT OR REPLACE INTO "${tableName}" (${columns}) VALUES (${placeholders})`;
  await db.prepare(sql).run(...values);
}

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('campaign_file'); 
    
    if (!file) {
      return NextResponse.json({ error: 'campaign_file is required' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const zip = new AdmZip(buffer);

    const jsonEntry = zip.getEntry("database_payload.json");
    if (!jsonEntry) {
      return NextResponse.json({ error: 'Invalid file format: database_payload.json not found inside kontainer.' }, { status: 400 });
    }

    const dbPayload = JSON.parse(zip.readAsText(jsonEntry));
    const campaignType = dbPayload.campaign_type || 'RE';

    // 1. Ekstrak aset fisik ke folder `/public`
    const assetEntries = zip.getEntries().filter(entry => {
      const name = entry.entryName.replace(/\\/g, '/');
      return name.startsWith('assets/') && !entry.isDirectory;
    });

    for (const entry of assetEntries) {
      const name = entry.entryName.replace(/\\/g, '/');
      const relativePath = name.replace(/^assets\//, '');
      const targetPath = path.join(process.cwd(), 'public', relativePath);
      
      // Buat folder parent jika belum ada
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, entry.getData());
    }

    // 2. Injeksi Database dengan ID Asli (UPSERT)
    const db = getDb();
    await db.transaction(async () => {
      // A. Upsert Brand Profile & Product
      if (dbPayload.brandProfile) {
        await upsertRow(db, 'brand_profiles', dbPayload.brandProfile);
      }
      if (dbPayload.product) {
        const product = dbPayload.product;
        const urlKeys = ['photo_url', 'raw_photo_url', 'clean_photo_url', 'cleaned_photo_url', 'generated_photo_url'];
        for (const key of urlKeys) {
          if (product[key]) {
            let normalized = product[key].replace(/\\/g, '/');
            if (!normalized.startsWith('/')) {
              normalized = '/' + normalized;
            }
            product[key] = normalized;
          }
        }
        await upsertRow(db, 'product_extractions', product);
      }

      // Normalize campaign path
      if (dbPayload.campaign) {
        const camp = dbPayload.campaign;
        if (camp.product_ref_image_path) {
          let normalized = camp.product_ref_image_path.replace(/\\/g, '/');
          if (!normalized.startsWith('/')) {
            normalized = '/' + normalized;
          }
          camp.product_ref_image_path = normalized;
        }
      }

      // Normalize items paths
      if (dbPayload.items && Array.isArray(dbPayload.items)) {
        for (const item of dbPayload.items) {
          if (item.local_video_path) {
            let normalized = item.local_video_path.replace(/\\/g, '/');
            if (!normalized.startsWith('/')) {
              normalized = '/' + normalized;
            }
            item.local_video_path = normalized;
          }
          if (item.t2i_start_frame_path) {
            let normalized = item.t2i_start_frame_path.replace(/\\/g, '/');
            if (!normalized.startsWith('/')) {
              normalized = '/' + normalized;
            }
            item.t2i_start_frame_path = normalized;
          }
        }
      }

      // B. Routing Berdasarkan Tipe Kampanye (OPC vs RE)
      if (campaignType === 'OPC') {
        if (dbPayload.campaign) {
          await upsertRow(db, 'pillar_campaigns', dbPayload.campaign);
        }
        if (dbPayload.items && Array.isArray(dbPayload.items)) {
          for (const item of dbPayload.items) {
            await upsertRow(db, 'pillar_campaign_items', item);
          }
        }
      } else {
        // Mode RE Campaign
        if (dbPayload.campaign) {
          await upsertRow(db, 're_campaigns', dbPayload.campaign);
        }
        if (dbPayload.items && Array.isArray(dbPayload.items)) {
          for (const item of dbPayload.items) {
            await upsertRow(db, 're_campaign_items', item);
          }
        }
        // Mode RE Angle Variants
        if (dbPayload.angleVariants && Array.isArray(dbPayload.angleVariants)) {
          for (const variant of dbPayload.angleVariants) {
            await upsertRow(db, 're_item_angle_variants', variant);
          }
        }
      }
    })();

    // Auto-start campaign scheduler if stopped (HMR recovery) after data import
    try {
      const { startCampaignScheduler } = await import('../../../../lib/campaign-scheduler.js');
      startCampaignScheduler();
    } catch (schedErr) {
      console.warn('[Import Sched Start Warning]:', schedErr.message);
    }

    return NextResponse.json({ 
      success: true, 
      message: `Kampanye ${campaignType} berhasil diimpor dengan ID yang dipertahankan!` 
    });

  } catch (error) {
    console.error('[Import Portability Error]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
