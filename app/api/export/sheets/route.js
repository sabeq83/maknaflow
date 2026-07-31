import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthorizedClient } from '@/lib/google-auth';
import { getReverseResult, getAsset, getIdea } from '@/lib/db';

export async function POST(request) {
  try {
    const { id, source } = await request.json();
    if (!id) return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });

    // Get authorized client
    const auth = getAuthorizedClient();
    const sheets = google.sheets({ version: 'v4', auth });

    // Fetch data
    let result;
    if (source === 'ideation') {
      // Ideation export — get the idea and related ideas for same product
      const idea = await getIdea(id);
      if (!idea) return NextResponse.json({ success: false, error: 'Idea not found' }, { status: 404 });

      // Get all ideas with same product_name
      const { getIdeasByProduct } = await import('@/lib/db');
      let ideas;
      try { ideas = await getIdeasByProduct(idea.product_name); } catch { ideas = [idea]; }

      const title = `MAKNA Ideation — ${idea.product_name || 'Export'} — ${new Date().toLocaleDateString('id-ID')}`;
      const spreadsheet = await sheets.spreadsheets.create({
        requestBody: {
          properties: { title },
          sheets: [{ properties: { title: 'Ideas' } }, { properties: { title: 'Metadata' } }],
        },
      });
      const spreadsheetId = spreadsheet.data.spreadsheetId;
      const ideasData = [
        ['#', 'Topik', 'CEP Context', 'VFO', 'Key Messages', 'Narrative', 'Visual', 'AI', 'Klip', 'Status'],
        ...ideas.map((ide, i) => [i + 1, ide.topik || '', ide.konteks_cep || '', ide.vfo || '', ide.key_messages || '', ide.narrative_mode || '', ide.visual_style || '', ide.target_ai || '', ide.jumlah_klip || '', ide.status || 'Draft']),
      ];
      const metaData = [
        ['Field', 'Value'],
        ['Product', idea.product_name || ''],
        ['Total Ideas', ideas.length],
        ['Tanggal', new Date().toISOString()],
      ];
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: { valueInputOption: 'RAW', data: [
          { range: 'Ideas!A1', values: ideasData },
          { range: 'Metadata!A1', values: metaData },
        ]},
      });
      const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
      return NextResponse.json({ success: true, data: { spreadsheetId, url } });

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

    // Create spreadsheet
    const spreadsheet = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title },
        sheets: [
          { properties: { title: 'Storyboard' } },
          { properties: { title: 'Voiceover' } },
          { properties: { title: source === 'production' ? 'T2I Prompts' : 'T2V Prompts' } },
          ...(result.i2v_prompts?.length ? [{ properties: { title: 'I2V Prompts' } }] : []),
          { properties: { title: 'Captions' } },
          { properties: { title: 'Metadata' } },
        ],
      },
    });

    const spreadsheetId = spreadsheet.data.spreadsheetId;

    // Populate Storyboard
    const storyboardData = [
      ['Scene', 'Duration', 'Visual Description', 'Camera Movement', 'Audio Mood'],
      ...(result.storyboard || []).map((s, i) => [
        s.scene || i + 1, s.duration || '', s.visual_description || '', s.camera_movement || '', s.audio_mood || '',
      ]),
    ];

    // Populate Voiceover
    const voiceoverData = [
      ['Scene', 'Narration', 'Duration'],
      ...(result.voiceover || []).map((v, i) => [v.scene || i + 1, v.narration || '', v.duration || '']),
    ];

    // Populate Prompts
    const promptKey = result.t2v_prompts?.length ? 't2v_prompts' : 't2i_prompts';
    const promptSheetName = source === 'production' ? 'T2I Prompts' : 'T2V Prompts';
    const hasExtra = (result[promptKey] || []).some(p => p.motion_type || p.camera_movement || p.style);
    const promptHeaders = hasExtra
      ? ['Scene', 'Prompt', 'Motion Type', 'Camera', 'Style', 'Duration', 'Negative Prompt']
      : ['Scene', 'Prompt'];
    const promptData = [
      promptHeaders,
      ...(result[promptKey] || []).map((p, i) => hasExtra
        ? [p.scene || i + 1, p.prompt || '', p.motion_type || '', p.camera_movement || '', p.style || '', p.duration || '', p.negative_prompt || '']
        : [p.scene || i + 1, p.prompt || '']
      ),
    ];

    // Populate Captions
    const captionsData = [
      ['Platform', 'Content'],
      ['TikTok', result.tiktok_caption || ''],
      ['Instagram', result.ig_caption || ''],
      ['YouTube Title', result.yt_title || ''],
      ['YouTube Description', result.yt_desc || ''],
    ];

    // Populate Metadata
    const metaData = [
      ['Field', 'Value'],
      ['Source', result.source_type || source],
      ['Filename', result.video_filename || result.product_name || ''],
      ['URL', result.source_url || ''],
      ['Custom Instruction', result.custom_instruction || ''],
      ['Output Format', result.prompt_output_format || ''],
      ['Tanggal', result.tanggal_dibuat || ''],
    ];

    // Batch update all sheets
    const batchData = [
      { range: 'Storyboard!A1', values: storyboardData },
      { range: 'Voiceover!A1', values: voiceoverData },
      { range: `'${promptSheetName}'!A1`, values: promptData },
      { range: 'Captions!A1', values: captionsData },
      { range: 'Metadata!A1', values: metaData },
    ];

    // Add I2V if exists
    if (result.i2v_prompts?.length) {
      batchData.push({
        range: 'I2V Prompts!A1',
        values: [
          ['Scene', 'Prompt'],
          ...result.i2v_prompts.map((p, i) => [p.scene || i + 1, p.prompt || '']),
        ],
      });
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: batchData,
      },
    });

    // Bold headers + auto-resize
    const sheetIds = spreadsheet.data.sheets.map(s => s.properties.sheetId);
    const formatRequests = sheetIds.map(sheetId => ({
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true },
            backgroundColor: { red: 0.9, green: 0.9, blue: 0.95 },
          },
        },
        fields: 'userEnteredFormat(textFormat,backgroundColor)',
      },
    }));

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: formatRequests },
    });

    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
    return NextResponse.json({ success: true, data: { spreadsheetId, url } });
  } catch (error) {
    console.error('Sheets export error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
