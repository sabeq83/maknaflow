/**
 * app/api/v2/youtube-studio/knowledge-bases/[id]/route.js
 * GET   — get KB document with revisions
 * PATCH — update/refine KB (creates new revision draft)
 */

import { NextResponse } from 'next/server';
import { withYouTubeStudioAccess } from '@/lib/auth';
import {
  getKnowledgeBase,
  getKbRevisions,
  updateKnowledgeBaseDraft,
} from '@/lib/youtube-studio-kb-repository';
import { refineKnowledgeBaseDraft } from '@/lib/youtube-studio-kb-ai';

export const dynamic = 'force-dynamic';

export const GET = withYouTubeStudioAccess('read', async (request, ctx, user) => {
  const { id } = await ctx.params;
  const kb = await getKnowledgeBase(id);
  if (!kb) return NextResponse.json({ success: false, error: 'KB not found' }, { status: 404 });
  const revisions = await getKbRevisions(id);
  return NextResponse.json({ success: true, kb, revisions });
});

export const PATCH = withYouTubeStudioAccess('write', async (request, ctx, user) => {
  const { id } = await ctx.params;
  const body = await request.json();
  const { title, content, instruction, locale, aiRefine } = body;

  let resolvedContent = content;

  if (aiRefine) {
    if (!instruction) {
      return NextResponse.json({ success: false, error: 'instruction is required for AI refinement' }, { status: 400 });
    }
    const kb = await getKnowledgeBase(id);
    if (!kb) return NextResponse.json({ success: false, error: 'KB not found' }, { status: 404 });
    const revisions = await getKbRevisions(id);
    const latest = revisions[0];
    const refined = await refineKnowledgeBaseDraft({
      kbType: kb.kb_type,
      currentContent: latest?.content_json || {},
      instruction,
      locale: locale || 'id-ID',
    });
    resolvedContent = refined.content;
  }

  const revision = await updateKnowledgeBaseDraft({
    kbId: id, title, content: resolvedContent, actor: { username: user?.username || 'system' },
  });
  return NextResponse.json({ success: true, revision });
});
