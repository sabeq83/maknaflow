/**
 * Cartoon Continuity Validator — Post-generation validation for cartoon universe outputs.
 * Checks AI output for consistency with universe rules.
 * Non-blocking: returns warnings but does not prevent pipeline from continuing.
 *
 * @module lib/cartoon-continuity-validator
 */

// PawVille canonical character names (lowercase for matching)
const PAWVILLE_CHARACTERS = {
  mochi: { species: 'british shorthair', traits: ['grey', 'amber eyes', 'green scarf', 'round', 'chubby'] },
  'dr. paw': { species: 'shiba inu', traits: ['white coat', 'medical bag', 'tan'] },
  'dr paw': { species: 'shiba inu', traits: ['white coat', 'medical bag', 'tan'] },
  coco: { species: 'corgi', traits: ['brown', 'white', 'sling bag'] },
  boba: { species: 'hamster', traits: ['cream', 'puffy cheeks'] },
  tofu: { species: 'rabbit', traits: ['white', 'green apron'] }
};

const PAWVILLE_LOCATIONS = [
  'pawville town square', 'mochi\'s home', 'mochi home', 'dr. paw\'s clinic', 'dr paw clinic',
  'pawville park', 'pawville market'
];

// Medical / diagnosis terms to flag
const MEDICAL_CLAIM_TERMS = [
  'menyembuhkan', 'mengobati', 'mencegah penyakit', 'pasti sehat', 'dijamin',
  'wajib dimiliki', 'diagnosis', 'mendiagnosis', 'cure', 'treat disease',
  'prevent illness', 'guaranteed', 'must have'
];

// Human presence indicators
const HUMAN_INDICATORS = [
  'human', 'manusia', 'person', 'man', 'woman', 'girl', 'boy',
  'hijab', 'jilbab', 'abaya', 'tangan manusia', 'human hand',
  'human face', 'wajah manusia'
];

/**
 * Validate cartoon universe continuity in AI-generated output.
 *
 * @param {Object} parsedOutput - The parsed AI JSON output (storyboard, voiceover, prompts)
 * @param {Object} universeConfig - Universe configuration snapshot
 * @param {Object} rowPayload - Row payload with character/premise metadata
 * @returns {{ valid: boolean, warnings: string[], checks: Object }}
 */
export function validateCartoonContinuity(parsedOutput, universeConfig = {}, rowPayload = {}) {
  const warnings = [];
  const checks = {
    scene_count: { passed: false, detail: '' },
    character_consistency: { passed: false, detail: '' },
    location_continuity: { passed: false, detail: '' },
    product_reveal_beat: { passed: false, detail: '' },
    cta_placement: { passed: false, detail: '' },
    pet_medical_claims: { passed: false, detail: '' },
    human_presence: { passed: false, detail: '' }
  };

  if (!parsedOutput) {
    warnings.push('Output AI kosong — tidak dapat divalidasi.');
    return { valid: false, warnings, checks };
  }

  const storyboard = parsedOutput.storyboard || [];
  const voiceover = parsedOutput.voiceover || [];
  const t2iPrompts = parsedOutput.t2i_prompts || [];
  const i2vPrompts = parsedOutput.i2v_prompts || [];

  // ─── Check 1: Scene Count ───
  if (storyboard.length === 7) {
    checks.scene_count = { passed: true, detail: `${storyboard.length} scenes (correct)` };
  } else {
    checks.scene_count = { passed: false, detail: `${storyboard.length} scenes (expected 7)` };
    warnings.push(`Scene count: ${storyboard.length} (expected 7).`);
  }

  // ─── Check 2: Character Consistency ───
  const mainChar = (rowPayload.main_character || 'Mochi').toLowerCase();
  const allVisualTexts = [
    ...t2iPrompts.map(p => typeof p === 'string' ? p : (p?.prompt || p?.t2i_prompt || '')),
    ...i2vPrompts.map(p => typeof p === 'string' ? p : (p?.prompt || p?.i2v_prompt || '')),
    ...storyboard.map(s => s.visual_description || '')
  ].join(' ').toLowerCase();

  const mainCharMentioned = allVisualTexts.includes(mainChar);
  if (mainCharMentioned) {
    checks.character_consistency = { passed: true, detail: `Main character "${mainChar}" found in visual prompts` };
  } else {
    checks.character_consistency = { passed: false, detail: `Main character "${mainChar}" NOT found in visual prompts` };
    warnings.push(`Karakter utama "${mainChar}" tidak ditemukan dalam prompt visual.`);
  }

  // ─── Check 3: Location Continuity ───
  const locationMentions = [];
  for (const scene of storyboard) {
    const desc = (scene.visual_description || '').toLowerCase();
    const found = PAWVILLE_LOCATIONS.find(loc => desc.includes(loc));
    locationMentions.push(found || 'unknown');
  }
  const uniqueLocations = [...new Set(locationMentions.filter(l => l !== 'unknown'))];
  if (uniqueLocations.length > 0) {
    checks.location_continuity = { passed: true, detail: `Locations used: ${uniqueLocations.join(', ')}` };
  } else {
    checks.location_continuity = { passed: false, detail: 'No recognized PawVille locations found' };
    warnings.push('Tidak ada lokasi PawVille yang dikenali dalam storyboard.');
  }

  // ─── Check 4: Product Reveal Beat ───
  const productRole = rowPayload.product_role || 'none';
  const expectedRevealBeat = rowPayload.product_reveal_beat || 'none';
  if (productRole === 'none' || expectedRevealBeat === 'none') {
    checks.product_reveal_beat = { passed: true, detail: 'No product (editorial mode) — skipped' };
  } else {
    const revealBeatNum = parseInt(expectedRevealBeat.replace('beat_', ''), 10);
    // Check if product terms appear before the expected beat
    let earlyProductMention = false;
    for (let i = 0; i < Math.min(revealBeatNum - 1, storyboard.length); i++) {
      const sceneText = (storyboard[i]?.visual_description || '').toLowerCase();
      const voText = (voiceover[i]?.narration || '').toLowerCase();
      if (sceneText.includes('product') || sceneText.includes('produk') || voText.includes('produk')) {
        earlyProductMention = true;
        warnings.push(`Produk terdeteksi sebelum Beat ${revealBeatNum} (di Beat ${i + 1}).`);
      }
    }
    checks.product_reveal_beat = {
      passed: !earlyProductMention,
      detail: earlyProductMention ? `Product mentioned before Beat ${revealBeatNum}` : `Product reveal at Beat ${revealBeatNum} (correct)`
    };
  }

  // ─── Check 5: CTA Placement ───
  const lastScene = storyboard[storyboard.length - 1];
  const lastVO = voiceover[voiceover.length - 1];
  const ctaInLastScene = (lastVO?.narration || '').toLowerCase();
  // Check for CTA-like words in non-last scenes
  let earlyCtaFound = false;
  const ctaTerms = ['klik', 'beli', 'keranjang', 'link', 'checkout', 'order', 'pesan sekarang'];
  for (let i = 0; i < voiceover.length - 1; i++) {
    const voText = (voiceover[i]?.narration || '').toLowerCase();
    if (ctaTerms.some(term => voText.includes(term))) {
      earlyCtaFound = true;
      warnings.push(`CTA terdeteksi di Beat ${i + 1} (seharusnya hanya di Beat 7).`);
    }
  }
  checks.cta_placement = {
    passed: !earlyCtaFound,
    detail: earlyCtaFound ? 'CTA found before Beat 7' : 'CTA only at Beat 7 (correct)'
  };

  // ─── Check 6: Pet / Medical Claims ───
  const allNarrations = voiceover.map(v => (v?.narration || '').toLowerCase()).join(' ');
  const foundClaims = MEDICAL_CLAIM_TERMS.filter(term => allNarrations.includes(term));
  if (foundClaims.length > 0) {
    checks.pet_medical_claims = { passed: false, detail: `Found: ${foundClaims.join(', ')}` };
    warnings.push(`Klaim medis/pet terdeteksi dalam narasi: ${foundClaims.join(', ')}.`);
  } else {
    checks.pet_medical_claims = { passed: true, detail: 'No medical claims detected' };
  }

  // ─── Check 7: Human Presence ───
  const allTexts = [allVisualTexts, allNarrations].join(' ');
  const foundHumans = HUMAN_INDICATORS.filter(term => {
    // Avoid false positives: "human" inside "inhuman" etc.
    const regex = new RegExp(`\\b${term}\\b`, 'i');
    return regex.test(allTexts);
  });
  if (foundHumans.length > 0) {
    checks.human_presence = { passed: false, detail: `Found: ${foundHumans.join(', ')}` };
    warnings.push(`Indikator manusia terdeteksi: ${foundHumans.join(', ')}. Cartoon Universe DILARANG memunculkan manusia.`);
  } else {
    checks.human_presence = { passed: true, detail: 'No human indicators detected' };
  }

  const passedCount = Object.values(checks).filter(c => c.passed).length;
  const totalChecks = Object.keys(checks).length;

  return {
    valid: warnings.length === 0,
    warnings,
    checks,
    summary: `${passedCount}/${totalChecks} checks passed`
  };
}

/**
 * Log validation results. Non-blocking — only warns.
 */
export function logValidationResults(itemId, result) {
  const prefix = `[Cartoon Continuity Validator] Item ${itemId}`;
  if (result.valid) {
    console.log(`${prefix}: ✅ All ${result.summary} — no issues detected.`);
  } else {
    console.warn(`${prefix}: ⚠️ ${result.summary}`);
    for (const warning of result.warnings) {
      console.warn(`  → ${warning}`);
    }
  }
}
