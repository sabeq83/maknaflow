import { withPgTransaction } from './db-pg.js';
import { getActiveTenantId } from './tenant-context.js';
import { validateAndNormalizeUniverseDraft } from './universe-ai-contract.js';
import { v4 as uuidv4 } from 'uuid';

export class SlugConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SlugConflictError';
  }
}

export async function instantiateAiUniverse(draft, generationMeta = {}) {
  // Revalidate draft before entering database transaction, to fail fast if invalid
  const validated = validateAndNormalizeUniverseDraft(draft);

  const tenantId = getActiveTenantId();
  const newUniverseId = uuidv4();
  const profile = validated.profile;
  const slug = profile.slug;

  const result = await withPgTransaction(async (client) => {
    // 1. Check tenant-scoped slug uniqueness
    const checkSlugQuery = 'SELECT id FROM universe_profiles WHERE tenant_id = $1 AND slug = $2';
    const existing = await client.query(checkSlugQuery, [tenantId, slug]);
    if (existing.rows.length > 0) {
      throw new SlugConflictError(`Slug '${slug}' sudah digunakan di tenant ini.`);
    }

    // 2. Merge immutable ai_origin metadata into rules_json
    const finalRules = {
      ...(profile.rules_json || {}),
      ai_origin: {
        source: 'ai_universe_builder',
        prompt_version: generationMeta.prompt_version || 'universe_builder_v1',
        model: generationMeta.model || 'gemini-3.6-flash',
        generated_at: new Date().toISOString()
      }
    };

    // 3. Insert profile
    const profileFields = [
      'id', 'tenant_id', 'name', 'slug', 'premise', 'tone', 'knowledge_domain',
      'human_presence', 'default_visual_style', 'default_aspect_ratio', 'default_scene_count',
      'default_scene_duration', 'default_story_template', 'cta_personality',
      'default_pillars_json', 'rules_json', 'negative_prompts_json', 'status', 'version'
    ];

    const profileValues = [
      newUniverseId,
      tenantId,
      profile.name,
      slug,
      profile.premise || null,
      profile.tone || null,
      profile.knowledge_domain || 'general',
      profile.human_presence || 'none',
      profile.default_visual_style || 'cinematic_3d_clay',
      profile.default_aspect_ratio || '9:16',
      profile.default_scene_count || 7,
      profile.default_scene_duration || 8,
      profile.default_story_template || 'problem_solution_7beat',
      profile.cta_personality || null,
      JSON.stringify(profile.default_pillars_json || []),
      JSON.stringify(finalRules),
      JSON.stringify(profile.negative_prompts_json || []),
      'active',
      1
    ];

    const profilePlaceholders = profileFields.map((_, i) => `$${i + 1}`).join(', ');
    const insertProfileSql = `INSERT INTO universe_profiles (${profileFields.join(', ')}) VALUES (${profilePlaceholders})`;
    await client.query(insertProfileSql, profileValues);

    // 4. Insert characters
    for (const char of validated.characters) {
      const charId = uuidv4();
      const charFields = [
        'id', 'tenant_id', 'universe_id', 'name', 'character_key', 'species', 'breed',
        'body_shape', 'fur_color', 'eye_color', 'wardrobe', 'personality', 'movement_style',
        'relative_size', 'role', 'canonical_prompt', 'forbidden_changes_json',
        'version', 'depiction_mode', 'reference_type', 'historical_period'
      ];

      const charValues = [
        charId,
        tenantId,
        newUniverseId,
        char.name,
        char.character_key,
        char.species || null,
        char.breed || null,
        char.body_shape || null,
        char.fur_color || null,
        char.eye_color || null,
        char.wardrobe || null,
        char.personality || null,
        char.movement_style || null,
        char.relative_size || 'medium',
        char.role || 'supporting',
        char.canonical_prompt,
        JSON.stringify(char.forbidden_changes_json || []),
        1,
        char.depiction_mode || 'normal',
        char.reference_type || 'identity',
        char.historical_period || null
      ];

      const charPlaceholders = charFields.map((_, i) => `$${i + 1}`).join(', ');
      const insertCharSql = `INSERT INTO universe_characters (${charFields.join(', ')}) VALUES (${charPlaceholders})`;
      await client.query(insertCharSql, charValues);
    }

    // 5. Insert locations
    for (const loc of validated.locations) {
      const locId = uuidv4();
      const locFields = [
        'id', 'tenant_id', 'universe_id', 'name', 'location_key', 'visual_description',
        'lighting_default', 'props', 'version', 'historical_period', 'reference_type'
      ];

      const locValues = [
        locId,
        tenantId,
        newUniverseId,
        loc.name,
        loc.location_key,
        loc.visual_description,
        loc.lighting_default || null,
        loc.props || null,
        1,
        loc.historical_period || null,
        loc.reference_type || 'location'
      ];

      const locPlaceholders = locFields.map((_, i) => `$${i + 1}`).join(', ');
      const insertLocSql = `INSERT INTO universe_locations (${locFields.join(', ')}) VALUES (${locPlaceholders})`;
      await client.query(insertLocSql, locValues);
    }

    return {
      success: true,
      id: newUniverseId,
      slug: slug,
      name: profile.name
    };
  });

  // 6. Refresh manifest cache after transaction commits successfully
  try {
    const { refreshManifestCache } = await import('./universe-manifests.js');
    if (refreshManifestCache) {
      await refreshManifestCache(newUniverseId);
    }
  } catch (err) {
    console.error('[UniverseAiRepository] Best-effort manifest cache refresh failed:', err.message);
  }

  return result;
}
