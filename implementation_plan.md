# Implementation Plan: Arsitektur Skeduler Multi-Task & Non-Blocking Multiplier Lab (Selaras Pillar Campaign)

Rencana ini bertujuan mengeliminasi bottleneck **serial blocking** pada **Multiplier Lab** dengan mengadopsi model antrean multi-task seperti pada **Organic Pillar Campaign (OPC)**:
1. **Fase 1 (AI Storyboard / Gemini Generation)**: Tetap berjalan **sekuensial per baris** (Baris 1 selesai -> Baris 2 -> Baris 3 dst) untuk menjaga rate limit Gemini AI dan mencegah benturan prompt.
2. **Fase 2 (Audio TTS, Visuals G-Labs, FFmpeg Muxing)**: Menjadi **asinkron dan independen antar-baris**. Jika Baris 1 dan Baris 2 sama-sama disetujui (approved), **Baris 2 TIDAK PERLU MENUNGGU TTS Baris 1 selesai**. Keduanya dapat memproses TTS secara bersamaan.
3. **Eliminasi Global Mutex Lock**: Menghapus flag global `state.isMultiplierSyncRunning` yang selama ini membekukan seluruh scheduler, dan menggantinya dengan pelacakan per task ID di `state.activeTasks` (`multiplier_${task.id}`) seperti arsitektur `pillar_${item.id}`.

---

## 📋 Execution Task List

- [x] **Task 1: Pemisahan Query Database Task Fase 1 & Fase 2 (`lib/db.js`)**
  - [x] Tambahkan query `getEligibleFase1MultiplierTasks(limit)` khusus untuk task pembuatan naskah (`pending_resolution`, `resolving_product`, `remaking`) dengan aturan sekuensial per baris.
  - [x] Tambahkan query `getEligibleFase2MultiplierTasks(limit)` khusus untuk task produksi (`generating_audio`, `generating_visuals`, `ffmpeg_muxing`) tanpa blocking antar-baris.

- [x] **Task 2: Refactoring Worker Multiplier Menjadi Task Processor Tunggal (`lib/re-multiplier-worker.js`)**
  - [x] Buat fungsi `processSingleMultiplierTask(task)` yang memproses state machine per baris/task secara terisolasi tanpa loop `for..await` monolitik.
  - [x] Pastikan logging tetap rapi dan transisi status (`generating_audio` -> `generating_visuals` -> `ffmpeg_muxing` -> `completed`) terisolasi pada task tersebut.

- [x] **Task 3: Refactoring Skeduler Multiplier Lab di `lib/campaign-scheduler.js`**
  - [x] Hapus global mutex `state.isMultiplierSyncRunning` yang membekukan scheduler.
  - [x] Implementasikan multi-task loop menggunakan `state.activeTasks` dengan taskKey `multiplier_${task.id}`.
  - [x] Terapkan batas concurrency yang aman (misal max 3-4 task Fase 2 berjalan paralel) untuk mencegah lonjakan pemakaian resource lokal.

- [x] **Task 4: Pengujian & Verifikasi**
  - [x] Uji unit test dan skrip simulasi concurrency untuk membuktikan Baris 1 dan Baris 2 dapat memproses TTS secara bersamaan.
  - [x] Uji build Next.js (`npm run build`) untuk memastikan integritas bundle.

---

## 🔍 Before & After Code Snippets

### 1. `lib/db.js` — Pemisahan Query Fase 1 (Sekuensial) dan Fase 2 (Independen)

#### Code Sebelum (Current/Before):
```javascript
// lib/db.js:L3335-L3348
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

#### Code Sesudah (Proposed/After):
```javascript
// lib/db.js
// Query khusus Fase 1: Sekuensial per baris (Gemini AI Storyboard)
export async function getEligibleFase1MultiplierTasks(limit = 2) {
  return await dbAll(`
    SELECT t.* FROM re_multiplier_tasks t
    WHERE t.status IN ('pending_resolution', 'resolving_product', 'remaking')
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

// Query khusus Fase 2: Independen antar-baris (TTS, Visuals, FFmpeg)
export async function getEligibleFase2MultiplierTasks(limit = 6) {
  return await dbAll(`
    SELECT t.* FROM re_multiplier_tasks t
    WHERE t.status IN ('generating_audio', 'generating_visuals', 'ffmpeg_muxing')
    ORDER BY t.created_at ASC, t.row_index ASC
    LIMIT ?
  `, [limit]);
}
```

---

### 2. `lib/re-multiplier-worker.js` — Isolasi Eksekusi per Task Tunggal

#### Code Sebelum (Current/Before):
```javascript
// lib/re-multiplier-worker.js:L86-L146
export async function processNextMultiplierTask() {
  const tasks = await getEligibleSequentialMultiplierTasks(2);
  if (!tasks || tasks.length === 0) return;

  logToMultiplier(`[Multiplier Worker] Ditemukan ${tasks.length} task eligible untuk dieksekusi sekuensial.`);

  const { tenantContext } = await import('./tenant-context.js');
  const db = getDb();

  for (const task of tasks) {
    const tenantId = task.tenant_id || 'default_tenant';
    await tenantContext.run(tenantId, async () => {
      // Loop serial memblokir task berikutnya sampai task ini selesai
      let currentStatus = task.status;
      let activeTask = task;
      let maxIterations = 5;
      while (maxIterations > 0) {
        if (currentStatus === 'generating_audio') {
          await handleAudioGeneration(activeTask);
        } else if (currentStatus === 'generating_visuals') {
          await handleVisualGeneration(activeTask);
        }
        ...
      }
    });
  }
}
```

#### Code Sesudah (Proposed/After):
```javascript
// lib/re-multiplier-worker.js
export async function processSingleMultiplierTask(task) {
  const { tenantContext } = await import('./tenant-context.js');
  const db = getDb();
  const tenantId = task.tenant_id || 'default_tenant';

  await tenantContext.run(tenantId, async () => {
    const rowNum = (task.row_index !== undefined && task.row_index !== null) ? Number(task.row_index) + 1 : '?';
    logToMultiplier(`[Multiplier Worker] [Task ${task.id}] Baris ${rowNum} executing stage: ${task.status}`);

    try {
      let currentStatus = task.status;
      let activeTask = task;
      let maxIterations = 3;

      while (maxIterations > 0) {
        if (currentStatus === 'pending_resolution' || currentStatus === 'resolving_product') {
          await handleProductResolution(activeTask);
        } else if (currentStatus === 'remaking') {
          await handleStoryboardRemake(activeTask);
        } else if (currentStatus === 'generating_t2i') {
          await handleT2iGeneration(activeTask);
        } else if (currentStatus === 'generating_audio') {
          await handleAudioGeneration(activeTask);
        } else if (currentStatus === 'generating_visuals') {
          await handleVisualGeneration(activeTask);
        } else if (currentStatus === 'ffmpeg_muxing') {
          await handleFFmpegMuxing(activeTask);
        } else {
          break; // Terminal state (completed, failed, waiting_approval)
        }

        const nextTask = await db.prepare('SELECT * FROM re_multiplier_tasks WHERE id = ?').get(activeTask.id);
        if (!nextTask || nextTask.status === currentStatus) break;
        if (nextTask.status === 'generating_visuals' && nextTask.glabs_task_ids) break;

        currentStatus = nextTask.status;
        activeTask = nextTask;
        maxIterations--;
      }
    } catch (error) {
      console.error(`[Multiplier Worker] Error processing task ${task.id}:`, error.message);
      await updateMultiplierTask(task.id, { status: 'failed', error_message: error.message });
    }
  });
}
```

---

### 3. `lib/campaign-scheduler.js` — Non-Blocking Multi-Task Scheduler Tick

#### Code Sebelum (Current/Before):
```javascript
// lib/campaign-scheduler.js:L956-L978
  // --- MULTIPLIER LAB SCHEDULER TICK ---
  if (!state.lastMultiplierSyncTime) state.lastMultiplierSyncTime = 0;
  if (state.isMultiplierSyncRunning === undefined) state.isMultiplierSyncRunning = false;

  const isMultiplierActive = await getSetting('multiplier_scheduler_active') !== 'false';

  if (now - state.lastMultiplierSyncTime >= 10_000 && !state.isMultiplierSyncRunning && isMultiplierActive) {
    state.isMultiplierSyncRunning = true;
    const { processNextMultiplierTask, logToMultiplier } = await import('./re-multiplier-worker.js');
    
    logToMultiplier('=== MESIN MULTIPLIER SINKRONISASI MULAI ===');
    processNextMultiplierTask()
      .then(() => {
        state.lastMultiplierSyncTime = Date.now();
        logToMultiplier('=== MESIN MULTIPLIER SINKRONISASI SELESAI ===');
      })
      .catch(err => {
        logToMultiplier(`[Scheduler Error] Multiplier task failed: ${err.message}`);
      })
      .finally(() => {
        state.isMultiplierSyncRunning = false;
      });
  }
```

#### Code Sesudah (Proposed/After):
```javascript
// lib/campaign-scheduler.js:L956-L978
  // --- MULTIPLIER LAB SCHEDULER TICK (v8.6 Non-Blocking Multi-Task Queue) ---
  const isMultiplierActive = await getSetting('multiplier_scheduler_active') !== 'false';

  if (isMultiplierActive) {
    const { 
      getEligibleFase1MultiplierTasks, 
      getEligibleFase2MultiplierTasks 
    } = await import('./db.js');
    const { processSingleMultiplierTask } = await import('./re-multiplier-worker.js');

    // 1. Eksekusi Fase 1 (Sourcing & Storyboard AI) — Tetap Sekuensial per Baris
    const fase1Tasks = await getEligibleFase1MultiplierTasks(1);
    for (const task of fase1Tasks) {
      const taskKey = `multiplier_${task.id}`;
      if (!state.activeTasks.has(taskKey)) {
        state.activeTasks.add(taskKey);
        processSingleMultiplierTask(task)
          .catch(err => console.error(`[Multiplier Scheduler] Fase 1 Task #${task.id} error:`, err.message))
          .finally(() => state.activeTasks.delete(taskKey));
      }
    }

    // 2. Eksekusi Fase 2 (Audio TTS, Visuals, FFmpeg) — Konkuren & Independen Antar-Baris
    const MAX_PARALLEL_FASE2 = 3;
    const currentActiveFase2 = Array.from(state.activeTasks).filter(k => k.startsWith('multiplier_')).length;
    const availableSlots = Math.max(0, MAX_PARALLEL_FASE2 - currentActiveFase2);

    if (availableSlots > 0) {
      const fase2Tasks = await getEligibleFase2MultiplierTasks(availableSlots);
      for (const task of fase2Tasks) {
        const taskKey = `multiplier_${task.id}`;
        if (!state.activeTasks.has(taskKey)) {
          state.activeTasks.add(taskKey);
          processSingleMultiplierTask(task)
            .catch(err => console.error(`[Multiplier Scheduler] Fase 2 Task #${task.id} error:`, err.message))
            .finally(() => state.activeTasks.delete(taskKey));
        }
      }
    }
  }
```
