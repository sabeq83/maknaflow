# Implementation Plan - Perbaikan Error JSON Parser pada Recipe OPC Pillar Generator

Rencana ini merinci perbaikan kegagalan parsing JSON pada step `pillar_generator` untuk kampanye Recipe OPC (seperti item `#1829`), di mana respons panjang dari Gemini mengalami glitch karakter tanda kutip yang tidak ter-escape (`Expected ',' or '}' after property value in JSON at position 7049 (line 119 column 5)`).

---

## 1. Analisis & Ruang Lingkup Perubahan

| Komponen | Kondisi Saat Ini (As-Is) | Rencana Perubahan (To-Be) |
| :--- | :--- | :--- |
| **`lib/recipe-production-adapter.js` (Parser)** | Menggunakan `cleanJsonResponse` + `JSON.parse` mentah. | Menggunakan `safeParseRecipeJson` berbasis `jsonrepair` multi-tier yang kebal terhadap unescaped quotes, missing commas, dan trailing commas. |
| **`lib/recipe-production-adapter.js` (AI Call)** | Memanggil `getGeminiModel()` standar tanpa `maxOutputTokens: 65535` dan tanpa key pool. | Menggunakan `generateContentFlexible` dari `lib/gemini.js` yang mendukung key pool rotation, retry cascade waterfall, dan batas output token 65.535. |
| **`lib/recipe-planner-engine.js` (Hardening)** | Menggunakan `JSON.parse` mentah di 2 titik. | Menambahkan fallback `jsonrepair` pada parsing respons ide resep. |
| **`lib/content-planner-engine.js` (Hardening)** | Menggunakan `JSON.parse` mentah pada `callGeminiJson`. | Menambahkan fallback `jsonrepair` pada parsing skeleton dan creative generator. |
| **Automated Unit Test** | Belum ada tes simulasi kegagalan JSON glitch pada recipe production adapter. | Menambahkan `tests/recipe-json-repair.test.js`. |
| **Server Deployment** | Versi v2.32.81 belum menyertakan perbaikan. | Rilis patch `v2.32.82` dan deploy ke Staging via Git-Based Atomic Deployment. |

---

## 2. Before & After Code Snippets

### File 1: `lib/recipe-production-adapter.js`

#### Code Sebelum (Current/Before)
```javascript
import { getGeminiModel } from './gemini.js';
...
function cleanJsonResponse(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}
...
  const model = await getGeminiModel();
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: `${systemInstruction}\n\n${prompt}` }] }],
    generationConfig: { temperature: 0.7, responseMimeType: 'application/json' }
  });

  const responseText = result.response.text();
  const parsed = JSON.parse(cleanJsonResponse(responseText));
```

#### Code Sesudah (Proposed/After)
```javascript
import { generateContentFlexible } from './gemini.js';
import { jsonrepair } from 'jsonrepair';
...
export function safeParseRecipeJson(text) {
  let cleaned = String(text || '').replace(/^\uFEFF/, '').trim();
  const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) cleaned = jsonMatch[1].trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch (err1) {
    try {
      return JSON.parse(jsonrepair(cleaned));
    } catch (err2) {
      try {
        const stripped = cleaned.replace(/[\x00-\x09\x0b\x0c\x0e-\x1f]/g, '');
        return JSON.parse(jsonrepair(stripped));
      } catch (err3) {
        const fixedQuotes = cleaned.replace(/([a-zA-Z0-9,.:;!?])"([a-zA-Z0-9\s])/g, '$1\\"$2');
        return JSON.parse(jsonrepair(fixedQuotes));
      }
    }
  }
}
...
  const responseText = await generateContentFlexible({
    prompt: `${systemInstruction}\n\n${prompt}`,
    taskType: 'RECIPE_CAMPAIGN_CREATIVE',
    timeoutMs: 180000
  });

  const parsed = safeParseRecipeJson(responseText);
```

---

## 3. Execution Task List

- [x] **Task 1**: Update `lib/recipe-production-adapter.js` untuk mengimplementasikan `safeParseRecipeJson` dengan `jsonrepair` dan migrasi pemanggilan AI ke `generateContentFlexible`.
- [x] **Task 2**: Hardening parser di `lib/recipe-planner-engine.js` dan `lib/content-planner-engine.js` dengan fallback `jsonrepair`.
- [x] **Task 3**: Buat automated unit test suite `tests/recipe-json-repair.test.js` dan jalankan pengujian.
- [ ] **Task 4**: Rilis patch `v2.32.82` (`npm run release-non-interactive`).
- [ ] **Task 5**: Deploy ke server Staging Mac Mini via Git-based Atomic Deployment.
- [ ] **Task 6**: Verifikasi eksekusi item `#1829` pada server Staging.
