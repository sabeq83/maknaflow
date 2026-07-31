const { execSync } = require('child_process');

function showHelp() {
  console.log('Makna Production Database Helper');
  console.log('Usage:');
  console.log('  node scripts/prod-db.js query "<SQL_QUERY>"   - Run a query on production db');
  console.log('  node scripts/prod-db.js download             - Copy production db to local makna_production.db');
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  showHelp();
}

const action = args[0];

if (action === 'query') {
  const query = args[1];
  if (!query) {
    console.error('Error: SQL query string is required.');
    process.exit(1);
  }

  // To prevent shell escape issues, pass the query via stdin to sqlite3 on remote wsl
  try {
    const sshCmd = `ssh vibe-server "wsl -d Ubuntu-24.04 -- sqlite3 -json /mnt/d/server/maknagen/data/makna.db"`;
    // Write query to process stdin
    const result = execSync(sshCmd, { input: query, encoding: 'utf8' });
    console.log(result.trim());
  } catch (err) {
    console.error('❌ Error executing production query:', err.message);
    if (err.stderr) {
      console.error(err.stderr.toString());
    }
    process.exit(1);
  }
} else if (action === 'download') {
  try {
    console.log('Downloading production database via scp...');
    const scpCmd = `scp vibe-server:"D:/server/maknagen/data/makna.db" ./makna_production.db`;
    execSync(scpCmd, { stdio: 'inherit' });
    console.log('✓ Successfully downloaded production database to ./makna_production.db');
  } catch (err) {
    console.error('❌ Error downloading production database:', err.message);
    process.exit(1);
  }
} else {
  showHelp();
}
