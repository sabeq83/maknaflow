# Implementation Plan: SasyaHouse Visual Identity Modernization & Multi-Pillar Realignment

## Problem Summary
Audit on Staging Campaign `opc_260929_hn6jsb` revealed that start frame generation for all rows (including studying/exams, P3K first aid, room organizing, budgeting, and emergency power-outage survival) defaulted to kitchen/culinary scenes because:
1. **Locked Culinary Preset**: `visual_identity_presets` for `sasyahouse_modern_muslimah_lifestyle` had `style.preset_key: "culinary_cinematic"` and `visual_language.primary_style: "culinary_cinematic"`.
2. **Strict Mode Routing**: `mode_routing.hook`, `mechanism`, and `conclusion` were all hardcoded to `"culinary_cinematic"`, injecting `[STYLE: culinary_cinematic]` to Clip 1, 4/5, and 8 across all content pillars.
3. **Hardcoded Food Highlights in Lighting**: `lighting.custom_description` contained `"appetizing highlights on food and surfaces"`, prompting T2I models to generate kitchen counters and food props even for non-culinary scenes (such as folding clothes in Row 9 or blackout survival in Row 8).
4. **Food Textures & Guardrails**: `rendering.textures` globally included `"authentic_steam_and_moisture"` and `guardrails` included `"unappetizing food"`.

---

## Proposed Changes

### 1. Preset Configuration Refinement (`scripts/create-sasyahouse-preset.mjs`)
Realign SasyaHouse visual identity to genuine Muslimah student lifestyle & education-first boarding house living:
- Primary Style: `cinematic_realistic` (Clean modern Gen Z lifestyle)
- Supporting Styles: `commercial_product_cinematic`, `culinary_cinematic`
- Mode Routing:
  - `hook`: `cinematic_realistic`
  - `context`: `cinematic_realistic`
  - `mechanism`: `cinematic_realistic`
  - `consequence`: `commercial_product_cinematic`
  - `evidence_reveal`: `commercial_product_cinematic`
  - `conclusion`: `cinematic_realistic`
- Lighting: Neutral warm morning daylight without food-specific prompts
- Textures: Oak wood, clean matte white, soft cotton fabric, smooth paper, natural skin
- Negative Prompts: Focused on modest wear invariants, clean minimalist rooms, and anti-clutter.

#### Code Sebelum (Current/Before) in `scripts/create-sasyahouse-preset.mjs`:
```javascript
  visual_language: {
    primary_style: 'culinary_cinematic',
    supporting_styles: ['commercial_product_cinematic', 'cinematic_realistic'],
    disabled_styles: ['editorial_graphic_novel', 'shadow_silhouette', 'clay_political_theater']
  },
  
  mode_routing: {
    hook: 'culinary_cinematic',
    context: 'commercial_product_cinematic',
    mechanism: 'culinary_cinematic',
    consequence: 'commercial_product_cinematic',
    evidence_reveal: 'commercial_product_cinematic',
    conclusion: 'culinary_cinematic'
  },
  
  rendering: {
    geometry: 'photorealistic_clean',
    textures: [
      'natural_skin_textures',
      'authentic_steam_and_moisture',
      'clean_matte_white_surface',
      'light_natural_oak_wood'
    ],
    shadow_style: 'soft_natural',
    finish: 'photorealistic_cinematic'
  },

  lighting: {
    preset_key: 'window_daylight',
    custom_description: 'illuminated by soft natural warm golden daylight coming from side window, gentle ambient glow, appetizing highlights on food and surfaces, realistic soft-shadow roll-off',
    color_temperature: 'warm_neutral',
    contrast: 'soft'
  },

  style: {
    preset_key: 'culinary_cinematic',
    custom_description: 'premium modern Gen Z student lifestyle and culinary cinematography, warm inviting ambience, clean 8k photorealism',
    aspect_ratio: '9:16'
  },

  guardrails: {
    face_visibility: 'prohibited',
    reflection_face: 'prohibited',
    unintended_people: 'prohibited',
    extra_people: 'prohibited',
    intentional_crowd: 'allowed_faceless',
    identity_drift: 'prohibited',
    wardrobe_drift: 'prohibited',
    required_negative_prompts: [
      'rustic wooden table',
      'worn-out rough wooden desk',
      'cluttered messy desk',
      'dark gloomy lighting',
      'political editorial illustration',
      'flat 2D vector clipart',
      'visible human face',
      'exposed arms',
      'bare skin above wrists',
      'unappetizing food'
    ]
  }
```

#### Code Sesudah (Proposed/After) in `scripts/create-sasyahouse-preset.mjs`:
```javascript
  visual_language: {
    primary_style: 'cinematic_realistic',
    supporting_styles: ['commercial_product_cinematic', 'culinary_cinematic'],
    disabled_styles: ['editorial_graphic_novel', 'shadow_silhouette', 'clay_political_theater']
  },
  
  mode_routing: {
    hook: 'cinematic_realistic',
    context: 'cinematic_realistic',
    mechanism: 'cinematic_realistic',
    consequence: 'commercial_product_cinematic',
    evidence_reveal: 'commercial_product_cinematic',
    conclusion: 'cinematic_realistic'
  },
  
  rendering: {
    geometry: 'photorealistic_clean',
    textures: [
      'natural_skin_textures',
      'clean_matte_white_surface',
      'light_natural_oak_wood',
      'soft_neutral_cotton_fabric',
      'smooth_paper_texture'
    ],
    shadow_style: 'soft_natural',
    finish: 'photorealistic_cinematic'
  },

  lighting: {
    preset_key: 'window_daylight',
    custom_description: 'illuminated by soft natural warm golden daylight coming from side window, gentle ambient glow, clean airy highlights across surfaces and textures, realistic soft-shadow roll-off',
    color_temperature: 'warm_neutral',
    contrast: 'soft'
  },

  style: {
    preset_key: 'cinematic_realistic',
    custom_description: 'premium modern Gen Z Muslimah student lifestyle cinematography, aesthetic Japanese-Scandinavian cozy dorm living in Sigura-gura Malang, clean, bright, airy 8k photorealism',
    aspect_ratio: '9:16'
  },

  guardrails: {
    face_visibility: 'prohibited',
    reflection_face: 'prohibited',
    unintended_people: 'prohibited',
    extra_people: 'prohibited',
    intentional_crowd: 'allowed_faceless',
    identity_drift: 'prohibited',
    wardrobe_drift: 'prohibited',
    required_negative_prompts: [
      'rustic wooden table',
      'worn-out rough wooden desk',
      'cluttered messy desk',
      'dark gloomy lighting',
      'political editorial illustration',
      'flat 2D vector clipart',
      'visible human face',
      'exposed arms',
      'bare skin above wrists',
      'short sleeves'
    ]
  }
```

---

## Execution Task List
- [x] Audit all 10 campaign rows on `opc_260929_hn6jsb` in staging DB to isolate all instances of culinary-forced prompts
- [x] Formulate refined Visual Identity specification for SasyaHouse (Muslimah student lifestyle & room living)
- [x] Update `scripts/create-sasyahouse-preset.mjs` with refined `SASYAHOUSE_CONFIG`
- [x] Execute database migration script to apply updated preset to Staging & Dev schemas
- [x] Verify database records for `vi_sasya_mul6jkxw` and resolved snapshot generation
- [x] Validate test suite and cluster health
