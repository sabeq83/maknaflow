# Implementation Plan — YouTube Studio Fase 1 UI Refinement

> Status: Planned.  
> Scope: Refactor UX/UI editorial workflow menjadi satu kolom vertikal; pertahankan API dan domain behaviour Fase 1.  
> Referensi UX: mockup `youtube-studio-one-column-mockup.html` pada thread visualisasi.

## 1. Sasaran

Menggantikan UI Fase 1 yang saat ini memakai panel kiri 320px + tab kanan menjadi satu alur vertikal yang jelas:

```text
1. Channel
↓
2. AI Channel Strategy
↓
3. Content Series
↓
4. Episode Ideas dan Planned Episodes
```

Setiap langkah hanya membuka action yang relevan setelah prasyaratnya terpenuhi. Refactor ini tidak mengubah domain workflow:

- Channel dibuat/dipilih.
- AI menghasilkan Strategy draft.
- User meninjau lalu activate Strategy.
- Series dibuat di bawah active strategy.
- AI menghasilkan idea backlog.
- User adopt idea atau menambah episode manual menjadi `Planned`.

## 2. Temuan Audit yang Harus Diperbaiki

1. `YouTubeStudioWorkspace` menggunakan grid dua kolom (`320px 1fr`) dan tab sehingga workflow terasa terpecah.
2. Sebagian besar UI menggunakan inline `style` sehingga sulit dipelihara, tidak responsif secara konsisten, dan berisiko menyimpang dari theme.
3. Ada literal warna seperti `#fff`, `#ef4444`, `#f87171`, dan `rgba(6, 182, 212, ...)`, padahal `app/theme.css` telah menyediakan token semantik seperti `--surface`, `--status-danger`, dan `--status-info-soft`.
4. `alert()` dipakai untuk success feedback; ini memutus alur kerja dan tidak sejalan dengan pola UI aplikasi.
5. `handleCreateChannel` melakukan list ulang dan mencari channel berdasarkan nama setelah mengosongkan input; gunakan response create secara langsung agar selection tidak bergantung pada nama/urutan data.
6. State `activeTab` dan `strategyTab` menciptakan navigasi internal yang tidak diperlukan untuk workflow step-by-step.
7. Loading/error/success state belum mempunyai semantic region dan tidak seragam.
8. UI perlu pengujian responsif dan keyboard/focus setelah struktur diubah.

## 3. Prinsip Desain dan CSS

### One-column workflow

- Lebar konten maksimum yang nyaman untuk form editorial, bukan 1380px dashboard.
- Stepper horizontal ringkas di atas sebagai indikator/navigasi cepat; konten tetap tersusun vertikal satu kolom.
- Setiap step menjadi section semantik dengan heading, prerequisite message, form/action, dan hasilnya.
- Step selanjutnya tersedia setelah prerequisite tercapai, tetapi informasi/status tetap terlihat agar user memahami progres.

### CSS semantic dan theme-aligned

- Buat CSS Module scoped ke YouTube Studio; jangan memasukkan theme baru atau warna halaman-spesifik ke `globals.css`.
- Pakai class berdasarkan peran, bukan presentasi: `workspace`, `workflowStep`, `stepHeader`, `statusNotice`, `strategyDraft`, `ideaCard`, `episodeCard`, `actionRow`.
- Gunakan token eksisting dari `app/theme.css`:
  - surface: `--surface`, `--surface-raised`, `--surface-interactive`, `--surface-hover`;
  - text: `--text-primary`, `--text-secondary`, `--text-muted`;
  - border: `--border-subtle`, `--border-strong`;
  - actions: `--action-primary`, `--action-primary-hover`, `--on-action-primary`;
  - status: `--status-info`, `--status-info-soft`, `--status-success`, `--status-success-soft`, `--status-warning`, `--status-warning-soft`, `--status-danger`, `--status-danger-soft`, `--status-neutral`, `--status-neutral-soft`;
  - layout: `--radius-*`, `--shadow-card`, `--transition`, `--font-sans`.
- Jangan gunakan hex, `rgb`, `rgba`, `color-mix`, hard-coded pixel color/shadow/radius/font values di CSS Module atau JSX untuk YouTube Studio.
- Spacing/layout breakpoint boleh didefinisikan sebagai CSS custom properties scoped di CSS Module bila belum ada token global; namai secara semantik, misalnya `--yt-content-width`, `--yt-space-section`, bukan berdasarkan warna/ukuran visual.
- Gunakan kelas `.btn`, `.form-input`, dan `.form-select` yang sudah ada hanya bila outputnya cocok; buat class module semantik untuk variasi action/status yang spesifik.

### Accessibility dan feedback

- Gunakan `<section aria-labelledby>`, `<fieldset>`, `<legend>`, `<label htmlFor>`, `<button type="button">`, dan `<output>`/status region sesuai konteks.
- Error memakai `role="alert"`; success/loading memakai `aria-live="polite"`.
- Disabled action menjelaskan prerequisite secara tekstual, bukan hanya perbedaan warna.
- Pertahankan focus-visible dari theme global dan jangan menghapus outline keyboard.

## 4. Execution Task List

- [x] Baseline: jalankan build dan catat perilaku API workflow yang harus dipertahankan.
- [x] Refactor markup `YouTubeStudioWorkspace` menjadi section workflow satu kolom dan hapus layout grid/tab yang tidak diperlukan.
- [x] Tambahkan CSS Module dengan class semantik dan hanya token tema MAKNA Flow; hapus seluruh inline UI styling dan literal warna dari workspace.
- [x] Ganti native `alert()` dengan inline status notice yang accessible dan non-blocking.
- [x] Perbaiki channel creation agar response POST memilih channel yang baru dibuat tanpa pencarian berbasis nama/urutan.
- [x] Tambahkan loading, empty, prerequisite, success, and error state pada setiap step.
- [x] Tambahkan responsive/mobile, keyboard, dan focus verification.
- [x] Tambahkan/ubah test UI atau smoke test yang membuktikan workflow/selection tetap berfungsi.
- [x] Jalankan build, test relevan, dan deploy **hanya** ke Mac Mini Dev; verifikasi UI pada port 5020.
- [x] Perbarui checklist ini dan lakukan release SOP hanya setelah seluruh bukti verifikasi tersedia.

## 5. Planned File Changes

### 5.1 `app/youtube-studio/components/YouTubeStudioWorkspace.js`

**Code Sebelum (Current/Before)**

```jsx
<div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px' }}>
  <div>{/* Content Series left panel */}</div>
  <div>{/* Strategy / Ideas / Episodes tabs */}</div>
</div>
```

**Code Sesudah (Proposed/After)**

```jsx
<div className={styles.workspace}>
  <WorkflowProgress activeStep={activeStep} />
  <section className={styles.workflowStep} aria-labelledby="channel-step-title">...</section>
  <section className={styles.workflowStep} aria-labelledby="strategy-step-title">...</section>
  <section className={styles.workflowStep} aria-labelledby="series-step-title">...</section>
  <section className={styles.workflowStep} aria-labelledby="episodes-step-title">...</section>
</div>
```

- Import a CSS Module; remove page-specific inline style objects.
- Replace `activeTab`/`strategyTab` with a derived `activeStep` or compact step navigation that does not hide the vertical workflow.
- Use direct POST response when creating channel:

```js
const created = data.data;
setChannels(current => [...current, created].sort(compareChannels));
setNewChannelName('');
await selectChannel(created);
```

- Replace `alert()` with a `notice` state `{ tone, message }` rendered in an ARIA live region.
- Preserve existing request payloads and handlers except the selection/race fix. Do not add blueprint/script/render calls.

### 5.2 `app/youtube-studio/components/YouTubeStudioWorkspace.module.css` — new

**Code Sebelum (Current/Before)**

```css
/* No component-scoped stylesheet; styling is embedded as JSX objects. */
```

**Code Sesudah (Proposed/After)**

```css
.workspace { max-inline-size: var(--yt-content-width); margin-inline: auto; }
.workflowStep { background: var(--surface); border: 1px solid var(--border-subtle); }
.noticeDanger { background: var(--status-danger-soft); color: var(--status-danger); }
.primaryAction { background: var(--action-primary); color: var(--on-action-primary); }
```

- Define semantic, scoped layout spacing variables only if no equivalent global token exists.
- Add responsive rules that stack compact controls and keep button targets usable on narrow widths.
- All surfaces, text, borders, actions, status, radius, transitions, and shadows must use existing semantic variables; no color literals.

### 5.3 `app/youtube-studio/page.js`

**Code Sebelum (Current/Before)**

```jsx
<main className="main-content" style={{ padding: '32px 36px', background: 'var(--bg-primary)', minHeight: '100vh', width: '100%' }}>
```

**Code Sesudah (Proposed/After)**

```jsx
<main className="main-content">
  <div className="page-container"><YouTubeStudioWorkspace /></div>
</main>
```

Use the existing semantic application layout utilities. Do not introduce a YouTube Studio-specific color or hard-coded layout inline style.

### 5.4 `scripts/test-youtube-studio-editorial-workflow.mjs`

**Code Sebelum (Current/Before)**

```js
// Existing workflow tests focus on repository/API behavior only.
```

**Code Sesudah (Proposed/After)**

```js
// Preserve existing workflow assertions and add smoke coverage for
// direct channel-create selection and no implicit generation on episode selection.
```

If the repository has no browser test harness, document the UI smoke steps rather than adding an unsuitable dependency. Keep API/domain tests independent of presentation details.

### 5.5 `sot/menus/youtube-studio-editorial-ui-refinement-implementation-plan.md`

**Code Sebelum (Current/Before)**

```md
- [ ] Refactor markup ...
```

**Code Sesudah (Proposed/After)**

```md
- [x] Refactor markup ...
```

Update each task only after the associated verification succeeds. If implementation requires another file, add it to this section with before/after snippets before editing it.

## 6. Verification and Acceptance

### Functional

1. Existing active strategy, series, episode idea, and planned episode remain visible after the refactor.
2. Create channel selects the exact returned record, including when channel names are identical.
3. AI strategy draft/refine/activate still call the existing endpoints and surface errors without blocking browser dialogs.
4. Series remains unavailable before strategy activation; ideas remain unavailable before series selection.
5. Adopt/manual episode creates/refetches Planned episode correctly.
6. Selecting a planned episode does not make blueprint or script generation requests.

### Visual and accessibility

1. Desktop uses one content column—no two-column grid, no left series rail, and no content tabs hiding the workflow.
2. UI responds correctly at 360px, 736px, and normal desktop width.
3. Light/dark theme uses MAKNA Flow token values with readable contrast.
4. No hex/rgb/rgba color literal or inline `style` remains within `app/youtube-studio/**`.
5. Controls have labels, visible focus, usable disabled explanation, and live feedback/error regions.

### Commands and deployment

Run the applicable focused test plus:

```bash
npm run build
npm run deploy:macmini-dev
```

Then verify on **Mac Mini Dev only**:

- UI: `http://100.95.245.55:5020/youtube-studio`
- API: `http://100.95.245.55:7020`

Do **not** run `npm run deploy:staging`, `npm run deploy:macmini-staging`, `npm run deploy:macmini-prod`, `npm run deploy:production`, or any production deployment command.

## 7. Release

After all verification and Dev-only deployment succeed, follow mandatory repository release SOP:

```bash
npm run release-non-interactive -- --type patch --title "YouTube Studio One-Column Workflow" --points "Refactor workflow editorial menjadi satu kolom vertikal|Gunakan CSS Module semantik berbasis theme MAKNA Flow|Perbaiki feedback dan pemilihan channel baru"
```

Release/push is not authorization to deploy beyond Mac Mini Dev.

