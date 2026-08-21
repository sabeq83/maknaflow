import assert from 'node:assert/strict';
import { loadStagingEnv } from './local-staging/env.js';

Object.assign(process.env, loadStagingEnv());

import { 
  createChannel,
  createOrUpdateStrategyDraft,
  activateStrategy,
  createSeries,
  createPlannedEpisode,
  saveResearchBrief,
  getLatestResearchBrief,
  saveBlueprintDraft,
  getLatestBlueprint,
  approveBlueprint,
  saveScriptDraft,
  getLatestScript,
  approveScript
} from '../lib/youtube-studio-repository.js';
import { validateResearchBrief, validateBlueprint, validateSceneScript, EPISODE_STATES } from '../lib/youtube-studio-contract.js';
import { tenantContext } from '../lib/tenant-context.js';
import { closePgPool, pgQuery } from '../lib/db-pg.js';

console.log('🔄 Running YouTube Studio Phase 2 Blueprint & Script automated tests...');

async function runTests() {
  await tenantContext.run('test_tenant_c', async () => {
    // Setup channel and active strategy
    const channel = await createChannel({ name: 'Phase 2 Test Channel', primary_locale: 'id-ID' }, { username: 'test_user' });
    const mockBrief = { niche: 'Programming', audience: 'Developers', geography: 'Indonesia', objective: 'Leads' };
    const mockConfig = { positioning: 'Programming tutorials', audience_persona: { who: 'Coders' }, content_pillars: [{ name: 'React' }], editorial_tone: 'Direct', video_format: { target_duration_seconds: 600 } };
    
    const draft = await createOrUpdateStrategyDraft(channel.id, { brief: mockBrief, config: mockConfig }, { username: 'test_user' });
    const strategy = await activateStrategy(channel.id, draft.id, { username: 'test_user' });
    const series = await createSeries({ channel_id: channel.id, name: 'NextJS Tutorials' }, { username: 'test_user' });

    // 1. Create planned episode
    console.log('  1. Creating a Planned episode...');
    const episode = await createPlannedEpisode({
      channelId: channel.id,
      seriesId: series.id,
      title: 'NextJS App Router Guide',
      locale: 'id-ID'
    }, { username: 'test_user' });
    assert.equal(episode.status, EPISODE_STATES.PLANNED);

    // 2. Test Research Brief validation
    console.log('  2. Testing Research Brief contract validation...');
    await assert.rejects(
      async () => validateResearchBrief({}),
      /Episode angle is required/
    );
    await assert.rejects(
      async () => validateResearchBrief({ episode_angle: 'Some angle' }),
      /Audience intent is required/
    );
    const validResearchBriefData = {
      episode_angle: 'Next.js app router deep dive',
      audience_intent: 'Understand page vs layout routing',
      viewer_questions: ['How do nested layout files load?'],
      key_claims: [{ claim: 'Layouts do not rerender on nested navigation', risk: 'low', source_note: 'NextJS Docs' }],
      editorial_risks: [],
      recommended_structure: 'Intro, nested layout demo, outro',
      source_requests: []
    };
    const validatedResearch = validateResearchBrief(validResearchBriefData);
    assert.equal(validatedResearch.episode_angle, 'Next.js app router deep dive');

    // 3. Save Research Brief & Transition check
    console.log('  3. Saving Research Brief and verifying status transition...');
    const savedResearch = await saveResearchBrief(episode.id, validatedResearch, { username: 'test_user' });
    assert.equal(savedResearch.version, 1);
    
    const rbCheck = await pgQuery('SELECT status FROM youtube_episodes WHERE id = $1', [episode.id]);
    assert.equal(rbCheck.rows[0].status, EPISODE_STATES.RESEARCHING);

    // 4. Test Blueprint timing validation
    console.log('  4. Testing Blueprint timing validation...');
    const invalidBp = {
      content_promise: 'Promise text',
      hook: { text: 'Hook text', target_duration_seconds: 30 },
      chapters: [
        { order: 1, title: 'Intro', target_duration_seconds: -10, narrative_focus: 'Intro demo' }
      ]
    };
    await assert.rejects(
      async () => validateBlueprint(invalidBp, 600),
      /Chapter 1 duration must be positive/
    );

    const validBpData = {
      content_promise: 'Master NextJS routing in 10 minutes',
      hook: { text: 'Stop using page router. Here is app router.', target_duration_seconds: 30 },
      chapters: [
        { order: 1, title: 'Layout files', target_duration_seconds: 150, narrative_focus: 'Nested files demo', retention_moment: 'Visual routing map', pattern_interrupt: 'Zoom zoom' },
        { order: 2, title: 'Page routing', target_duration_seconds: 300, narrative_focus: 'Page.js file explanation', retention_moment: 'Hands on code', pattern_interrupt: 'Highlight snippet' }
      ],
      cta: { text: 'Subscribe for React tips', placement: 'outro' },
      next_video_bridge: 'Check out route handler tutorial next'
    };
    // Total duration: 30 + 150 + 300 = 480 seconds (within 35% tolerance of 600s)
    const validatedBp = validateBlueprint(validBpData, 600);
    assert.equal(validatedBp.content_promise, 'Master NextJS routing in 10 minutes');

    // 5. Save Blueprint Draft & Transition check
    console.log('  5. Saving Blueprint Draft and verifying status transition...');
    const savedBp = await saveBlueprintDraft(episode.id, validatedBp, {}, { username: 'test_user' });
    assert.equal(savedBp.status, 'draft');
    
    const bpCheck = await pgQuery('SELECT status FROM youtube_episodes WHERE id = $1', [episode.id]);
    assert.equal(bpCheck.rows[0].status, EPISODE_STATES.BLUEPRINT_DRAFT);

    // 6. Script generation blocked until Blueprint Approved
    console.log('  6. Gating check: Script generation fails before blueprint approval...');
    const mockScriptData = {
      title: 'Script Title',
      estimated_total_duration_seconds: 480,
      scenes: [
        { scene_index: 1, chapter_order: 1, purpose: 'Hook', voiceover: 'VO script', estimated_duration_seconds: 30, scene_type: 'generated_visual', visual_direction: 'Visual route map', subtitle_cue: 'sub', transition_note: 'none', audio_cue: 'music' }
      ]
    };
    await assert.rejects(
      async () => await saveScriptDraft(episode.id, savedBp.id, mockScriptData, {}, { username: 'test_user' }),
      /State transition illegal: cannot jump from 'Blueprint Draft' to 'Script Draft'/
    );

    // 7. Approve Blueprint Draft & Invalidation check
    console.log('  7. Approving Blueprint Draft and checking invalidation trigger...');
    const approvedBp = await approveBlueprint(savedBp.id, { username: 'test_user' });
    assert.equal(approvedBp.status, 'approved');

    const approveBpCheck = await pgQuery('SELECT status FROM youtube_episodes WHERE id = $1', [episode.id]);
    assert.equal(approveBpCheck.rows[0].status, EPISODE_STATES.BLUEPRINT_APPROVED);

    // 8. Test Scene Script contract validation
    console.log('  8. Testing Scene Script contract validation...');
    const invalidScript = {
      title: 'NextJS App Router Guide',
      scenes: [
        { scene_index: 2, chapter_order: 1, purpose: 'Bad seq', voiceover: 'Bad index', estimated_duration_seconds: 15, scene_type: 'generated_visual', visual_direction: 'Code view' }
      ]
    };
    await assert.rejects(
      async () => validateSceneScript(invalidScript, validatedBp, 480),
      /Scene index must be sequential. Expected 1, got 2/
    );

    const validScriptData = {
      title: 'NextJS App Router Guide Script',
      estimated_total_duration_seconds: 480,
      scenes: [
        { scene_index: 1, chapter_order: 1, purpose: 'Hook intro', voiceover: 'Welcome. React developers!', estimated_duration_seconds: 30, scene_type: 'generated_visual', visual_direction: 'Zoom intro text', subtitle_cue: 'Welcome React Devs', transition_note: 'cut', audio_cue: 'bell' },
        { scene_index: 2, chapter_order: 2, purpose: 'Page vs layouts demo', voiceover: 'Let us edit layout.js now.', estimated_duration_seconds: 450, scene_type: 'broll', visual_direction: 'Visual text code editor', subtitle_cue: 'Let us edit layout js', transition_note: 'fade', audio_cue: 'synth' }
      ]
    };
    const validatedScript = validateSceneScript(validScriptData, validatedBp, 480);
    assert.equal(validatedScript.scenes[0].voiceover, 'Welcome. React developers!');

    // 9. Save Script Draft & Transition check
    console.log('  9. Saving Script Draft and verifying status transition...');
    const savedScript = await saveScriptDraft(episode.id, approvedBp.id, validatedScript, {}, { username: 'test_user' });
    assert.equal(savedScript.status, 'draft');

    const scCheck = await pgQuery('SELECT status FROM youtube_episodes WHERE id = $1', [episode.id]);
    assert.equal(scCheck.rows[0].status, EPISODE_STATES.SCRIPT_DRAFT);

    // 10. Approve Script Draft
    console.log('  10. Approving Script Draft and verifying Script Approved transition...');
    const approvedScript = await approveScript(savedScript.id, { username: 'test_user' });
    assert.equal(approvedScript.status, 'approved');

    const finalEpCheck = await pgQuery('SELECT status FROM youtube_episodes WHERE id = $1', [episode.id]);
    assert.equal(finalEpCheck.rows[0].status, EPISODE_STATES.SCRIPT_APPROVED);

    console.log('  ✅ YouTube Studio Phase 2 Blueprint & Script tests completed successfully!');
  });
}

runTests()
  .catch(err => {
    console.error('❌ Tests failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await closePgPool();
    process.exit(0);
  });
