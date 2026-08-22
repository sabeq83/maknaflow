/**
 * app/api/v2/youtube-studio/knowledge-bases/route.js
 * GET  — list KB documents (filterable by scope/scopeId/kbType/status)
 * POST — create new KB draft (manual or AI-assisted)
 */

import { NextResponse } from 'next/server';
import { withYouTubeStudioAccess } from '@/lib/auth';
import {
  listKnowledgeBases,
  createKnowledgeBaseDraft,
} from '@/lib/youtube-studio-kb-repository';
import { generateKnowledgeBaseDraft } from '@/lib/youtube-studio-kb-ai';

export const dynamic = 'force-dynamic';

export const GET = withYouTubeStudioAccess('read', async (request, _ctx, user) => {
  const { searchParams } = new URL(request.url);
  const scope   = searchParams.get('scope')   || undefined;
  const scopeId = searchParams.get('scopeId') || undefined;
  const kbType  = searchParams.get('kbType')  || undefined;
  const status  = searchParams.get('status')  || undefined;

  const items = await listKnowledgeBases({ scope, scopeId, kbType, status });
  return NextResponse.json({ success: true, items });
});

export const POST = withYouTubeStudioAccess('write', async (request, _ctx, user) => {
  const body = await request.json();
  const { kbType, scope, scopeId, title, content, brief, locale, aiAssisted } = body;

  if (!kbType || !scope || !scopeId || !title) {
    return NextResponse.json({ success: false, error: 'kbType, scope, scopeId, and title are required' }, { status: 400 });
  }

  let resolvedContent = content;

  if (aiAssisted) {
    if (!brief) {
      return NextResponse.json({ success: false, error: 'brief is required for AI-assisted draft' }, { status: 400 });
    }
    const aiDraft = await generateKnowledgeBaseDraft({ kbType, scope, brief, locale: locale || 'id-ID' });
    resolvedContent = aiDraft.content;
  }

  if (!resolvedContent) {
    return NextResponse.json({ success: false, error: 'content or brief is required' }, { status: 400 });
  }

  const result = await createKnowledgeBaseDraft({
    kbType, scope, scopeId, title, content: resolvedContent,
    actor: { username: user?.username || 'system' },
  });

  return NextResponse.json({ success: true, ...result });
});
