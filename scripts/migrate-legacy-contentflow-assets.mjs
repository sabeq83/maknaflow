import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const parsed = {};
for (let index = 2; index < process.argv.length; index += 1) {
  if (process.argv[index].startsWith('--')) parsed[process.argv[index].slice(2)] = process.argv[index + 1];
}

const mode = parsed.mode;
const artifactDir = path.resolve(parsed.artifact || '');
if (!['stage', 'finalize'].includes(mode)) throw new Error('--mode must be stage or finalize.');
if (!artifactDir || !fs.existsSync(artifactDir)) throw new Error('--artifact directory is required.');

const assetsPath = path.join(artifactDir, 'assets.json');
const manifestPath = path.join(artifactDir, 'manifest.json');
const payloadDir = path.join(artifactDir, 'asset-payload');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const hashFile = filename => sha256(fs.readFileSync(filename));
const isWithin = (parent, child) => child === parent || child.startsWith(`${parent}${path.sep}`);
const supportedExtensions = new Set(['.mp4', '.mov', '.webm', '.m4v']);

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const assets = JSON.parse(fs.readFileSync(assetsPath, 'utf8'));

function safePayloadName(asset) {
  const extension = path.extname(asset.filename || asset.source_path || '').toLowerCase();
  if (!supportedExtensions.has(extension)) throw new Error(`Unsupported video extension for asset ${asset.id}: ${extension}`);
  return `${String(asset.id).replace(/[^a-zA-Z0-9_-]/g, '_')}-${asset.sha256.slice(0, 16)}${extension}`;
}

function copyVerified(source, target, expectedSize, expectedHash) {
  if (!fs.existsSync(source)) throw new Error(`Asset source is missing: ${source}`);
  const sourceStat = fs.statSync(source);
  if (!sourceStat.isFile() || sourceStat.size !== expectedSize || hashFile(source) !== expectedHash) {
    throw new Error(`Asset source checksum mismatch: ${source}`);
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target)) {
    const targetStat = fs.statSync(target);
    if (targetStat.size !== expectedSize || hashFile(target) !== expectedHash) {
      throw new Error(`Refusing to overwrite a different target asset: ${target}`);
    }
    return 'already_present';
  }
  fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
  if (fs.statSync(target).size !== expectedSize || hashFile(target) !== expectedHash) {
    throw new Error(`Copied asset checksum mismatch: ${target}`);
  }
  return 'copied';
}

async function verifyRemote(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(parsed['remote-timeout-ms'] || 15000));
  try {
    let response = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal });
    if (response.status === 405) response = await fetch(url, { headers: { Range: 'bytes=0-0' }, redirect: 'follow', signal: controller.signal });
    return response.ok || response.status === 206;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

const results = { staged: 0, copied: 0, already_present: 0, remote_ok: 0, remote_unreachable: 0, unchanged: 0 };
if (mode === 'stage') {
  fs.mkdirSync(payloadDir, { recursive: true });
  for (const asset of assets) {
    if (asset.status !== 'local_ready' && asset.status !== 'staged') {
      results.unchanged += 1;
      continue;
    }
    const source = path.resolve(asset.source_path || '');
    const publicRoot = path.resolve(parsed['source-public-root'] || '/');
    if (!isWithin(publicRoot, source)) throw new Error(`Asset escapes source public root: ${source}`);
    const payloadName = safePayloadName(asset);
    const copyStatus = copyVerified(source, path.join(payloadDir, payloadName), asset.size, asset.sha256);
    asset.payload_name = payloadName;
    asset.status = 'staged';
    results.staged += 1;
    if (copyStatus === 'already_present') results.already_present += 1;
  }
} else {
  const targetPublicRoot = path.resolve(parsed['target-public-root'] || '');
  if (!parsed['target-public-root']) throw new Error('--target-public-root is required for finalize.');
  const relativeTargetDir = path.join('uploads', 'content-flow', 'legacy', manifest.batch_id);
  const targetDir = path.resolve(targetPublicRoot, relativeTargetDir);
  if (!isWithin(targetPublicRoot, targetDir)) throw new Error('Unsafe target asset directory.');
  for (const asset of assets) {
    if (asset.status === 'staged' || asset.status === 'copied') {
      const payloadName = asset.payload_name || safePayloadName(asset);
      const copyStatus = copyVerified(path.join(payloadDir, payloadName), path.join(targetDir, payloadName), asset.size, asset.sha256);
      asset.status = 'copied';
      asset.target_url = `/${relativeTargetDir.split(path.sep).join('/')}/${payloadName}`;
      results[copyStatus] += 1;
    } else if (asset.status === 'remote_pending') {
      asset.status = await verifyRemote(asset.legacy_url_asset) ? 'remote_ok' : 'remote_unreachable';
      results[asset.status] += 1;
    } else {
      results.unchanged += 1;
    }
  }
}

const assetsText = `${JSON.stringify(assets, null, 2)}\n`;
fs.writeFileSync(assetsPath, assetsText);
manifest.assets = Object.fromEntries([...new Set(assets.map(asset => asset.status))].sort().map(status => [status, assets.filter(asset => asset.status === status).length]));
manifest.hashes.assets_json = sha256(assetsText);
manifest.asset_processing = { mode, processed_at: new Date().toISOString(), results };
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ batch_id: manifest.batch_id, mode, assets: manifest.assets, results }, null, 2));
