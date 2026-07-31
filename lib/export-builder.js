import * as XLSX from 'xlsx';

/**
 * Build Excel workbook buffer from reverse engineering result
 */
export function buildExcelBuffer(result) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Storyboard
  const storyboard = (result.storyboard || []).map((s, i) => ({
    'Scene': s.scene || i + 1,
    'Duration': s.duration || '',
    'Visual Description': s.visual_description || '',
    'Camera Movement': s.camera_movement || '',
    'Audio Mood': s.audio_mood || '',
  }));
  const ws1 = XLSX.utils.json_to_sheet(storyboard);
  ws1['!cols'] = [{ wch: 6 }, { wch: 10 }, { wch: 80 }, { wch: 25 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Storyboard');

  // Sheet 2: Voiceover
  const voiceover = (result.voiceover || []).map((v, i) => ({
    'Scene': v.scene || i + 1,
    'Narration': v.narration || '',
    'Duration': v.duration || '',
  }));
  const ws2 = XLSX.utils.json_to_sheet(voiceover);
  ws2['!cols'] = [{ wch: 6 }, { wch: 100 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Voiceover');

  // Sheet 3: T2V Prompts
  if (result.t2v_prompts && result.t2v_prompts.length > 0) {
    const prompts = result.t2v_prompts.map((p, i) => {
      const row = {
        'Scene': p.scene || i + 1,
        'Prompt': p.prompt || '',
      };
      if (p.motion_type) row['Motion Type'] = p.motion_type;
      if (p.camera_movement) row['Camera'] = p.camera_movement;
      if (p.style) row['Style'] = p.style;
      if (p.duration) row['Duration'] = p.duration;
      if (p.negative_prompt) row['Negative Prompt'] = p.negative_prompt;
      return row;
    });
    const ws3 = XLSX.utils.json_to_sheet(prompts);
    ws3['!cols'] = [{ wch: 6 }, { wch: 100 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws3, 'T2V Prompts');
  }

  // Sheet for T2I Prompts
  if (result.t2i_prompts && result.t2i_prompts.length > 0) {
    const prompts = result.t2i_prompts.map((p, i) => {
      const row = {
        'Scene': p.scene || i + 1,
        'Prompt': p.prompt || '',
      };
      if (p.motion_type) row['Motion Type'] = p.motion_type;
      if (p.camera_movement) row['Camera'] = p.camera_movement;
      if (p.style) row['Style'] = p.style;
      if (p.duration) row['Duration'] = p.duration;
      if (p.negative_prompt) row['Negative Prompt'] = p.negative_prompt;
      return row;
    });
    const wsT2i = XLSX.utils.json_to_sheet(prompts);
    wsT2i['!cols'] = [{ wch: 6 }, { wch: 100 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, wsT2i, 'T2I Prompts');
  }

  // Sheet for I2V Prompts
  if (result.i2v_prompts && result.i2v_prompts.length > 0) {
    const i2v = result.i2v_prompts.map((p, i) => ({
      'Scene': p.scene || i + 1,
      'Prompt': p.prompt || '',
    }));
    const wsI2v = XLSX.utils.json_to_sheet(i2v);
    wsI2v['!cols'] = [{ wch: 6 }, { wch: 100 }];
    XLSX.utils.book_append_sheet(wb, wsI2v, 'I2V Prompts');
  }

  // Sheet 4: Captions
  const captions = [
    { 'Platform': 'TikTok', 'Caption': result.tiktok_caption || '' },
    { 'Platform': 'Instagram', 'Caption': result.ig_caption || '' },
    { 'Platform': 'YouTube Title', 'Caption': result.yt_title || '' },
    { 'Platform': 'YouTube Description', 'Caption': result.yt_desc || '' },
  ];
  const ws4 = XLSX.utils.json_to_sheet(captions);
  ws4['!cols'] = [{ wch: 20 }, { wch: 120 }];
  XLSX.utils.book_append_sheet(wb, ws4, 'Captions');

  // Sheet 5: Metadata
  const meta = [
    { 'Field': 'Source', 'Value': result.source_type || 'production' },
    { 'Field': 'Filename', 'Value': result.video_filename || result.product_name || '' },
    { 'Field': 'URL', 'Value': result.source_url || '' },
    { 'Field': 'Custom Instruction', 'Value': result.custom_instruction || '' },
    { 'Field': 'Output Format', 'Value': result.prompt_output_format || '' },
    { 'Field': 'Tanggal', 'Value': result.tanggal_dibuat || '' },
  ];
  const ws5 = XLSX.utils.json_to_sheet(meta);
  ws5['!cols'] = [{ wch: 20 }, { wch: 100 }];
  XLSX.utils.book_append_sheet(wb, ws5, 'Metadata');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Build Markdown string from reverse engineering result
 */
export function buildMarkdownContent(result, batchId) {
  const lines = [];

  // Header
  lines.push(`# ${batchId || 'Export Result'}`);
  lines.push('');
  lines.push(`**Batch ID:** ${batchId || '-'}`);
  lines.push(`**Source URL:** ${result.source_url || '-'}`);
  lines.push(`**Tanggal Proses:** ${result.tanggal_dibuat || new Date().toISOString()}`);
  if (result.custom_instruction) lines.push(`**Custom Instruction:** ${result.custom_instruction}`);
  lines.push('');

  // Storyboard
  lines.push('---');
  lines.push('## 📋 Storyboard');
  lines.push('');
  (result.storyboard || []).forEach((s, i) => {
    lines.push(`### Scene ${s.scene || i + 1} — ${s.duration || ''}`);
    lines.push(`**Visual:** ${s.visual_description || ''}`);
    lines.push(`**Camera:** ${s.camera_movement || ''}`);
    lines.push(`**Audio Mood:** ${s.audio_mood || ''}`);
    lines.push('');
  });

  // Voiceover
  lines.push('---');
  lines.push('## 🎙 Voiceover Script');
  lines.push('');
  const voList = result.voiceover || [];
  voList.forEach((v, i) => {
    lines.push(`### Scene ${v.scene || i + 1} (${v.duration || ''})`);
    lines.push(`> ${v.narration || ''}`);
    if (i === voList.length - 1) {
      if (v.cta_facebook) {
        lines.push(`- **CTA Facebook**: *"${v.cta_facebook}"*`);
      }
      if (v.cta_tiktok) {
        lines.push(`- **CTA TikTok**: *"${v.cta_tiktok}"*`);
      }
    }
    lines.push('');
  });

  // T2V Prompts
  if (result.t2v_prompts && result.t2v_prompts.length > 0) {
    lines.push('---');
    lines.push('## 🤖 T2V Prompts');
    lines.push('');
    result.t2v_prompts.forEach((p, i) => {
      lines.push(`### Scene ${p.scene || i + 1}`);
      lines.push('```');
      lines.push(p.prompt || '');
      lines.push('```');
      if (p.motion_type) lines.push(`- **Motion:** ${p.motion_type}`);
      if (p.camera_movement) lines.push(`- **Camera:** ${p.camera_movement}`);
      if (p.style) lines.push(`- **Style:** ${p.style}`);
      if (p.negative_prompt) lines.push(`- **Negative:** ${p.negative_prompt}`);
      lines.push('');
    });
  }

  // T2I Prompts
  if (result.t2i_prompts && result.t2i_prompts.length > 0) {
    lines.push('---');
    lines.push('## 📸 T2I Prompts');
    lines.push('');
    result.t2i_prompts.forEach((p, i) => {
      lines.push(`### Scene ${p.scene || i + 1}`);
      lines.push('```');
      lines.push(p.prompt || '');
      lines.push('```');
      if (p.motion_type) lines.push(`- **Motion:** ${p.motion_type}`);
      if (p.camera_movement) lines.push(`- **Camera:** ${p.camera_movement}`);
      if (p.style) lines.push(`- **Style:** ${p.style}`);
      if (p.negative_prompt) lines.push(`- **Negative:** ${p.negative_prompt}`);
      lines.push('');
    });
  }

  // I2V Prompts
  if (result.i2v_prompts && result.i2v_prompts.length > 0) {
    lines.push('---');
    lines.push('## 🎥 I2V Prompts');
    lines.push('');
    result.i2v_prompts.forEach((p, i) => {
      lines.push(`### Scene ${p.scene || i + 1}`);
      lines.push('```');
      lines.push(p.prompt || '');
      lines.push('```');
      lines.push('');
    });
  }

  // Captions
  lines.push('---');
  lines.push('## 📝 Captions');
  lines.push('');
  if (result.tiktok_caption) {
    lines.push('### 🎵 TikTok');
    lines.push(result.tiktok_caption);
    lines.push('');
  }
  if (result.ig_caption) {
    lines.push('### 📸 Instagram');
    lines.push(result.ig_caption);
    lines.push('');
  }
  if (result.yt_title) {
    lines.push('### 🎬 YouTube Title');
    lines.push(result.yt_title);
    lines.push('');
  }
  if (result.yt_desc) {
    lines.push('### 📺 YouTube Description');
    lines.push(result.yt_desc);
    lines.push('');
  }

  return lines.join('\n');
}

// ========================
// Pipeline Sheet Builders
// ========================

/**
 * Generate a human-readable batch ID: B-YYYYMMDD-NNN
 * @param {string[]} existingBatchIds - existing IDs to determine next increment
 */
export function generateBatchId(existingBatchIds = []) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `B-${dateStr}-`;

  let maxNum = 0;
  existingBatchIds.forEach(id => {
    if (id && id.startsWith(prefix)) {
      const num = parseInt(id.slice(prefix.length), 10);
      if (num > maxNum) maxNum = num;
    }
  });

  const nextNum = String(maxNum + 1).padStart(3, '0');
  return `${prefix}${nextNum}`;
}

/**
 * Helper to remove newlines and return a single line string
 */
const singleLine = (str) => {
  if (!str) return '';
  return String(str).replace(/\r?\n|\r/g, ' ').trim();
};

/**
 * Pipeline Headers for Master Sheet tabs
 */
export const PIPELINE_HEADERS = {
  ideation: [
    'batch_id', 'product_name', 'product_description', 'target_audience', 'category_cep', 'cep',
    'sub_cep_matrix', 'vfo', 'key_message', 'scene_count', 'narrative_mode',
    'visual_style', 'words_per_clip', 'target_ai_engine', 'face_visibility',
    'aspect_ratio', 'custom_instruction', 'output_prompt_format', 'created_at',
    'review_status', 'review_notes', 'pipeline_status', 'sys_idea_id'
  ],
  production: [
    'idea_id', 'batch_id', 'scene_id', 'product_name', 'scene_number',
    'duration', 'narration', 'visual_description', 'camera_movement', 'audio_mood',
    't2i_prompt', 'i2v_prompt',
    'review_status', 'review_notes',
    'audio_status', 'audio_url', 'audio_duration',
    'image_status', 'image_url', 'image_model',
    'video_status', 'video_url', 'video_model',
    'last_updated', 'error_log',
  ],
  captions: [
    'idea_id', 'batch_id', 'product_name',
    'tiktok_caption', 'ig_caption', 'yt_title', 'yt_desc',
    'created_at',
  ],
};

/**
 * Build one row for Ideation tab
 */
export function buildIdeationRow(idea, batchId) {
  return [
    batchId, // batch_id
    singleLine(idea.product_name), // product_name
    singleLine(idea.product_description), // product_description
    singleLine(idea.target_audience), // target_audience
    singleLine(idea.category_cep), // category_cep
    singleLine(idea.cep || idea.topik), // cep
    singleLine(idea.sub_cep_matrix), // sub_cep_matrix
    singleLine(idea.vfo), // vfo
    singleLine(idea.key_messages), // key_message
    idea.jumlah_klip || 0, // scene_count
    singleLine(idea.narrative_mode), // narrative_mode
    singleLine(idea.visual_style), // visual_style
    singleLine(idea.words_per_clip), // words_per_clip
    singleLine(idea.target_ai), // target_ai_engine
    singleLine(idea.face_visibility), // face_visibility
    singleLine(idea.aspect_ratio), // aspect_ratio
    singleLine(idea.instruksi_tambahan), // custom_instruction
    singleLine(idea.prompt_output_format), // output_prompt_format
    idea.tanggal_dibuat || new Date().toISOString(), // created_at
    'draft', // review_status
    '', // review_notes
    'ideated', // pipeline_status
    idea.id || '', // sys_idea_id
  ];
}

/**
 * Build N rows for Production tab (1 per scene)
 */
export function buildProductionRows(result, idea, batchId) {
  const storyboard = result.storyboard || [];
  const t2iPrompts = result.t2i_prompts || [];
  const i2vPrompts = result.i2v_prompts || [];
  const voiceover = result.voiceover || storyboard.map((s, i) => ({
    scene: s.scene || i + 1,
    narration: s.narration || '',
    duration: s.duration || '',
  }));
  const now = new Date().toISOString();

  return storyboard.map((s, i) => {
    const sceneNum = s.scene || i + 1;
    const sceneId = `${batchId}_S${String(sceneNum).padStart(2, '0')}`;
    const vo = voiceover[i] || {};
    const t2i = t2iPrompts[i] || {};
    const i2v = i2vPrompts[i] || {};

    return [
      idea?.id || result.id || '',
      batchId,
      sceneId,
      idea?.product_name || result.video_filename || '',
      sceneNum,
      s.duration || '',
      vo.narration || s.narration || '',
      s.visual_description || '',
      s.camera_movement || '',
      s.audio_mood || '',
      t2i.prompt || '',
      i2v.prompt || '',
      'draft', // review_status
      '',      // review_notes
      'pending', '', '', // audio
      'pending', '', '', // image
      'pending', '', '', // video
      now,     // last_updated
      '',      // error_log
    ];
  });
}

/**
 * Build one row for Captions tab
 */
export function buildCaptionsRow(result, idea, batchId) {
  return [
    idea?.id || result.id || '',
    batchId,
    idea?.product_name || result.video_filename || '',
    result.tiktok_caption || '',
    result.ig_caption || '',
    result.yt_title || '',
    result.yt_desc || '',
    result.tanggal_dibuat || new Date().toISOString(),
  ];
}

// ========================
// Ideation Export (xlsx/md)
// ========================

/**
 * Build Excel for ideation ideas list
 */
export function buildIdeationExcelBuffer(ideas, productName) {
  const wb = XLSX.utils.book_new();

  const rows = ideas.map((idea, i) => ({
    '#': i + 1,
    'Topik': idea.topik || '',
    'CEP Context': idea.konteks_cep || '',
    'VFO': idea.vfo || '',
    'Key Messages': idea.key_messages || '',
    'Narrative Mode': idea.narrative_mode || '',
    'Visual Style': idea.visual_style || '',
    'Target AI': idea.target_ai || '',
    'Jumlah Klip': idea.jumlah_klip || '',
    'Status': idea.status || 'Draft',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 4 }, { wch: 40 }, { wch: 50 }, { wch: 30 }, { wch: 50 },
    { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Ideas');

  // Metadata
  const meta = [
    { Field: 'Product', Value: productName || '' },
    { Field: 'Total Ideas', Value: ideas.length },
    { Field: 'Tanggal', Value: new Date().toISOString() },
  ];
  const wsMeta = XLSX.utils.json_to_sheet(meta);
  wsMeta['!cols'] = [{ wch: 15 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, wsMeta, 'Metadata');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Build Markdown for ideation ideas
 */
export function buildIdeationMarkdown(ideas, productName) {
  const lines = [];
  lines.push(`# Content Ideation — ${productName || 'Export'}`);
  lines.push(`**Tanggal:** ${new Date().toISOString()}`);
  lines.push(`**Total:** ${ideas.length} ide`);
  lines.push('');

  ideas.forEach((idea, i) => {
    lines.push('---');
    lines.push(`## Ide ${i + 1}: ${idea.topik || ''}`);
    lines.push('');
    lines.push(`**CEP Context:** ${idea.konteks_cep || ''}`);
    lines.push(`**VFO:** ${idea.vfo || ''}`);
    lines.push(`**Key Messages:** ${idea.key_messages || ''}`);
    lines.push('');
    lines.push(`- Narrative: ${idea.narrative_mode || ''}`);
    lines.push(`- Visual: ${idea.visual_style || ''}`);
    lines.push(`- AI Engine: ${idea.target_ai || ''}`);
    lines.push(`- Klip: ${idea.jumlah_klip || ''}`);
    lines.push('');
  });

  return lines.join('\n');
}

// ========================
// RE Pipeline Sheet Builders
// ========================

export const RE_PIPELINE_HEADERS = {
  results: [
    're_id', 'batch_id', 'video_filename', 'source_type', 'source_url',
    'aspect_ratio', 'target_ai', 'scene_count', 'created_at',
    'review_status', 'review_notes', 'pipeline_status', 'markdown_url',
  ],
  storyboard: [
    're_id', 'batch_id', 'scene_id', 'scene_number',
    'duration', 'visual_description', 'camera_movement', 'audio_mood',
  ],
  voiceover: [
    're_id', 'batch_id', 'scene_id', 'scene_number',
    'narration', 'duration',
    'review_status', 'audio_status', 'audio_url',
  ],
  prompts: [
    're_id', 'batch_id', 'scene_id', 'scene_number',
    'aspect_ratio', 'target_ai', 't2v_prompt',
    'review_status',
    'image_status', 'image_url',
    'video_task_id', 'video_folder_id', 'video_status', 'video_url',
  ],
  captions: [
    're_id', 'batch_id',
    'tiktok_caption', 'ig_caption', 'yt_title', 'yt_desc',
  ],
  riset: [
    'row_id', 'source_url', 'video_name', 'custom_instruction',
    'aspect_ratio', 'target_ai', 'priority', 'added_by', 'added_at',
    'status', 're_id', 'batch_id', 'processed_at', 'error_note', 'markdown_url', 'video_id'
  ],
};

export function generateREBatchId(existingIds = [], campaignName = '') {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const cleanName = (campaignName || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
  const campaignCode = cleanName || 'GEN';
  const prefix = `RE-${campaignCode}-${dateStr}-`;
  let maxNum = 0;
  existingIds.forEach(id => {
    if (id && id.startsWith(prefix)) {
      const num = parseInt(id.slice(prefix.length), 10);
      if (num > maxNum) maxNum = num;
    }
  });
  return `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
}

export function buildREResultRow(result, batchId, markdownUrl = '') {
  const storyboard = result.storyboard || [];
  return [
    result.id || '',
    batchId,
    result.video_filename || '',
    result.source_type || '',
    result.source_url || '',
    result.aspect_ratio || '9:16',
    result.target_ai || 'Google Veo (8s)',
    storyboard.length,
    result.tanggal_dibuat || new Date().toISOString(),
    'draft',
    '',
    'analyzed',
    markdownUrl,
  ];
}

export function buildREStoryboardRows(result, batchId) {
  return (result.storyboard || []).map((s, i) => {
    const sceneNum = s.scene || i + 1;
    return [
      result.id || '',
      batchId,
      `${batchId}_S${String(sceneNum).padStart(2, '0')}`,
      sceneNum,
      s.duration || '',
      s.visual_description || '',
      s.camera_movement || '',
      s.audio_mood || '',
    ];
  });
}

export function buildREVoiceoverRows(result, batchId) {
  return (result.voiceover || []).map((v, i) => {
    const sceneNum = v.scene || i + 1;
    return [
      result.id || '',
      batchId,
      `${batchId}_S${String(sceneNum).padStart(2, '0')}`,
      sceneNum,
      v.narration || '',
      v.duration || '',
      'draft',
      'pending',
      '',
    ];
  });
}

export function buildREPromptRows(result, batchId) {
  const t2v = result.t2v_prompts || [];
  const t2i = result.t2i_prompts || [];
  const i2v = result.i2v_prompts || [];

  const maxClip = Math.max(
    ...t2v.map(p => Number(p.clip) || 0),
    ...t2i.map(p => Number(p.clip) || 0),
    ...i2v.map(p => Number(p.clip) || 0),
    t2v.length,
    t2i.length,
    i2v.length,
    1
  );

  const rows = [];
  for (let c = 1; c <= maxClip; c++) {
    const t2vP = t2v.find(p => (Number(p.clip) || (t2v.indexOf(p) + 1)) === c);
    const t2iP = t2i.find(p => (Number(p.clip) || (t2i.indexOf(p) + 1)) === c);
    const i2vP = i2v.find(p => (Number(p.clip) || (i2v.indexOf(p) + 1)) === c);

    if (!t2vP && !t2iP && !i2vP) continue;

    let finalPrompt = '';
    if (t2vP) {
      finalPrompt = t2vP.prompt || '';
    } else {
      const parts = [];
      if (t2iP) parts.push(`[T2I Start Frame Prompt]\n${t2iP.prompt || ''}`);
      if (i2vP) parts.push(`[I2V Motion Prompt]\n${i2vP.prompt || ''}`);
      finalPrompt = parts.join('\n\n');
    }

    const sceneNum = (t2vP?.scenes_covered || t2vP?.scene || t2iP?.scene || i2vP?.scene || c);

    rows.push([
      result.id || '',
      batchId,
      `${batchId}_C${String(c).padStart(2, '0')}`,
      sceneNum,
      result.aspect_ratio || '9:16',
      result.target_ai || 'Google Veo (8s)',
      finalPrompt,
      'draft',
      'pending', '',
      '', '', 'pending', '',
    ]);
  }
  return rows;
}

export function buildRECaptionsRow(result, batchId) {
  return [
    result.id || '',
    batchId,
    result.tiktok_caption || '',
    result.ig_caption || '',
    result.yt_title || '',
    result.yt_desc || '',
  ];
}

/**
 * Build consolidated Markdown string for an entire campaign batch
 */
export function buildBatchMarkdownContent(campaign, items) {
  const lines = [];
  lines.push(`# Campaign Batch: ${campaign.campaign_name}`);
  lines.push(`- **Campaign ID (Batch ID):** \`${campaign.id}\``);
  lines.push(`- **Status:** ${campaign.status}`);
  lines.push(`- **Scheduler:** ${campaign.local_scheduler === 1 ? 'Testing Mode (Local Scheduler)' : 'Global Scheduler'}`);
  lines.push(`- **Aspect Ratio:** ${campaign.aspect_ratio || '9:16'}`);
  lines.push(`- **Target AI:** ${campaign.target_ai || 'Google Veo (8s)'}`);
  if (campaign.visual_overrides_json) {
    try {
      const vso = JSON.parse(campaign.visual_overrides_json);
      lines.push(`- **Visual Swap Overrides:**`);
      lines.push(`  - **Concept:** ${vso.character_concept || '-'}`);
      lines.push(`  - **Demographic:** ${vso.subject_demographic || '-'}`);
      lines.push(`  - **Wardrobe:** ${vso.wardrobe_style || '-'}${vso.wardrobe_style === 'custom' ? ` (${vso.wardrobe_style_custom || ''})` : ''}`);
      lines.push(`  - **Lighting:** ${vso.lighting_style || '-'}${vso.lighting_style === 'custom' ? ` (${vso.lighting_style_custom || ''})` : ''}`);
    } catch (e) {
      lines.push(`- **Visual Swap Overrides:** invalid JSON`);
    }
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(`## 📋 Daftar URL (${items.length})`);
  items.forEach((item, idx) => {
    const statuses = [
      `Scraped: ${item.scrape_status || 'pending'}`,
      `Analyzed: ${item.analyze_status || 'pending'}`,
      `TTS: ${item.tts_status || 'pending'}`,
      `Visuals: ${item.visual_status || 'pending'}`,
      `FFmpeg: ${item.ffmpeg_status || 'pending'}`,
      `Cloud: ${item.upload_status || 'pending'}`,
      `Social: ${item.social_post_status || 'pending'}`
    ].join(' | ');
    lines.push(`${idx + 1}. [${item.source_url}](${item.source_url}) - Status: ${statuses}`);
  });
  lines.push('');

  items.forEach((item, idx) => {
    lines.push('---');
    lines.push('');
    lines.push(`## 🔗 Item ${idx + 1}: ${item.source_url}`);
    lines.push('');

    if (item.analyze_status !== 'analyzed' && item.analyze_status !== 'completed') {
      lines.push(`> *Item belum selesai dianalisis. Status: ${item.analyze_status}*`);
      lines.push('');
      return;
    }

    if (item.angle_variants && item.angle_variants.length > 0) {
      lines.push(`### ⚡ Variasi Multi-Angle (RE+AM V8.3)`);
      lines.push('');
      item.angle_variants.forEach((v, vIdx) => {
        lines.push(`#### Angle ${vIdx + 1}: ${v.angle_name}`);
        lines.push(`- **Kategori:** ${v.angle_category} | **Strategi Matriks:** ${v.matrix_strategy_used} | **Target Kognitif:** ${v.system_targeting}`);
        lines.push(`- **Voice Persona:** ${v.voice_persona_assigned}`);
        lines.push(`- **Deskripsi Taktik:** ${v.angle_description}`);
        if (v.drive_link) {
          lines.push(`- **Drive Link:** [Google Drive](${v.drive_link})`);
        }
        lines.push('');
        
        let clips = [];
        try {
          clips = JSON.parse(v.visual_tasks_json || '[]');
        } catch(e) {}
        
        lines.push('##### Storyboard & Naskah');
        clips.forEach((clip, cIdx) => {
          const clipIdx = clip.clip_index || cIdx + 1;
          lines.push(`###### Clip ${clipIdx}`);
          lines.push(`- **Voiceover:** ${clip.voiceover || '-'}`);
          lines.push(`- **Prompt:**`);
          lines.push('  ```');
          lines.push(`  ${clip.t2v_prompt || '-'}`);
          lines.push('  ```');
          lines.push('');
        });
      });
      return;
    }

    let parsed = {};
    if (item.result_json) {
      try {
        parsed = JSON.parse(item.result_json);
      } catch (e) {
        lines.push('> *Gagal memproses data analisis JSON.*');
        lines.push('');
        return;
      }
    }

    // 💡 Analisis & Strategi Upgrade
    const summary = parsed.analysis_summary || {};
    lines.push('### 💡 Analisis & Strategi Upgrade');
    lines.push(`- **Original Hook Analysis:** ${summary.original_hook_analysis || '-'}`);
    lines.push(`- **Weakness Identified:** ${summary.weakness_identified || '-'}`);
    lines.push(`- **The Upgrade Strategy:** ${summary.the_upgrade_strategy || '-'}`);
    lines.push('');

    // 🎬 Storyboard
    lines.push('### 🎬 Storyboard');
    const storyboard = parsed.storyboard || [];
    if (storyboard.length === 0) {
      lines.push('*Tidak ada data storyboard.*');
    } else {
      storyboard.forEach((s, sIdx) => {
        const sceneNum = s.scene || sIdx + 1;
        lines.push(`#### Scene ${sceneNum} (${s.duration || '-'})`);
        lines.push(`- **Visual Description:** ${s.visual_description || '-'}`);
        lines.push(`- **Camera Movement:** ${s.camera_movement || '-'}`);
        lines.push(`- **Audio Mood:** ${s.audio_mood || '-'}`);
        lines.push('');
      });
    }

    // 🎙️ Voiceover Script
    lines.push('### 🎙️ Voiceover Script');
    const voiceover = parsed.voiceover || [];
    if (voiceover.length === 0) {
      lines.push('*Tidak ada data voiceover.*');
    } else {
      voiceover.forEach((v, vIdx) => {
        const sceneNum = v.scene || vIdx + 1;
        lines.push(`- **Scene ${sceneNum} (${v.duration || '-'}):**`);
        lines.push(`  > "${v.narration || '-'}"`);
      });
    }
    lines.push('');

    // 🤖 T2V Prompts
    const prompts = parsed.t2v_prompts || [];
    if (prompts.length > 0) {
      lines.push('### 🤖 T2V Prompts');
      prompts.forEach((p, pIdx) => {
        const clipNum = p.clip || pIdx + 1;
        lines.push(`#### Clip ${clipNum} (${p.duration || 'Estimated Duration'})`);
        lines.push(`- **Scenes:** ${p.scenes_covered || '-'} | **Motion:** ${p.motion_type || '-'} | **Camera:** ${p.camera_movement || '-'} | **Style:** ${p.style || '-'}`);
        lines.push('- **Prompt:**');
        lines.push('  ```');
        lines.push(`  ${p.prompt || ''}`);
        lines.push('  ```');
      });
      lines.push('');
    }

    // 📸 T2I Prompts
    const t2iPrompts = parsed.t2i_prompts || [];
    if (t2iPrompts.length > 0) {
      lines.push('### 📸 T2I Prompts');
      t2iPrompts.forEach((p, pIdx) => {
        const clipNum = p.clip || pIdx + 1;
        lines.push(`#### Clip ${clipNum} (Start Frame)`);
        lines.push('- **Prompt:**');
        lines.push('  ```');
        lines.push(`  ${p.prompt || ''}`);
        lines.push('  ```');
      });
      lines.push('');
    }

    // 🎥 I2V Prompts
    const i2vPrompts = parsed.i2v_prompts || [];
    if (i2vPrompts.length > 0) {
      lines.push('### 🎥 I2V Prompts');
      i2vPrompts.forEach((p, pIdx) => {
        const clipNum = p.clip || pIdx + 1;
        lines.push(`#### Clip ${clipNum} (Animation)`);
        lines.push('- **Prompt:**');
        lines.push('  ```');
        lines.push(`  ${p.prompt || ''}`);
        lines.push('  ```');
      });
      lines.push('');
    }

    // 📲 Captions & Metadata
    lines.push('### 📲 Captions & Metadata');
    lines.push('- **TikTok Caption:**');
    lines.push('  ```');
    lines.push(`  ${parsed.tiktok_caption || ''}`);
    lines.push('  ```');
    lines.push('- **Instagram Caption:**');
    lines.push('  ```');
    lines.push(`  ${parsed.ig_caption || ''}`);
    lines.push('  ```');
    lines.push(`- **YouTube Title:** \`${parsed.yt_title || ''}\``);
    lines.push('- **YouTube Description:**');
    lines.push('  ```');
    lines.push(`  ${parsed.yt_desc || ''}`);
    lines.push('  ```');
    lines.push('');
  });

  return lines.join('\n');
}

export function buildPillarBatchMarkdownContent(campaign, items) {
  const lines = [];
  lines.push(`# Campaign Batch: ${campaign.campaign_name}`);
  lines.push(`- **Campaign ID (Batch ID):** \`${campaign.id}\``);
  lines.push(`- **Status:** ${campaign.status}`);
  lines.push(`- **Scheduler:** ${campaign.local_scheduler === 1 ? 'Testing Mode (Local Scheduler)' : 'Global Scheduler'}`);
  lines.push(`- **Aspect Ratio:** ${campaign.aspect_ratio || '9:16'}`);
  lines.push(`- **Target AI:** ${campaign.target_ai || 'Google Veo (8s)'}`);
  if (campaign.visual_overrides_json) {
    try {
      const vso = JSON.parse(campaign.visual_overrides_json);
      lines.push(`- **Visual Swap Overrides:**`);
      lines.push(`  - **Concept:** ${vso.character_concept || '-'}`);
      lines.push(`  - **Demographic:** ${vso.subject_demographic || '-'}`);
      lines.push(`  - **Wardrobe:** ${vso.wardrobe_style || '-'}${vso.wardrobe_style === 'custom' ? ` (${vso.wardrobe_style_custom || ''})` : ''}`);
      lines.push(`  - **Lighting:** ${vso.lighting_style || '-'}${vso.lighting_style === 'custom' ? ` (${vso.lighting_style_custom || ''})` : ''}`);
    } catch (e) {
      lines.push(`- **Visual Swap Overrides:** invalid JSON`);
    }
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(`## 📋 Daftar Video Items (${items.length})`);
  items.forEach((item, idx) => {
    let payload = {};
    try {
      payload = item.row_creative_payload ? JSON.parse(item.row_creative_payload) : {};
    } catch (_) {}
    const productInfo = payload.product_name ? `${payload.product_name} (${payload.source_product_url || 'manual'})` : 'N/A';
    lines.push(`${idx + 1}. **Video #${idx + 1}**: Pillar: "${payload.content_pillar || '-'}" | Hook: "${payload.custom_hook || '-'}" | Product: ${productInfo}`);
  });
  lines.push('');

  items.forEach((item, idx) => {
    lines.push('---');
    lines.push('');
    lines.push(`## 🔗 Video #${idx + 1}`);
    let payload = {};
    try {
      payload = item.row_creative_payload ? JSON.parse(item.row_creative_payload) : {};
    } catch (_) {}
    lines.push(`- **Pilar Konten:** ${payload.content_pillar || '-'}`);
    lines.push(`- **Hook:** ${payload.custom_hook || '-'}`);
    lines.push(`- **Aksi Visual (Macro):** ${payload.visual_action_guideline || '-'}`);
    lines.push(`- **URL Produk:** ${payload.source_product_url || '-'}`);
    lines.push(`- **Nama Produk:** ${payload.product_name || '-'}`);
    lines.push(`- **Deskripsi Produk:** ${payload.product_desc || '-'}`);
    lines.push(`- **USP Produk:** ${payload.product_usp || '-'}`);
    lines.push(`- **Status Pemrosesan:** ${item.generation_status || 'pending'}`);
    if (item.drive_link) {
      lines.push(`- **Folder Drive:** [Buka Google Drive](${item.drive_link})`);
    }
    lines.push('');

    if (item.generation_status !== 'completed') {
      lines.push(`> *Item belum selesai di-generate. Status: ${item.generation_status}*`);
      lines.push('');
      return;
    }

    let parsed = {};
    if (item.result_json) {
      try {
        parsed = JSON.parse(item.result_json);
      } catch (e) {
        lines.push('> *Gagal memproses naskah JSON.*');
        lines.push('');
        return;
      }
    }

    // Storyboard
    lines.push('### 📋 Storyboard');
    lines.push('| Scene | Duration | Visual Description | Camera Movement | Audio Mood |');
    lines.push('|---|---|---|---|---|');
    const storyboard = parsed.storyboard || [];
    if (storyboard.length === 0) {
      lines.push('| - | - | - | - | - |');
    } else {
      storyboard.forEach((s, sIdx) => {
        lines.push(`| ${s.scene || sIdx + 1} | ${s.duration || '-'} | ${s.visual_description || '-'} | ${s.camera_movement || '-'} | ${s.audio_mood || '-'} |`);
      });
    }
    lines.push('');

    // Voiceover
    lines.push('### 🎙️ Voiceover Script');
    const voiceover = parsed.voiceover || [];
    if (voiceover.length === 0) {
      lines.push('*Tidak ada data voiceover.*');
    } else {
      voiceover.forEach((v, vIdx) => {
        lines.push(`- **Scene ${v.scene || vIdx + 1} (${v.duration || '-'}):**`);
        lines.push(`  > "${v.narration || '-'}"`);
      });
    }

    // 🤖 T2V Prompts
    const prompts = parsed.t2v_prompts || [];
    if (prompts.length > 0) {
      lines.push('### 🤖 T2V Prompts');
      prompts.forEach((p, pIdx) => {
        const clipNum = p.clip || pIdx + 1;
        lines.push(`#### Clip ${clipNum} (${p.duration || 'Estimated Duration'})`);
        lines.push(`- **Scenes:** ${p.scenes_covered || '-'} | **Motion:** ${p.motion_type || '-'} | **Camera:** ${p.camera_movement || '-'} | **Style:** ${p.style || '-'}`);
        lines.push('- **Prompt:**');
        lines.push('  ```');
        lines.push(`  ${p.prompt || ''}`);
        lines.push('  ```');
      });
      lines.push('');
    }

    // 📸 T2I Prompts
    const t2iPrompts = parsed.t2i_prompts || [];
    if (t2iPrompts.length > 0) {
      lines.push('### 📸 T2I Prompts');
      t2iPrompts.forEach((p, pIdx) => {
        const clipNum = p.clip || pIdx + 1;
        lines.push(`#### Clip ${clipNum} (Start Frame)`);
        lines.push('- **Prompt:**');
        lines.push('  ```');
        lines.push(`  ${p.prompt || ''}`);
        lines.push('  ```');
      });
      lines.push('');
    }

    // 🎥 I2V Prompts
    const i2vPrompts = parsed.i2v_prompts || [];
    if (i2vPrompts.length > 0) {
      lines.push('### 🎥 I2V Prompts');
      i2vPrompts.forEach((p, pIdx) => {
        const clipNum = p.clip || pIdx + 1;
        lines.push(`#### Clip ${clipNum} (Animation)`);
        lines.push('- **Prompt:**');
        lines.push('  ```');
        lines.push(`  ${p.prompt || ''}`);
        lines.push('  ```');
      });
      lines.push('');
    }

    // Captions & Metadata
    lines.push('### 📲 Captions & Metadata');
    lines.push('- **TikTok Caption:**');
    lines.push('  ```');
    lines.push(`  ${parsed.tiktok_caption || ''}`);
    lines.push('  ```');
    lines.push('- **Instagram Caption:**');
    lines.push('  ```');
    lines.push(`  ${parsed.ig_caption || ''}`);
    lines.push('  ```');
    lines.push(`- **YouTube Title:** \`${parsed.yt_title || ''}\``);
    lines.push('- **YouTube Description:**');
    lines.push('  ```');
    lines.push(`  ${parsed.yt_desc || ''}`);
    lines.push('  ```');
    lines.push('');
  });

  return lines.join('\n');
}
