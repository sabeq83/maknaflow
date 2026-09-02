import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getDb, updatePillarCampaignItem } from '@/lib/db';
import { queueSingleStartFrameRevision } from '@/lib/pillar-start-frame-service';
import { buildOpcStartFrameRequest } from '@/lib/opc-start-frame-request';
import { withTenantContext } from '@/lib/auth';

export const POST = withTenantContext(async (req, { params }) => {
  try {
    const resolvedParams = await params;
    const itemId = resolvedParams.itemId;
    const body = await req.json().catch(() => ({}));
    const { clipIndex, t2i_prompt } = body;

    if (!itemId || !clipIndex || !t2i_prompt) {
      return NextResponse.json(
        { success: false, error: "itemId, clipIndex, and t2i_prompt are required" },
        { status: 400 }
      );
    }

    const db = getDb();
    const item = await db.prepare("SELECT * FROM pillar_campaign_items WHERE id = ?").get(itemId);
    if (!item) {
      return NextResponse.json({ success: false, error: "Campaign item not found" }, { status: 404 });
    }

    const campaign = await db.prepare("SELECT * FROM pillar_campaigns WHERE id = ?").get(item.campaign_id);
    if (!campaign) {
      return NextResponse.json({ success: false, error: "Campaign not found" }, { status: 404 });
    }

    // 1. Update t2i_prompt inside new_video_plan_json
    let newVideoPlan = [];
    try {
      newVideoPlan = JSON.parse(item.new_video_plan_json || '[]');
    } catch {}

    const clipObj = newVideoPlan.find(p => Number(p.clip_index) === Number(clipIndex));
    if (clipObj) {
      clipObj.t2i_prompt = t2i_prompt;
    }

    // 2. Also map to result_json (for backward compatibility)
    let oldParsed = {};
    try {
      oldParsed = JSON.parse(item.result_json || '{}');
    } catch {}
    const t2i_prompts = (oldParsed.t2i_prompts || []).map(p => {
      if (Number(p.clip) === Number(clipIndex)) {
        return { ...p, prompt: t2i_prompt };
      }
      return p;
    });
    const updatedResultJson = JSON.stringify({ ...oldParsed, t2i_prompts });

    await updatePillarCampaignItem(item.id, {
      new_video_plan_json: JSON.stringify(newVideoPlan),
      result_json: updatedResultJson
    });

    const rowPayload = item.row_creative_payload ? JSON.parse(item.row_creative_payload) : {};

    // Resolve characters for this clip if cartoon universe
    const parsed = JSON.parse(item.result_json || '{}');
    const storyboardObj = (parsed.storyboard || []).find(s => Number(s.scene) === Number(clipIndex) || Number(s.clip) === Number(clipIndex));
    let clipCharacters = [];
    if (storyboardObj && Array.isArray(storyboardObj.characters)) {
      clipCharacters = storyboardObj.characters;
    } else {
      if (rowPayload.main_character) {
        const clean = rowPayload.main_character.trim().toLowerCase();
        if (clean === 'mochi') clipCharacters.push('mochi');
        else if (clean === 'dr. paw' || clean === 'dr paw') clipCharacters.push('dr_paw');
        else if (clean === 'coco') clipCharacters.push('coco');
        else if (clean === 'boba') clipCharacters.push('boba');
        else if (clean === 'tofu') clipCharacters.push('tofu');
      }
      clipCharacters = Array.from(new Set(clipCharacters));
    }

    const { normalizeCharacterId } = await import('@/lib/universe-manifests');
    const { resolveClipReferenceImages } = await import('@/lib/cartoon-reference-resolver');
    const normalizedClipChars = clipCharacters.map(normalizeCharacterId).filter(Boolean);

    const isCartoon = rowPayload.content_world === 'cartoon_universe' || campaign.content_world === 'cartoon_universe';
    let contextReferences = [];
    if (isCartoon) {
      let universeSnapshot = null;
      try {
        universeSnapshot = campaign.universe_snapshot_json ? JSON.parse(campaign.universe_snapshot_json) : null;
      } catch (_) {}
      const resolvedRefs = resolveClipReferenceImages({
        contentWorld: 'cartoon_universe',
        universeProfile: campaign.universe_profile || rowPayload.universe_profile || 'pawville',
        universeSnapshot,
        clip: clipIndex,
        productReference: null,
        productRevealBeat: rowPayload.product_reveal_beat || campaign.product_reveal_beat || 'none',
        clipCharacters: normalizedClipChars
      });
      contextReferences = resolvedRefs.allReferences || [];
    }

    const context = {
      campaign,
      item: { ...item, new_video_plan_json: JSON.stringify(newVideoPlan), result_json: updatedResultJson },
      clipIndex: Number(clipIndex),
      prompt: t2i_prompt,
      origin: 'manual_regen',
      contextReferences
    };

    // Preflight request validation
    const builtRequest = await buildOpcStartFrameRequest(context);
    const idempotencyKey = req.headers.get('idempotency-key') || crypto.randomUUID();

    // Enqueue durable revision
    const queued = await queueSingleStartFrameRevision(
      itemId,
      {
        clip_index: Number(clipIndex),
        context,
        audit: builtRequest.audit
      },
      { idempotencyKey }
    );

    return NextResponse.json(
      {
        success: true,
        status: 'queued',
        assetId: queued.assetId,
        revision: queued.revision,
        referenceCritical: queued.referenceCritical,
        duplicate: queued.duplicate || false
      },
      { status: 202 }
    );
  } catch (error) {
    console.error('[OPC Single SF Regen API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    );
  }
});
