# Implementation Plan: Recipe Labs Enhancements & ContentFlow Hub Integration

Rencana implementasi ini dirancang untuk memenuhi 6 kebutuhan pada menu **Recipe Labs** dan integrasinya dengan **ContentFlow Hub**:
1. **Nama Akun (Brand Account) pada Form Statis**: Menambahkan dropdown pilihan Brand Profile DNA pada formulir pembuatan resep teks (statis), agar saat disimpan dan dipublikasikan, resep terasosiasi dengan akun brand tersebut.
2. **Penghapusan Toggle Facebook Page pada Form Statis**: Menghilangkan kontrol *"📘 Post Draft ke Facebook Page (Status Pending/Draft)"* karena ContentFlow Hub telah menjadi gerbang tunggal penjadwalan dan publikasi media sosial.
3. **Penghapusan Panel Integrasi Facebook Page pada Card Detil Resep**: Menghapus seluruh tombol dan panel integrasi Facebook Page draft dari kartu detail resep.
4. **Accordion Buka-Tutup pada Card Detil Resep**: Menerapkan pola single-active accordion pada setiap kartu resep dalam modal detail kampanye. Secara default hanya 1 kartu yang terbuka (kartu pertama), dan bila pengguna mengklik kartu lain, kartu yang sedang terbuka otomatis tertutup.
5. **Auto-Sync & Tombol Manual Sync ke ContentFlow Hub**:
   - Resep otomatis disinkronkan ke tabel `content_flow_items` begitu proses pembuatan poster kolase dan ekspor resep selesai (`status = 'completed'`).
   - Menyediakan tombol *“🔄 Sync ke ContentFlow”* pada kartu detail resep untuk sinkronisasi manual kapan saja.
6. **Filter Sumber Kampanye Recipe Labs di ContentFlow Hub**: Memastikan filter sumber kampanye `recipe` berfungsi lancar dan menampilkan poster 1:1, judul, naskah markdown, serta brand account di ContentFlow Hub.

---

## 📋 Execution Task List

- [x] **Task 1: Validasi & Review Mockup HTML Standalone (`public/mockup_recipe_labs_contentflow.html`)**
  - [x] Sediakan mockup interaktif visual lengkap dengan Dark/Light mode, simulasi accordion buka-tutup resep, form statis dengan Brand Account, dan simulasi ContentFlow Hub.
  - [x] Dapatkan konfirmasi dan review pengguna sebelum penulisan kode ke codebase utama.

- [x] **Task 2: Penambahan Brand Account & Penghapusan Facebook Toggle pada Form Statis (`app/recipe-labs/page.js`)**
  - [x] Tambahkan dropdown `brandProfiles` ke formulir tipe resep statis dengan label *Nama Akun (Brand Account)*.
  - [x] Hapus blok JSX checkbox toggle Facebook Page dari formulir statis.
  - [x] Pastikan payload pengiriman form statis menyertakan `brand_profile_id: brandProfileId || null` dan `post_to_facebook: 0`.

- [x] **Task 3: Implementasi Accordion Buka-Tutup & Pembersihan Facebook pada Card Detil Resep (`app/recipe-labs/page.js`)**
  - [x] Tambahkan state `openRecipeCardIndex` dengan nilai default `0` (hanya 1 kartu terbuka).
  - [x] Buat header kartu resep interaktif yang dapat diklik untuk toggle buka-tutup (jika kartu lain diklik, kartu lama otomatis tertutup).
  - [x] Hapus panel *“📘 Integrasi Facebook Page (Draft / Pending)”* dan tombol Facebook draft dari kartu detail resep (baik tipe video maupun statis).
  - [x] Gantikan dengan toolbar ContentFlow Hub yang memuat tombol manual *“🔄 Sync ke ContentFlow”* dan indikator status sinkronisasi.

- [x] **Task 4: Ingestion Scanner & Sync Function Recipe Labs (`lib/contentflow-ingest.js`)**
  - [x] Tambahkan pemindaian `recipe_campaigns` dan `recipe_items` (kategori, status completed, link Nextcloud/poster, markdown resep) ke dalam fungsi `scanAndSyncExistingCampaigns()`.
  - [x] Buat dan ekspor fungsi `syncRecipeCampaignToContentFlow(campaignId, itemId)`.

- [x] **Task 5: API Route Sync Manual Recipe Labs (`app/api/recipe-labs/[id]/sync-contentflow/route.js`)**
  - [x] Buat endpoint API POST untuk menerima permintaan sinkronisasi manual dari kartu detail resep.
  - [x] Panggil `syncRecipeCampaignToContentFlow()` dan kembalikan response JSON status sukses/gagal.

- [x] **Task 6: Auto-Sync ke ContentFlow Hub pada Scheduler Exporter (`lib/scheduler-processors.js`)**
  - [x] Pada pipeline akhir ekspor resep (setelah poster kolase dan markdown selesai dibuat), panggil sinkronisasi otomatis ke ContentFlow Hub.

- [x] **Task 7: Verifikasi Filter Sumber `recipe` pada ContentFlow Hub (`app/content-flow/page.js`)**
  - [x] Verifikasi bahwa filter sumber kampanye `recipe` memuat item resep yang telah di-sync dengan thumbnail poster 1:1, judul resep, dan preview naskah.

- [x] **Task 8: Build Check & Rilis Otomatis**
  - [x] Jalankan `npm run build` untuk memverifikasi tidak ada sintaks error atau typing issues.
  - [x] Jalankan rilis otomatis non-interaktif `npm run release-non-interactive`.

---

## 🔍 Before & After Code Snippets

### 1. `app/recipe-labs/page.js` — Penambahan Nama Akun (Brand Account) & Penghapusan Facebook Toggle

#### Code Sebelum (Current/Before):
```javascript
// app/recipe-labs/page.js:L555-L574
      } : {
        category,
        custom_category: customCategory,
        visual_style: visualStyle,
        nextcloud_parent_folder: nextcloudParentFolder,
        post_to_facebook: postToFacebook,
        enable_glabs: enableGlabs,
        target_recipe_count: targetCount,
        campaign_type: 'static',
        brand_profile_id: null,
        spreadsheet_id: null,
        config_json: null,
        images_per_recipe: imagesPerRecipe,
        selected_layout_id: selectedLayoutId,
        grid_gap_size: gridGapSize,
        grid_border_radius: gridBorderRadius,
        grid_outer_padding: gridOuterPadding,
        grid_bg_color: gridBgColor,
        source_deconstruct_asset_id: sourceDeconstructAssetId || null
      };
```

#### Code Sesudah (Proposed/After):
```javascript
// app/recipe-labs/page.js
      } : {
        category,
        custom_category: customCategory,
        visual_style: visualStyle,
        nextcloud_parent_folder: nextcloudParentFolder,
        post_to_facebook: 0,
        enable_glabs: enableGlabs,
        target_recipe_count: targetCount,
        campaign_type: 'static',
        brand_profile_id: brandProfileId || null,
        spreadsheet_id: null,
        config_json: null,
        images_per_recipe: imagesPerRecipe,
        selected_layout_id: selectedLayoutId,
        grid_gap_size: gridGapSize,
        grid_border_radius: gridBorderRadius,
        grid_outer_padding: gridOuterPadding,
        grid_bg_color: gridBgColor,
        source_deconstruct_asset_id: sourceDeconstructAssetId || null
      };
```

---

### 2. `app/recipe-labs/page.js` — Form Statis: Brand Account Dropdown & Hilangkan FB Toggle

#### Code Sebelum (Current/Before):
```jsx
// app/recipe-labs/page.js:L1584-L1633
                    <div style={{
                      padding: '16px',
                      background: 'var(--bg-glass)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          📘 Post Draft ke Facebook Page (Status Pending/Draft)
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {postToFacebook
                            ? 'ON: Otomatis membuat Draft Postingan di Facebook Page (TIDAK langsung published).'
                            : 'OFF: Tidak mengirim postingan draft ke Facebook Page.'}
                        </div>
                      </div>

                      <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px', cursor: 'pointer', flexShrink: 0 }}>
                        <input
                          type="checkbox"
                          checked={postToFacebook}
                          onChange={(e) => setPostToFacebook(e.target.checked)}
                          style={{ opacity: 0, width: 0, height: 0 }}
                        />
                        <span style={{ ... }}>
                          <span style={{ ... }} />
                        </span>
                      </label>
                    </div>
```

#### Code Sesudah (Proposed/After):
```jsx
// app/recipe-labs/page.js
                    {/* Pemilihan Nama Akun (Brand Account) untuk Form Statis */}
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        🏷️ Nama Akun (Brand Profile DNA Kuliner)
                      </label>
                      <select
                        className="form-select"
                        value={brandProfileId}
                        onChange={e => setBrandProfileId(e.target.value)}
                      >
                        <option value="">-- Tanpa Brand Profile (Umum / Default) --</option>
                        {brandProfiles.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.brand_name} {p.account_name ? `(@${p.account_name})` : ''}
                          </option>
                        ))}
                      </select>
                      <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px' }}>
                        Resep akan diasosiasikan dengan akun ini saat masuk ke ContentFlow Hub untuk publikasi media sosial.
                      </small>
                    </div>
```

---

### 3. `app/recipe-labs/page.js` — Card Detil Resep: Accordion Single-Active & Sync ke ContentFlow

#### Code Sebelum (Current/Before):
```jsx
// app/recipe-labs/page.js:L2879-L2905
                        return (
                          <div key={item.id} style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap', gap: '8px' }}>
                              <h4 style={{ color: 'var(--accent-light)', margin: 0 }}>
                                #{idx + 1} {item.recipe_title || 'Mengekstrak judul resep...'}
                              </h4>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                {item.fb_post_id && (
                                  <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: 'var(--status-info-soft)', color: 'var(--status-info)', border: '1px solid var(--status-info-soft)' }}>
                                    📘 FB Draft #{item.fb_post_id}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  className="btn btn-sm btn-secondary"
                                  disabled={postingFbId === item.id || !item.recipe_markdown_text}
                                  onClick={() => handleManualFbPost(...)}
                                >
                                  {postingFbId === item.id ? '⏳ Kirim Draft...' : '📱 Post Draft Teks'}
                                </button>
                                <span className={`stat-value ${item.status === 'completed' ? 'success' : item.status === 'failed' ? 'danger' : 'warning'}`} style={{ fontSize: '0.8rem' }}>
                                  STATUS: {item.status.toUpperCase()}
                                </span>
                              </div>
                            </div>
```

#### Code Sesudah (Proposed/After):
```jsx
// app/recipe-labs/page.js
                        const isOpen = openRecipeCardIndex === idx;
                        return (
                          <div
                            key={item.id}
                            style={{
                              background: 'var(--bg-secondary)',
                              borderRadius: 'var(--radius-sm)',
                              border: isOpen ? '1px solid var(--accent)' : '1px solid var(--border)',
                              overflow: 'hidden',
                              transition: 'border-color 0.2s ease'
                            }}
                          >
                            {/* Accordion Header (Click to Open/Close, Auto-Close Others) */}
                            <div
                              onClick={() => setOpenRecipeCardIndex(isOpen ? null : idx)}
                              style={{
                                padding: '14px 16px',
                                background: isOpen ? 'var(--surface-interactive)' : 'var(--bg-secondary)',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                userSelect: 'none'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontWeight: 800, color: 'var(--accent-light)', fontSize: '0.85rem' }}>
                                  #{idx + 1}
                                </span>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                                  {item.recipe_title || 'Mengekstrak resep...'}
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <span className={`stat-value ${item.status === 'completed' ? 'success' : item.status === 'failed' ? 'danger' : 'warning'}`} style={{ fontSize: '0.75rem' }}>
                                  {item.status.toUpperCase()}
                                </span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                  {isOpen ? '▲' : '▼'}
                                </span>
                              </div>
                            </div>

                            {/* Accordion Body: Hanya render saat isOpen === true */}
                            {isOpen && (
                              <div style={{ padding: '16px', borderTop: '1px solid var(--border)' }}>
                                {/* Pipeline Visualizer & Media */}
                                ...
                                {/* Action Bar Sync ke ContentFlow Hub (Pengganti Facebook) */}
                                <div style={{
                                  marginTop: '16px',
                                  padding: '12px 16px',
                                  background: 'var(--surface-interactive)',
                                  border: '1px solid var(--border)',
                                  borderRadius: 'var(--radius-sm)',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  flexWrap: 'wrap',
                                  gap: '12px'
                                }}>
                                  <div>
                                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      🚀 ContentFlow Hub Gateway
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                      Sinkronkan resep ini ke ContentFlow Hub untuk penjadwalan multi-kanal.
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-primary"
                                    disabled={syncingItemId === item.id || item.status !== 'completed'}
                                    onClick={() => handleManualContentFlowSync(campaignDetail.id, item.id)}
                                  >
                                    {syncingItemId === item.id ? '⏳ Menyinkronkan...' : '🔄 Sync ke ContentFlow'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
```

---

### 4. `lib/contentflow-ingest.js` — Penambahan Scanner `recipe_campaigns` & `recipe_items`

#### Code Sesudah (Proposed/After):
```javascript
// lib/contentflow-ingest.js
  // 7. Scan Recipe Labs Campaigns
  try {
    let recipeWhere = 'WHERE rc.tenant_id = ?';
    const recipeParams = [tenantId];
    if (targetCampaignId) {
      recipeWhere = 'WHERE rc.tenant_id = ? AND rc.id = ?';
      recipeParams.push(targetCampaignId);
    }

    const recipeRows = await db.prepare(`
      SELECT ri.*, rc.category, rc.custom_category, rc.nextcloud_folder_url, rc.brand_profile_id, rc.campaign_type, rc.config_json,
             bp.brand_name, bp.account_name AS bp_account_name
      FROM recipe_items ri
      JOIN recipe_campaigns rc ON ri.campaign_id = rc.id
      LEFT JOIN brand_profiles bp ON rc.brand_profile_id = bp.id
      ${recipeWhere}
      ORDER BY ri.created_at DESC
    `).all(...recipeParams);

    for (const item of (recipeRows || [])) {
      if (item.status !== 'completed' && !item.img_grid_path) continue;
      const cfId = `cf_rec_${item.id}`;
      const accountName = item.bp_account_name || item.brand_name || 'Recipe Labs';
      const videoId = `REC-${item.id.slice(0, 8).toUpperCase()}`;
      const assetUrl = item.img_grid_path || item.nextcloud_folder_url || '';
      const nextcloudUrl = item.nextcloud_folder_url || item.img_grid_path || '';

      const p = upsertContentFlowItem({
        id: cfId,
        source_type: 'recipe',
        source_campaign_id: item.campaign_id,
        source_item_id: item.id,
        account_name: accountName,
        video_id: videoId,
        campaign_title: item.recipe_title || 'Resep Kuliner',
        hook: item.recipe_title || 'Resep Lezat',
        nama_produk: item.recipe_title || 'Resep Spesial',
        link_affiliate: '',
        link_produk: '',
        caption: item.recipe_markdown_text || '',
        production_date: item.created_at,
        url_asset: assetUrl,
        drive_link: '',
        nextcloud_url: nextcloudUrl,
        pipeline_status: item.status === 'completed' ? 'Completed' : 'In Production',
        brand_profile_id: item.brand_profile_id || null,
        recipe_text_markdown: item.recipe_markdown_text || null,
        recipe_text_plain: item.recipe_markdown_text || null,
        recipe_payload_json: item.t2i_prompts_json || null,
        social_media_package_json: item.seo_data_json || null,
        content_kind: 'recipe',
        recipe_revision: 1
      });
      safePush(p, cfId);
      totalIngested++;
    }
  } catch (err) {
    console.error('[ContentFlow Sync] Error scanning Recipe Labs campaigns:', err);
  }
```

---

### 5. `lib/scheduler-processors.js` — Auto-Sync ke ContentFlow saat Pembuatan Resep Selesai

#### Code Sebelum (Current/Before):
```javascript
// lib/scheduler-processors.js:L9910-L9917
    updateRecipeItem(item.id, {
      img_grid_path: gridRelPath,
      status: 'completed'
    });

    if (folderShareUrl && !campaign.nextcloud_folder_url) {
      updateRecipeCampaign(campaign.id, { nextcloud_folder_url: folderShareUrl });
    }
```

#### Code Sesudah (Proposed/After):
```javascript
// lib/scheduler-processors.js
    updateRecipeItem(item.id, {
      img_grid_path: gridRelPath,
      status: 'completed'
    });

    if (folderShareUrl && !campaign.nextcloud_folder_url) {
      updateRecipeCampaign(campaign.id, { nextcloud_folder_url: folderShareUrl });
    }

    // Auto-sync ke ContentFlow Hub (Pintu gerbang publikasi multi-kanal)
    try {
      const { syncRecipeCampaignToContentFlow } = await import('./contentflow-ingest.js');
      await syncRecipeCampaignToContentFlow(campaign.id, item.id);
      console.log(`[Recipe Exporter] Berhasil auto-sync item #${item.id} ke ContentFlow Hub.`);
    } catch (syncErr) {
      console.warn(`[Recipe Exporter Warning] Gagal auto-sync ke ContentFlow Hub:`, syncErr.message);
    }
```
