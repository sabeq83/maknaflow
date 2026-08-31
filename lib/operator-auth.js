import crypto from 'crypto';
import { tenantContext } from './tenant-context.js';
import { pgQuery } from './db-pg.js';

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

export async function authenticateOperator(request, requiredScope = null) {
  const authorization = request?.headers?.get?.('authorization') || '';
  const suppliedToken = authorization.startsWith('Bearer ')
    ? authorization.slice(7).trim()
    : '';
  if (!suppliedToken) {
    throw new OperatorAuthError('Unauthorized.', 'OPERATOR_UNAUTHORIZED', 401);
  }
  const tokenHash = crypto.createHash('sha256').update(suppliedToken).digest('hex');
  const credentialResult = await pgQuery(`
    SELECT c.id, c.tenant_id, c.name, c.scopes
    FROM operator_credentials c
    JOIN tenants t ON t.id = c.tenant_id
    WHERE c.token_hash = $1 AND c.status = 'active' AND t.status = 'active'
    LIMIT 1
  `, [tokenHash]);
  let identity;
  if (credentialResult.rowCount > 0) {
    const credential = credentialResult.rows[0];
    identity = { tenantId: credential.tenant_id, actor: credential.id, name: credential.name, scopes: credential.scopes.split(',').map(value => value.trim()) };
  } else {
    const configuredToken = process.env.MAKNA_OPERATOR_API_TOKEN || '';
    if (configuredToken && constantTimeEqual(suppliedToken, configuredToken)) {
      identity = {
        tenantId: process.env.MAKNA_OPERATOR_TENANT_ID || 'default_tenant',
        actor: 'operator-api-legacy',
        name: 'Legacy Environment Credential',
        scopes: ['content:create', 'content:read', 'content:approve']
      };
    }
  }
  if (!identity) {
    throw new OperatorAuthError(
      'Unauthorized.',
      'OPERATOR_UNAUTHORIZED',
      401
    );
  }
  if (requiredScope && !identity.scopes.includes(requiredScope) && identity.actor !== 'operator-api-legacy') {
    throw new OperatorAuthError('Scope operator tidak mencukupi.', 'OPERATOR_SCOPE_FORBIDDEN', 403);
  }
  return identity;
}

export function runAsOperatorTenant(identity, callback) {
  return tenantContext.run(identity.tenantId, callback);
}
