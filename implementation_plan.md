# Implementation Plan: Deconstruction Lab Core Problem Intelligence UI & API (PR 3 Completion)

Rencana implementasi ini bertujuan untuk menyelesaikan **PR 3** secara tuntas (end-to-end), yaitu menghadirkan antarmuka visual dan API pendukung pada **Deconstruction Lab** agar pengguna dapat:
1. Melihat rumusan **Masalah Utama (Core Problem)**, **Solusi Pokok (Core Solution)**, dan **Target Audiens & Pain Point (Target Audience)** secara elegan melalui *Triad Intelligence Cards*.
2. Melakukan **Inline Editing** secara langsung pada halaman detail dekonstruksi jika ingin mengoreksi atau mempertajam kalimat rumusan AI, lalu menyimpannya secara instan ke database PostgreSQL.
3. Melihat cuplikan Masalah Utama (`core_problem`) pada tabel daftar library dekonstruksi (`List View`).
4. Mengakses tombol jalan pintas (shortcut) untuk langsung meluncurkan kampanye di **Multiplier Lab** dengan masalah utama yang telah terkunci.
5. Memastikan seluruh implementasi mematuhi SOP Design Tokens Semantic (`app/theme.css`), kompatibel sempurna di Light & Dark Mode, serta diverifikasi dengan tes unit otomatis.

---

## 📋 Execution Task List

- [x] **Task 1: Dukungan API Penyimpanan & Pencarian Masalah Utama**
  - [x] Perbarui method `PUT` pada [app/api/v2/deconstruct/assets/[id]/route.js](file:///Users/sabeqmmursyid/_contentflow-staging/app/api/v2/deconstruct/assets/[id]/route.js) agar menerima pembaruan field `core_problem`, `core_solution`, dan `target_audience_pain_point`.
  - [x] Perbarui query pencarian `q` pada `listDeconstructAssets` di [lib/db.js](file:///Users/sabeqmmursyid/_contentflow-staging/lib/db.js) agar mencakup pencarian berbasis `core_problem` dan `core_solution`.
  - [x] Pastikan query legacy asset list (`searchParams.get('assets') === 'true'`) pada [app/api/v2/deconstruct/route.js](file:///Users/sabeqmmursyid/_contentflow-staging/app/api/v2/deconstruct/route.js) menyertakan `core_problem`, `core_solution`, dan `target_audience_pain_point`.
- [x] **Task 2: Integrasi Triad Intelligence Cards & Inline Edit pada Detail Blueprint UI**
  - [x] Tambahkan state `editingProblem`, `coreProblemInput`, `coreSolutionInput`, `targetAudienceInput`, dan `savingProblem` pada [app/deconstruct/[id]/page.js](file:///Users/sabeqmmursyid/_contentflow-staging/app/deconstruct/[id]/page.js).
  - [x] Buat handler `handleSaveCoreProblem` untuk memanggil API `PUT /api/v2/deconstruct/assets/[id]`.
  - [x] Tampilkan komponen *Triad Intelligence Cards* (Masalah Utama, Solusi Pokok, Target Audiens) dengan styling semantic tokens (`var(--status-danger)`, `var(--status-success)`, `var(--status-info)`, `var(--surface-raised)`).
  - [x] Sediakan tombol interaktif "✏️ Edit Rumusan Masalah", form textarea inline saat mode edit aktif, serta tombol "Simpan & Kunci Rumusan Baru".
  - [x] Tambahkan tombol shortcut aksi "🚀 Buat Kampanye di Multiplier Lab (Kunci Masalah Ini)" yang mengarahkan pengguna ke `/multiplier-lab?blueprint_id=${asset.id}`.
- [x] **Task 3: Penampilan Kolom Masalah Utama pada Tabel Library Dekonstruksi**
  - [x] Perbarui tabel list pada [app/deconstruct/page.js](file:///Users/sabeqmmursyid/_contentflow-staging/app/deconstruct/page.js) agar kolom ringkasan menampilkan indikator/badge Masalah Utama (`🎯 ${asset.core_problem}`) yang tajam dan mudah dibaca sekilas.
  - [x] Sediakan tooltip/hover yang menampilkan `core_solution` dan `target_audience_pain_point`.
- [x] **Task 4: Unit Testing Otomatis & Verifikasi End-to-End**
  - [x] Buat file pengujian otomatis `tests/deconstruct-core-problem-ui.test.js` untuk memverifikasi:
    - Update `PUT /api/v2/deconstruct/assets/[id]` menyimpan field `core_problem`, `core_solution`, dan `target_audience_pain_point`.
    - Query `listDeconstructAssets` mengembalikan field tersebut dan mendukung filter pencarian berbasis kata kunci masalah.
  - [x] Jalankan test runner `node --test tests/deconstruct-core-problem-ui.test.js` dan pastikan seluruh tes lolos 100%.
- [x] **Task 5: SOP Rilis Non-Interaktif & Auto Git Sync**
  - [x] Jalankan perintah rilis non-interaktif `npm run release-non-interactive` sesuai SOP untuk commit, tag, changelog, dan push ke GitHub.

---

## 🔍 Before & After Code Snippets

### 1. `app/api/v2/deconstruct/assets/[id]/route.js` (Dukungan Simpan `core_problem`)

#### Code Sebelum (Current/Before):
```javascript
// app/api/v2/deconstruct/assets/[id]/route.js:L48-L56
    const updates = {};
    if (body.tags !== undefined) updates.tags = body.tags;
    if (body.niche !== undefined) updates.niche = body.niche;
    if (body.page_source !== undefined) updates.page_source = body.page_source;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'Metadata update tidak valid' }, { status: 400 });
    }

    await updateDeconstructAsset(id, updates);
```

#### Code Sesudah (Proposed/After):
```javascript
// app/api/v2/deconstruct/assets/[id]/route.js:L48-L62
    const updates = {};
    if (body.tags !== undefined) updates.tags = body.tags;
    if (body.niche !== undefined) updates.niche = body.niche;
    if (body.page_source !== undefined) updates.page_source = body.page_source;
    if (body.core_problem !== undefined) updates.core_problem = body.core_problem;
    if (body.core_solution !== undefined) updates.core_solution = body.core_solution;
    if (body.target_audience_pain_point !== undefined) updates.target_audience_pain_point = body.target_audience_pain_point;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'Metadata update tidak valid' }, { status: 400 });
    }

    await updateDeconstructAsset(id, updates);
```

---

### 2. `lib/db.js` (Pencarian `core_problem` & `core_solution` pada `listDeconstructAssets`)

#### Code Sebelum (Current/Before):
```javascript
// lib/db.js:L2931-L2935
  if (q) {
    query += ' AND (source_url LIKE ? OR page_source LIKE ? OR original_caption LIKE ? OR viral_pattern_summary LIKE ?)';
    const likeVal = `%${q}%`;
    params.push(likeVal, likeVal, likeVal, likeVal);
  }
```

#### Code Sesudah (Proposed/After):
```javascript
// lib/db.js:L2931-L2935
  if (q) {
    query += ' AND (source_url LIKE ? OR page_source LIKE ? OR original_caption LIKE ? OR viral_pattern_summary LIKE ? OR core_problem LIKE ? OR core_solution LIKE ?)';
    const likeVal = `%${q}%`;
    params.push(likeVal, likeVal, likeVal, likeVal, likeVal, likeVal);
  }
```

---

### 3. `app/api/v2/deconstruct/route.js` (Legacy Asset Ingest Select Extension)

#### Code Sebelum (Current/Before):
```javascript
// app/api/v2/deconstruct/route.js:L24
      let query = "SELECT id, batch_id, source_url, original_caption, niche, tags, created_at, viral_pattern_summary, product_ideas_json, original_storyboard_json FROM re_deconstructed_assets WHERE status = 'deconstructed' AND tenant_id = ?";
```

#### Code Sesudah (Proposed/After):
```javascript
// app/api/v2/deconstruct/route.js:L24
      let query = "SELECT id, batch_id, source_url, original_caption, niche, tags, created_at, viral_pattern_summary, product_ideas_json, original_storyboard_json, core_problem, core_solution, target_audience_pain_point FROM re_deconstructed_assets WHERE status = 'deconstructed' AND tenant_id = ?";
```

---

### 4. `app/deconstruct/[id]/page.js` (State & Triad Intelligence UI)

#### Code Sebelum (Current/Before):
```javascript
// app/deconstruct/[id]/page.js:L420-L438
            {/* Viral Pattern Summary Insights */}
            {asset.viral_pattern_summary && (
              <div style={{
                marginBottom: 24,
                padding: '20px 24px',
                borderRadius: 'var(--radius-sm)',
                background: 'linear-gradient(135deg, rgba(108,92,231,0.08) 0%, rgba(108,92,231,0.02) 100%)',
                border: '1px solid rgba(108,92,231,0.25)',
                borderLeft: '4px solid var(--accent)',
                boxShadow: '0 4px 20px var(--overlay-subtle)'
              }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 800, margin: '0 0 10px 0', color: 'var(--accent-light)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  🧠 AI Viral Pattern & Insights
                </h4>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
                  {asset.viral_pattern_summary}
                </p>
              </div>
            )}
```

#### Code Sesudah (Proposed/After):
```jsx
// app/deconstruct/[id]/page.js:L420-L540
            {/* Triad Intelligence Cards (Core Problem, Solution, Audience) */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  🎯 DNA Masalah & Solusi Utama Blueprint
                  <span className="badge" style={{ background: 'var(--status-info-soft)', color: 'var(--status-info)', fontSize: '0.72rem', padding: '2px 8px', borderRadius: 4 }}>
                    Strict Continuity Anchor
                  </span>
                </h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  {!editingProblem ? (
                    <button
                      type="button"
                      onClick={() => setEditingProblem(true)}
                      className="btn btn-secondary"
                      style={{ padding: '4px 12px', fontSize: '0.75rem', height: 28 }}
                    >
                      ✏️ Edit Rumusan Masalah
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingProblem(false);
                          setCoreProblemInput(asset.core_problem || '');
                          setCoreSolutionInput(asset.core_solution || '');
                          setTargetAudienceInput(asset.target_audience_pain_point || '');
                        }}
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '0.75rem', height: 28 }}
                        disabled={savingProblem}
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveCoreProblem}
                        className="btn btn-primary"
                        style={{ padding: '4px 12px', fontSize: '0.75rem', height: 28 }}
                        disabled={savingProblem}
                      >
                        {savingProblem ? 'Menyimpan...' : '💾 Simpan Rumusan'}
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => router.push(`/multiplier-lab?blueprint_id=${asset.id}`)}
                    className="btn btn-primary"
                    style={{ padding: '4px 12px', fontSize: '0.75rem', height: 28 }}
                  >
                    🚀 Buka di Multiplier Lab
                  </button>
                </div>
              </div>

              {/* 3 Grid Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                
                {/* 1. Core Problem Card */}
                <div style={{
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border-subtle)',
                  borderTop: '4px solid var(--status-danger)',
                  borderRadius: 'var(--radius-sm)',
                  padding: 18,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--status-danger)' }}>
                        🎯 Masalah Utama (Core Problem)
                      </span>
                      <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4, background: 'var(--status-danger-soft)', color: 'var(--status-danger)', fontWeight: 700 }}>
                        Keluhan Pokok
                      </span>
                    </div>
                    {!editingProblem ? (
                      <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.55, margin: 0 }}>
                        {asset.core_problem || '(Belum dirumuskan)'}
                      </p>
                    ) : (
                      <textarea
                        className="form-input"
                        rows={3}
                        value={coreProblemInput}
                        onChange={e => setCoreProblemInput(e.target.value)}
                        placeholder="Contoh: Membakar dan merontokkan lemak perut secara alami tanpa obat pelangsing..."
                        style={{ width: '100%', fontSize: '0.84rem' }}
                      />
                    )}
                  </div>
                  <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid var(--border-subtle)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Diwariskan ke Multiplier & Voiceover Remake
                  </div>
                </div>

                {/* 2. Core Solution Card */}
                <div style={{
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border-subtle)',
                  borderTop: '4px solid var(--status-success)',
                  borderRadius: 'var(--radius-sm)',
                  padding: 18,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--status-success)' }}>
                        💡 Solusi Pokok (Core Solution)
                      </span>
                      <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4, background: 'var(--status-success-soft)', color: 'var(--status-success)', fontWeight: 700 }}>
                        Resep / Ramuan
                      </span>
                    </div>
                    {!editingProblem ? (
                      <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.55, margin: 0 }}>
                        {asset.core_solution || '(Belum dirumuskan)'}
                      </p>
                    ) : (
                      <textarea
                        className="form-input"
                        rows={3}
                        value={coreSolutionInput}
                        onChange={e => setCoreSolutionInput(e.target.value)}
                        placeholder="Contoh: Rebusan kayu manis cengkeh 8 menit dengan perasan lemon segar..."
                        style={{ width: '100%', fontSize: '0.84rem' }}
                      />
                    )}
                  </div>
                  <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid var(--border-subtle)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Formula & Bahan Baku Visual Asli
                  </div>
                </div>

                {/* 3. Target Audience Card */}
                <div style={{
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border-subtle)',
                  borderTop: '4px solid var(--status-info)',
                  borderRadius: 'var(--radius-sm)',
                  padding: 18,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--status-info)' }}>
                        👥 Target Audiens & Pain Point
                      </span>
                      <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4, background: 'var(--status-info-soft)', color: 'var(--status-info)', fontWeight: 700 }}>
                        Profil Audiens
                      </span>
                    </div>
                    {!editingProblem ? (
                      <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.55, margin: 0 }}>
                        {asset.target_audience_pain_point || '(Belum dirumuskan)'}
                      </p>
                    ) : (
                      <textarea
                        className="form-input"
                        rows={3}
                        value={targetAudienceInput}
                        onChange={e => setTargetAudienceInput(e.target.value)}
                        placeholder="Contoh: Audiens usia 25-45 tahun yang frustrasi lingkar pinggang sesak..."
                        style={{ width: '100%', fontSize: '0.84rem' }}
                      />
                    )}
                  </div>
                  <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid var(--border-subtle)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Sasaran Persona Content Planner
                  </div>
                </div>

              </div>
            </div>

            {/* AI Viral Pattern Summary Insights */}
            {asset.viral_pattern_summary && (
              <div style={{
                marginBottom: 24,
                padding: '20px 24px',
                borderRadius: 'var(--radius-sm)',
                background: 'linear-gradient(135deg, rgba(108,92,231,0.08) 0%, rgba(108,92,231,0.02) 100%)',
                border: '1px solid rgba(108,92,231,0.25)',
                borderLeft: '4px solid var(--accent)',
                boxShadow: '0 4px 20px var(--overlay-subtle)'
              }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 800, margin: '0 0 10px 0', color: 'var(--accent-light)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  🧠 AI Viral Pattern & Insights
                </h4>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
                  {asset.viral_pattern_summary}
                </p>
              </div>
            )}
```

---

### 5. `app/deconstruct/page.js` (Kolom Masalah Utama pada Tabel List)

#### Code Sebelum (Current/Before):
```jsx
// app/deconstruct/page.js:L678-L688
                        <td>
                          <div style={{
                            maxWidth: 220,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: 'var(--text-secondary)'
                          }}>
                            {asset.viral_pattern_summary || asset.original_caption || '—'}
                          </div>
                        </td>
```

#### Code Sesudah (Proposed/After):
```jsx
// app/deconstruct/page.js:L678-L695
                        <td>
                          <div style={{ maxWidth: 260 }}>
                            {asset.core_problem ? (
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.78rem', lineHeight: 1.4, marginBottom: 2 }}>
                                🎯 {asset.core_problem}
                              </div>
                            ) : null}
                            <div style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              color: 'var(--text-muted)',
                              fontSize: '0.74rem'
                            }}>
                              {asset.core_solution ? `💡 ${asset.core_solution}` : (asset.viral_pattern_summary || asset.original_caption || '—')}
                            </div>
                          </div>
                        </td>
```

---

## 🚀 Prosedur Verifikasi & Pengujian

1. **Automated Unit Testing (`tests/deconstruct-core-problem-ui.test.js`)**:
   - Memverifikasi endpoint API `PUT /api/v2/deconstruct/assets/[id]` berhasil menyimpan pembaruan `core_problem`, `core_solution`, dan `target_audience_pain_point`.
   - Memverifikasi endpoint API `GET /api/v2/deconstruct/assets/[id]` mengembalikan data yang diperbarui.
   - Memverifikasi query `listDeconstructAssets` dapat mencari aset berdasarkan kata kunci yang ada pada `core_problem` (misal kata kunci "lemak").
2. **Review Mockup HTML & Manual Verification**:
   - Membuka mockup di [public/mockup_deconstruct_core_problem.html](file:///Users/sabeqmmursyid/_contentflow-staging/public/mockup_deconstruct_core_problem.html) untuk memastikan keselarasan visual, kontras warna, dan adaptasi tema Light/Dark.
   - Menguji interaksi simpan inline pada detail aset dan memeriksa respon toast visual.
3. **SOP Rilis Non-Interaktif**:
   - Menjalankan `npm run release-non-interactive` setelah seluruh tes lolos.
