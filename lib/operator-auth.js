import crypto from 'crypto';
import { tenantContext } from './tenant-context.js';

export class OperatorAuthError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = 'OperatorAuthError';
    this.code = code;
    this.status = status;
  }
}

function constantTimeEqual(left, right) {
  const leftDigest = crypto.createHash('sha256').update(left).digest();
  const rightDigest = crypto.createHash('sha256').update(right).digest();
  return crypto.timingSafeEqual(leftDigest, rightDigest);
}

export function authenticateOperator(request) {
  const configuredToken = process.env.MAKNA_OPERATOR_API_TOKEN || '';
  if (!configuredToken) {
    throw new OperatorAuthError(
      'Operator API belum dikonfigurasi.',
      'OPERATOR_AUTH_NOT_CONFIGURED',
      503
    );
  }
  const authorization = request?.headers?.get?.('authorization') || '';
  const suppliedToken = authorization.startsWith('Bearer ')
    ? authorization.slice(7).trim()
    : '';
  if (!suppliedToken || !constantTimeEqual(suppliedToken, configuredToken)) {
    throw new OperatorAuthError('Unauthorized.', 'OPERATOR_UNAUTHORIZED', 401);
  }
  return {
    tenantId: process.env.MAKNA_OPERATOR_TENANT_ID || 'default_tenant',
    actor: 'operator-api'
  };
}

export function runAsOperatorTenant(identity, callback) {
  return tenantContext.run(identity.tenantId, callback);
}
