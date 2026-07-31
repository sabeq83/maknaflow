import { NextResponse } from 'next/server';
import { getCDPEndpoint } from '@/lib/cdp-helper';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { chromium } = await import('playwright');
    const endpoint = await getCDPEndpoint();
    console.log(`[API Test CDP] Attempting connection to ${endpoint}...`);
    const browser = await chromium.connectOverCDP(endpoint);
    
    const contexts = browser.contexts();
    const isConnected = contexts.length > 0;
    
    if (isConnected) {
      return NextResponse.json({
        success: true,
        message: 'Koneksi ke Google Chrome berhasil terhubung!'
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Google Chrome terhubung, tetapi tidak ada profil aktif yang terdeteksi.'
      });
    }
  } catch (err) {
    console.error('[API Test CDP] Connection check failed:', err.message);
    return NextResponse.json({
      success: false,
      error: `Gagal terhubung ke port 9222: ${err.message}. Pastikan Chrome terbuka dengan flag debugging.`
    });
  }
}
