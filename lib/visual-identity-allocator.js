/**
 * Visual Identity Allocator & Dynamic Mode Routing Engine
 * Integrates Schema v2 Visual Identity Foundation with Organic Pillar Campaigns.
 */

export const VISUAL_STYLE_DESCRIPTIONS = {
  editorial_graphic_novel: "Premium editorial political illustration, modern graphic novel aesthetic, sharp graphic silhouettes, dynamic panel-like framing, matte vector ink finish, high contrast editorial composition, intelligent visual journalism storytelling.",
  symbolic_surrealism: "Symbolic surrealism, abstract conceptual visual metaphors, thought-provoking dreamlike imagery representing socio-political and economic dynamics, minimalist architectural symbolism, high aesthetic impact.",
  isometric_society: "Clean isometric architectural diagram, miniature urban and institutional structures, interconnected systemic cogs, escalators, and societal loops, sharp isometric linework on subtle textured paper background.",
  paper_cutout_documentary: "Paper cutout documentary collage, multi-layered textured kraft paper craft, torn vintage editorial clippings, statistical charts, investigative blueprint schematics with tactile paper shadows.",
  shadow_silhouette: "High contrast shadow silhouettes, evocative backlit figures, stark geometric lighting against warm minimalist backgrounds.",
  clay_political_theater: "Tactile claymation stop-motion aesthetic, handcrafted miniature stage, expressive geometric forms, soft studio lighting."
};

/**
 * Dynamically allocates N clips to the 6 narrative functions and maps each to its visual mode.
 * Supports any clip count (4, 6, 8, 10, 15, 20, etc.).
 */
export function allocateClipsToNarrativeModes(totalClips = 6, modeRouting = {}) {
  const clips = Math.max(1, Number(totalClips) || 6);
  const defaultRouting = {
    hook: 'symbolic_surrealism',
    context: 'editorial_graphic_novel',
    mechanism: 'isometric_society',
    consequence: 'editorial_graphic_novel',
    evidence_reveal: 'paper_cutout_documentary',
    conclusion: 'symbolic_surrealism',
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

    const assignedMode = defaultRouting[selectedFunction] || defaultRouting.context || 'editorial_graphic_novel';
    allocations.push({
      clipIndex: c,
      narrativeFunction: selectedFunction,
      visualMode: assignedMode,
      modeDescription: VISUAL_STYLE_DESCRIPTIONS[assignedMode] || assignedMode
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
  const label = structured.label || snapshot.label || 'Editorial Visual System';
  const visualLang = structured.visual_language || {};
  const primaryStyle = visualLang.primary_style || 'editorial_graphic_novel';
  const supportingStyles = Array.isArray(visualLang.supporting_styles) ? visualLang.supporting_styles : [];
  const modeRouting = structured.mode_routing || {};
  const rendering = structured.rendering || {};
  const guardrails = structured.guardrails || {};
  const composition = structured.composition || {};
  const metaphorEngine = structured.metaphor_engine || {};
  const wardrobe = structured.wardrobe || {};
  const lighting = structured.lighting || {};

  const allocations = allocateClipsToNarrativeModes(totalClips, modeRouting);

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

  const wardrobeDesc = wardrobe.custom_description || (wardrobe.preset_key ? `Muted civilian attire (${wardrobe.preset_key})` : 'Everyday modest civilian attire in charcoal, off-white, warm gray and muted beige');
  const lightingDesc = lighting.custom_description || 'Soft directional editorial lighting with strong geometric shadows';

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
2. Tekstur Wajib      : ${texturesList} (Wajib menampilkan nuansa butiran kertas cetak dan garis tinta editorial).
3. Bayangan (Shadows) : ${rendering.shadow_style || 'strong_geometric'} (Bayangan geometris tegas berkarakter).
4. Finishing          : ${rendering.finish || 'matte_editorial'} (Matte print finish, dilarang glossy atau CGI kilap).
5. Palet Warna        : Charcoal, warm gray, off-white, muted beige. Maksimal SATU warna aksen per adegan (misal: amber/burnt orange lembut).

⚙️ METAPHOR ENGINE MANDATE (${metaphorEngine.pattern || 'concept_to_object_to_action'}):
- Anda DILARANG menggambarkan adegan live-action realistis klise (seperti orang rapat di kantor, adegan sinetron, atau foto stok kantor).
- Terjemahkan konsep abstrak (kebijakan publik, ekonomi, burnout, sistem sosial) menjadi OBJEK METAFORA FISIK YANG HIDUP:
  * Masalah sistemik ➔ Roda gigi korporasi transparan, diagram isometrik miniatur kota, eskalator sirkular tanpa henti.
  * Waktu & Kelelahan ➔ Jam pasir melayang dari lampu gedung kota, bayangan tubuh yang merekah menjadi retakan tanah kering.
  * Fakta & Data ➔ Kolase potongan kertas dokumen, grafik garis naik, potongan artikel koran editorial yang dirangkai tangan faceless.
  * Solusi / Refleksi ➔ Figur melangkah keluar gerbang menuju fajar cakrawala terbuka.

👥 ATURAN KARAKTER & WARDROBE:
- Konsep Karakter     : STRICTLY FACELESS (Semua figur manusia tampil tanpa mata/hidung/mulut, atau dari sudut belakang/siluet).
- Pakaian (Wardrobe)  : ${wardrobeDesc}. Lengan pakaian tertutup (wrists covered).
- Pencahayaan (Light) : ${lightingDesc}.

🚫 STRICT VISUAL GUARDRAILS (ZERO TOLERANCE):
- DILARANG KERAS memunculkan wajah manusia realistis (mata, hidung, mulut) atau potret close-up wajah orang nyata.
- DILARANG KERAS gaya photorealistic stock footage, siaran TV berita realistis, 3D glossy CGI kilap, atau clipart kartun anak-anak.
- Seluruh prompt T2I ("t2i_prompts") dan I2V ("i2v_prompts") WAJIB ditulis dalam Bahasa Inggris dan mencerminkan mode visual klip yang bersangkutan.
========================================================================
`;
}
