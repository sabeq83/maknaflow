# Execution Notes — ContentFlow Studio

Tanggal: 22 Oktober 2026 (Asia/Jakarta)
Dokumen Pelacak Kemajuan & Inventarisasi Teknis ContentFlow Studio

---

## 1. Baseline Lingkungan & Git

- **Workspace Path**: `/Users/sabeqmmursyid/_contentflow-staging`
- **Active Branch**: `main`
- **HEAD Commit SHA**: `3f76c459b0817bfcd3ea8aff3b69bc101d192efd`
- **Remote URL**: `origin` -> `https://github.com/sabeq83/maknaflow.git`
- **Pre-existing Unstaged Modifications**:
  - `implementation_plan.md` (root, pengerjaan Recipe Labs — wajib dipertahankan)
  - `public/mockup_contentflow_studio.html` (revisi visual tanpa Bank Ide)
- **Node Environment**: Node.js & Next.js 15 (Route Handlers: `context.params` adalah Promise, wajib `await params`).

---

## 2. Matriks Inventarisasi Kontrak 4 Mesin Campaign & Layanan Publishing

### A. Generator Content Planner & Ingest (Pillar / Recipe)

| Parameter | Spesifikasi Nyata |
| --- | --- |
| **Form / Controller** | `app/content-planner/page.js`, `app/content-planner/[id]/page.js`, `app/components/ImportPlannerModal.js` |
| **Mode / Fokus** | `product_campaign` (katalog produk/affiliate), `brand_editorial` (pilar konten edukasi), `recipe_campaign` (sinergi/rotasi resep kuliner), `cartoon_universe` (world-aware Pawville dll.) |
| **Field Utama** | `plannerFocus`, `accountName`, `title`, `brand_id`, `product_id`, `productName`, `productDesc`, `productUsp`, `productUrl`, `affiliateUrl`, `productPhotoUrl`, `platform` (tiktok, ig, dll), `objective` (soft_sell, hard_sell, dll), `planner_count` (6, 12, 18, 30), `targetAudience`, `promotionContext`, `customInstructions`, `recipeCategory`, `recipeProductIds`, `recipeStrategyMode`, `recipeCount`, `contentWorld`, `knowledgeDomain`, `universeProfile` |
| **Validasi Kritis** | - `product_campaign`: Nama produk & deskripsi wajib; jika bukan `isNonAffiliate`, affiliate url wajib terikat (`isAffiliateLinkLocked`).<br>- `brand_editorial`: Brand context & minimal 1 pilar konten wajib diisi.<br>- `recipe_campaign`: minimal 1 produk jika katalog.<br>- Baris Planner terkunci (`is_locked`) tidak boleh diregenerasi. |
| **Payload Submit** | `POST /api/content-planner` (JSON body) -> menghasilkan planner `draft`.<br>`POST /api/content-planner/[id]/execute` (JSON) -> mengeksekusi AI generation -> status `completed`.<br>`POST /api/v2/pillar-campaigns/ingest-planner` (JSON) -> ingest ke Organic Pillar (OPC).<br>`POST /api/content-planner/[id]/ingest-recipe` (JSON) -> ingest ke OPC Resep. |
| **Cardinality Output** | Planner menghasilkan N baris ide (`effectivePlannerCount` baris, 1 baris = 1 ide video). Tiap baris yang di-ingest ke OPC menjadi 1 campaign item (`pillar_campaign_items`). Di Studio, 1 baris planner = 1 slot produksi. |
| **Scheduler Trigger** | `startCampaignScheduler()` memproses `pillar_campaign_items` jika status `running`/`pending`. |
| **Review Gate** | Storyboard / start-frame creative review (`workflow_status = 'ready_for_review'`). |
| **Aset Akhir & Sync** | Video MP4 final di Nextcloud / local storage (`ffmpeg_output_path`) -> `syncContentFlowItem` -> `content_flow_items`. |

---

### B. Reverse Engineering (RE Campaigns)

| Parameter | Spesifikasi Nyata |
| --- | --- |
| **Form / Controller** | `app/re-campaigns/page.js` |
| **Mode Produksi** | Single (`handleCreate`, textarea multi-URL) vs Mass (`handleMassSubmit`, upload CSV/XLSX). |
| **Field Utama** | `campaignName`, `accountName`, `urlsText` (1 URL per baris), `aspectRatio` (9:16, 16:9), `targetAi` (Google Veo dll), `videoModel` (veo_31_lite dll), `clipDuration` (4, 6, 8, 10s), `wordsPerClip`, `faceVisibility`, `visualStyle`, `angleMultiplier`, `targetLanguage`, `targetDemographic`, `narrativeMode`, `promotionStyle`, `isBridgingActive` (`bridgeAtClip`, `bridgeDurationClips`, `bridgingMode`, `targetProductId`, `manualProduct*`), `visualMode` (`pure_t2v`, `hybrid_lock` + `productRefImage`), `isVsoActive` (`visualIdentity`, `characterConcept`, dll), `voiceProvider` (minimax, gemini), `voicePersona`, `voiceSpeed`, `voiceVolume`, `ttsModelQuality`, `sfxSetting`, `enableAudioSegment`, `enableVoAudit`, `ffmpegSyncOption`, `ffmpegVideoScale`, `ffmpegSfxVolume`, `ffmpegBgmVolume`, `postFacebook`, `facebookPageId`, `facebookServerUrl`, `nextcloudParentFolder`, `status` (`running`, `draft`). |
| **Validasi Kritis** | `campaignName` wajib; minimal 1 URL valid; jika bridging aktif: `bridgeAtClip` valid (2..targetClips), jika mode `select_existing` targetProductId wajib, jika `manual_input` nama+deskripsi wajib, jika `hybrid_lock` gambar produk wajib. |
| **Payload Submit** | `POST /api/v2/re-campaigns` via `multipart/form-data` (FormData) karena mendukung file upload `product_media`. |
| **Cardinality Output** | Single: Jumlah item = `urls.length * (angleMultiplier || 1)`. Mass: `parsedRows.length`. Tiap URL sumber menghasilkan 1 video hasil dekonstruksi + rekonstruksi. |
| **Scheduler Trigger** | `tickCampaignScheduler()` mengeksekusi step: scraper -> analyzer -> prompt -> tts -> glabs -> ffmpeg -> social. |
| **Review Gate** | `executionMode === 'manual_review'` menjeda sebelum produksi video/rendering jika diaktifkan. |
| **Aset Akhir & Sync** | `ffmpeg_output_path` -> Nextcloud link -> otomatis sync ke `content_flow_items` via `auto_sync_contentflow`. |

---

### C. Multiplier Lab

| Parameter | Spesifikasi Nyata |
| --- | --- |
| **Form / Controller** | `app/multiplier-lab/page.js` |
| **Workflow Mode** | `multi_blueprint_one_product`, `one_blueprint_multi_product`, `multi_blueprint_multi_angle`, `one_blueprint_multi_angle`. |
| **Field Utama** | `campaignName`, `accountName`, `selectedBrandId`, `campaignType` (`editorial` vs `product`), `combinationRows` (tinjauan kombinasi blueprint x produk/sudut), `vso_config_json` (Aesthetics, Model, Durasi, Ratio, Face, VSO), `bridging_config_json` (Bridging clips, manual/catalog, Topic, Outro), `audio_config_json` (Voice, TTS, FFmpeg scale/volume, Nextcloud, Demographic), `submitMode` (`draft` vs `running`), `product_ref_image_path`. |
| **Validasi Kritis** | `combinationRows.length > 0` wajib; nama kampanye wajib; jika product campaign bridging validasi foto/produk harus terpenuhi. |
| **Payload Submit** | `POST /api/v2/multiplier` (JSON body) -> menciptakan entri `re_campaigns` dan entri task baris `re_multiplier_tasks` atau rows. |
| **Cardinality Output** | Persis `combinationRows.length` video output. Tiap kombinasi adalah 1 task produksi video mandiri. |
| **Scheduler Trigger** | Worker `re-multiplier-worker.js` memproses queue task (`getPendingMultiplierTasks` & `processSingleMultiplierTask`). |
| **Review Gate** | Storyboard review checkpoint jika `approval_mode === 'storyboard'`. |
| **Aset Akhir & Sync** | Video final MP4 -> tersimpan di path disk & Nextcloud -> auto-sync ke ContentFlow. |

---

### D. Recipe Labs

| Parameter | Spesifikasi Nyata |
| --- | --- |
| **Form / Controller** | `app/recipe-labs/page.js` |
| **Cabang Output Utama** | 1. **Video Reels (`campaign_type = 'video'`)**: Reels Video Storyboard kuliner 4-klip dengan Veo + TTS + FFmpeg.<br>2. **Static Image Grid (`campaign_type = 'static'`)**: Foto hidangan kuliner bersusun/grid majalah (3, 4, 5, 6 slot layout foto). |
| **Field Video** | `campaignName`, `visualStyleVideo`, `nextcloudParentFolder`, `enableSocialPost`, `enableGlabsVideo`, `spreadsheetId`, `sourceDeconstructAssetId`, `contentPillar`, `customHook`, `visualActionGuideline`, `customInstruction`, `narrativeMode`, `targetAi`, `videoModel`, `aspectRatio`, `faceVisibility`, `wordsPerClip`, `isBridgingActive`, `targetClipsCount`, `bridgeAtClip`, `promotionStyle`, `bridgingMode`, `targetProductId`, `manualProduct*`, `isVsoActive`, `characterConcept`, `subjectDemographic`, `wardrobeStyle`, `lightingStyle`, `voiceProvider`, `voicePersona`, `voiceSpeed`, `voiceVolume`, `ttsModelQuality`, `enableFfmpeg`, `ffmpegSyncOption`, `ffmpegVideoScale`, `ffmpegSfxVolume`, `ffmpegBgmVolume`, `targetLanguage`. |
| **Field Static** | `category` ('Makanan', 'Minuman', 'Kue & Pastry', 'Camilan & Dessert', 'Custom Input'), `customCategory`, `visualStyle` ('Food Porn', 'Rustic Homemade', 'Fine Dining Elegance', 'Bright & Clean Modern', 'Dark & Moody Gourmet', 'Street Food Vibrant'), `targetCount` (1..5 resep), `imagesPerRecipe` (3..6), `selectedLayoutId` (misal `4_editorial_split`, `3_split_left`), `gridGapSize`, `gridBorderRadius`, `gridOuterPadding`, `gridBgColor`, `sourceDeconstructAssetId`. |
| **Validasi Kritis** | - Video: `campaignName` wajib.<br>- Static: `customCategory` wajib jika kategori `Custom Input`; `nextcloudParentFolder` wajib.<br>- Image grid contract membutuhkan foto utuh sesuai layout. |
| **Payload Submit** | `POST /api/recipe-labs` (JSON body) -> insert `recipe_campaigns` dan items `recipe_campaign_items`. |
| **Cardinality Output** | - Video: 1 video reels per submit.<br>- Static: `target_recipe_count` hidangan resep (tiap hidangan menghasilkan 1 final composite grid image + N slot photo individual). |
| **Scheduler Trigger** | `tickCampaignScheduler()` memproses `processRecipeGenerator`, `processRecipeGLabs`, `processRecipeExporter`. |
| **Review Gate** | Verifikasi visual slot foto sebelum final grid compositing / final video output. |
| **Aset Akhir & Sync** | Video MP4 / Composite Grid JPG -> Sync item ContentFlow via `syncContentFlowItem`. |

---

### E. Layanan Publishing (Repliz & Multi-Account)

| Parameter | Spesifikasi Nyata |
| --- | --- |
| **Endpoint / Service** | `app/api/v2/publishing/jobs/route.js`, `lib/publishing-repository.js`, `lib/publishing-worker.js`, `lib/repliz-client.js` |
| **State Target** | `awaiting_approval` -> `scheduling` -> `scheduled` -> `verifying` -> `published` / `failed` / `manual_published` |
| **Gate Validasi Server** | 1. `validateScheduleRequest`: account_ids, publish_mode, media_type, media_url, caption, schedules.<br>2. Multi-Account Health Probe: periksa status Repliz account live (`getReplizAccount`), auto-reconnect jika disconnected.<br>3. Media Staging: `verifyPublishingDriveReady` wajib lulus jika Repliz media scheduling.<br>4. Durable Execution: `createPublishingJobs` membuat record job unik per account.<br>5. Sync ContentFlow: update status kolom platform (`tiktok_status`, `ig_status`, `fb_status`, `youtube_status`). |
| **Manual Publish Fallback** | Mendukung pencatatan posting manual dengan permalink/bukti, waktu upload, dan nama user. |

---

## 3. Keputusan Desain & Arsitektur Studio

1. **Shared Form Extraction (`app/components/campaign-forms/`)**:
   - `PlannerConfigurationForm.js`: Ekstraksi bersih controller & JSX dari `app/content-planner/page.js`.
   - `ReCampaignConfigurationForm.js`: Ekstraksi controller & JSX dari `app/re-campaigns/page.js`.
   - `MultiplierConfigurationForm.js`: Ekstraksi controller & JSX dari `app/multiplier-lab/page.js`.
   - `RecipeLabsConfigurationForm.js`: Ekstraksi controller & JSX dari `app/recipe-labs/page.js`.
   - Halaman menu lama mengimpor komponen bersama ini sehingga tidak ada bifurkasi kode.
2. **Planner Sekali Pakai (Single-Use Invariant)**:
   - Tabel `content_planner_consumptions` dengan UNIQUE constraint `(tenant_id, planner_id)`.
   - Sekali planner di-consume (oleh Studio, Ingest OPC Pillar, Ingest Recipe, atau Operator), planner berstatus `consumed` dan terkunci permanen.
   - Semua mutation endpoint (`PATCH /api/content-planner/[id]`, `DELETE /api/content-planner/[id]`, `POST /api/content-planner/[id]/execute`, `PATCH /rows/[rowId]`, `POST /rows/[rowId]`, `DELETE /rows/[rowId]`, `POST /research/refresh`, `POST /research/apply`) dipasangi guard server-side `ensurePlannerNotConsumed(plannerId, tenantId)`.
3. **Studio Database Schema**:
   - `content_studio_batches`: menyimpan batch perencanaan Studio (tenant, mode, config snapshot, planner_id, status).
   - `content_studio_slots`: slot produksi individual dengan waktu produksi UTC, waktu tayang target UTC, timezone tenant, status, mapping ke source campaign/item, output media contract, contentflow item id.
   - `content_studio_targets`: relasi 1 slot ke banyak akun penerbitan sosial media dengan status independen per akun.
   - `content_studio_approvals`: log approval immutable berisi revision hash aset/caption/jadwal/aktor.
   - `content_studio_events`: log audit dan checkpoint rekonsiliasi.
4. **UI Design System**:
   - 100% Menggunakan CSS Semantic Tokens dari `app/theme.css` (`var(--surface)`, `var(--text-primary)`, `var(--action-primary)`, dll).
   - Mendukung penuh Light Mode & Dark Mode.
   - Tampilan default: Kalender Bulan Berjalan (mengikuti waktu lokal tenant) dengan toggle Table View.
