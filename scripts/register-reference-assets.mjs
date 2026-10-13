import path from 'path';
import { getPgPool, closePgPool } from '../lib/db-pg.js';

const ASSETS = [
  {
    target: 'public/uploads/reference_assets/ptgim_reno_character_sheet.jpg',
    db_path: '/uploads/reference_assets/ptgim_reno_character_sheet.jpg',
    preset_id: 'ptgim_vi_solusi_thermal_v1_tnt_pt_gim_sosmed_62d0d9',
    univ_id: 'ptgim_univ_solusi_thermal_tnt_pt_gim_sosmed_62d0d9',
    char_id: 'ptgim_char_reno_tnt_pt_gim_sosmed_62d0d9',
    role: 'character_sheet',
    label: 'Reno Thermal Specialist Character Sheet'
  },
  {
    target: 'public/uploads/reference_assets/ptgim_thermal_visual_style.jpg',
    db_path: '/uploads/reference_assets/ptgim_thermal_visual_style.jpg',
    preset_id: 'ptgim_vi_solusi_thermal_v1_tnt_pt_gim_sosmed_62d0d9',
    univ_id: 'ptgim_univ_solusi_thermal_tnt_pt_gim_sosmed_62d0d9',
    char_id: 'ptgim_char_reno_tnt_pt_gim_sosmed_62d0d9',
    role: 'visual_style',
    label: 'Solusi Thermal Cutaway Visual Style'
  },
  {
    target: 'public/uploads/reference_assets/ptgim_maya_character_sheet.jpg',
    db_path: '/uploads/reference_assets/ptgim_maya_character_sheet.jpg',
    preset_id: 'ptgim_vi_ruang_akustik_v1_tnt_pt_gim_sosmed_62d0d9',
    univ_id: 'ptgim_univ_ruang_akustik_tnt_pt_gim_sosmed_62d0d9',
    char_id: 'ptgim_char_maya_tnt_pt_gim_sosmed_62d0d9',
    role: 'character_sheet',
    label: 'Maya Acoustic Architect Character Sheet'
  },
  {
    target: 'public/uploads/reference_assets/ptgim_akustik_visual_style.jpg',
    db_path: '/uploads/reference_assets/ptgim_akustik_visual_style.jpg',
    preset_id: 'ptgim_vi_ruang_akustik_v1_tnt_pt_gim_sosmed_62d0d9',
    univ_id: 'ptgim_univ_ruang_akustik_tnt_pt_gim_sosmed_62d0d9',
    char_id: 'ptgim_char_maya_tnt_pt_gim_sosmed_62d0d9',
    role: 'visual_style',
    label: 'Ruang Akustik Studio Visual Style'
  },
  {
    target: 'public/uploads/reference_assets/ptgim_bima_character_sheet.jpg',
    db_path: '/uploads/reference_assets/ptgim_bima_character_sheet.jpg',
    preset_id: 'ptgim_vi_jasa_insulasi_v1_tnt_pt_gim_sosmed_62d0d9',
    univ_id: 'ptgim_univ_jasa_insulasi_tnt_pt_gim_sosmed_62d0d9',
    char_id: 'ptgim_char_bima_tnt_pt_gim_sosmed_62d0d9',
    role: 'character_sheet',
    label: 'Bima Master Field Craftsman Character Sheet'
  },
  {
    target: 'public/uploads/reference_assets/ptgim_insulasi_visual_style.jpg',
    db_path: '/uploads/reference_assets/ptgim_insulasi_visual_style.jpg',
    preset_id: 'ptgim_vi_jasa_insulasi_v1_tnt_pt_gim_sosmed_62d0d9',
    univ_id: 'ptgim_univ_jasa_insulasi_tnt_pt_gim_sosmed_62d0d9',
    char_id: 'ptgim_char_bima_tnt_pt_gim_sosmed_62d0d9',
    role: 'visual_style',
    label: 'Jasa Insulasi Installation Visual Style'
  }
];

async function registerAssets() {
  const pool = getPgPool();
  const client = await pool.connect();
  const tenantId = 'tnt_pt-gim-sosmed_62d0d9';
  try {
    for (const s of ['staging', 'dev', 'public']) {
      await client.query(`SET search_path TO ${s},public;`);
      
      for (const item of ASSETS) {
        const idVi = `vra_vi_${path.basename(item.target, '.jpg')}`;
        await client.query(`
          INSERT INTO ${s}.visual_reference_assets (
            id, tenant_id, owner_type, owner_id, universe_id, asset_role, version, status, source_type, storage_path, public_path, mime_type, metadata_json, approved_by, approved_at
          )
          VALUES ($1, $2, 'visual_identity', $3, $4, $5, 1, 'approved', 'upload', $6, $7, 'image/jpeg', $8, 'user', CURRENT_TIMESTAMP)
          ON CONFLICT (id) DO UPDATE
          SET public_path = EXCLUDED.public_path, storage_path = EXCLUDED.storage_path, status = 'approved', updated_at = CURRENT_TIMESTAMP;
        `, [idVi, tenantId, item.preset_id, item.univ_id, item.role, item.target, item.db_path, JSON.stringify({ label: item.label })]);

        if (item.role === 'character_sheet') {
          await client.query(`
            UPDATE ${s}.universe_characters
            SET reference_image_path = $1
            WHERE id = $2;
          `, [item.db_path, item.char_id]);
        }
      }
      console.log(`✅ Approved Reference Assets registered in schema [${s}]`);
    }
  } finally {
    client.release();
  }
  await closePgPool();
}

registerAssets().catch((err) => {
  console.error('Fatal asset registration error:', err);
  process.exit(1);
});
