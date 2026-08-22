import { generateBriefSuggestions } from './lib/universe-ai-suggest.js';
import { pgQuery } from './lib/db-pg.js';
import { loadDbCaches } from './lib/db.js';
import { tenantContext } from './lib/tenant-context.js';

async function main() {
  // Load dev schema
  await pgQuery('SET search_path TO dev;');
  await loadDbCaches();

  console.log('Testing generateBriefSuggestions with seed: "kucing detektif di kota cyber"...');
  
  await tenantContext.run('default_tenant', async () => {
    try {
      const result = await generateBriefSuggestions('kucing detektif di kota cyber');
      console.log('✅ SUCCESS!');
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('❌ FAILED with error:');
      console.error(error);
    }
  });
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
