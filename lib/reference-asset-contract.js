export const REFERENCE_ASSET_PROMPT_VERSION = 'visual_reference_asset_v1';

export const OWNER_TYPES = ['universe', 'character', 'location', 'visual_identity'];

export const ASSET_ROLES = [
  'identity',
  'wardrobe',
  'location',
  'visual_style',
  'palette_sheet',
  'character_sheet'
];

export const ASSET_STATUSES = [
  'generating',
  'draft',
  'approved',
  'rejected',
  'archived',
  'failed'
];

export const ROLE_COMPATIBILITY = {
  universe: ['visual_style', 'palette_sheet'],
  character: ['identity', 'wardrobe', 'character_sheet'],
  location: ['location'],
  visual_identity: ['wardrobe', 'visual_style', 'palette_sheet', 'character_sheet']
};

export function validateOwnerRole(ownerType, role) {
  if (!OWNER_TYPES.includes(ownerType)) {
    throw new Error(`Invalid owner_type: ${ownerType}`);
  }
  if (!ASSET_ROLES.includes(role)) {
    throw new Error(`Invalid asset_role: ${role}`);
  }
  const allowed = ROLE_COMPATIBILITY[ownerType] || [];
  if (!allowed.includes(role)) {
    throw new Error(`Role "${role}" is not compatible with owner type "${ownerType}"`);
  }
}

export function validateReferenceAssetIntent(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('Intent must be a valid object');
  }
  const { owner_type, owner_id, role, source_type } = input;
  if (!owner_id || typeof owner_id !== 'string' || !owner_id.trim()) {
    throw new Error('owner_id is required');
  }
  validateOwnerRole(owner_type, role);
  if (source_type && !['upload', 'ai_generated', 'legacy_import'].includes(source_type)) {
    throw new Error(`Invalid source_type: ${source_type}`);
  }
}

export function buildReferenceAssetSnapshot(asset) {
  if (!asset) return null;
  return {
    asset_id: asset.id,
    owner_type: asset.owner_type,
    owner_id: asset.owner_id,
    role: asset.asset_role,
    version: asset.version,
    public_path: asset.public_path,
    sha256: asset.sha256,
    width: asset.width,
    height: asset.height,
    mime_type: asset.mime_type
  };
}

export function validateApprovalAttestation(asset, attestationChecked) {
  // If human depiction or visual identity preset has face visibility policy, attestation is required
  const isHuman = asset.owner_type === 'visual_identity' || 
    (asset.owner_type === 'character' && asset.metadata_json?.depiction_mode === 'normal');
  
  if (isHuman && !attestationChecked) {
    throw new Error('Faceless compliance attestation is required for this asset.');
  }
}
