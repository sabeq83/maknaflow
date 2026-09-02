# Instruksi Antigravity — Implementasi Hermes Research → Content Planner Tahap 1–3

Implementasikan seluruh rencana berikut sampai Definition of Done terpenuhi:

`plans/hermes-integration/research-to-content-planner-implementation-plan.md`

Ini tugas implementasi penuh Tahap 1–3, bukan audit atau proof-of-concept. Jangan berhenti setelah satu tahap, build, release, atau deploy parsial selama masih ada pekerjaan aman dalam scope.

## Otorisasi Full Auto

Pengguna memberikan izin kepada Antigravity untuk menjalankan tugas ini secara full auto pada lingkungan Dev tanpa meminta approval berulang.

### Sudah diizinkan

- audit source/schema/config Dev;
- mengedit source, migration, test, UI, API, dokumentasi, skill, dan plan;
- membuat fixture tenant/data test terisolasi;
- menjalankan unit/integration/E2E/security/regression test dan build;
- menjalankan migration idempotent pada schema Dev;
- mengubah feature flags Dev sesuai urutan rollout;
- restart/reload Hermes dan PM2 Dev;
- deploy berulang hanya ke Mac Mini Dev;
- menjalankan query read-only dan cleanup fixture unik;
- menjalankan satu real Hermes smoke yang ditetapkan plan;
- membuat patch/minor release, commit, tag, dan push sesuai SOP;
- memperbaiki kegagalan dan mengulang test/deploy tanpa meminta instruksi baru.

Kelompokkan operasi SSH/deploy agar tidak memicu approval berkali-kali. Gunakan satu sesi terkontrol dan jangan polling SSH cepat.

### Tetap dilarang

- deploy/restart/mengubah Staging atau Production;
- posting ke platform sosial;
- approve start frame smoke;
- direct database write oleh Hermes/Gemini;
- membuat research brief, sumber, klaim, atau signed callback palsu untuk meloloskan smoke;
- menghapus data pengguna atau melakukan destructive migration;
- menampilkan token, password, API key, callback secret, raw prompt, atau isi `.env`;
- melemahkan test/assertion agar hijau.

Jika platform meminta izin sistem, minta satu izin tersempit yang mencakup rangkaian tindakan Dev terkait lalu lanjutkan otomatis. Berhenti hanya bila dibutuhkan akses/secret yang benar-benar tidak tersedia atau tindakan akan melanggar batas di atas.

## Urutan Kerja Wajib

### 1. Audit sebelum edit

1. Baca `AGENTS.md` dan seluruh plan.
2. Audit worktree kotor; pertahankan perubahan pengguna yang tidak terkait.
3. Audit canonical storage `content_planners`, `content_planner_rows`, `agent_research_revisions`, dan compatibility layer runtime Dev.
4. Audit actual Next.js version docs yang relevan sebelum mengubah route/UI.
5. Tambahkan Before/After snippet ke plan untuk file tambahan sebelum mengedit.
6. Buka checklist dan update `[x]` secara real-time, bukan di akhir sekaligus.

### 2. Kerjakan Tahap 1 sampai gate lulus

- Migration metadata + evidence table.
- Repository atomic dan tenant-scoped.
- Frozen research revision/hash.
- Server-locked structure fields.
- Evidence ke Call 1 dan Call 2.
- Planner/row lineage persistence.
- Regenerate memakai revision yang sama.
- Legacy research_mode none tetap bekerja.

Jangan lanjut Tahap 2 bila migration, atomicity, locked structure, atau legacy regression belum lulus.

### 3. Deploy Tahap 1 Dev secara aman

- Semua flags false pada deploy pertama.
- Verify migration/schema/API health.
- Aktifkan adapter Dev.
- Jalankan integration fixtures dan rollback test.
- Jika gagal, rollback flag dan perbaiki sebelum lanjut.

### 4. Kerjakan Tahap 2 sampai gate lulus

- Deterministic Research-to-Planner Adapter.
- Source policy dan SSRF-safe verification.
- Risk/claim/Product Snapshot enforcement.
- Post-generation locked structure/evidence validator.
- Bounded retry.
- Refresh/apply revision workflow.
- Audit events dan metrics.

Jangan menerima URL hanya karena berbentuk HTTPS. Jangan menerima confidence buatan agent sebagai bukti kebenaran. Verifikasi source metadata sesuai policy.

### 5. Deploy Tahap 2 Dev secara aman

- Enforcement flag awal false.
- Jalankan source security and claim integration tests.
- Aktifkan enforcement hanya bila seluruh gate lulus.
- Uji invalid/fabricated sources ditolak sebelum Operator Job/campaign dibuat.

### 6. Kerjakan Tahap 3 sampai gate lulus

- Planner research projection API.
- Row evidence API.
- Research badge/summary/source drawer.
- Row source/insight/risk chips.
- Refresh status, diff, dan explicit apply.
- Responsive/accessibility/redaction.

UI tidak boleh menampilkan raw research payload yang belum tervalidasi atau internal prompt.

### 7. Deploy Tahap 3 Dev

- UI flag awal false.
- Jalankan API/UI/E2E tests.
- Aktifkan UI flag setelah sehat.
- Verifikasi existing planner lama tetap terbuka dan dapat dieksekusi.

### 8. Full test gate

Jalankan seluruh test yang tercantum pada plan serta test suite repo yang relevan. Minimal:

```bash
node --test tests/content-run-once.test.js tests/agent-automation.test.js tests/hermes-client.test.js
npm run test:content-run-once:integration
npm run test:content-automation
npm run test:operator-content
npm run test:publishing-scheduler
npm run build
```

Tambahkan scripts baru untuk:

- planner locked structure;
- research adapter allocation;
- research source security;
- claim/evidence validation;
- planner evidence DB integration;
- regenerate frozen revision;
- refresh/apply workflow;
- research planner UI/API E2E.

Acceptance test:

- exit code 0;
- unexpected skip 0;
- open handle 0;
- fixture leak 0;
- process keluar alami;
- no secret leakage.

### 9. Real Hermes smoke

Jalankan tepat satu smoke setelah semua tahap/gate lulus:

- Brand `dapurbotani`;
- Product `Pagibaik Rolled Oat Gluten Free`;
- Preset `dapurbotani_kampanye_produk_4_klip_v2`;
- 6 video;
- real latest research;
- `primary_and_reputable` sources;
- manual review after start frames;
- `draft_only`;
- no publishing target.

Wajib melalui Hermes Runs API nyata:

1. MAKNA dispatch ke Hermes.
2. Hermes melakukan research sebenarnya.
3. Hermes mengirim signed callback miliknya.
4. MAKNA memvalidasi source/evidence.
5. Adapter mengalokasikan evidence.
6. Content Planner membentuk enam locked rows.
7. Operator membuat enam start frame.
8. Stop pada manual review.

Dilarang membuat research brief/callback secara manual dari script smoke. Bila Hermes tidak menyelesaikan callback, perbaiki integrasinya; jangan bypass.

### 10. Release dan handoff

Setelah seluruh gate dan smoke lulus:

1. Jalankan release SOP repository.
2. Push commit/tag.
3. Deploy release final hanya ke Dev.
4. Verifikasi remote version, PM2, flags, API, UI, dan worker.
5. Pastikan worktree bersih.
6. Tulis report:

`plans/hermes-integration/research-to-content-planner-final-report.md`

Report wajib memuat:

- release/commit/tag/Dev version;
- schema migrations;
- files dan fix per tahap;
- test commands, exit codes, pass/fail/skip, duration;
- feature flag rollout;
- real Hermes Run/Research Revision/Planner/Operator Job/Campaign IDs;
- verified source counts/policy tanpa menyalin full copyrighted content;
- locked distribution dan row evidence lineage;
- regeneration/refresh proof;
- six start-frame manual review status;
- zero publishing/Repliz/non-recurring proof;
- rollback proof;
- Staging/Production untouched;
- residual risks.

## Aturan Kejujuran Bukti

- Jangan menulis PASS berdasarkan code inspection saja.
- Jangan menyebut end-to-end bila callback dibuat manual.
- Jangan menyebut source verified hanya karena URL HTTPS.
- Jangan menyebut locked bila hanya berupa prompt instruction.
- Jangan mencentang deployment/smoke sebelum memeriksa runtime Dev.
- Jangan menyembunyikan test skip, warning async, atau dirty worktree.
- Jika satu Definition of Done gagal, status akhir harus `INCOMPLETE`, kemudian lanjutkan memperbaiki selama masih dalam scope.

## Execution Task List

- [ ] Baca plan lengkap dan audit canonical storage/runtime Dev.
- [ ] Perbarui Before/After snippets untuk file tambahan.
- [ ] Selesaikan seluruh checklist Tahap 1 dan gate-nya.
- [ ] Deploy/rollout Tahap 1 hanya Dev.
- [ ] Selesaikan seluruh checklist Tahap 2 dan gate-nya.
- [ ] Deploy/rollout Tahap 2 hanya Dev.
- [ ] Selesaikan seluruh checklist Tahap 3 dan gate-nya.
- [ ] Deploy/rollout Tahap 3 hanya Dev.
- [ ] Jalankan full test/build gate tanpa skip/leak.
- [ ] Jalankan real Hermes smoke tanpa fabricated research/callback.
- [ ] Buktikan locked structure, evidence lineage, dan UI provenance.
- [ ] Buktikan six start frames manual review dan zero publishing.
- [ ] Uji rollback flags dan legacy planner.
- [ ] Release/push/deploy final hanya Dev.
- [ ] Pastikan worktree bersih dan report lengkap.
- [ ] Konfirmasi Staging/Production tidak disentuh.

Jangan meminta pengguna melakukan langkah manual selama pekerjaan masih dapat diselesaikan Antigravity dalam scope full-auto ini.

