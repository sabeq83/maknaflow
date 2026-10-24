/**
 * Centralized Compliance & Safety Guardrails Hub
 * File: lib/compliance-constants.js
 * Single Source of Truth untuk aturan kepatuhan TikTok Shop, Meta Ads, dan pembatasan klaim medis/kesehatan.
 */

export const TIKTOK_COMPLIANCE_MANDATE = `
TIKTOK SHOP COMPLIANCE & SAFE-VOICE MANDATE (WAJIB DIPATUHI PADA SELURUH KLIP):
1. DILARANG menggunakan klaim medis absolut, klaim mengobati/menyembuhkan penyakit kronis (diabetes, wasir, kanker, kolesterol, stroke, hipertensi).
2. DILARANG menggunakan frasa jaminan instan atau klaim absolut seperti "garansi 100%", "dijamin langsing", "hilang permanen".
3. DILARANG menggunakan klaim tanpa efek samping ("tanpa efek samping", "bebas ketergantungan", "aman tanpa efek").
4. DILARANG menggunakan klaim pseudo-medis seperti "detoks usus kotor", "luntur lemak seketika", "racun tubuh hilang total".
5. Gunakan bahasa edukatif, manfaat bahan alami, testimoni personal wajar, dan gaya bercerita yang aman bagi kebijakan TikTok Shop.
`;

export const TIKTOK_COMPLIANCE_MANDATE_EN = `
TIKTOK SHOP COMPLIANCE & SAFE-VOICE MANDATE [GLOBAL - STRICT]:
1. FORBIDDEN to make absolute medical claims, cure claims, or diagnose chronic diseases (diabetes, cancer, hypertension, cholesterol).
2. FORBIDDEN to use instant guarantee phrases ("100% guaranteed", "instant weight loss", "permanent cure").
3. FORBIDDEN to claim "zero side effects" or "guaranteed risk-free".
4. FORBIDDEN to use pseudoscientific buzzwords ("melts belly fat overnight", "flushes all toxins instantly").
5. Use compliant, educational phrasing focusing on wholesome natural ingredients, balanced routines, and general wellness.
`;

export const BANNED_HEALTH_CLAIMS = [
  'sembuh total',
  'menyembuhkan diabetes',
  'garansi 100%',
  'dijamin langsing',
  'hilang permanen',
  'tanpa efek samping',
  'luntur lemak seketika',
  'detoks usus kotor',
  'melts fat overnight',
  'cures diabetes',
  '100% guaranteed'
];

export function getComplianceMandate(language = 'id-ID') {
  const isEn = String(language || '').toLowerCase().startsWith('en');
  return isEn ? TIKTOK_COMPLIANCE_MANDATE_EN : TIKTOK_COMPLIANCE_MANDATE;
}
