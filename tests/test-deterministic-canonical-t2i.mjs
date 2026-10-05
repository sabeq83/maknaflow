import assert from 'node:assert/strict';

console.log('🧪 Running Test: Deterministic Canonical Character T2I Injector...');

const mockManifestChars = {
  kio: {
    character_key: 'kio',
    display_name: 'Kio',
    canonical_description: 'A cheerful 8-year-old boy named Kio, a curious young science explorer, premium stylized 3D animated family-film character, wearing a white explorer hoodie jacket with bright orange trim and deep navy-blue accents, olive-khaki cargo pants'
  },
  bimo: {
    character_key: 'bimo',
    display_name: 'BIMO',
    canonical_description: 'Cute 3D animated companion hover-bot named BIMO, spherical smooth pearl-white chassis with glowing cyan neon trim, curved dark digital visor face displaying expressive glowing cyan emoticon eyes'
  }
};

function injectCanonicalCharacterPrompts(clips, manifestChars) {
  return clips.map(clip => {
    let t2i = clip.t2i_prompt || '';
    const sceneChars = Array.isArray(clip.characters) && clip.characters.length > 0
      ? clip.characters
      : Object.keys(manifestChars).filter(k => {
          const name = manifestChars[k]?.display_name || manifestChars[k]?.name || k;
          return (clip.visual_action || t2i || '').toLowerCase().includes(name.toLowerCase());
        });

    const canonsToInject = [];
    for (const charKey of sceneChars) {
      const cleanKey = charKey.toLowerCase().replace(/[\s\.]+/g, '_');
      const charData = manifestChars[cleanKey] || manifestChars[charKey];
      const canon = charData?.canonical_description || charData?.canonical_prompt;
      if (canon && !t2i.includes(canon) && !canonsToInject.includes(canon)) {
        canonsToInject.push(canon);
      }
    }
    if (canonsToInject.length > 0) {
      t2i = `${canonsToInject.join(', ')}, ${t2i}`;
    }
    return { ...clip, t2i_prompt: t2i };
  });
}

// Case 1: Clip with Kio and BIMO (paraphrased raw T2I)
const testClips = [
  {
    clip_index: 1,
    characters: ['kio', 'bimo'],
    visual_action: 'Kio and BIMO looking at cave projection',
    t2i_prompt: 'Kio pointing at dark cave hologram beside BIMO in science lab.'
  },
  {
    clip_index: 2,
    characters: ['kio'],
    visual_action: 'Kio playing with blindfold',
    t2i_prompt: 'Kio playfully stumbling forward in WonderLab with blindfold.'
  },
  {
    clip_index: 4,
    characters: [],
    visual_action: 'Bat flying in cave',
    t2i_prompt: 'A stylized 3D animated bat in flight inside a dark stylized cave environment.'
  }
];

const enriched = injectCanonicalCharacterPrompts(testClips, mockManifestChars);

// Verifications
assert.ok(enriched[0].t2i_prompt.startsWith(mockManifestChars.kio.canonical_description), 'Clip 1 must start with Kio canonical prompt');
assert.ok(enriched[0].t2i_prompt.includes(mockManifestChars.bimo.canonical_description), 'Clip 1 must include BIMO canonical prompt');
assert.ok(enriched[0].t2i_prompt.includes('Kio pointing at dark cave hologram'), 'Clip 1 must retain action prompt');

assert.ok(enriched[1].t2i_prompt.startsWith(mockManifestChars.kio.canonical_description), 'Clip 2 must start with Kio canonical prompt');
assert.ok(!enriched[1].t2i_prompt.includes(mockManifestChars.bimo.canonical_description), 'Clip 2 must NOT have BIMO prompt');

assert.ok(!enriched[2].t2i_prompt.includes('Kio'), 'Clip 4 (environment only) must NOT have Kio canonical prompt');
assert.equal(enriched[2].t2i_prompt, testClips[2].t2i_prompt, 'Clip 4 prompt must remain unchanged');

console.log('✅ ALL TEST ASSERTIONS PASSED! Deterministic Canonical T2I Injector verified.');
