import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getUniverseManifest } from '@/lib/universe-manifests';
import { withTenantContext } from '@/lib/auth';

export const GET = withTenantContext(async (req) => {
  try {
    const url = new URL(req.url);
    const profile = url.searchParams.get('profile') || 'pawville';

    const manifest = getUniverseManifest(profile);
    if (!manifest) {
      return NextResponse.json({ success: false, error: `Universe profile '${profile}' not found` }, { status: 404 });
    }

    // Add availability status based on file existence
    const updatedCharacters = {};
    for (const [key, character] of Object.entries(manifest.characters)) {
      const absolutePath = path.join(process.cwd(), 'public', character.identity_reference_path);
      const available = fs.existsSync(absolutePath);
      updatedCharacters[key] = {
        ...character,
        available
      };
    }

    return NextResponse.json({
      success: true,
      manifest: {
        ...manifest,
        characters: updatedCharacters
      }
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const POST = withTenantContext(async (req) => {
  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ success: false, error: 'Content type must be multipart/form-data' }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const universeProfile = formData.get('universe_profile');
    const characterId = formData.get('character_id');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ success: false, error: 'No image file uploaded' }, { status: 400 });
    }
    if (!universeProfile || !characterId) {
      return NextResponse.json({ success: false, error: 'universe_profile and character_id are required' }, { status: 400 });
    }

    // Strict validation of inputs to prevent path traversal
    const manifest = getUniverseManifest(universeProfile);
    if (!manifest) {
      return NextResponse.json({ success: false, error: 'Invalid universe profile' }, { status: 400 });
    }

    const character = manifest.characters[characterId];
    if (!character) {
      return NextResponse.json({ success: false, error: `Invalid character ID: ${characterId}` }, { status: 400 });
    }

    // Enforce image-only and 5MB limit
    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedMimeTypes.includes(file.type)) {
      return NextResponse.json({ success: false, error: 'Only PNG, JPEG, and WebP images are allowed' }, { status: 400 });
    }
    const maxSizeBytes = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSizeBytes) {
      return NextResponse.json({ success: false, error: 'Image size exceeds maximum limit of 5MB' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Identity reference path from manifest
    const relativePath = character.identity_reference_path;
    const absolutePath = path.join(process.cwd(), 'public', relativePath);

    // Ensure parent directories exist
    const parentDir = path.dirname(absolutePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    fs.writeFileSync(absolutePath, buffer);

    return NextResponse.json({
      success: true,
      message: `Identity reference image updated successfully for character ${character.display_name}`,
      path: `${relativePath}?t=${Date.now()}`
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
