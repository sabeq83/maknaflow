import { validateReDraft, normalizeReDraft } from './re.js';
import { validateMultiplierDraft } from './multiplier.js';
import { validateRecipeDraft } from './recipe.js';
import { validatePillarDraft } from './pillar.js';

export function validateAndNormalizeEnginePayload(engineKind, payload) {
  try {
    if (engineKind==='re') return validateReDraft(payload);
    if (engineKind==='multiplier') return validateMultiplierDraft(payload);
    if (engineKind==='recipe') return validateRecipeDraft(payload);
    if (engineKind==='pillar') return validatePillarDraft({...payload.global_settings,campaign_name:payload.campaign_name || payload.global_settings?.campaign_name});
    throw Error('Engine tidak didukung.');
  } catch(error) { throw Object.assign(error,{status:400,code:'CAMPAIGN_CONFIGURATION_INVALID'}); }
}
export function applyStudioExecutionPolicy(config) {
  const suppress = value => {
    if (Array.isArray(value)) return value.map(suppress);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key,v])=>{
      if (['enable_social_post','enableSocialPost','post_to_facebook','post_facebook_draft','post_youtube_draft','post_tiktok_draft','postYoutube','postTiktok','postFacebook'].includes(key)) return [key,0];
      if (key.endsWith('config_json') && typeof v==='string') return [key,JSON.stringify(suppress(JSON.parse(v)))];
      return [key,suppress(v)];
    }));
  };
  return {...suppress(config),auto_sync_contentflow:1};
}
export { normalizeReDraft };
