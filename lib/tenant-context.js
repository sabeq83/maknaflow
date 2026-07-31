import { AsyncLocalStorage } from 'async_hooks';

export const tenantContext = new AsyncLocalStorage();

export function getActiveTenantId() {
  return tenantContext.getStore() || 'default_tenant';
}
