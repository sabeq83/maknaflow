import { getPgPool } from '../lib/db-pg.js';

/**
 * Normalization script for product active_photo pointers.
 * Default is DRY-RUN mode.
 * Pass --apply and --schema=<schema_name> to perform database update.
 */
async function main() {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');
  const schemaArg = args.find(a => a.startsWith('--schema='));
  const schema = schemaArg ? schemaArg.split('=')[1].trim() : (process.env.PG_SEARCH_PATH || 'public');

  console.log(`================================================================`);
  console.log(`Product active_photo Pointer Normalization`);
  console.log(`Schema: ${schema}`);
  console.log(`Mode:   ${isApply ? 'APPLY (Mutating DB)' : 'DRY-RUN (No changes applied)'}`);
  console.log(`================================================================`);

  const pool = getPgPool();
  const client = await pool.connect();

  try {
    await client.query(`SET search_path TO ${schema}, public`);

    const selectQuery = `
      SELECT id, tenant_id, product_name, active_photo, clean_photo_url, raw_photo_url, photo_url
      FROM products
      ORDER BY id
    `;
    const res = await client.query(selectQuery);
    console.log(`Total products scanned: ${res.rows.length}`);

    let validCount = 0;
    let needsNormalizationCount = 0;
    const itemsToNormalize = [];

    for (const product of res.rows) {
      const current = product.active_photo;
      let canonicalTarget = null;

      if (current === 'clean_photo_url' || current === 'raw_photo_url') {
        validCount++;
        continue;
      }

      // Legacy or invalid pointer: normalize to Clean if present, otherwise Raw
      if (product.clean_photo_url && product.clean_photo_url.trim()) {
        canonicalTarget = 'clean_photo_url';
      } else {
        canonicalTarget = 'raw_photo_url';
      }

      needsNormalizationCount++;
      itemsToNormalize.push({
        id: product.id,
        tenant_id: product.tenant_id,
        product_name: product.product_name,
        current_active_photo: current,
        target_active_photo: canonicalTarget
      });
    }

    console.log(`- Valid active_photo: ${validCount}`);
    console.log(`- Needs normalization: ${needsNormalizationCount}`);

    if (itemsToNormalize.length > 0) {
      console.log(`\nSample of items to normalize (first 10):`);
      itemsToNormalize.slice(0, 10).forEach((item, idx) => {
        console.log(`  ${idx + 1}. ID: ${item.id} | Current: "${item.current_active_photo}" -> Target: "${item.target_active_photo}"`);
      });
    }

    if (isApply && itemsToNormalize.length > 0) {
      console.log(`\nApplying updates in transaction...`);
      await client.query('BEGIN');
      for (const item of itemsToNormalize) {
        await client.query(
          `UPDATE products SET active_photo = $1 WHERE id = $2 AND tenant_id = $3`,
          [item.target_active_photo, item.id, item.tenant_id]
        );
      }
      await client.query('COMMIT');
      console.log(`✅ Successfully normalized ${itemsToNormalize.length} product records in schema "${schema}".`);
    } else if (!isApply && itemsToNormalize.length > 0) {
      console.log(`\nℹ️ Dry-run completed. Re-run with --apply --schema=${schema} to apply changes.`);
    } else {
      console.log(`\n✅ All products already have canonical active_photo pointers.`);
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error during normalization:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
