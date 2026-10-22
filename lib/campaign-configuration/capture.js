/** Preserve canonical FormData serialization; files stay out of JSON. */
export function captureCanonicalFormData(form) {
  const config = {};
  let productRefImage = null;
  for (const [key, value] of form.entries()) {
    if (typeof value !== 'string') {
      if (key === 'product_media') productRefImage = value;
      continue;
    }
    config[key] = key === 'urls' ? JSON.parse(value) : value;
  }
  return { config, productRefImage };
}
