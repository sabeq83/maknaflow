# Implementation Plan: Penyelarasan Skeduler Multiplier Campaign dengan Pillar Campaign

Rencana ini bertujuan menyelaraskan arsitektur skeduler dan alur kerja kampanye **Multiplier Campaign** agar secepat, se-responsif, dan se-modular **Pillar Campaign**:
1. **Fase 1 Super Cepat (Text-First Architecture)**:
   - Menghentikan eksekusi otomatis T2I Start Frame di tengah-tengah Fase 1.
   - Begitu AI (Gemini Single-Pass) selesai menghasilkan naskah remake, video DNA, prompt T2I/I2V, dan caption, status baris langsung berpindah ke **`waiting_approval`** (Fase 2 : Paused / Ready for Review) dalam waktu **~10–15 detik per baris**.
   - 10 baris kampanye Multiplier dapat selesai dibuat dalam waktu **~1,5 – 2,5 menit** (sebelumnya butuh ~25 menit).
2. **Pelonggaran Kunci Sekuensial Antar Baris (`getEligibleSequentialMultiplierTasks`)**:
   - Menghapus `'generating_t2i'` dari syarat blocking antar baris.
   - Baris berikutnya tidak lagi terhambat oleh proses render gambar atau visual baris sebelumnya.
3. **Penyelarasan Fase 2 & Eliminasi Double Delay**:
   - Menghapus jeda manual hardcoded `setTimeout(10000)` di loop pengiriman video `handleVisualGeneration`.
   - Mengandalkan satu sumber kebenaran terpusat untuk safety pacing yaitu `applyRandomDelay()` di `lib/webhook-client.js`.
4. **Optimasi Start Frame On-Demand**:
   - Menghapus double safety delay di `app/api/v2/multiplier/[id]/regenerate-start-frames/route.js`.
   - Memastikan tombol *"Generate All Start Frame"* bekerja cepat dan independen saat pengguna memutuskan untuk melihat/membuat visual adegan.

---

## 📋 Execution Task List

- [x] **Task 1: Penyelarasan Fase 1 Multiplier Worker (`lib/re-multiplier-worker.js`)**
  - [x] Di fungsi `handleStoryboardRemake`, ubah `nextStatus` menjadi langsung `'waiting_approval'` setelah Gemini remake & audit naskah selesai (lewati transisi otomatis ke `generating_t2i`).
  - [x] Pastikan seluruh metadata naskah, video DNA, dan prompt tersimpan dengan aman sebelum masuk ke status review.

- [x] **Task 2: Pelonggaran Kunci Antar Baris di Database (`lib/db.js`)**
  - [x] Perbarui query di `getEligibleSequentialMultiplierTasks` dengan menghapus status `'generating_t2i'` dari daftar `prev.status IN (...)`.
  - [x] Pastikan baris-baris berikutnya dapat memproses naskah secara paralel/cepat tanpa menunggu gambar visual baris sebelumnya.

- [x] **Task 3: Eliminasi Double Delay pada Fase 2 Visual Generation (`lib/re-multiplier-worker.js`)**
  - [x] Selaraskan pacing delay di `handleVisualGeneration` dengan tetap mematuhi micro-pacing safety guardrail.
  - [x] Pastikan pengiriman request ke G-Labs tetap aman karena telah dilindungi oleh `applyRandomDelay('video')` di `lib/webhook-client.js`.

- [x] **Task 4: Optimasi Rute Regenerasi Start Frame On-Demand (`app/api/v2/multiplier/[id]/regenerate-start-frames/route.js`)**
  - [x] Hapus double delay manual (baris 178–180) agar pengiriman prompt start frame tidak tertahan dua kali jeda.
  - [x] Pastikan penanganan progres real-time (`regenerate_start_frames_progress`) tetap terlaporkan ke UI dengan akurat.

- [x] **Task 5: Pengujian, Verifikasi & Validasi**
  - [x] Jalankan unit test skeduler & Multiplier (`tests/multiplier-*.test.js`).
  - [x] Uji build Next.js (`npm run build`) untuk memastikan integritas rute dan kompilasi bundle.
  - [x] Pastikan alur transisi Fase 1 langsung menuju `waiting_approval` (Fase 2 : Paused / Ready for Review).

---

## 🔍 Before & After Code Snippets

### 1. `lib/re-multiplier-worker.js` — Penyelarasan Fase 1 (Langsung ke `waiting_approval`)

#### Code Sebelum (Current/Before):
```javascript
// lib/re-multiplier-worker.js:L439-L442
  const hasGlabs = audio.enableGlabs === 1 || audio.enableGlabs === true;
  const visualMode = bridging.visualMode || 'pure_t2v';
  const hasT2i = (hasGlabs && bridging.isBridgingActive && visualMode === 'hybrid_lock');
  const nextStatus = hasT2i ? 'generating_t2i' : 'waiting_approval';

  await updateMultiplierTask(task.id, {
    remake_storyboard_json: JSON.stringify(safeVoiceover),
    original_voiceover: JSON.stringify(voiceover),
    tiktok_safe_voiceover: JSON.stringify(safeVoiceover),
    compliance_status: complianceStatus,
    compliance_score: complianceScore,
    compliance_log_json: complianceLog ? JSON.stringify(complianceLog) : null,
    selected_vo_version: 'original',
    t2i_i2v_prompts_json: JSON.stringify(parsed.prompts || []),
    new_caption: parsed.caption || '',
    yt_title: sanitizedYtTitle,
    status: nextStatus
  });
```

#### Code Sesudah (Proposed/After):
```javascript
// lib/re-multiplier-worker.js:L439-L442
  // Selaras dengan Organic Pillar Campaign (Mode Storyboard Approval):
  // Fase 1 selesai begitu naskah, video DNA, dan prompt selesai digenerate oleh Gemini.
  // Start Frame T2I tidak dipaksakan jalan otomatis, melainkan on-demand saat user review di Fase 2.
  const nextStatus = 'waiting_approval';

  await updateMultiplierTask(task.id, {
    remake_storyboard_json: JSON.stringify(safeVoiceover),
    original_voiceover: JSON.stringify(voiceover),
    tiktok_safe_voiceover: JSON.stringify(safeVoiceover),
    compliance_status: complianceStatus,
    compliance_score: complianceScore,
    compliance_log_json: complianceLog ? JSON.stringify(complianceLog) : null,
    selected_vo_version: 'original',
    t2i_i2v_prompts_json: JSON.stringify(parsed.prompts || []),
    new_caption: parsed.caption || '',
    yt_title: sanitizedYtTitle,
    status: nextStatus
  });
```

---

### 2. `lib/db.js` — Pelonggaran Kunci Antar Baris (`getEligibleSequentialMultiplierTasks`)

#### Code Sebelum (Current/Before):
```javascript
// lib/db.js:L3335-L3347
export async function getEligibleSequentialMultiplierTasks(limit = 4) {
  return await dbAll(`
    SELECT t.* FROM re_multiplier_tasks t
    WHERE t.status IN ('pending_resolution', 'resolving_product', 'remaking', 'generating_t2i', 'generating_audio', 'generating_visuals', 'ffmpeg_muxing')
      AND NOT EXISTS (
        SELECT 1 FROM re_multiplier_tasks prev
        WHERE prev.batch_id = t.batch_id
          AND prev.row_index < t.row_index
          AND prev.status IN ('draft', 'pending_resolution', 'resolving_product', 'remaking', 'generating_t2i')
      )
    ORDER BY t.created_at ASC, t.row_index ASC
    LIMIT ?
  `, [limit]);
}
```

#### Code Sesudah (Proposed/After):
```javascript
// lib/db.js:L3335-L3347
export async function getEligibleSequentialMultiplierTasks(limit = 4) {
  return await dbAll(`
    SELECT t.* FROM re_multiplier_tasks t
    WHERE t.status IN ('pending_resolution', 'resolving_product', 'remaking', 'generating_t2i', 'generating_audio', 'generating_visuals', 'ffmpeg_muxing')
      AND NOT EXISTS (
        SELECT 1 FROM re_multiplier_tasks prev
        WHERE prev.batch_id = t.batch_id
          AND prev.row_index < t.row_index
          AND prev.status IN ('draft', 'pending_resolution', 'resolving_product', 'remaking')
      )
    ORDER BY t.created_at ASC, t.row_index ASC
    LIMIT ?
  `, [limit]);
}
```

---

### 3. `lib/re-multiplier-worker.js` — Penghapusan Double Delay pada Fase 2 Visual

#### Code Sebelum (Current/Before):
```javascript
// lib/re-multiplier-worker.js:L810-L823
      await updateMultiplierTask(task.id, {
        glabs_task_ids: JSON.stringify(submittedTaskIds)
      });

      // Micro-pacing pacing delay: jeda 10s antar pengiriman klip baru (selaras Pillar Campaign)
      if (c < prompts.length) {
        logToMultiplier(`[Multiplier Worker] ⏳ Micro-pacing delay: menunggu 10 detik sebelum klip ${c + 1}...`);
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }

    await updateMultiplierTask(task.id, {
      glabs_task_ids: JSON.stringify(submittedTaskIds)
    });
```

#### Code Sesudah (Proposed/After):
```javascript
// lib/re-multiplier-worker.js:L810-L823
      await updateMultiplierTask(task.id, {
        glabs_task_ids: JSON.stringify(submittedTaskIds)
      });

      // Note: Pacing safety delay 10-20s sudah ditangani secara terpusat oleh applyRandomDelay('video') di webhook-client.js
    }

    await updateMultiplierTask(task.id, {
      glabs_task_ids: JSON.stringify(submittedTaskIds)
    });
```

---

### 4. `app/api/v2/multiplier/[id]/regenerate-start-frames/route.js` — Eliminasi Double Delay Start Frame

#### Code Sebelum (Current/Before):
```javascript
// app/api/v2/multiplier/[id]/regenerate-start-frames/route.js:L170-L182
      // Update progress in database
      await dbRun(`
        UPDATE re_multiplier_tasks
        SET regenerate_start_frames_progress = ?
        WHERE id = ?
      `, [`${i + 1}/${totalCount}`, taskId]).catch(() => {});

      // Safety Delay (5-10 seconds) before sending next prompt
      if (i < totalCount - 1) {
        const delayMs = 5000 + Math.floor(Math.random() * 5000);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
```

#### Code Sesudah (Proposed/After):
```javascript
// app/api/v2/multiplier/[id]/regenerate-start-frames/route.js:L170-L182
      // Update progress in database
      await dbRun(`
        UPDATE re_multiplier_tasks
        SET regenerate_start_frames_progress = ?
        WHERE id = ?
      `, [`${i + 1}/${totalCount}`, taskId]).catch(() => {});

      // Safety delay terpusat telah ditangani otomatis oleh applyRandomDelay('image') di webhook-client.js
    }
```
