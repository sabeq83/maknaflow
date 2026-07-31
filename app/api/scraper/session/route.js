import { NextResponse } from 'next/server';
import { getSetting } from '@/lib/db';

export async function GET() {
  try {
    const profile = await getSetting('scraper_chrome_profile') || 'Default';

    return NextResponse.json({
      success: true,
      data: {
        shopee_connected: false,
        tokopedia_connected: false,
        scraper_headless_enabled: false,
        scraper_use_cdp: true,
        scraper_chrome_profile: profile
      }
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json({
    success: false,
    error: 'Metode ini telah didepresiasi. Silakan gunakan Koneksi CDP Google Chrome Asli.'
  }, { status: 400 });
}

export async function DELETE() {
  return NextResponse.json({
    success: false,
    error: 'Metode ini telah didepresiasi. Silakan gunakan Koneksi CDP Google Chrome Asli.'
  }, { status: 400 });
}
