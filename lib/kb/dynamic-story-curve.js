/**
 * Dynamic Story Curve Micro-KB Helper
 * Menyediakan aturan narasi adaptif untuk Brand Editorial, Product Campaign,
 * dan Multiplier Seamless Bridging mengikuti target_clips_count (tidak dibatasi kaku 4 babak).
 */

import { readKbFile } from '../kb-loader.js';

export function getMicroKbContent(filename) {
  try {
    return readKbFile(filename);
  } catch (_) {
    return '';
  }
}

export function buildDynamicStoryCurveGuideline({
  campaignKind = 'brand_editorial', // 'brand_editorial' | 'product_campaign' | 'multiplier'
  targetClips = 4,
  bridgeAtClip = 2,
  bridgeDurationClips = 1,
  language = 'id-ID',
  brandVoice = '',
  targetAudience = '',
  objective = ''
}) {
  const isEn = (language || '').toLowerCase().startsWith('en');
  const clipsCount = Math.max(2, Math.min(12, Number(targetClips) || 4));
  const isEditorial = campaignKind === 'brand_editorial';
  const isMultiplier = campaignKind === 'multiplier' || campaignKind === 're_campaign';

  // Read base micro-KB file if available as reference
  let baseGuideFile = '';
  if (isEditorial) {
    baseGuideFile = getMicroKbContent('BRAND_EDITORIAL_GUIDE.md');
  } else if (isMultiplier) {
    baseGuideFile = getMicroKbContent('MULTIPLIER_BRIDGING_GUIDE.md');
  } else {
    baseGuideFile = getMicroKbContent('PRODUCT_CAMPAIGN_GUIDE.md');
  }

  const baseHeader = baseGuideFile ? `${baseGuideFile.slice(0, 1000)}\n\n` : '';

  return `
${baseHeader}=== DYNAMIC STORY CURVE SPECIFICATION (${clipsCount} KLIP) ===
Target Durasi Klip: Tepat ${clipsCount} adegan berurutan.
Fokus Kampanye: ${isEditorial ? 'BRAND EDITORIAL (Storytelling / Relatable / Thought Leadership)' : (isMultiplier ? 'MULTIPLIER / SEAMLESS BRIDGING (Viral Angle to Product Solution)' : 'PRODUCT CAMPAIGN (Solution-Driven / Demo / UGC Review)')}
Bahasa Narasi: ${isEn ? 'English (US)' : 'Bahasa Indonesia (Natural & Conversational)'}

STRUKTUR KURVA CERITA PROPORSIONAL:
1. KLIP 1 (HOOK / OPENING - 3 Detik Pertama):
   - Wajib memikat perhatian instan penonton dan menghentikan scrolling.
   ${isEditorial 
     ? '- Gunakan hook emosional, pertanyaan menggelitik, atau sudut pandang kontraintuitif tanpa menyebut nama produk.' 
     : (isMultiplier
       ? '- Ambil hook viral / emosional kuat dari referensi asli untuk memikat audiens sebelum mengenalkan produk.'
       : '- Tampilkan visual masalah nyata, rasa frustrasi sehari-hari, atau situasi sebelum produk digunakan.')}

2. KLIP 2 SAMPAI ${clipsCount - 1} (PROGRESSION / INTI PESAN & SEAMLESS BRIDGING):
   - Total adegan di tengah: ${clipsCount - 2} klip. Eskalasi alur cerita secara bertahap dan mulus.
   ${isEditorial ? `
   - Berikan konteks mendalam, perspektif baru, dan insight edukatif yang menginspirasi.
   - Ceritakan perjalanan atau fakta menarik yang membuat audiens merasa relate.
   - Dilarang hard-selling atau penawaran komersial agresif.` : (isMultiplier ? `
   - Titik Bridging Alami (Klip #${bridgeAtClip}): Hubungkan masalah/cerita viral secara organik ke solusi produk.
   - Penonton TIDAK BOLEH merasa sedang melihat iklan kasar. Transisi harus terasa seperti rekomendasi tulus.
   - Tunjukkan Unique Selling Proposition (USP) produk dan demo visual transformasi yang memuaskan.` : `
   - Klip 2: Kenalkan produk secara natural sebagai jawaban/kunci atas masalah di Klip 1.
   - Klip selanjutnya: Tunjukkan Unique Selling Proposition (USP), demo cara pakai, tekstur, atau transformasi nyata.
   - Buktikan benefit spesifik yang dirasakan konsumen secara visual dan lugas.`)}

3. KLIP ${clipsCount} (RESOLUTION & CALL TO ACTION):
   - Kesimpulan memuaskan yang mengikat seluruh cerita.
   ${isEditorial
     ? '- CTA Komunitas & Engagement: "Simpan video ini jika relate", "Bagikan ke teman kamu", atau "Follow untuk insight berikutnya".'
     : '- CTA Komersial Jelas: "Klik keranjang kuning di bawah", "Dapatkan promo terbatas di bio", atau "Coba sekarang sebelum kehabisan".'}
=== END DYNAMIC SPECIFICATION ===
`.trim();
}
