import pkg from 'pg';
const { Pool } = pkg;
import { listReplizAccounts, createReplizSchedule } from '../lib/repliz-client.js';
import { decryptSecret } from '../lib/encrypted-secret.js';

async function run() {
  const pool = new Pool({
    host: '100.78.186.123',
    port: 5432,
    user: 'makna_user',
    password: 'maknagridpass',
    database: 'maknaflow_db',
  });

  const res = await pool.query(`
    SELECT setting_key, setting_value FROM staging.tenant_settings WHERE tenant_id = 'default_tenant' AND setting_key LIKE 'repliz_%'
  `);
  
  let settings = {};
  for (const row of res.rows) {
    settings[row.setting_key] = row.setting_value;
  }

  const accessKey = settings['repliz_access_key'];
  let secretKey = settings['repliz_secret_key'];
  try {
    secretKey = decryptSecret(secretKey);
  } catch (e) {}

  const credentials = {
    apiUrl: settings['repliz_api_url'] || 'https://api.repliz.com',
    accessKey,
    secretKey
  };

  console.log('Testing listReplizAccounts with valid credentials...');
  const accs = await listReplizAccounts(credentials);
  console.log(`Found ${accs.length} accounts:`);
  for (const a of accs) {
    console.log(`- [${a.platform}] ${a.username || a.name || a.title} (ID: ${a.id || a._id}, isConnected: ${a.isConnected})`);
  }

  // Cari akun Facebook
  const fbAcc = accs.find(a => a.platform === 'facebook');
  if (fbAcc) {
    console.log('\n--- TESTING REPLIZ FACEBOOK SCHEDULE CREATION ---');
    console.log(`Testing with FB Account: ${fbAcc.username || fbAcc.name} (ID: ${fbAcc.id || fbAcc._id})`);

    // Coba schedule di masa depan (misal besok)
    const futureDate = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const testPayload = {
      accountId: fbAcc.id || fbAcc._id,
      scheduleAt: futureDate,
      type: 'reel',
      title: 'Test Reel Staging',
      description: 'Test Reel Staging FB Auto Scheduler #maknaflow',
      topic: '',
      medias: [
        {
          alt: 'Test',
          customThumbnail: false,
          type: 'video',
          thumbnail: '',
          url: 'https://drive.google.com/uc?export=download&id=16tYiX6tnU7G4ommkq_dWBD705OMkzpyR'
        }
      ],
      meta: { title: '', description: '', url: '' },
      additionalInfo: {
        isAiGenerated: false,
        isDraft: false,
        isAutoAddMusic: false,
        collaborators: [],
        music: { id: '', artist: '', name: '', thumbnail: '' },
        products: [],
        tags: [],
        mentions: [],
        link: '',
        targetCountries: []
      },
      replies: []
    };

    try {
      console.log('Sending test schedule payload to Repliz API...');
      const scheduleRes = await createReplizSchedule(credentials, testPayload);
      console.log('Schedule Response SUCCESS:', JSON.stringify(scheduleRes, null, 2));
    } catch (err) {
      console.error('Schedule Creation FAILED:', err.status, err.message, 'Code:', err.code);
    }
  }

  await pool.end();
}

run().catch(console.error);
