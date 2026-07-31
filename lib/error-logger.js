import { createSystemAuditLog } from './db.js';

/**
 * Mencatat error ke dalam database audit dengan tambahan saran perbaikan otomatis
 * @param {string} module - Nama pekerja yang crash (e.g., 're_analyzer')
 * @param {Error|string|any} errorObj - Objek Error Node.js asli
 * @param {string} refId - ID Kampanye/Item jika ada
 */
export function logSystemError(module, errorObj, refId = null) {
  const errorStr = errorObj ? errorObj.toString() : 'Unknown Error';
  let severity = 'WARNING';
  let hint = "Cek log terminal untuk detail teknis. Sistem akan mencoba (retry) kembali secara otomatis.";

  const errLower = errorStr.toLowerCase();

  // Google OAuth Issues (Kasus invalid_grant)
  if (errLower.includes('invalid_grant') || errLower.includes('no refresh token') || errLower.includes('credentials') || errLower.includes('oauth2')) {
    severity = 'CRITICAL';
    hint = "Google Authentication Anda kedaluwarsa. Silakan masuk ke menu 'Settings', lalu klik 'Disconnect' dan sambungkan ulang akun Google Drive Anda.";
  }
  // Shopee/Tokopedia Login Wall & anti-bot blocks
  else if (errLower.includes('belum masuk') || errLower.includes('login wall') || errLower.includes('anti-bot') || errLower.includes('scraped_image_url') || errLower.includes('webdriver')) {
    severity = 'CRITICAL';
    hint = "Playwright terdeteksi sebagai Bot oleh e-commerce. Silakan gunakan Form Edit manual untuk melengkapi detail produk atau periksa Playwright Stealth Scraper.";
  }
  // Gemini API Exhausted
  else if (errLower.includes('429') || errLower.includes('quota exceeded') || errLower.includes('ratelimit') || errLower.includes('exhausted')) {
    severity = 'WARNING';
    hint = "Limit API Gemini tercapai. Scheduler secara otomatis mengalihkan (cooldown) dan merotasi kunci API cadangan Anda. Tidak perlu panik.";
  }
  // FFmpeg Crashes
  else if (errLower.includes('ffmpeg') && (errLower.includes('no such file') || errLower.includes('enoent') || errLower.includes('corrupt'))) {
    severity = 'CRITICAL';
    hint = "Aset video mentah hasil AI belum selesai terunduh, tetapi FFmpeg sudah mencoba menggabungkannya. Berkas corrupt.";
  }

  try {
    createSystemAuditLog({
      severity_level: severity,
      module_name: module,
      reference_id: refId ? String(refId) : null,
      error_message: errorStr,
      human_resolution_hint: hint
    });
    console.log(`[Error Logger] Error logged for module [${module}]: ${errorStr}`);
  } catch (dbErr) {
    console.error("Gagal menulis ke system_audit_logs:", dbErr);
  }
}
