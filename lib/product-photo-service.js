import { getSetting } from './db.js';
import { readLocalImageToBuffer, saveCleanProductImage, detectImageMime } from './product-image-storage.js';

export function buildCleanProductPrompt(product) {
  return `Edit the supplied reference image into a professional e-commerce product photo.
Preserve the exact product identity, packaging shape, proportions, colors, logo,
label layout, printed text, cap, material, and all visible product details.
Show exactly one product, fully visible and centered, on a seamless pure white
background. Use soft neutral studio lighting and a subtle realistic contact shadow.
Remove people, hands, props, decorations, price tags, watermarks, and surrounding
objects. Do not redesign, relabel, duplicate, crop, distort, blur, or invent any
part of the product.${product.product_name ? ` Product: ${product.product_name}.` : ''}${product.packaging_status ? ` Packaging: ${product.packaging_status}.` : ''}${product.packaging_type ? ` Packaging Type: ${product.packaging_type}.` : ''}`;
}

export async function resolveRawReferenceImage(product) {
  if (product.raw_photo_url && product.raw_photo_url.startsWith('/uploads')) {
    const buffer = readLocalImageToBuffer(product.raw_photo_url);
    if (buffer) {
      const mimeType = detectImageMime(buffer) || 'image/jpeg';
      return `data:${mimeType};base64,${buffer.toString('base64')}`;
    }
  }
  return null;
}

export function validateGeneratedImage(buffer, mimeType) {
  if (!buffer || buffer.length < 1024) return { valid: false, error: 'Image is too small or empty' };
  const detected = detectImageMime(buffer);
  if (!detected) return { valid: false, error: 'Invalid magic bytes, not an image' };
  // Skip dimension check for now as we'd need an image library like sharp
  return { valid: true, error: null };
}

export async function resolveProductPhotoProvider(product, tenantId) {
  if (product.photo_provider) return product.photo_provider;
  try {
    const setting = await getSetting('product_photo_provider');
    if (setting) return setting;
  } catch (e) {}
  return 'glabs';
}

export async function generateCleanProductPhoto({ product, referenceImage, prompt, provider, tenantId }) {
  const resolvedProvider = provider || await resolveProductPhotoProvider(product, tenantId);
  if (resolvedProvider === 'gemini') {
    const { generateWithGemini } = await import('./product-photo-providers/gemini.js');
    return generateWithGemini({ referenceImage, prompt, tenantId });
  }
  const { generateWithGlabs } = await import('./product-photo-providers/glabs.js');
  return generateWithGlabs({ referenceImage, prompt, tenantId });
}

export async function saveCleanProductPhoto(product, output) {
  const { imageBuffer, mimeType, provider } = output;
  const result = await saveCleanProductImage({
    tenantId: product.tenant_id,
    productId: product.id,
    buffer: imageBuffer,
    mimeType
  });
  return { relativePath: result.relativePath, sha256: result.sha256 };
}
