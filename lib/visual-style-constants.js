/**
 * Centralized Visual Style, Optics & Narrative Mode Hub
 * File: lib/visual-style-constants.js
 * Single Source of Truth untuk gaya visual, kontrol kamera, opsi visibilitas wajah, dan mode narasi.
 */

export const VISUAL_STYLES = [
  { id: 'Cinematic', label: '🎬 Cinematic 4K Film (Rich Depth & Film Grain)', promptKeyword: 'cinematic 4k film, shallow depth of field, anamorphic bokeh, filmic color grading' },
  { id: 'Food Porn', label: '🍳 Photorealistic Culinary / Food Porn (Ultra Macro)', promptKeyword: 'ultra-macro food photography, mouth-watering glistening textures, rich steam details, commercial culinary lighting' },
  { id: 'Realistic UGC', label: '📱 Realistic UGC Smartphone (Authentic Casual)', promptKeyword: 'authentic smartphone camera footage, natural handheld movement, unstaged authentic lighting, everyday realism' },
  { id: 'Studio Commercial', label: '💡 Clean Studio Commercial (High-End Product)', promptKeyword: 'flawless studio product photography, pristine softbox lighting, crisp clean reflections, sharp optics' },
  { id: 'Warm Nostalgic', label: '☕ Warm Cozy Nostalgic (Golden Hour & Earthy)', promptKeyword: 'warm golden hour sun flare, cozy earthy palette, soft nostalgic shadows, gentle film roll-off' },
  { id: 'Moody Shadow', label: '🌑 Moody Chiaroscuro (Dramatic Contrast)', promptKeyword: 'dramatic chiaroscuro lighting, deep cinematic contrast, sculpted key light, mysterious atmospheric shadows' },
  { id: '3D Claymation Cozy', label: '🧸 3D Stylized Claymation (Stop-Motion)', promptKeyword: 'adorable 3D stylized claymation character, smooth matte organic clay textures, gentle tactile stop-motion aesthetic' }
];

export const FACE_VISIBILITY_OPTIONS = [
  { id: 'Faceless', label: '👤 Faceless (Fokus Tangan, Bahan & Alat)', desc: 'Kamera fokus dari pergelangan tangan ke meja kerja, tanpa menampakkan wajah.' },
  { id: 'POV', label: '👁️ POV / First-Person View (Sudut Pandang Pribadi)', desc: 'Sudut pandang mata subjek sendiri yang sedang beraktivitas.' },
  { id: 'Silhouette', label: '👥 Silhouette & Side Profile (Artistik / Minimalis)', desc: 'Siluet subjek dari samping berpadu pencahayaan kontras.' },
  { id: 'Full Presenter', label: '🧑 Presenter Utuh / Host', desc: 'Menampakkan subjek presenter atau avatar 3D secara penuh.' }
];

export const NARRATIVE_MODES = [
  { id: 'Storytelling', label: '📖 Storytelling (Refleksi, Bercerita & Keseharian)', desc: 'Alur kronologis bercerita yang menggugah emosi dan estetika proses.' },
  { id: 'Problem-Solution', label: '💡 Problem-Solution (Mengatasi Masalah Nyata)', desc: 'Eskalasi keluhan penonton lalu pivot ke solusi konkret yang melegakan.' },
  { id: 'Educational', label: '🎓 Educational / Tutorial (Fakta & Tips Ilmiah)', desc: 'Penjelasan logis, tips terstruktur, dan edukasi praktis bernilai tinggi.' }
];

export function getVisualStylePromptTokens(styleId) {
  const match = VISUAL_STYLES.find(s => s.id === styleId);
  return match ? match.promptKeyword : 'cinematic realistic high-fidelity photography';
}
