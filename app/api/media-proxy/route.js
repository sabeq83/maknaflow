import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Domain Nextcloud yang diizinkan di-proxy (whitelist)
const ALLOWED_NEXTCLOUD_HOSTS = (process.env.MEDIA_PROXY_ALLOWED_HOSTS || 'cloud.ast402.my.id').split(',');

// Tailscale internal IP Nextcloud — bypass Cloudflare + robots.txt
const NEXTCLOUD_INTERNAL_BASE = process.env.NEXTCLOUD_INTERNAL_BASE || 'http://100.78.186.123';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const encodedUrl = searchParams.get('url');

    if (!encodedUrl) {
      return new NextResponse('Missing url parameter', { status: 400 });
    }

    // Decode base64url → original URL
    let targetUrl;
    try {
      targetUrl = Buffer.from(encodedUrl, 'base64url').toString('utf-8');
    } catch {
      return new NextResponse('Invalid url encoding', { status: 400 });
    }

    // Validasi domain yang diizinkan
    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return new NextResponse('Invalid url format', { status: 400 });
    }

    if (!ALLOWED_NEXTCLOUD_HOSTS.includes(parsed.hostname)) {
      console.warn(`[Media Proxy] Domain tidak diizinkan: ${parsed.hostname}`);
      return new NextResponse('Domain not allowed', { status: 403 });
    }

    // Rewrite hostname ke Tailscale internal — bypass Cloudflare robots.txt
    const internalUrl = `${NEXTCLOUD_INTERNAL_BASE}${parsed.pathname}${parsed.search}`;

    console.log(`[Media Proxy] Proxying: ${parsed.hostname}${parsed.pathname.slice(0, 60)}... → internal`);

    const upstream = await fetch(internalUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(60000),
      headers: {
        // Nextcloud public.php/dav tidak butuh auth untuk shared files
        'User-Agent': 'MAKNA-MediaProxy/1.0'
      }
    });

    if (!upstream.ok) {
      console.error(`[Media Proxy] Upstream error: ${upstream.status} for ${internalUrl}`);
      return new NextResponse(`Upstream error: ${upstream.status}`, { status: upstream.status });
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const contentLength = upstream.headers.get('content-length');
    const lastModified = upstream.headers.get('last-modified');

    const responseHeaders = {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*'
    };
    if (contentLength) responseHeaders['Content-Length'] = contentLength;
    if (lastModified) responseHeaders['Last-Modified'] = lastModified;

    return new NextResponse(upstream.body, { status: 200, headers: responseHeaders });

  } catch (err) {
    console.error('[Media Proxy] Error:', err.message);
    return new NextResponse('Proxy error: ' + err.message, { status: 500 });
  }
}
