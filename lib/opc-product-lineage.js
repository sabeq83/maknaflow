import { pgQuery } from './db-pg.js';
import { getActiveTenantId } from './tenant-context.js';
import { resolveOpcProductId } from './opc-product-lineage-contract.js';

export class OpcProductLineageError extends Error {
  constructor(message, code, status = 422) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function resolveAndValidateOpcProductLineage({ planner, explicitProductId = null, brandProfileId = null }) {
  const tenantId = getActiveTenantId();
  const productId = resolveOpcProductId({ planner, explicitProductId });
  if (!productId) {
    throw new OpcProductLineageError('Product Campaign wajib mempunyai product_id.', 'OPC_PRODUCT_REQUIRED');
  }
  const product = (await pgQuery(
    'SELECT * FROM product_extractions WHERE id=$1 AND tenant_id=$2',
    [productId, tenantId]
  )).rows[0];
  if (!product) {
    throw new OpcProductLineageError(
      `Produk ${productId} tidak ditemukan pada tenant ${tenantId}.`,
      'OPC_PRODUCT_TENANT_MISMATCH'
    );
  }
  let brand = null;
  let binding = null;
  if (brandProfileId) {
    brand = (await pgQuery('SELECT * FROM brand_profiles WHERE id=$1 AND tenant_id=$2', [brandProfileId, tenantId])).rows[0];
    if (!brand) throw new OpcProductLineageError('Brand Profile tidak ditemukan pada tenant aktif.', 'OPC_BRAND_TENANT_MISMATCH');
    binding = (await pgQuery(
      'SELECT * FROM brand_products WHERE tenant_id=$1 AND brand_profile_id=$2 AND product_id=$3 AND is_active=TRUE',
      [tenantId, brandProfileId, productId]
    )).rows[0];
    if (!binding) {
      throw new OpcProductLineageError('Produk belum terhubung aktif ke Brand Profile.', 'OPC_PRODUCT_BINDING_UNAVAILABLE');
    }
  }
  return { tenantId, productId, product, brand, binding };
}
