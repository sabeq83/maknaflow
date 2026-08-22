import { createReCampaign } from './lib/db.js';
import { pgQuery } from './lib/db-pg.js';
import { tenantContext } from './lib/tenant-context.js';

async function main() {
  await pgQuery('SET search_path TO dev;');
  console.log('Running createReCampaign with mock data...');
  
  await tenantContext.run('default_tenant', async () => {
    try {
      const result = await createReCampaign({
        id: 'test_campaign_' + Date.now(),
        campaign_name: 'Test RE Campaign VSO',
        visual_overrides_json: JSON.stringify({ preset: 'cyberpunk' }) // Activate VSO mock
      });
      console.log('✅ Success! Insert executed successfully:', result);
    } catch (err) {
      console.error('❌ Failed with database error:');
      console.error(err);
    }
  });
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
