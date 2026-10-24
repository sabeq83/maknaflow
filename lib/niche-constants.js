import fs from 'fs';
import path from 'path';

/**
 * Centralized Niche Domain & Knowledge Base Catalog
 * File: lib/niche-constants.js
 * Single Source of Truth untuk katalog Niche Knowledge Base di MAKNA Flow.
 */

export const KNOWN_NICHE_KBS = [
  { file: 'HERBAL_CONTENT_KB.md', id: 'HERBAL_CONTENT_KB.md', label: '🌿 Resep Herbal, Jamu & Pengobatan Tradisional', default: true },
  { file: 'Food Styling & Photography KB.md', id: 'Food Styling & Photography KB.md', label: '🍳 Food Styling, Kuliner & Fotografi Makanan' },
  { file: 'KITCHEN_CONTENT_KB.md', id: 'KITCHEN_CONTENT_KB.md', label: '🔪 Dapur, Alat Masak & Tips Rumah Tangga' },
  { file: 'HOME_IMPROVEMENT_KB.md', id: 'HOME_IMPROVEMENT_KB.md', label: '🏠 Perbaikan Rumah, Dekorasi & DIY' },
  { file: 'ISLAMIC_HISTORY_CONTENT_KB.md', id: 'ISLAMIC_HISTORY_CONTENT_KB.md', label: '🕌 Kisah Sejarah Islam & Inspirasi Religi' },
  { file: 'HISTORY_CONTENT_KB.md', id: 'HISTORY_CONTENT_KB.md', label: '📜 Sejarah Dunia, Tokoh & Peradaban' },
  { file: 'PET_CONTENT_KB.md', id: 'PET_CONTENT_KB.md', label: '🐾 Hewan Peliharaan & Tips Kucing/Anjing' },
  { file: 'COMPLIANCE_GUIDE.md', id: 'COMPLIANCE_GUIDE.md', label: '🛡️ Standar Kepatuhan & Safe Claim Global' }
];

/**
 * Mengambil daftar Niche KB yang benar-benar ada di direktori kb/
 * @param {string} [customKbDir] - Direktori khusus jika berbeda dari cwd/kb
 * @returns {Array<{id: string, file: string, filename: string, label: string, default: boolean}>}
 */
export function getAvailableNicheKBs(customKbDir = null) {
  const kbDir = customKbDir || path.join(process.cwd(), 'kb');
  return KNOWN_NICHE_KBS.filter(n => {
    try {
      return fs.existsSync(path.join(kbDir, n.file));
    } catch (_) {
      return false;
    }
  }).map(n => ({
    id: n.id,
    file: n.file,
    filename: n.file,
    label: n.label,
    default: !!n.default
  }));
}
