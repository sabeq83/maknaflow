export function validateSingleProductCreate(input) {
  const { product, rawPhoto, isNewUI } = input;
  const errors = {};
  
  if (!product || !product.product_name || typeof product.product_name !== 'string' || product.product_name.length < 2 || product.product_name.length > 250) {
    errors.product_name = 'Product name must be between 2 and 250 characters';
  }
  
  const desc = product.product_description || product.raw_description;
  if (!desc || typeof desc !== 'string' || desc.length < 10) {
    errors.product_description = 'Product description must be at least 10 characters';
  }
  
  if (isNewUI && !rawPhoto) {
    errors.raw_photo = 'Raw photo is required';
  }
  
  if (!product.packaging_status || !['packaged', 'unpackaged'].includes(product.packaging_status)) {
    errors.packaging_status = 'Packaging status must be either "packaged" or "unpackaged"';
  }
  
  if (product.packaging_status === 'packaged' && (!product.packaging_type || typeof product.packaging_type !== 'string')) {
    errors.packaging_type = 'Packaging type is required when packaged';
  }
  
  return {
    data: Object.keys(errors).length === 0 ? product : null,
    rawPhoto,
    errors
  };
}

export function validateSingleProductUpdate(input) {
  const { product, rawPhoto, regenerate } = input;
  const errors = {};
  
  if (product.product_name !== undefined) {
    if (typeof product.product_name !== 'string' || product.product_name.length < 2 || product.product_name.length > 250) {
      errors.product_name = 'Product name must be between 2 and 250 characters';
    }
  }
  
  if (product.product_description !== undefined || product.raw_description !== undefined) {
    const desc = product.product_description || product.raw_description;
    if (typeof desc !== 'string' || desc.length < 10) {
      errors.product_description = 'Product description must be at least 10 characters';
    }
  }
  
  if (product.packaging_status !== undefined) {
    if (!['packaged', 'unpackaged'].includes(product.packaging_status)) {
      errors.packaging_status = 'Packaging status must be either "packaged" or "unpackaged"';
    }
    if (product.packaging_status === 'packaged' && (!product.packaging_type || typeof product.packaging_type !== 'string')) {
      errors.packaging_type = 'Packaging type is required when packaged';
    }
  }
  
  return {
    data: Object.keys(errors).length === 0 ? product : null,
    rawPhoto,
    regenerate,
    errors
  };
}

export function validateProductImportRow(row, rowNumber) {
  const errors = [];
  
  if (!row.product_name || typeof row.product_name !== 'string' || row.product_name.trim() === '') {
    errors.push('product_name is required');
  }
  if (!row.product_description || typeof row.product_description !== 'string' || row.product_description.trim() === '') {
    errors.push('product_description is required');
  }
  if (!row.raw_photo_source_url || typeof row.raw_photo_source_url !== 'string' || row.raw_photo_source_url.trim() === '') {
    errors.push('raw_photo_source_url is required');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    data: errors.length === 0 ? row : null
  };
}

export function validateRawProductImage(buffer, originalName = '') {
  if (!buffer || buffer.length === 0) return { valid: false, error: 'Empty file' };
  
  if (buffer.length > 20 * 1024 * 1024) {
    return { valid: false, error: 'File size exceeds 20MB' };
  }
  
  let mimeType = '';
  // Check magic bytes
  if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    mimeType = 'image/jpeg';
  } else if (buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    mimeType = 'image/png';
  } else if (buffer.length >= 4 && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    // RIFF....WEBP (offset 8 is WEBP)
    if (buffer.length >= 12 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
      mimeType = 'image/webp';
    }
  }
  
  if (!mimeType) {
    return { valid: false, error: 'Invalid image format, only JPEG, PNG, and WebP are allowed' };
  }
  
  return { valid: true, mimeType, error: null };
}

export function parseProductMultipart(formData) {
  const productStr = formData.get('product');
  let product = {};
  if (productStr && typeof productStr === 'string') {
    try {
      product = JSON.parse(productStr);
    } catch (e) {
      // ignore or throw
    }
  }
  const rawPhoto = formData.get('raw_photo');
  return {
    product,
    rawPhoto: rawPhoto && typeof rawPhoto === 'object' ? rawPhoto : null,
    isNewUI: true
  };
}

export function parseProductUpdateRequest_multipart(formData) {
  const productStr = formData.get('product');
  let product = {};
  if (productStr && typeof productStr === 'string') {
    try {
      product = JSON.parse(productStr);
    } catch (e) {
      // ignore
    }
  }
  const rawPhoto = formData.get('raw_photo');
  const regenerate = formData.get('regenerate') === 'true';
  
  return {
    product,
    rawPhoto: rawPhoto && typeof rawPhoto === 'object' ? rawPhoto : null,
    regenerate
  };
}

export function normalizeProductUrl(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return null;
  try {
    let u = new URL(urlStr.trim());
    u.hostname = u.hostname.toLowerCase();
    u.hash = '';
    
    // Sort query params and remove utm_* and fbclid
    const params = new URLSearchParams(u.search);
    const toDelete = [];
    params.forEach((val, key) => {
      if (key.startsWith('utm_') || key === 'fbclid') {
        toDelete.push(key);
      }
    });
    toDelete.forEach(key => params.delete(key));
    params.sort();
    
    u.search = params.toString();
    let res = u.toString();
    if (res.endsWith('/')) {
      res = res.slice(0, -1);
    }
    return res;
  } catch (e) {
    return null;
  }
}
