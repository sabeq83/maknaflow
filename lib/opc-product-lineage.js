import crypto from 'crypto';
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
    
    // Check existing binding
    binding = (await pgQuery(
      'SELECT * FROM brand_products WHERE tenant_id=$1 AND brand_profile_id=$2 AND product_id=$3',
      [tenantId, brandProfileId, productId]
    )).rows[0];

    if (!binding) {
      // Auto-create active binding between this brand and product
      const fallbackBindingId = `bp_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
      const insertRes = await pgQuery(`
        INSERT INTO brand_products (id, tenant_id, brand_profile_id, product_id, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (tenant_id, brand_profile_id, product_id)
        DO UPDATE SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [fallbackBindingId, tenantId, brandProfileId, productId]);
      binding = insertRes.rows[0];
    } else if (!binding.is_active) {
      // Auto-activate existing binding since user is explicitly running campaign for this brand and product
      const updateRes = await pgQuery(`
        UPDATE brand_products SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND tenant_id = $2
        RETURNING *
      `, [binding.id, tenantId]);
      binding = updateRes.rows[0];
    }
  }
  return { tenantId, productId, product, brand, binding };
}

