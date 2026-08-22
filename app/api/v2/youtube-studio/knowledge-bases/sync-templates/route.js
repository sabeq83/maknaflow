/**
 * app/api/v2/youtube-studio/knowledge-bases/sync-templates/route.js
 * POST — sync local markdown templates into KB drafts (bulk upload)
 */

import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { withYouTubeStudioAccess } from '@/lib/auth';
import { createKnowledgeBaseDraft, listKnowledgeBases } from '@/lib/youtube-studio-kb-repository';
import { generateKnowledgeBaseDraft } from '@/lib/youtube-studio-kb-ai';

export const dynamic = 'force-dynamic';

const FILE_TYPE_MAP = {
  'channel-profile.md': 'channel_profile',
  'series-content-guide.md': 'series_content_guide',
  'longform-editorial-playbook.md': 'longform_editorial_playbook',
  'research-source-policy.md': 'research_source_policy',
  'visual-continuity-guide.md': 'visual_continuity_guide',
  'prompt-production-playbook.md': 'prompt_production_playbook',
  'voice-audio-guide.md': 'voice_audio_guide',
  'rights-disclosure-policy.md': 'rights_disclosure_policy',
};

// Fallback default JSON objects for validation safety
const FALLBACK_SCHEMAS = {
  channel_profile: {
    positioning: 'Positioning default dari template lokal',
    primary_language: 'id-ID',
    tone: 'Professional and informative',
    target_audience_segments: ['Umum'],
    content_pillars: ['Edukasi'],
  },
  series_content_guide: {
    series_name: 'Series Default',
    episode_format: 'Video tutorial berdurasi 10 menit',
    recurring_chapters: ['Intro', 'Main Content', 'Outro'],
  },
  longform_editorial_playbook: {
    hook_strategy: 'Hook dalam 5 detik pertama',
    retention_techniques: 'Visual changes setiap 3 detik',
    pacing_notes: 'Penyampaian dinamis tanpa jeda kosong',
  },
  research_source_policy: {
    source_standards: 'Memverifikasi fakta dari sumber tepercaya',
    claim_confidence_threshold: 'Minimal 80% keandalan informasi',
  },
  visual_continuity_guide: {
    visual_grammar: 'Cinematic framing 16:9, medium close up',
  },
  prompt_production_playbook: {
    prompt_grammar: 'Highly detailed prompts with style definitions',
  },
  voice_audio_guide: {
    voice_persona: 'Warm and friendly voice',
    speech_pacing: '140-150 words per minute',
  },
  rights_disclosure_policy: {
    asset_provenance_requirements: 'Hanya menggunakan aset bebas royalti atau berlisensi komersial',
    disclosure_obligations: 'Wajib memberikan label transparansi jika AI digunakan',
  },
};

export const POST = withYouTubeStudioAccess('write', async (request, ctx, user) => {
  try {
    const workspaceRoot = process.cwd();
    const templatesDir = path.join(workspaceRoot, 'kb', 'youtube-studio');
    
    // Read all files in templates directory
    const files = await fs.readdir(templatesDir);
    const mdFiles = files.filter(f => f.endsWith('.md') && FILE_TYPE_MAP[f]);
    
    // Get existing KBs to avoid duplicates
    const existingKbs = await listKnowledgeBases();
    const existingTypes = new Set(existingKbs.map(k => k.kb_type));
    
    let importedCount = 0;
    
    // Process each template file
    const promises = mdFiles.map(async (filename) => {
      const kbType = FILE_TYPE_MAP[filename];
      
      // Skip if this KB type already exists to prevent duplication
      if (existingTypes.has(kbType)) return;
      
      const filePath = path.join(templatesDir, filename);
      const fileContent = await fs.readFile(filePath, 'utf-8');
      
      let resolvedContent = null;
      try {
        // AI extraction from markdown content
        const aiDraft = await generateKnowledgeBaseDraft({
          kbType,
          scope: 'tenant',
          brief: { description: fileContent },
          locale: 'id-ID'
        });
        resolvedContent = aiDraft.content;
      } catch (err) {
        console.warn(`[Bulk Sync Warning] AI extraction failed for ${filename}, using fallback:`, err.message);
        resolvedContent = FALLBACK_SCHEMAS[kbType];
      }
      
      if (resolvedContent) {
        const title = filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").toUpperCase();
        await createKnowledgeBaseDraft({
          kbType,
          scope: 'tenant',
          scopeId: 'tenant',
          title,
          content: resolvedContent,
          actor: { username: user?.username || 'system' }
        });
        importedCount++;
      }
    });
    
    await Promise.all(promises);
    
    return NextResponse.json({ success: true, count: importedCount });
  } catch (err) {
    console.error('[Sync Templates Route Error]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});
