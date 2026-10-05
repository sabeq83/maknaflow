import fs from 'fs';
import path from 'path';
import { getUniverseManifest, ensureManifestsLoaded } from '../../../../../lib/universe-manifests.js';
import { withTenantContext } from '../../../../../lib/auth.js';

export const GET = withTenantContext(async (req) => {
  try {
    await ensureManifestsLoaded();
    const url = new URL(req.url);
    const profile = url.searchParams.get('profile') || 'pawville';

    const manifest = getUniverseManifest(profile);
    if (!manifest) {
      return Response.json({ success: false, error: `Universe profile '${profile}' not found` }, { status: 404 });
    }

    // Add availability status based on file existence or valid remote URL
    const updatedCharacters = {};
    for (const [key, character] of Object.entries(manifest.characters || {})) {
      const refPath = character.identity_reference_path || character.reference_image_path || '';
      let available = false;
      if (refPath && typeof refPath === 'string') {
        if (refPath.startsWith('http://') || refPath.startsWith('https://') || refPath.startsWith('data:image/')) {
          available = true;
        } else {
          const absolutePath = path.isAbsolute(refPath) ? refPath : path.join(process.cwd(), 'public', refPath.startsWith('/') ? refPath.slice(1) : refPath);
          available = fs.existsSync(absolutePath);
        }
      }
      updatedCharacters[key] = {
        ...character,
        identity_reference_path: refPath,
        available
      };
    }

    return Response.json({
      success: true,
      manifest: {
        ...manifest,
        characters: updatedCharacters
      }
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const POST = withTenantContext(async (req) => {
  try {
    await ensureManifestsLoaded();
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return Response.json({ success: false, error: 'Content type must be multipart/form-data' }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const universeProfile = formData.get('universe_profile');
    const characterId = formData.get('character_id');

    if (!file || typeof file === 'string') {
      return Response.json({ success: false, error: 'No image file uploaded' }, { status: 400 });
    }
    if (!universeProfile || !characterId) {
      return Response.json({ success: false, error: 'universe_profile and character_id are required' }, { status: 400 });
    }

    // Strict validation of inputs to prevent path traversal
    const manifest = getUniverseManifest(universeProfile);
    if (!manifest) {
      return Response.json({ success: false, error: 'Invalid universe profile' }, { status: 400 });
    }

    const character = manifest.characters[characterId];
    if (!character) {
      return Response.json({ success: false, error: `Invalid character ID: ${characterId}` }, { status: 400 });
    }

    // Enforce image-only and 5MB limit
    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedMimeTypes.includes(file.type)) {
      return Response.json({ success: false, error: 'Only PNG, JPEG, and WebP images are allowed' }, { status: 400 });
    }
    const maxSizeBytes = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSizeBytes) {
      return Response.json({ success: false, error: 'Image size exceeds maximum limit of 5MB' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Identity reference path from manifest
    const existingRef = character.identity_reference_path || '';
    const relativePath = (existingRef && !existingRef.startsWith('http') && !existingRef.startsWith('data:'))
      ? existingRef
      : `/uploads/universe-assets/${universeProfile}/${characterId}_anchor.png`;
    const absolutePath = path.join(process.cwd(), 'public', relativePath.startsWith('/') ? relativePath.slice(1) : relativePath);

    // Ensure parent directories exist
    const parentDir = path.dirname(absolutePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    fs.writeFileSync(absolutePath, buffer);

    return Response.json({
      success: true,
      message: `Identity reference image updated successfully for character ${character.display_name}`,
      path: `${relativePath}?t=${Date.now()}`
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});
