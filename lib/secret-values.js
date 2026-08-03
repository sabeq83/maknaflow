export const SECRET_MASK_PREFIX = '••••••••';

export function maskSecret(value) {
  return value ? `${SECRET_MASK_PREFIX}${String(value).slice(-6)}` : '';
}

export function isNewSecret(value) {
  return typeof value === 'string' && value.trim() !== '' && !value.startsWith(SECRET_MASK_PREFIX);
}
