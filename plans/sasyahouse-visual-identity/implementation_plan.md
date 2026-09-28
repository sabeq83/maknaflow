# Implementation Plan: Fix Visual Identity Edit Error & Reference Asset (Metode A) Integration

## Problem Summary
When the user clicks the "Edit" button on a Visual Identity preset (specifically `sasyahouse_modern_muslimah_lifestyle`) in `/settings/visual-identities`:
1. **Critical Runtime Exception**: `PRIMARY_STYLE_KEYS` and `SUPPORTING_ONLY_STYLE_KEYS` were missing from the exports in [`lib/visual-language-catalog.js`](file:///Users/sabeqmmursyid/_contentflow-staging/lib/visual-language-catalog.js), causing `PRIMARY_STYLE_KEYS.map(...)` in [`app/settings/visual-identities/page.js`](file:///Users/sabeqmmursyid/_contentflow-staging/app/settings/visual-identities/page.js) to throw `TypeError: Cannot read properties of undefined (reading 'map')`.
2. **Missing Safe Fallbacks**: In `handleOpenEdit`, sub-objects (`subject`, `wardrobe`, `environment`, `lighting`, `camera`, `guardrails`) were not fully merged with `DEFAULT_CONFIG` defaults, which could cause undefined property errors on legacy or partially populated presets.
3. **Reference Asset Role Expansion**: SasyaHouse requires attaching real photos for rooms, facade, pantry, culinary items, and wardrobe. The `ROLE_COMPATIBILITY` in [`lib/reference-asset-contract.js`](file:///Users/sabeqmmursyid/_contentflow-staging/lib/reference-asset-contract.js) and `allowedRoles` in [`app/settings/visual-identities/page.js`](file:///Users/sabeqmmursyid/_contentflow-staging/app/settings/visual-identities/page.js) need to include `'location'` and `'environment'` roles so users can upload real property photos directly to the visual identity.

---

## Proposed Changes

### 1. Central Catalog (`lib/visual-language-catalog.js`)
Export `PRIMARY_STYLE_KEYS` and `SUPPORTING_ONLY_STYLE_KEYS` so client pages and modals can map over them safely.

#### Code Sebelum (Current/Before):
```javascript
export const VISUAL_STYLE_KEYS = [
  'cinematic_realistic',
  'commercial_product_cinematic',
  'culinary_cinematic',
  'stylized_3d_character',
  'cozy_claymation',
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
```

#### Code Sesudah (Proposed/After):
```javascript
export const VISUAL_STYLE_KEYS = [
  'cinematic_realistic',
  'commercial_product_cinematic',
  'culinary_cinematic',
  'stylized_3d_character',
  'cozy_claymation',
  'editorial_graphic_novel',
  'isometric_society',
  'symbolic_surrealism',
  'paper_cutout_documentary',
  'shadow_silhouette',
  'clay_political_theater'
];

export const PRIMARY_STYLE_KEYS = [
  'cinematic_realistic',
  'commercial_product_cinematic',
  'culinary_cinematic',
  'stylized_3d_character',
  'cozy_claymation',
  'editorial_graphic_novel'
];

export const SUPPORTING_ONLY_STYLE_KEYS = [
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
```

---

### 2. Reference Asset Contract & Prompt Builder (`lib/reference-asset-contract.js` & `lib/reference-asset-prompt-builder.js`)
Allow `location` role on `visual_identity` owner type and build suitable prompts for property/interior assets.

#### Code Sebelum (Current/Before) in `lib/reference-asset-contract.js`:
```javascript
export const ROLE_COMPATIBILITY = {
  universe: ['visual_style', 'palette_sheet'],
  character: ['identity', 'wardrobe', 'character_sheet'],
  location: ['location'],
  visual_identity: ['wardrobe', 'visual_style', 'palette_sheet', 'character_sheet']
};
```

#### Code Sesudah (Proposed/After) in `lib/reference-asset-contract.js`:
```javascript
export const ROLE_COMPATIBILITY = {
  universe: ['visual_style', 'palette_sheet'],
  character: ['identity', 'wardrobe', 'character_sheet'],
  location: ['location'],
  visual_identity: ['visual_style', 'location', 'wardrobe', 'palette_sheet', 'character_sheet']
};
```

---

### 3. Visual Identity Studio Page (`app/settings/visual-identities/page.js`)
Harden `handleOpenEdit` with comprehensive deep-fallback merging and update `allowedRoles` for `ReferenceAssetManager`.

#### Code Sebelum (Current/Before):
```javascript
  const handleOpenEdit = (preset) => {
    setLabel(preset.label);
    setDescription(preset.description || '');
    setPresetKey(preset.preset_key);
    setConfig({
      ...DEFAULT_CONFIG,
      ...preset.config,
      visual_language: {
        ...DEFAULT_CONFIG.visual_language,
        ...(preset.config?.visual_language || {})
      },
      mode_routing: {
        ...DEFAULT_CONFIG.mode_routing,
        ...(preset.config?.mode_routing || {})
      },
      rendering: {
        ...DEFAULT_CONFIG.rendering,
        ...(preset.config?.rendering || {})
      },
      composition: {
        ...DEFAULT_CONFIG.composition,
        ...(preset.config?.composition || {})
      },
      metaphor_engine: {
        ...DEFAULT_CONFIG.metaphor_engine,
        ...(preset.config?.metaphor_engine || {})
      }
    });
    setEditingPreset(preset);
  };
```

#### Code Sesudah (Proposed/After):
```javascript
  const handleOpenEdit = (preset) => {
    setLabel(preset.label || '');
    setDescription(preset.description || '');
    setPresetKey(preset.preset_key || '');
    setConfig({
      ...DEFAULT_CONFIG,
      ...(preset.config || {}),
      subject: {
        ...DEFAULT_CONFIG.subject,
        ...(preset.config?.subject || {})
      },
      visual_language: {
        ...DEFAULT_CONFIG.visual_language,
        ...(preset.config?.visual_language || {})
      },
      mode_routing: {
        ...DEFAULT_CONFIG.mode_routing,
        ...(preset.config?.mode_routing || {})
      },
      rendering: {
        ...DEFAULT_CONFIG.rendering,
        ...(preset.config?.rendering || {})
      },
      composition: {
        ...DEFAULT_CONFIG.composition,
        ...(preset.config?.composition || {})
      },
      metaphor_engine: {
        ...DEFAULT_CONFIG.metaphor_engine,
        ...(preset.config?.metaphor_engine || {})
      },
      wardrobe: {
        ...DEFAULT_CONFIG.wardrobe,
        ...(preset.config?.wardrobe || {})
      },
      environment: {
        ...DEFAULT_CONFIG.environment,
        ...(preset.config?.environment || {})
      },
      lighting: {
        ...DEFAULT_CONFIG.lighting,
        ...(preset.config?.lighting || {})
      },
      camera: {
        ...DEFAULT_CONFIG.camera,
        ...(preset.config?.camera || {})
      },
      guardrails: {
        ...DEFAULT_CONFIG.guardrails,
        ...(preset.config?.guardrails || {})
      }
    });
    setEditingPreset(preset);
  };
```

---

## Execution Task List
- [x] Update `lib/visual-language-catalog.js` with `PRIMARY_STYLE_KEYS` and `SUPPORTING_ONLY_STYLE_KEYS` exports
- [x] Update `lib/reference-asset-contract.js` and `lib/reference-asset-prompt-builder.js` to support `'location'` role for `visual_identity`
- [x] Update `app/settings/visual-identities/page.js` with robust state fallbacks and extended allowed reference roles
- [x] Create/update mockup HTML in `public/mockup_visual_identity_edit.html` demonstrating the fix and real photo reference manager
- [x] Run test suite (`scripts/test-visual-identity-foundation.mjs` and build check) to verify resolution
- [ ] Perform non-interactive release and atomic deployment to Dev & Staging
