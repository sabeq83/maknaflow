/**
 * Visual Language Catalog
 * Deterministic catalog for visual styles, narrative functions, and prompt templates.
 */

export const VISUAL_STYLE_KEYS = [
  'editorial_graphic_novel',
  'isometric_society',
  'symbolic_surrealism',
  'paper_cutout_documentary',
  'shadow_silhouette',
  'clay_political_theater'
];

export const NARRATIVE_FUNCTIONS = [
  'hook',
  'context',
  'mechanism',
  'consequence',
  'evidence_reveal',
  'conclusion'
];

export const VISUAL_LANGUAGE_CATALOG = {
  editorial_graphic_novel: {
    key: 'editorial_graphic_novel',
    label: 'Editorial Graphic Novel',
    description: 'Modern political graphic novel with strong silhouettes, restrained color accents, and high-impact framing.',
    prompt: 'premium editorial political illustration, modern graphic novel aesthetic, sharp graphic silhouettes, dynamic panel-like framing, matte vector ink finish, high contrast editorial composition, intelligent visual journalism storytelling',
    negative_prompts: ['photorealistic stock footage', 'news TV broadcast composition', 'glossy 3D CGI', 'generic corporate vector clipart']
  },
  isometric_society: {
    key: 'isometric_society',
    label: 'Isometric Society',
    description: 'Miniature systemic overview explaining public infrastructure, institutions, and economic flows.',
    prompt: 'isometric miniature society, elevated angled systemic perspective, interconnected urban infrastructure, transparent institutional cross-sections, readable supply and policy flow, clean architectural precision, stylized modular miniature citizens',
    negative_prompts: ['decorative isometric scene without readable system flow', 'flat 2D infographic', 'unclear camera angle']
  },
  symbolic_surrealism: {
    key: 'symbolic_surrealism',
    label: 'Symbolic Surrealism',
    description: 'Metaphorical concept translation using physical scale shifts, surreal balance, and symbolic objects.',
    prompt: 'symbolic conceptual surrealism, editorial thought-experiment illustration, dramatic scale disparity, physical metaphor objects, clean negative space, thought-provoking philosophical composition, dreamlike yet precise intellectual visual metaphor',
    negative_prompts: ['literal realistic scene', 'chaotic abstract noise without clear focal idea', 'fantasy magical glow']
  },
  paper_cutout_documentary: {
    key: 'paper_cutout_documentary',
    label: 'Paper Cutout Documentary',
    description: 'Layered tactile collages for legal documents, budgets, timeline reveals, and investigative facts.',
    prompt: 'tactile paper cutout documentary collage, multi-layered textured paper crafts, archival document fragments, subtle physical drop shadows between layers, investigative newsroom dossier feel, stop-motion papercraft aesthetic',
    negative_prompts: ['smooth digital gradients', 'untextured flat graphics', 'glossy plastic finish']
  },
  shadow_silhouette: {
    key: 'shadow_silhouette',
    label: 'Shadow & Silhouette',
    description: 'High-contrast light and shadow drama representing unseen power, covert influence, and structural barriers.',
    prompt: 'dramatic high-contrast shadow and silhouette, stark chiaroscuro lighting, deep theatrical cast shadows revealing structural forces, back-lit faceless figures, bold minimalist noir atmosphere',
    negative_prompts: ['soft flat low-contrast lighting', 'visible facial expressions', 'colorful bright palette']
  },
  clay_political_theater: {
    key: 'clay_political_theater',
    label: 'Clay Political Theater',
    description: 'Tactile stop-motion clay aesthetic for political satire, bureaucratic parody, and behavioral caricatures.',
    prompt: 'tactile handcrafted stop-motion clay animation aesthetic, matte plasticine material texture, miniature studio lighting setup, satirical political theater staging, fingerprint craft details, stylized faceless clay characters',
    negative_prompts: ['smooth digital CGI render', 'photorealistic live action', 'hyper-glossy porcelain']
  }
};

export function getVisualStyleDefinition(key) {
  return VISUAL_LANGUAGE_CATALOG[key] || VISUAL_LANGUAGE_CATALOG.editorial_graphic_novel;
}

export function isValidVisualStyle(key) {
  return typeof key === 'string' && VISUAL_STYLE_KEYS.includes(key);
}

export function isValidNarrativeFunction(fn) {
  return typeof fn === 'string' && NARRATIVE_FUNCTIONS.includes(fn);
}

export function getDefaultNarrativeRouting(primaryStyle = 'editorial_graphic_novel') {
  const fallback = isValidVisualStyle(primaryStyle) ? primaryStyle : 'editorial_graphic_novel';
  return {
    hook: fallback,
    context: fallback,
    mechanism: fallback,
    consequence: fallback,
    evidence_reveal: fallback,
    conclusion: fallback
  };
}
