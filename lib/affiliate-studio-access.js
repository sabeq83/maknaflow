import { withTenantContext } from './auth.js';
import { getAffiliateStudioFlags } from './affiliate-studio-feature-flags.js';
import {
  AFFILIATE_STUDIO_PERMISSION,
  assertAffiliateAccessMode
} from './affiliate-studio-contract.js';

export function evaluateAffiliateStudioAccess({ user, flags, mode }) {
  if (!user || user.tenantId === '__none__') {
    return {
      allowed: false,
      message: 'Forbidden',
      code: 'FORBIDDEN',
      status: 403
    };
  }

  // 1. disabled menu (highest priority check)
  const isMenuDisabled = user.tenantDisabledMenus?.includes(AFFILIATE_STUDIO_PERMISSION);
  if (isMenuDisabled) {
    return {
      allowed: false,
      message: 'Menu disabled for this tenant',
      code: 'MENU_DISABLED',
      status: 403
    };
  }

  // 2. missing permission (second priority check)
  const hasPermission = user.menuPermissions?.includes(AFFILIATE_STUDIO_PERMISSION);
  if (!hasPermission) {
    return {
      allowed: false,
      message: 'Permission denied',
      code: 'PERMISSION_DENIED',
      status: 403
    };
  }

  // 3. feature disabled (third priority check)
  if (!flags || flags.enabled !== true) {
    return {
      allowed: false,
      message: 'Affiliate Studio is disabled for this tenant',
      code: 'FEATURE_DISABLED',
      status: 403
    };
  }

  // 4. admin role (if requested mode is 'admin')
  if (mode === 'admin') {
    if (user.role !== 'admin') {
      return {
        allowed: false,
        message: 'Admin access required',
        code: 'ADMIN_REQUIRED',
        status: 403
      };
    }
  }

  return { allowed: true };
}

export function withAffiliateStudioAccess(mode, handler) {
  assertAffiliateAccessMode(mode);
  return withTenantContext(async (request, context, user) => {
    const flags = await getAffiliateStudioFlags(user.tenantId);
    const decision = evaluateAffiliateStudioAccess({ user, flags, mode });
    if (!decision.allowed) return Response.json(
      { success: false, error: decision.message, code: decision.code },
      { status: decision.status }
    );
    return handler(request, context, user, { flags });
  });
}
