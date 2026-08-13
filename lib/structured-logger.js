const SECRET_KEY = /(authorization|cookie|password|secret|token|api[_-]?key|bot[_-]?token)/i;

export function redactStructuredValue(value, seen = new WeakSet()) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, 'Bearer [REDACTED]')
    .replace(/([?&](?:key|token|api_key)=)[^&\s]+/gi, '$1[REDACTED]');
  if (typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  if (Array.isArray(value)) return value.map(item => redactStructuredValue(item, seen));
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SECRET_KEY.test(key) ? '[REDACTED]' : redactStructuredValue(item, seen)]));
}

export function structuredLog(level, event, context = {}) {
  const payload = JSON.stringify(redactStructuredValue({ timestamp: new Date().toISOString(), level, event, ...context }));
  const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'info';
  console[method](payload);
}
