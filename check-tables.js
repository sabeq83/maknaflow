import { pgQuery } from './lib/db-pg.js';

async function check() {
  try {
    console.log('Checking tables in PostgreSQL database...');
    
    // Check if table product_extractions exists
    const resPE = await pgQuery(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'product_extractions'
      );
    `);
    console.log('product_extractions exists:', resPE.rows[0].exists);
    
    if (resPE.rows[0].exists) {
      const countPE = await pgQuery('SELECT COUNT(*) FROM product_extractions');
      console.log('product_extractions row count:', countPE.rows[0].count);
      
      const samplePE = await pgQuery('SELECT id, product_name, created_at FROM product_extractions ORDER BY created_at DESC LIMIT 5');
      console.log('product_extractions sample:', samplePE.rows);
    }

    // Check if table products exists
    const resP = await pgQuery(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'products'
      );
    `);
    console.log('products exists:', resP.rows[0].exists);

    if (resP.rows[0].exists) {
      const countP = await pgQuery('SELECT COUNT(*) FROM products');
      console.log('products row count:', countP.rows[0].count);

      const sampleP = await pgQuery('SELECT id, product_name, created_at FROM products ORDER BY created_at DESC LIMIT 5');
      console.log('products sample:', sampleP.rows);
    }
  } catch (err) {
    console.error('Error during check:', err);
  } finally {
    process.exit(0);
  }
}

check();
