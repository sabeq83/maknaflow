import { getDb } from '../lib/db.js';

export async function updateHabitfolkPreset() {
  const db = getDb();
  const habitfolkConfig = {
    schema_version: '2',
    label: 'HabitFolk — Satisfying Macro Craft',
    description: 'ASMR culinary macro cinematography focusing 100% on fresh ingredients, knife cuts, and artisanal cookware with soft f/1.4 background bokeh.',
    style: {
      preset_key: 'culinary_cinematic',
      aspect_ratio: '9:16',
      custom_description: 'Satisfying culinary macro cinematography, extreme close-up knife-edge angle, razor-sharp focal point on food preparation with high sensory visual reward.'
    },
    camera: {
      angle_preset: 'top_down_macro',
      framing_preset: 'extreme_macro',
      custom_description: 'Tight overhead culinary framing, shot on Phase One XF IQ4 100mm Macro lens, soft creamy depth of field.'
    },
    subject: {
      kind: 'human',
      demographic_key: 'custom',
      faceless_mode: 'soft_bokeh_motion',
      custom_description: 'ASMR culinary macro framing focusing 100% on fresh food textures, knife cuts, and artisanal cookware. In the soft, creamy background bokeh (f/1.4), the subtle out-of-focus motion of a chef in charcoal linen is barely perceptible, strictly avoiding prominent arms or sharp hands.'
    },
    wardrobe: {
      mode: 'custom',
      preset_key: 'custom',
      custom_description: 'Charcoal grey washed linen rolled sleeves, intentionally soft-blurred in creamy background bokeh, never prominent.'
    },
    environment: {
      preset_key: 'custom',
      custom_description: 'Pristine polished white Carrara marble island countertop with delicate grey veining, minimal artisanal culinary setup.',
      material_palette: ['white Carrara marble', 'natural wood cutting board', 'clear glass ramekins']
    },
    lighting: {
      preset_key: 'window_daylight',
      custom_description: 'Soft directional morning window daylight catching moisture droplets, clean sensory reflections on polished white marble.'
    },
    guardrails: {
      face_visibility: 'prohibited',
      required_negative_prompts: [
        'sharp human body',
        'prominent arms',
        'sharp hands',
        'person standing',
        'facial features',
        'clutter',
        'messy surfaces',
        'warm yellow artificial cast'
      ]
    }
  };

  const configJson = JSON.stringify(habitfolkConfig);

  const res = await db.prepare(`
    UPDATE visual_identity_presets 
    SET config_json = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = 'vi_habitfolk_macro_craft' OR preset_key = 'habitfolk_satisfying_macro_craft'
  `).run(configJson);

  console.log('✅ Updated vi_habitfolk_macro_craft preset in DB:', res);
}

if (process.argv[1]?.endsWith('update-habitfolk-visual-identity.js')) {
  updateHabitfolkPreset()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Error updating HabitFolk preset:', err);
      process.exit(1);
    });
}
