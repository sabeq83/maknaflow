import { withTenantContext } from '@/lib/auth';
import { getPreset, getPresetKeys } from '@/lib/universe-presets';
import { withPgTransaction } from '@/lib/db-pg';
import { getUniverseProfileBySlug } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

export const POST = withTenantContext(async (req, { params }, user) => {
  const { key } = await params;
  
  // 1. Validate preset key from allowlist
  if (!getPresetKeys().includes(key)) {
    return new Response(JSON.stringify({ success: false, error: 'Preset key tidak valid.' }), {
      status: 404, headers: { 'content-type': 'application/json' }
    });
  }
  
  const preset = getPreset(key);
  const body = await req.json();
  
  // 2. Validate required fields
  if (!body.name || !body.slug) {
    return new Response(JSON.stringify({ success: false, error: 'name dan slug wajib diisi.' }), {
      status: 400, headers: { 'content-type': 'application/json' }
    });
  }
  
  // 3. Normalize slug
  const slug = body.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  
  // 4. Check slug uniqueness per tenant
  const existing = await getUniverseProfileBySlug(slug);
  if (existing) {
    return new Response(JSON.stringify({ success: false, error: `Slug '${slug}' sudah digunakan.` }), {
      status: 409, headers: { 'content-type': 'application/json' }
    });
  }
  
  const newUniverseId = uuidv4();
  
  try {
    // 5. Atomic transaction — rollback if any insert fails
    await withPgTransaction(async (client) => {
      // Clone profile from preset
      const profileData = {
        ...preset.profile,
        name: body.name,
        slug,
        rules_json: JSON.stringify({
          ...preset.profile.rules_json,
          preset_origin: { key, version: preset.version }
        }),
        default_pillars_json: JSON.stringify(preset.profile.default_pillars_json || []),
        negative_prompts_json: JSON.stringify(preset.profile.negative_prompts_json || []),
        status: 'active',
        version: 1,
      };
      
      const profileFields = ['id', 'name', 'slug', 'premise', 'tone', 'knowledge_domain', 'human_presence',
        'default_visual_style', 'default_aspect_ratio', 'default_scene_count', 'default_scene_duration',
        'default_story_template', 'cta_personality', 'default_pillars_json', 'rules_json',
        'negative_prompts_json', 'style_reference_path', 'status', 'version',
        'universe_type', 'depiction_policy', 'historical_period'];
      
      const profileValues = [
        newUniverseId, profileData.name, profileData.slug, profileData.premise || null,
        profileData.tone || null, profileData.knowledge_domain, profileData.human_presence || 'none',
        profileData.default_visual_style || 'cinematic_3d_clay', profileData.default_aspect_ratio || '9:16',
        profileData.default_scene_count || 7, profileData.default_scene_duration || 8,
        profileData.default_story_template || 'problem_solution_7beat', profileData.cta_personality || null,
        profileData.default_pillars_json, profileData.rules_json, profileData.negative_prompts_json,
        null, // style_reference_path — shared assets NOT copied
        'active', 1,
        profileData.universe_type || 'animal', profileData.depiction_policy || null, profileData.historical_period || null
      ];
      
      const profilePlaceholders = profileFields.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(
        `INSERT INTO universe_profiles (${profileFields.join(', ')}) VALUES (${profilePlaceholders})`,
        profileValues
      );
      
      // Clone characters
      for (const char of preset.characters) {
        const charId = uuidv4();
        const charFields = ['id', 'universe_id', 'name', 'character_key', 'species', 'breed',
          'body_shape', 'fur_color', 'eye_color', 'wardrobe', 'personality', 'movement_style',
          'relative_size', 'role', 'canonical_prompt', 'forbidden_changes_json',
          'reference_image_path', 'version', 'depiction_mode', 'reference_type', 'historical_period'];
        const charValues = [
          charId, newUniverseId, char.name, char.character_key,
          char.species || null, char.breed || null, char.body_shape || null,
          char.fur_color || null, char.eye_color || null, char.wardrobe || null,
          char.personality || null, char.movement_style || null,
          char.relative_size || 'medium', char.role || 'supporting',
          char.canonical_prompt, JSON.stringify(char.forbidden_changes_json || []),
          null, // reference_image_path NOT copied — user uploads their own
          char.version || 1,
          char.depiction_mode || 'normal', char.reference_type || 'identity', char.historical_period || null
        ];
        const charPlaceholders = charFields.map((_, i) => `$${i + 1}`).join(', ');
        await client.query(
          `INSERT INTO universe_characters (${charFields.join(', ')}) VALUES (${charPlaceholders})`,
          charValues
        );
      }
      
      // Clone locations
      for (const loc of preset.locations) {
        const locId = uuidv4();
        const locFields = ['id', 'universe_id', 'name', 'location_key', 'visual_description',
          'lighting_default', 'props', 'reference_image_path', 'version', 'historical_period', 'reference_type'];
        const locValues = [
          locId, newUniverseId, loc.name, loc.location_key,
          loc.visual_description || null, loc.lighting_default || null,
          loc.props || null, null, loc.version || 1,
          loc.historical_period || null, loc.reference_type || 'location'
        ];
        const locPlaceholders = locFields.map((_, i) => `$${i + 1}`).join(', ');
        await client.query(
          `INSERT INTO universe_locations (${locFields.join(', ')}) VALUES (${locPlaceholders})`,
          locValues
        );
      }
    });
    
    // 6. Invalidate manifest cache
    try {
      const { refreshManifestCache } = await import('@/lib/universe-manifests.js');
      if (refreshManifestCache) await refreshManifestCache(newUniverseId);
    } catch (_) {}
    
    return new Response(JSON.stringify({ success: true, id: newUniverseId }), {
      status: 201, headers: { 'content-type': 'application/json' }
    });
    
  } catch (err) {
    console.error('[universe-presets/instantiate] Error:', err);
    return new Response(JSON.stringify({ success: false, error: 'Gagal membuat universe dari preset. ' + err.message }), {
      status: 500, headers: { 'content-type': 'application/json' }
    });
  }
});
