/**
 * Pre-Prompt Product Title & Info Sanitizer
 * Fast local regex sanitizer (<1ms) to strip aggressive promotional keywords
 * before passing product titles/descriptions into Gemini AI prompt generators.
 */

const AGGRESSIVE_PROMO_REGEX = /\b(detox|detoks|detoksifikasi|pelangsing|penurun\s+berat\s+badan|slimming|usus\s+kotor|luntur\s+lemak|melunturkan\s+lemak|tanpa\s+efek\s+samping|tanpa\s+ketergantungan|bebas\s+efek\s+samping|bebas\s+ketergantungan|ampuh|pembakar\s+lemak|obat\s+penyakit|menyembuhkan|mengobati)\b/gi;

/**
 * Sanitize product title
 * Example: "NEZAFIT Teh Diet Detox Daun Jati China Pelangsing Penurun Berat Badan Ampuh"
 * Returns: "NEZAFIT Teh Daun Jati China"
 */
export function sanitizeProductTitle(rawTitle = '') {
  if (!rawTitle || typeof rawTitle !== 'string') return '';

  let cleaned = rawTitle.replace(AGGRESSIVE_PROMO_REGEX, '');
  // Clean up extra spaces, duplicate dashes/pipes
  cleaned = cleaned.replace(/\s+/g, ' ').replace(/\s*[-|_|:]\s*$/g, '').trim();

  return cleaned || rawTitle;
}

/**
 * Sanitize product USP / text payload
 */
export function sanitizeProductUsp(rawUsp = '') {
  if (!rawUsp || typeof rawUsp !== 'string') return '';
  return rawUsp.replace(AGGRESSIVE_PROMO_REGEX, '').replace(/\s+/g, ' ').trim();
}
