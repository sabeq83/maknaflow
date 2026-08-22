# Implementation Plan — YouTube Studio Information Architecture & Episode Workspace

> Status: Planned.  
> Scope: Memecah UI YouTube Studio yang kini menumpuk dalam satu halaman menjadi struktur navigasi `Channel → Series → Episode`, workspace episode bertahap, dan hub lintas episode. Domain/API produksi yang telah berjalan harus tetap dipertahankan.  
> Referensi UX: mockup interaktif `youtube-studio-architecture-mockup.html` pada thread visualisasi.  
> Deployment target: **Mac Mini Dev only** (`5020` UI, `7020` API).

## 1. Keputusan UX yang Dikunci

YouTube Studio bukan lagi sebuah halaman workflow vertikal tunggal. Ia menjadi application area dengan tiga level konteks:

```text
YouTube Studio
├── Channels
│   └── Channel detail
│       ├── Overview / Strategy
│       ├── Knowledge Base
│       └── Content Series
│           └── Series detail
│               ├── Content Guide
│               └── Episodes
│                   └── Episode workspace
├── Production Queue
├── Publishing
└── Analytics (placeholder; tidak diimplementasikan pada scope ini)
```

Episode workspace memiliki sembilan tahap. Hanya tahap yang sedang dibuka tampil dominan; tahap lain menjadi navigator status dan tidak lagi menumpuk sebagai section panjang.

1. Brief & Research
2. Blueprint
3. Script & Voice-over
4. Scene Plan / Generation Profile
5. Start Frames
6. Video Production
7. Assemble & Review
8. Packaging
9. Publish

Tahap 5–9 harus menampilkan state yang jujur terhadap capability saat ini. Jangan mengklaim Start Frames, hybrid approval, packaging, atau upload YouTube sudah selesai bila endpoint/UI pendukungnya belum benar-benar terintegrasi. Bila belum tersedia, gunakan status `Coming next` dengan penjelasan singkat dan link/CTA hanya apabila aksi tersebut memang ada.

## 2. Sasaran

1. Menghilangkan pengalaman “semua ada di satu halaman” tanpa menghapus fungsi yang sudah selesai dari Fase 1–3.5.
2. Menjadikan Channel sebagai rumah strategi dan KB, Series sebagai rumah editorial/backlog, dan Episode sebagai unit produksi mandiri.
3. Menjadikan progres episode mudah dipahami melalui status stage, prerequisite, dan approval—bukan sekadar urutan card panjang.
4. Menyediakan Production Queue sebagai tampilan lintas episode untuk pekerjaan yang sedang berjalan/menunggu review.
5. Menyediakan Publishing hub sebagai daftar episode yang siap metadata, final render, atau publish. Analytics hanya shell/empty state, tanpa membuat metrik palsu.
6. Memecah `YouTubeStudioWorkspace.js` yang monolitik menjadi komponen semantik dan testable, tetap memakai CSS Module serta token dari `app/theme.css`.

## 3. Batas Scope

### Masuk scope

- Refactor navigasi dan layout YouTube Studio.
- Pemisahan komponen Channel, Series, Episode Workspace, Production Queue, dan Publishing.
- URL state yang dapat dibagikan/dimuat ulang, minimal query string:

```text
/youtube-studio?view=channels
/youtube-studio?view=channel&channel=<channelId>
/youtube-studio?view=series&channel=<channelId>&series=<seriesId>
/youtube-studio?view=episode&channel=<channelId>&series=<seriesId>&episode=<episodeId>&stage=research
/youtube-studio?view=production
/youtube-studio?view=publishing
```

- Memindahkan seluruh inline style YouTube Studio yang disentuh ke CSS Module semantik.
- Empty, loading, blocked, success, and error states yang accessible.
- Reuse seluruh endpoint/channel strategy, series, ideas, research, blueprint, script, duration, generation profile, production plan, render, KB, serta publishing data yang sudah tersedia.

### Di luar scope

- Mengubah kontrak database/API secara spekulatif.
- Membangun analytics/performance reporting baru.
- Membuat upload/publish YouTube baru bila integrasi belum siap.
- Mengubah logic AI, prompt, snapshot KB, generation profile, renderer, atau worker production selain adaptor presentasi yang dibutuhkan.
- Deploy staging atau production.

## 4. Temuan Audit Saat Ini

1. `app/youtube-studio/components/YouTubeStudioWorkspace.js` menyimpan channel selection, strategy, series, ideas, episode, research, blueprint, script, generation profile, production, KB, dan preview dalam satu client component.
2. Render utama memakai stepper 4 langkah, tetapi kemudian KB Library, Channel, Strategy, Series, Episode Backlog, hingga langkah produksi 5.1–9 ditampilkan serial pada satu halaman.
3. State terpilih sudah tersedia (`selectedChannel`, `selectedSeries`, `selectedEpisode`), sehingga refactor dapat memanfaatkan state/API yang ada—bukan menduplikasi domain state.
4. `page.js` sudah memakai shell global `Sidebar` dan `page-container`; navigasi khusus YouTube Studio sebaiknya berada di dalam workspace, bukan sidebar global.
5. CSS Module sudah ada, tetapi JSX masih mengandung banyak `style={{...}}`, termasuk beberapa literal visual. Perubahan ini harus melanjutkan standard CSS semantik yang telah disepakati.
6. Endpoint publishing sudah ada, tetapi readiness/payload/UI harus diaudit dulu. Jangan menampilkan tombol publish aktif sebelum status episode dan kontraknya valid.

## 5. Arsitektur UI Usulan

### 5.1 App shell YouTube Studio

```text
Header: YouTube Studio / breadcrumb context / selected channel
Local navigation: Channels | Production | Publishing | Analytics
Content area: satu view aktif
```

- **Channels**: daftar channel dan entry create channel.
- **Channel detail**: Strategy, Channel Profile/KB binding, daftar Content Series.
- **Series detail**: Content Guide/KB binding, AI series ideas, planned episodes.
- **Episode workspace**: stage rail vertikal + satu panel stage aktif.
- **Production**: queue lintas episode, berdasarkan episode/package/assets yang sudah ada.
- **Publishing**: daftar episode siap untuk final packaging atau publish berdasarkan status nyata.

### 5.2 Episode stage resolver

Buat satu resolver presentation-only, misalnya `lib/youtube-studio-workspace-state.js`, yang menerima episode, research, blueprint, script, package, profile, dan capability result; lalu menghasilkan daftar stage:

```js
[
  { key: 'research', status: 'complete' | 'active' | 'blocked' | 'pending', enabled: true },
  { key: 'blueprint', status: 'blocked', reason: 'Research brief required' },
  // ...
]
```

Resolver tidak boleh mengubah database atau memicu generation. Satu source of truth ini mencegah label/CTA berbeda antara stage rail, page title, queue, dan publishing hub.

### 5.3 Strategy untuk capability belum lengkap

- **Start Frames**: tampilkan sebagai stage `Coming next` sampai hybrid/start-frame UI telah diimplementasikan end-to-end. Jangan menampilkan start frame sebagai completed hanya karena API route ada.
- **Video Production**: gunakan UI Production Plan, asset progress, dan final render yang sudah tersedia.
- **Assemble & Review**: tampilkan preview/final render apabila `activePackage` menyediakannya; selain itu blocked/pending.
- **Packaging / Publish**: gunakan data publishing yang benar-benar tersedia. Jika belum, tampilkan structured empty state dan hindari CTA yang menjanjikan upload.

## 6. Execution Task List

- [ ] Baca `AGENTS.md`, dokumen roadmap/MVP/Fase 1–3.5, dokumentasi Next.js lokal yang relevan, serta audit git status sebelum edit.
- [ ] Jalankan baseline build dan audit endpoint/data readiness untuk queue serta publishing; catat capability yang belum dapat diaktifkan.
- [ ] Tambahkan URL-state resolver untuk `view`, `channel`, `series`, `episode`, dan `stage`, dengan fallback aman bagi URL lama `/youtube-studio`.
- [ ] Pecah monolit `YouTubeStudioWorkspace` menjadi local navigation dan view components tanpa mengubah handler/domain API yang sudah bekerja.
- [ ] Implementasikan Channels view dan Channel detail: strategy, KB, serta jalur menuju Series.
- [ ] Implementasikan Series detail: series guide/binding, AI idea backlog, dan daftar/create episode.
- [ ] Implementasikan Episode workspace dengan 9-stage rail vertikal, satu panel stage aktif, status/prerequisite resolver, dan deep-link stage.
- [ ] Pindahkan Research, Blueprint, Script, duration/profile, production plan, asset progress, preview/final render ke stage yang tepat; jangan melakukan generation otomatis saat membuka episode/stage.
- [ ] Implementasikan Production Queue dan Publishing hub dengan status aktual; buat Analytics sebagai placeholder yang eksplisit.
- [ ] Refactor styling ke CSS Module semantik, hapus inline visual styles pada file yang disentuh, dan gunakan token tema MAKNA Flow tanpa literal warna.
- [ ] Tambahkan test resolver/UI smoke yang proporsional dan lakukan manual accessibility/responsive verification pada 360px, 736px, dan desktop.
- [ ] Jalankan test relevan dan `npm run build`; verifikasi tidak ada error lint/build serta tidak ada side effect generation ketika memilih episode.
- [ ] Deploy **hanya** ke Mac Mini Dev, verifikasi `/youtube-studio` dan deep-link episode pada UI `5020`/API `7020`, tanpa polling SSH berulang.
- [ ] Perbarui setiap checkbox ini menjadi `[x]` hanya sesudah bukti verifikasi tersedia, lalu ikuti SOP release/push dari `AGENTS.md`.

## 7. Planned File Changes

### 7.1 `app/youtube-studio/components/YouTubeStudioWorkspace.js`

**Code Sebelum (Current/Before)**

```jsx
<nav className={styles.stepper} aria-label="Progress Stepper">
  <div className={styles.step}>Channel Setup</div>
  <div className={styles.step}>AI Strategy</div>
  <div className={styles.step}>Content Series</div>
  <div className={styles.step}>Episode Planning</div>
</nav>

<section className={styles.kbStep}>...</section>
<section className={styles.workflowStep}>...</section>
<section className={styles.workflowStep}>...</section>
<section className={styles.workflowStep}>...</section>
<section className={styles.workflowStep}>...</section>
```

**Code Sesudah (Proposed/After)**

```jsx
<YouTubeStudioShell
  activeView={workspace.view}
  selectedChannel={selectedChannel}
  onNavigate={navigateWorkspace}
>
  {workspace.view === 'channels' && <ChannelsView {...channelProps} />}
  {workspace.view === 'channel' && <ChannelDetailView {...channelDetailProps} />}
  {workspace.view === 'series' && <SeriesDetailView {...seriesProps} />}
  {workspace.view === 'episode' && <EpisodeWorkspace {...episodeProps} />}
  {workspace.view === 'production' && <ProductionQueue {...queueProps} />}
  {workspace.view === 'publishing' && <PublishingHub {...publishingProps} />}
  {workspace.view === 'analytics' && <AnalyticsPlaceholder />}
</YouTubeStudioShell>
```

- Retain existing handlers and state where practical for the first refactor; only move them behind meaningful props/callbacks.
- `navigateWorkspace()` updates URL state without losing the currently selected resource.
- Protect direct deep-link loading: fetch channel/series/episode as needed, show a semantic not-found state when IDs no longer exist.

### 7.2 `app/youtube-studio/components/YouTubeStudioShell.js` — new

**Code Sebelum (Current/Before)**

```jsx
// Local YouTube Studio navigation does not exist; only one long workspace exists.
```

**Code Sesudah (Proposed/After)**

```jsx
export function YouTubeStudioShell({ activeView, selectedChannel, onNavigate, children }) {
  return (
    <div className={styles.shell}>
      <header className={styles.shellHeader}>...</header>
      <nav className={styles.localNavigation} aria-label="YouTube Studio">...</nav>
      <main className={styles.viewContent}>{children}</main>
    </div>
  );
}
```

- Navigation uses buttons/links with explicit active state and accessible labels.
- Do not duplicate the global app Sidebar.

### 7.3 `app/youtube-studio/components/ChannelsView.js`, `ChannelDetailView.js`, `SeriesDetailView.js` — new

**Code Sebelum (Current/Before)**

```jsx
// Channel selection, strategy, series, and ideas are rendered as successive
// workflow sections in YouTubeStudioWorkspace.
```

**Code Sesudah (Proposed/After)**

```jsx
<ChannelsView channels={channels} onOpenChannel={openChannel} onCreate={handleCreateChannel} />
<ChannelDetailView channel={selectedChannel} strategy={activeStrategy} kbBindings={kbBindings} />
<SeriesDetailView series={selectedSeries} ideas={ideas} episodes={seriesEpisodes} />
```

- Channel details own strategy/KB and list series; Series details own ideas/backlog and episodes.
- Avoid showing full channel strategy and all episode production UI inside the same view.

### 7.4 `app/youtube-studio/components/EpisodeWorkspace.js` and `EpisodeStageRail.js` — new

**Code Sebelum (Current/Before)**

```jsx
{selectedEpisode && (
  <div className={styles.subSection}>
    <h3>Editorial Workflow: {selectedEpisode.title}</h3>
    {/* Research, Blueprint, Script, Profile, Production Plan, Assets, Preview */}
  </div>
)}
```

**Code Sesudah (Proposed/After)**

```jsx
<EpisodeWorkspace episode={episode} stages={stages} activeStage={stageKey} onStageChange={openStage}>
  <EpisodeStagePanel stage={activeStage} actions={actions} data={episodeData} />
</EpisodeWorkspace>
```

- Rail is vertically oriented on desktop and horizontally scrollable/compact on mobile.
- A user may revisit completed stages. Locked stages include a textual prerequisite.
- `onStageChange` only changes UI/URL; it must never call a generation endpoint.

### 7.5 `lib/youtube-studio-workspace-state.js` — new

**Code Sebelum (Current/Before)**

```js
// Stage completion/readiness is inferred separately inside many JSX conditionals.
```

**Code Sesudah (Proposed/After)**

```js
export function resolveEpisodeStages({ episode, research, blueprint, script, productionPackage, capabilities }) {
  return [/* deterministic stage descriptors */];
}
```

- Pure function, no fetch, no mutation, no generation calls.
- Include a matching unit test for planned, research-ready, blueprint-approved, script-approved, production-draft, preview-ready, and completed states.

### 7.6 `app/youtube-studio/components/ProductionQueue.js`, `PublishingHub.js`, `AnalyticsPlaceholder.js` — new

**Code Sebelum (Current/Before)**

```jsx
// Production assets and final-render actions appear only inside a selected
// episode, and there is no cross-episode queue/publishing view.
```

**Code Sesudah (Proposed/After)**

```jsx
<ProductionQueue items={queueItems} onOpenEpisode={openEpisode} />
<PublishingHub items={publishableEpisodes} onOpenEpisode={openEpisode} />
<AnalyticsPlaceholder />
```

- Calculate queue and publishing candidates from existing loaded data/endpoints; do not invent analytics metrics.
- If a dedicated query is required for scale, add a read-only endpoint only after auditing repository patterns and document its contract in this plan before editing.

### 7.7 `app/youtube-studio/components/YouTubeStudioWorkspace.module.css`

**Code Sebelum (Current/Before)**

```css
.workflowStep { ... }
.stepper { display: flex; justify-content: space-between; ... }
/* JSX still provides many style={{ ... }} declarations. */
```

**Code Sesudah (Proposed/After)**

```css
.shell { ... }
.localNavigation { ... }
.viewContent { ... }
.episodeWorkspace { ... }
.episodeStageRail { ... }
.episodeStagePanel { ... }
.queueList { ... }
.emptyState { ... }
```

- Semantic classes only; no class names based on colour or arbitrary layout position.
- Use `app/theme.css` tokens for all surfaces/text/borders/actions/status/radius/shadow/transition.
- No hex, `rgb`, `rgba`, `color-mix`, or JSX inline visual styling in the modified YouTube Studio UI.

### 7.8 `tests/youtube-studio-workspace-state.test.js` (or project-equivalent test location) — new

**Code Sebelum (Current/Before)**

```js
// No focused test for episode stage interpretation.
```

**Code Sesudah (Proposed/After)**

```js
test('script-approved episode unlocks scene plan but does not complete production', () => {
  expect(resolveEpisodeStages(fixture).find(stage => stage.key === 'scene-plan')).toMatchObject({ enabled: true });
});
```

- Use project-native test conventions only. Do not add a browser testing dependency merely for this UI refactor.

## 8. Acceptance Criteria

1. `/youtube-studio` opens a calm Channels-first home rather than a long stacked workflow.
2. A channel can be opened, its strategy/KB can be managed, and a series can be opened without exposing episode production panels.
3. A series can show ideas/backlog and open an episode workspace.
4. An episode displays exactly one active production stage at a time; navigation is deep-linkable and revisitable.
5. Selecting an episode/stage never generates research, blueprint, script, asset, or render automatically.
6. Existing completed Phase 1–3.5 functions remain available in their correct new view/stage.
7. Production Queue and Publishing Hub show only factual availability/status. Analytics is explicitly a placeholder.
8. No inline visual styles or literal colors remain in changed YouTube Studio files; UI uses semantic CSS Modules and MAKNA Flow theme tokens.
9. Keyboard navigation, focus state, 360px mobile, 736px tablet, and desktop layouts are usable.
10. Build, relevant tests, Dev-only deployment, and smoke verification pass.

## 9. Verification & Dev-only Deployment

Run the project-native relevant tests and:

```bash
npm run build
npm run deploy:macmini-dev
```

Verify at:

- `http://100.95.245.55:5020/youtube-studio`
- a deep-link episode URL created from an actual Dev record
- `http://100.95.245.55:7020` for relevant API health/smoke checks

Do not deploy staging or production. Do not use repeated SSH polling during remote build.

After successful verification, follow the mandatory release SOP in `AGENTS.md`:

```bash
npm run release-non-interactive -- --type patch --title "YouTube Studio Workspace Architecture" --points "Restructure YouTube Studio around channels series and episodes|Add focused episode workspace and production hubs|Align UI with semantic MAKNA Flow theme"
```
