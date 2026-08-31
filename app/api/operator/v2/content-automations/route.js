import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { authenticateOperator, runAsOperatorTenant } from '@/lib/operator-auth';
import { normalizeContentAutomation } from '@/lib/content-automation-contract';
import { prepareProductCampaignSchedule } from '@/lib/content-automation-binding-service';
import { assertProductCampaignEnabled } from '@/lib/content-automation-feature-flags';
import { createAutomationIdempotent } from '@/lib/content-automation-repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const identity = await authenticateOperator(request, 'automation:write');
    const idempotencyKey = String(request.headers.get('idempotency-key') || '').trim();
    if (!idempotencyKey || idempotencyKey.length > 200) {
      return NextResponse.json({ success: false, code: 'IDEMPOTENCY_KEY_REQUIRED', error: 'Idempotency-Key wajib diisi.' }, { status: 400 });
    }
    const body = await request.json();
    const bodyHash = crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
    const result = await runAsOperatorTenant(identity, async () => {
      if (body.campaign_kind === 'product_campaign') await assertProductCampaignEnabled({ tenantId: identity.tenantId });
      const prepared = body.campaign_kind === 'product_campaign'
        ? await prepareProductCampaignSchedule(body)
        : { body };
      const data = normalizeContentAutomation(prepared.body);
      if (data.publishing_policy.mode === 'auto_publish') {
        const error = new Error('auto_publish belum diizinkan melalui Hermes. Gunakan approval_required atau draft_only.');
        error.code = 'HERMES_AUTO_PUBLISH_DISABLED'; error.status = 403; throw error;
      }
      const created = await createAutomationIdempotent(data, identity.actor, idempotencyKey, bodyHash);
      return created;
    });
    return NextResponse.json({ success: true, schedule: result.schedule, replayed: result.replayed }, {
      status: result.replayed ? 200 : 201,
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (error) {
    return NextResponse.json({ success: false, code: error.code, error: error.status && error.status < 500 ? error.message : 'Gagal membuat automation.' }, { status: error.status || 500 });
  }
}
