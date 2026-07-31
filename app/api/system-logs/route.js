import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { sanitizeLogContent } from '@/lib/log-sanitizer';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const isRaw = searchParams.get('raw') === 'true';

    if (!type) {
      return NextResponse.json({ error: 'Parameter type wajib diisi' }, { status: 400 });
    }

    const whitelist = {
      autopilot: 'autopilot_logs.txt',
      multiplier: 'multiplier_logs.txt',
      re: 're_campaign_logs.txt',
      opc: 'opc_logs.txt',
      strategic: 'strategic_campaign_logs.txt',
      instant: 'instant_factory_logs.txt',
      recipe: 'recipe_logs.txt',
      product_bulk: 'product_bulk_logs.txt',
      bridge_injector: 'bridge_injector_logs.txt'
    };

    const filename = whitelist[type];
    if (!filename) {
      return NextResponse.json({ error: 'Type tidak valid' }, { status: 400 });
    }

    const logPath = path.join(process.cwd(), 'public', filename);

    if (!fs.existsSync(logPath)) {
      return new NextResponse(`Belum ada log aktivitas untuk ${type}.`, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }

    const content = fs.readFileSync(logPath, 'utf8');
    const finalContent = isRaw ? content : sanitizeLogContent(content);

    return new NextResponse(finalContent, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
