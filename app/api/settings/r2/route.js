import { NextResponse } from 'next/server';
import { getR2Config, saveR2Config, testR2Connection } from '@/lib/cloudflare-r2-client';
import { getActiveTenantId } from '@/lib/tenant-context';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId') || getActiveTenantId();
    const config = await getR2Config(tenantId);

    // Mask secret key untuk keamanan di UI (Zero Secret Exposure)
    const maskedSecret = config.secretAccessKey 
      ? (config.secretAccessKey.length > 8 
          ? config.secretAccessKey.slice(0, 4) + '••••••••' + config.secretAccessKey.slice(-4)
          : '••••••••')
      : '';

    return NextResponse.json({
      success: true,
      config: {
        accountId: config.accountId,
        accessKeyId: config.accessKeyId,
        secretAccessKey: maskedSecret,
        hasSecret: Boolean(config.secretAccessKey),
        bucketName: config.bucketName,
        publicDomain: config.publicDomain,
        isConfigured: config.isConfigured
      }
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { action, tenantId = getActiveTenantId(), config } = body;

    if (action === 'test') {
      const result = await testR2Connection(tenantId);
      return NextResponse.json({ success: true, message: 'Koneksi ke bucket Cloudflare R2 berhasil!', result });
    }

    if (action === 'save') {
      // Jika secret key yang dikirim adalah masked, jangan override secret key yang sudah ada
      const currentConfig = await getR2Config(tenantId);
      let nextSecret = config.secretAccessKey;
      if (!nextSecret || nextSecret.includes('••••')) {
        nextSecret = currentConfig.secretAccessKey;
      }

      const updated = await saveR2Config(tenantId, {
        accountId: config.accountId,
        accessKeyId: config.accessKeyId,
        secretAccessKey: nextSecret,
        bucketName: config.bucketName,
        publicDomain: config.publicDomain
      });

      return NextResponse.json({ success: true, message: 'Konfigurasi Cloudflare R2 berhasil disimpan.', isConfigured: updated.isConfigured });
    }

    return NextResponse.json({ success: false, error: 'Aksi tidak dikenali.' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
