import { validateAndNormalizeVisualIdentity } from './visual-identity-contract.js';

export const WAY_SIYASI_DEFAULT_ROUTING = {
  hook: 'symbolic_surrealism',
  context: 'editorial_graphic_novel',
  mechanism: 'isometric_society',
  consequence: 'editorial_graphic_novel',
  evidence_reveal: 'paper_cutout_documentary',
  conclusion: 'symbolic_surrealism'
};

export const SYSTEM_VISUAL_IDENTITIES = [
  {
    key: 'way_siyasi_editorial_system',
    version: 1,
    label: 'Wa’y Siyasi — Editorial System',
    description: 'Faceless political education through editorial, isometric, and symbolic modes.',
    config: {
      schema_version: '2',
      label: 'Wa’y Siyasi — Editorial System',
      description: 'Faceless political education through editorial, isometric, and symbolic modes.',
      subject: {
        kind: 'human',
        faceless_mode: 'featureless_editorial',
        demographic_key: 'custom',
        custom_description: 'Contemporary Southeast Asian citizens, diverse ages, everyday modest civilian attire, strictly faceless silhouettes or turned-away angles.',
        character_count: 1,
        population_mode: 'single_group_or_crowd'
      },
      visual_language: {
        primary_style: 'editorial_graphic_novel',
        supporting_styles: [
          'isometric_society',
          'symbolic_surrealism',
          'paper_cutout_documentary'
        ],
        disabled_styles: ['shadow_silhouette', 'clay_political_theater']
      },
      mode_routing: WAY_SIYASI_DEFAULT_ROUTING,
      rendering: {
        geometry: 'simplified_semi_realistic',
        textures: ['printed_paper_grain', 'editorial_ink'],
        shadow_style: 'strong_geometric',
        finish: 'matte_editorial'
      },
      composition: {
        primary_idea_count: 1,
        primary_subject_count: 1,
        negative_space: 'required',
        safe_zone: 'vertical_social_ui'
      },
      metaphor_engine: {
        enabled: true,
        pattern: 'concept_to_object_to_action'
      },
      wardrobe: {
        mode: 'fixed',
        preset_key: 'sage_muted',
        custom_description: 'Everyday modest civilian attire in charcoal, off-white, warm gray and muted beige',
        sleeve_policy: 'wrists_covered'
      },
      environment: {
        preset_key: 'general_workspace',
        custom_description: 'Editorial clean background with subtle paper texture and minimalist structural elements',
        material_palette: ['charcoal', 'off-white', 'warm gray', 'muted beige'],
        background_density: 'minimal'
      },
      lighting: {
        preset_key: 'window_daylight',
        custom_description: 'Soft directional editorial lighting with strong geometric shadows',
        color_temperature: 'warm_neutral',
        contrast: 'medium'
      },
      camera: {
        framing: 'editorial_wide',
        perspective: 'third_person',
        lens_look: 'natural_50mm',
        depth_of_field: 'shallow',
        movement: 'subtle_handheld'
      },
      style: {
        preset_key: 'editorial_graphic_novel',
        custom_description: 'Charcoal, off-white, warm gray, muted beige, maximum one accent color per scene, subtle printed paper grain and editorial ink',
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
        required_negative_prompts: ['photorealistic stock footage', 'news TV broadcast composition']
      }
    }
  },
  {
    key: 'hands_only_muslimah_sage_kitchen',
    version: 1,
    label: 'Muslimah Sage Kitchen',
    description: 'Southeast Asian Muslimah in Sage Green attire, clean hands cooking in a Nordic-style kitchen.',
    config: {
      subject: {
        kind: 'human',
        faceless_mode: 'hands_only',
        demographic_key: 'syari_classic',
        character_count: 1
      },
      wardrobe: {
        mode: 'fixed',
        preset_key: 'sage_muted',
        sleeve_policy: 'wrists_covered'
      },
      environment: {
        preset_key: 'nordic_kitchen',
        material_palette: ['white marble', 'light oak'],
        props: ['wooden utensils', 'small herbs'],
        background_density: 'balanced'
      },
      lighting: {
        preset_key: 'window_daylight',
        color_temperature: 'warm_neutral',
        contrast: 'soft'
      },
      camera: {
        framing: 'forearms_and_hands',
        perspective: 'third_person',
        lens_look: 'natural_50mm',
        depth_of_field: 'shallow',
        movement: 'subtle_handheld'
      },
      style: {
        preset_key: 'cinematic_realistic',
        aspect_ratio: '9:16'
      }
    }
  },
  {
    key: 'hands_only_southeast_asian_male',
    version: 1,
    label: 'Southeast Asian Male Casual',
    description: 'Southeast Asian male featuring clean hands with warm light-tan/olive skin, stylish wristwatch, clean casual attire in a modern workspace.',
    config: {
      subject: {
        kind: 'human',
        faceless_mode: 'hands_only',
        demographic_key: 'southeast_asian_male',
        character_count: 1
      },
      wardrobe: {
        mode: 'fixed',
        preset_key: 'male_caramel',
        sleeve_policy: 'forearms_exposed'
      },
      environment: {
        preset_key: 'general_workspace',
        material_palette: ['dark oak', 'matte slate'],
        props: ['modern notebook', 'minimalist pen'],
        background_density: 'minimal'
      },
      lighting: {
        preset_key: 'window_daylight',
        color_temperature: 'warm_neutral',
        contrast: 'soft'
      },
      camera: {
        framing: 'forearms_and_hands',
        perspective: 'third_person',
        lens_look: 'natural_50mm',
        depth_of_field: 'shallow',
        movement: 'subtle_handheld'
      },
      style: {
        preset_key: 'cinematic_realistic',
        aspect_ratio: '9:16'
      }
    }
  },
  {
    key: 'hands_only_caucasian_male_caramel',
    version: 1,
    label: 'Caucasian Male Caramel',
    description: 'Caucasian man wearing a sophisticated caramel long-sleeve knit shirt, clean male hands in a kitchen workspace.',
    config: {
      subject: {
        kind: 'human',
        faceless_mode: 'hands_only',
        demographic_key: 'caucasian_male',
        character_count: 1
      },
      wardrobe: {
        mode: 'fixed',
        preset_key: 'male_caramel',
        sleeve_policy: 'wrists_covered'
      },
      environment: {
        preset_key: 'nordic_kitchen',
        material_palette: ['grey granite', 'dark walnut'],
        props: ['stainless steel utensils'],
        background_density: 'balanced'
      },
      lighting: {
        preset_key: 'window_daylight',
        color_temperature: 'neutral',
        contrast: 'soft'
      },
      camera: {
        framing: 'forearms_and_hands',
        perspective: 'third_person',
        lens_look: 'natural_50mm',
        depth_of_field: 'shallow',
        movement: 'subtle_handheld'
      },
      style: {
        preset_key: 'cinematic_realistic',
        aspect_ratio: '9:16'
      }
    }
  },
  {
    key: 'stylized_3d_muslimah_emerald',
    version: 1,
    label: '3D Muslimah Emerald',
    description: '3D stylized claymation Muslim woman in Emerald Green attire, blank face (no eyes, nose, or mouth).',
    config: {
      subject: {
        kind: 'blank_face_3d',
        faceless_mode: 'blank_face_3d',
        demographic_key: 'stylized_3d_muslimah',
        character_count: 1
      },
      wardrobe: {
        mode: 'fixed',
        preset_key: '3d_fem_emerald'
      },
      environment: {
        preset_key: 'nordic_kitchen',
        background_density: 'minimal'
      },
      lighting: {
        preset_key: 'studio_softbox',
        color_temperature: 'warm_neutral',
        contrast: 'soft'
      },
      camera: {
        framing: 'crop_below_neck',
        perspective: 'third_person',
        lens_look: 'natural_50mm',
        depth_of_field: 'shallow',
        movement: 'still'
      },
      style: {
        preset_key: 'cinematic_realistic',
        aspect_ratio: '9:16'
      }
    }
  },
  {
    key: 'mascot_herbal_ginger_guardian',
    version: 1,
    label: 'Ginger Guardian',
    description: 'Cute 3D stylized ginger root character with muscular tiny clay arms and legs.',
    config: {
      subject: {
        kind: 'animal',
        faceless_mode: 'not_applicable',
        demographic_key: 'mascot_ginger_guardian',
        character_count: 1
      },
      wardrobe: {
        mode: 'fixed',
        preset_key: 'not_applicable'
      },
      environment: {
        preset_key: 'nordic_kitchen',
        background_density: 'minimal'
      },
      lighting: {
        preset_key: 'studio_softbox',
        color_temperature: 'warm_neutral',
        contrast: 'soft'
      },
      camera: {
        framing: 'object_or_animal',
        perspective: 'third_person',
        lens_look: 'natural_50mm',
        depth_of_field: 'shallow',
        movement: 'still'
      },
      style: {
        preset_key: 'cinematic_realistic',
        aspect_ratio: '9:16'
      }
    }
  }
];

export function listSystemVisualIdentities() {
  return SYSTEM_VISUAL_IDENTITIES.map(preset => ({
    ...preset,
    config: validateAndNormalizeVisualIdentity(preset.config)
  }));
}

export function getSystemVisualIdentity(key) {
  const preset = SYSTEM_VISUAL_IDENTITIES.find(p => p.key === key);
  if (!preset) return null;
  return {
    ...preset,
    config: validateAndNormalizeVisualIdentity(preset.config)
  };
}
