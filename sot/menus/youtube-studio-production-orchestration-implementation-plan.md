# Implementation Plan — YouTube Studio Fase 3.5C: Production Orchestration & Approval Gates

> Status: Planned.  
> Scope: Menghidupkan eksekusi job Fase 3 hybrid di Mac Mini Dev, memperbaiki state approval batch, dan membuat UI menampilkan status produksi yang nyata.  
> Non-goal: Publishing Studio/Fase 4, upload YouTube, analytics, atau perubahan pada data sumber episode.  
> Deployment target: **Mac Mini Dev only**.

## 1. Temuan yang Dikonfirmasi

Klik **Approve & Start Production** tidak inert, tetapi berhenti setelah enqueue:

```text
UI hybrid approval
→ package menjadi approved
→ start-frame jobs dibuat
→ scheduler_jobs: pending
→ youtube_production_jobs: queued
→ tidak ada worker yang meng-claim job
```

Bukti Dev 2026-08-22:

- package hybrid `ytpp_e30olicj` menjadi `approved`;
- dua job start frame dibuat, keduanya `queued`, progress `0`;
- dua scheduler job `youtube_production_asset` berada pada `pending`, attempts `0`;
- `scheduler_config` tidak memiliki queue YouTube;
- scheduler hanya melakukan tick terhadap queue yang ada di `scheduler_config`;
- queue yang benar-benar dipakai (`youtube_production_asset`, `youtube_production_assembly`, `youtube_production_final`) belum dideklarasikan sebagai queue production yang dapat di-bootstrap;
- UI saat ini menampilkan pesan “Asset generation has started” sebelum worker benar-benar meng-claim job.

Selain itu, state hybrid sekarang keliru: start-frame/voiceover/visual batch dibuat langsung `approved`, padahal seharusnya melalui `queued → generating → reviewing → approved`.

## 2. Outcome yang Harus Dicapai

Satu episode hybrid kecil di Dev harus dapat bergerak secara transparan:

```text
Prompt package draft
→ approve prompt package
→ start-frame batch queued/generating
→ start-frame assets reviewing
→ approve start-frame batch
→ VO batch queued/generating
→ VO assets reviewing
→ approve VO batch
→ visual-video jobs (I2V/T2V)
→ preview ready
→ explicit final-render approval
→ Ready to Publish
```

Aturan utama:

1. Approval hanya membuat job yang eligible; worker yang mengubah job menjadi `running`.
2. Tidak ada batch boleh otomatis `approved` sebelum review manusia.
3. Queue worker bersifat durable, tenant-aware, idempotent, retryable, dan dapat diamati.
4. Tiap aksi UI menampilkan `queued`, `running`, `reviewing`, `completed`, atau `failed` berdasarkan data server—bukan optimistic success state.
5. Start-frame T2I, TTS, G-Labs I2V/T2V, preview, dan final render hanya terjadi setelah gate sebelumnya terpenuhi.

## 3. Keputusan Arsitektur

### 3.1 Single durable queue contract

Tetap gunakan `scheduler_jobs` PostgreSQL sebagai outbox durable untuk semua job YouTube. Jangan membuat tabel queue kedua dan jangan memproses job langsung dari request HTTP.

Queue yang wajib terdaftar dan diproses:

| Queue | Payload minimal | Processor |
|---|---|---|
| `youtube_production_asset` | `job_id`, `tenant_id` | start frame, VO, I2V/T2V, static/b-roll handling |
| `youtube_production_assembly` | `job_id`, `package_id`, `tenant_id` | preview assembly |
| `youtube_production_final` | `job_id`, `package_id`, `tenant_id` | final render |

Worker boleh memakai scheduler runtime yang sudah ada **hanya jika** worker tersebut benar-benar diboot di satu proses Dev dan semua queue di atas di-bootstrap. Jika tidak, implementasikan worker loop khusus yang memakai `FOR UPDATE SKIP LOCKED`, interval terkonfigurasi, graceful shutdown, dan satu ownership runtime. Jangan menjalankan dua consumer yang meng-claim queue yang sama.

### 3.2 State machine batch

```text
batch: queued → generating → reviewing → approved | rejected | failed
asset: draft → queued → running → reviewing | succeeded | retryable_failed | failed | superseded
package: draft → approved → generating → preview_ready → final_rendering → completed | failed
```

- Prompt approval membuat batch `start_frame` berstatus `queued`; worker memindahkannya ke `generating` lalu `reviewing` ketika seluruh start frame berhasil.
- Start-frame approval hanya boleh dilakukan jika seluruh asset batch sudah `reviewing` dan setiap `t2i_i2v` punya `image_path` yang tervalidasi.
- VO mengikuti pola identik.
- Approval VO membuat visual jobs: `t2i_i2v` memakai `image_to_video`; `t2v` memakai `text_to_video`; static/b-roll tidak boleh dipalsukan sebagai hasil video final.
- Preview assembly hanya di-enqueue jika semua asset yang diperlukan telah berhasil/reviewed; final render selalu aksi eksplisit sesudah preview approved.

### 3.3 Bootstrap dan operasi Dev

- Tambahkan default/config bootstrap bagi semua queue YouTube dengan `is_enabled=1`, mode yang tidak menciptakan job otomatis, dan polling yang aman.
- Pastikan runtime consumer aktif hanya untuk process yang ditentukan oleh ecosystem PM2, bukan mengandalkan browser request atau instance Next UI yang tidak pasti.
- Tambahkan health/read model berisi queue backlog, worker liveness, package/batch/job counts, terakhir progress/error, dan retry eligibility.
- Jangan auto-proses job lama yang sudah tertinggal. Sediakan aksi operator yang eksplisit dan idempotent untuk retry/resume per package atau tandai job legacy secara aman setelah audit.

## 4. Execution Task List

- [ ] Baca `AGENTS.md`, roadmap, Fase 3, Fase 3.5B, plan hybrid API smoke, dan dokumentasi Next.js lokal sebelum mengubah route/component.
- [ ] Audit `scheduler_config`, scheduler runtime, PM2 ecosystem, worker startup, `scheduler_jobs`, package/job/batch state, dan perubahan worktree; dokumentasikan pilihan consumer tunggal.
- [ ] Tambahkan queue registry/default config dan perbaiki asynchronous scheduler bootstrap/tick bila scheduler lama dipertahankan.
- [ ] Implementasikan/daftarkan production worker runtime Dev dengan claim atomik, tenant context, bounded concurrency, retry/backoff, graceful shutdown, dan observability.
- [ ] Refactor repository state transitions agar batch start-frame/VO/visual tidak langsung `approved`, tidak membuat duplicate job, dan memvalidasi dependency approval.
- [ ] Perbaiki worker agar setiap tahap memperbarui asset/batch/package state secara atomik; larang placeholder sebagai hasil produksi sukses.
- [ ] Tambahkan API read model serta action API idempotent untuk batch review/approve, retry terkontrol, preview, dan final render; semua scoped tenant/permission.
- [ ] Perbaiki UI satu kolom: tampilkan timeline batch/job nyata, CTA sesuai next eligible action, progres/error/retry, dan hindari success message prematur.
- [ ] Tambahkan focused tests: queue bootstrap, claim/tenant isolation, idempotency, state transitions, T2I→I2V, T2V fallback, asset failure/retry, dan assembly gating memakai provider mocks.
- [ ] Jalankan Dev smoke bertahap dengan episode kecil: approve prompt → start-frame review → approve frame → VO review → approve VO → visual job → preview. Jangan final render atau publish tanpa persetujuan eksplisit user.
- [ ] Jalankan build dan focused tests; deploy hanya `npm run deploy:macmini-dev`; verifikasi worker liveness serta status job melalui API/DB Dev.
- [ ] Update checklist ini setelah bukti tersedia, lalu jalankan SOP release `AGENTS.md` hanya setelah scope selesai dan terverifikasi.

## 5. Planned File Changes

### 5.1 `lib/scheduler.js`

**Code Sebelum (Current/Before)**

```js
const configs = getAllSchedulerConfigs();
for (const config of configs) {
  // only configured queues are processed
}
```

**Code Sesudah (Proposed/After)**

```js
const configs = await getAllSchedulerConfigs();
for (const config of configs) {
  await processConfiguredQueue(config);
}
```

- Tambahkan registry queue YouTube yang lengkap bila runtime scheduler dipilih sebagai consumer.
- Jangan membuat job YouTube secara otomatis dari interval; hanya consume job yang dibuat action approval.
- Pastikan claim dan completion semua memakai PostgreSQL API yang async secara benar.

### 5.2 `lib/db.js` dan migration/config PostgreSQL yang relevan

**Code Sebelum (Current/Before)**

```js
const DEFAULT_CONFIGS = {
  // no youtube_production_asset / assembly / final defaults
};
```

**Code Sesudah (Proposed/After)**

```js
const DEFAULT_CONFIGS = {
  youtube_production_asset: manualConsumerConfig,
  youtube_production_assembly: manualConsumerConfig,
  youtube_production_final: manualConsumerConfig,
};
```

- Bootstrap bersifat idempotent dan tidak overwrite preferensi operator yang telah ada.
- Bila perlu, tempatkan migration pada mekanisme PostgreSQL proyek yang sudah ada, bukan SQL ad-hoc pada endpoint.

### 5.3 `apps/api/server.js` dan/atau `ecosystem.macmini.config.cjs`

**Code Sebelum (Current/Before)**

```js
// PM2 hanya menyalakan UI dan API; ownership worker YouTube tidak eksplisit.
```

**Code Sesudah (Proposed/After)**

```js
// One explicitly configured Dev process starts the durable YouTube consumer.
// Environment flags prevent duplicate consumers across UI/API instances.
```

- Pilih satu ownership runtime secara eksplisit dan dokumentasikan flag environment.
- Tidak boleh memperluas deployment ke staging/production.

### 5.4 `lib/youtube-studio-production-repository.js`

**Code Sebelum (Current/Before)**

```js
INSERT INTO youtube_production_batches (..., status)
VALUES (..., 'start_frame', 'approved', ...);
```

**Code Sesudah (Proposed/After)**

```js
createBatch({ type: 'start_frame', status: 'queued' });
enqueueEligibleJobsOnce({ packageId, batchId, stage: 'start_frame' });
// approval is accepted only after batch === 'reviewing' and all requirements pass
```

- Gunakan transition assertion dan unique/idempotency key untuk mencegah duplicate batch/job.
- Setelah job stage selesai, kalkulasikan status batch dari asset persisted; jangan percaya status client.
- Jangan menghapus package/job existing secara destruktif.

### 5.5 `lib/youtube-studio-production-worker.js`

**Code Sebelum (Current/Before)**

```js
if (asset.generation_mode === 'static_asset' || asset.generation_mode === 'broll') {
  outputAssetJson = { video_path: 'templates/placeholder_16_9.mp4', bypass: true };
}
```

**Code Sesudah (Proposed/After)**

```js
await markStageRunning({ job, asset, batch });
// provider call or explicit reviewed source-asset resolution
await completeStageAndRecomputeBatch({ job, asset, output });
```

- Start-frame worker berhenti pada `reviewing`, bukan langsung I2V.
- TTS berhenti pada `reviewing`; visual video hanya setelah VO approved.
- Static/b-roll harus mempunyai source asset yang valid atau berstatus blocked/review-required—bukan placeholder yang dianggap sukses.
- Gunakan provider mocks pada test; request produksi nyata hanya lewat user-approved CTA.

### 5.6 `app/api/v2/youtube-studio/episodes/[id]/hybrid-production/route.js`

**Code Sebelum (Current/Before)**

```js
return NextResponse.json({ success: true, active: true, package: pkg, assets, batches });
```

**Code Sesudah (Proposed/After)**

```js
return NextResponse.json({
  success: true,
  data: buildHybridProductionReadModel({ package: pkg, assets, batches, jobs }),
});
```

- Response memuat next eligible action, batch/job summaries, progress, errors, dan retry capability tanpa prompt/credential rahasia berlebihan.
- POST harus menolak approval sebelum state `reviewing`; gunakan status 409 untuk conflict yang dapat dipahami UI.

### 5.7 `app/youtube-studio/components/YouTubeStudioWorkspace.js`, `EpisodeWorkspace.js`, dan CSS Module terkait

**Code Sebelum (Current/Before)**

```js
triggerNotice('success', 'Production Plan approved! Asset generation has started.');
```

**Code Sesudah (Proposed/After)**

```js
triggerNotice('info', 'Prompt package approved. Start-frame jobs are queued.');
await refreshHybridProductionState();
```

- One-column workflow berisi stage, jumlah job, progres, error, review CTA, dan retry action yang server-authoritative.
- Gunakan CSS semantic/token dari `app/theme.css`; tanpa warna literal atau inline visual styling baru.

### 5.8 Tests dan smoke script project-native

**Code Sebelum (Current/Before)**

```js
// Prompt package smoke ends before actual job consumption.
```

**Code Sesudah (Proposed/After)**

```js
// Mocked unit/integration tests prove every transition.
// Dev smoke proves job leaves queued and reaches start-frame reviewing.
```

- Tambahkan test tanpa G-Labs/TTS nyata untuk provider and scheduler behavior.
- Smoke Dev berbiaya nyata hanya boleh pada batch kecil dan setelah credential/consent eksplisit; jangan menjalankan final render/publish.

## 6. Acceptance Criteria

1. Klik approve prompt package mengembalikan `queued`, bukan klaim “sudah generate”.
2. Dalam runtime Dev yang aktif, scheduler/worker meng-claim job paling lambat satu interval worker; attempt/progress berubah dan dapat dilihat lewat API.
3. Start-frame batch hanya menjadi `reviewing` setelah semua start-frame required berhasil; approval sebelum itu ditolak.
4. VO dan video mengikuti approval gate dan tidak ada I2V tanpa start frame approved.
5. Repeated API action tidak menggandakan batch/job/provider request.
6. Kegagalan provider menghasilkan error actionable serta retry selektif, tanpa menimpa artifact sebelumnya.
7. UI status konsisten dengan DB/API setelah refresh.
8. Focused tests/build lulus, Dev-only deployment berhasil, dan smoke mencatat evidence tanpa mengekspos credential atau raw prompt.

## 7. Verification & Release

Minimum verification:

```bash
node --test tests/youtube-studio-*.test.js
npm run build
npm run deploy:macmini-dev
```

Kemudian lakukan API smoke terhadap Dev untuk membuktikan job yang di-approve berubah dari `queued` ke `running` lalu `reviewing`. Jangan invoke final render/publish tanpa instruksi eksplisit.

Setelah semua acceptance criteria terpenuhi, jalankan:

```bash
npm run release-non-interactive -- --type patch --title "YouTube Studio Production Orchestration" --points "Activate durable YouTube production queues and worker|Enforce hybrid approval gates and truthful production status|Verify Dev start-frame workflow"
```
