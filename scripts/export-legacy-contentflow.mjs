import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const INCLUDE_ACCOUNTS = new Set(['nutribake', 'dapurbotani', 'mealprepid', 'siasatsehat', 'umum']);
const args = Object.fromEntries(process.argv.slice(2).map((value, index, all) => value.startsWith('--') ? [value.slice(2), all[index + 1]] : null).filter(Boolean));
const source = path.resolve(args.source || 'data/makna_grid.db');
const outputRoot = path.resolve(args.output || 'migration-artifacts/contentflow');
const publicRoot = path.resolve(args['public-root'] || 'public');
const batchId = args.batch || `cfg_${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
const outputDir = path.join(outputRoot, batchId);
if (fs.existsSync(outputDir)) throw new Error(`Output batch already exists: ${outputDir}`);
fs.mkdirSync(outputDir, { recursive: true });

const snapshotPath = path.join(outputDir, 'source.sqlite');
const liveDb = new Database(source, { readonly: true, fileMustExist: true });
await liveDb.backup(snapshotPath);
liveDb.close();
const db = new Database(snapshotPath, { readonly: true, fileMustExist: true });
const rows = db.prepare('SELECT * FROM content_flow_items ORDER BY created_at, id').all();
db.close();

const included = [];
const excluded = [];
const assets = [];
for (const sourceRow of rows) {
  const account = String(sourceRow.account_name || '').trim().toLowerCase();
  const row = { ...sourceRow, account_name: account };
  if (!INCLUDE_ACCOUNTS.has(account)) {
    excluded.push({ ...row, exclusion_reason: 'account_not_in_scope' });
    continue;
  }
  included.push(row);
  const legacyUrl = String(row.url_asset || '').trim();
  if (!legacyUrl) {
    assets.push({ id: row.id, legacy_url_asset: '', status: 'no_asset' });
  } else if (/^https?:\/\//i.test(legacyUrl)) {
    assets.push({ id: row.id, legacy_url_asset: legacyUrl, status: 'remote_pending' });
  } else if (legacyUrl.startsWith('/')) {
    const sourcePath = path.resolve(publicRoot, legacyUrl.replace(/^\/+/, ''));
    if (!sourcePath.startsWith(`${publicRoot}${path.sep}`)) throw new Error(`Unsafe asset path: ${legacyUrl}`);
    if (!fs.existsSync(sourcePath)) assets.push({ id: row.id, legacy_url_asset: legacyUrl, status: 'missing_at_source' });
    else {
      const bytes = fs.readFileSync(sourcePath);
      assets.push({ id: row.id, legacy_url_asset: legacyUrl, source_path: sourcePath, filename: path.basename(sourcePath), size: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), status: 'local_ready' });
    }
  } else {
    assets.push({ id: row.id, legacy_url_asset: legacyUrl, status: 'unsupported_path' });
  }
}

const jsonl = values => `${values.map(value => JSON.stringify(value)).join('\n')}\n`;
const includedText = jsonl(included);
const excludedText = jsonl(excluded);
const assetsText = `${JSON.stringify(assets, null, 2)}\n`;
fs.writeFileSync(path.join(outputDir, 'included.jsonl'), includedText);
fs.writeFileSync(path.join(outputDir, 'excluded.jsonl'), excludedText);
fs.writeFileSync(path.join(outputDir, 'assets.json'), assetsText);
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const manifest = {
  schema_version: 1,
  batch_id: batchId,
  source_database: source,
  created_at: new Date().toISOString(),
  tenant_id: 'default_tenant',
  include_accounts: [...INCLUDE_ACCOUNTS],
  counts: { source_total: rows.length, included: included.length, excluded: excluded.length },
  assets: Object.fromEntries([...new Set(assets.map(asset => asset.status))].sort().map(status => [status, assets.filter(asset => asset.status === status).length])),
  hashes: { included_jsonl: sha256(includedText), excluded_jsonl: sha256(excludedText), assets_json: sha256(assetsText) }
};
if (manifest.counts.source_total !== manifest.counts.included + manifest.counts.excluded) throw new Error('Export count invariant failed.');
fs.writeFileSync(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ output_dir: outputDir, ...manifest }, null, 2));
