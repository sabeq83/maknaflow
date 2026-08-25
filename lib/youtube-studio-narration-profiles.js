const profiles = {
  kids_educational_id: {
    targetWpm: 102,
    pauseRatio: 0.20,
    sentenceWords: { min: 5, max: 10 },
    voiceSpeed: { min: 0.85, max: 1.10 },
    tempoCorrection: { min: 0.92, max: 1.08 }
  },
  general_id: {
    targetWpm: 130,
    pauseRatio: 0.05,
    sentenceWords: { min: 8, max: 20 },
    voiceSpeed: { min: 0.90, max: 1.10 },
    tempoCorrection: { min: 0.95, max: 1.05 }
  }
};

export function getNarrationProfile(key) {
  return profiles[key] || profiles.general_id;
}

export function calculateNarrationBudget({ targetSeconds, profile }) {
  const p = typeof profile === 'string' ? getNarrationProfile(profile) : profile;
  const narratedSeconds = targetSeconds * (1 - p.pauseRatio);
  const idealWords = Math.round(narratedSeconds * p.targetWpm / 60);
  const min = Math.round(idealWords * 0.9);
  const max = Math.round(idealWords * 1.1);
  return { min, ideal: idealWords, max };
}

export function allocateSceneBudgets({ scenes, budget, profile }) {
  const p = typeof profile === 'string' ? getNarrationProfile(profile) : profile;
  const totalDuration = scenes.reduce((sum, s) => sum + (s.estimated_duration_seconds || s.duration || 0), 0);
  if (totalDuration === 0) return scenes.map(() => ({ min: 0, ideal: 0, max: 0 }));

  return scenes.map(s => {
    const sceneDur = s.estimated_duration_seconds || s.duration || 0;
    const ratio = sceneDur / totalDuration;
    const sceneIdeal = Math.round(budget.ideal * ratio);
    const min = Math.round(sceneIdeal * 0.85);
    const max = Math.round(sceneIdeal * 1.15);
    return { min, ideal: sceneIdeal, max };
  });
}
