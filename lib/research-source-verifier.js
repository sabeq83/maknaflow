import dns from 'dns/promises';
import net from 'net';
import crypto from 'crypto';

/**
 * Check if an IP address belongs to private, loopback, link-local, or cloud metadata ranges.
 */
export function isPrivateOrReservedIp(ip) {
  if (!ip) return true;

  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4) return true;

    // Loopback 127.0.0.0/8
    if (parts[0] === 127) return true;
    // Private 10.0.0.0/8
    if (parts[0] === 10) return true;
    // Private 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // Private 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;
    // Link-local / AWS metadata 169.254.0.0/16
    if (parts[0] === 169 && parts[1] === 254) return true;
    // Shared / Carrier-grade NAT / Tailscale 100.64.0.0/10 (100.64.0.0 - 100.127.255.255)
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    // 0.0.0.0/8
    if (parts[0] === 0) return true;
    // Broadcast 255.255.255.255
    if (parts[0] === 255) return true;
    // Multicast 224.0.0.0/4
    if (parts[0] >= 224) return true;

    return false;
  }

  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    // Loopback ::1
    if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;
    // Link-local fe80::/10
    if (normalized.startsWith('fe80:')) return true;
    // Unique local fc00::/7 (fc00:: - fdff::)
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;

    return false;
  }

  return true;
}

/**
 * Determine authority class based on domain reputation.
 */
export function classifyDomainAuthority(hostname) {
  const host = String(hostname || '').toLowerCase();

  const primaryAuthorities = [
    '.gov', '.edu', '.ac.id', '.go.id', 'who.int', 'nih.gov', 'cdc.gov',
    'journal', 'sciencedirect.com', 'nature.com', 'ncbi.nlm.nih.gov'
  ];

  for (const pa of primaryAuthorities) {
    if (host.includes(pa)) return 'primary';
  }

  const reputableAuthorities = [
    'kompas.com', 'detik.com', 'tempo.co', 'antaranews.com', 'republika.co.id',
    'theguardian.com', 'bbc.com', 'reuters.com', 'bloomberg.com', 'forbes.com',
    'healthline.com', 'medicalnewstoday.com', 'webmd.com', 'halodoc.com', 'alodokter.com'
  ];

  for (const ra of reputableAuthorities) {
    if (host.includes(ra)) return 'reputable_secondary';
  }

  return 'unknown';
}

/**
 * Verify research source URL with SSRF protection, timeout, and response limits.
 */
export async function verifyResearchSource(sourceUrl, policy = {}) {
  const verifiedAt = new Date().toISOString();
  if (!sourceUrl || typeof sourceUrl !== 'string') {
    return {
      verification_status: 'rejected',
      verified_at: verifiedAt,
      error: 'URL tidak valid'
    };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(sourceUrl);
  } catch (_) {
    return {
      verification_status: 'rejected',
      verified_at: verifiedAt,
      error: 'Format URL tidak valid'
    };
  }

  if (parsedUrl.protocol !== 'https:') {
    return {
      verification_status: 'rejected',
      verified_at: verifiedAt,
      error: 'Protokol non-HTTPS tidak diizinkan'
    };
  }

  const hostname = parsedUrl.hostname;
  if (!hostname || hostname === 'localhost') {
    return {
      verification_status: 'rejected',
      verified_at: verifiedAt,
      error: 'Hostname tidak diizinkan'
    };
  }

  // SSRF Protection: Resolve DNS and check against private/reserved ranges
  try {
    const lookupResult = await dns.lookup(hostname, { all: true });
    for (const entry of lookupResult) {
      if (isPrivateOrReservedIp(entry.address)) {
        return {
          verification_status: 'rejected',
          verified_at: verifiedAt,
          error: `IP address (${entry.address}) berada dalam rentang private/reserved yang dilarang.`
        };
      }
    }
  } catch (dnsErr) {
    return {
      verification_status: 'unreachable',
      verified_at: verifiedAt,
      error: `DNS resolution gagal: ${dnsErr.message}`
    };
  }

  const authorityClass = classifyDomainAuthority(hostname);
  const timeoutMs = Number(policy.timeoutMs || 5000);

  // Perform bounded HTTP HEAD / GET
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(sourceUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'MAKNA-Research-Verifier/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8'
      },
      signal: controller.signal,
      redirect: 'follow'
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type') || 'text/html';
    const httpStatus = response.status;
    const finalUrl = response.url;

    if (!response.ok) {
      return {
        verification_status: 'unreachable',
        verified_at: verifiedAt,
        http_status: httpStatus,
        authority_class: authorityClass,
        final_url: finalUrl,
        error: `HTTP error status ${httpStatus}`
      };
    }

    // Read only first 64KB for fingerprinting
    const reader = response.body.getReader();
    let receivedBytes = 0;
    const chunks = [];
    const maxBytes = 64 * 1024;

    while (receivedBytes < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      receivedBytes += value.length;
    }
    controller.abort(); // abort remaining stream

    const buffer = Buffer.concat(chunks);
    const contentFingerprint = crypto.createHash('sha256').update(buffer).digest('hex');

    return {
      verification_status: 'verified',
      verified_at: verifiedAt,
      http_status: httpStatus,
      content_type: contentType,
      authority_class: authorityClass,
      final_url: finalUrl,
      content_fingerprint: contentFingerprint
    };
  } catch (fetchErr) {
    return {
      verification_status: 'unreachable',
      verified_at: verifiedAt,
      authority_class: authorityClass,
      error: fetchErr.name === 'AbortError' ? 'Verification timed out' : fetchErr.message
    };
  }
}
