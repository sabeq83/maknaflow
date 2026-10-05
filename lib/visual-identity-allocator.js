/**
 * Visual Identity Allocator & Dynamic Mode Routing Engine
 * Integrates Schema v2 Visual Identity Foundation with Organic Pillar Campaigns.
 */

import {
  DEFAULT_VISUAL_STYLE,
  VISUAL_LANGUAGE_CATALOG,
  getVisualStyleDefinition,
  isValidVisualStyle
} from './visual-language-catalog.js';

// Backward compatibility export derived from central catalog
export const VISUAL_STYLE_DESCRIPTIONS = Object.fromEntries(
  Object.entries(VISUAL_LANGUAGE_CATALOG).map(([k, v]) => [k, v.description || v.label])
);

/**
 * Dynamically allocates N clips to the 6 narrative functions and maps each to its visual mode.
 * Supports any clip count (4, 6, 8, 10, 15, 20, etc.).
 */
export function allocateClipsToNarrativeModes(totalClips = 6, modeRouting = {}, primaryStyle = DEFAULT_VISUAL_STYLE) {
  const clips = Math.max(1, Number(totalClips) || 6);
  const fallbackStyle = isValidVisualStyle(primaryStyle) ? primaryStyle : DEFAULT_VISUAL_STYLE;

  const defaultRouting = {
    hook: fallbackStyle,
    context: fallbackStyle,
    mechanism: fallbackStyle,
    consequence: fallbackStyle,
    evidence_reveal: fallbackStyle,
    conclusion: fallbackStyle,
    ...modeRouting
  };

  const allocations = [];

  for (let c = 1; c <= clips; c++) {
    let selectedFunction = 'context';

    if (clips === 1) {
      selectedFunction = 'hook';
    } else if (clips === 2) {
      selectedFunction = c === 1 ? 'hook' : 'conclusion';
    } else if (clips === 3) {
      selectedFunction = c === 1 ? 'hook' : (c === 2 ? 'mechanism' : 'conclusion');
    } else if (clips === 4) {
      if (c === 1) selectedFunction = 'hook';
      else if (c === 2) selectedFunction = 'context';
      else if (c === 3) selectedFunction = 'evidence_reveal';
      else selectedFunction = 'conclusion';
    } else if (clips === 5) {
      if (c === 1) selectedFunction = 'hook';
      else if (c === 2) selectedFunction = 'context';
      else if (c === 3) selectedFunction = 'mechanism';
      else if (c === 4) selectedFunction = 'evidence_reveal';
      else selectedFunction = 'conclusion';
    } else {
      // General proportional allocation for N >= 6 clips
      const ratio = (c - 0.5) / clips;
      if (c === 1 || ratio <= 0.15) {
        selectedFunction = 'hook';
      } else if (c === clips || ratio >= 0.88) {
        selectedFunction = 'conclusion';
      } else if (ratio <= 0.35) {
        selectedFunction = 'context';
      } else if (ratio <= 0.58) {
        selectedFunction = 'mechanism';
      } else if (ratio <= 0.78) {
        selectedFunction = 'consequence';
      } else {
        selectedFunction = 'evidence_reveal';
      }
    }

    const assignedMode = defaultRouting[selectedFunction] || defaultRouting.context || fallbackStyle;
    const styleDef = VISUAL_LANGUAGE_CATALOG[assignedMode] || { description: assignedMode };

    allocations.push({
      clipIndex: c,
      narrativeFunction: selectedFunction,
      visualMode: assignedMode,
      modeDescription: styleDef.description || assignedMode
    });
  }

  return allocations;
}

/**
 * Builds the comprehensive Visual Identity Mandate section for the Gemini AI Prompt.
 */
export function buildVisualIdentityPromptSection(snapshot, totalClips = 6) {
  if (!snapshot) return '';

  const structured = snapshot.structured || snapshot;
  const label = structured.label || snapshot.label || 'Visual Identity System';
  const visualLang = structured.visual_language || {};
  const primaryStyle = visualLang.primary_style || DEFAULT_VISUAL_STYLE;
  const supportingStyles = Array.isArray(visualLang.supporting_styles) ? visualLang.supporting_styles : [];
  const modeRouting = structured.mode_routing || {};
  const rendering = structured.rendering || {};
  const guardrails = structured.guardrails || {};
  const composition = structured.composition || {};
  const metaphorEngine = structured.metaphor_engine || {};
  const wardrobe = structured.wardrobe || {};
  const lighting = structured.lighting || {};

  const allocations = allocateClipsToNarrativeModes(totalClips, modeRouting, primaryStyle);

  // Group allocations into readable ranges for prompt
  const groupedRanges = [];
  let currentGroup = null;

  for (const alloc of allocations) {
    if (!currentGroup || currentGroup.visualMode !== alloc.visualMode || currentGroup.narrativeFunction !== alloc.narrativeFunction) {
      if (currentGroup) groupedRanges.push(currentGroup);
      currentGroup = {
        start: alloc.clipIndex,
        end: alloc.clipIndex,
        narrativeFunction: alloc.narrativeFunction,
        visualMode: alloc.visualMode,
        description: alloc.modeDescription
      };
    } else {
      currentGroup.end = alloc.clipIndex;
    }
  }
  if (currentGroup) groupedRanges.push(currentGroup);

  const tableLines = groupedRanges.map(g => {
    const rangeLabel = g.start === g.end ? `Klip ${g.start}` : `Klip ${g.start}–${g.end}`;
    return `* ${rangeLabel.padEnd(14)} [Fungsi: ${g.narrativeFunction.toUpperCase()}] ➔ Mode Visual: "${g.visualMode}"\n  -> Panduan Estetika: ${g.description}`;
  }).join('\n');

  const texturesList = Array.isArray(rendering.textures) && rendering.textures.length > 0
    ? rendering.textures.join(', ')
    : 'printed_paper_grain, editorial_ink';

  const wardrobeDesc = wardrobe.custom_description || (wardrobe.preset_key ? `Attire preset (${wardrobe.preset_key})` : 'Everyday modest civilian attire in charcoal, off-white, warm gray and muted beige');
  const lightingDesc = lighting.custom_description || 'Soft directional lighting with natural shadows';

  const subject = structured.subject || {};
  const isFacelessMandate = guardrails.face_visibility !== 'allowed' &&
                            subject.face_visibility !== 'allowed' &&
                            primaryStyle !== 'stylized_3d_character' &&
                            primaryStyle !== '3d_claymation_cozy' &&
                            subject.kind !== 'stylized_3d_character';

  const charConceptDesc = isFacelessMandate
    ? 'STRICTLY FACELESS (Semua figur manusia tampil tanpa mata/hidung/mulut, atau dari sudut belakang/siluet/potong siku ke bawah).'
    : 'FULL 3D STYLIZED ANIMATED CHARACTER (Karakter kartun 3D ekspresif dengan mata animasi besar, hidung, dan mulut tersenyum ramah. Aturan faceless/hidden face TIDAK BERLAKU).';

  const sleeveRule = wardrobe.sleeve_policy === 'forearms_exposed'
    ? 'Sleeve policy: forearms exposed / lengan santai sesuai desain karakter.'
    : 'Lengan pakaian tertutup (wrists covered).';

  const guardrailsFaceRule = isFacelessMandate
    ? '- DILARANG KERAS memunculkan wajah manusia realistis (mata, hidung, mulut) atau potret close-up wajah orang nyata.'
    : '- DILARANG KERAS memunculkan wajah manusia fotorealistik / orang nyata live-action. Wajib konsisten dengan gaya animasi 3D kartun ekspresif (3D Pixar/DreamWorks stylized family animation).';

  return `
========================================================================
🎨 VISUAL IDENTITY SYSTEM & DYNAMIC MODE ROUTING (MANDATORY CONTRACT)
========================================================================
Sistem Visual Identity Aktif: "${label}"
Gaya Visual Utama (Primary Style): "${primaryStyle}"
Gaya Pendukung (Supporting Modes): ${supportingStyles.join(', ')}

🚨 ATURAN PENUGASAN MODE VISUAL DINAMIS PER-KLIP (Total ${totalClips} Klip):
Anda WAJIB menerapkan mode visual berikut pada deskripsi visual storyboard dan prompt T2I/I2V di setiap klip:
${tableLines}

🏛️ RENDERING & TEXTURE SPECIFICATIONS (STRICT ARTISTIC FINISH):
1. Geometri & Bentuk  : ${rendering.geometry || 'simplified_semi_realistic'} (Bentuk semi-realistis yang disederhanakan, siluet tajam, proporsional).
2. Tekstur Wajib      : ${texturesList} (Wajib menampilkan nuansa tekstur material yang realistis dan konsisten).
3. Bayangan (Shadows) : ${rendering.shadow_style || 'strong_geometric'} (Bayangan terkalibrasi sesuai pencahayaan adegan).
4. Finishing          : ${rendering.finish || 'matte_editorial'} (Finishing permukaan sesuai estetika gaya visual).
5. Palet Warna        : Terkoordinasi harmonis, maksimal SATU warna aksen kuat per adegan.

⚙️ METAPHOR ENGINE MANDATE (${metaphorEngine.pattern || 'concept_to_object_to_action'}):
- Anda DILARANG menggambarkan adegan live-action klise tanpa arah visual yang jelas.
- Terjemahkan konsep abstrak menjadi OBJEK METAFORA FISIK YANG HIDUP dan aksi visual yang memikat.

👥 ATURAN KARAKTER & WARDROBE:
- Konsep Karakter     : ${charConceptDesc}
- Pakaian (Wardrobe)  : ${wardrobeDesc}. ${sleeveRule}
- Pencahayaan (Light) : ${lightingDesc}.

🚫 STRICT VISUAL GUARDRAILS (ZERO TOLERANCE):
${guardrailsFaceRule}
- DILARANG KERAS visual cacat, artefak CGI berlebihan, atau gaya visual yang bertentangan dengan Primary Style.
- Seluruh prompt T2I ("t2i_prompts") dan I2V ("i2v_prompts") WAJIB ditulis dalam Bahasa Inggris dan mencerminkan mode visual klip yang bersangkutan.
========================================================================
`;
}
