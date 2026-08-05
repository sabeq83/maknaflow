const path = require('path');
const fs = require('fs');

try {
  const envPath = path.join(__dirname, '../.env.staging.local');
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        process.env[key] = value.trim();
      }
    });
  }
} catch (e) {
  console.warn('Warning: Could not load .env.staging.local:', e.message);
}

const { syncCampaignToContentFlow } = require('../lib/contentflow-ingest.js');

syncCampaignToContentFlow('re_260804_2k462r')
  .then(console.log)
  .catch(console.error);
