function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanText(value, directive) {
  if (!directive || typeof value !== 'string') return value;
  const pattern = new RegExp(escapeRegExp(directive.trim()), 'giu');
  return value
    .replace(pattern, '')
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/([.!?])\s*\1+/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function sanitizeAiDirectiveLeak(value, directive) {
  if (!directive || !String(directive).trim()) return value;
  if (Array.isArray(value)) return value.map(item => sanitizeAiDirectiveLeak(item, directive));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeAiDirectiveLeak(item, directive)]));
  }
  return cleanText(value, String(directive));
}

export function containsAiDirectiveLeak(value, directive) {
  if (!directive || !String(directive).trim()) return false;
  if (typeof value === 'string') return value.toLocaleLowerCase('id-ID').includes(String(directive).trim().toLocaleLowerCase('id-ID'));
  if (Array.isArray(value)) return value.some(item => containsAiDirectiveLeak(item, directive));
  if (value && typeof value === 'object') return Object.values(value).some(item => containsAiDirectiveLeak(item, directive));
  return false;
}
