import { S3Client, PutObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { pgQuery } from './db-pg.js';
import { getActiveTenantId } from './tenant-context.js';

export const R2_SETTING_KEYS = Object.freeze({
  accountId: 'r2_account_id',
  accessKeyId: 'r2_access_key_id',
  secretAccessKey: 'r2_secret_access_key',
  bucketName: 'r2_bucket_name',
  publicDomain: 'r2_public_domain'
});

/**
 * Mengambil konfigurasi Cloudflare R2 secara hierarkis:
 * 1. Database `tenant_settings`
 * 2. Fallback Environment variables `.env.local`
 */
export async function getR2Config(tenantId = getActiveTenantId()) {
  try {
    const result = await pgQuery(
      `SELECT setting_key, setting_value FROM tenant_settings
       WHERE tenant_id=$1 AND setting_key=ANY($2::text[])`,
      [tenantId, Object.values(R2_SETTING_KEYS)]
    );
    const dbValues = Object.fromEntries(result.rows.map(row => [row.setting_key, row.setting_value]));

    const accountId = dbValues[R2_SETTING_KEYS.accountId] || process.env.CLOUDFLARE_R2_ACCOUNT_ID || '';
    const accessKeyId = dbValues[R2_SETTING_KEYS.accessKeyId] || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '';
    const secretAccessKey = dbValues[R2_SETTING_KEYS.secretAccessKey] || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '';
    const bucketName = dbValues[R2_SETTING_KEYS.bucketName] || process.env.CLOUDFLARE_R2_BUCKET_NAME || 'makna-recipe-videos';
    const publicDomain = dbValues[R2_SETTING_KEYS.publicDomain] || process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN || '';

    return {
      accountId,
      accessKeyId,
      secretAccessKey,
      bucketName,
      publicDomain,
      isConfigured: Boolean(accountId && accessKeyId && secretAccessKey)
    };
  } catch (err) {
    // Fallback murni env bila database belum siap
    return {
      accountId: process.env.CLOUDFLARE_R2_ACCOUNT_ID || '',
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',
      bucketName: process.env.CLOUDFLARE_R2_BUCKET_NAME || 'makna-recipe-videos',
      publicDomain: process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN || '',
      isConfigured: Boolean(process.env.CLOUDFLARE_R2_ACCOUNT_ID && process.env.CLOUDFLARE_R2_ACCESS_KEY_ID && process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY)
    };
  }
}

/**
 * Menyimpan konfigurasi Cloudflare R2 ke `tenant_settings`
 */
export async function saveR2Config(tenantId = getActiveTenantId(), config = {}) {
  const mapping = [
    [R2_SETTING_KEYS.accountId, config.accountId],
    [R2_SETTING_KEYS.accessKeyId, config.accessKeyId],
    [R2_SETTING_KEYS.secretAccessKey, config.secretAccessKey],
    [R2_SETTING_KEYS.bucketName, config.bucketName],
    [R2_SETTING_KEYS.publicDomain, config.publicDomain]
  ];

  for (const [key, val] of mapping) {
    if (val !== undefined && val !== null) {
      await pgQuery(
        `INSERT INTO tenant_settings(tenant_id, setting_key, setting_value) VALUES($1, $2, $3)
         ON CONFLICT(tenant_id, setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value`,
        [tenantId, key, String(val).trim()]
      );
    }
  }

  return getR2Config(tenantId);
}

/**
 * Menginisialisasi AWS S3 Client instance khusus endpoint Cloudflare R2
 */
export async function getR2S3Client(tenantId = getActiveTenantId()) {
  const config = await getR2Config(tenantId);
  if (!config.isConfigured) {
    throw new Error('Kredensial Cloudflare R2 belum lengkap. Mohon isi Account ID, Access Key ID, dan Secret Access Key di Settings > Storage.');
  }

  const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;
  const client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  });

  return { client, config };
}

/**
 * Menguji koneksi Cloudflare R2 dengan HeadBucket
 */
export async function testR2Connection(tenantId = getActiveTenantId()) {
  const { client, config } = await getR2S3Client(tenantId);
  await client.send(new HeadBucketCommand({ Bucket: config.bucketName }));
  return {
    success: true,
    bucketName: config.bucketName,
    publicDomain: config.publicDomain
  };
}

/**
 * Mengunggah buffer video ter-mute ke Cloudflare R2 dan mengembalikan Public CDN URL
 */
export async function uploadVideoBufferToR2({
  buffer,
  key,
  contentType = 'video/mp4',
  tenantId = getActiveTenantId()
}) {
  const { client, config } = await getR2S3Client(tenantId);

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType
    })
  );

  const cleanDomain = (config.publicDomain || '').replace(/\/+$/, '');
  const publicUrl = cleanDomain
    ? `${cleanDomain}/${key}`
    : `https://${config.bucketName}.${config.accountId}.r2.cloudflarestorage.com/${key}`;

  return {
    key,
    bucket: config.bucketName,
    publicUrl,
    sizeBytes: buffer.length
  };
}
