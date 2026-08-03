export function classifyAutomationError(error) {
  const status = Number(error?.status || error?.statusCode || error?.response?.status || 0);
  const code = String(error?.code || '').toUpperCase();
  if ([400, 401, 403, 404, 409, 422].includes(status)) return 'permanent';
  if (status === 429 || status >= 500 || ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN'].includes(code)) return 'transient';
  return 'unknown';
}

export function calculateBackoff({ attempt, baseSeconds = 60, maxSeconds = 900, random = Math.random }) {
  const ceiling = Math.min(Number(maxSeconds), Number(baseSeconds) * (2 ** Math.max(0, Number(attempt) - 1)));
  return Math.max(1, Math.floor(random() * ceiling));
}

export function shouldRetry({ failureClass, attempt, maxAttempts = 3 }) {
  if (Number(attempt) >= Number(maxAttempts)) return false;
  return failureClass === 'transient' || (failureClass === 'unknown' && Number(attempt) < 2);
}
