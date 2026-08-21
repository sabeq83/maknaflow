import { validateAndNormalizeVisualIdentity } from './visual-identity-contract.js';

export const SYSTEM_VISUAL_IDENTITIES = [
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
