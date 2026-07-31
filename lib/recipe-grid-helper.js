import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { GRID_LAYOUT_COORDINATES } from './core/GridCoordinates.js';

/**
 * Merakit gambar instruksional menjadi 1 Grid Poster Asimetris Dinamis (1080x1920).
 * @param {Array<string>} imgPaths Array berisi path file gambar lokal (3-6 gambar).
 * @param {string} outputPath Path absolut tujuan penyimpanan gambar grid.
 * @param {Object} [config] Konfigurasi tambahan untuk custom layout.
 */
export async function createRecipeGrid(imgPaths, outputPath, config = {}) {
  if (!Array.isArray(imgPaths) || imgPaths.length < 3 || imgPaths.length > 6) {
    throw new Error(`createRecipeGrid memerlukan antara 3 hingga 6 path gambar. Terbaca: ${imgPaths?.length}`);
  }

  // Filter out any missing/empty image paths and verify file existence
  const validImgPaths = imgPaths.filter(p => p && fs.existsSync(p));
  if (validImgPaths.length < 3) {
    throw new Error(`Minimal dibutuhkan 3 file gambar yang valid/ada. Menemukan: ${validImgPaths.length}`);
  }

  const count = validImgPaths.length;
  const layoutId = config.layoutId || (count === 4 ? '4_editorial_split' : Object.keys(GRID_LAYOUT_COORDINATES[count])[0]);
  const gap = (config.gapSize !== undefined ? config.gapSize : 12) * 2;
  const radius = (config.borderRadius !== undefined ? config.borderRadius : 16) * 2;
  const pad = (config.outerPadding !== undefined ? config.outerPadding : 16) * 2;
  const bgColor = config.bgColor || '#0d0d12';

  const canvasW = 1080;
  const canvasH = 1920;
  const workingW = canvasW - (pad * 2);
  const workingH = canvasH - (pad * 2);
  const colW = workingW / 12;
  const rowH = workingH / 12;

  const presets = GRID_LAYOUT_COORDINATES[count];
  if (!presets || !presets[layoutId]) {
    throw new Error(`Layout preset "${layoutId}" tidak ditemukan untuk jumlah gambar ${count}`);
  }
  const slots = presets[layoutId];

  const compositionLayers = [];

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const rawImgPath = validImgPaths[i];
    if (!rawImgPath) continue;

    const slotX = Math.round(pad + (slot.x * colW) + (gap / 2));
    const slotY = Math.round(pad + (slot.y * rowH) + (gap / 2));
    const slotW = Math.round((slot.w * colW) - gap);
    const slotH = Math.round((slot.h * rowH) - gap);

    // Resize and crop to cover, apply rounded corners using SVG mask
    const processedBuffer = await sharp(rawImgPath)
      .resize(slotW, slotH, { fit: 'cover' })
      .composite([{
        input: Buffer.from(`<svg><rect x="0" y="0" width="${slotW}" height="${slotH}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`),
        blend: 'dest-in'
      }])
      .toBuffer();

    compositionLayers.push({
      input: processedBuffer,
      top: slotY,
      left: slotX
    });
  }

  // Ensure output directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  await sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 4,
      background: bgColor
    }
  })
  .composite(compositionLayers)
  .jpeg({ quality: 95 })
  .toFile(outputPath);

  console.log(`[Sharp Engine] Sukses merender kolase asimetris di: ${outputPath}`);
  return outputPath;
}
