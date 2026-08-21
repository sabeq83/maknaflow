import { WARDROBE_PRESETS, DEMOGRAPHIC_PRESETS, LIGHTING_PRESETS } from './prompts.js';

export function buildReferenceAssetPrompt({ ownerType, owner, role, visualIdentity, customInstruction }) {
  let promptParts = [];
  let negativePromptParts = ['unclear details', 'blurry', 'low quality'];

  const isHuman = ownerType === 'visual_identity' || (owner && owner.depiction_mode === 'normal') || (visualIdentity && visualIdentity.config?.subject?.kind === 'human');

  // 1. Core depiction prompt based on owner
  if (ownerType === 'character' && owner) {
    promptParts.push(owner.canonical_prompt || `${owner.name}, a character`);
    if (owner.depiction_mode === 'faceless') {
      promptParts.push('faceless depiction, cropped to omit the face');
      negativePromptParts.push('visible face', 'eyes', 'nose', 'mouth', 'facial features');
    } else if (owner.depiction_mode === 'back_view') {
      promptParts.push('seen from the back, back view');
      negativePromptParts.push('front view', 'face', 'eyes');
    } else if (owner.depiction_mode === 'silhouette') {
      promptParts.push('dark silhouette against bright background');
      negativePromptParts.push('face details', 'wardrobe details');
    }
  } else if (ownerType === 'location' && owner) {
    promptParts.push(owner.visual_description || `${owner.name}, a beautiful location`);
    if (owner.lighting_default) {
      promptParts.push(`lit with ${owner.lighting_default}`);
    }
  } else if (ownerType === 'visual_identity' && visualIdentity) {
    const config = visualIdentity.config || {};
    const subjectKind = config.subject?.kind || 'human';
    const facelessMode = config.subject?.faceless_mode || 'hands_only';
    
    let demoPrompt = DEMOGRAPHIC_PRESETS[config.subject?.demographic_key] || 'a graceful Muslimah';
    if (config.subject?.custom_description) {
      demoPrompt += `, ${config.subject.custom_description}`;
    }
    
    promptParts.push(demoPrompt);

    if (subjectKind === 'human' || subjectKind === 'blank_face_3d') {
      if (facelessMode === 'hands_only') {
        promptParts.push('hands only, wrists covered, showcasing detailed hand gestures, omitting face, head, shoulders');
        negativePromptParts.push('face', 'head', 'eyes', 'nose', 'mouth', 'shoulders', 'chest', 'hair');
      } else if (facelessMode === 'crop_below_neck') {
        promptParts.push('cropped below neck, torso and hands only, face completely out of frame');
        negativePromptParts.push('face', 'head', 'eyes', 'nose', 'mouth', 'hair');
      } else if (facelessMode === 'back_view') {
        promptParts.push('back view, seen from behind');
        negativePromptParts.push('face', 'front view', 'eyes');
      } else if (facelessMode === 'silhouette') {
        promptParts.push('artistic silhouette, high contrast outline');
        negativePromptParts.push('face features', 'detailed textures');
      }
    }
  } else {
    promptParts.push('a consistent visual reference asset');
  }

  // 2. Role-specific context
  if (role === 'wardrobe') {
    promptParts.push('wardrobe reference detail sheet, focusing on garment style, textures, fabrics, folds, colors');
  } else if (role === 'visual_style') {
    promptParts.push('visual style key visual, highlighting lighting, atmosphere, cozy aesthetic tone, cinematography look');
  } else if (role === 'palette_sheet') {
    promptParts.push('color palette swatch detail sheet, showing clean color blocks, color harmony swatches, minimalist presentation');
  } else if (role === 'character_sheet') {
    promptParts.push('model sheet, character sheet with multiple angles, back view, side view details, hands gestures closeups');
    if (isHuman) {
      promptParts.push('faceless character sheet layout, strictly omitting facial features in all panels');
      negativePromptParts.push('faces in sheet', 'front portrait face');
    }
  }

  // 3. Apply faceless constraints strictly for human subjects
  if (isHuman) {
    negativePromptParts.push('visible face', 'eyes', 'nose', 'mouth', 'reflection face', 'identity drift', 'wardrobe drift');
  }

  // 4. Custom instruction addition (cannot weaken the rules)
  if (customInstruction && typeof customInstruction === 'string' && customInstruction.trim()) {
    const sanitized = customInstruction.replace(/(show face|with face|front face|visible eyes|detailed eyes|smile)/gi, '');
    promptParts.push(sanitized.trim());
  }

  return {
    prompt: promptParts.filter(Boolean).join(', '),
    negative_prompt: negativePromptParts.filter(Boolean).join(', ')
  };
}
