/**
 * Universe Manifests - central definitions and normalization helpers for cartoon character reference lock
 */

export const CHARACTER_NAME_MAP = {
  'mochi': 'mochi',
  'dr. paw': 'dr_paw',
  'dr paw': 'dr_paw',
  'coco': 'coco',
  'boba': 'boba',
  'tofu': 'tofu'
};

export const UNIVERSE_MANIFESTS = {
  pawville: {
    universe_profile: "pawville",
    version: 1,
    style_reference_path: "/universe-assets/pawville/style/visual-style-reference.png",
    characters: {
      mochi: {
        character_id: "pawville_mochi_v1",
        display_name: "Mochi",
        version: 1,
        identity_reference_path: "/universe-assets/pawville/characters/mochi/v1/identity-anchor.png",
        canonical_description: "Grey British Shorthair cat, round compact body, short legs, thick soft grey fur, large amber eyes, small pink nose, forest-green scarf",
        forbidden_changes: [
          "no fur color change",
          "no fur pattern",
          "no eye color change",
          "no missing green scarf",
          "no body proportion change"
        ]
      },
      dr_paw: {
        character_id: "pawville_dr_paw_v1",
        display_name: "Dr. Paw",
        version: 1,
        identity_reference_path: "/universe-assets/pawville/characters/dr-paw/v1/identity-anchor.png",
        canonical_description: "Tan Shiba Inu, compact body, wearing a small white coat and carrying a small brown medical bag",
        forbidden_changes: [
          "no species change",
          "no fur color change",
          "no missing white coat",
          "no medical bag redesign",
          "no body proportion change"
        ]
      },
      coco: {
        character_id: "pawville_coco_v1",
        display_name: "Coco",
        version: 1,
        identity_reference_path: "/universe-assets/pawville/characters/coco/v1/identity-anchor.png",
        canonical_description: "Brown-and-white Corgi dog, small compact body, tiny brown sling bag, happy smile",
        forbidden_changes: [
          "no species change",
          "no fur color change",
          "no missing sling bag",
          "no body proportion change"
        ]
      }
    }
  }
};

/**
 * Normalizes character names to standard keys (mochi, dr_paw, coco, boba, tofu)
 * @param {string} rawName - Raw character name from storyboard or AI output
 * @returns {string|null} - Normalized character key or null if not in map
 */
export function normalizeCharacterId(rawName) {
  if (!rawName) return null;
  const clean = rawName.trim().toLowerCase();
  return CHARACTER_NAME_MAP[clean] || null;
}

/**
 * Retrieves the manifest for a specific universe profile
 * @param {string} universeProfile - Profile key (e.g., 'pawville')
 * @returns {Object|null} - Manifest object or null
 */
export function getUniverseManifest(universeProfile) {
  if (!universeProfile) return null;
  const cleanProfile = universeProfile.trim().toLowerCase();
  return UNIVERSE_MANIFESTS[cleanProfile] || null;
}
