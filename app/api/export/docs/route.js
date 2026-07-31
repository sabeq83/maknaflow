import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthorizedClient } from '@/lib/google-auth';
import { getReverseResult, getAsset, getIdea } from '@/lib/db';

export async function POST(request) {
  try {
    const { id, source } = await request.json();
    if (!id) return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });

    const auth = getAuthorizedClient();
    const docs = google.docs({ version: 'v1', auth });

    // Fetch data
    let result;
    if (source === 'ideation') {
      const idea = await getIdea(id);
      if (!idea) return NextResponse.json({ success: false, error: 'Idea not found' }, { status: 404 });

      const { getIdeasByProduct } = await import('@/lib/db');
      let ideas;
      try { ideas = await getIdeasByProduct(idea.product_name); } catch { ideas = [idea]; }

      const title = `MAKNA Ideation — ${idea.product_name || 'Export'} — ${new Date().toLocaleDateString('id-ID')}`;
      const doc = await docs.documents.create({ requestBody: { title } });
      const documentId = doc.data.documentId;
      const requests = [];
      let idx = 1;
      function insertText(text, bold = false, fontSize = 11) {
        if (!text) return;
        requests.push({ insertText: { location: { index: idx }, text } });
        const end = idx + text.length;
        requests.push({ updateTextStyle: { range: { startIndex: idx, endIndex: end }, textStyle: { bold, fontSize: { magnitude: fontSize, unit: 'PT' } }, fields: 'bold,fontSize' } });
        idx = end;
      }
      function insertNewline() { requests.push({ insertText: { location: { index: idx }, text: '\n' } }); idx += 1; }

      insertText(`Content Ideation — ${idea.product_name || ''}`, true, 18); insertNewline();
      insertText(`Total: ${ideas.length} ide | Tanggal: ${new Date().toISOString()}`, false, 9); insertNewline(); insertNewline();

      ideas.forEach((ide, i) => {
        insertText(`Ide ${i + 1}: ${ide.topik || ''}`, true, 13); insertNewline();
        insertText(`CEP Context: ${ide.konteks_cep || ''}`, false, 10); insertNewline();
        insertText(`VFO: ${ide.vfo || ''}`, false, 10); insertNewline();
        insertText(`Key Messages: ${ide.key_messages || ''}`, false, 10); insertNewline();
        insertText(`Narrative: ${ide.narrative_mode || ''} | Visual: ${ide.visual_style || ''} | AI: ${ide.target_ai || ''}`, false, 9); insertNewline();
        insertNewline();
      });

      if (requests.length > 0) {
        await docs.documents.batchUpdate({ documentId, requestBody: { requests } });
      }
      const url = `https://docs.google.com/document/d/${documentId}`;
      return NextResponse.json({ success: true, data: { documentId, url } });

    } else if (source === 'production') {
      const asset = await getAsset(id);
      if (!asset) return NextResponse.json({ success: false, error: 'Asset not found' }, { status: 404 });
      const idea = asset.idea_id ? await getIdea(asset.idea_id) : null;
      const storyboard = JSON.parse(asset.storyboard || '[]');
      result = {
        ...asset,
        storyboard,
        voiceover: storyboard.map((s, i) => ({
          scene: s.scene || i + 1,
          narration: s.narration || '',
          duration: s.duration || '',
        })),
        t2i_prompts: JSON.parse(asset.t2i_prompts || '[]'),
        i2v_prompts: JSON.parse(asset.i2v_prompts || '[]'),
        product_name: idea?.product_name || 'Production Asset',
        source_type: 'production',
      };
    } else {
      result = await getReverseResult(id);
      if (!result) return NextResponse.json({ success: false, error: 'Result not found' }, { status: 404 });
      result.storyboard = JSON.parse(result.storyboard || '[]');
      result.voiceover = JSON.parse(result.voiceover || '[]');
      result.t2v_prompts = JSON.parse(result.t2v_prompts || '[]');
    }

    const title = `MAKNA — ${result.video_filename || result.product_name || 'Export'} — ${new Date().toLocaleDateString('id-ID')}`;

    // Create document
    const doc = await docs.documents.create({ requestBody: { title } });
    const documentId = doc.data.documentId;

    // Build content requests
    const requests = [];
    let idx = 1; // Current insertion index

    function insertText(text, bold = false, fontSize = 11) {
      if (!text) return;
      requests.push({ insertText: { location: { index: idx }, text } });
      const end = idx + text.length;
      requests.push({
        updateTextStyle: {
          range: { startIndex: idx, endIndex: end },
          textStyle: { bold, fontSize: { magnitude: fontSize, unit: 'PT' } },
          fields: 'bold,fontSize',
        },
      });
      idx = end;
    }

    function insertNewline() {
      requests.push({ insertText: { location: { index: idx }, text: '\n' } });
      idx += 1;
    }

    // Title
    insertText(result.video_filename || result.product_name || 'Export Result', true, 18);
    insertNewline();
    insertText(`Source: ${result.source_type || source} | Tanggal: ${result.tanggal_dibuat || new Date().toISOString()}`, false, 9);
    insertNewline();
    insertNewline();

    // Storyboard
    insertText('📋 STORYBOARD', true, 14);
    insertNewline();
    insertNewline();
    (result.storyboard || []).forEach((s, i) => {
      insertText(`Scene ${s.scene || i + 1} — ${s.duration || ''}`, true, 12);
      insertNewline();
      insertText(`Visual: ${s.visual_description || ''}`, false, 10);
      insertNewline();
      insertText(`Camera: ${s.camera_movement || ''} | Audio: ${s.audio_mood || ''}`, false, 9);
      insertNewline();
      insertNewline();
    });

    // Voiceover
    insertText('🎙 VOICEOVER SCRIPT', true, 14);
    insertNewline();
    insertNewline();
    (result.voiceover || []).forEach((v, i) => {
      insertText(`Scene ${v.scene || i + 1} (${v.duration || ''})`, true, 11);
      insertNewline();
      insertText(v.narration || '—', false, 10);
      insertNewline();
      insertNewline();
    });

    // Prompts
    const promptKey = result.t2v_prompts?.length ? 't2v_prompts' : 't2i_prompts';
    const promptLabel = promptKey === 't2v_prompts' ? 'T2V' : 'T2I';
    insertText(`🎬 ${promptLabel} PROMPTS`, true, 14);
    insertNewline();
    insertNewline();
    (result[promptKey] || []).forEach((p, i) => {
      insertText(`Scene ${p.scene || i + 1}`, true, 11);
      insertNewline();
      insertText(p.prompt || '', false, 10);
      insertNewline();
      if (p.motion_type || p.camera_movement || p.style) {
        insertText(`Motion: ${p.motion_type || ''} | Camera: ${p.camera_movement || ''} | Style: ${p.style || ''}`, false, 8);
        insertNewline();
      }
      if (p.negative_prompt) {
        insertText(`Negative: ${p.negative_prompt}`, false, 8);
        insertNewline();
      }
      insertNewline();
    });

    // I2V
    if (result.i2v_prompts?.length) {
      insertText('🎥 I2V PROMPTS', true, 14);
      insertNewline();
      insertNewline();
      result.i2v_prompts.forEach((p, i) => {
        insertText(`Scene ${p.scene || i + 1}`, true, 11);
        insertNewline();
        insertText(p.prompt || '', false, 10);
        insertNewline();
        insertNewline();
      });
    }

    // Captions
    insertText('📝 CAPTIONS', true, 14);
    insertNewline();
    insertNewline();
    const caps = [
      { label: '🎵 TikTok', value: result.tiktok_caption },
      { label: '📸 Instagram', value: result.ig_caption },
      { label: '🎬 YouTube Title', value: result.yt_title },
      { label: '📺 YouTube Description', value: result.yt_desc },
    ];
    caps.forEach(cap => {
      insertText(cap.label, true, 11);
      insertNewline();
      insertText(cap.value || '—', false, 10);
      insertNewline();
      insertNewline();
    });

    // Execute all requests
    if (requests.length > 0) {
      await docs.documents.batchUpdate({
        documentId,
        requestBody: { requests },
      });
    }

    const url = `https://docs.google.com/document/d/${documentId}`;
    return NextResponse.json({ success: true, data: { documentId, url } });
  } catch (error) {
    console.error('Docs export error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
