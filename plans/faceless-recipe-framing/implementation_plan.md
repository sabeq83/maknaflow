# Implementation Plan: Faceless Hands-Only Framing, Batch Prompt Injection, & Multi-Node Deployment

## 1. Executive Summary & Problem Context
Pada kampanye resep (seperti `opc_260930_i2mczt` di staging), generator Start Frame kerap memunculkan wajah/kepala subjek meskipun telah disetel mode faceless.

### Analisis Akar Masalah:
1. **Dominasi Kata Benda Primer (*Noun Bias*)**: Prompt diawali kata `a Caucasian man` / `a graceful Muslimah` yang memicu neural network merender figur manusia utuh.
2. **Efek *Pink Elephant* pada Prompt Positif**: Menyebut kata `omitting face, head, neck, chest` justru membuat token `face` dan `head` dihitung oleh text encoder AI.
3. **Ketiadaan *Negative Prompt* Eksplisit pada Start Frame Request**: Payload generator T2I GLabs (`nano_banana_2`) belum menyematkan negative prompt anatomi wajah & tubuh bagian atas.
4. **Kesesuaian Sudut Kamera untuk Recipe Campaign (Usulan C)**: Sudut **Top-down 45-degree tabletop macro / tight overhead framing** adalah standar terbaik untuk konten kuliner, karena memusatkan 100% perhatian penonton pada bahan, alat masak, dan proses transformasi makanan tanpa distraksi wajah.
5. **Kebutuhan Sinkronisasi Database Staging**: 15 baris item (ID 1533–1547, total 90 klip) pada kampanye `opc_260930_i2mczt` saat ini masih menyimpan prompt lama berformat `a Caucasian man ... strictly omitting the face`. Seluruh baris ini wajib diinjeksi ulang (*batch update*) dengan formula prompt `t2i_prompt` dan `i2v_prompt` terbaru.
6. **Deployment Standar Multi-Node**: Setelah verifikasi lokal berhasil, perubahan wajib dirilis via git release non-interaktif lalu dideploy secara atomic ke Server Dev (Port 5020/7020) dan Server Staging (Port 5010/7010).

---

## 2. Execution Task List

- [x] **Task 1: Refaktor `DEMOGRAPHIC_PRESETS` di `lib/prompts.js`** (Hands & Forearms-First Framing)
- [x] **Task 2: Perbarui Resolver Subjek di `lib/visual-override-resolver.js`**
- [x] **Task 3: Standarkan Framing Mandate di `lib/recipe-production-adapter.js`** (Top-down 45° Tabletop Macro)
- [x] **Task 4: Injeksi Otomatis `negative_prompt` pada `lib/opc-start-frame-request.js`**
- [x] **Task 5: Sinkronisasi Dokumentasi SOT di `sot/global/vso-engine.md`**
- [x] **Task 6: Eksekusi Skrip Batch Injection Prompt T2I & I2V ke Seluruh Baris Kampanye `opc_260930_i2mczt` di Staging DB**
- [x] **Task 7: Uji Validasi Unit Test & Verifikasi Data Hasil Injeksi di Server Staging**
- [x] **Task 8: SOP Rilis & Auto Git Sync (`npm run release-non-interactive`)**
- [x] **Task 9: SOP Git-Based Atomic Deployment ke Server Dev Mac Mini (Port 5020/7020)**
- [x] **Task 10: SOP Git-Based Atomic Deployment ke Server Staging Mac Mini (Port 5010/7010)**

---

## 3. Before & After Code Snippets

### File 1: `lib/prompts.js`

#### Code Sebelum (Current/Before):
```javascript
export const DEMOGRAPHIC_PRESETS = {
  syari_classic: "a graceful Southeast Asian Muslimah wearing modest long flowing sleeves covering the arms completely down to the wrists (strictly no short sleeves, strictly no bare arms, strictly no rolled-up sleeves), featuring delicate female hands with smooth light skin, slender fingers, and natural neat fingernails, strictly faceless framing, camera focused entirely on the forearms and hands, cropped from the elbow down to show only the forearms and hands, strictly omitting the face, head, neck, chest, and shoulders, showcasing precise hand actions and movements",
  southeast_asian_male: "a Southeast Asian man wearing clean casual attire, featuring clean male hands with warm light-tan smooth skin, natural neat fingernails, and a stylish wristwatch, strictly faceless framing, camera focused on the forearms and hands, cropped from the elbow down to show only the forearms and hands interacting naturally with the scene, strictly omitting the face, head, neck, chest, and shoulders, showcasing precise hand actions",
  caucasian_male: "a Caucasian man wearing clean casual long-sleeve attire covering the forearms, featuring clean male hands with smooth skin, natural neat fingernails, and a subtle wristwatch, strictly faceless framing, camera focused on the forearms, hands, and product workspace, cropped from the elbow down to show only the forearms and hands interacting naturally with the product, strictly omitting the face, head, neck, chest, and shoulders, showcasing precise hand actions",
  stylized_3d_muslimah: "a 3D stylized Muslim woman with a completely blank faceless smooth head (no eyes, nose, or mouth), dressed in an elegant loose-fitting modest abaya and a wide khimar covering her chest, smooth clay-like 3D render style, bare hands visible",
  stylized_3d_male: "a 3D stylized young male with a completely blank faceless smooth head (no eyes, nose, or mouth) and detailed short hair, dressed in clean casual attire, smooth clay-like 3D render style, bare hands visible",
  stylized_3d_duo: "two 3D stylized characters in the same scene, consisting of a Muslim woman dressed in modest clothing and a young male dressed in clean casual attire, both having completely blank faceless smooth heads (no eyes, nose, or mouth) in a smooth clay-like 3D render style, bare hands visible, showing clear interaction"
};
```

#### Code Sesudah (Proposed/After):
```javascript
export const DEMOGRAPHIC_PRESETS = {
  syari_classic: "POV close-up culinary framing focusing strictly on female forearms and hands covered in modest flowing sleeves down to the wrists (strictly no bare arms, strictly no rolled-up sleeves), featuring delicate female hands with smooth light Southeast Asian skin tone, slender fingers, and natural neat fingernails, hands actively manipulating ingredients and utensils on the tabletop workspace, camera tightly cropped from mid-forearm down to hands and tabletop",
  southeast_asian_male: "POV close-up culinary framing focusing strictly on male forearms and hands (warm light-tan Southeast Asian skin tone, clean neat fingernails, stylish minimalist wristwatch, casual long-sleeves rolled up past the forearms), hands actively manipulating ingredients and cookware on the tabletop workspace, camera tightly cropped from mid-forearm down to hands and tabletop",
  caucasian_male: "POV close-up culinary framing focusing strictly on male forearms and hands (fair Caucasian skin tone, clean neat fingernails, subtle minimalist wristwatch, casual long-sleeves rolled up past the forearms), hands actively manipulating ingredients and cookware on the tabletop workspace, camera tightly cropped from mid-forearm down to hands and tabletop",
  stylized_3d_muslimah: "a 3D stylized Muslim woman with a completely blank faceless smooth head (no eyes, nose, or mouth), dressed in an elegant loose-fitting modest abaya and a wide khimar covering her chest, smooth clay-like 3D render style, bare hands visible",
  stylized_3d_male: "a 3D stylized young male with a completely blank faceless smooth head (no eyes, nose, or mouth) and detailed short hair, dressed in clean casual attire, smooth clay-like 3D render style, bare hands visible",
  stylized_3d_duo: "two 3D stylized characters in the same scene, consisting of a Muslim woman dressed in modest clothing and a young male dressed in clean casual attire, both having completely blank faceless smooth heads (no eyes, nose, or mouth) in a smooth clay-like 3D render style, bare hands visible, showing clear interaction"
};
```

---

### File 2: `lib/visual-override-resolver.js`

#### Code Sebelum (Current/Before):
```javascript
    } else if (config.subject.custom_description) {
      const customSub = config.subject.custom_description.trim();
      if (config.subject.faceless_mode === 'hands_only' && !customSub.toLowerCase().includes('faceless') && !customSub.toLowerCase().includes('cropped')) {
        subjectPrompt = `${customSub}, strictly faceless framing, camera focused entirely on the forearms and hands, cropped from the elbow down to show only the forearms and hands, strictly omitting the face, head, neck, chest, and shoulders`;
      } else {
        subjectPrompt = customSub;
      }
    } else {
      subjectPrompt = 'a person featuring clean hands, strictly faceless framing, camera focused on the forearms and hands, cropped from the elbow down to show only the forearms and hands';
    }
```

#### Code Sesudah (Proposed/After):
```javascript
    } else if (config.subject.custom_description) {
      const customSub = config.subject.custom_description.trim();
      if (config.subject.faceless_mode === 'hands_only' && !customSub.toLowerCase().includes('pov') && !customSub.toLowerCase().includes('cropped')) {
        subjectPrompt = `POV close-up framing focusing strictly on forearms and hands of ${customSub}, hands actively working on the tabletop workspace, camera tightly cropped from mid-forearm down to hands and tabletop`;
      } else {
        subjectPrompt = customSub;
      }
    } else {
      subjectPrompt = 'POV close-up framing focusing strictly on clean forearms and hands working on the tabletop workspace, camera tightly cropped from mid-forearm down to hands and tabletop';
    }
```

---

### File 3: `lib/recipe-production-adapter.js`

#### Code Sebelum (Current/Before):
```javascript
  const visualMandate = [
    `STRICT FACELESS & VISUAL IDENTITY MANDATE (MANDATORY & CRITICAL):`,
    `- FACE VISIBILITY: PROHIBITED (DILARANG KERAS MENAMPILKAN WAJAH, KEPALA, MATA, MULUT, ATAU POTRET MANUSIA).`,
    `- FRAMING: Strictly cropped from the elbow down (forearms and hands only). Camera MUST focus exclusively on culinary hand movements, ingredients, and kitchen tools.`,
    `- ANCHOR: ${subjectAnchor}`,
```

#### Code Sesudah (Proposed/After):
```javascript
  const visualMandate = [
    `STRICT FACELESS & VISUAL IDENTITY MANDATE (MANDATORY & CRITICAL):`,
    `- FACE VISIBILITY: PROHIBITED (DILARANG KERAS MENAMPILKAN WAJAH, KEPALA, MATA, MULUT, ATAU POTRET MANUSIA).`,
    `- FRAMING: Top-down 45-degree tabletop macro or tight overhead culinary framing, strictly cropped from mid-forearm down to hands and tabletop workspace. Camera MUST focus exclusively on culinary hand movements, ingredients, and kitchen tools.`,
    `- ANCHOR: ${subjectAnchor}`,
```

---

### File 4: `lib/opc-start-frame-request.js`

#### Code Sebelum (Current/Before):
```javascript
  return {
    providerRequest: {
      prompt: providerPrompt,
      model: requestedModel,
      aspect_ratio: campaign?.aspect_ratio || '9:16',
      reference_images: references.length ? references : undefined,
      expected_reference_sha256s: referenceSha256s,
      webhookOverride: brandProfile
    },
```

#### Code Sesudah (Proposed/After):
```javascript
  const defaultFacelessNegativePrompt = 'human face, facial features, eyes, nose, mouth, head, headshot, portrait, hair, neck, torso, chest, shoulders, upper body, selfie, looking at camera, blurry hands, extra fingers, missing fingers, distorted limbs';

  return {
    providerRequest: {
      prompt: providerPrompt,
      negative_prompt: defaultFacelessNegativePrompt,
      model: requestedModel,
      aspect_ratio: campaign?.aspect_ratio || '9:16',
      reference_images: references.length ? references : undefined,
      expected_reference_sha256s: referenceSha256s,
      webhookOverride: brandProfile
    },
```

---

### File 5 (Skrip Migrasi / Batch Injection): `scripts/inject-opc-prompts-i2mczt.js`

#### Code Usulan (Proposed New Script):
```javascript
import { getDb } from '../lib/db.js';
import { DEMOGRAPHIC_PRESETS } from '../lib/prompts.js';

async function runPromptInjection() {
  const db = getDb();
  const campaignId = 'opc_260930_i2mczt';
  const newSubject = DEMOGRAPHIC_PRESETS.caucasian_male;
  
  // 1. Fetch all items in campaign
  const items = await db.prepare('SELECT id, new_video_plan_json FROM pillar_campaign_items WHERE campaign_id = ?').all(campaignId);
  console.log(`Found ${items.length} items for campaign ${campaignId}`);

  for (const item of items) {
    if (!item.new_video_plan_json) continue;
    let plan = JSON.parse(item.new_video_plan_json);
    
    // 2. Replace subject anchor across all clips in new_video_plan_json
    plan = plan.map(clip => {
      let t2i = clip.t2i_prompt || '';
      t2i = t2i.replace(/\(Anchor:[^)]+\)/gi, `(Anchor: ${newSubject})`);
      t2i = t2i.replace(/\(Biometric Anchor:[^)]+\)/gi, `(Anchor: ${newSubject})`);
      
      let i2v = clip.i2v_prompt || '';
      return {
        ...clip,
        t2i_prompt: t2i,
        i2v_prompt: i2v
      };
    });

    await db.prepare('UPDATE pillar_campaign_items SET new_video_plan_json = ? WHERE id = ?')
      .run(JSON.stringify(plan), item.id);
    console.log(`Injected updated prompt into Item ${item.id}`);
  }
}
```

---

## 4. Verification & Deployment Plan

1. **Unit Test Verification**:
   - Jalankan `npm test` untuk memastikan seluruh test suite lulus 100%.
2. **Batch Prompt Injection Verification**:
   - Eksekusi `scripts/inject-opc-prompts-i2mczt.js` pada database staging.
   - Verifikasi bahwa 15 item (90 klip) telah memiliki prompt yang diperbarui.
3. **SOP Rilis Non-Interaktif**:
   - `npm run release-non-interactive -- --type patch --title "Fix faceless culinary hands-only framing and prompt injection" --points "Refactor demographic presets to POV hands-first|Inject negative prompt in startframe requests|Standardize top-down 45-deg macro framing in recipe adapter|Batch inject updated prompts into opc_260930_i2mczt"`
4. **Atomic Deployment ke Server Dev (Mac Mini)**:
   - `npm run deploy:dev:atomic -- --ref <full-git-sha> --apply --confirm-dev`
   - Verifikasi UI Port 5020 (HTTP 200) & API Port 7020 (HTTP 200).
5. **Atomic Deployment ke Server Staging (Mac Mini)**:
   - `npm run deploy:staging -- --ref <full-git-sha> --apply --confirm-staging`
   - Verifikasi UI Port 5010 (HTTP 200) & API Port 7010 (HTTP 200).
