/**
 * Standardized ID Generator Utility for MAKNA Grid V2.0
 * 
 * Campaign ID Format: <MODULE_PREFIX>_<YYMMDD>_<6CHAR_HEX>
 * Video ID Format: <account_slug>_<module_prefix>_<6char_campaign_hash>_<padded_sequence>
 */

import crypto from 'crypto';

/**
 * Generate standardized Campaign ID
 * @param {string} modulePrefix - Module code (e.g. 're', 'opc', 'sc', 'sheets', 'instant', 'bridge', 'recipe')
 * @param {Date} [date] - Optional date object
 * @returns {string} e.g. 're_260725_66b4d6'
 */
export function generateCampaignId(modulePrefix = 'cmp', date = new Date()) {
  const prefix = (modulePrefix || 'cmp').toLowerCase().trim();
  
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const dateStr = `${yy}${mm}${dd}`;

  // Generate 6-char random hex
  const randomHex = Math.random().toString(36).substring(2, 8).toLowerCase();

  return `${prefix}_${dateStr}_${randomHex}`;
}

/**
 * Generate standardized Video ID for ContentFlow items
 * @param {Object} params
 * @param {string} params.accountName - Name of the brand account (e.g. 'Nutribake', 'Siasat Sehat')
 * @param {string} params.modulePrefix - Module code (e.g. 're', 'opc', 'sc', 'sheets', 'instant')
 * @param {string} params.campaignId - Source campaign ID
 * @param {number|string} params.sequence - Item sequence or index (e.g. 1, 2, '01')
 * @returns {string} e.g. 'nutribake_re_66b4d6_01'
 */
export function generateVideoId({ accountName, modulePrefix = 're', campaignId = '', sequence = 1 }) {
  const accountSlug = (accountName || 'umum')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '');

  const modPrefix = (modulePrefix || 're').toLowerCase().trim();

  // Extract 6-char campaign hash if campaignId contains underscores/hyphens or raw string
  let campaignHash = 'gen';
  if (campaignId) {
    const cleanId = String(campaignId).replace(/[^a-z0-9]/gi, '').toLowerCase();
    if (cleanId.length >= 6) {
      campaignHash = cleanId.substring(cleanId.length - 6);
    } else {
      campaignHash = cleanId.padStart(6, '0');
    }
  }

  const paddedSeq = String(sequence).padStart(2, '0');

  return `${accountSlug}_${modPrefix}_${campaignHash}_${paddedSeq}`;
}
