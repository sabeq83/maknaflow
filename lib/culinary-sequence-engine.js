import fs from 'fs';
import path from 'path';

/**
 * Compiles a comprehensive culinary-focused system prompt for Gemini
 * by dynamically stitching guidelines from foods_n_drink KBs and general photography seed KBs.
 * 
 * @param {Object} brandProfile The active brand profile details from SQLite
 * @param {string} category The recipe category (e.g. Makanan, Minuman, etc.)
 * @param {string} visualStyle The selected visual styling (e.g. Food Porn, Macro, etc.)
 * @returns {string} The final system prompt
 */
export function compileCulinarySystemPrompt(brandProfile, category, visualStyle, config = null) {
  const rootDir = process.cwd();
  const foodsNDrinkDir = path.join(rootDir, 'foods_n_drink');
  const kbSeedsDir = path.join(rootDir, 'kb');

  // List of files to read in the foods_n_drink folder
  const filesMap = {
    framework: 'Framework v3.md',
    kb01: 'FOODS & DRINKS - KB-01_ Core Brand Guidelines.md',
    kb02: 'FOODS & DRINKS - KB-02_ Content Pillars & Recipe Standards.md',
    kb03: 'FOODS & DRINKS - KB-03_ Modular Storytelling & Hook Library.md',
    kb04: 'FOODS & DRINKS - KB-04_ Visual Direction & Food Styling.md',
    kb05: 'FOODS & DRINKS - KB-05_ Signature Moments & Visual DNA.md',
    kb06: 'FOODS & DRINKS - KB-06_ Google Veo Prompt Engineering Guide.md',
    kb07: 'FOODS & DRINKS - KB-07_ Affiliate Integration Strategy.md',
    kb08: 'FOODS & DRINKS - KB-08_ Copywriting & SEO Toolkit.md',
    kb09: 'FOODS & DRINKS - KB-09_ Video DNA Data Dictionary.md',
    kb10: 'FOODS & DRINKS - KB-10_ Performance Hypothesis & Optimization Logic.md'
  };

  const contents = {};
  for (const [key, filename] of Object.entries(filesMap)) {
    const filePath = path.join(foodsNDrinkDir, filename);
    if (fs.existsSync(filePath)) {
      contents[key] = fs.readFileSync(filePath, 'utf8');
    } else {
      console.warn(`[CSE Warning] File not found: ${filePath}`);
      contents[key] = '';
    }
  }

  // Load General Photography seed KB if it exists
  let seedFoodKB = '';
  const seedFoodPath = path.join(kbSeedsDir, 'Food Styling & Photography KB.md');
  if (fs.existsSync(seedFoodPath)) {
    seedFoodKB = fs.readFileSync(seedFoodPath, 'utf8');
  }

  // Format Brand Profile details into Markdown format
  let brandProfileMD = 'N/A';
  if (brandProfile) {
    brandProfileMD = `
## Active Brand Profile Details:
- **Brand Name**: ${brandProfile.brand_name || 'N/A'}
- **Tone of Voice**: ${brandProfile.tone_of_voice || 'N/A'}
- **Visual Signature**: ${brandProfile.visual_signature || 'N/A'}
- **Color Palette**: ${brandProfile.color_palette || 'N/A'}
- **Forbidden Elements**: ${brandProfile.forbidden_elements || 'N/A'}
- **Brand Slogan or CTA**: ${brandProfile.brand_slogan_or_cta || 'N/A'}
- **Guideline Summary**: ${brandProfile.raw_guideline_text || 'N/A'}
`;
  }

  // Inject the Brand Profile into the Core Brand Guidelines (KB-01)
  if (contents.kb01) {
    contents.kb01 = contents.kb01.replace('[Brand Profile]', brandProfileMD);
  }

  // Format campaign overrides into Markdown format
  let configMD = '';
  if (config) {
    configMD = `
- **Campaign Name**: ${config.campaign_name || 'N/A'}
- **Narrative Mode**: ${config.narrative_mode || 'Storytelling'}
- **Content Pillar / Niche**: ${config.content_pillar || 'N/A'}
- **Language**: ${config.target_language || 'id-ID'}
- **Visual Style**: ${config.visual_style || visualStyle || 'Food Porn'}
- **Face Visibility**: ${config.face_visibility || 'Faceless'} (CRITICAL: If "Faceless" or concept is "faceless", the framing MUST be strictly from the elbow down, focusing only on forearm and hand movements. Strictly do NOT show any face, head, neck, chest, or shoulders.)
- **Words per clip**: ${config.words_per_clip || 'N/A'}
- **Aspect Ratio**: ${config.aspect_ratio || '9:16'}

${config.custom_hook ? `- **Hook Voiceover Constraint**: "${config.custom_hook}" (Use this exact voiceover hook in Module A)` : ''}
${config.visual_action_guideline ? `- **Visual Action Guideline**: "${config.visual_action_guideline}" (Incorporate this action into the storyboard visual scenarios)` : ''}
${config.custom_instruction ? `- **Custom Instruction**: "${config.custom_instruction}" (Apply this constraint strictly)` : ''}

${config.deconstruct_storyboard ? `
#### Deconstructed Competitor Video Reference (Use this as blueprint):
- **Source Video URL**: ${config.deconstruct_url || 'N/A'}
- **Original Competitor Storyboard**:
${config.deconstruct_storyboard}
- **Deconstructed Product/Ingredient Ideas**:
${config.deconstruct_ideas || 'N/A'}

*INSTRUCTION: Formulate your video storyboard, modules, visual scenes, and voiceover to mimic the visual sequence of the competitor above. However, rewrite it completely to be original, high quality, and adapted to our visual settings.*
` : ''}

#### Product Bridging & Affiliate Settings:
- **Active**: ${config.is_bridging_active ? 'Yes' : 'No'}
${config.is_bridging_active ? `
- **Target Clips**: ${config.target_clips_count || 4}
- **Bridge Position**: At clip #${config.bridge_at_clip || 2}
- **Promotion Style**: ${config.promotion_style || 'Softselling'}
- **Product Name**: ${config.manual_product_name || 'N/A'}
- **Product Description**: ${config.manual_product_desc || 'N/A'}
- **Product USP**: ${config.manual_product_usp || 'N/A'}
- **Product Link**: ${config.product_url || 'N/A'}
- **Visual Integration Mode**: ${config.visual_mode || 'hybrid_lock'}
` : ''}

#### Visual Swap Overrides (Character & Set Settings):
- **Active**: ${config.is_vso_active ? 'Yes' : 'No'}
${config.is_vso_active ? `
- **Character Concept**: ${config.character_concept || 'faceless'} (CRITICAL: If "faceless", the framing MUST be strictly from the elbow down, focusing only on forearm and hand movements. Strictly do NOT show any face, head, neck, chest, or shoulders.)
- **Subject Demographic**: ${config.subject_demographic || 'syari_classic'}
- **Wardrobe Style**: ${config.wardrobe_style === 'custom' ? config.wardrobe_style_custom : config.wardrobe_style}
- **Lighting Style**: ${config.lighting_style === 'custom' ? config.lighting_style_custom : config.lighting_style}
` : ''}
`;
  }

  // Stitch all elements together into a structured prompt
  const stitchedPrompt = `
You are an expert AI content director specializing in food and beverage content generation.
Your task is to generate a comprehensive, highly-structured 5-Module Facebook Reels Video Storyboard based on the following guidelines.

---

### Part 1: MASTER PRODUCTION FRAMEWORK
${contents.framework}

---

### Part 2: CORE BRAND DNA & GUIDELINES (KB-01)
${contents.kb01}

---

### Part 3: CULINARY STANDARDS & RECIPE FORMULA (KB-02)
- Category Target: "${category || 'Makanan'}"
- Visual Style Selected: "${visualStyle || 'Food Porn'}"
${contents.kb02}

---

### Part 4: NARRATIVE STRUCTURE & HOOK LIBRARY (KB-03)
${contents.kb03}

---

### Part 5: VISUAL STYLE & ART DIRECTION (KB-04 & General Photography KB)
${contents.kb04}

${seedFoodKB ? `\n--- GENERAL PHOTOGRAPHY CORE STANDARDS ---\n${seedFoodKB}` : ''}

---

### Part 6: SIGNATURE MOMENTS (KB-05)
${contents.kb05}

---

### Part 7: GOOGLE VEO PROMPT SYNTAX (KB-06)
${contents.kb06}

---

### Part 8: MONETIZATION & AFFILIATE STRATEGY (KB-07)
${contents.kb07}

---

### Part 9: COPYWRITING & SEO TOOLKIT (KB-08)
${contents.kb08}

---

### Part 10: VIDEO DNA SCHEMA (KB-09)
${contents.kb09}

---

### Part 11: OPTIMIZATION & PERFORMANCE HYPOTHESIS (KB-10)
${contents.kb10}

---

${configMD ? `### Part 12: USER CAMPAIGN SPECIFIC CONFIGURATIONS & OVERRIDES\n${configMD}\n\n---\n` : ''}

### MANDATORY OUTPUT SCHEMA
You MUST output your response in a single, valid JSON block. The JSON block must have this EXACT keys structure:
{
  "title": "Nama Resep/Minuman",
  "content_md": "# Nama Resep/Minuman\\n\\nResep lengkap dalam format Markdown...",
  "storyboard": {
    "module_a": {
      "module_name": "HOOK (4 Seconds)",
      "goal": "Tujuan visual/audio hook",
      "visual_scenario": "Detail adegan visual",
      "camera_angle": "e.g. Extreme Close Up, Overhead, dll",
      "camera_movement": "e.g. Push In, Orbit, dll",
      "voice_over": "Naskah voice over dalam Bahasa Indonesia (MAKSIMAL 8-10 KATA)",
      "veo_prompt": "(VERTICAL 9:16) Detailed prompt for Google Veo using the 7 layers from KB-06, including model default suffix (e.g. omni_flash constraints, no text, vertical 9:16)"
    },
    "module_b": {
      "module_name": "INGREDIENT (8 Seconds)",
      "goal": "Tujuan...",
      "visual_scenario": "...",
      "camera_angle": "...",
      "camera_movement": "...",
      "voice_over": "Naskah voice over (MAKSIMAL 15-20 KATA)",
      "veo_prompt": "(VERTICAL 9:16) Detailed prompt for Google Veo using the 7 layers from KB-06, including model default suffix (e.g. veo_31_lite constraints, no text, vertical 9:16)"
    },
    "module_c": {
      "module_name": "PROCESS (8 Seconds)",
      "goal": "...",
      "visual_scenario": "[STRICT: FACELESS COOKING. Hanya boleh menampilkan siku ke bawah, fokus pada aksi tangan/lengan. DILARANG keras menampilkan wajah, kepala, leher, dada, atau bahu. Jika tidak ada interaksi tangan, fokus murni pada fisika makanan tanpa manusia] ...",
      "camera_angle": "...",
      "camera_movement": "...",
      "voice_over": "Naskah voice over (MAKSIMAL 15-20 KATA)",
      "veo_prompt": "(VERTICAL 9:16) Detailed prompt for Google Veo using the 7 layers from KB-06, including [STRICT: FACELESS COOKING (elbow down, forearm and hand close-up only, strictly no face/head/neck/chest/shoulders)] guardrail, no text, vertical 9:16"
    },
    "module_d": {
      "module_name": "AFFILIATE INSERT (8 Seconds - Optional)",
      "goal": "...",
      "visual_scenario": "...",
      "camera_angle": "...",
      "camera_movement": "...",
      "voice_over": "Naskah voice over (MAKSIMAL 15-20 KATA)",
      "veo_prompt": "(VERTICAL 9:16) Detailed prompt for Google Veo using the 7 layers from KB-06, no text, vertical 9:16"
    },
    "module_e": {
      "module_name": "BEAUTY SHOT & CTA (8 Seconds)",
      "goal": "...",
      "visual_scenario": "...",
      "camera_angle": "...",
      "camera_movement": "...",
      "voice_over": "Naskah voice over (MAKSIMAL 15-20 KATA)",
      "veo_prompt": "(VERTICAL 9:16) Detailed prompt for Google Veo using the 7 layers from KB-06, no text, vertical 9:16"
    }
  },
  "facebook_copy": {
    "title": "Judul Video",
    "caption": "Hook, Resep singkat, Tips, CTA, Hashtags",
    "first_comment": "Pertanyaan interaksi"
  },
  "affiliate_plan": {
    "recommended_product": "Nama produk",
    "category": "Kategori",
    "reason": "Alasan",
    "integration_strategy": "Cara integrasi",
    "soft_cta": "Soft CTA",
    "estimated_ctr": 85
  },
  "thumbnail": [
    "Alternatif 1",
    "Alternatif 2",
    "Alternatif 3",
    "Alternatif 4",
    "Alternatif 5"
  ],
  "seo": {
    "primary_keyword": "Kata kunci utama",
    "secondary_keywords": ["keyword1", "keyword2"],
    "hashtags": ["#tag1", "#tag2"]
  },
  "video_dna": {
    "Video_ID": "SS-YYYYMMDD-001",
    "Content_Pillar": "...",
    "Hero_Ingredient": "...",
    "Total_Duration_Sec": 36,
    "Visual_Style": "...",
    "Hook_Type": "...",
    "Signature_Moment": "...",
    "Motion_Density": "...",
    "Affiliate_Insert_Used": "Yes/No",
    "Affiliate_Product": "...",
    "Affiliate_Strategy": "...",
    "Affiliate_Visibility": "...",
    "Predicted_Emotion": "...",
    "Target_Action": "...",
    "Production_Complexity": "..."
  },
  "performance_hypothesis": {
    "visual_style_reasoning": "...",
    "hook_reasoning": "...",
    "retention_reasoning": "...",
    "risk_factors": "...",
    "shareability_tips": "...",
    "ab_testing_ideas": ["Ide A/B Testing 1", "Ide A/B Testing 2"]
  }
}

STRICT TEMPORAL & MODEL RULES:
- Module A (Hook) MUST be exactly 4 seconds. The voice_over script for Module A MUST be short (around 8-10 words, approx. 4 seconds speaking rate). The veo_prompt MUST specify omni_flash as target model.
- Modules B, C, D, E MUST be exactly 8 seconds. The voice_over script for these modules MUST be around 15-20 words. The veo_prompt MUST specify veo_31_lite as target model.

IMPORTANT: Double quotes inside JSON string values MUST be escaped (use single quotes ' instead inside dialogue/scripts). Response must contain ONLY the valid JSON block inside markdown code tags. Do not add any text before or after the JSON code block.
`;

  return stitchedPrompt;
}
