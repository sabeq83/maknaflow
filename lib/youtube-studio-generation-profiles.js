const profiles = [
  { 
    key: 'google_flow_omni_flash', 
    label: 'Google Flow — Omni Flash', 
    provider: 'google_flow', 
    generatedShotDurations: [4, 6, 8, 10],
    active: true 
  },
  { 
    key: 'google_flow_veo_3_1_lite', 
    label: 'Google Flow — Veo 3.1 Lite', 
    provider: 'google_flow', 
    generatedShotDurations: [8],
    active: true 
  }
];

export function listPublicGenerationProfiles() {
  return profiles.filter(p => p.active).map(({ key, label, provider, generatedShotDurations }) => ({
    key, label, provider, generatedShotDurations
  }));
}

export function getGenerationProfile(key) {
  return profiles.find(p => p.key === key && p.active) || null;
}
