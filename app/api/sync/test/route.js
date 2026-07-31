import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { cloud_hub_url, secret_cloud_token } = await request.json();
    
    if (!cloud_hub_url) {
      return NextResponse.json({ success: false, error: 'Hub URL wajib diisi.' }, { status: 400 });
    }

    const testUrl = `${cloud_hub_url.trim()}/api/sync/jobs`;
    const res = await fetch(testUrl, {
      headers: {
        'Authorization': `Bearer ${secret_cloud_token}`
      }
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({
        success: true,
        message: 'Koneksi ke MAKNA Cloud Hub berhasil!',
        jobsCount: data.jobs ? data.jobs.length : 0
      });
    } else {
      const text = await res.text();
      return NextResponse.json({
        success: false,
        error: `Koneksi gagal dengan status ${res.status}: ${text || res.statusText}`
      }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: `Gagal terhubung ke server Cloud Hub: ${error.message}`
    }, { status: 500 });
  }
}
