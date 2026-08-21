import { pgQuery } from './db-pg.js';
import { getActiveTenantId } from './tenant-context.js';
import { 
  reserveReferenceAssetVersion, 
  markReferenceAssetDraft, 
  markReferenceAssetFailed, 
  approveReferenceAsset,
  getReferenceAsset
} from './reference-asset-repository.js';
import { ingestUploadedReference, ingestProviderReference, verifyManagedReference } from './reference-asset-storage.js';
import { buildReferenceAssetPrompt } from './reference-asset-prompt-builder.js';
import { generateImage, getTaskStatus, getTaskResult, getFileUrl } from './webhook-client.js';

async function fetchOwner(ownerType, ownerId, tenantId) {
  if (ownerType === 'character') {
    const res = await pgQuery('SELECT * FROM universe_characters WHERE id = $1 AND tenant_id = $2', [ownerId, tenantId]);
    return res.rows[0] || null;
  }
  if (ownerType === 'location') {
    const res = await pgQuery('SELECT * FROM universe_locations WHERE id = $1 AND tenant_id = $2', [ownerId, tenantId]);
    return res.rows[0] || null;
  }
  if (ownerType === 'universe') {
    const res = await pgQuery('SELECT * FROM universe_profiles WHERE id = $1 AND tenant_id = $2', [ownerId, tenantId]);
    return res.rows[0] || null;
  }
  if (ownerType === 'visual_identity') {
    const res = await pgQuery('SELECT * FROM visual_identity_presets WHERE id = $1 AND tenant_id = $2', [ownerId, tenantId]);
    return res.rows[0] || null;
  }
  return null;
}

export async function uploadReferenceAsset(input, fileBuffer, actor) {
  const tenantId = getActiveTenantId();
  const { owner_type, owner_id, role, universe_id } = input;
  
  const owner = await fetchOwner(owner_type, owner_id, tenantId);
  if (!owner) throw new Error(`Owner of type "${owner_type}" with ID "${owner_id}" not found.`);

  // If owner is system preset, forbid attaching tenant asset directly
  if (owner_type === 'visual_identity' && owner.tenant_id === 'system') {
    throw new Error('System visual identities are read-only. Please clone to a user preset first.');
  }

  // Reserve version
  const reserved = await reserveReferenceAssetVersion({
    owner_type,
    owner_id,
    role,
    source_type: 'upload',
    universe_id: universe_id || owner.universe_id || null
  }, actor);

  try {
    const managedFile = await ingestUploadedReference(fileBuffer, reserved);
    return await markReferenceAssetDraft(reserved.id, managedFile);
  } catch (err) {
    await markReferenceAssetFailed(reserved.id, err);
    throw err;
  }
}

export async function dispatchReferenceAssetGeneration(input, actor) {
  const tenantId = getActiveTenantId();
  const { owner_type, owner_id, role, universe_id, custom_instruction } = input;

  const owner = await fetchOwner(owner_type, owner_id, tenantId);
  if (!owner) throw new Error(`Owner of type "${owner_type}" with ID "${owner_id}" not found.`);

  if (owner_type === 'visual_identity' && owner.tenant_id === 'system') {
    throw new Error('System visual identities are read-only. Please clone to a user preset first.');
  }

  let visualIdentity = null;
  if (owner_type === 'visual_identity') {
    visualIdentity = owner;
  } else if (universe_id || owner.universe_id) {
    // Optionally look up active visual identity preset if character/location is linked to visual identity
    // For now, prompt builder will handle it
  }

  // 1. Build prompt
  const builtPrompt = buildReferenceAssetPrompt({
    ownerType: owner_type,
    owner,
    role,
    visualIdentity,
    customInstruction: custom_instruction
  });

  // 2. Reserve version
  const reserved = await reserveReferenceAssetVersion({
    owner_type,
    owner_id,
    role,
    source_type: 'ai_generated',
    universe_id: universe_id || owner.universe_id || null,
    generation_prompt: builtPrompt.prompt,
    negative_prompt: builtPrompt.negative_prompt
  }, actor);

  try {
    // 3. Dispatch to G-Labs T2I Image Generator
    const dispatchResult = await generateImage({
      prompt: builtPrompt.prompt,
      aspect_ratio: '1:1', // Standard 1:1 reference sheet
      model: 'nano_banana_pro' // Use nano_banana_pro as default reference generator
    });

    if (!dispatchResult || !dispatchResult.task_id) {
      throw new Error(dispatchResult?.error || 'G-Labs task submission failed (no task ID returned)');
    }

    // 4. Update task details in DB
    await pgQuery(
      `UPDATE visual_reference_assets 
       SET provider_task_id = $1, provider = 'glabs'
       WHERE id = $2 AND tenant_id = $3`,
      [dispatchResult.task_id, reserved.id, tenantId]
    );

    return await getReferenceAsset(reserved.id);
  } catch (err) {
    await markReferenceAssetFailed(reserved.id, err);
    throw err;
  }
}

export async function refreshReferenceAssetGeneration(id, actor) {
  const tenantId = getActiveTenantId();
  const asset = await getReferenceAsset(id);
  if (!asset) throw new Error('Asset not found');
  if (asset.status !== 'generating') return asset;

  const taskId = asset.provider_task_id;
  if (!taskId) {
    const err = new Error('Missing provider task ID');
    return await markReferenceAssetFailed(id, err);
  }

  try {
    const statusResult = await getTaskStatus(taskId);
    const taskStatus = (statusResult?.status || '').toLowerCase();

    if (taskStatus === 'completed') {
      const resultData = await getTaskResult(taskId);
      const files = resultData?.files || statusResult?.files || [];
      const imageFile = files.find(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.webp')) || files[0];
      
      if (!imageFile) {
        throw new Error('Completed G-Labs task did not return any image files.');
      }

      const imageUrl = getFileUrl(imageFile, taskId);

      // Ingest remote image file to managed storage
      const managedFile = await ingestProviderReference(imageUrl, asset);
      managedFile.provider_task_id = taskId;
      managedFile.provider_result_url = imageUrl;
      managedFile.provider = 'glabs';

      return await markReferenceAssetDraft(id, managedFile);
    } else if (taskStatus === 'failed') {
      const failureMsg = statusResult?.error || statusResult?.error_detail || 'G-Labs image generation failed';
      throw new Error(failureMsg);
    }

    // Still processing
    return asset;
  } catch (err) {
    return await markReferenceAssetFailed(id, err);
  }
}

export async function approveReferenceAssetVersion(id, review = {}, actor) {
  return await approveReferenceAsset(id, review, actor);
}

export async function runReferenceAssetPreflight({ campaignId, itemId, clipIndex, mode = 'advisory' }) {
  const tenantId = getActiveTenantId();
  const preflightResult = {
    status: 'pass',
    checks: [],
    missing: [],
    warnings: [],
    resolved_assets: [],
    blocking: false
  };

  // Perform basic structural validation
  try {
    // 1. Fetch campaign
    const campaignRes = await pgQuery(
      `SELECT * FROM pillar_campaigns WHERE id = $1 AND tenant_id = $2`,
      [campaignId, tenantId]
    );
    const campaign = campaignRes.rows[0];
    if (!campaign) {
      preflightResult.status = 'fail';
      preflightResult.blocking = mode === 'required';
      preflightResult.missing.push(`Campaign ${campaignId} not found`);
      return preflightResult;
    }

    // Verify visual identity preset
    if (campaign.visual_identity_preset_id) {
      const activeAsset = (await pgQuery(
        `SELECT * FROM visual_reference_assets 
         WHERE tenant_id = $1 AND owner_type = 'visual_identity' AND owner_id = $2 AND status = 'approved' AND asset_role = 'visual_style'`,
        [tenantId, campaign.visual_identity_preset_id]
      )).rows[0];

      if (!activeAsset) {
        preflightResult.warnings.push(`Visual Identity Preset ${campaign.visual_identity_preset_id} does not have an approved style reference.`);
      } else {
        preflightResult.resolved_assets.push(activeAsset);
        // Verify file exists
        const exists = await verifyManagedReference(activeAsset);
        if (!exists) {
          preflightResult.warnings.push(`File missing or checksum mismatch for visual identity style asset: ${activeAsset.public_path}`);
          if (mode === 'required') {
            preflightResult.blocking = true;
            preflightResult.status = 'fail';
          }
        }
      }
    }
  } catch (err) {
    preflightResult.status = 'fail';
    preflightResult.blocking = mode === 'required';
    preflightResult.warnings.push(`Preflight error: ${err.message}`);
  }

  return preflightResult;
}

export async function importLegacyReference({ owner_type, owner_id, role }, actor) {
  const tenantId = getActiveTenantId();
  const owner = await fetchOwner(owner_type, owner_id, tenantId);
  if (!owner) throw new Error(`Legacy owner not found: ${owner_type} (${owner_id})`);

  let legacyPath = null;
  if (owner_type === 'character' && role === 'identity') {
    legacyPath = owner.reference_image_path;
  } else if (owner_type === 'location' && role === 'location') {
    legacyPath = owner.reference_image_path;
  } else if (owner_type === 'universe' && role === 'visual_style') {
    legacyPath = owner.style_reference_path;
  }

  if (!legacyPath) {
    throw new Error('No legacy reference path found on this record.');
  }

  // Check if already imported
  const existing = await pgQuery(
    `SELECT * FROM visual_reference_assets 
     WHERE tenant_id = $1 AND owner_type = $2 AND owner_id = $3 AND asset_role = $4 AND source_type = 'legacy_import' LIMIT 1`,
    [tenantId, owner_type, owner_id, role]
  );
  if (existing.rows[0]) return existing.rows[0];

  // Resolve file path to check size and metadata
  const fs = await import('fs');
  const path = await import('path');
  const absPath = path.isAbsolute(legacyPath) 
    ? legacyPath 
    : path.join(process.cwd(), 'public', legacyPath.startsWith('/') ? legacyPath.slice(1) : legacyPath);

  if (!fs.existsSync(absPath)) {
    throw new Error(`Legacy reference file not found at: ${absPath}`);
  }

  const fileBuffer = fs.readFileSync(absPath);
  
  // Reserve version
  const reserved = await reserveReferenceAssetVersion({
    owner_type,
    owner_id,
    role,
    source_type: 'legacy_import',
    universe_id: owner.universe_id || null
  }, actor);

  try {
    const managedFile = await ingestUploadedReference(fileBuffer, reserved);
    const draft = await markReferenceAssetDraft(reserved.id, managedFile);
    // Auto-approve legacy imports to keep compatibility
    return await approveReferenceAsset(draft.id, { notes: 'Auto-approved legacy import', attestation: true }, actor);
  } catch (err) {
    await markReferenceAssetFailed(reserved.id, err);
    throw err;
  }
}
