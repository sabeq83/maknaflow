import crypto from 'node:crypto';

function key(){const source=process.env.MAKNA_SECRET_ENCRYPTION_KEY||process.env.SESSION_SECRET||'makna_grid_master_secret_encryption_key_2026';return crypto.createHash('sha256').update(source).digest();}

export function encryptSecret(value){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key(),iv);const encrypted=Buffer.concat([cipher.update(String(value),'utf8'),cipher.final()]);return ['v1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),encrypted.toString('base64url')].join('.');}
export function decryptSecret(value){const [version,iv,tag,data]=String(value||'').split('.');if(version!=='v1'||!iv||!tag||!data)throw new Error('Format credential terenkripsi tidak valid.');const decipher=crypto.createDecipheriv('aes-256-gcm',key(),Buffer.from(iv,'base64url'));decipher.setAuthTag(Buffer.from(tag,'base64url'));return Buffer.concat([decipher.update(Buffer.from(data,'base64url')),decipher.final()]).toString('utf8');}
