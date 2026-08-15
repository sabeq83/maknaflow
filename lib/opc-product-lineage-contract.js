export function resolveOpcProductId({ planner, explicitProductId = null }) {
  return explicitProductId || planner?.product_id || null;
}
