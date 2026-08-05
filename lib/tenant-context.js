import { AsyncLocalStorage } from 'async_hooks';

if (!globalThis.tenantContext) {
  globalThis.tenantContext = new AsyncLocalStorage();
}
export const tenantContext = globalThis.tenantContext;

export function getActiveTenantId() {
  return tenantContext.getStore() || 'default_tenant';
}
