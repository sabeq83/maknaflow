import { NextResponse } from 'next/server';
import { getDb, listSystemAuditLogs } from '@/lib/db';
import { getGoogleStatus } from '@/lib/google-auth';

export async function GET() {
  try {
    const db = getDb();

    // 1. Google OAuth Status
    const google = getGoogleStatus();

    // 2. Gemini Keys Status
    let keys = [];
    try {
      keys = await db.prepare('SELECT id, key_name, is_active, tier FROM gemini_api_keys').all();
    } catch (_) {}

    // 3. Queue Tasks Status
    let queueStats = [];
    try {
      queueStats = await db.prepare(`
        SELECT status, COUNT(*) as count 
        FROM scheduler_jobs 
        GROUP BY status
      `).all();
    } catch (_) {}

    // 4. Campaign Items pending counts
    let pendingOpc = 0;
    try {
      pendingOpc = await db.prepare(`
        SELECT COUNT(*) as count 
        FROM pillar_campaign_items 
        WHERE generation_status IN ('pending', 'pending_sourcing', 'processing')
      `).get()?.count || 0;
    } catch (_) {}

    let pendingRe = 0;
    try {
      pendingRe = await db.prepare(`
        SELECT COUNT(*) as count 
        FROM re_campaign_items 
        WHERE analyze_status IN ('pending', 'processing')
      `).get()?.count || 0;
    } catch (_) {}

    // 5. System Audit Logs (Unresolved)
    const logs = await listSystemAuditLogs(false);

    return NextResponse.json({
      success: true,
      data: {
        google,
        gemini: {
          total: keys.length,
          active: keys.filter(k => k.is_active === 1).length,
          inactive: keys.filter(k => k.is_active === 0).length,
          keys: keys.map(k => ({ id: k.id, name: k.key_name, active: k.is_active === 1, tier: k.tier }))
        },
        queue: {
          stats: queueStats.reduce((acc, curr) => {
            acc[curr.status] = curr.count;
            return acc;
          }, { pending: 0, processing: 0, completed: 0, failed: 0 }),
          pendingOpc,
          pendingRe
        },
        logs
      }
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
