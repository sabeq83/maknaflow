import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import { studioError } from './contentflow-studio-manifest.js';

export const studioAssetPrefix = tenantId => `/uploads/studio/${crypto.createHash('sha256').update(String(tenantId)).digest('hex')}/`;
export async function stageStudioImage(tenantId, image) {
  if (!tenantId || !image || typeof image.arrayBuffer !== 'function' || !image.size || image.size > 10 * 1024 * 1024) throw studioError('Gambar wajib diisi, maksimal 10 MB.');
  const sharp = (await import('sharp')).default;
  let buffer;
  try { buffer = await sharp(Buffer.from(await image.arrayBuffer()), {limitInputPixels: 40000000}).rotate().png().toBuffer(); }
  catch { throw studioError('Format gambar tidak valid.'); }
  const name = crypto.createHash('sha256').update(buffer).digest('hex') + '.png';
  const relativePath = studioAssetPrefix(tenantId) + name;
  const absolutePath = path.join(process.cwd(), 'public', relativePath);
  await fs.mkdir(path.dirname(absolutePath), {recursive:true});
  await fs.writeFile(absolutePath, buffer);
  return {filePath:relativePath,fileName:name,relativePath};
}
export async function validateStudioAssetReferences({tenantId, config, client}) {
  const refs = [];
  const visit = (value, key='') => {
    if (typeof value === 'string' && ['product_ref_image_path','productRefImage'].includes(key) && value) refs.push(value);
    else if (Array.isArray(value)) value.forEach(v=>visit(v));
    else if (value && typeof value === 'object') Object.entries(value).forEach(([k,v])=>{
      if (['_config_json','config_json'].some(s=>k.endsWith(s)) && typeof v==='string') { try { visit(JSON.parse(v)); } catch { throw studioError('Konfigurasi aset tidak valid.'); } }
      else visit(v,k);
    });
  };
  visit(config);
  const tenantSafe = String(tenantId).replace(/[^a-zA-Z0-9_-]/g,'');
  for (const ref of new Set(refs)) {
    if (ref.includes('..') || ref.includes('\\') || ref.includes('\0')) throw studioError('Referensi aset tidak valid.');
    if (ref.startsWith(studioAssetPrefix(tenantId)) || ref.startsWith(`/uploads/products/${tenantSafe}/`)) {
      try { await fs.access(path.join(process.cwd(),'public',ref)); } catch { throw studioError('File gambar tidak tersedia. Unggah ulang gambar.'); }
      continue;
    }
    // Legacy RE staging bound its content hash to tenant; retain verified compatibility.
    if (/^\/uploads\/studio\/[a-f0-9]{64}\.png$/.test(ref)) {
      try {
        const data = await fs.readFile(path.join(process.cwd(),'public',ref));
        const expected = crypto.createHash('sha256').update(tenantId+':').update(data).digest('hex')+'.png';
        if (path.basename(ref)===expected) continue;
      } catch { /* Reject unknown or unavailable legacy assets below. */ }
    }
    // Library images may use existing external URLs/legacy paths, but must belong to this tenant.
    const owned = await client.query('SELECT id FROM product_extractions WHERE tenant_id=$1 AND (raw_photo_url=$2 OR cleaned_photo_url=$2 OR clean_photo_url=$2) LIMIT 1',[tenantId,ref]);
    if (!owned.rowCount) throw studioError('Gambar bukan milik tenant aktif.', 'STUDIO_ASSET_NOT_OWNED',403);
  }
}
