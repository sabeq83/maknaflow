import { removeBackground } from '@imgly/background-removal-node';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { execSync } from 'child_process';
import os from 'os';

/**
 * Menghapus latar belakang gambar dan menggantinya dengan warna putih (Studio Look)
 * @param {string} inputImagePath - Path absolut gambar mentah
 * @param {string} outputFilename - Nama file output yang diinginkan
 * @returns {Promise<string>} - Path relatif gambar yang sudah bersih
 */
export async function createCleanProductShot(inputImagePath, outputFilename) {
  console.log(`[AI Vision] Memulai pemotongan latar belakang untuk: ${path.basename(inputImagePath)}`);
  
  const finalOutputDir = path.join(process.cwd(), 'public', 'uploads', 'products', 'clean');
  if (!fs.existsSync(finalOutputDir)) {
    fs.mkdirSync(finalOutputDir, { recursive: true });
  }
  const finalOutputPath = path.join(finalOutputDir, outputFilename);

  // Deteksi path rembg local (pip user install) maupun global
  const homeDir = os.homedir();
  const possibleRembgPaths = [
    path.join(homeDir, '.local', 'bin', 'rembg'),
    path.join(homeDir, 'miniconda', 'bin', 'rembg'),
    '/usr/local/bin/rembg',
    '/usr/bin/rembg'
  ];
  
  let rembgPath = null;
  for (const p of possibleRembgPaths) {
    if (fs.existsSync(p)) {
      rembgPath = p;
      break;
    }
  }

  // Cek jika rembg bisa dipanggil secara global di system PATH
  if (!rembgPath) {
    try {
      execSync('which rembg', { stdio: 'ignore' });
      rembgPath = 'rembg';
    } catch (_) {}
  }

  if (rembgPath) {
    console.log(`[AI Vision] Terdeteksi rembg di: ${rembgPath}. Menggunakan rembg untuk kualitas pemotongan background terbaik.`);
    try {
      // 1. Buat file temporary transparent output
      const tempOutput = path.join(os.tmpdir(), `transparent_${Date.now()}_${outputFilename.replace(/\.[^/.]+$/, "")}.png`);
      
      // Jalankan CLI rembg
      execSync(`"${rembgPath}" i "${inputImagePath}" "${tempOutput}"`, { stdio: 'ignore' });
      
      // 2. Tambahkan latar belakang putih solid menggunakan sharp
      await sharp(tempOutput)
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .jpeg({ quality: 90 })
        .toFile(finalOutputPath);
        
      // Hapus file temporary
      if (fs.existsSync(tempOutput)) {
        fs.unlinkSync(tempOutput);
      }
      
      console.log(`[AI Vision] [Rembg] Sukses! Foto produk studio tersimpan di: clean/${outputFilename}`);
      return `/uploads/products/clean/${outputFilename}`;
      
    } catch (rembgErr) {
      console.warn(`[AI Vision] Gagal memproses menggunakan rembg: ${rembgErr.message}. Fallback otomatis ke imgly...`);
    }
  }

  // Fallback ke @imgly/background-removal-node jika rembg tidak ada/gagal
  try {
    const imageBuffer = fs.readFileSync(inputImagePath);
    const ext = path.extname(inputImagePath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    const blob = new Blob([imageBuffer], { type: mimeType });
    
    const transparentBlob = await removeBackground(blob, { model: 'medium' });
    const transparentBuffer = Buffer.from(await transparentBlob.arrayBuffer());

    await sharp(transparentBuffer)
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: 90 })
      .toFile(finalOutputPath);

    console.log(`[AI Vision] [Imgly Fallback] Sukses! Foto produk studio tersimpan di: clean/${outputFilename}`);
    return `/uploads/products/clean/${outputFilename}`;

  } catch (error) {
    console.error(`[AI Vision] Gagal memproses gambar:`, error.message);
    throw error;
  }
}
