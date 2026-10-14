import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeI2vPrompt } from '../lib/prompts.js';

test('sanitizeI2vPrompt: safely de-personalizes Reno and face triggers to prevent prominent_person errors', () => {
  // Case 1: Prompt mentioning Reno and welcoming eye contact
  const rawPrompt1 = '(VERTICAL 9:16) --ar 9:16 [LAYER 1: INPUT & STYLE LOCK] (Start Frame: clip 8 start frame). Reno smiles warmly and gestures invitingly towards the viewer. Reno maintains welcoming eye contact with gentle animated blinking and an affable smile.';
  const sanitized1 = sanitizeI2vPrompt(rawPrompt1);

  assert.doesNotMatch(sanitized1, /\bReno\b/);
  assert.doesNotMatch(sanitized1, /\bwelcoming\s+eye\s+contact\b/i);
  assert.doesNotMatch(sanitized1, /\baffable\s+smile\b/i);
  assert.match(sanitized1, /the 3D presenter/);
  assert.match(sanitized1, /pleasant animated expression/);
  assert.match(sanitized1, /friendly expression/);

  // Case 2: Prompt with medium close-up and direct eye contact
  const rawPrompt2 = 'Camera slowly eases backward in a smooth medium close-up shot while maintaining direct eye contact.';
  const sanitized2 = sanitizeI2vPrompt(rawPrompt2);

  assert.doesNotMatch(sanitized2, /\bmedium\s+close-up\s+shot\b/i);
  assert.doesNotMatch(sanitized2, /\bdirect\s+eye\s+contact\b/i);
  assert.match(sanitized2, /medium shot/);
  assert.match(sanitized2, /steady confident posture/);
});
