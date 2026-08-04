# Changelog

## V2.2.164 — Isolate Content Planner and Brand Schedules routes by tenant (04/08/2026)
- Wrap all Content Planner endpoints in withTenantContext
- Wrap brand schedules endpoint and add brand profile tenant ownership validation

## V2.2.163 — Fix syntax error and restore imports in test-nextcloud route (04/08/2026)
- Fix nextcloud test route closing parentheses syntax
- Restore missing NextResponse and testNextcloudConnection imports

## V2.2.162 — Fix handler parameter mapping for non-dynamic routes (04/08/2026)
- Fix Next.js context shift that caused role check bypass/denial
- Wrap settings nextcloud test route in withTenantContext

## V2.2.161 — Fix query isolation whitespace and join bugs (04/08/2026)
- Fix query interceptor leading whitespace bypass
- Qualify tenant_id in join queries to avoid ambiguous columns

## V2.2.160 — Fix Settings API syntax wrapper (04/08/2026)
- Perbaiki penutup bracket GET dan POST handler di app/api/settings

## V2.2.159 — Global Tenant Data Isolation (04/08/2026)
- Implementasi withTenantContext wrapper global
- Isolasi Settings API kredensial
- Isolasi Pillar Campaigns, RE Campaigns, Instant Campaigns, dan Automations

## V2.2.158 — Hook User Init to Startup (04/08/2026)
- Menambahkan eksekusi inisialisasi dan migrasi hak akses pengguna otomatis pada saat server memuat database cache

## V2.2.157 — Realignment Access Permission RBAC (04/08/2026)
- Menyelaraskan kunci hak akses menu (Access Permissions) dengan menu navigasi sidebar aktif
- Memisahkan hak akses menu yang sebelumnya digabungkan untuk presisi kontrol akses
- Menambahkan migrasi otomatis schema perizinan menu lama saat server booting

## V2.2.156 — Fix Staging Node 2 Campaign Scheduler (04/08/2026)
- Mengaktifkan campaign scheduler secara default pada deployment Node 2 Staging
- Memperbaiki kendala kampanye opc_260804_opb4zk yang tertahan di status pending

## V2.2.155 — Dynamic Row Count Brand Editorial (04/08/2026)
- Jumlah baris Brand Editorial mengikuti kelipatan pilar hingga maksimal 30
- Validasi count konsisten pada draft dan eksekusi
- Prompt Gemini mengunci pemerataan ide per pilar

## V2.2.154 — Default Brand Editorial Profile (04/08/2026)
- Brand Profile menyimpan konteks tujuan dan pilar editorial
- Modal Brand Editorial memuat default dengan perlindungan overwrite
- Planner mempertahankan snapshot dan API diperketat per tenant

## V2.2.153 — Approval Skip Konflik ContentFlow (04/08/2026)
- Commit migrasi mendukung skip konflik yang disetujui eksplisit
- Dry-run hash tetap wajib dan data target tetap dipertahankan
- Regression test memastikan collision tidak tertimpa

## V2.2.152 — Hardening dan Migrasi ContentFlow Legacy (04/08/2026)
- Tenant isolation PostgreSQL untuk seluruh operasi ContentFlow
- Migrasi legacy dengan dry-run collision gate dan rollback batch
- Transfer aset resumable dengan verifikasi SHA-256

## V2.2.151 — Perbaiki Impor ZIP Produk PostgreSQL (04/08/2026)
- Hilangkan sukses palsu dan gunakan transaksi PostgreSQL nyata
- Terapkan repository produk tenant-scoped untuk CRUD impor dan ekspor
- Amankan validasi ZIP serta tambah regression test impor produk

## V2.2.150 — Stabilkan Worker Windows Pilot (03/08/2026)
- Matikan scheduler legacy pada Node 2 dan pertahankan worker automation khusus
- Perbaiki health gate agar koneksi HTTP 000 ditolak dan respons auth diterima

## V2.2.149 — Windows Pilot Content Automation (03/08/2026)
- Aktifkan worker automation dan notification secara aman di Windows WSL
- Tambah health gate port 5020 dan public base URL tanpa secret
- Tambah simulasi restart retry dedupe dan outbox recovery serta runbook rollback

## V2.2.148 — Calendar dan Run Health Automation (03/08/2026)
- Tambah calendar month/week dengan occurrence virtual dan overlay run aktual
- Tambah filter schedule brand status timezone dan detail event
- Tambah run-health tenant-scoped serta test integrasi Fase 2C

## V2.2.147 — Security and regression hardening (03/08/2026)
- Lindungi tenant Settings dan masked credentials
- Pisahkan AI directive dari mandatory outro secara konsisten
- Amankan sinkronisasi database dan audit log cleanup
- Tambahkan regression test Fase 1.2

## V2.2.146 — Fix: protect API Key fields from masking overwrites (03/08/2026)
- Menambahkan filter startsWith('••••••••') pada setting handler dan brand profile db helper untuk mencegah key tertimpa sensor bullet

## V2.2.145 — Fix: Auto trim system_audit_logs TypeError on db.exec (03/08/2026)
- Menambahkan mock method exec pada pg db helper di lib/db.js agar auto-trim system_audit_logs berjalan lancar tanpa melempar TypeError

## V2.2.144 — Sematkan AI Directive dan Outro Line di Import Content Planner (03/08/2026)
- Menambahkan input form AI Directive dan Mandatory Outro Line pada modal dialog ImportPlannerModal untuk OPC

## V2.2.143 — Fix: bypass env validation for STAGING_WEB_ORIGIN (03/08/2026)
- Bypass STAGING_WEB_ORIGIN dari deteksi forbiddenPattern Tailscale IP agar build di remote server staging berhasil

## V2.2.142 — Sematkan AI Directive dan Outro Line di OPC dan RE (03/08/2026)
- Menambahkan input form AI Directive dan Mandatory Outro Line di UI OPC dan RE
- Update Postgres database migration untuk RE campaigns
- Update prompts engine RE dan POST API routes

## V2.2.141 — Deploy Node 2 WSL Staging Infrastructure (03/08/2026)
- Tambah script setup-node2-wsl.sh untuk bootstrap WSL 2 Ubuntu di server Windows
- Tambah script deploy-node2-wsl.js untuk single-pass deployment dari Mac ke Node 2 via SSH
- Tambah ecosystem.staging.config.cjs untuk PM2 process management staging
- Update package.json dengan script deploy:node2-wsl dan setup:node2-wsl

## V2.2.140 — Deploy Node 2 WSL Staging Infrastructure (03/08/2026)
- Tambah script setup-node2-wsl.sh untuk bootstrap WSL 2 Ubuntu di server Windows
- Tambah script deploy-node2-wsl.js untuk single-pass deployment dari Mac ke Node 2 via SSH
- Tambah ecosystem.staging.config.cjs untuk PM2 process management staging
- Update package.json dengan script deploy:node2-wsl dan setup:node2-wsl

## V2.2.139 — AI Directive Guardrail dan Automation Preset Manager (02/08/2026)
- Pisahkan AI Directive dari Mandatory Outro Line dan cegah kebocoran voiceover
- Reparasi storyboard pilot tanpa menjalankan produksi
- Rapikan UI Content Automations dan tambah Admin Preset Manager serta bulk approval aman

## V2.2.138 — Native Content Automation Scheduler Fase 1 (02/08/2026)
- Tambah scheduler PostgreSQL daily weekly monthly dengan worker idempotent
- Tambah dashboard schedule run history notifikasi retry dan pause approval
- Jamin tujuh planner row serta pilot Nutribake berhenti di awaiting approval

## V2.2.137 — Operator OPC Review dan Wardrobe Sequence (02/08/2026)
- Tambahkan kontrak OPC v2 dan preset Nutribake Editorial
- Perbaiki wardrobe sequential dan stable random lintas pipeline
- Tambahkan review Markdown hemat token serta approval terikat revision

## V2.2.136 — Tombol Regenerate TTS dan Re-mux OPC (02/08/2026)
- Tambahkan aksi khusus regenerate TTS dan re-mux pada hasil OPC
- Pertahankan task dan video G-Labs saat audio dibuat ulang
- Validasi visual completed sebelum menjadwalkan re-mux

## V2.2.135 — Perbaikan FFmpeg OPC dan Urutan Upload Nextcloud (02/08/2026)
- Muxing OPC menunggu dan membaca batch TTS asynchronous dengan benar
- Validasi jumlah video dan audio mencegah hasil final parsial
- Sinkronisasi Nextcloud OPC hanya dilakukan setelah FFmpeg selesai

## V2.2.134 — Perbaikan OPC Planner dan Scheduler Staging (02/08/2026)
- Pembuatan campaign dan item OPC kini atomik dengan sequence PostgreSQL yang valid
- Brand account target demografi dan Visual Swap tampil konsisten dari planner ke detail campaign
- Scheduler staging menampilkan status efektif dan kampanye pilot berhasil masuk ready for review

## V2.2.133 — Aman Bootstrap Superadmin (02/08/2026)
- Pisahkan target production dan local staging pada CLI bootstrap superadmin

## V2.2.132 — Tenant Control Plane dan Content Operator (02/08/2026)
- Tambah bootstrap superadmin dan Tenant Management
- Perbaiki Gemini API Key Pool tenant-aware serta hasil impor
- Tambah Operator API multi-tenant dan plugin makna-content-operator

## V2.2.131 — Fix Gemini API Key PostgreSQL (02/08/2026)
- Menunggu async API key lookup sebelum memanggil Gemini
- Memperbaiki tenant query spacing sebelum ORDER BY
- Menambahkan migrasi kolom demographic OPC PostgreSQL
- Memverifikasi Gemini planner dan Content Flow sync dengan key tersimpan

## V2.2.130 — Headless Content Operator (02/08/2026)
- Menambahkan Operator API dan CLI untuk orkestrasi Content Planner ke OPC
- Menambahkan auth token, idempotency, tenant isolation, audit event, retry dan restart-safe worker
- Memisahkan service ingest dan approval OPC untuk UI serta headless workflow
- Mendokumentasikan operasi dan pengujian Content Planner editorial Nutribake

## V2.2.129 — Unifikasi Caption & 5 Tab Konsol RE-OPC (02/08/2026)
- Integrasi caption universal pada worker autopilot dan ekspor
- Unifikasi antarmuka 5 tab konsol RE Campaigns dan OPC Campaigns
- Menyisipkan caption editor di Tab 2 Storyboard RE

## V2.2.128 — Surgical backport from maknagrid (01/08/2026)
- Fix ReferenceErrors in sheets-autopilot and recipe-labs
- Implement dynamic Google OAuth redirect URI
- Align Subject tag to Biometric Anchor for Syari compliance
- Fix regex nested parentheses in prompts

## V2.2.127 — Fix Port API dari 4000 ke 6000 (31/07/2026)
- Memperbaiki deploy-production.js untuk menggunakan Port 6000 bagi API maknaflow untuk menghindari konflik dengan API maknagrid

## V2.2.126 — Fix Port UI dari 3000 ke 5000 (31/07/2026)
- Memperbaiki deploy-production.js untuk menggunakan Port 5000 bagi UI maknaflow untuk menghindari konflik dengan maknagrid

## V2.2.125 — Penyelarasan Skema Database dan UI (31/07/2026)
- Melakukan renaming tabel fisik database PostgreSQL (product_extractions->products, bridge_injector->product_bridging, ffmpeg_studio->video_studio, dll)
- Membuat Updatable Views untuk kompatibilitas ke belakang
- Menambahkan tabel pillar_campaigns dan pillar_campaign_items yang hilang di skrip PostgreSQL
- Menyelaraskan label menu Sidebar UI (Organic Pillar -> Pillar Campaign, Instant Factory -> Instant Campaign)

## V2.2.124 — Hapus total modul MAKNA Hub Sync dan reposisi Content Planner di Sidebar (31/07/2026)
- Menghapus modul cloud sync daemon, halaman frontend, API sync route, dan menempatkan Content Planner di posisi paling atas Workflow sidebar

## V2.2.123 — Hapus total modul dan API routing Strategic & G-Labs Campaign (31/07/2026)
- Menghapus berkas frontend, backend, engine, scheduler loop, dan scheduler processor Strategic & G-Labs Campaign

## V2.2.122 — Hapus menu Strategic Campaign di Sidebar (31/07/2026)
- Menghapus menu Strategic Campaign dan key map terkait di Sidebar

## V2.2.121 — Hapus menu G Labs Campaign di Sidebar (31/07/2026)
- Menghapus menu G Labs Campaign dan key map terkait di Sidebar

## V2.2.120 — Integrasi Redis dan BullMQ untuk Antrean Asinkron G-Labs (31/07/2026)
- Integrasi Redis Node 3 & antrean BullMQ
- Implementasi daemon worker Node 2 dengan concurrency limit
- Watchdog fail-retry asinkron otomatis

## V2.2.119 — Integrasi Redis dan BullMQ untuk Antrean Asinkron G-Labs (31/07/2026)
- Integrasi Redis Node 3 & antrean BullMQ
- Implementasi daemon worker Node 2 dengan concurrency limit
- Watchdog fail-retry asinkron otomatis

## V2.2.118 — Fix Casing & Duplikasi ContentFlow RE (31/07/2026)
- Normalisasi account_name ke lowercase pada sinkronisasi ContentFlow
- Gunakan ILIKE dan LOWER untuk query case-insensitive di API & DB
- Pemberantasan duplikasi ID cf_nutribake_re_* di script import

## V2.2.117 — Rencana B Gabungan (31/07/2026)
- Penyempurnaan Ingestion & Sinkronisasi DB Gambar Produk OPC
- Pemberian Failsafe Upload Markdown ke Nextcloud & Drive
- Pembaruan UI card video dengan Completed & Published dates

## V2.2.116 — Fix SQL Quote Identifiers (31/07/2026)
- Mengubah string literal SQL dari kutip ganda ke kutip tunggal di scheduler-processors.js
- Membetulkan string literal SQL bermasalah serupa di dashboard stats route.js

## V2.2.115 — Fix RE Sheets Warning (31/07/2026)
- Failsafe Google Sheets check pada RE Analyzer
- Mencegah warning log 'Cannot read properties of null (reading spreadsheets)' jika kampanye tidak terhubung ke Sheets

## V2.2.114 — Sentralisasi Model Gemini (31/07/2026)
- Sentralisasi konfigurasi model Gemini ke GEMINI_MODELS di gemini.js
- Menghilangkan hardcoding model gemini-3.5-flash di workers, processors, dan re-recomm-engine

## V2.2.113 — Perbaikan productData ReferenceError di Scheduler (31/07/2026)
- Memperbaiki ReferenceError productData is not defined pada processReAnalyzer
- Mendeklarasikan productData = null pada G-Labs scheduler lainnya

## V2.2.112 — Force T2I start frame generation (30/07/2026)
- Remove the enable_vo_audit check to ensure T2I start frames are generated on Phase 1 for all RE campaigns

## V2.2.111 — Sync brand selector states in forms (30/07/2026)
- Synchronize selectedBrandId automatically when selecting Brand Account in RE and OPC creation forms
- Remove redundant and confusing duplicate brand selection dropdowns

## V2.2.110 — Fix missing brand name and demographic configs (30/07/2026)
- Store target_demographic and target_demographic_custom parameters in RE and OPC campaigns
- Add LEFT JOIN brand_profiles to getReCampaign and getPillarCampaign DB operations
- Correct demographic rendering using a layout helper in RE and OPC detail views

## V2.2.109 — Streamline RE and OPC detail pages (30/07/2026)
- Clean up campaign detail layout to exactly 5 sections
- Apply new standardized 4-accordion configuration panel with precise key values
- Remove legacy schedulers and old info elements

## V2.2.109 — Implement separate staging/production deployers and align Campaign UI (30/07/2026)
- Add brand profiles LEFT JOIN to RE OPC and Bridge Injector listing APIs
- Add brand filter dropdown and campaign IDs to list cards
- Standardize action buttons with gradient design and remove Export MD
- Add 4-accordion configuration panel in RE and OPC detail pages
- Split deploy-node1.js into deploy-staging.js and deploy-production.js
- Add deploy:staging and deploy:production npm commands

## V2.2.108 — Implement rembg background removal and batch photos regeneration (30/07/2026)
- Add rembg CLI integration with local fallback support to bg-remover.js
- Create API endpoint app/api/v2/products/regenerate-photos/route.js to handle batch studio photo and prompt generation
- Integrate RE-Generate Photos orange-coral action button on products page UI

## V2.2.107 — Enforce English for product and geometric truths (30/07/2026)
- Update buildBatchProductTruthsPrompt to strictly enforce English output for generated truths

## V2.2.106 — Implement product truths regeneration and visual UUIDs (30/07/2026)
- Add API endpoint to batch regenerate product truths and geometry truths via Gemini AI
- Implement visual UUID display and copy clipboard action on product cards
- Render product truth and geometric truth status badges on UI cards

## V2.2.105 — Retain start frames and scripts during local media cleanup (30/07/2026)
- Optimize local file cleanup logic to keep start frame images and markdown script files
- Remove only heavy video and audio files from the temporary local directories

## V2.2.104 — Fix Next.js static files cache 404 via dynamic uploads routing (30/07/2026)
- Add custom Next.js uploads route handler to serve dynamic assets at runtime
- Sanitize paths to prevent directory traversal and protect local files
- Whitelist uploads folder path in middleware to allow access without login redirect

## V2.2.103 — Standardize Nextcloud upload folders and filenames for Bridge Injector (30/07/2026)
- Upload all source clips, TTS audio, scripts, and output videos to a newly generated public share folder
- Apply standardized naming conventions using cloud-naming-helper
- Automatically delete local temporary files post-upload
- Align Content Flow ingestion to use the newly generated Nextcloud share link

## V2.2.102 — Isolate session cookies dynamically between staging and production (30/07/2026)
- Prevent browser cookie collision between ports 3000 and 3010 on the same host
- Allow dynamic cookie name via SESSION_COOKIE_NAME environment variable

## V2.2.101 — Fix Nextcloud uploads, video dynamic suffix naming, manual product verification modal, and Content Flow sync route params (30/07/2026)
- Check and upload bulk video final to Nextcloud using public share tokens or fallback admin global credentials
- Dinamically add original clip 1 filename suffix to final video output uploads
- Add premium interactive VerificationModal to verify CSV products before execution
- Await route params promise in sync-contentflow route handler

## V2.2.100 — Add play/pause/run controls, save as draft, and minimax default for bridging injector (30/07/2026)
- Add Play/Pause/Resume action buttons to campaign cards
- Add Save as Draft button to campaign forms
- Bypass uploads folder in auth middleware to show Start Frame
- Change default TTS settings to Minimax

## V2.2.99 — Add account_name support and ContentFlow sync to Bridge Injector (29/07/2026)
- Add brand account_name support to bulk bridging
- Auto sync bridging outputs to ContentFlow after Nextcloud upload
- Create manual sync button in UI

## V2.2.98 — Fix product-bridge-inject page missing function (29/07/2026)
- Fix ReferenceError in product-bridge-inject page by adding missing fetchBrandProfiles function definition

## V2.2.97 — Fix migration search_path and sync staging tables (29/07/2026)
- Fix scripts/migrate-sqlite-to-postgres.js client connection search_path
- Sync all tables to PostgreSQL staging schema on Node 3

## V2.2.96 — Add Staging Deployment Support (29/07/2026)
- Add scripts/deploy-staging.js for automated staging deploy
- Add scripts/init-staging-db.js for PostgreSQL schema isolation
- Update lib/db-pg.js to support dynamic search_path
- Add npm script deploy:staging

## V2.2.95 — Perbaikan visual truth & geometry lock di menu RE dan Bridge Injector (29/07/2026)
- Menyisipkan placeholder Product Truth dan parameter nama file pada t2i_prompt RE Campaign
- Menambahkan logika ekstraksi nama file dan tag referensi gambar pada Bridge Injector

## V2.2.95 — Perbaikan visual truth & geometry lock di menu RE dan Bridge Injector (29/07/2026)
- Fix 1: Menyisipkan placeholder Product Truth dan parameter nama file `${reRefFilenameTag}` pada Layer 2 template output `t2i_prompt` di menu RE (`buildReverseEngineeringBridgePrompt`) agar geometry_lock tidak patah.
- Fix 2: Menambahkan logika ekstraksi nama file dan tag referensi gambar serta menyisipkannya ke template output `clip2_t2i_prompt` di Bridge Injector (`buildProductBridgingInjectorPrompt`).

## V2.2.94 — Fix hash collision folder Nextcloud OPC (last-6-chars) (29/07/2026)
- Fix kritis: formatVideoId dan getCampaignParentFolderName kini ambil 6 karakter TERAKHIR campaign ID sebagai hash unik
- Sebelumnya opc_260728_w6o1hy dan opc_260728_kxnf2w sama-sama hash opc260 lalu bertabrakan di folder yang sama
- Setelah fix: w6o1hy kxnf2w i0s8vb 0v062z 7wzmh7 st7iof semua unik per kampanye

## V2.2.93 — Fix folder Nextcloud OPC per-produk & per-brand (Dapur Botani) (29/07/2026)
- Fix 1: getProductSlug strip prefix OPC campaign_name agar slug unik per produk (nutrifarm_jahe bukan opc_20260728)
- Fix 2a: getCampaignParentFolderName self-heal account_name dari brand_profile_id agar folder dimulai dapurbotani bukan umum
- Fix 2b: syncOpcCampaignAssetsToNextcloud inject account_name dari brand_profile_id
- Fix 2c: 5 call site getCampaignParentFolderName OPC kini meneruskan db untuk self-heal

## V2.2.92 — Product Reference File anchor di T2I prompt OPC & RE (29/07/2026)
- Fix 1: Inject product_filename_declare & clean_photo_url ke productData OPC MassProd path
- Fix 2: Tambah opcRefFilenameTag ke template T2I buildOrganicPillarPrompt agar AI meniru format Product Reference File secara konkret
- Fix 3: resolveProductData kini return product_filename_declare product_truth geometric_truth di 3 mode (select_existing url_extract)

## V2.2.91 — Upgrade Gemini model ke 3.6-flash & fix 429 free tier detection (29/07/2026)
- Fix isDailyLimit: tambah keyword free_tier generate_content_free_tier agar key langsung di-exhaust bukan cooldown 45s
- Upgrade model default gemini-3.5-flash ke gemini-3.6-flash di 8 lokasi (model current lebih stabil)
- Update fallback chain: 3.6-flash to 3.5-flash to flash-latest

## V2.2.90 — Fix naskah.md 409 Conflict di Nextcloud Sync (29/07/2026)
- Tambah pengecekan exists() untuk backup naskah.md sebelum upload di semua 4 fungsi sync (OPC RE-Variant RE-Item IFC)
- File naskah.md backup tidak lagi di-upload jika sudah ada di Nextcloud sehingga error 409 Conflict tidak terjadi lagi

## V2.2.89 — Fix ref image reliability — clean_photo_url priority & DB cross-check (29/07/2026)
- Fix 1: Prioritaskan clean_photo_url atas photo_url di database cache check (OPC Sourcing)
- Fix 2: JIT Sourcing kini menyimpan clean_photo_url product_truth geometric_truth ke DB
- Fix 3: Fallback lookup by product_name jika cache by URL tidak ditemukan
- Fix 4: MassProd generator cross-check clean_photo_url dari DB untuk mencegah cross-contamination image antar-produk

## V2.2.88 — Fix OPC product truth & geometric truth contract (29/07/2026)
- Add DB fallback untuk product_truth/geometric_truth di OPC MassProd path
- Fix ref image salah di kampanye Jahe Merah (8 items pakai gambar Chia Organik)
- Isi product_truth & geometric_truth Kayu Manis di DB
- Reset 20 item bermasalah ke pending untuk regenerasi prompt ulang

## V2.2.87 — Fix webhook brand profile di semua modul T2I/I2V (28/07/2026)
- Fix OPC scheduler: gunakan brand_profile_id bukan account_name yang tidak ada di tabel
- Fix IFC scheduler: set brandProfile null karena tidak ada kolom brand
- Fix Strategic scheduler (T2I & I2V): prioritaskan brand_profile_id
- Fix Recipe G-Labs: gunakan brand_profile_id
- Fix UI Regen OPC T2I/Start-Frames: tambah webhookOverride
- Fix UI Regen RE T2I/Start-Frames: tambah webhookOverride
- Fix UI Regen Strategic T2I: tambah webhookOverride

## V2.2.86 — Filter Completed Items on Content Flow Feed (28/07/2026)
- Implementasi filter status produksi di backend dan frontend
- Default feed ke Completed status

## V2.2.85 — Standardisasi Penamaan Folder & Berkas Cloud Storage (28/07/2026)
- Standarisasi prefix nama berkas cloud storage
- Penambahan brand slug pada folder kampanye
- Modularisasi naming helpers

## V2.2.84 — Integrasi Parent Folder & Webhook ke Brand Profile (28/07/2026)
- Migrasi setelan folder Nextcloud/GDrive ke Brand Profile
- Implementasi dynamic routing task G-Labs
- Sederhanisasi UI Brand Profile Manager

## V2.2.83 — Make Ws Matrix dynamic and inject product details in Call 2 (28/07/2026)
- Hapus wsMatrices statis dan letakkan Ws Matrix dinamis langsung oleh AI di Call 1
- Suntikkan deskripsi produk dan USP ke creativeSystemInstruction Call 2
- Dinamiskan hashtags acuan di prompts.js

## V2.2.82 — Fix status filtering and make webhook host resolution dynamic (28/07/2026)
- Tambahkan status platform ke PG query
- Prioritaskan setting DB di atas env vars di webhook client

## V2.2.81 — Fix schedules progress count calculation (28/07/2026)
- Hitung progress harian di backend API dan hapus ketergantungan filter pagination

## V2.2.80 — Perbaikan Content Flow dan Standardisasi Nextcloud (28/07/2026)
- Perbaikan tombol copy clipboard fallback
- Sinkronisasi catatan & status platform ke DB pg
- Standardisasi penamaan folder/file video id + produk
- Unggah file naskah.md ke Nextcloud & Drive (Strategic & IFC)
- Tampilan visual completed scheduler card permanen di header

## V2.2.79 — Square 1:1 Product Photo Layout (27/07/2026)
- Mengubah foto produk menjadi square 1:1 berukuran 90px
- Mencegah foto produk meregang secara horizontal

## V2.2.79 — Square 1:1 Product Photo Layout (27/07/2026)
- Mengubah dimensi foto produk menjadi bentuk kotak bujur sangkar (1:1) berukuran `90px x 90px` di tengah kartu agar tampilan proporsional dan tidak meregang secara horizontal

## V2.2.78 — Fallback Product Name JOIN & Grouping Fix (27/07/2026)
- Pencocokan join berbasis nama produk jika product_id bukan UUID
- Mencegah multiplikasi baris data dengan subquery GROUP BY

## V2.2.78 — Fallback Product Name JOIN & Grouping Fix (27/07/2026)
- Memperbaiki kueri `LEFT JOIN` pada schedules API dengan mencocokkan string `product_name` apabila `product_id` di database menyimpan nama produk literal (bukan UUID)
- Menambahkan kueri bersarang dengan `GROUP BY product_name` untuk mencegah multiplikasi baris data duplikat

## V2.2.77 — Centered Proportional Layout & Large Product Photo Heroes (27/07/2026)
- Tata letak kartu rata tengah dan lebar flex grow proporsional
- Foto produk diposisikan di tengah sebagai hero utama
- Progress bar horizontal ramping setinggi 4px
- Penanganan onError untuk fallback otomatis foto produk

## V2.2.77 — Centered Proportional Layout & Large Product Photo Heroes (27/07/2026)
- Menyeimbangkan posisi kartu skedul produk menjadi rata tengah (`justifyContent: 'center'`) dengan lebar responsif dinamis (`flexGrow: 1`, `maxWidth: '200px'`)
- Memposisikan foto produk berukuran besar di bagian tengah kartu sebagai *hero element* utama di bawah nama produk
- Mengganti visualisasi lingkaran dengan batang progres horizontal setinggi `4px` yang ramping di bagian bawah kartu
- Menambahkan fallback dinamis di frontend menggunakan penanganan event `onError` gambar untuk merender ikon placeholder 📦 jika file foto tidak termuat

## V2.2.76 — Interactive Product Card Filter, Neon Glow & Photo Thumbnails (27/07/2026)
- Integrasi filter klik pada kartu produk ke tabel posting
- Efek neon glow border 2px dan elevasi kartu aktif
- Menampilkan foto cleaned thumbnail produk di atas kartu

## V2.2.76 — Interactive Product Card Filter, Neon Glow & Photo Thumbnails (27/07/2026)
- Menghubungkan kartu skedul produk dengan fungsi saringan produk (`productFilter`) untuk langsung menyaring daftar posting secara dinamis saat diklik
- Menghias kartu aktif yang terpilih dengan border neon hijau emerald 2px, pendaran cahaya intens, dan elevasi vertikal tambahan (`translateY(-6px)`)
- Menampilkan thumbnail foto produk (`28px x 28px`) pada bagian atas kartu yang bersumber dari data `cleaned_photo_url` atau `active_photo` produk di database
- Memperbarui API schedules GET handler untuk memuat relasi tabel `product_extractions` guna mengambil path file foto produk

## V2.2.75 — Premium 3:4 Product Schedule Cards & SVG Circular Progress (27/07/2026)
- Desain ulang kartu skedul ke rasio 3:4 dan progress ring SVG
- Tambahan hover translate & shadow glow untuk look premium
- Custom scrollbar transparan untuk slider di layar kecil

## V2.2.75 — Premium 3:4 Product Schedule Cards & SVG Circular Progress (27/07/2026)
- Desain ulang kartu pelacak skedul produk harian menjadi rasio 3:4 modern dengan efek glassmorphism dan border glowing
- Menggunakan visualisasi progres berbentuk lingkaran ring SVG dinamis dengan persentase dan hover animation
- Menambahkan kustomisasi scrollbar tipis transparan (`.custom-schedule-scroll`) agar estetika slider mulus di layar tablet/mobile

## V2.2.74 — Video ID Sequence Counter, Product Fallback Query, and ESM Require Fix (27/07/2026)
- Konter urutan dinamis video_id
- Fallback query produk dari source_product_url
- Impor pgQuery tingkat atas untuk perbaikan ReferenceError

## V2.2.74 — Video ID Sequence Counter, Product Fallback Query, and ESM Require Fix (27/07/2026)
- Mengimplementasikan penghitung urutan (`seqNum`) dinamis per kampanye agar Video ID ContentFlow memiliki format terstandardisasi (misal: `01`, `02`, `03`...)
- Menambahkan kueri fallback pencarian detail produk (`product_name` & `affiliate_link`) ke tabel `product_extractions` berbasis `source_product_url` jika target product metadata kosong/null
- Memperbaiki `ReferenceError: require is not defined` pada environment ESM dengan memindahkan impor `pgQuery` dari require inline ke import tingkat atas pada `lib/db.js`

## V2.2.73 — Asynchronous Awaited ContentFlow Ingest & ON CONFLICT LENGTH Fix (27/07/2026)
- Mengubah sync engine ke async/await agar PG sync ter-await sepenuhnya sebelum HTTP response
- Mengganti != '' dengan LENGTH() > 0 pada ON CONFLICT DO UPDATE SQLite & PG

## V2.2.73 — Asynchronous Awaited ContentFlow Ingest & ON CONFLICT LENGTH Fix (27/07/2026)
- Mengubah fungsi `scanAndSyncExistingCampaigns` menjadi `async` dan meng-`await` seluruh promise sync PostgreSQL via `Promise.all` sebelum mengirim respon API
- Memperbarui perbandingan `!= ''` pada klausa `ON CONFLICT` SQLite & PostgreSQL di `lib/db.js` dengan `LENGTH() > 0` untuk menghindari bug penulisan kutip oleh SWC compiler

## V2.2.72 — Clean Extra Closing Brackets in ImportPlannerModal (27/07/2026)
- Menghapus tanda kurung penutup ganda `)}` di line 390 pada `ImportPlannerModal.js` setelah restrukturisasi block kondisional

## V2.2.71 — Fix ImportPlannerModal Syntax Compile Error (27/07/2026)
- Memperbaiki penutupan tag kondisional `{!initialPlannerId}` pada `ImportPlannerModal.js` untuk mengatasi kegagalan kompilasi produksi Next.js

## V2.2.70 — Fix OPC ContentFlow Ingest SQL Compile Quote Issue (27/07/2026)
- Mengganti pembandingan string kosong `!= ''` dengan `LENGTH(cp.affiliate_url) > 0` untuk menghindari penulisan ulang tanda kutip oleh Next.js SWC minifier yang memicu error SQLite
- Sinkronisasi ulang data campaign outstanding `opc_260727_dnarsz` secara sukses ke PostgreSQL Node 3

## V2.2.69 — Fix OPC Auto-Ingest Workflow and Dynamic Tab 5 Cloud Storage (27/07/2026)
- Dinamisasi tampilan Tab 5 Cloud Storage pada Detail OPC dan RE merespons active storage_provider
- Perbaikan query JOIN brand_profiles di contentflow-ingest agar account_name OPC presisi
- Penambahan pemfilteran otomatis untuk menghapus item failed dan error pada OPC dan Strategic Campaign
- Melengkapi link_affiliate RE dan link_produk Strategic Campaign

## V2.2.68 — Purge All Dummy Data and Dummybrand References (27/07/2026)
- Pembersihan total data dummy seed dan dummybrand dari SQLite dan PostgreSQL Node 3
- Penghapusan hardcoded option dummybrand01 dan dummybrand02 dari UI seluruh modul
- Pembersihan dropdown produk ContentFlow

## V2.2.67 — SOT Update Single-Database ContentFlow Ingest Architecture (27/07/2026)
- Pembaruan SOT MAKNA_GRID_DISTRIBUTED_ARCHITECTURE_SOT dan SOP Cluster untuk arsitektur Single-Database Direct Sync Satu Atap
- Penghapusan variabel legacy CONTENT_FLOW_API_URL dari dokumentasi SOT
- Pembaruan Knowledge Base ContentFlow Ingestion Architecture

## V2.2.66 — Double-Shield Architecture for Wardrobe & Demographic Presets (27/07/2026)
- Penerapan Double-Shield Architecture pada DEMOGRAPHIC_PRESETS dan WARDROBE_PRESETS di lib/prompts.js
- Penambahan mandat penulisan tag Anchor dan Wardrobe terpisah di vsoSection system prompt OPC

## V2.2.65 — Sequential Wardrobe Injection & Engine Fallback (27/07/2026)
- Penambahan otomatis fallback tag Wardrobe pada scheduler-processors applyReplacements
- Injeksi 10 variasi warna wardrobe Syar'i sekuensial per-baris pada 18 item kampanye opc_260727_dnarsz di Node 1

## V2.2.64 — Precision Product Truth Prompt Injection for OPC (27/07/2026)
- Update product_truth dan geometric_truth presisi pada product_extractions
- Injeksi otomatis prompt T2I dan I2V Klip 3 presisi pada 18 item kampanye opc_260727_dnarsz
- Penyelarasan scheduler-processors productData

## V2.2.63 — Product Clean Verification & OPC Repair (27/07/2026)
- Penambahan Kartu Verifikasi Visual Produk pada Modal Content Planner & Import Modal
- Fallback Sync Engine product_ref_image_path ke foto clean aktif
- Pembaruan rujukan foto clean kampanye opc_260727_dnarsz di Node 1

## V2.2.62 — Make Admin Skedul Controller Flexible (Allow Empty Slots) (27/07/2026)
- Allow Admin to select -- (Kosong / Tidak Digunakan) -- on any slot in Skedul Controller modal
- Filter out empty schedule slots from Header Controller Card rendering
- Update API route to persist empty slot selections cleanly

## V2.2.61 — Upgrade ContentFlow Video Item Card Layout to 3-Column and 3/3 Published Glowing Border (27/07/2026)
- Implement 3-column video item card layout (Column 1: Thumbnail & Cloud Link, Column 2: Product Name -> Caption 10 Words -> Platform Status Bar, Column 3: Brand Tag, Hook, Detail & Status)
- Add top badge banner 🎉 3/3 PUBLISHED (ALL PLATFORMS) and emerald glowing border highlight for completed videos
- Set custom platform font colors in Detail Modal (TikTok: White, FB: Blue, IG: Red)

## V2.2.60 — Enhance Admin Skedul Controller Accessibility and Auto Brand Selection (27/07/2026)
- Make Admin Skedul button always accessible in top header and controller card header
- Add auto-brand selection logic when opening schedule modal from global overview
- Ensure seamless transition when editing 5 active products and target posting

## V2.2.59 — ContentFlow Workflow Upgrade: Home Global Overview, Header Controller, and Admin Schedule Settings (27/07/2026)
- Add Global Brand Overview Cards to Home Dashboard with TikTok/FB/IG posting stats & available completed video stock
- Implement Header Controller Card in ContentFlow showing 5 Active Products with format Product: 3/8
- Implement Admin-only Skedul Controller Modal for setting 5 active products and target post per day (1-6)
- Remove Brand filter select from ContentFlow search filter bar while maintaining assigned sidebar brand tabs

## V2.2.58 — Fix SQLite initSchema Syntax and PostgreSQL Upsert Clause for Captions (27/07/2026)
- Fix JS try catch block accidentally placed inside SQL template string in db.js initSchema
- Fix PostgreSQL ON CONFLICT DO UPDATE clause in upsertContentFlowItem to preserve non-empty captions and update link_affiliate
- Resync captions for all items in campaign opc_260726_1xk9de across SQLite Node 1 and PostgreSQL Node 3 DB

## V2.2.57 — Upgrade Push to Content Flow Engine for OPC Campaigns (27/07/2026)
- Upgrade POST /api/v2/pillar-campaigns/[id]/sync-contentflow handler to use scanAndSyncExistingCampaigns with target campaign ID
- Support targetCampaignId parameter and scalar subquery in lib/contentflow-ingest.js to guarantee zero data duplication

## V2.2.56 — Move Skipped Status to Platform Publishing Dropdowns & Clean UI (27/07/2026)
- Remove Skipped status from pipeline_status video card badges
- Remove Video Status control UI from ContentFlow Modal Header
- Add Skipped option with purple glow style to TikTok, Facebook, and Instagram publishing status dropdowns

## V2.2.55 — Add ContentFlow Video Status Skipped and Catatan Field (27/07/2026)
- Add Skipped video status option with purple glow badge in ContentFlow Modal and Video Cards
- Add Catatan (Notes) textarea field placed at the top above Product Data & Links in ContentFlow Modal
- Add catatan column migration and update allowedKeys in lib/db.js & API route

## V2.2.54 — Fix OPC Video Completion Auto-Ingest Sync Order in Scheduler (27/07/2026)
- Reorder updatePillarCampaignItem to update workflow_status=completed and drive_link in DB before triggering ContentFlow sync in lib/scheduler-processors.js
- Re-sync opc_130 and opc_131 live across SQLite Node 1 and PostgreSQL Node 3 DB

## V2.2.53 — Implement 5 ContentFlow UI/UX Refinements with High Contrast Sidebar Active State (27/07/2026)
- Add high-contrast Slate Gray vs Pure White Emerald Glow 3px Bar active state to Brand Sub-Menu in app/components/Sidebar.js
- Sync Header Quick Bar active tab and filter by user assigned brand names in app/content-flow/page.js
- Add inline Product Search Box to SKU filter in app/content-flow/page.js
- Add dynamic status (Published=Emerald, Scheduled=Amber) and publish date colors in detail modal

## V2.2.52 — Auto-Sync ContentFlow Affiliate Links via Multi-Level Fallback (27/07/2026)
- Add multi-level fallback for link_affiliate in lib/contentflow-ingest.js
- Populate affiliate_link for Omura product across Node 1 SQLite and PostgreSQL Node 3 DB

## V2.2.51 — Fix Nextcloud URL Classification and PostgreSQL Dual DB Ingest (27/07/2026)
- Add nextcloud_url = EXCLUDED.nextcloud_url to PostgreSQL ON CONFLICT clause in lib/db.js
- Auto-classify Nextcloud share links stored in drive_link column in lib/contentflow-ingest.js

## V2.2.50 — Enhance ContentFlow Ingestion Caption Fallbacks (27/07/2026)
- Add result_json.social_media_package.caption and result_json.tiktok_caption fallbacks to lib/contentflow-ingest.js

## V2.2.49 — Integrate ContentFlow Option 2 Brand Safety Deletion, Item Deletion, Auto-Close Modal, & Oldest-First Sorting (27/07/2026)
- Add Option 2 Red Danger Safety Confirmation Modal for Admin Brand Deletion (requiring typing brand name)
- Add DELETE /api/content-flow/[id] and DELETE /api/content-flow/brands API endpoints
- Auto-close Detail Modal after saving status changes
- Update query sorting to ORDER BY created_at ASC (oldest first)

## V2.2.48 — Integrate ContentFlow Assigned Brand Sidebar & Quick Tabs (27/07/2026)
- Add collapsible Brand Account sub-items under ContentFlow Hub in Sidebar.js
- Add Header Quick-Switch Brand Tab Bar with URL query param sync in content-flow/page.js
- Wrap useSearchParams in Suspense boundary for Next.js App Router compliance

## V2.2.47 — Fix ContentFlow OPC Ingestion SQL Query (27/07/2026)
- Fix SQL JOIN query for brand_profiles and product_extractions in lib/contentflow-ingest.js
- Resync OPC completed video items including Item #106 to content_flow_items table

## V2.2.46 — Mandatory Product Reference Photo Filename Declaration Engine (27/07/2026)
- Injeksi otomatis nama berkas foto referensi produk ke dalam buildProductTruthContractSection
- Deklarasi explicit visual anchor binding dengan formula non-ambigu aman dari kecenderungan square ratio
- Pembaruan rilis v2.2.46

## V2.2.45 — Full Human-Readable Log Synthesizer Engine for OPC Analyzer T2I and Webhook Client (27/07/2026)
- Penambahan 14 aturan regex baru di lib/log-sanitizer.js untuk mentransformasikan log OPC T2I, Compliance Audit, Safety Delay, dan ContentFlow
- Penyembunyian URL internal dan ID teknis secara otomatis dari tampilan UI
- Pembaruan rilis v2.2.45

## V2.2.44 — Universal 6-Module Product Truth and Geometric Truth Contract Ingestion (27/07/2026)
- Injeksi sentral buildProductTruthContractSection ke 5 Prompt Builder (OPC, RE, Multiplier, Strategic, Bridge Injector)
- Integrasi product_truth & geometric_truth ke Sheets Autopilot & Instant Factory Worker
- Auto-fallback override di Strategic Engine & Bridge Injector API
- Pembaruan rilis v2.2.44

## V2.2.43 — Product Truth and Geometric Truth Database Contract & UI Integration (26/07/2026)
- Penambahan kolom product_truth dan geometric_truth di database product_extractions
- Injeksi Mandatory Truth Contract ke System Prompt Gemini AI Call 1
- Integrasi Web UI Form Editor di Menu Produk Database
- Pembaruan rilis v2.2.43

## V2.2.42 — Human-Readable Log Synthesis and Zero-Config ContentFlow Direct Ingest (26/07/2026)
- Sintesis bahasa log FFmpeg & TTS menjadi Bahasa Indonesia yang bersih dan ramah
- Zero-Config ContentFlow Internal Direct Sync tanpa syarat API Key
- Pembaruan rilis v2.2.42

## V2.2.41 — Targeted Product Truth Lock and Conflict Guard for Bridging Clips (26/07/2026)
- Mandat geometry_lock DO NOT HALLUCINATE pada system prompts
- Conflict Guard Sanitizer pada webhook client untuk menghapus halusinasi cardboard box
- Pembaruan rilis v2.2.41

## V2.2.40 — Safe Hybrid Resolution for resolveProductBase64 to auto-use latest studio photo on re-gen (26/07/2026)
- Mendahulukan foto studio terbaru dari Database Produk (product_extractions) saat re-gen T2I
- Menghilangkan kebutuhan membuat kampanye baru saat mengganti foto produk di database
- Pembaruan rilis v2.2.40

## V2.2.39 — Universal Studio Photo Mandate across Strategic, RE, and Bridge Injector regenerate-t2i routes (26/07/2026)
- Standardisasi resolveProductBase64 pada seluruh API regenerate-t2i di Strategic, RE, dan Bridge Injector
- Kunci Foto Studio Bersih (clean_photo_url) universal di seluruh tombol T2I Web UI
- Pembaruan rilis v2.2.39

## V2.2.38 — Fix Web UI Regenerate Start Frame routes to enforce resolveProductBase64 Studio Photo Mandate (26/07/2026)
- Integrasi resolveProductBase64 pada regenerate-t2i dan regenerate-start-frames API routes
- Kunci Foto Studio Bersih saat user klik Re-generate pada Web UI
- Pembaruan rilis v2.2.38

## V2.2.37 — Mandat Permanen Studio Photo untuk OPC Engine dan Content Planner Ingest (26/07/2026)
- Prioritas Foto Studio Bersih (clean_photo_url) pada resolveProductBase64
- Auto-lock Studio Photo pada ingest-planner route
- Skrip perbaikan otomatis repair-studio-photos-all.js
- Pembaruan rilis v2.2.37

## V2.2.36 — Fix null check in rescan-re-contentflow-hooks script (26/07/2026)
- Penambahan validasi objek non-null pada parser rescan-re-contentflow-hooks.js
- Pembaruan rilis v2.2.36

## V2.2.35 — Layer 1 Engine Fallback Ingestion for RE Campaign Hooks in ContentFlow (26/07/2026)
- Penerapan Multi-Tier Fallback Hook Parser pada contentflow-ingest.js dan strategic-campaign-engine.js
- Penambahan skrip rescan-re-contentflow-hooks.js untuk pembaruan Hook otomatis seluruh kampanye RE

## V2.2.34 — Populate re_campaign_items for imported RE Campaign 66b4d649-8045-4edf-b3e4-375428108797 (26/07/2026)
- Penambahan sinkronisasi 25 item kampanye RE ke tabel re_campaign_items pada Node 1 SQLite dan Node 3 PostgreSQL
- Perbaikan tampilan UI menu /re-campaigns dan detail kampanye RE

## V2.2.33 — Fix crypto import syntax in id-generator.js (26/07/2026)
- Koreksi sintaks import crypto dari default export nodejs crypto pada lib/id-generator.js
- Pembaruan eksekusi impor kampanye RE nutribake

## V2.2.32 — Fix Hook and Caption Extraction for RE Campaign ContentFlow Sync (26/07/2026)
- Peningkatan parser Hook dari narration klip pertama dan Caption dari tiktok_caption/ig_caption pada import-re-campaign-to-nutribake.js
- Pembaruan migrasi data nutribake ke ContentFlow

## V2.2.31 — Mandatory resolveProductBase64 Resolution for OPC T2I Start Frames (26/07/2026)
- Penyelarasan pemanggilan Base64 produk T2I Start Frame menggunakan resolveProductBase64 pada OPC & IFC Generator
- Penambahan skrip pemulihan Start Frame kampanye opc_260726_der820

## V2.2.30 — Update Source of Truth (SOT) Documents for 3-Layered Compliance Architecture (26/07/2026)
- Pembaruan dokumen SOT TikTok Compliance Gate dengan arsitektur 3 layer
- Pembaruan dokumen SOT Organic Pillar Campaign dengan arsitektur terkini
- Pembaruan changelog global rilis v2.2.30

## V2.2.29 — 3-Layered Compliance Architecture with Local Pre-Prompt Product Title Sanitizer (26/07/2026)
- Penyaringan lokal nama produk e-commerce mentah sebelum masuk prompt Gemini AI
- Mandat Negative Lexicon Blocker pada Call 1
- Penyesuaian Closed-Loop Auto-Rewrite untuk kebersihan naskah kampanye aktif

## V2.2.28 — Universal Base64 Data-URI Auto-Sanitizer for I2V Video Generation in Webhook Client (26/07/2026)
- Penetapan Base64 Data-URI auto-sanitizer pada generateVideo di lib/webhook-client.js
- Penyesuaian mode: start_image dan Data-URI Base64 pada Multiplier & Autopilot Workers

## V2.2.27 — Mandatory Base64 product image reference resolution across all video campaign engines and Tab 2 Caption UI fix (26/07/2026)
- Penerapan helper resolveProductBase64 untuk pengiriman Base64 reference_images di seluruh 7 engine kampanye
- Perbaikan ekstraksi caption universal pada Tab 2 UI detail kampanye

## V2.2.26 — Enforce hashtag and caption compliance filter in lib/prompts.js (26/07/2026)
- Penegakan filter compliance pada Hashtags dan Caption agar bebas kata detox
- Peningkatan mutu caption universal pada social_media_package

## V2.2.25 — Fix parseGeminiJSON import path from json-parser.js in lib/tiktok-compliance-service.js (26/07/2026)
- Perbaikan path import parseGeminiJSON dari json-parser.js
- Penyelesaian error (0, parseGeminiJSON) is not a function pada AI Compliance Audit

## V2.2.24 — Fix JSDoc header syntax in lib/prompts.js and release v2.2.24 (26/07/2026)
- Perbaikan sintaks JSDoc header di lib/prompts.js
- Penyelesaian ReferenceError sanitizeCustomInstruction pada OPC Generator

## V2.2.23 — Fix sanitizeCustomInstruction declaration and resume OPC generator (26/07/2026)
- Penetapan fungsi sanitizeCustomInstruction secara eksplisit di lib/prompts.js
- Pemberhentian error ReferenceError pada OPC Generator scheduler

## V2.2.22 — Closed-Loop Dual-Pass Compliance Engine, Auto-Rewrite & Auto T2I Dispatch (26/07/2026)
- Isolasi total product_description mentah dari prompt context dan penegakan Whitelist Benefit Mandate
- Closed-Loop Dual-Pass Compliance Engine dengan Auto-Rewrite Naskah Aman otomatis sebelum disimpan
- Sanitasi metadata custom_instruction dan pencegahan kebocoran label UI ke audio narasi
- Otomatisasi pemicuan T2I Start Frame ke Webhook G-Labs secara langsung

## V2.2.21 — Universal product_usp Truth Anchor, Full COMPLIANCE_GUIDE AI Auditor, Caption UI Unification & Custom Instruction Lock (26/07/2026)
- Penegakan product_usp sebagai Primary Product Truth Anchor di seluruh Prompt Builder kampanye
- Integrasi utuh COMPLIANCE_GUIDE.md dan AI Gemini pada tiktok-compliance-service.js
- Pembersihan log info Google Sheets dan penanganan alias verdict/risk_score
- Unifikasi UI Tab 2 menjadi 1 single Caption field di seluruh halaman detail kampanye video
- Autofill default customInstruction menjadi akhiran skrip/voiceover : produk ori ada di keranjang ya!

## V2.2.20 — Fix fuser exit code safety in Single-Pass deploy script (26/07/2026)
- Penambahan
- true pada fuser port kill

## V2.2.19 — Fix Port Kill Logic in Single-Pass Deploy Script (26/07/2026)
- Penggantian pkill dengan fuser -k 3000/tcp dan 4000/tcp agar tidak membunuh proses SSH aktif

## V2.2.18 — Bulletproof Single-Pass Deploy Script for Node 1 (26/07/2026)
- Penambahan penanganan toleransi pkill
- true pada skrip deploy-node1.js
- Sanitasi escape character string SSH remote execution

## V2.2.17 — Implement Single-Pass Node 1 Deployment Script & Update Agent SOP (26/07/2026)
- Penambahan skrip automasi scripts/deploy-node1.js dan npm script deploy:node1 untuk eksekusi deployment 1-Call SSH
- Optimasi waktu tunggu kompilasi 120s untuk spesifikasi prosesor Intel Core i3 + RAM 16GB pada Node 1
- Eliminasi total polling SSH loop berulang yang memicu prompt persetujuan UI

## V2.2.16 — Implement UNIVERSAL_ZERO_TESTIMONY_MANDATE Across All Prompt Builders (26/07/2026)
- Penambahan modul UNIVERSAL_ZERO_TESTIMONY_MANDATE pada lib/prompts.js untuk melarang total kata ganti orang pertama (aku/saya/gue/moms) dan klaim pengakuan pribadi fiktif
- Sanitasi contoh sampel transisi produk lama yang mengandung kata ganti aku/saya
- Penyuntikan mandat secara universal ke seluruh Prompt Builder (OPC, RE, Strategic, Multiplier, Content Planner)

## V2.2.15 — Sync 250 Product Extractions & Image Assets to Node 1 SQLite DB (26/07/2026)
- Penambahan skrip utilitas scripts/sync-products-to-node1.js untuk sinkronisasi katalog produk
- Penyatuan 250 data produk dan 294 berkas foto produk dari MacBook lokal ke Node 1 Gateway UI

## V2.2.14 — Implement shouldSyncGoogleSheets Smart Helper & Audit All Generator Logics (26/07/2026)
- Penambahan helper shouldSyncGoogleSheets pada lib/google-auth.js untuk mendeteksi pilihan penyimpanan Nextcloud vs GDrive
- Eliminasi hardcoded uploadSpreadsheet = true dan pembungkusan aman Google Sheets sync di OPC, RE, Strategic, Instant Factory, Recipe Labs, dan Content Planner
- Pemberesan import path .js pada tiktok-compliance-service

## V2.2.13 — Fix Log Sanitizer Masking Rules & Export auditScriptForTikTok (26/07/2026)
- Ekspor fungsi auditScriptForTikTok pada lib/tiktok-compliance-service.js untuk mencegah TypeError compliance checker
- Pembaruan aturan sanitasi log lib/log-sanitizer.js dengan masking URL Shopee/E-commerce dan pembersihan log teknis poller

## V2.2.12 — Fix ReferenceError: count is not defined in createDraftContentPlanner (26/07/2026)
- Restore deklarasi variabel count pada lib/content-planner-engine.js
- Draft Content Planner dapat disimpan dengan sukses

## V2.2.11 — Fix db is not defined error in createDraftContentPlanner (26/07/2026)
- Restore inisialisasi const db = getDb() dan plannerId pada lib/content-planner-engine.js
- Memastikan simpan draft Content Planner sukses tanpa error

## V2.2.10 — Fix ReferenceError: plannerCount is not defined in Content Planner modal (26/07/2026)
- Restore deklarasi state plannerCount pada app/content-planner/page.js
- Memastikan modal pembuatan Content Planner berjalan tanpa error runtime

## V2.2.9 — Implement Autofill Title Format (namaakun - YYYYMMDD - 2 Kata nama produk) in Content Planner (26/07/2026)
- Otomatisasi pengisian Judul Content Planner dengan format namaakun - YYYYMMDD - 2 Kata nama produk
- Tombol ✨ Auto-fill pada modal UI untuk meregenerasi judul otomatis 1-klik
- Fallback naming engine backend yang selaras apabila judul dikosongkan

## V2.2.8 — Add Target Demografi Audiens Preset Dropdown to Content Planner Modal (26/07/2026)
- Integrasi dropdown Target Demografi Audiens (Gen-Z, IRT, Profesional, Syari, Fitness, Custom) pada modal Content Planner
- Penyelarasan intonasi & gaya bahasa Hook 3-detik Gemini AI dengan preset demografi
- Otomatisasi pengisian target demografi saat memilih produk dari database

## V2.2.7 — Migrate 250 products & image assets from _maknagen to MAKNA Grid (26/07/2026)
- Sukses menyalin 250 produk beserta metadata lengkap dari database _maknagen ke MAKNA Grid
- Sinkronisasi seluruh berkas gambar foto produk ke public/uploads/products

## V2.2.6 — Mask G Labs Webhook API Key & Dynamic IP Test Connection (26/07/2026)
- Implementasi pengamanan masking password (••••••••xxxxxx) pada API Key G Labs Webhook
- Tombol Test Connection Webhook kini menguji Host IP & Port yang sedang diketik secara real-time

## V2.2.5 — Fix SQLite db.exec schema initialization syntax error for Webhook Client (26/07/2026)
- Fix sintaks db.exec pada lib/db.js yang menyebabkan getSetting terganggu
- Koneksi G Labs Webhook ke 100.117.59.92:8765 kini terverifikasi 🟢 Online (HTTP 200 OK)

## V2.2.4 — Redesign Toast Notification UI: Compact Glassmorphism & Copy Error Button (26/07/2026)
- Redesign Notifikasi Toast: Kompak, cantik, max-width 420px di pojok kanan bawah
- Notifikasi sukses tampil singkat 3.5s
- Notifikasi error tampil lebih lama (15s) dengan tombol Copy Error Message dan tombol Tutup ✕

## V2.2.3 — Enhance Pause & Enable button contrast in Gemini Pool Manager (26/07/2026)
- Peningkatan kontras visual tombol Pause (amber glow) dan Enable (green glow) pada Gemini API Pool Manager

## V2.2.2 — Fix ReferenceError drive_target_folder when saving MiniMax settings (26/07/2026)
- Fix destructuring error variable drive_target_folder pada POST /api/settings route
- Penyimpanan API Key MiniMax, Gemini, dan Facebook kini 100% lancar tanpa error

## V2.2.1 — Optimize Gemini API Key Pool Validation Speed with Parallel Execution (26/07/2026)
- Optimisasi pengujian keaktifan API Key dari sekuensial menjadi paralel via Promise.all
- Waktu pengujian Bulk Add 23 API Keys dipangkas drastis dari 45 detik menjadi ~1.5 detik

## V2.2.0 — Settings UI Refactoring & Google Drive Setup Simplification (26/07/2026)
- Refaktorisasi Halaman Settings dengan 3 Tab Kategori Utama (Engine & AI, Storage & Cloud, Otomasi & Integrasi)
- Fitur Collapsible Cards dengan tombol Buka/Tutup dan memori localStorage
- Penyederhanaan Google Drive Setup menjadi 1 Default Target Folder tunggal
- Penghapusan Card Content Flow API & Penggantian Nama Card G Labs Webhook

## V2.1.6 — Fix duplicate state declaration in Settings page (26/07/2026)
- Pembersihan duplikasi deklarasi state poolAddMode pada app/settings/page.js
- Kompilasi Next.js build 25/25 halaman static sukses 100%

## V2.1.5 — Gemini API Key Validation & Health Check Engine (26/07/2026)
- Implementasi Triple-Guard API Key Validation (Pre-Validation ping test, Audit Health Check All Keys, dan Runtime Failover Auto-Disable)
- Penambahan tombol 🔍 Audit & Test All Keys dan 🗑️ Clean Dead Keys pada Gemini API Pool Manager
- Badge indikator visual LIVE, COOLDOWN, dan DEAD/INVALID pada daftar API Key

## V2.1.4 — Fix JSX closing brace in Settings Bulk API Key Importer (26/07/2026)
- Perbaikan sintaksis penutupan kurung kurawal fungsi addPoolKey di app/settings/page.js
- Verifikasi ulang kompilasi Next.js build 25/25 halaman static sukses

## V2.1.3 — Bulk Multi-Line Gemini API Key Importer (26/07/2026)
- Implementasi fungsi addApiKeysBulk di lib/db.js dengan transaksi atomic SQLite
- Dukungan bulk_keys payload pada API route POST /api/keys
- Fitur UI Bulk Add pada Gemini API Pool Manager di Settings dengan penamaan alias otomatis AISKey_01, AISKey_02, dst.

## V2.1.2 — Humanized System Poller Log Engine (Sanitizer Layer) (26/07/2026)
- Implementasi lib/log-sanitizer.js untuk menyaring istilah teknis backend AI, TTS, FFmpeg, Cloud, dan DB menjadi bahasa Indonesia sederhana
- Integrasi sanitizer layer pada API GET /api/system-logs dengan opsi ?raw=true
- Perlindungan arsitektur internal backend pada seluruh widget terminal UI kampanye

## V2.1.1 — Update SOP AGENTS.md dengan Execution Task List Real-time Progress (26/07/2026)
- Penambahan aturan seksi wajib Execution Task List pada implementation_plan.md
- Penambahan aturan pembaruan real-time checkbox progress [x] saat eksekusi

## V2.1.0 — TikTok Safe Compliance Audit Default YES di Semua Campaign Video (26/07/2026)
- Set default enableVoAudit ke 1 (YES) pada form OPC, RE, SC, Multiplier Lab, Product Bridge Inject, dan Instant Factory
- Implementasi TikTok Safe compliance auditor dan report card switcher pada Multiplier Lab, Bridge Injector, dan Instant Factory
- Eksekusi migrasi database SQLite untuk mendukung kolom compliance audit di semua jenis kampanye video

## V2.0.20 — Konsolidasi & Standarisasi Knowledge Base (KB) (26/07/2026)
- Merger folder kb-seeds dan kb_2call menjadi 1 folder terpusat kb
- Merge TikTok Shop Medical Misinformation Policy ke COMPLIANCE_GUIDE.md Section 21
- Standarisasi 7 Core KB di seluruh prompt builder RE, OPC, SC, Multiplier Lab, Content Planner, dan Recipe Labs
- Pembersihan 6 file KB redundan dan folder backup kb_makna549

## V2.0.19 — Fix Leftover setTargetSpreadsheetId ReferenceError v2.0.19 (25/07/2026)
- Fix ReferenceError setTargetSpreadsheetId is not defined pada RE, OPC, dan Strategic Campaign
- Memulihkan aksesibilitas halaman RE Campaign 100%

## V2.0.18 — Fix Spreadsheet ReferenceError, Auto-Fill Standardized Campaign Name, & Product Bridging Auto-Fetch v2.0.18 (25/07/2026)
- Fix ReferenceError targetSpreadsheetId is not defined pada seluruh form
- Auto-fill nama kampanye format baku [ MODUL YYYYMMDD ] - namaakun -
- Auto-fetch foto produk & deklarasi Mandate 88 dari database saat Product Bridging

## V2.0.17 — Align Brand Account Dropdown Above Campaign Name v2.0.17 (25/07/2026)
- Penambahan dropdown Nama Akun di atas Nama Kampanye pada seluruh form pembuat video
- Integrasi Multiplier Lab, SC, RE, OPC, Import Planner, Instant, Bridge, Recipe, & Sheets

## V2.0.16 — Fix Syntax Error & Deployment v2.0.16 (25/07/2026)
- Fix syntax error pada app/strategic-campaigns/page.js
- Penyempurnaan Target Demografi & Universal Caption 100%

## V2.0.15 — Sentralisasi Prompt SC, Preset Tone Demografi & Universal Caption (25/07/2026)
- Sentralisasi prompt SC & TONE_DEMOGRAPHIC_INSTRUCTIONS di lib/prompts.js
- Injeksi aturan MANDATORY TRUTH & OBJECTIVE NARRATIVE MANDATE (bebas cerita fiktif 'aku')
- Target Demografi & Tone Bahasa pada seluruh menu pembuatan video
- Single Universal Social Caption pada Tab 2 Detail

## V2.0.14 — Penyempurnaan OPC, RE & Standarisasi Campaign ID Terpusat (25/07/2026)
- Standarisasi baku Campaign ID terpusat (opc_YYMMDD_6HEX, re_YYMMDD_6HEX, sc_YYMMDD_6HEX) pada lib/id-generator.js
- Penyederhanaan Social Media Package menjadi 1 Single Universal Caption pada lib/prompts.js
- Penyempurnaan RE: hapus field Spreadsheet ID, default Nextcloud /MAKNA_Assets, auto-fill Product Bridging dari pustaka
- Default FFmpeg SFX Vol = 0.0 & BGM Vol = 0.0 pada form OPC & RE

## V2.0.13 — Fix OPC & RE Campaign Scheduler Default Active Check (25/07/2026)
- Fix opc_campaigns_scheduler_active dan re_campaigns_scheduler_active check dari === true menjadi !== false di lib/campaign-scheduler.js
- Mengaktifkan pemrosesan otomatis kampanye OPC & RE berstatus running secara default

## V2.0.12 — Penambahan Field Custom Host IP Webhook G Labs pada Menu Setting (25/07/2026)
- Penambahan input Host/IP Address Webhook G Labs (default 100.117.59.92) pada menu Setting
- Penyelarasan indikator live status URL Webhook secara dinamis
- Dukungan konfigurasi IP kustom G-Labs v5.0.8+ pada lib/webhook-client.js

## V2.0.11 — Fix DB Ingestion Schema Error pada Content Planner Ingest Route (25/07/2026)
- Fix pillar_campaign_items column custom_hook error dengan mengganti query raw ke createPillarCampaignItem terpusat

## V2.0.10 — Fix ReferenceError targetSpreadsheetId pada Modal Impor Planner & New Campaign OPC (25/07/2026)
- Fix ReferenceError targetSpreadsheetId is not defined pada ImportPlannerModal.js dan page.js
- Pengesahan fallback backend nextcloud_parent_folder ke /MAKNA_Assets

## V2.0.9 — Penyempurnaan & Harmonisasi UI OPC & Modal Impor V2.0 (25/07/2026)
- Penambahan dropdown Nama Akun dan auto-fill [OPC YYYYMMDD] - namaakun - pada Form New Campaign OPC
- Penghapusan field Target Spreadsheet ID dan penyesuaian default Nextcloud /MAKNA_Assets
- Penyelarasan opsi Visual Style modal impor 100% mengacu pada page.js (Cinematic, UGC, Macrophotography)

## V2.0.8 — Standarisasi Baku Penamaan Folder & File Cloud Nextcloud & Google Drive V2.0 (25/07/2026)
- Penambahan utilitas terpusat lib/cloud-naming-helper.js untuk pembentukan path folder dan nama file cloud baku (_final.mp4, _vo_final.mp3, _thumb.jpg, _c01)
- Pengujian modul scripts/test-cloud-naming.js
- Integrasi ke sync helpers Nextcloud dan Google Drive

## V2.0.7 — Standarisasi Baku Campaign ID & Video ID MAKNA Grid V2.0 (25/07/2026)
- Penambahan utilitas terpusat lib/id-generator.js untuk pembentukan Campaign ID dan Video ID baku
- Skrip sanitasi scripts/sanitize-and-standardize-ids.js untuk merapikan 142 baris data video_id lama di PostgreSQL Node 3 & SQLite
- Integrasi generateVideoId pada scanning contentflow-ingest.js

## V2.0.6 — Fix Next.js start bin path di deploy-cluster.js & Node 1 server restart (25/07/2026)
- Fix jalur eksekusi binary next start pada node_modules/.bin/next
- Verifikasi konektivitas HTTP 200 OK pada 100.65.62.63:3000

## V2.0.5 — Fix PostgreSQL SQL count query & Ingest Kampanye RE nutribake (25/07/2026)
- Fix PostgreSQL query countSql pada API /api/content-flow dan /api/v2/content-flow
- Verifikasi 25 item video nutribake ter-ingest sempurna

## V2.0.4 — Skrip Impor Kampanye RE 66b4d649 ke Akun Nutribake & ContentFlow (25/07/2026)
- Penambahan skrip scripts/import-re-campaign-to-nutribake.js untuk migrasi 25 item RE campaign
- Ingest otomatis 25 item video ke ContentFlow dengan account_name=nutribake dan unique video_id (nutribake_re_66b4d649_xxx)

## V2.0.3 — Fix Save Pencil Edit & Reaktifitas Tombol Modal + Panel Accordion DATA PRODUK & LINK (25/07/2026)
- Fix Next.js 16 params Promise pada API PATCH /api/content-flow/[id] agar simpan data ke PostgreSQL Node 3 & SQLite berhasil 100%
- Reaktifitas realtime state activeItem dan items array agar tombol atas modal (Copy Affiliate, Buka Link Produk) seketika aktif begitu data disimpan
- Pembaruan header teks menjadi DATA PRODUK & LINK disertai panel Expand/Collapse (Accordion UI)

## V2.0.2 — Fitur Inline Pencil Edit (✏️) untuk Data Produk di Modal Detail ContentFlow (25/07/2026)
- Penggantian form input statis produk menjadi tampilan clean metadata + Inline Pencil Editor (✏️)
- Simpan cepat data produk (Nama Produk, Link Produk, Link Affiliate) secara realtime ke PostgreSQL Node 3
- Proteksi hak akses (RBAC Permissions) tetap aktif pada masing-masing field inline editor

## V2.0.1 — Redesign Dashboard UI Proporsional & Responsive Glassmorphism (25/07/2026)
- Penyempurnaan layout Dashboard menjadi responsif 100% tanpa terpotong di kolom kanan
- Pembaruan visual Glassmorphism untuk Executive Metric Cards & Quick Action Launchpad
- Integrasi realtime statistik PostgreSQL Node 3 pada widget Konten Terbaru & Platform Progress

## V2.0.0 — Decoupled Architecture V2.0 & PostgreSQL Enterprise Database (25/07/2026)
- Pemasangan & migrasi data ke PostgreSQL 18.4 Enterprise Database Tier di Node 3 (100.78.186.123:5432)
- Pemisahan arsitektur ke Headless Backend API Engine V2.0 (apps/api/server.js) pada Port 4000
- Penyatuan Frontend UI dengan PostgreSQL Node 3 & Standalone Headless API Engine
- Penggantian arsitektur SQLite monolithic menjadi Enterprise Decoupled Multi-Node Cluster V2.0

## V1.1.59 — Integrasi Headless Backend API Engine V2.0 & Dual-Process Deployment (25/07/2026)
- Pembuatan standalone Headless Backend API Engine di apps/api/server.js (Port 4000)
- Integrasi REST API Endpoints V2.0 dengan PostgreSQL Node 3
- Pembaruan scripts/deploy-cluster.js untuk dual-process deployment di Node 1 (Frontend Port 3000 & API Engine Port 4000)

## V1.1.58 — Pemasangan PostgreSQL 18.4 Server di Node 3 & Script Migrasi Data Otomatis (25/07/2026)
- Pemasangan & konfigurasi PostgreSQL Server di Node 3 (100.78.186.123:5432)
- Penambahan script automasi migrasi scripts/migrate-sqlite-to-postgres.js (52 tabel, 100% data terintegrasi)
- Penambahan module connection pool lib/db-pg.js untuk query PostgreSQL dari Node 1

## V1.1.57 — Perbaikan Sinkronisasi & Visualisasi Data Produk ContentFlow (25/07/2026)
- Pencegahan overwrite data produk pengguna oleh COALESCE pada upsertContentFlowItem di lib/db.js
- Penambahan tombol visual 🔗 Link Produk dan 🛒 Affiliate Link langsung di permukaan Card ContentFlow Hub
- Pembaruan real-time activeItem pada detail modal tanpa perlu menutup modal

## V1.1.56 — Fix TypeError item.id.slice pada ContentFlow Sync (25/07/2026)
- Penanganan konversi String(item.id) sebelum pemanggilan .slice() pada lib/contentflow-ingest.js

## V1.1.55 — Integrasi Access Permissions & Edit Data Produk ContentFlow Hub (25/07/2026)
- Penambahan izin edit_link_product, edit_link_affiliate, dan edit_nama_product pada RBAC Access Permissions
- Pembaruan nama seksi Matriks Izin Menu menjadi Access Permission pada halaman User Management
- Integrasi form edit Nama Produk, Link Produk, dan Link Affiliate berbasis izin akses pada ContentFlow Hub

## V1.1.54 — Fix Syntax Error JSX Card ContentFlow Hub (25/07/2026)
- Perbaikan penutupan tag <a> pada IIFE tombol asset Card ContentFlow Hub

## V1.1.53 — Penyesuaian Tombol Nextcloud & Filter Status Error Kampanye RE eef644d9 (25/07/2026)
- Penyaringan item berstatus Failed/Error pada kampanye RE eef644d9 di ContentFlow Hub
- Penataan ulang URL Nextcloud dan tombol visual sky blue pada card ContentFlow

## V1.1.52 — Otomasi Git Tag & Sinkronisasi Release Script SOP (25/07/2026)
- Penambahan pemrosesan otomatis git tag dan git push --tags pada scripts/release.js
- Sinkronisasi status repositori ke remote GitHub https://github.com/sabeq83/makna-grid.git

## V1.1.51 — Ekstraksi Hook dari VO Klip 1 dan Caption dari IG Caption untuk Konten RE (25/07/2026)
- Penetapan Hook Konten RE dari Teks Voice-Over Klip 1 (VO Klip 1)
- Penetapan Box Caption Konten RE dari Teks  Hasil Analisis RE
- Pembaruan Data 24 Item Konten RE @siasatsehat di ContentFlow Hub

## V1.1.50 — Populasi Atribut Brand siasatsehat & Format Video ID RE-SS-001 s/d RE-SS-024 (25/07/2026)
- Penetapan Atribut Profil Brand  pada Kampanye RE eef644d9-d74c-4a5a-834f-38c230fd9b21
- Populasi Otomatis Format : RE-SS-001 s/d RE-SS-024 untuk 24 Item Konten RE di ContentFlow Hub
- Penambahan Theme Warna Brand  (Emerald/Teal Glow) dan Penetapan Hak Akses RBAC User

## V1.1.49 — Migrasi & Impor 100% Kampanye RE Legacy Node 1 eef644d9-d74c-4a5a-834f-38c230fd9b21 (25/07/2026)
- Penyalinan & Impor Otomatis Kampanye RE Legacy eef644d9-d74c-4a5a-834f-38c230fd9b21 dari Node 1 (100.65.62.63:3003)
- Pengunduhan 54 File Start Frame PNG & 54 File Voice-Over MP3 ke Repositori Lokal
- Ingest Database SQLite MAKNA Grid: 24/24 Item Kampanye RE & Entri ContentFlow Hub Ready

## V1.1.48 — Urutan Tombol Quick Action Launchpad Dashboard (25/07/2026)
- Penataan Ulang Urutan Tombol Quick Action Launchpad: 1. Content Flow, 2. Buat Content Plan, 3. Buat Kampanye RE, 4. Buat Kampanye OPC

## V1.1.47 — Redesain Dashboard Utama Menjadi Command Center Simpel & Realtime Stats (25/07/2026)
- Penyederhanaan Dashboard Utama ke Judul  dengan 4 Kartu Metric Real-time
- Quick Action Launchpad Akses 1-Klik ke Kampanye OPC, Import Sheet, ContentFlow Hub & Recipe Labs
- Integrasi List 5 Konten Siap Publish Terbaru & Bar Progress Publikasi Platform TikTok, FB, IG

## V1.1.46 — PemberSIhan Hint Admin & Penambahan Eye Toggle Password Halaman Login (25/07/2026)
- Pembersihan Hint Teks Default Admin pada Halaman Login Portal
- Penambahan Icon Eye/EyeOff Toggle untuk Melihat atau Menyembunyikan Karakter Password

## V1.1.45 — Header Akun Brand Kartu ContentFlow Hub dengan Warna Dinamis Per Brand (25/07/2026)
- Penataan Ulang Header Kartu Feed: Badge Akun Brand Ditaruh di Paling Atas Paling Pertama Sebelum Judul Hook
- Sistem Pewarnaan Dinamis Brand Badge:  (Biru),  (Merah), dan Fallback Brand Lain (Hijau Zamrud Sleek)

## V1.1.44 — Implementasi RBAC Brand Scope & Seeding 50 Data Dummy dummybrand01 dan dummybrand02 (25/07/2026)
- Penyedia 50 Data Dummy untuk  (Niche Beauty & Skincare) dan 50 Data Dummy untuk  (Niche Healthy Food & Kitchen)
- Integrasi Penyaringan RBAC Hak Akses Brand () pada API  dan
- Pembatasan Otomatis Tampilan Feed dan Dropdown Akun Brand Sesuai Hak Akses User

## V1.1.43 — Optimasi Tombol Cloud Asset & Regenerasi Sebaran Dummy Data ContentFlow (25/07/2026)
- Penyederhanaan Tombol Akses Asset di Bawah Video Thumbnail Menjadi 1 Tombol Prioritas (Tampil Google Drive atau Nextcloud sesuai ketersediaan)
- Regenerasi 52 Data Dummy dummybrand dengan Distribusi Tersebar di Google Drive (45%), Nextcloud (45%), dan Kosong (10%)

## V1.1.42 — Perbaikan Warna Icon Kalender Input Tanggal Modal ContentFlow Hub (25/07/2026)
- Penyetelan  Pada Seluruh Element Input Tanggal (Publish Date) Modal Detail & Status Konten
- Icon Picker Kalender Native Tampil Putih Terang Jelas (Pure White) di Mode Gelap UI MAKNA Grid

## V1.1.41 — Penyederhanaan Filter Panel & Pembersihan Pipeline Status ContentFlow Hub (25/07/2026)
- Hapus Filter Pipeline Status (Karena Seluruh Konten Terindeks Berstatus Completed/Siap Publish)
- Reorganisasi Filter Panel Menjadi 2 Baris 4-Kolom Simetris dengan Tombol Reset Filter Instan

## V1.1.40 — Redesain Layout 1-Kolom Vertikal Terpusat ContentFlow Hub (25/07/2026)
- Perombakan Layout Feed Menjadi 1 Kolom Vertikal Terpusat (1050px Centered Container) Setara OPC / RE
- Kartu Konten Horizontal Wide 3-Seksi: Thumbnail Box, Metadata & Monospace Caption, Stack Status Platform
- Dipertahankan 100% Seluruh Menu Filter Multi-Level & Universal Search Bar

## V1.1.39 — Indikator Visual Status Copied! pada Tombol Salin ContentFlow (25/07/2026)
- Ubah Teks & Warna Tombol Secara Sementara Menjadi ✓ Copied! Saat Pengguna Mengklik Copy Caption atau Copy Affiliate Link

## V1.1.38 — Penyempurnaan Layout Modal Detail & Status Publikasi ContentFlow Hub (25/07/2026)
- Redesain Modal Presisi Tangkapan Layar: Header Video ID Badge & Hook
- 4 Tombol Aksi Cepat: Copy Caption, Copy Affiliate, Buka Produk, Download Asset
- Penolong Instan Hari Ini untuk Publish Date TikTok, Facebook, dan Instagram

## V1.1.37 — Relokasi & Perbaikan Aksesibilitas Menu ContentFlow Hub (25/07/2026)
- Pindahkan Menu ContentFlow Hub ke Puncak Seksi WORKFLOW Sidebar
- Perbaikan Logika Hak Akses Menu Agar Selalu Bisa Diklik Seluruh User

## V1.1.36 — Fitur ContentFlow Publishing Tracker Hub (25/07/2026)
- Integrasi Halaman & API /content-flow untuk Melacak Status Tayang
- Mockup Card Presisi Mengacu Desain ContentFlow v2
- Support Auto Sync Retroaktif Seluruh Aset Kampanye Database

## V1.1.35 — Perbaikan Menu OPC: Save as Draft & Penyelarasan Tombol Modal (25/07/2026)
- Tambah tombol Save as Draft pada modal import Content Planner ke OPC
- Penyelarasan warna & hirarki 3 tombol modal (Batal, Save as Draft, Ingest & Launch)
- Perbaikan warna tombol Batal pada form pembuatan kampanye OPC manual non-impor

## V1.1.34 — Refined Dimmed Cyan & Emerald UI Theme (25/07/2026)
- Pembaruan sistem warna UI ke Refined Dimmed Cyan & Mint Emerald
- Pembaruan styling tombol, sidebar active state, dan form inputs

## V1.1.33 — Styling Brand Sidebar MAKNA GRID (25/07/2026)
- Tulisan MAKNA GRID berwarna putih font besar sejajar logo
- Subtitle Decoupled Multi-Node Cluster berwarna putih font kecil di bawah logo

## V1.1.32 — Logo Konsep 2 & Favicon MAKNA Grid (25/07/2026)
- Integrasi favicon SVG Neural Monogram Grid M
- Update logo MAKNA Grid pada Halaman Login dan Sidebar Menu

## V1.1.31 — Copy 100% VSO Engine dari Mass OPC ke ImportPlannerModal (24/07/2026)
- VSO Engine di ImportPlannerModal 100% identik dengan Mass OPC (app/pillar-campaigns/page.js)
- Termasuk 3D Mascot Universes, Wardrobe optgroups dinamis, & Custom Text Inputs
- Verifikasi build & deployment ke Node 1

## V1.1.30 — Penyelarasan 100% Modal Ingest OPC dengan Strategic Campaign (24/07/2026)
- Face Visibility (4 opsi SC) & Visual Mode (2 opsi SC) selaras SC
- Input number bebas untuk Jumlah Klip (N) dan Mulai Bridging Klip Ke
- Autofetch Foto Studio Produk dari Content Planner
- Custom Instruction & VSO Engine lengkap dari SC

## V1.1.29 — Revisi Modal Ingest OPC & Veo Omni Flash (24/07/2026)
- Auto-Detect Mode Narasi dari Content Planner
- Model Veo Omni Flash & Opsi Durasi 4s/6s/8s/10s
- Penyederhanaan UI Ingest OPC selaras Mass OPC

## V1.1.28 — Integrasi Content Planner ke Menu OPC (24/07/2026)
- Fitur Ingest Content Planner ke Organic Pillar (OPC)
- Modal UI Ingest berstruktur 4 Accordion SC dengan kontrol footer di bawah
- API endpoint /api/v2/pillar-campaigns/ingest-planner

## V1.1.27 — Migrate G-Labs Webhook Connection to Direct Tailscale IP (100.117.59.92:8765) (24/07/2026)
- Membuka port 8765 di Windows Firewall Node 2 dan mengarahkan seluruh komunikasi G-Labs Webhook secara langsung ke IP Tailscale 100.117.59.92:8765

## V1.1.26 — Upgrade Default Gemini Model Engine to gemini-3.5-flash (24/07/2026)
- Memperbarui seluruh pemanggilan model Gemini AI ke gemini-3.5-flash dengan fallback ke gemini-flash-latest

## V1.1.25 — Fix Permanent Background Service Persistence on Node 1 Gateway (24/07/2026)
- Memperbaiki penanganan proses latar belakang Next.js di Node 1 agar tetap berjalan permanen tanpa terputus koneksi SSH

## V1.1.24 — Integrate SSH Port Forwarding Tunnel for G-Labs Webhook Access across Cluster (24/07/2026)
- Menghubungkan 127.0.0.1:8765 pada Node 1 Gateway langsung ke G-Labs Webhook Node 2 via SSH Tunneling otomatis

## V1.1.23 — Fix Strategic Campaign Call 1 Execution and Webhook Routing (24/07/2026)
- Memisahkan T2I Start Frame dari Call 1 agar Gemini Ideation selesai instan dalam 3-5 detik
- Mengarahkan Webhook Client ke Node 2 secara otomatis pada Node 1 Gateway

## V1.1.22 — Fix Strategic Campaign Semi-Otomatis Background Execution on Gateway (24/07/2026)
- Memperbaiki eksekusi otomatis AI Single-Pass Engine pada Node 1 Gateway saat tombol Run Semi-Otomatis diaktifkan

## V1.1.21 — Remove Google Spreadsheet ID from Strategic Campaign Modal (24/07/2026)
- Menghapus input Google Spreadsheet ID pada modal pembuatan dan import Strategic Campaign

## V1.1.20 — Inherit Brand Profile ID from Content Planner to Strategic Campaign (24/07/2026)
- Menjamin brand_profile_id dan account_name dari Content Planner diwariskan 100% secara otomatis ke Strategic Campaign saat import

## V1.1.19 — Revisi Modal Generator Content Planner (24/07/2026)
- Menghapus input Nama Akun dan Sheet ID
- Menambahkan dropdown Brand Profile tepat di atas Judul Planner

## V1.1.18 — Strict Sidebar Menu Isolation & Dynamic Section Filtering (24/07/2026)
- Mengisolasi pemetaan rute sidebar secara ketat per menu key
- Menyembunyikan judul seksi (WORKFLOW, TOOLS, SYSTEM) jika seluruh menunya ditutup untuk user biasa

## V1.1.17 — Fix Network Host Binding 0.0.0.0 for Node 1 Gateway (24/07/2026)
- Mengonfigurasi Next.js production server agar melakukan binding ke HOSTNAME=0.0.0.0 agar dapat diakses dari IP jaringan 100.65.62.63

## V1.1.16 — Fix Next.js 16 Dynamic Route Params & Deployment Error Handling (24/07/2026)
- Menangani Next.js 16 dynamic route params Promise pada API reset-password dan merapikan penanganan error npm run build pada deploy script

## V1.1.15 — Fix Webpack Dynamic Require PDF Parse (24/07/2026)
- Menggunakan eval require agar Next.js Webpack build berjalan 100% mulus tanpa error paket opsional pdf-parse

## V1.1.14 — Fix Webpack PDF Parse Resolution in Brand Extract API (24/07/2026)
- Gunakan require safe resolution untuk modul pdf-parse opsional agar npm run build berjalan 100% mulus di seluruh Node

## V1.1.13 — Fix Next.js 16 Dynamic Route Params Resolution for Reset Password (24/07/2026)
- Menambahkan await Promise.resolve(params) pada route [userId] dan [userId]/reset-password untuk resolusi userId yang presisi

## V1.1.12 — Otomatisasi Production Build Node 1 UI Gateway (24/07/2026)
- Mengonfigurasi Node 1 UI Gateway agar otomatis memproses npm run build dan npm start (242ms ultra-fast production mode)

## V1.1.11 — Fix Hard Page Reload On Login Cookie Set (24/07/2026)
- Menggunakan window.location.href = '/' pasca login sukses agar cookie sesi dimuat penuh oleh browser

## V1.1.10 — Strict Auth Middleware Redirect to /login (24/07/2026)
- Menambahkan middleware.js untuk mengalihkan secara ketat pengguna unauthenticated ke /login
- Menghapus dev fallback pada lib/auth.js

## V1.1.9 — Gunakan Webpack Dev Mode untuk Stabilitas Server (24/07/2026)
- Menambahkan flag --webpack pada script dev agar Next.js dev server berjalan stabil pada seluruh Node

## V1.1.8 — Skrip Otomatisasi Deploy 3-Node Cluster (24/07/2026)
- Menambahkan skrip node scripts/deploy-cluster.js dan command npm run deploy:cluster untuk deployment otomatis ke Node 1, Node 2, dan Node 3

## V1.1.7 — Fix Password Modal Auto Close & Error Notification (24/07/2026)
- Menambahkan fungsi closePasswordModal() agar modal otomatis menutup dan mereset state saat sukses
- Menampilkan pesan kesalahan langsung di dalam modal jika gagal

## V1.1.6 — Fix Auth Fallback & Password Reset Hash Matching (24/07/2026)
- Memperbaiki fallback auth saat unauthenticated pada environment lokal
- Menambahkan auto trimming dan case-insensitive username matching

## V1.1.5 — Fitur Modal Khusus Ubah Password User (24/07/2026)
- Menambahkan tombol dan modal khusus 🔑 Ubah Password pada halaman User Management
- Membuat API endpoint /api/admin/users/[userId]/reset-password

## V1.1.4 — Fix Layout Margin & Alignment User Management Page (24/07/2026)
- Menggunakan class page-container standar MAKNA Grid agar tata letak halaman User Management rapi dan simetris di tengah

## V1.1.3 — Fix Layout Sidebar di User Management Page (24/07/2026)
- Menambahkan <Sidebar /> dan <div className='app-container'> pada halaman User Management /settings/users

## V1.1.2 — Fix Port 3005 Default Script (24/07/2026)
- Mengubah script npm run dev di package.json agar langsung menggunakan flag -p 3005 secara otomatis

## V1.1.1 — Konfigurasi Port Pengujian 3005 (24/07/2026)
- Mengubah default PORT di .env.local menjadi 3005 agar tidak bentrok dengan maknagen (Port 3000)
- Menambahkan script npm run dev:port
- Memperbarui SOP Pengujian Lokal di sot/global/SOP_MENJALANKAN_MAKNA_GRID.md

## V1.1.0 — Implementasi Multi-User, RBAC, dan Data Isolation (24/07/2026)
- Implementasi Database Schema Multi-User (users, sessions, user_menu_permissions, user_brands)
- Autentikasi Session Cookie HTTP-Only & Login Portal
- Halaman UI Admin User Management & Menu Privileges
- Multi-Brand Assignment Scoping & Menu Access Guard

## V1.0.1 — SOP Panduan Menjalankan MAKNA Grid (24/07/2026)
- Menambahkan SOP Panduan Menjalankan MAKNA Grid 3-Node Cluster di sot/global/SOP_MENJALANKAN_MAKNA_GRID.md

## [v1.0.0] — Initial Release: MAKNA Grid Distributed 3-Node Architecture (24/07/2026)
- **Node Role Isolation**: Implemented `lib/node-config.js` to decouple Node 1 UI Gateway (`100.65.62.63`), Node 2 Worker GPU (`100.117.59.92`), and Node 3 Central DB & Media Vault (`100.78.186.123`).
- **Central DB & Vault Adapters**: Added `lib/db-adapter.js` and `lib/storage-vault.js` targeting Central DB and ContentFlow API (`http://100.78.186.123:3001/api/v1/content/ingest`).
- **Role-Aware Queue Scheduler**: Queue worker polling automatically disabled on Gateway Node 1 and active on Compute Worker Node 2.
- **Cluster Health Verification Tool**: Created `scripts/test-cluster-health.js` for real-time multi-node cluster verification.

## V10.20.138 — Auto Reset Video Clips on Start Frame Regenerate and Align OPC Micro-Motion I2V Prompts (24/07/2026)
- Otomatisasi reset state video klip saat Start Frame T2I di-regenerasi
- Penyelarasan penuh Prompt Builder I2V dan filter sanitasi sanitizeI2vPrompt OPC
- Memastikan kesesuaian visual 100% antara Start Frame dan Video Klip

## V10.20.137 — Align Strategic Campaign FFmpeg Processor with OPC Standard (24/07/2026)
- Mengadopsi segmental muxing dan smart sync per adegan berbasis fluent-ffmpeg
- Menghilangkan error No input specified pada zsh shell
- Menyinkronkan upload vault aset lengkap dan poller log real-time

## V10.20.136 — Add Sync to Content Flow Button in Strategic Campaign Tab 4 with Single-Line Captions (24/07/2026)
- Added POST /api/v2/strategic-campaigns/items/[itemId]/sync-contentflow route handler
- Sanitized captions into single-line format before sending to ContentFlow API
- Shortened cloud sync button label to Sync Assets to Cloud
- Added green gradient Sync ke Content Flow button in Tab 4 Asset Vault

## V10.20.135 — Update Default ContentFlow Ingestion Endpoint URL to Tailscale IP (24/07/2026)
- Updated default ContentFlow URL to http://100.78.186.123:3001/api/v1/content/ingest in lib/contentflow-client.js
- Updated fallback URL in app/api/settings/route.js and app/settings/page.js
- Updated default setting record in local SQLite database

## V10.20.134 — Reposition Storyboard Call 1 and Start Frame T2I Buttons to Center with Dynamic Re-Generate Text (24/07/2026)
- Moved Call 1 Storyboard button to center of Workspace header card with dynamic Re-Generasi label
- Moved Start Frame T2I button to center of Start Frame Gallery header card with dynamic Re-Generate label
- Updated header card layouts to 3-column grid structure

## V10.20.133 — Fix Strategic Campaign Tab 4 and Tab 5 JSX Structure and Variable Scope (24/07/2026)
- Fixed ReferenceError by cleanly isolating Tab 4 Asset Vault and Tab 5 System Log JSX
- Corrected scene table columns in Tab 4
- Restored full rendering for Tab 5 technical audit, G-Labs task queue, and live log console

## V10.20.132 — Align Strategic Campaign Tab 5 System Log with OPC Standard (24/07/2026)
- Added pipeline technical audit table to Strategic Campaign Tab 5
- Added G-Labs video task queue table per scene to Tab 5
- Integrated live system log console streamer filtering for item ID

## V10.20.131 — Align Strategic Campaign Tab 3 Asset Vault with OPC Standard (24/07/2026)
- Created POST /api/v2/strategic-campaigns/items/[itemId]/sync-assets endpoint
- Wired Sync ALL Assets button and added Cloud Folder link in Strategic Campaign workbench
- Fixed scene asset status checking for local_clip_path and voice_over_audio_path

## V10.20.130 — Align Strategic Campaign G-Labs I2V Generation with OPC Standard (24/07/2026)
- Pass startFrameBase64 as single reference image for Strategic I2V generation
- Prioritize i2v_prompt over t2i_prompt in G-Labs video request
- Enforce image_to_video mode with Start Frame validation

## V10.20.129 — Fix ESM Import Extensions in Helper Modules (23/07/2026)
- Add explicit .js extensions to relative imports in minimax-tts, drive-uploader, drive-sync-helper, nextcloud-sync-helper, and video-downloader

## V10.20.128 — Fix Strategic FFmpeg Audio Voiceover Muxing (23/07/2026)
- Fix processStrategicFfmpeg to gather and concatenate scene TTS voiceover files
- Fix processVideoMuxing fallback for null or missing audio paths

## V10.20.127 — Fix Strategic Campaign Approve and Proceed Workflow (23/07/2026)
- Fix missing approve endpoint for Strategic Campaign items
- Connect Approve & Proceed button to backend endpoint
- Update row 2 status to production_processing

## V10.20.126 — Harmonize SC Scheduler Queue Progression (23/07/2026)
- Menyelaraskan syarat antrean Fase 1 Skeduler SC dengan Skeduler OPC
- Mengoptimalkan performa tick loop skeduler SC dengan menghapus query scene redundan

## V10.20.125 — Fix Content Flow Ingestion Pipeline Status Alignment (23/07/2026)
- Menyelaraskan status pipeline_status ke In Production sesuai spesifikasi KB Content Flow Dashboard feed

## V10.20.124 — Fix Settings Page ReferenceError (23/07/2026)
- Menambahkan deklarasi state editingContentflow pada halaman Settings

## V10.20.123 — Strategic Campaign Detail Page UI Improvement (23/07/2026)
- Menghilangkan pembukaan otomatis baris 1 saat halaman detail Strategic Campaign dibuka

## V10.20.122 — Content Flow Direct Ingestion API Integration (23/07/2026)
- Integrasi Content Flow Direct Ingestion API pada Content Planner & Strategic Campaign
- Status awal Pending Production pada Content Planner & Completed pada Strategic Campaign
- Konfigurasi terpusat API Key dan Base URL di Halaman Settings

## V10.20.121 — Strategic Product Placement Isolation Mandate & Pre-Bridging Sanitizer (23/07/2026)
- Injeksi instruksi ketat STRATEGIC PRODUCT PLACEMENT ISOLATION MANDATE pada Call 1
- Penyekatan 100% naskah VO, teks layar, dan prompt visual sebelum klip bridging
- Penambahan auto-sanitizer pasca-Call 1 (sanitizeProductLeaksBeforeBridging) sebagai double guard

## V10.20.121 — Enforce Strategic Product Placement Isolation Mandate & Pre-Bridging Sanitizer (23/07/2026)
- Injeksi instruksi ketat STRATEGIC PRODUCT PLACEMENT ISOLATION MANDATE pada prompt Call 1 (lib/strategic-campaign-engine.js)
- Penyekatan 100% naskah VO, teks layar, dan prompt visual pada klip sebelum bridging (Klip 1 s/d bridgeAt - 1) agar hanya mengeksekusi Context, VFO & Hook Content Planner tanpa memuat nama produk/merek
- Penambahan fungsi auto-sanitizer pasca-Call 1 (sanitizeProductLeaksBeforeBridging) sebagai perlindungan ganda (double guard)

## V10.20.120 — Strategic Campaign Account Name, Video ID & Account TAB Sheets Auto-Sync (23/07/2026)
- Penarikan & penguncian data Nama Akun, Google Sheet ID, dan Video ID dari Content Planner
- Penulisan otomatis ke TAB Nama Akun Google Sheet berdasarkan match Video ID
- Penulisan 5 kolom otomatis: URL Asset, Caption Single Line, Pipeline Status, Status, dan Production Date YYYYMMDD

## V10.20.120 — Strategic Campaign Account Name, Video ID & Account TAB Sheets Auto-Sync (23/07/2026)
- Penarikan & penguncian data Nama Akun, Google Sheet ID, dan Video ID saat mengimpor dari Content Planner
- Tampilan field terperinci dengan badge 🔒 Locked pada UI form pembuatan Strategic Campaign
- Penulisan otomatis hasil produksi video ke TAB Nama Akun Google Sheet berdasarkan match Video ID
- Penulisan 5 kolom otomatis: URL Asset, Caption (Single Line), Pipeline Status (Completed), Status (Produced), dan Production Date (YYYYMMDD)

## V10.20.119 — Strategic Campaign Single-Pass Engine SOT & AGENTS Rule Alignment (23/07/2026)
- Memperbarui SOT STRATEGIC_PILLAR_CAMPAIGN.md ke Single-Pass Engine
- Menambahkan aturan Single-Pass Engine di AGENTS.md
- Menambahkan annotation @deprecated pada executeCall2PublishingEngine

## V10.20.119 — Strategic Campaign Single-Pass Engine Architecture SOT & AGENTS Rule Alignment (23/07/2026)
- Memperbarui dokumen SOT STRATEGIC_PILLAR_CAMPAIGN.md untuk menyelaraskan arsitektur Single-Pass 1-Call Engine
- Menambahkan aturan proyek pada AGENTS.md mengenai Single-Pass Engine (1-Call) dan deprecation Call 2 terpisah
- Menandai annotation @deprecated pada fungsi executeCall2PublishingEngine di lib/strategic-campaign-engine.js

## V10.20.118 — Fix Content Planner Google Sheets Sync & Add Manual Sync Trigger (23/07/2026)
- Memperbaiki resolusi impor ESM db.js pada sheets-autopilot-worker untuk sinkronisasi Google Sheet
- Menambahkan endpoint API POST /api/content-planner/[id]/sync-sheets
- Menambahkan tombol manual 📊 Sync ke Google Sheet pada kartu dashboard dan workbench detail planner

## V10.20.117 — Fix Content Planner Auto-Pull Product URL from Database (23/07/2026)
- Penarikan otomatis URL Produk dari database produk saat produk dipilih pada form modal Content Planner
- Penyorotan kolom URL Affiliate agar pengguna tinggal memasukkan link affiliate kampanye

## V10.20.116 — Fix Content Planner Card JSX Syntax Error (23/07/2026)
- Memperbaiki tag JSX yang belum tertutup pada komponen kartu Content Planner di app/content-planner/page.js
- Memastikan build dan kompilasi Next.js 100% bersih tanpa error

## V10.20.115 — Content Planner Account Name, Video ID & Google Sheets Sync (23/07/2026)
- Penambahan field Nama Akun, Google Sheet ID, URL Produk, URL Affiliate, dan Foto Produk
- Pembuatan Video ID unik format [namaakun]-[12digitalfanumerik] per baris plan
- Penulisan otomatis ke Google Sheet ID pada TAB Nama Akun dengan kolom ID Video, Hook, Nama Produk, Link Affiliate, Link Produk

## V10.20.114 — Content Planner Historical Anti-Repetition Memory (HARM) (22/07/2026)
- Implementasi Compact History Digest untuk pengenceran riwayat produk lama (~300-500 token)
- Dynamic CEP & VFO Seed Offset berdasarkan total baris historis produk
- Dynamic Temperature Tuning 0.85 untuk pembuatan planner susulan pada produk yang sama

## V10.20.113 — Content Planner 2-Step Draft & Card Execution Workflow (22/07/2026)
- Alur baru simpan draft Content Planner instan tanpa eksekusi AI langsung
- Tombol eksekusi AI Pipeline terpisah pada kartu (card) Content Planner Dashboard
- Banner eksekusi AI pada detail workbench Content Planner

## V10.20.112 — Content Planner Product Search & Row Count Options (22/07/2026)
- Fitur pencarian nama produk database pada modal generator Content Planner
- Pilihan jumlah baris planner 6, 12, 18, 24, 30 sesuai kelipatan CEP Category

## V10.20.111 — Enforce Wardrobe Color Consistency Lock Across Clips of Single Campaign Row (22/07/2026)
- Menyertakan aturan mandatori 100% Wardrobe Consistency Lock pada prompt Call 1 di Strategic Campaigns
- Memastikan seluruh klip (1 s/d 5) pada 1 baris kampanye menggunakan warna dan motif pakaian yang 100% persis sama
- Memastikan resolusi preset warna wardrobe acak jika opsi random dipilih

## V10.20.110 — Fix SC Workflow Settings Voice Persona Dropdown to Show All MiniMax and Gemini Voices (22/07/2026)
- Melengkapi array konstanta GEMINI_VOICES (14 suara), MINIMAX_VOICES (7 suara), dan MINIMAX_ENGLISH_VOICES (10 suara) pada SC Workbench
- Menyelaraskan opsi dropdown Voice Persona pada Workflow Settings (Fase 2) SC 100% selaras dengan OPC

## V10.20.109 — Update SC Status Badge to Show Fase 2 Paused Ready for Review After Start Frames (22/07/2026)
- Menyelaraskan badge status item pada Strategic Campaigns SC dengan OPC
- Mengubah badge dari Fase 1 menjadi Fase 2 Paused (Ready for Review) otomatis setelah Start Frames selesai dirender

## V10.20.108 — Remove Redundant Bottom Live Terminal Log UI from SC Detail Page (22/07/2026)
- Menghapus komponen UI Live Terminal Log yang redundan di bagian bawah halaman detail SC Workbench
- Mengoptimalkan tata letak UI karena log aktivitas sudah terintegrasi pada card SYSTEM POLLER LOGGER di bagian atas

## V10.20.107 — Adopt OPC Workflow & Production Settings in SC With SFX and BGM Default 0 (22/07/2026)
- Mengadopsi form penuh Workflow & Production Settings (Fase 2) dari OPC ke menu Strategic Campaigns SC
- Menetapakan nilai default 0.0 (Muted) untuk slider SFX Volume dan BGM Volume di OPC dan SC
- Menyediakan kontrol penuh TTS Voice Provider, Persona, Speed, Volume, Sync Option, Zoom Scale, dan Volume Mixer

## V10.20.106 — Unify Captions to Call 1, Remove Call 2 & Add Single-Clip T2I Re-Gen Button (22/07/2026)
- Mengunifikasi 100% pembuatan Captions ke dalam Call 1 dan menghapus eksekusi Call 2 untuk menghemat 50% API quota
- Memperbaiki parser UI Tab 2 agar membaca captions dari publishing_package_json secara fleksibel
- Menambahkan API route dan tombol 🔄 Re-Gen per klip di Grid Preview T2I Start Frame Gallery SC

## V10.20.105 — Align SC Grid Preview T2I Gallery UI Dimensions With OPC Standard (22/07/2026)
- Menyelaraskan ukuran gambar dan kartu Grid Preview T2I Start Frame Gallery di Tab 2 SC agar 100% presisi dengan desain OPC (height 180px, auto-fill minmax 140px)
- Memastikan tampilan UI antar menu konsisten dan estetis

## V10.20.104 — Update SC Start Frame Gallery UI to Vertical 9:16 Aspect Ratio (22/07/2026)
- Mengubah kontainer preview gambar pada Grid Preview T2I Start Frame Gallery di Tab 2 SC ke aspek rasio vertikal 9:16 sinematik
- Menjamin tampilan galeri gambar Start Frame presisi menyerupai format video TikTok/Reels

## V10.20.103 — Isolate Regenerate Start Frame to Dedicated T2I Function Without Gemini AI (22/07/2026)
- Memisahkan fungsi Regenerate Start Frame ke fungsi terdedikasi processStrategicStartFrames
- Menjamin 100% bahwa klik tombol Regenerate Start Frame TIDAK AKAN PERNAH memicu pemanggilan Gemini AI Call 1 maupun mengubah/menimpa naskah storyboard
- Hanya mengirimkan prompt T2I adegan yang ada langsung ke Webhook G-Labs

## V10.20.102 — Fix Webhook Client DB Module Extension Resolution for SC T2I Generation (22/07/2026)
- Memperbaiki resolusi impor ekstensi file .js pada lib/webhook-client.js
- Memastikan eksekusi T2I Start Frame ke Webhook G-Labs berjalan 100% lancar tanpa exception

## V10.20.101 — Add Regenerate Start Frame Button to SC Storyboard Tab 2 Gallery (22/07/2026)
- Menambahkan tombol Regenerate Start Frame tepat di sebelah judul Grid Preview T2I (Start Frame Gallery) pada Tab 2 SC Workbench
- Memungkinkan pemicu ulang generasi seluruh gambar Start Frame T2I secara instan via API trigger route

## V10.20.100 — Clean SC Pipeline Progress Retry Buttons to Icon Only (22/07/2026)
- Menghapus teks Retry pada tombol aksi 5-Stage Pipeline Progress di halaman SC Workbench
- Menyisakan ikon saja untuk estetika UI yang ringkas dan modern

## V10.20.99 — Automate SC T2I Start Frame Generation and Independent Scheduler Control (22/07/2026)
- Menambahkan otomatisasi T2I Start Frame rendering di Fase 1 agar gambar Start Frame tersimpan dan Baris 2 otomatis mulai
- Memisahkan saklar Skeduler Global (Start/Stop) secara independen dari status individu kampanye (Run/Pause)
- Membersihkan UI Live Terminal Log redundan dan memindahkan Status Skeduler Card ke posisi paling atas di atas SYSTEM POLLER LOGGER

## V10.20.98 — Add SC Scheduler Status Card & Control Route 100% OPC Parity (22/07/2026)
- Menambahkan Status Skeduler Strategic Campaign Card dengan tombol Start/Stop Skeduler di atas SYSTEM POLLER LOGGER
- Membuat API route scheduler-control untuk mengontrol saklar aktif strategic_campaigns_scheduler_active
- Mewujudkan paritas penuh 100% antara UI OPC dan UI Strategic Campaigns

## V10.20.97 — Strictly Gate Row 2 Generation Until Row 1 Finish Start Frames (22/07/2026)
- Memperketat pengujian sekuensial antar baris pada skeduler SC di campaign-scheduler.js
- Menjamin bahwa Baris Kedua TIDAK AKAN PERNAH memulai eksekusi Fase 1 sebelum seluruh gambar Start Frame pada Baris Pertama selesai digenerasi dan tersimpan di database

## V10.20.96 — Add Double Guard for SC G-Labs I2V Execution Before Approval (22/07/2026)
- Menambahkan perlindungan ganda (double guard) pada skeduler SC dan fungsi processStrategicGlabs
- Menjamin secara fisik bahwa prompt I2V TIDAK AKAN PERNAH dikirim ke G-Labs jika workflow_status masih bernilai ready_for_review sebelum pengguna menekan tombol Approve/Proceed

## V10.20.95 — Fix SC Engine Call 1 Status to ready_for_review (22/07/2026)
- Memperbaiki penulisan status workflow di executeCall1CreativeEngine pada line 492 agar langsung diatur ke ready_for_review
- Menjamin titik jeda (pause point) skeduler SC 100% terkunci pada ready_for_review sehingga TTS MP3 tidak akan pernah terbuat di Fase 1

## V10.20.94 — Add 5-Stage Pipeline Bar & Granular G-Labs Retry for SC (22/07/2026)
- Menambahkan 5-Stage Pipeline Status Bar lengkap dengan tombol retry per tahap di Workspace SC
- Mengimplementasikan Selective Retry pada G-Labs Visuals sehingga hanya memproses ulang task_id yang error tanpa merusak adegan yang sudah berhasil
- Membuat API endpoint trigger retry per-step untuk Strategic Campaigns

## V10.20.93 — Adopt OPC 2-Phase Pause Point for SC Workflow Status (22/07/2026)
- Memastikan status workflow SC otomatis diatur ke ready_for_review setelah Call 1 & 2 selesai
- Memicu titik jeda (pause point) skeduler SC di ready_for_review untuk menunggu persetujuan/review manual pengguna sebelum TTS dan I2V berjalan

## V10.20.92 — Fix SC Scenes Column Migration for TTS Audio Path & Local Clip (22/07/2026)
- Menambahkan migrasi otomatis untuk kolom voice_over_audio_path dan local_clip_path pada tabel strategic_campaign_scenes
- Memperbaiki error 'no such column voice_over_audio_path' yang menyebabkan tahap TTS gagal dan menghambat eksekusi G-Labs
- Mereset status item cmp_e7a60fd4 agar dapat melanjutkan pipeline TTS ke G-Labs

## V10.20.91 — Fix SC G-Labs Bridging Image Filter & T2I Prompt Selection (22/07/2026)
- Memastikan pengiriman foto produk reference_images hanya dilakukan pada klip bridging (sesuai posisi bridge_at_clip & bridge_duration)
- Menggunakan sc.t2i_prompt sebagai prioritas utama prompt visual saat dispatch ke G-Labs Webhook

## V10.20.90 — Fix SC G-Labs Default Enabled & Update cmp_2b2c0b3f (22/07/2026)
- Mengubah default enable_glabs pada SC engine dari 0 menjadi 1 agar otomatis mengirim prompt visual T2I/I2V ke G-Labs webhook
- Memperbarui konfigurasi cmp_2b2c0b3f di database SQLite agar enable_glabs aktif

## V10.20.89 — Fix Empty State for Ungenerated SC Video DNA (22/07/2026)
- Menampilkan empty state badge informasi saat Video DNA belum diekstrak Gemini Call 1
- Mencegah teks placeholder palsu muncul sebelum storyboard dieksekusi

## V10.20.88 — Strategic Campaign Full Pipeline Scheduler Engine Integration (22/07/2026)
- Menyelaraskan alur skeduler Strategic Campaign dengan OPC untuk dukungan 5-fase lengkap
- Menambahkan Video DNA AI JSON generator dan bidang Google Sheet & Nextcloud pada form SC

## V10.20.87 — SC Video DNA AI Generation & UI Parity (22/07/2026)
- Menambahkan generasi dinamis 10 parameter Video DNA via Gemini AI Call 1 pada Strategic Campaigns
- Menyimpan video_dna_json ke database SQLite strategic_campaign_items
- Memperbarui Tab 3 Video DNA di UI SC agar membaca video_dna_json secara dinamis sesuai keselarasan OPC

## V10.20.86 — SC Cloud Storage & CAMPAIGN_SC Sheets Sync (22/07/2026)
- Menambahkan input Google Spreadsheet ID & Parent Folder Nextcloud di Basic Creative Strategy SC
- Mengunggah aset video, visual, start frame, dan audio ke Nextcloud/Google Drive dengan penamaan SC_
- Melakukan pencarian baris dan penulisan otomatis asset_url ke tab CAMPAIGN_SC di Google Sheets berdasarkan hook

## V10.20.85 — SC Engine OPC Scheduler Adoption (22/07/2026)
- Mengadopsi mesin eksekusi skeduler OPC ke Strategic Campaigns (SC)
- Menambahkan multi-stage tracking (Generation, TTS, Visuals G-Labs, FFmpeg, Social Post)
- Menerapkan Granular Clip-Level Retry pada tahap visual G-Labs

## V10.20.84 — Strategic Campaign System Poller Logger Routing Fix (22/07/2026)
- Menghubungkan routing log runStep strategic_ ke public/strategic_campaign_logs.txt agar tampil konsisten di konsol

## V10.20.83 — Integrate Strategic Campaigns into Campaign Scheduler Engine (22/07/2026)
- Menambahkan ticketing engine strategic_campaigns ke skeduler utama (lib/campaign-scheduler.js)
- Otomatisasi pemrosesan Fase 1 (AI Call 1 & Storyboard) dan Fase 2 saat kampanye berstatus running (▶ Run)

## V10.20.82 — Strategic Campaign System Poller Logger Component (OPC Parity) (22/07/2026)
- Menampilkan komponen System Poller Logger (indikator online hijau #00b894, judul SYSTEM POLLER LOGGER, [Refresh Log] button, konsol #07070a / #20c20e dengan auto-scroll) pada halaman utama dan detail SC persis OPC

## V10.20.81 — Fix Strategic Campaign Detail Container Vertical Scrollability (22/07/2026)
- Menambahkan className main-content dan height 100vh overflowY auto pada container halaman detail SC sehingga scroll vertikal aktif sempurna

## V10.20.80 — Strategic Campaign 5-Tab Detail Structure (OPC Parity & Full Planner Outputs) (22/07/2026)
- Implementasi 5 Tab Detail per item (Tab 1: Konsep Awal & Produk, Tab 2: Storyboard & Rencana Visual, Tab 3: Video DNA, Tab 4: Aset & Recovery, Tab 5: System Log)
- Menampilkan seluruh output Content Planner (Pilar, Hook, Strategic Angle, CEP, WS Matrix, Context, VFO, Visual Action, Spesifikasi Produk) pada Tab 1
- Menempatkan Social Captions Package & Workflow Settings Fase 2 di bagian paling bawah Tab 2
- Pengelolaan state per-item independen (itemActiveTabs)

## V10.20.79 — Redesign Strategic Campaign Detail 3-Column Table Layout (OPC-Parity) (22/07/2026)
- Mendesain ulang tampilan daftar item SC menjadi Tabel 3-Kolom horizontal (VIDEO ITEM / PILAR, FASE, ACTIONS) persis OPC
- Implementasi collapsible accordion row untuk area Workbench Detail item (Storyboard, Captions, Settings, Logs)

## V10.20.78 — Fix Strategic Campaign Detail 3-Column Layout Margin (22/07/2026)
- Memperbaiki margin-left container halaman detail SC agar sejajar di samping fixed Sidebar (menghindari tumpang tindih kolom 1)
- Optimalisasi proporsi 3 kolom (220px 220px 1fr) sehingga ketiga kolom tampil utuh dan rapi di semua resolusi

## V10.20.77 — Strategic Campaign Semi-Automation & 3-Column Layout Alignment (22/07/2026)
- Menghadirkan tombol RUN semi-otomatisasi (▶ Run / ⏸ Pause / ▶ Resume) pada card kampanye
- Desain UI 3-Kolom utuh halaman detail SC (Item List, Pure Status Icon Badge, Workbench Detail)
- Inline edit naskah, prompts, voiceover, dan captions dengan tombol Simpan Perubahan & Salin
- Fitur replace start frame image per klip dan panel Workflow Settings (Fase 2)

## V10.20.76 — Strategic Campaign Poller Logger System Alignment (22/07/2026)
- Mengimplementasikan sistem Live Poller Logger & Terminal Visual pada menu Strategic Campaign (100 persen selaras dengan OPC)
- Rotasi log otomatis berkas 200 KB dan 500 baris terbaru

## V10.20.75 — Fix Social Captions UI Renderer for Single-Pass Strategic Campaign Engine (22/07/2026)
- Memperbaiki UI renderer Social Captions agar mendukung skema 1-Call Single Pass (publishingPkg.caption dan creativePkg.social_media_package)

## V10.20.74 — Strategic Campaign 1-Call Single-Pass Architecture Unification (22/07/2026)
- Menyatukan eksekusi Call 1 dan Call 2 Strategic Campaign menjadi Single-Pass Engine (1x Call Gemini untuk Storyboard + Social Captions)
- Pemangkasan waktu tunggu hingga 50 persen (~35 detik)

## V10.20.73 — Parity VSO Preset Resolution for Syari Classic in Strategic Campaign (22/07/2026)
- Penyelarasan resolusi preset VSO syari_classic di Strategic Campaign agar menginjeksikan 65-kata deskripsi DNA Bahasa Inggris yang 100% selaras dengan OPC

## V10.20.72 — Mandatory 100 Percent English Language Constraint for Visual Prompts (22/07/2026)
- Menambahkan mandat 100% Bahasa Inggris (English Only) secara mutlak pada prompt t2i_prompt dan i2v_prompt di Call 1 Gemini AI

## V10.20.71 — OPC Prompt Standardization and Universal Multi-Row Configuration Propagation (22/07/2026)
- Menyelaraskan t2i_prompt dan i2v_prompt ke 1 paragraf teks polos berstruktur Layered OPC
- Penerapan universal seluruh konfigurasi 4 Accordion pada seluruh baris kampanye yang diimpor dari Content Planner

## V10.20.70 — Strategic Campaign Dynamic Bridging Clip N Prompt Rule (22/07/2026)
- Memperbaiki instruksi prompt Call 1 Gemini AI agar posisi klip bridging produk 100% mengikuti konfigurasi klip ke-X (bridge_at_clip) dan durasi klip (bridge_duration_clips) dari Accordion 3

## V10.20.69 — Strategic Campaign Full 4 Accordion Prompt Injection (22/07/2026)
- Penginjeksian eksplisit seluruh konfigurasi 4 Accordion (Audio Segmenting, SFX, Target Language, Words per Clip, Product Bridging, Declare Filename) ke prompt Call 1 Gemini AI
- Integrasi sfx_prompt dan voice_segments ke skema JSON output Call 1

## V10.20.68 — Strategic Campaign Smart Narrative Mode & Studio Photo Auto Resolution (22/07/2026)
- Smart Narrative Mode di Accordion 2 otomatis terikat ke baris Content Planner
- Resolusi otomatis Foto Studio (generated_photo_url) dari database produk tanpa perlu ketik manual Declare Filename

## V10.20.67 — Strategic Campaign Creation 4 Accordions Alignment (22/07/2026)
- Menyelaraskan modal pembuatan Strategic Campaign dengan 4 Accordion OPC (Basic Strategy, Aesthetics, Product Bridging, VSO Engine)
- Auto-fill data produk dari Content Planner ke Accordion 3 Product Bridging
- Integrasi TikTok Safe Audit ke Accordion 1 & backend workflow

## V10.20.66 — Revise Strategic Campaign header description text (22/07/2026)
- Memperbarui naskah deskripsi header Strategic Campaign Gateway menjadi 'Automated pipeline strategic campaign based on strategic content planner.'
- Menyelaraskan komunikasi fitur utama sistem

## V10.20.65 — Relocate Strategic Campaign creation button below description text (22/07/2026)
- Memindahkan posisi tombol 'Buat Strategic Campaign Baru' agar berada tepat di bawah naskah deskripsi header
- Meningkatkan kerapihan tata letak dan fleksibilitas akses pembuatan kampanye baru

## V10.20.64 — Render Strategic Campaign item workspace inline under card when opened (22/07/2026)
- Mengubah antarmuka workbench agar seluruh detail workspace (Tab 1, Tab 2, Storyboard, Captions) tampil langsung di bawah kartu baris kampanye yang dibuka
- Meningkatkan efisiensi kerja pengguna dengan model ekspansi inline akordeon

## V10.20.63 — Align Strategic Campaign buttons to OPC purple theme (22/07/2026)
- Mengganti seluruh warna tombol hijau pada Strategic Campaign Gateway dan Workbench dengan warna ungu aksen khas OPC (#6366f1 / #818cf8)
- Memastikan konsistensi penuh UI antarmuka tombol dan badge visual antar menu

## V10.20.62 — Stack Strategic Campaign dashboard cards in 1 vertical column (22/07/2026)
- Penyusunan daftar kartu kampanye pada menu Strategic Campaign utama menjadi 1 kolom vertikal rapi
- Tampilan kartu kampanye menyajikan judul, nama produk, jumlah item, tanggal, dan tombol navigasi Workbench secara presisi

## V10.20.61 — Align Strategic Planner UI color scheme 100% with OPC theme (22/07/2026)
- Penyelarasan skema warna tombol, badge status, teks naskah VO, dan elemen header pada Strategic Campaign Workbench 100% selaras dengan tema OPC (#10b981 / Emerald)
- Memastikan konsistensi pengalaman visual pengguna antar menu

## V10.20.60 — Stack Strategic Campaign Item list vertically in 1 column like OPC (22/07/2026)
- Penyusunan daftar tombol item kampanye (#1, #2, #3, dst.) dalam 1 kolom vertikal rapi
- Setiap kartu item menyajikan informasi Pilar, Hook, Category CEP, dan Badge Status secara utuh selaras dengan OPC

## V10.20.59 — Stack Tab 1 Locked Strategy items in 1 vertical column (22/07/2026)
- Penyusunan 6 elemen strategi terkunci pada Tab 1 menjadi 1 kolom vertikal rapi
- Penyelarasan antarmuka dengan standar visual baris kampanye OPC

## V10.20.58 — Stack Social Captions section in 1 vertical column in Tab 2 (22/07/2026)
- Penyusunan bagian Social Captions & Aset Penerbitan pada Tab 2 menjadi 1 kolom vertikal rapi
- Memastikan seluruh kartu caption (TikTok, Instagram Reels, Facebook, YouTube) tampil berurutan ke bawah

## V10.20.57 — Refactor Tab 2 to 1-Column Vertical Layout and Remove Redundant Tab 3 (22/07/2026)
- Menyusun seluruh bagian klip adegan pada Tab 2 dalam 1 kolom vertikal rapi
- Menghapus Tab 3 redundan sehingga navigasi bersih menjadi 4 Sub-Tab

## V10.20.56 — Enhance Strategic Campaign Workbench UI to OPC Layout (22/07/2026)
- Perbaikan UI Strategic Campaign Workbench Tab 2 mengadopsi standar visual OPC
- Penambahan Galeri Grid Preview T2I untuk seluruh adegan klip
- Pemisahan kartu klip adegan terstruktur (VO, Aksi Visual, Prompt T2I & I2V dengan tombol Salin)
- Integrasi langsung Social Captions multi-platform (TikTok, Reels, FB, YouTube) di Tab 2

## V10.20.55 — Fix Strategic Campaign Engine Reassignment (22/07/2026)
- Mengubah let result menjadi let creativePackage pada executeCall1CreativeEngine untuk memperbaiki syntax error reassign const variable

## V10.20.54 — Fix const variable reassignment build error in strategic-campaign-engine (22/07/2026)
- Memperbaiki kesalahan Reassignment Const Variable pada lib/strategic-campaign-engine.js
- Memastikan build Next.js beroperasi 100% sukses tanpa error kompilasi

## V10.20.53 — Add TikTok Compliance Gate Middleware (22/07/2026)
- Implementasi TikTok Compliance Gate Patch berbasis arsitektur PATCH IMPLEMENTATION — TIKTOK COMPLIANCE GATE.md
- Integrasi Hybrid Lexicon Scanner & Gemini Semantic Audit di antara Call 1 dan Call 2
- Penambahan tabel content_compliance_reviews, Safe Revision Rewriter otomatis, dan 3 Opsi Control Human Review di UI

## V10.20.52 — Add Strategic Campaign Feature (22/07/2026)
- Implementasi menu Strategic Campaign berbasis arsitektur STRATEGIC_PILLAR_CAMPAIGN.md
- Dukungan One-Click Ingestion dari Content Planner & Manual Entry
- Eksekusi 2-Call AI per Item (Call 1 Storyboard dinamis & Call 2 Captions multi-platform)
- Integrasi penuh VSO (Visual Swap Overrides) dan aturan sanitasi dari OPC

## V10.20.51 — Rename Content Planner SOT to content-planner.md (22/07/2026)
- Mengubah nama berkas SOT dari CONTENT_PLANNER_WEB_APP_ARCHITECTURE.md menjadi sot/menus/content-planner.md

## V10.20.50 — Add Content Planner Web App Feature (22/07/2026)
- Implementasi menu Konten Planner 9-kolom berbasis Strategic Frameworks & Decision Tree AI
- Dukungan Dual Input Mode (Direct Manual & Database Product Selection)
- Fitur penguncian sel (Lock/Unlock), regenerasi per-sel, dan ekspor multi-format (CSV, MD, JSON)

## V10.20.49 — Update SOT OPC UI Form Documentation (22/07/2026)
- Menambahkan dokumentasi Section 1-5 UI Form Konfigurasi pada sot/menus/pillar-campaigns.md

## V10.20.48 — Update SOT OPC Documentation to v10.20.47 (21/07/2026)
- Memperbarui dokumen SOT Organic Pillar Campaign (sot/menus/pillar-campaigns.md) selaras dengan fitur v10.20.47

## V10.20.47 — Fix VSO Human Demographic Preset Leakage (21/07/2026)
- Sanitasi visual_style_preset agar bernilai null pada demografi manusia di OPC, RE, dan Sheets Autopilot
- Menambahkan migrasi pembersihan data di lib/db.js untuk menghapus polusi preset 3D claymation

## V10.20.46 — Fix Syntax Error in RE Campaign Detail Page (21/07/2026)
- Memperbaiki missing closing brace pada updateSettingField di app/re-campaigns/[id]/page.js
- Memastikan next build sukses 100% tanpa error kompilasi

## V10.20.45 — Add SubTab Aset & Recovery and Manual Cloud Asset Sync (21/07/2026)
- Menambahkan SubTab Aset & Recovery pada halaman detail kampanye RE dan OPC
- Menyediakan layanan backend manual-asset-uploader untuk memindai dan mengunggah aset parsial ke Nextcloud/Drive

## V10.20.44 — Switch Caucasian Male VSO to Definition B Workspace Framing (20/07/2026)
- Memperbarui preset caucasian_male pada DEMOGRAPHIC_PRESETS ke Definisi B (product workspace framing & casual attire support)
- Menyinkronkan vso-engine.md dengan preset Definisi B

## V10.20.43 — Update Caucasian Male Demographic Preset (20/07/2026)
- Memperbarui preset caucasian_male dengan deskripsi macro shot tangan dan jam tangan

## V10.20.42 — Refine Caucasian Male VSO Faceless Prompt (20/07/2026)
- Memperbarui preset caucasian_male pada DEMOGRAPHIC_PRESETS untuk mencegah kebocoran wajah
- Menambahkan macro framing dan male hand visual anchors pada VSO Engine

## V10.20.41 — Sanitize Negative Prompt Audio Triggers in Prompts Engine (20/07/2026)
- Mengganti kata-kata pemantik audio filter Veo (mouth, eyes, creepy face, dsb) di customNegativePrompt dengan istilah visual netral

## V10.20.40 — Fix Auto-Retry Task Reset in OPC and IFC (20/07/2026)
- Menghapus penimpaan visual_tasks_json pada Auto-Retry handler OPC dan IFC agar tidak mereset ID task klip yang sudah sukses

## V10.20.39 — Fix G-Labs Retry Task Persistence & Prevent Duplicate Renders (20/07/2026)
- Persistensi real-time visual_tasks_json di setiap iterasi klip
- Memastikan task ID klip sukses tersimpan saat terjadi error pada OPC, RE, dan Instant Factory

## V10.20.38 — Refine Narrative Mode Contrast with Relative Beats (20/07/2026)
- Meningkatkan kualitas dan kontras Narrative Mode (Storytelling, Problem-Solution, Educational)
- Menggunakan model pemetaan klip secara relatif terhadap N untuk mendukung jumlah klip yang dinamis

## V10.20.37 — Narrative Mode Integration & Timeout Alignment (20/07/2026)
- Menambahkan Narrative Mode (Storytelling, Problem-Solution, Educational) pada RE Campaign & Autopilot
- Menyelaraskan timeout Gemini API di OPC & Autopilot menjadi 3 menit

## V10.20.36 — Align OPC and Autopilot Gemini Timeout with RE (20/07/2026)
- Menambah parameter timeoutMs pada executeContentGeneration
- Mengubah generator OPC di scheduler-processors menjadi 180 detik
- Merefaktor blok OPC & IFC di sheets-autopilot-worker menjadi 180 detik menggunakan generateContentFlexible

## V10.20.35 — Fix Product Bridging Campaign Reset State Cleaning (19/07/2026)
- Reset tts_status and ffmpeg_status to pending in item reset API route
- Clear local downloader download path caches during reset
- Prevent campaign items from getting stuck in rendering_tts phase after reset

## V10.20.35 — Fix Product Bridging Campaign Reset State Cleaning (19/07/2026)
- Reset tts_status and ffmpeg_status to pending in item reset API route
- Clear local downloader download path caches during reset
- Prevent campaign items from getting stuck in rendering_tts phase after reset

## V10.20.34 — Integrate Key Pool Rotation for All getGeminiModel Callers (19/07/2026)
- Wrap model.generateContent inside getGeminiModel with executeWithKeyPool rotation logic
- Automatically intercept 429 quota errors and rotate API keys in the key pool
- Prevent scheduler crashes when bulk generation requests hit rate limits

## V10.20.33 — Fix Nextcloud Bulk Downloader Video/Audio Matchers (19/07/2026)
- Restrict Nextcloud shared folder download matchers by file extensions
- Prevent audio files (e.g. audio_clip_X.mp3) from matching visual video clip queries (e.g. video_clip_X.mp4)
- Fix corrupt visual files which were causing FFmpeg ffprobe "No video stream found" crashes

## V10.20.32 — Move Render Configurations to Row Level & Add Video Zoom/BGM/SFX (19/07/2026)
- Attach generate TTS & FFmpeg Muxing settings to individual item rows (baris kampanye)
- Support zoom scale, sfx volume, bgm volume, and sync options per row
- Default FFmpeg Sync Option to Autopilot Smart Sync
- Clean up global render configurations card

## V10.20.31 — Add Nextcloud Folder Share Scanning, TTS & FFmpeg Muxing for Bridging Campaigns (19/07/2026)
- Support public Nextcloud shared folder scanning using WebDAV folder listing
- Automatically download original clips (*clip_1.mp4, *clip_2.mp4, *clip_3.mp4) and *audio_clip_1.mp3/wav from Nextcloud folder
- Add ⚙️ Konfigurasi Render card to bridging detail Workbench identical to RE Campaigns
- Implement processBridgeBulkTts for rendering voiceovers for clips 2, 3, 4 with Gemini/Minimax
- Implement processBridgeBulkFfmpeg to standardize videos (720x1280, 25fps) and mux/concat to bridging_video_final.mp4
- Upload final assets with `_baru` suffix to Nextcloud folder

## V10.20.30 — Add Custom Instruction for Bridging (19/07/2026)
- Store and parse custom instructions for single and bulk bridging campaigns
- Steer Gemini AI copywriter and visual prompts with user custom instructions

## V10.20.30 — Add Custom Instruction Support for Product Bridging Campaigns (19/07/2026)
- Add custom_instruction column to bridge_injector_campaigns and bridge_injector_items tables
- Implement textarea fields for Custom Instruction in Single and Bulk campaign creation forms
- Support parsing custom_instruction from CSV/Excel sheets for individual bulk items
- Pass custom_instruction into buildProductBridgingInjectorPrompt to steer Gemini AI generation
- Render campaign custom instructions callout box on Workbench detail view

## V10.20.29 — Fix Path Resolution Bug for fileToBase64 Image Reference (19/07/2026)
- Fix path resolution bug in fileToBase64 helper function across all campaign types (bridging scheduler, RE campaigns, and API routes)
- Ensure relative paths starting with a leading slash correctly resolve to process.cwd() public/ folder

## V10.20.28 — Add Reset Feature for Bulk Product Bridging Items (19/07/2026)
- Add POST /api/v2/bridge-injector/items/[itemId]/reset endpoint to clear state back to pending
- Implement reset UI handler and render "💥 Reset" button inside Actions column of items list

## V10.20.27 — Standardize Bridging Prompts with Micro-Pacing (19/07/2026)
- Modify buildProductBridgingInjectorPrompt to enforce structured layer format
- Standardize t2i and i2v prompts with 4-segment micro-pacing

## V10.20.27 — Standardize Bridging Injector Prompts with Micro-Pacing Layers (19/07/2026)
- Modify buildProductBridgingInjectorPrompt to generate structured layer format
- Enforce [LAYER 1: INPUT & TRUTH LOCK], 4-segment [LAYER 2: MICRO-PACING & ACTION], and [LAYER 3: SFX] layers for clip 2

## V10.20.26 — Fix Stale Closure Bug on Bridging Workbench (19/07/2026)
- Tambahkan selectedItemIdRef untuk melacak item aktif secara real-time
- Cegah polling interval menyebabkan reset ke baris pertama akibat stale closure

## V10.20.25 — Align Bridging Layout with RE Campaigns (19/07/2026)
- Align bulk product bridging details layout to RE Campaigns tabular format
- Implement ideas-table with expandable sub-row drawer

## V10.20.25 — Align Bridging Campaign Workbench to RE Campaign Layout (19/07/2026)
- Align bulk product bridging campaign details page layout to match RE Campaigns tabular style
- Replace direct collapsible cards with ideas-table layout containing expandable sub-row details drawer

## V10.20.24 — Update Bridging Layout to 1-Column (19/07/2026)
- Modify page layout from 2-column flex to single vertical column
- Structure bulk campaign items as an accordion list of collapsible cards

## V10.20.24 — Update Bridging Campaign Workbench to Single Vertical Column Layout (19/07/2026)
- Modify app/product-bridge-inject/[id]/page.js UI layout from 2-column flex to a single vertical column
- Structure bulk campaign items as an accordion list of collapsible cards, direct-rendering 4-tab workbenches in-place

## V10.20.23 — Auto-resolve Nextcloud Public Share URLs (19/07/2026)
- Auto-resolve Nextcloud public share link patterns to direct download URLs
- Append /download dynamically in processBridgeBulkDownload

## V10.20.23 — Auto-resolve Nextcloud Public Share URLs in Product Bridging (19/07/2026)
- Automatically parse and resolve Nextcloud public share link patterns to direct download URLs
- Append /download format dynamically in processBridgeBulkDownload to retrieve markdown raw contents

## V10.20.22 — Playwright CDP Fallback to Persistent Context (19/07/2026)
- Menambahkan helper getPersistentContext di playwright-scraper.js
- Menambahkan fallback otomatis ke persistent Chromium context jika koneksi CDP port 9222 gagal
- Mengabaikan folder data/playwright-profile di .gitignore

## V10.20.21 — Fix Google Drive Product Image Download in Bulk Import (19/07/2026)
- Download Google Drive product images locally to public uploads
- Convert downloaded reference images to Base64 data URLs before sending to G-Labs
- Reprocess 17 recently uploaded products to regenerate correct photos

## V10.20.20 — Add Bulk Product Bridging (19/07/2026)
- Create database schema for bulk bridge items
- Implement background queue scheduler in campaign-scheduler
- Create API endpoints for bulk items updates, approvals, T2I regen, and manual replace
- Update product bridging UI dashboard and details page

## V10.20.20 — Add bulk production feature to product bridging (19/07/2026)
- Create bridge_injector_items database schema and campaign_type column migration
- Implement background queue scheduler in campaign-scheduler.js for bulk campaign rows
- Create new API endpoints for bulk items updates, approvals, start frame regeneration, and manual image replacement
- Modify product-bridge-inject page to support CSV import and list bulk campaign progress
- Build detail workbench page app/product-bridge-inject/[id]/page.js with 4 tabs (Naskah Asli, Storyboard & Preview, DNA, System Logs)

## V10.20.19 — Update SOT architecture documentation (19/07/2026)
- Align re_campaigns, re_campaign_items, pillar_campaigns, and pillar_campaign_items schema tables with local database structure

## V10.20.18 — Fix RE details page alerts, retry pipeline, and prompts (19/07/2026)
- Strictly enforce generating both t2i_prompt and i2v_prompt in prompts.js for hybrid_lock mode
- Create POST trigger endpoint for manual stage control in RE campaign items
- Enable rendering pipeline status bar for all RE campaign items whether they have angle variants or not
- Migrate all blocking alert dialogs on RE details page to non-blocking toast notifications

## V10.20.17 — Fix OPC campaign details voice updates (17/07/2026)
- Fix missing voice configuration updates (provider, persona, speed, volume) in OPC campaign details PATCH API endpoint
- Align both RE and OPC API details endpoints to fully sync voice fields

## V10.20.16 — Fix campaign creation audio segment saving (17/07/2026)
- Fix campaign creation API routes to parse and save enable_audio_segment property during RE and OPC POST requests
- Migrate Test Kartun 08 database setting to enable audio segments
- Confirm correct generation of voice_segments and dynamic dialogue split during campaign deconstruction

## V10.20.15 — Fix prompt timeout and skip audio thumbnails (17/07/2026)
- Increase Gemini API request timeout dynamically to 180 seconds if a file payload is attached to handle upload and processing latency
- Set text-only timeout to 60 seconds to prevent premature failure
- Skip thumbnail generation for audio-only extensions to avoid FFmpeg errors

## V10.20.14 — Fix prompt timeout and skip audio thumbnails (17/07/2026)
- Prevent ffmpeg thumbnail extraction failures for audio formats (MP3/WAV/etc)
- Increase Gemini API request timeout dynamically to 90 seconds if a file payload is attached to handle upload latency

## V10.20.13 — Restore default Gemini 3.5 Flash and resilient fallback (17/07/2026)
- Restore default support for gemini-3.5-flash model in both RE and OPC campaigns
- Implement model-specific context caching to prevent compatibility errors
- Integrate a 25-second API request timeout wrapper with resilient fallback to gemini-2.5-flash to prevent socket hangs

## V10.20.12 — Support Gemini Structured JSON Prompts and Enforce MANDATE 94 v3.0 (17/07/2026)
- Enforce 2 characters dialoguing per clip (MANDATE 94 v3.0)
- Configure Stage 5 to output structured JSON prompts for Gemini TTS and silent prompts for Minimax
- Safely stringify prompt objects in scheduler processors and fix campaign naming collision in ProcessReAnalyzer
- Lock Voice Provider in details view and validate JSON syntax before campaign save/approval

## V10.20.11 — Fix yt-dlp Cookie Fallback Blocking (17/07/2026)
- Refactor downloadFromUrl in lib/video-downloader.js to sequentially fall back through static cookies, browser cookies, and no cookies attempts
- Prevent stale or invalid cookie configurations from immediately halting the download process

## V10.20.10 — Minimax Voice Persona Gender Indicators (17/07/2026)
- Tampilkan indikator pria (Male) dan wanita (Female) pada nama-nama Voice Persona Minimax di semua halaman panel kontrol (TTS Studio, Recipe Labs, Sheets Autopilot, Campaign Dashboards)

## V10.20.9 — Perfect Multi-Character Dialogue (17/07/2026)
- Refactor OTONOM and AKTIF dialogue mandates to enforce multi-character conversation and variation across clips
- Add voice_segments field explicitly to dynamicPlanFields inside lib/prompts.js
- Map gemini-3.5-flash to active gemini-2.5-flash model in executeContentGeneration to avoid API gateway socket hangs

## V10.20.8 — Align Sheets Autopilot Batch ID Naming Convention (17/07/2026)
- Menyelaraskan format penamaan Batch ID pada Sheets Autopilot agar konsisten dengan kampanye manual
- Mengadopsi pola [CampaignType]-[CampaignCode]-[DateStr]-[PaddedRowIndex] (misal: RE-SIAS-20260717-023)

## V10.20.8 — Align Sheets Autopilot Batch ID Naming Convention (17/07/2026)
- Menyelaraskan format penamaan Batch ID pada Sheets Autopilot agar konsisten dengan kampanye manual
- Mengadopsi pola [CampaignType]-[CampaignCode]-[DateStr]-[PaddedRowIndex] (misal: RE-SIAS-20260717-023)

## V10.20.7 — Integrate Browser Cookies for Autopilot Video Downloads (17/07/2026)
- Menambahkan opsi yt-dlp Cookie Source Browser di halaman Settings
- Mengintegrasikan parameter --cookies-from-browser di lib/video-downloader.js untuk bypass halaman login / perlindungan Facebook Reels secara otomatis

## V10.20.7 — Integrate Browser Cookies for Autopilot Video Downloads (17/07/2026)
- Menambahkan opsi "yt-dlp Cookie Source Browser" di halaman Settings (Chrome, Safari, Firefox, Edge, Opera)
- Mengintegrasikan parameter `--cookies-from-browser` di lib/video-downloader.js untuk bypass halaman login / perlindungan Facebook Reels secara otomatis

## V10.20.6 — Strict Video Download Enforcement in Sheets Autopilot (17/07/2026)
- Menolak eksekusi autopilot jika download video referensi RE gagal
- Memaksa pelemparan galat (hard error) saat download gagal untuk mencegah Gemini memproses naskah fiktif

## V10.20.6 — Strict Video Download Enforcement in Sheets Autopilot (17/07/2026)
- Menolak eksekusi otomatis Sheets Autopilot jika pengunduhan video referensi kampanye tipe RE gagal
- Memaksa pelemparan galat (hard error) saat download gagal untuk mencegah Gemini memproses naskah fiktif tanpa video referensi

## V10.20.5 — Unify Voice Cast Manager UI and Support Gemini Dialog TTS (16/07/2026)
- Menyatukan UI Voice Cast Manager ke area Generate TTS sidebar detail kampanye RE & OPC
- Menyembunyikan dropdown persona suara global secara otomatis apabila mode Audio Segment aktif
- Memperluas dukungan rendering dialog multi-voice dan penggabungan FFmpeg ke Google Gemini TTS
- Menyelaraskan registrasi JIT otonom agar memetakan karakter baru ke suara Gemini secara round-robin ketika provider Gemini aktif

## V10.20.5 — Unify Voice Cast Manager UI & Support Gemini Dialog TTS (16/07/2026)
- Menyatukan UI Voice Cast Manager ke dalam kotak pengaturan "Generate TTS" di sidebar kanan detail kampanye RE & OPC
- Menyembunyikan dropdown persona suara global secara otomatis apabila mode Audio Segment aktif
- Memperluas dukungan rendering segmen dialog multi-voice dan penggabungan FFmpeg ke Google Gemini TTS
- Menyelaraskan registrasi JIT otonom agar memetakan karakter baru ke suara Gemini secara round-robin ketika provider Gemini aktif

## V10.20.4 — Fix Audio Segment and Voice Cast Saving (16/07/2026)
- Memperbaiki penyimpanan enable_audio_segment dan voice_cast_json di DB saat bulk/PATCH
- Menyelaraskan parsing prompts di processReAnalyzer
- Memperkuat JSON placeholder agar Gemini tertib menghasilkan Audio Segment

## V10.20.4 — Fix Audio Segment & Voice Cast Saving and Prompts Integration (16/07/2026)
- Memperbaiki kegagalan penyimpanan enable_audio_segment dan voice_cast_json di database saat pembuatan bulk dan pembaruan PATCH kampanye RE/OPC
- Memperbaiki parameter pemanggilan buildReverseEngineeringPrompt agar meneruskan status audio segment dari kampanye ke prompt builder
- Memperbarui format JSON schema placeholder pada prompt T2V/I2V untuk mengunci dan memicu output tag (Audio Segment: "...") secara disiplin saat mode audio segment aktif

## V10.20.3 — Support On-The-Fly Mascot Creation (16/07/2026)
- Menambahkan instruksi dinamis agar Gemini dapat menciptakan karakter maskot baru secara on-the-fly
- Memungkinkan pembuatan karakter cuka apel, chia seed, dan junk food secara otonom dalam prompt T2I

## V10.20.3 — Support On-The-Fly Mascot Creation in VSO Prompts (16/07/2026)
- Menambahkan instruksi dinamis agar Gemini dapat menciptakan karakter maskot baru secara "on-the-fly" jika ada bahan/produk cerita yang belum terdaftar di preset semesta maskot
- Memungkinkan pembuatan karakter botol cuka apel, biji chia, dan makanan cepat saji secara otonom dalam naskah/visual prompt tanpa merusak gaya visual 3D claymation yang dikunci

## V10.20.2 — Fix Mascot Universe VSO parsing (16/07/2026)
- Memperbaiki subject_demographic parser di prompts.js untuk mode maskot
- Menyertakan detail DNA maskot dan larangan model manusia nyata ke Gemini
- Mencegah applyReplacements menimpa deskripsi maskot dengan Muslimah/gamis di RE, OPC, dan Autopilot

## V10.20.2 — Fix Mascot Universe VSO parsing in RE & OPC Prompts (16/07/2026)
- Memperbaiki kegagalan visual overrides untuk preset semesta maskot (seperti mascot_universe_herbal) agar tidak fallback ke "a graceful Muslimah"
- Menambahkan parser subject_demographic dinamis yang menginjeksi DNA daftar karakter maskot dan aturan larangan model manusia nyata ke Gemini
- Memperbarui applyReplacements di RE, OPC, dan Sheets Autopilot worker untuk melewati regex force-overwrite jilbab/gamis/Muslimah saat menggunakan mode maskot

## V10.20.1 — Fix RE Analyzer ReferenceError and Mime Type Resolution (16/07/2026)
- Memperbaiki ReferenceError tempCampaign is not defined di processReAnalyzer
- Menambahkan getMimeType dinamis untuk upload berkas audio/slideshow ke Gemini

## V10.20.1 — Hotfix RE Analyzer ReferenceError & Dynamic Mime Type (16/07/2026)
- Memperbaiki bug `ReferenceError: tempCampaign is not defined` pada scheduler `processReAnalyzer` dengan merujuk ke variabel `campaign` secara tepat
- Menambahkan dukungan resolusi Mime Type dinamis (`getMimeType`) untuk unggahan ke Gemini API pada file audio/slideshow hasil unduhan yt-dlp (mencegah error status `FAILED` saat memproses berkas `.mp3`)

## V10.20.0 — JIT Dynamic Voice Mapping & UI Simplification (16/07/2026)
- Menyembunyikan Voice Cast Manager dari form pembuatan kampanye
- JIT Voice Cast registration di worker dan analyzer
- Multi-voice segment rendering dengan ffmpeg concat di TTS scheduler
- Panel Voice Cast Manager di campaign detail pages untuk review

## V10.20.0 — JIT Dynamic Voice Mapping & Creation UI Simplification (16/07/2026)
- Menyembunyikan Voice Cast Manager dari form pembuatan kampanye (RE, OPC, Sheets Autopilot) untuk menyederhanakan workflow
- Implementasi dynamic JIT (Just-In-Time) Voice Cast registration di sheets-autopilot-worker.js, processReAnalyzer, dan processPillarGenerator untuk mendaftarkan karakter secara otonom
- Implementasi multi-voice segment rendering dengan concatAudioSegments() menggunakan ffmpeg di processReTts dan processPillarTts
- Menambahkan panel interaktif Voice Cast Manager di detail view kampanye (RE & OPC) agar user dapat mengevaluasi dan mengatur pilihan suara setelah naskah di-generate sebelum TTS diproduksi

## V10.19.0 — Multi-Maskot Dialog + Konsistensi Suara (16/07/2026)
- KB Mandate 94 v2.0 + SOT Arsitektur Multi-Voice Dialog
- DB migration voice_cast_json di re/pillar/sheets campaigns
- Prompt injection multi-character dialog per kampanye
- TTS pipeline multi-segment + concatAudioSegments()
- Voice Cast Manager UI di semua campaign pages

## V10.18.1 — Add Voice Cast Manager UI to Sheets Autopilot (16/07/2026)
- Insert UI Voice Cast Manager ke sheets-autopilot/page.js
- Conditional display saat enableAudioSegment aktif
- State dan payload sudah terhubung (voiceCast, voice_cast_json)

## V10.18.0 — Audio Segment Toggle + Mascot Voice DNA (v10.18.0) (16/07/2026)
- Tambah toggle Audio Segment (Enabled/Disabled) di Basic Creative Strategy pada RE, OPC, dan Sheets Autopilot
- Saat Enabled: prompt LAYER 2 menyertakan (Audio Segment: "...") inline per segmen 2 detik (Mandate 92)
- Saat Enabled dengan Mascot Universe: otomatis injeksi Mandate 93 — suara ekspresif karakter maskot + LIP SYNC ON
- Buat file KB baru: kb-seeds/AUDIO_SEGMENT_EXTENSION_v1.0.md dengan Mandate 92-94 (termasuk fondasi multi-voice Phase 2)
- Analisis: SOT belum mendukung multi-voice per klip — roadmap Phase 2 didokumentasikan di KB Extension
- Default state: Disabled (backward-compatible, tidak merusak kampanye existing)

## V10.17.0 — VSO Mascot Universe Engine V9.4 — 4 Semesta Kartun (16/07/2026)
- Tambah MASCOT_UNIVERSES: 4 semesta kartun (Herbal, Kitchen, Home Living, Pet) dengan ~82 karakter maskot di lib/prompts.js
- Tambah MASCOT_ART_STYLES: 3 gaya animasi (3D Claymation, Kawaii Flat Vector, Ghibli Watercolor)
- Upgrade buildVisualSwapOverridePrompt V8.4.1 → V9.4 dengan logika autonomous mascot selection (Mandate 97)
- UI RE Campaigns: dropdown Semesta Maskot Otonom + Gaya Animasi kondisional + hide Wardrobe saat maskot aktif
- UI OPC (Pillar Campaigns): dropdown Semesta Maskot Otonom + Gaya Animasi kondisional + hide Wardrobe saat maskot aktif
- UI Sheets Autopilot: dropdown Semesta Maskot Otonom + Gaya Animasi kondisional + hide Wardrobe saat maskot aktif
- Auto-switch characterConcept ke cartoon_face saat memilih semesta maskot di semua 3 modul
- Teruskan visual_style_preset ke payload overrides di semua 3 modul

## V10.16.37 — Add Cartoon Face Visibility Option (16/07/2026)
- Tambahkan opsi cartoon_face di getConceptInstruction pada lib/prompts.js
- Tambahkan opsi Cartoon Face (Kartun Ekspresif) di dropdown Face Visibility menu RE Campaigns
- Tambahkan opsi Cartoon Face (Kartun Ekspresif) di dropdown Face Visibility menu Pillar Campaigns
- Tambahkan opsi Cartoon Face (Kartun Ekspresif) di dropdown Face Visibility menu Sheets Autopilot
- Tambahkan opsi Cartoon Face (Kartun Ekspresif) di dropdown Konsep Karakter VSO menu RE Campaigns

## V10.16.36 — Sync global architecture and menu blueprint with recent product bridging updates (16/07/2026)
- Synchronize bridge_injector_campaigns and bridge_injector_outputs database schemas to global architecture
- Update workflow synopsis in blueprint menu SOT with JIT checks, Base64 reference images, and background ticking
- Add /product-bridge-inject route entry to global architecture map
- Add Product Bridging Injector to modern local scheduler campaigns catalog

## V10.16.35 — Lock product visual truth and packaging consistency on T2I prompt (15/07/2026)
- Map visual properties including key_visuals_extracted and clean_photo_t2i_prompt in resolveProductData
- Inject target visual properties into buildProductBridgingInjectorPrompt
- Enforce strict visual locking rules to prevent product packaging deformation in T2I renders

## V10.16.34 — Integrate real-time product search bar in bridging menu (15/07/2026)
- Add productSearchQuery state to bridge injector UI page
- Render text input field to search through product library
- Filter products array by brand and product names dynamically

## V10.16.33 — Contextualize visual prompts generated during product bridging (15/07/2026)
- Modify buildProductBridgingInjectorPrompt to instruct Gemini for dynamic prompts
- Enforce environment continuity with original script location and lighting
- Enforce product interaction (e.g. held by actor's hand) over static tabletop scenes

## V10.16.32 — Send product base64 image and use nano_banana_pro on T2I (15/07/2026)
- Convert database product image path to Base64 in generate-t2i API
- Attach base64 string to reference_images list for G-Labs
- Explicitly specify model as nano_banana_pro in webhook request body

## V10.16.31 — Fix bridge injector background polling and logs freezing (15/07/2026)
- Add background ticking loop for bridge campaigns to campaign scheduler
- Fetch status updates autonomously every 15 seconds
- Successfully download visuals and advance campaign workflow state

## V10.16.30 — Lookup product URL in database and add JIT warning popup (15/07/2026)
- Check local product database first before scraping URL input
- Show JIT scraping confirmation dialog if product is missing
- Support updating bridge_injector_campaigns table in resolveProductData backend

## V10.16.29 — Add script MD file uploader and prompt parsing (15/07/2026)
- Change textarea script input to MD file uploader
- Add client-side FileReader parse with preview
- Update buildProductBridgingInjectorPrompt to parse structured Voiceover Script sections

## V10.16.28 — Improve Product Bridging UI and Add Logger (15/07/2026)
- Redesign UI to single-column stacked vertical layout
- Add SYSTEM POLLER LOGGER terminal with 3s auto-polling
- Add bridge-injector-logger helper and integrate into all API routes
- Add local scheduler active/inactive toggle control

## V10.16.27 — Implement Product Bridging Injector V9.2 (15/07/2026)
- Database schema initialization for bridging campaigns
- Narrative Aligner prompt builder buildProductBridgingInjectorPrompt
- Backend API Routes for T2I, I2V and status polling
- Frontend Workbench UI at /product-bridge-inject and compilation of naskah_bridging.md
- Update blueprint to final Source of Truth

## V10.16.21 — Fix NC URL Replacement in Post FB (14/07/2026)
- Menerjemahkan link local IP Nextcloud ke public domain tunnel secara otomatis di manual route handler dan background scheduler saat memposting ke Facebook

## V10.16.20 — Revert FB Post Media URL to Nextcloud (14/07/2026)
- Mengembalikan basis URL media pengunggahan gambar ke FB menggunakan URL Nextcloud sesuai arahan user

## V10.16.19 — Fix FB Missing Image File with Local Path Tunnel (14/07/2026)
- Menggunakan direct URL local image grid via public tunnel (fb_server_url) saat memposting draf bergambar ke FB untuk mengatasi error invalid image file

## V10.16.18 — Fix FB Manual Post Photo Mode in Recipe Labs (14/07/2026)
- Mengubah tombol Post Manual ke FB di UI Recipe Labs agar mendeteksi tipe posting secara dinamis (photo jika G-Labs aktif dan link Nextcloud tersedia, jika tidak text_only)

## V10.16.17 — Direct FB Page Token Exchange (14/07/2026)
- Menukar token secara langsung menggunakan Page ID target saat testing untuk bypass list accounts kosong di dev mode

## V10.16.16 — Send Current Page ID to FB Test Connection (14/07/2026)
- Mengirimkan Page ID yang sedang diinput oleh user di form ke API test-facebook
- Bypass list accounts kosong di dev mode dengan langsung melakukan penukaran token direct via node endpoint

## V10.16.15 — Remove Category Field from FB API Call (14/07/2026)
- Menghapus field category dari query param fields pada endpoint Graph API Facebook untuk menghindari error #100 di Graph API v19+

## V10.16.14 — Fix FB Page Test Connection Auto-Resolve (14/07/2026)
- Memperbaiki tes koneksi FB Page dengan mendeteksi daftar halaman terotorisasi dari token secara dinamis sebelum verifikasi ID
- Auto-resolve ID ke halaman yang diotorisasi oleh token baru

## V10.16.13 — Auto Exchange FB User Token to Page Token (14/07/2026)
- Menukar User Access Token FB ke Page Access Token secara otomatis saat tes koneksi
- Mengupdate input field token di settings UI secara otomatis jika tes berhasil

## V10.16.12 — Fix Recipe Generator Model Fallback (14/07/2026)
- Menangani run-time generateContent error dari gemini-3.5-flash dengan fallback otomatis ke gemini-2.5-flash saat proses pembuatan resep

## V10.16.11 — Update Recipe Labs Deconstruct Reference UI (14/07/2026)
- Mengubah label referensi video dekonstruksi di Recipe Labs agar hanya menampilkan URL dan Tags

## V10.16.10 — Integrate Deconstruction Lab with Recipe Labs (14/07/2026)
- Menambahkan kolom source_deconstruct_asset_id ke recipe_campaigns
- Membuat API GET deconstructed-assets untuk dropdown form
- Menambahkan dropdown referensi video dekonstruksi di form Recipe Labs beserta auto-prefill
- Upgrade model scheduler resep ke gemini-3.5-flash dan menyisipkan context storyboard kompetitor ke prompt AI
- Menambahkan tombol cepat Generate Recipe di Deconstruct Lab detail card

## V10.16.9 — Update Recipe Labs SOT Document (14/07/2026)
- Sinkronisasi schema kolom database recipe_campaigns dan recipe_items pada sot/menus/recipe-labs.md dengan skema database riil

## V10.16.8 — Add Non-Interactive Release Option (14/07/2026)
- Menambahkan opsi CLI non-interaktif ke scripts/release.js
- Menambahkan script release-non-interactive ke package.json
- Memperbarui SOP AGENTS.md untuk mengutamakan rilis non-interaktif

## V10.16.7 — Sanitize T2I Prompt for Google Imagen Compatibility (14/07/2026)
- Menambahkan sanitizeImagePrompt() di webhook-client yang menghapus NEGATIVE PROMPT, sintaks Midjourney (--ar, --no), tag LAYER, frasa 'strictly', dan deskripsi body-part redundan sebelum mengirim ke Google Imagen.
- Memperbaiki error 400 INVALID_ARGUMENT dari Google Imagen pada Klip 3 dan 4 OPC yang disebabkan oleh konten NEGATIVE PROMPT (cleavage, bare skin, sensual) yang terbaca sebagai prompt positif oleh safety filter Google.
- Prompt dipangkas dari ~2100 ke ~850 karakter tanpa mengurangi kualitas visual gambar yang dihasilkan.

## V10.16.6 — Fix Image Model & Reference Image Path Resolution (14/07/2026)
- Mengganti setting DB webhook_image_model dari imagen4 (sudah mati) ke nano_banana_pro.
- Memperbaiki OPC generator yang membaca setting key salah (glabs_image_model) menjadi webhook_image_model.
- Menghapus hardcoded imagen4 di RE Glabs, mengganti dengan pembacaan setting dinamis.
- Menyederhanakan format reference_images di seluruh codebase menjadi raw base64 array sesuai dokumentasi G-Labs.
- Memperbaiki bug fileToBase64 pada API regenerate yang memperlakukan path /uploads/... sebagai path absolut filesystem.

## V10.16.5 — Fix OPC T2I Reference & Regen API Filters (14/07/2026)
- Memperbaiki pencarian reference image path di processPillarGenerator dengan merujuk ke tempCampaign.
- Membatasi parameter reference_images pada API regenerate-t2i (segmental) hanya untuk adegan bridging.
- Membatasi parameter reference_images pada API regenerate-start-frames (batch) hanya untuk adegan bridging.

## V10.16.4 — Fix Format T2I Reference & Parser OPC (14/07/2026)
- Memperbaiki format payload reference_images untuk model G-Labs Banana pada tahap pre-rendering T2I di processPillarGenerator.
- Memperbaiki pencarian absolute file path pada helper fileToBase64 di processPillarGenerator.
- Menambahkan ketangguhan parser baru untuk mendukung visual prompt dalam bentuk array string maupun array objek.

## V10.16.3 — Fix Bug Interpolasi Prompt OPC (14/07/2026)
- Memperbaiki bug kritis interpolasi string template pada buildOrganicPillarPrompt di lib/prompts.js (menghilangkan escape backslash pada variabel prompt sehingga data produk dan visual mode tereksekusi dengan benar).

## V10.16.2 — Integrasi Visual Foto & Isolasi Foto Produk di OPC & RE (14/07/2026)
- Memperbarui alur sourcing JIT (processRowProductSourcing) agar menyalin seluruh kemasan fisik (packaging_type, is_in_packaging, t2i_prompt, i2v_action_prompt) dari database ke creative payload.
- Menyinkronkan mapping metadata produk secara utuh di processPillarGenerator sebelum memanggil Gemini storyboard.
- Membatasi pengiriman reference image produk ke G-Labs hanya untuk adegan bridge (c === bridgeAtClip) baik di pre-rendering T2I maupun rendering video task di processPillarGlabs dan processReGlabs.

## V10.16.1 — Isolasi Pembahasan Produk di Menu OPC & RE (14/07/2026)
- Menambahkan instruksi ketat PRODUCT PLACEMENT ISOLATION MANDATE ke dalam system prompt generator RE (buildReverseEngineeringBridgePrompt) dan OPC (buildOrganicPillarPrompt) di lib/prompts.js.
- Memaksa Gemini hanya membahas dan menampilkan visual kemasan produk target pada klip ke-N (sesuai setelan bridgeAtClip) dan menjaga klip non-bridge lainnya bersih dari materi promosi produk.
- Mempertahankan logika Visual Mode Guard programatik di backend (sheets-autopilot-worker.js) agar semua klip tetap menghasilkan visual T2I & I2V jika menggunakan mode visual Hybrid pada Autopilot.

## V10.16.0 — Sinkronisasi Caption Single-Line di Menu RE & OPC (14/07/2026)
- Menambahkan fitur penulisan balik (write-back) caption Instagram dan TikTok dalam format single-line ke tab kampanye utama CAMPAIGN_RE (pada menu Reverse Engineering) dan CAMPAIGN_OPC (pada menu Organic Pillar Campaign) setelah analisis selesai.
- Mendukung pencocokan alias nama kolom dinamis serta pemetaan data sel dinamis (dynamic headers mapping) untuk mencegah sel bergeser akibat penambahan kolom manual oleh pengguna.

## V10.15.0 — Visual Mode Guard di Sheets Autopilot (14/07/2026)
- Mengimplementasikan Visual Mode Guard pada Sheets Autopilot untuk merestrukturisasi visual prompt secara programatik.
- Mencegah halusinasi LLM (Gemini) pada pembagian index array t2v_prompts, t2i_prompts, dan i2v_prompts berdasarkan visual mode dan rentang klip bridge secara dinamis.

## V10.14.1 — Sinkronisasi Caption Single-Line ke Tab Kampanye Utama (14/07/2026)
- Menambahkan fitur penulisan balik (write-back) caption Instagram dan TikTok dalam format single-line ke tab kampanye utama (seperti CAMPAIGN_OPC) setelah pemrosesan autopilot selesai.
- Mendukung deteksi kolom target dinamis berdasarkan aliases seperti tiktok_caption, ig_caption, dll.

## V10.14.0 — Impor Massal Produk via CSV & AI Enrichment (14/07/2026)
- Menambahkan fitur unggah massal produk via CSV/Excel mentah.
- Mengintegrasikan pengayaan detail produk (nama, kategori, USP, dll.) secara batch (maksimal 10 produk) menggunakan Gemini AI.
- Menerapkan remastering visual foto produk mentah ke versi studio bersih via G-Labs Webhook secara otomatis.
- Menyediakan visual status overlay glassmorphic (Enriching, Rendering, Failed, Completed) pada grid database produk.
- Menyediakan konsol log poller sistem real-time terintegrasi di halaman database produk untuk memudahkan pemantauan pengguna.

## V10.14.0 — Impor Massal Produk via CSV & AI Enrichment (14/07/2026)
- Menambahkan fitur unggah massal produk via CSV/Excel mentah.
- Mengintegrasikan pengayaan detail produk (nama, kategori, USP, dll.) secara batch (maksimal 10 produk) menggunakan Gemini AI.
- Menerapkan remastering visual foto produk mentah ke versi studio bersih via G-Labs Webhook secara otomatis.
- Menyediakan visual status overlay glassmorphic (Enriching, Rendering, Failed, Completed) pada grid database produk.
- Menyediakan konsol log poller sistem real-time terintegrasi di halaman database produk untuk memudahkan pemantauan pengguna.

## V10.13.2 — Simulasi Perilaku Manusia (Human Simulator) pada CDP Scraper (14/07/2026)
- Mengintegrasikan detektor anti-otolasi (mengaburkan navigator.webdriver) di tab CDP.
- Menambahkan simulasi mouse path acak sebelum memproses pembacaan halaman.
- Menerapkan scroll halus dinamis (human-like reading scroll) dengan jeda baca acak dan micro-backscroll.

## V10.13.1 — Perbaikan Handshake CDP Playwright & Setup Debug Profile Kustom (14/07/2026)
- Menambahkan parameter noDefaults: true pada Playwright connectOverCDP untuk menghindari Protocol error (Browser.setDownloadBehavior) pada browser Chrome luar.
- Melakukan dokumentasi walkthrough setup debugging Chrome menggunakan non-default data directory.

## V10.13.0 — Konsolidasi Koneksi CDP Chrome Asli & Penghapusan Sesi Tokopedia (13/07/2026)
- Mengonsolidasikan Playwright Scraper untuk selalu menggunakan Google Chrome Asli (Koneksi CDP) sebagai satu-satunya fungsi scraping e-commerce yang optimal dan bebas Captcha.
- Menghapus total opsi dan fungsionalitas Tokopedia Session dari UI pengaturan dan backend launcher.
- Menghapus opsi Shopee Session peramban manual persisten serta checkbox mode headless yang sudah tidak relevan.
- Menyederhanakan API route /api/scraper/session untuk menghapus kode launcher headful login yang usang.
- Memperbarui tata letak halaman Pengaturan untuk menyajikan konfigurasi profil Chrome debugging secara langsung dan terfokus.

## V10.12.2 — Perbaikan Error EISDIR Pengecekan Berkas Saat Upload ke Nextcloud (12/07/2026)
- Menyempurnakan pemeriksaan fs.existsSync untuk jalur gambar resep di lib/scheduler-processors.js dengan memvalidasi keberadaan string path itu sendiri, mencegah direktori /public ter-resolve dan diunggah secara tidak sengaja ke Nextcloud.

## V10.12.1 — Perbaikan Bug API 'body is not defined' pada Pembuatan Kampanye Recipe Labs (12/07/2026)
- Memperbaiki kesalahan parsing body request POST pada endpoint /api/recipe-labs/route.js dengan menambahkan pemanggilan await request.json().

## V10.12.0 — Preset Kolase Asimetris Otomatis 3-6 Gambar di Recipe Labs (12/07/2026)
- Menambahkan 10 preset layout kolase asimetris dinamis (Editorial Split, Modern Masonry, Pentagon, Step Cascade, Magazine Hexa-grid, Pinterest Style, dsb).
- Mengintegrasikan pilihan jumlah gambar T2I (3-6) dan preset kolase langsung pada Form Konfigurasi Kampanye Recipe Labs Statis.
- Melakukan migrasi database SQLite untuk mendukung parameter custom grid (gap, border radius, padding, background color) di recipe_campaigns dan recipe_items.
- Membuat lib/core/GridCoordinates.js sebagai registry koordinat grid 12x12 beresolusi 1080p.
- Mengupgrade engine sharp lib/recipe-grid-helper.js untuk memproses kolase asimetris dinamis dengan masking sudut melengkung.
- Memodifikasi background workers di lib/scheduler-processors.js untuk menghasilkan N gambar, mendownloadnya, dan merakit kolase sesuai preset secara otomatis.

## V10.11.9 — Panduan Operasional Interaktif di Menu Recipe Labs (12/07/2026)
- Menambahkan state showGuide dan tombol toggle interaktif Buka/Tutup Panduan pada app/recipe-labs/page.js.
- Menyusun visual card panduan operasional yang merinci alur kerja Kampanye Static dan Kampanye Video di Recipe Labs.

## V10.11.8 — Pencegahan Musik Latar (BGM) di Visual Prompts (12/07/2026)
- Mengganti semua contoh template yang berisi 'upbeat background music' dengan efek suara fisik seperti 'sizzling sound' pada prompts.js.
- Menambahkan aturan instruksi negatif tegas (Strict Negative Instruction) di tingkat pembuatan prompt agar LLM melarang kata music, background music, atau BGM pada segmen [LAYER 3: SFX] di menu RE, OPC, dan Sheets Autopilot.

## V10.11.7 — Penggabungan Estetika Tangan & Kepatuhan Busana Syar'i (VSO) (12/07/2026)
- Memperbarui preset syari_classic di dalam DEMOGRAPHIC_PRESETS pada prompts.js.
- Menggabungkan spesifikasi estetika tangan wanita Asia Tenggara (delicate female hands, Southeast Asian, slender fingers, natural neat fingernails) dengan aturan busana syar'i gamis longgar untuk konsistensi visual di Google Veo.
- Menyelaraskan dokumentasi vso-engine.md.

## V10.11.6 — Refaktorisasi Preset Wardrobe & Demografi Syar'i Classic (12/07/2026)
- Memperbarui preset syari_classic di dalam DEMOGRAPHIC_PRESETS pada prompts.js dan vso-engine.md.
- Memperbarui seluruh preset warna wardrobe wanita (amber_terracotta hingga cloud_dancer) agar menggunakan kata kunci "wearing a modest loose-fitting gamis dress with long flowing sleeves covering the arms completely down to the wrists", secara eksplisit melarang kaos (t-shirts) dan lengan baju yang digulung (rolled-up sleeves) guna menjamin ketepatan definisi pakaian Syar'i secara visual.

## V10.11.5 — Optimasi Konsistensi Estetika Tangan Wanita Syar'i (VSO) (12/07/2026)
- Memperbarui preset syari_classic di dalam DEMOGRAPHIC_PRESETS pada prompts.js.
- Menambahkan spesifikasi tangan wanita Asia Tenggara (delicate female hands, Southeast Asian, slender fingers, natural neat fingernails) untuk menjamin konsistensi visual di Google Veo.

## V10.11.4 — Implementasi Backend Fallback Regex VSO Terisolasi (11/07/2026)
- Menambahkan fallback regex pada applyReplacements di sheets-autopilot-worker.js untuk mendeteksi dan menimpa paksa deskripsi visual buatan LLM.
- Menambahkan fallback regex serupa pada scheduler-processors.js untuk menjaga keselarasan fungsionalitas di web app.
- Menghindari perubahan pada templat prompts.js untuk menjamin kestabilan kreativitas prompt buatan LLM.

## V10.11.3 — Perbaikan Visual Swap Overrides (VSO) Sheets Autopilot (11/07/2026)
- Menambahkan fungsi applyReplacements di runVisualStage pada sheets-autopilot-worker.js untuk memetakan visual overrides (demografi, pakaian, cahaya) sebelum dikirim ke G-Labs.
- Menambahkan penanganan placeholder [MANDATE 29 - 3-Point Character Lock] pada applyReplacements di scheduler-processors.js.
- Mendukung override wardrobe color dinamis berbasis baris Google Sheets pada autopilot worker.
- Menyelaraskan templat prompt visual T2V dan T2I agar 100% konsisten antara background scheduler web app dan autopilot.

## V10.11.2 — Integrasi TikTok Safe Voiceover Audit & Laporan Kepatuhan (11/07/2026)
- Menambahkan kolom enable_vo_audit pada campaigns, serta original_voiceover, tiktok_safe_voiceover, compliance_status, compliance_score, compliance_log_json, selected_vo_version pada tabel campaign_items di database SQLite.
- Membuat backend helper lib/tiktok-compliance-service.js untuk mengeksekusi model Gemini-2.5-Flash dengan system prompt aturan kebijakan medis/periklanan TikTok Shop.
- Menambahkan toggle audit patuh pada form pembuatan kampanye RE & OPC.
- Menghubungkan skeduler processReAnalyzer & processPillarGenerator untuk memicu audit patuh dan menunda pre-render T2I agar user dapat meninjau di Workbench.
- Memperbarui halaman Workbench RE & OPC untuk menampilkan ringkasan skor risiko, verdict, serta segment tab toggle naskah voiceover (Orisinal vs Audit).

## V10.11.1 — Penyelarasan UX RE Campaign Massal Tanpa Modal (11/07/2026)
- Menghapus tombol modal Buat RE Massal dari header halaman.
- Mengintegrasikan mode produksi massal sebagai tab switcher (Single/Mass) di dalam form utama.
- Memindahkan drag-and-drop file uploader dan preview tabel baris ke Accordion Section 1.
- Menyatukan submit handler form utama agar otomatis memicu handleMassSubmit jika mode massal aktif.
- Menghilangkan showMassModal yang menutupi konfigurasi agar pengguna bebas menyetel parameter global.

## V10.11.0 — RE Campaign Massal dengan JIT Product Bridging (11/07/2026)
- Menambahkan kolom product_url pada tabel re_campaign_items untuk product bridging dinamis per baris.
- Mendukung parameter array objek pada addReCampaignItems untuk menyimpan product_url dari file CSV.
- Menyelaraskan skeduler processReAnalyzer & processReGlabs agar melakukan lookup dan override data produk per baris secara dinamis.
- Membuat API bulk ingestion baru /api/v2/re-campaigns/bulk untuk menangani pembuatan RE Campaign massal.
- Menyediakan berkas template CSV re_mass_template.csv yang kompatibel dengan Sheets Autopilot.
- Menyediakan UI uploader drag-and-drop & dialog parsing CSV massal di halaman RE Campaigns.

## V10.10.10 — Penambahan Fitur Unduh Template CSV pada UI OPC Mass (11/07/2026)
- Menyediakan tautan unduhan langsung berkas template CSV minimalis (opc_mass_template.csv) pada kotak petunjuk bantuan halaman pembuatan kampanye massal Organic Pillar Campaign.
- Mengimplementasikan stopPropagation pada aksi klik tombol unduhan untuk menghindari pemanggilan dialog file uploader yang mengganggu kenyamanan pengguna.

## V10.10.9 — Penyediaan Panduan & Template CSV Minimalis OPC Mass (11/07/2026)
- Memperbarui teks petunjuk bantuan pengunggahan berkas pada UI pembuatan kampanye OPC Mass (app/pillar-campaigns/page.js) agar merekomendasikan format minimalis 4 kolom wajib.
- Membuat berkas template CSV contoh minimalis templates/opc_mass_template.csv yang berisi 4 kolom: Pilar Konten, Hook, Visual Action, dan link_product.
- Menyediakan dokumen panduan teknis sot/global/opc_mass_bridging_guide.md yang menjelaskan alur pengisian kolom dan pemanfaatan JIT Sourcing dengan database caching.

## V10.10.8 — Penyelarasan JIT Sourcing & Alias Kolom Produk OPC Mass (11/07/2026)
- Menambahkan pemeriksaan database cache product_extractions pada skeduler sourcing OPC Mass (processRowProductSourcing) sebelum melakukan Playwright scraping guna menghemat kuota API Gemini dan performa server.
- Memperluas daftar pencocokan alias nama kolom produk pada parser berkas matriks konten client-side OPC Mass agar 100% kompatibel dan selaras dengan Sheets Autopilot.

## V10.10.7 — Perbaikan Syntax Error Illegal Continue di campaign-scheduler.js (11/07/2026)
- Memperbaiki syntax error "Illegal continue statement: no surrounding iteration statement" di lib/campaign-scheduler.js dengan membuka kembali loop iterasi utama currentItem yang terputus akibat penutupan kurung kurawal.

## V10.10.6 — Penyelarasan Alur Kerja (Workflow Status) RE & OPC Campaign (11/07/2026)
- Menambahkan pembaruan otomatis workflow_status menjadi 'completed' pada database SQLite untuk item OPC Campaign yang telah selesai diproduksi.
- Membatasi status 'Queue for TTS' pada UI detail RE Campaign agar hanya muncul jika pengguna telah memberikan persetujuan produksi (workflow_status === 'production_processing').
- Menambahkan status jeda review '⏸️ Fase 2 : Paused (Ready for Review)' pada UI detail RE Campaign untuk menggantikan 'Queue for TTS' sebelum disetujui.
- Menyelaraskan teks status jeda review pada UI detail OPC Campaign dari 'Paused (Review)' menjadi 'Paused (Ready for Review)'.

## V10.10.5 — Perbaikan Syntax Error Redeclared Variable 'headers' pada RE Campaign (11/07/2026)
- Memperbaiki syntax error "Identifier 'headers' has already been declared" pada berkas lib/scheduler-processors.js yang menghentikan proses npm run build pada server produksi.
- Mengubah nama variabel destructuring pencarian baris menjadi sheetHeaders untuk menghindari konflik scope dengan variabel headers tingkat modul.

## V10.10.4 — Perbaikan Pengisian asset_url Share Folder pada RE & OPC (11/07/2026)
- Memperbaiki pengisian kolom asset_url pada Google Sheet agar menggunakan URL publik share folder (Nextcloud) atau URL folder (Google Drive) alih-alih direct URL file video.
- Menggunakan getOrCreatePublicShareLink untuk Nextcloud pada processReFfmpeg (RE) dan processPillarFfmpeg (OPC).
- Menyelaraskan driveUrl penyimpanan Google Drive pada OPC agar menggunakan format folder https://drive.google.com/drive/folders/... seperti RE.

## V10.10.3 — Perbaikan Deteksi & Inkrementasi Batch ID pada RE Campaign (11/07/2026)
- Memperbaiki bug pembentukan Batch ID duplikat (-001) di mana skeduler RE salah membaca data di Kolom B (url_source) pada tab CAMPAIGN_RE.
- Mengimplementasikan deteksi dinamis letak kolom batch_id berdasarkan pembacaan header baris pertama (CAMPAIGN_RE!1:1) sebelum melakukan pencarian Batch ID lama.
- Melakukan verifikasi keamanan logika Batch ID pada menu OPC (Ideation!A:B) dan memastikan bahwa OPC bebas dari bug ini.

## V10.10.2 — Perbaikan Scope Database Client pada Skeduler RE Campaign (11/07/2026)
- Menyelesaikan runtime error "db is not defined" pada fungsi processReAnalyzer dengan memindahkan inisialisasi database client db = getDb() ke luar cakupan blok if (itemId) agar dapat diakses dari scope utama fungsi.
- Memulihkan kesuksesan eksekusi parser visual_overrides_json untuk mode sekuensial pakaian (sequential wardrobe style) saat skeduler otomatis berjalan dari antrean background.

## V10.10.1 — Perbaikan Parameter Visual Mode pada Skeduler RE Campaign (11/07/2026)
- Memperbaiki bug pada skeduler processReAnalyzer di mana parameter visual_mode terlewat (tidak dikirimkan) pada pemanggilan buildReverseEngineeringPrompt untuk kampanye non-bridging.
- Memperbarui fallback default visual_mode menjadi "hybrid_lock" pada pemanggilan buildReverseEngineeringBridgePrompt untuk kampanye bridging di skeduler.
- Menjamin Gemini AI memproses instruksi Double-Pass (T2I + I2V) secara utuh untuk seluruh klip pada kampanye RE baru.

## V10.10.0 — Restrukturisasi Layout Visual Mode & Default Hybrid Mode (OPC & RE Campaign) (11/07/2026)
- Memindahkan input select Visual Mode dari Section 3 ke Section 2 (Aesthetics & Visual Settings) pada menu pembuatan kampanye RE dan OPC.
- Mengubah layout Section 2 OPC dari flexbox vertikal 1 kolom menjadi grid 2-kolom dan menyelaraskan urutan fields secara presisi dengan form RE Campaign.
- Menyelaraskan label penamaan input menjadi "Visual Mode" untuk kedua kampanye.
- Mengatur default state visualMode ke "hybrid_lock" pada RE Campaign di frontend form, reset modal, dan fallback backend API.
- Mempertahankan panel upload gambar referensi produk di Section 3 secara kondisional saat Visual Mode diaktifkan sebagai Hybrid Lock.

## V10.9.9 — Peningkatan Prompt Builder & Sanitizer untuk Pencegahan Filter G-Labs (10/07/2026)
- Menambahkan 4 Aturan Anti-Rejection (Zero Tolerance) ke system prompt kampanye OPC (buildOrganicPillarPrompt) untuk mencegah penolakan filter keamanan G-Labs (PUBLIC_ERROR_AUDIO_FILTERED).
- Mengintegrasikan pembentukan Negative Prompt anatomi dinamis berdasarkan gaya visual kampanye OPC (mencegah penambahan negative cgi/anime/cartoon jika gaya visual yang dipilih adalah Anime atau 3D Claymation).
- Meningkatkan fungsi pasca-proses sanitizer (sanitizeI2vPrompt) untuk menyaring kata-kata cairan sensitif tambahan dan membuang kata-kata audio sensitif secara otomatis dari prompt dan negative prompt.

## V10.9.8 — Implementasi Accordion Aset Klip di Detail Kampanye OPC & RE (10/07/2026)
- Menambahkan perilaku Accordion pada daftar Aset Klip di halaman detail kampanye OPC dan RE.
- Card Aset Klip #1 terbuka secara default, sedangkan klip-klip lainnya tertutup untuk menghemat ruang vertikal.
- Membuka salah satu card klip akan otomatis menutup card klip lain yang sedang terbuka.
- Menambahkan indikator chevron (▼/▶) dan visual hover cursor pointer pada header card.

## V10.9.7 — Perbaikan Inisialisasi API Google Sheets di OPC FFmpeg Stage (10/07/2026)
- Menyelesaikan ReferenceError: sheets is not defined pada fungsi processPillarFfmpeg dengan menginisialisasi client Google Sheets API secara benar menggunakan getAuthorizedClient().
- Memulihkan penulisan otomatis pipeline_status ke Completed, drive_link ke asset_url, dan processed_at ke sheet CAMPAIGN_OPC saat tahap FFmpeg selesai.

## V10.9.6 — Pemindahan Start Frame Cloud Upload & Resolusi Double Upload OPC/RE (10/07/2026)
- Memindahkan proses upload image start frame T2I dari tahap visual generation ke tahap akhir (FFmpeg/Upload Stage) di menu RE dan OPC.
- Menghapus kode upload cloud langsung dari fungsi downloadAndUploadPillarClip dan downloadAndUploadReClip untuk mencegah double upload klip individual.
- Menambahkan sinkronisasi upload klip individual dan image start frame ke Google Drive dan Nextcloud secara terpusat pada tahap akhir.
- Penyelarasan tata nama file start frame di cloud menjadi format [BatchID]_start_frame_[Index].png.

## V10.9.5 — Penyelarasan Aturan Penamaan File & Folder Cloud (10/07/2026)
- Menyelaraskan nama video final hasil muxing FFmpeg menjadi [BatchID]_video_final.mp4 di menu RE Campaign, OPC, dan Sheets Autopilot.
- Menyelaraskan nama video clip individual menjadi [BatchID]_video_clip_[Index].mp4.
- Menyelaraskan nama audio clip individual menjadi [BatchID]_audio_clip_[Index].mp3/wav.
- Menyelaraskan nama naskah markdown menjadi [BatchID]_naskah.md di menu OPC dan Sheets Autopilot.
- Menyelaraskan nama gambar produk menjadi [BatchID]_product_image.png di menu OPC.
- Menambahkan file cadangan naskah.md di Sheets Autopilot untuk mempertahankan backward compatibility.

## V10.9.4 — Fix JSX Fragment Syntax Error in Sheets Autopilot page (10/07/2026)
- Memperbaiki kesalahan sintaksis tag fragment JSX (<> / </>) pada dropdown sheets-autopilot/page.js akibat penghapusan Model Pakaian Pria Kaukasia

## V10.9.3 — Clean up Basic Non-Color Wardrobe Options for Caucasian Male VSO (10/07/2026)
- Menghapus pilihan model pakaian dasar tanpa warna (casual flannel, smart oxford, suit, knit, denim, hoodie, linen) dari dropdown UI untuk mencegah inkonsistensi warna
- Memastikan VSO Pria Kaukasia hanya menyajikan 10 preset warna maskulin premium secara penuh di seluruh antarmuka dropdown

## V10.9.2 — Add VSO Male Color Presets and Scheduler Random/Sequential Logic (10/07/2026)
- Menambahkan 10 preset warna pakaian maskulin baru khusus untuk subjek Pria Kaukasia (VSO) di prompts.js
- Menyesuaikan logika acak (random) dan berurutan (sequential) pada backend scheduler (scheduler-processors.js) agar menggunakan 10 preset warna baru
- Memperbarui antarmuka dropdown select wardrobe pada re-campaigns, pillar-campaigns, recipe-labs, multiplier-lab, dan sheets-autopilot

## V10.9.1 — Fix Sheets Autopilot Storyboard Resume Inheritance Logic (09/07/2026)
- Memperbaiki logika resume storyboard pada sheets-autopilot-worker.js agar tidak mewarisi array kosong "[]" dari pekerjaan gagal sebelumnya saat auto-retry dijalankan

## V10.9.0 — Fix Sheets Autopilot Storyboard Generation for RE Campaigns (09/07/2026)
- Menambahkan adapter kompatibilitas (compatibility mapper) di sheets-autopilot-worker.js untuk mengonversi format new_video_plan ke format storyboard/voiceover
- Memperbaiki kegagalan pemrosesan baris Sheets Autopilot yang menggunakan template RE campaign karena storyboard terdeteksi kosong

## V10.8.9 — Fix JSX Nesting Closure in OPC Detail Page (09/07/2026)
- Memperbaiki kesalahan penutupan tag div (nesting JSX) pada fungsi renderStoryboards di app/pillar-campaigns/[id]/page.js

## V10.8.8 — Fix OPC Detail Prompts UI & Visual Mode Fallback (09/07/2026)
- Memperbarui halaman detail OPC untuk menampilkan prompt T2I dan I2V pada seluruh klip jika visual_mode kampanye adalah hybrid_lock (tidak terbatas pada klip bridge saja)
- Menampilkan pratinjau start frame T2I dari array t2i_images_json secara dinamis untuk seluruh klip di halaman detail OPC
- Mengintegrasikan penyaringan kunci keluaran parser di scheduler-processors.js untuk membuang kunci prompt yang tidak sesuai secara otomatis berdasarkan visual_mode (menghilangkan redundansi data)

## V10.8.7 — Fix Remaining SWC Compilation Errors in prompts.js (09/07/2026)
- Menghapus seluruh sisa backslash eskapis pada placeholder template literal di buildReverseEngineeringPrompt dan buildReverseEngineeringBridgePrompt untuk mencegah error parsing lexer SWC (Unterminated string constant) secara menyeluruh

## V10.8.6 — Fix SWC Compilation Error in prompts.js (09/07/2026)
- Menghilangkan backslash eskapis pada placeholder template literal di buildOrganicPillarPrompt untuk mencegah error parsing lexer SWC (Unterminated string constant)

## V10.8.5 — Fix OPC Campaign Prompt Generator (Redundant T2V & SFX Issue) (09/07/2026)
- Mengintegrasikan opsi sfx_setting ke dalam generator prompt OPC buildOrganicPillarPrompt
- Dinamisasi segmen [LAYER 3: SFX] dan penambahan aturan peniadaan SFX secara ketat jika mode Without SFX diaktifkan pada OPC
- Menghilangkan redundansi keluaran t2v_prompts pada mode visual hybrid_lock dengan mematikan segmentasi rules dan format JSON output yang bersangkutan

## V10.8.4 — Implement SFX Setting Option (With/Without SFX) for OPC and RE Campaigns (09/07/2026)
- Menambahkan kolom sfx_setting pada tabel re_campaigns dan re_pillar_campaigns dengan nilai default 'without_sfx'
- Memperbarui parser route handler API v2 untuk OPC dan RE agar memproses dan menyimpan parameter sfx_setting
- Menambahkan dropdown select SFX Setting pada accordion Basic Creative Strategy di form pembuatan kampanye (halaman OPC dan RE)
- Menambahkan badge SFX (Tanpa SFX / Dengan SFX) pada panel detil halaman kampanye
- Mengintegrasikan parameter sfx_setting ke dalam scheduler processor dan prompts builder (buildReverseEngineeringPrompt & buildReverseEngineeringBridgePrompt)
- Dinamisasi instruksi prompt I2V dan T2V untuk meniadakan segmen LAYER 3: SFX serta menyertakan instruksi peniadaan bunyi/SFX jika opsi Tanpa SFX dipilih

## V10.8.3 — Fix Nextcloud target folder path resolution in scheduler and route handlers (09/07/2026)
- Menambahkan helper getCampaignNextcloudTargetFolder untuk mendeteksi campaign.nextcloud_parent_folder dan melakukan fallback ke global setting nextcloud_target_folder
- Memperbarui penentuan parentFolder pada 14 lokasi di scheduler-processors.js agar menghormati parent folder unik dari kampanye
- Memperbarui penentuan targetFolder pada route handler export-markdown untuk Organic Pillar Campaign (OPC) dan Reverse Engineering (RE)

## V10.8.2 — Implement dynamic prompts format and output schemas for OPC and RE campaigns based on visual_mode (09/07/2026)
- Dinamisasi skema JSON output dan instruksi buildOrganicPillarPrompt agar hanya menghasilkan field prompts visual yang relevan dengan visual_mode (hybrid_lock / pure_t2v)
- Dinamisasi skema new_video_plan dan visualModeInstructions pada buildReverseEngineeringPrompt & buildReverseEngineeringBridgePrompt untuk mencegah Gemini menghasilkan prompt t2v_prompts/t2v_prompt redundan saat mode hybrid_lock aktif

## V10.8.2 — Implement dynamic prompts format and output schemas for OPC and RE campaigns based on visual_mode (09/07/2026)
- Dinamisasi skema JSON output dan instruksi buildOrganicPillarPrompt agar hanya menghasilkan field prompts visual yang relevan dengan visual_mode (hybrid_lock / pure_t2v)
- Dinamisasi skema new_video_plan dan visualModeInstructions pada buildReverseEngineeringPrompt untuk mencegah Gemini menghasilkan prompt t2v_prompts/t2v_prompt redundan saat mode hybrid_lock aktif

## V10.8.1 — Fix export-markdown routes to use unique campaign folder structure and align UI to Sync to Cloud (09/07/2026)
- Memperbarui penentuan path folder cloud pada API export-markdown (OPC, RE, IFC) agar sesuai dengan struktur folder unik getCampaignParentFolderName
- Memperbaiki self-healing spreadsheet pada OPC agar membuat tab CAMPAIGN_OPC dengan kolom yang tepat, bukan RE Results
- Mengubah tombol Sync to Google Drive pada halaman detil kampanye menjadi Sync to Cloud untuk fleksibilitas multi-storage (Nextcloud & Drive)

## V10.8.0 — Redirect storyboard upload urls to asset_url and skip markdown_url (09/07/2026)
- Memindahkan penulisan tautan cloud storyboard dari kolom markdown_url ke kolom asset_url (link folder batch)
- Menghapus penulisan/pembaruan kolom markdown_url sepenuhnya pada skeduler RE, OPC, dan autopilot worker

## V10.7.9 — Unify and restructure campaign asset folders (OPC & RE) (09/07/2026)
- Menyatukan folder penyimpanan cloud (Google Drive & Nextcloud) di bawah folder induk unik {OPC/RE}_{CampaignName}_{paddedCampaignId}
- Mengelompokkan seluruh aset (.md naskah, .mp3 voiceover, .mp4 video) di bawah subfolder batch_id yang sesuai
- Mengunggah gambar start frame (T2I) ke folder batch yang bersangkutan saat generasi visual G-Labs

## V10.7.8 — Fix Campaign Variable Initialization in processPillarGlabs (09/07/2026)
- Menambahkan deklarasi dan inisialisasi variabel "campaign" pada Phase 1 processPillarGlabs
- Mengatasi runtime error "Cannot access 'b' before initialization" yang mematikan scheduler saat melakukan polling dan progresif upload klip video

## V10.7.7 — Align OPC Video Clip Filename Formats for Cloud Providers (09/07/2026)
- Menyelaraskan penamaan file video klip individual pada menu OPC (downloadAndUploadPillarClip) antara Google Drive dan Nextcloud agar konsisten menggunakan format "OPC-[CampaignName]-[PaddedIndex]-Clip-[ClipIndex].mp4"
- Memastikan keselarasan penuh sesuai spesifikasi Cloud Storage Configuration

## V10.7.6 — Fix OPC Storyboard Generation Cloud Storage Support (09/07/2026)
- Menyelaraskan proses unggah naskah markdown dan gambar produk di tahapan OPC Storyboard Generator (processPillarGenerator) agar sepenuhnya mendukung Cloud Storage Configuration (Nextcloud & Google Drive)
- Memastikan bahwa ketika pengguna memilih Nextcloud di menu settings, riset storyboard dan gambar produk diunggah langsung ke Nextcloud

## V10.7.5 — Progressive Cloud Uploads for OPC and RE Pipelines (09/07/2026)
- Memindahkan proses upload file audio (TTS) agar langsung diunggah ke Google Drive / Nextcloud sesaat setelah file audio selesai dibuat
- Merefaktor logika polling G-Labs agar mendownload dan mengunggah video klip secara progresif per klip yang selesai, tanpa harus menunggu seluruh klip selesai (mencegah kehilangan kemajuan jika salah satu klip gagal)
- Memastikan status visual_clip_paths di database terupdate secara bertahap saat setiap klip selesai didownload

## V10.7.4 — OPC Micropacing Template Standardization (09/07/2026)
- Menstandardisasi format micropacing pada OPC Prompt Builder agar terbagi rata menjadi 4 segmen berdurasi total 8 detik
- Mengubah templat instruksi i2v_prompt dan t2v_prompt serta contoh output strict JSON di lib/prompts.js untuk menyertakan durasi penuh dari 00:00 hingga 00:08
- Mencegah Gemini AI melakukan halusinasi/improvisasi durasi acak secara otomatis

## V10.7.3 — OPC & RE Clipboard Fallback & Failed Production Editability (09/07/2026)
- Menambahkan fungsi pembantu writeToClipboard dengan fallback document.execCommand untuk menjamin fungsi salin berjalan normal pada lingkungan HTTP / Tailscale di server produksi
- Mengubah logika isReadOnly agar membuka akses edit naskah/prompt dan menampilkan tombol Simpan Perubahan jika status kampanye sedang diproses tetapi terdapat sub-tahap yang failed
- Memperbarui tombol salin pada storyboard Tab 2 untuk menggunakan writeToClipboard fallback helper

## V10.7.2 — OPC & RE Storyboard Save Draft Button & Retry Workflow (09/07/2026)
- Menambahkan backend support parameter only_save di endpoint approve/route.js (OPC & RE) untuk menyimpan draft tanpa memicu antrean produksi secara otomatis
- Menampilkan tombol 💾 Simpan Perubahan (Save Draft) di samping tombol Approve pada halaman detail Workbench (OPC & RE)
- Memfasilitasi alur self-healing: User dapat edit prompt yang ditolak (failed) di textarea -> Save Draft -> Retry 🔄 pada Workbench

## V10.7.1 — OPC & RE Prompt Editing, Copy Buttons & Safety Builders (09/07/2026)
- Menampilkan dan memisahkan bidang teks prompt T2V dan I2V secara bebas pada Tab 2 halaman detail kampanye OPC
- Menyediakan tombol salin (📋 Salin) pada seluruh bidang input teks/naskah di Tab 2 detail kampanye OPC untuk kemudahan kelola manual
- Menambahkan pengesahan pengesetan teks kosong pada T2V RE campaign agar tetap boleh disunting jika kosong
- Menyuntikkan Critical Safety Rule di 5 tempat lib/prompts.js untuk melarang penggunaan suara vokal non-verbal manusia (sigh/gasp/moan) pada layer SFX guna menghindari filter Veo

## V10.7.0 — OPC & RE Campaign Voiceover Validation Guardrails (09/07/2026)
- Menambahkan pengesahan (validation check) naskah suara (VO) kosong pada halaman detail kampanye OPC dan RE sebelum diluluskan (approve)
- Menghentikan proses kelulusan dan memaparkan amaran popup jika terdapat klip yang tidak mempunyai naskah VO manakala fitur TTS aktif

## V10.6.9 — OPC Scheduler Logs Clean Up for Paused Items (08/07/2026)
- Menghapus log status paused review berulang pada loop skeduler OPC untuk menghindari polusi dan penumpukan file log sistem

## V10.6.8 — OPC Campaign Generator Migration to Gemini 3.5 Flash (08/07/2026)
- Migrasi proses penjanaan strategi kreatif kampanye OPC (processPillarGenerator) menggunakan model gemini-3.5-flash secara lalai
- Mengintegrasikan generateContentFlexible untuk menyediakan sokongan fallback automatik ke gemini-2.5-flash jika berlaku ralat/kesesakan pada model utama

## V10.6.7 — OPC Mass Configurations, Spreadsheet ID Sanitization & Status Fix (08/07/2026)
- Menyelesaikan gap konfigurasi pada pembuatan OPC Mass (Spreadsheet ID, Nextcloud Folder, dan Durasi Transisi) agar tersinkronisasi penuh
- Menambahkan utilitas extractSpreadsheetId untuk membersihkan tautan link Google Sheets menjadi ID murni (44 karakter) pada backend API
- Memperbaiki urutan prioritas pemetaan status Fase 2 di Workbench agar item dalam review tetap berstatus Paused (Review) meskipun upload_status completed

## V10.6.6 — VSO Consistency, Wardrobe Preset Expansion & Auto-Sheets OPC (08/07/2026)
- Menambahkan post-processing regex replacement di backend scheduler untuk memastikan placeholder VSO ([Wardrobe Lock], dll.) diganti 100% konsisten
- Menambahkan 3 preset kemeja kasual baru untuk subjek Pria Kaukasia (total menjadi 7 jenis pakaian, maks 1 formal)
- Menambahkan opsi VSO Sequential (urut per baris) pada seluruh dropdown wardrobe pakaian
- Menghapus syarat upload_spreadsheet pada kampanye OPC sehingga penulisan spreadsheet baru/lama selalu berjalan secara otomatis (default)

## V10.6.5 — OPC Campaigns Custom Instructions Override Fix (08/07/2026)
- Memperbaiki logika override custom_instruction pada OPC Massal agar tidak menimpa instruksi kustom global jika data baris CSV kosong

## V10.6.4 — OPC Campaigns T2I Failure Toleration (08/07/2026)
- Menghapus validasi kegagalan T2I (start frame) mutlak sehingga baris tetap masuk ke review kreatif meskipun ada gambar yang gagal generated

## V10.6.3 — OPC Campaigns Google Sheets Caption Tab Rename to Captions (08/07/2026)
- Menyelaraskan nama tab Google Sheets untuk caption pada kampanye OPC menjadi Captions (sebelumnya Caption)

## V10.6.2 — OPC Campaigns Strict Sequential Fase 1 and T2I Validation (08/07/2026)
- Menambahkan validasi kegagalan T2I (start frame) pada processPillarGenerator sehingga baris ditandai failed jika ada gambar gagal
- Memperketat pengecekan prevItemsInFase1 pada skeduler agar baris N hanya mulai jika seluruh baris sebelumnya berstatus completed

## V10.6.1 — OPC Campaign Items Action Buttons Cleanup (08/07/2026)
- Menghapus tombol aksi tambahan (Nextcloud, Video, GDrive, dan FB Draft) pada kolom Actions tabel item OPC
- Menyisakan hanya tombol Detail untuk memperluas baris detail workbench

## V10.6.0 — Asynchronous Row-by-Row Processing in OPC Campaigns Scheduler (08/07/2026)
- Memodifikasi loop skeduler OPC Campaign dari pencarian baris tunggal menjadi iterasi seluruh baris secara paralel/asinkron
- Menambahkan pengecekan keselarasan Fase 1 agar pembuatan naskah/storyboard tetap berjalan berurutan/sekuensial
- Mengizinkan baris berikutnya memproses Fase 1 segera setelah baris sebelumnya menyelesaikan Fase 1 (tidak perlu menunggu Fase 2 selesai)

## V10.5.9 — OPC Mass Production CSV Parser Alias Correction (08/07/2026)
- Menambahkan alias pilar_content dan pilar content ke parser kolom content_pillar

## V10.5.8 — OPC Mass Production CSV Parser and Preview Layout Fix (08/07/2026)
- Menjadikan pencocokan kolom/header pada parser CSV/xlsx bersifat case-insensitive dan mendukung berbagai alias
- Memperbaiki keterisian kolom Pilar Konten, Hook, dan kolom lainnya saat membaca file CSV
- Menambahkan pengecekan kondisional isBridgingActive pada kolom Produk/URL di tabel pratinjau

## V10.5.7 — OPC Campaign Hook-based Dynamic Row Resolution (08/07/2026)
- Menambahkan fungsi helper findOpcRowByHook untuk mencocokkan hook secara dinamis pada tab CAMPAIGN_OPC
- Mengintegrasikan pencarian baris berbasis hook pada Fase 1 dan Fase 2 scheduler OPC
- Menulis kolom batch_id, pipeline_status, markdown_url, asset_url, dan processed_at
- Menghubungkan public link folder aset Nextcloud/Drive secara otomatis ke kolom asset_url

## V10.5.6 — OPC Scheduler Visual Mode and Delay Alignment (08/07/2026)
- Menyelaraskan nama berkas start frame menggunakan awalan opc_start_frame_
- Mengubah isHybridLockClip agar mendeteksi hybrid_lock untuk seluruh klip pada pembuat video G-Labs
- Menambahkan jeda acak 10-20 detik di antara pengiriman tugas video ke webhook

## V10.5.5 — OPC & RE Campaign UI Alignments and OPC T2I Pre-rendering (08/07/2026)
- Menyelaraskan card kampanye OPC agar menampilkan info Jumlah Konten & Progress saja
- Mengganti kolom Pipeline Status OPC dengan informasi Fase tunggal (mirip RE)
- Mengubah field input Video DNA OPC dari select dropdown menjadi text input
- Mengatur tata letak Workflow Settings OPC menjadi 1 kolom vertikal dan hanya tampil di Tab Storyboard
- Menambahkan Tab 4 System Log pada halaman RE campaigns
- Mengupdate instruksi model prompts agar visual mode hybrid_lock OPC mengunci seluruh klip dengan T2I + I2V
- Mengimplementasikan pre-rendering T2I JIT pada Fase 1 OPC untuk pre-generating start-frames

## V10.5.4 — OPC Campaign Database Migration for Bridging Duration (08/07/2026)
- Menambahkan safe database migration untuk kolom bridge_duration_clips pada tabel pillar_campaigns di SQLite
- Menghindari error saat pembuatan campaign OPC ketika posisi bridging produk tidak diaktifkan

## V10.5.3 — Gemini Integration for Product Bridging Duration in OPC & RE (08/07/2026)
- Mengintegrasikan parameter bridge_duration_clips ke dalam prompt Gemini AI pada model dekonstruksi RE dan OPC
- Menyempurnakan logika productEndClip dan sandwichReturnText saat bridge_duration_clips bernilai 0 (sisa seluruh klip)
- Memastikan pemetaan database dan API terintegrasi penuh untuk Durasi Bridging Produk (Klip)

## V10.5.2 — Product Bridging Duration Settings in OPC & RE (08/07/2026)
- Menambahkan konfigurasi Durasi Bridging Produk (Klip) pada Section 3 OPC Campaign
- Mengatur nilai default Durasi Bridging Produk (Klip) menjadi 1 klip untuk OPC Campaign
- Mengubah nilai default Durasi Bridging Produk (Klip) menjadi 1 klip untuk RE Campaign
- Melakukan pemetaan kolom db bridge_duration_clips untuk create & update campaign

## V10.5.1 — OPC UI Layout Refinement for Visual Settings (08/07/2026)
- Memindahkan input Jumlah Klip Video (N) dari Section 3 ke Section 2 (Aesthetics & Visual Settings)
- Mengubah tata letak UI Section 2 (Aesthetics) menjadi 1 kolom vertikal agar selaras dengan RE Campaign
- Menghapus input Jumlah Klip Video dari Section 3 dan menyesuaikan form-group transisi promosi

## V10.5.0 — Refinements OPC Mass Campaign & Google Sheets Sync (08/07/2026)
- Menambahkan penanganan OPC Mass Campaign jika Product Bridging tidak aktif (bridging_mode = 0)
- Menyimpan target_spreadsheet_id, nextcloud_parent_folder, dan fb_draft_mode pada API bulk creation
- Standardisasi format batch ID OPC: OPC-[campaignCode]-[dateStr]-[paddedIndex]
- Standardisasi penamaan folder Nextcloud/Drive dan file output hasil render
- Integrasi Google Sheets uploader untuk OPC (tab CAMPAIGN_OPC, Storyboard, Voiceover, Prompt, Caption)

## V10.4.4 — OPC Campaign Custom Instructions & Read-Only display (08/07/2026)
- Menambahkan input field **Custom Instruction (Opsional)** pada panel pembuatan kampanye OPC di bawah Basic Creative Strategy.
- Menampilkan instruksi khusus yang dideklarasikan oleh pengguna pada Fase 1 tab **Konsep Awal & Product** di halaman detail kampanye jika data tersebut tersedia.

## V10.4.3 — OPC Campaign Visual Style Dropdown & Prompt Tuning (08/07/2026)
- Menyelaraskan opsi dropdown **Visual Style** pada pembuatan OPC Campaign dengan RE Campaign (Cinematic, UGC, Macrophotography).
- Memperbarui sistem prompt (`buildOrganicPillarPrompt` di `lib/prompts.js`) untuk menyuntikkan instruksi gaya visual khusus secara dinamis berdasarkan opsi terpilih agar ditaati oleh Gemini AI.

## V10.4.2 — OPC Campaign Basic Settings 1-Column Layout (08/07/2026)
- Merestrukturasi antarmuka bagian **Basic Creative Strategy** pada form pembuatan OPC Campaign dari layout kolom ganda (grid flex) menjadi 1 kolom vertikal lurus untuk keselarasan dengan RE Campaign.

## V10.4.1 — OPC Campaign Creation Settings Refinement (08/07/2026)
- Menambahkan input field Google Spreadsheet ID opsional ke bagian Basic Settings pada form pembuatan OPC Campaign untuk integrasi tracking spreadsheet otomatis.
- Menghapus Accordion Section 5 (Workflow & Audio Settings) dari form pembuatan OPC Campaign, memindahkan konfigurasi workflow produksi sepenuhnya ke Fase 2 detail Workbench.

## V10.4.0 — Refactoring OPC Campaign ke Premium V2 Workbench (08/07/2026)
- Mengimplementasikan alur kerja **2-Phase Workflow** untuk **Organic Pillar Campaign (OPC)** secara penuh selaras dengan alur kerja RE Campaign.
- **Fase 1 (Asset & T2I Generation)**: Sourcing, Gemini storyboard plan, Video DNA metadata extraction, dan T2I start frame generation. Scheduler otomatis melakukan jeda (pause) setelah Fase 1 selesai.
- **Fase 2 (Production & Rendering)**: Integrasi generator TTS (MiniMax & Gemini), video generator G-Labs (Veo & Kling), serta FFmpeg muxing.
- **Antarmuka Premium V2 Workbench**: Menyediakan halaman detail Workbench dengan 4 tab interaktif (Konsep Awal & Produk, Storyboard & Rencana Visual + Social Captions, Video DNA, System Log).
- Menerapkan tombol persetujuan interaktif ("Approve & Proceed to Production"), regenerasi T2I per klip dan batch (Fase 1 start frame), Re-FFMPEG, serta draft penerbitan Facebook Page.

## V10.3.7 — Fallback Otomatis T2I G-Labs (08/07/2026)
- Menerapkan mekanisme fallback otomatis ke model `nano_banana_2` jika model utama `nano_banana_pro` mengalami error kuota harian habis (`Daily image quota exhausted`).
- Mengimplementasikan penanganan secara transparan (Transparent Interceptor) di dalam `lib/webhook-client.js` yang mendeteksi kegagalan kuota baik di fase submission (POST) maupun polling status (GET).
- Menghubungkan pelacakan tugas asli ke tugas baru melalui pemetaan memori sehingga transparan sepenuhnya bagi caller (scheduler, API adegan, dan UI).

## V10.3.6 — Pilihan Konfigurasi Pola T2I Webhook (08/07/2026)
- Menambahkan konfigurasi global `Pola T2I (Start Frame)` (pilihan Threading vs Sequential) pada halaman Settings untuk mengatur metode pengiriman prompt ke G-Labs saat kampanye pertama kali dijalankan.
- Mengintegrasikan logika T2I Threading (kirim sekuensial dengan jeda, pantau serentak) dan Sequential (kirim, tunggu selesai, jeda, ulangi) ke pemrosesan awal kampanye RE di `processReAnalyzer`.
- Menyeragamkan jeda aman pengiriman prompt menjadi 10-20 detik di antara setiap adegan/klip untuk kedua pola guna menghindari rate limit webhook.

## V10.3.5 — Regenerasi Start Frame Per Baris Kampanye (08/07/2026)
- Menambahkan kolom `regenerate_start_frames_status` dan `regenerate_start_frames_progress` ke `re_campaign_items` untuk melacak status dan progres regenerasi start frame per baris.
- Membuat endpoint API `POST /api/v2/re-campaigns/items/[itemId]/regenerate-start-frames` untuk menjalankan proses regenerasi start frame secara asinkron di latar belakang.
- Menerapkan jeda aman acak 10-20 detik di antara pengiriman prompt klip ke webhook G-Labs untuk menghindari penumpukan dan rate limit.
- Menambahkan tombol "Regenerate All Start Frames" di panel workspace storyboard yang di-expand, sejajar secara horizontal dengan judul Grid Preview.
- Mengintegrasikan progres real-time hasil polling 8 detik pada tombol tersebut.

## V10.3.4 — Added Dynamic Routes for Start Frames & Recipes Uploads (07/07/2026)
- Menambahkan route dinamis `/uploads/start_frames/[filename]` dan `/uploads/recipes/[filename]` untuk menyajikan berkas unggahan baru secara real-time dari disk tanpa tertahan oleh cache aset statis Next.js di mode produksi.

## V10.3.3 — Increased T2I Polling Timeout (07/07/2026)
- Meningkatkan batas maksimal polling (timeout) saat regenerasi gambar T2I dari 60 detik menjadi 150 detik (2.5 menit) untuk mencegah kegagalan unduhan jika antrean/pemrosesan G-Labs memerlukan waktu lebih lama.

## V10.3.2 — Added WSL SQLite Query Option to SOP (07/07/2026)
- Memperbarui panduan SOP inspeksi database produksi pada berkas `AGENTS.md` dengan menyertakan Metode 2: pemeriksaan/modifikasi langsung via utilitas `sqlite3` di dalam WSL remote (`Ubuntu-24.04`) sebagai opsi alternatif yang lebih cepat dan ringan daripada penyalinan `scp`.

## V10.3.1 — Fixed T2I Regenerate Race Condition (07/07/2026)
- Mengatasi masalah *race condition* (tabrakan tulis database) saat melakukan regenerasi T2I secara paralel pada klip storyboard yang berbeda.
- Membungkus proses pembacaan JSON dan penulisan status baru ke dalam transaksi SQLite (`db.transaction()`) yang dijalankan sesaat sebelum update dilakukan, mencegah data saling menimpa.

## V10.3.0 — Production Database Checking SOP (07/07/2026)
- Menambahkan dokumentasi Standar Operasional Prosedur (SOP) untuk melakukan inspeksi database produksi secara aman via SSH/Tailscale ke dalam berkas `AGENTS.md`.
- Panduan ini memastikan AI asisten berikutnya dapat langsung mengetahui cara pengetesan koneksi, penyalinan database ke lokal secara aman (`scp`), query data kampanye/item yang terhenti, dan pembersihan file sementara.

## V10.2.9 — RE Campaign V2.18: Separated T2I Start Frames Grid from Prompts (07/07/2026)
- Merestrukturasi antarmuka tab Storyboard di halaman detail RE Campaign.
- Memisahkan preview gambar hasil T2I ke dalam panel grid CSS khusus di bagian atas.
- Mengatur seluruh field input teks (VO Script, Visual Action, T2V, T2I, I2V) agar tersusun secara horizontal penuh (Full Width) tanpa kolom gambar di sampingnya untuk kenyamanan editing.

## V10.2.8 — RE Campaign V2.17: Autopilot Google Sheets Alignment (07/07/2026)
- Menyelaraskan alur penulisan Google Sheet RE Campaign dengan struktur Sheet Autopilot.
- Menulis metadata dan log pemrosesan ke tab CAMPAIGN_RE, mencocokkan URL source dan memperbarui baris pencocokan paling baru (terbawah).
- Menulis salinan storyboard, voiceover, prompt (tab singular), dan captions ke tab-tab terpisah yang terformat Bold dan Frozen Row 1.
- Memperbarui status Completed dan asset_url pada akhir tahapan FFmpeg.

## V10.2.7 — RE Campaign V2.16: Auto Campaign Resume on Retry/Reset (07/07/2026)
- Menambahkan auto-resume pada kampanye saat tombol Retry atau Reset diklik dengan mengatur status kampanye kembali ke 'running'. Hal ini memastikan scheduler langsung memproses adegan tanpa hambatan status 'completed' pada kampanye.

## V10.2.6 — RE Campaign V2.15: Mitigasi Retry & Reset Item Gagal (07/07/2026)
- Menambahkan tombol aksi 🔄 Retry dan 💥 Reset pada baris adegan yang gagal (failed) di tabel Daftar URL RE Campaign.
- Membuat fungsi retryReCampaignItem dan resetReCampaignItem di lib/db.js.
- Membuat endpoint POST /api/v2/re-campaigns/items/[itemId]/retry dan POST /api/v2/re-campaigns/items/[itemId]/reset.

## V10.2.5 — RE Campaign V2.14: Campaign Code in Batch ID (07/07/2026)
- Memperbarui pola pembentukan Batch ID menggunakan format baru `RE-[CampaignCode]-YYYYMMDD-XXX` untuk menjamin keunikan global antar kampanye berbeda pada hari yang sama.
- Memperbarui fungsi generateREBatchId di lib/export-builder.js serta pemanggilannya di lib/scheduler-processors.js untuk menyertakan campaignName.

## V10.2.4 — RE Campaign V2.13: Dedicated Status Column & Custom Label Mapping (07/07/2026)
- Menambahkan kolom Status terdedikasi di antara kolom URL dan Actions pada tabel Daftar URL RE Campaign.
- Merubah representasi status menjadi badge vertikal bertingkat yang rapi (misal: "Fase 1 : Downloading", "Fase 1 : AI Analyze", "Fase 1 : Generate Start Frame T2I").
- Menambahkan state status analyze_status untuk 'processing' (AI Analyze) dan 'generating_t2i' (Generate Start Frame T2I) pada lib/scheduler-processors.js.

## V10.2.3 — RE Campaign V2.12: Vertical UI Layout & Spreadsheet ID (07/07/2026)
- Desain ulang formulir Basic Creative Strategy (Fase 1) dan panel Workflow & Production Settings (Fase 2) menjadi 1 kolom vertikal demi kerapian visual.
- Menambahkan field Google Spreadsheet ID opsional pada pembuatan kampanye RE agar pengguna dapat menargetkan spreadsheet yang sudah ada.

## V10.2.2 — RE Campaign V2.11: Nextcloud Asset Upload Workflow (06/07/2026)
- Menambahkan workflow otomatis setelah proses FFmpeg rendering selesai pada RE Campaign untuk mengunggah naskah.md, video per klip, audio per klip, dan video final ke Nextcloud.
- Mengatur default folder induk target Nextcloud ke /MAKNA_Assets/MAKNA_Production_Final jika nextcloud_parent_folder tidak dikonfigurasi.

## V10.2.1 — RE Campaign V2.10: Migration sync_mode Database Column (06/07/2026)
- Menambahkan kolom sync_mode ke skema tabel re_campaigns dan membuat fungsi migrasi aman migrateReCampaignsSyncModeV1021 untuk menambahkan kolom tersebut secara otomatis di database SQLite pengguna.

## V10.2.0 — RE Campaign V2.9: Fix Approve & Proceed Features (06/07/2026)
- Memperbaiki kegagalan fungsional tombol Approve & Proceed dengan menambahkan unwrapping parameter itemId secara asinkron di route API (/api/v2/re-campaigns/items/[itemId]/approve) dan mengganti pemanggilan showToast yang tidak terdefinisi dengan alert di sisi client.

## V10.1.9 — RE Campaign V2.8: Structured Layer Format for T2I Prompts (06/07/2026)
- Menambahkan aturan dan panduan format terstruktur bertingkat (structured layer) 4-layer untuk prompt T2I (start frame) pada buildReverseEngineeringPrompt dan buildReverseEngineeringBridgePrompt.

## V10.1.8 — RE Campaign V2.7: Face Visibility Parity & 4-Segment I2V Micro Pacing (06/07/2026)
- Menambahkan seksi REGULASI VISUAL (FACE VISIBILITY) pada buildReverseEngineeringPrompt sehingga parameter konfigurasi Faceless (siku ke bawah) dipatuhi oleh Gemini AI saat merancang adegan/visual baru.
- Mengatur format i2v_prompt pada new_video_plan agar menggunakan struktur bertingkat (structured layer) dengan pembagian tepat 4 segmen micro-pacing (2 detik per segmen).

## V10.1.7 — RE Campaign V2.6: Batch T2I Task Submission & Conditional T2V UI (06/07/2026)
- Mengubah alur generasi T2I adegan pada Phase 1 scheduler (processReAnalyzer) agar menggunakan Batch Submission dengan jeda aman 10-15 detik, diikuti polling serentak dan pengunduhan massal (menghindari antrean sekuensial yang lambat).
- Menyembunyikan input prompt T2V pada panel detail adegan dan workbench kampanye RE jika prompt tersebut kosong demi kerapian visual.

## V10.1.6 — RE Campaign V2.5: Hide Phase 1 Workflow Toggles & Fix Regenerate T2I (06/07/2026)
- Menghapus Accordion Section 5 (Workflow & Audio Settings) dari formulir pembuatan kampanye (Fase 1) karena pengaturan workflow sepenuhnya dipindahkan ke Fase 2 per-item.
- Memperbaiki kegagalan fungsional regenerasi prompt T2I dengan menambahkan unwrapping parameter itemId secara asinkron di route API dan mengganti showToast yang tidak terdefinisi dengan alert di sisi client.

## V10.1.5 — RE Campaign V2.4: Simplified Actions Column in Items Table (06/07/2026)
- Menyederhanakan kolom "Actions" pada tabel daftar item kampanye RE agar hanya menampilkan tombol "Detail" / "Tutup" / "Workspace Angle" untuk ekspansi baris workbench.

## V10.1.4 — Bug Fix: Correct getSetting Import Path in Regenerate T2I Route (06/07/2026)
- Memperbaiki error impor modul pada endpoint `regenerate-t2i` (`Module not found: Can't resolve '../../../../../../../lib/settings'`) dengan memindahkan impor fungsi `getSetting` langsung dari `lib/db`.

## V10.1.3 — RE Campaign V2.3: Double-Pass Workflow & Custom Production Settings (06/07/2026)
- Memaksa workflow Double-Pass (T2I + I2V) untuk seluruh adegan di RE Campaign demi konsistensi visual. Prompt T2V ditiadakan.
- Phase 1 (`re_analyzer`): Mengirimkan prompt T2I ke G-Labs untuk memproduksi visual start frame statis secara otomatis untuk seluruh klip, lalu mengunduhnya ke basis data lokal dan menampilkannya di workbench. Prompt I2V ditahan untuk ditinjau pengguna terlebih dahulu.
- Phase 2 (G-Labs Video Rendering): Memproses gambar start frame T2I lokal bersama dengan `i2v_prompt` ke G-Labs hanya setelah pengguna meninjau dan menyetujuinya.
- Menyediakan panel kustomisasi setelan produksi TTS (Voice provider, persona, speed, volume) dan FFmpeg (video scale, sfx, bgm, sync options) langsung di dalam workbench detail baris kampanye.
- Menambahkan tombol "Salin" (Copy) instan dengan feedback visual "Disalin!" di seluruh input teks prompt dan naskah voiceover pada detail adegan.
- Menampilkan tombol "🔄 Regenerate T2I" untuk seluruh adegan tanpa batasan visual mode kampanye.

## V10.1.2 — RE Campaign V2.2: Prompt Visibility & Table Layout Simplification (06/07/2026)
- Menampilkan seluruh kolom input prompt visual (T2V, T2I, dan I2V) secara serentak untuk setiap klip storyboard di panel detail workbench, terlepas dari konfigurasi visual mode kampanye.
- Menyederhanakan layout tabel daftar URL kampanye dengan menghapus kolom "Pipeline Status" agar tabel utama terlihat bersih.
- Memindahkan visualisasi status rendering pipa produksi (Scraped, Analyzed, TTS, dll) ke bagian paling atas panel detail baris kampanye yang di-expand.

## V10.1.1 — Gemini 3.5 Flash Model Integration & Fallbacks (06/07/2026)
- Mengintegrasikan pemrosesan model default `gemini-3.5-flash` dengan konfigurasi fallback dinamis ke `gemini-2.5-flash` (dan kemudian `gemini-flash-latest`) untuk mengantisipasi error/pengecualian model tidak ditemukan.
- Memperluas deteksi penanganan kesalahan model di `makeModelResilient` dan `executeContentGeneration` agar langsung memicu fallback saat ada error API apa pun (seperti model not found/404 atau 400).

## V10.1.0 — RE Campaign V2.1: Tabbed UI & Non-Blocking Item Discovery (06/07/2026)
- Merombak halaman detail kampanye RE menjadi antarmuka 3 tab vertikal penuh: Tab 1 Dekonstruksi Asli (tabel inline), Tab 2 Storyboard & Rencana Baru (1 kolom vertikal per klip dengan gambar & input teks), Tab 3 Video DNA (10 input teks murni, tanpa select dropdown).
- Menambahkan parameter `"visual_action"` di dalam prompt Gemini AI pada objek `new_video_plan` untuk menghasilkan representasi teks deskripsi aksi visual baru dalam Bahasa Indonesia.
- Mengubah looping scheduler kampanye RE (`tickCampaignScheduler`) menjadi *non-blocking* sehingga penangguhan status tinjauan (`ready_for_review`) pada item pertama tidak menghambat pemrosesan Discovery (scrape & analyze) pada item-item berikutnya dalam kampanye yang sama.
- Memperbarui API persetujuan (`/approve`) dan scheduler processors untuk memetakan `visual_action` ke visual description demi kompatibilitas format V1.

## V10.0.2 — RE Campaign detail view rendering fallback hotfix (06/07/2026)
- Menambahkan *guard check* pada kolom `new_video_plan_json` di halaman detail RE. Jika kosong (misalnya pada item V1 lama atau yang diproses scheduler in-memory lama), halaman secara otomatis jatuh (*fallback*) menampilkan data detail V1 (`renderOriginalDetails`) alih-alih menampilkan editor workbench kosong.
- Mengupdate dokumentasi SOT global architecture dan menu RE campaign.
- Menghapus berkas cetak biru usang.

## V10.0.0 — RE Campaign V2: Human-in-the-Loop & Video DNA (06/07/2026)
- Merombak total alur kerja Reverse Engineering (RE) Campaign menjadi 3 fase: Discovery (Otomatis) ➔ Review & Edit (Manusia) ➔ Production (Otomatis).
- Menambahkan kolom database baru pada `re_campaign_items` untuk `original_deconstruction_json`, `new_video_plan_json`, `video_dna_json`, `t2i_images_json`, dan `workflow_status`.
- Memperbarui prompt AI rekayasa di `lib/prompts.js` agar menghasilkan data terstruktur baru dengan naskah VO, prompt gambar T2I, prompt gerak I2V, dan metrik Video DNA (10 parameter penting).
- Menambahkan pengunduhan otomatis start-frame gambar T2I pada Fase 1 Discovery, menyimpannya secara lokal, dan mengabaikan render T2I di Fase 3 Production jika file lokal telah ada.
- Menambahkan jeda scheduler otomatis pada status `ready_for_review` sebelum masuk ke tahap TTS.
- Membuat dua API endpoint baru: `/api/v2/re-campaigns/items/[itemId]/approve` untuk persetujuan manual, dan `/api/v2/re-campaigns/items/[itemId]/regenerate-t2i` untuk regenerasi gambar per klip.
- Mengembangkan antarmuka Workbench Editor premium di halaman detail RE Campaign yang merinci Video DNA, modal popup dekonstruksi kompetitor asli, storyboard card grid interaktif dengan teks yang dapat diedit, regenerasi visual, dan toggle switch/slider untuk TTS, G-Labs, dan FFmpeg.
- Mematikan polling interval asinkron pada halaman detail saat item kampanye sedang dalam tahap review guna mencegah terjadinya timpaan teks saat pengguna mengetik.

## V9.7.25 — Fix Invalid Playwright browser.disconnect Call (05/07/2026)
- Menghapus pemanggilan `browser.disconnect()` pada Playwright CDP connection karena method tersebut tidak terdefinisi di Playwright (`Browser` hanya memiliki `close()`).
- Mencegah timbulnya error "browser.disconnect is not a function" saat melakukan test koneksi dan scraping produk.

## V9.7.24 — Cross-Platform Path Separator Normalization for Products & Campaigns (05/07/2026)
- Menormalisasi pemisah path file gambar/video produk dan kampanye menjadi forward slash `/` saat ekspor untuk menjamin kompatibilitas standar format ZIP.
- Memperbarui sistem impor produk dan kampanye agar mengekstrak seluruh aset dalam ZIP di bawah folder `assets/` secara slash-agnostic (mendukung `/` dan `\`) ke filesystem lokal.
- Menormalisasi semua path file yang diimpor ke format forward slash `/` sebelum disimpan ke database SQLite untuk menghindari broken links di browser Windows dan WSL 2.

## V9.7.23 — Auto-Probe Windows Host IP in WSL2 Bridged/NAT Mode (05/07/2026)
- Menambahkan sequential TCP socket probing (dengan timeout 250ms) pada candidates host (`127.0.0.1`, IP gateway default, dan semua IP Windows host yang ditarik via PowerShell interop).
- Mengatasi error ECONNREFUSED di lingkungan WSL2 mode bridged di mana gateway default merujuk ke router fisik (192.168.x.1) bukannya Windows Host (192.168.x.xxx).
- Memperbarui integrasi pemanggilan `getCDPEndpoint` menjadi asynchronous (`await`) pada modul scraper utama dan endpoint tes koneksi.

## V9.7.22 — Auto-Detect Windows Host IP in WSL2 for CDP Scraper (05/07/2026)
- Menambahkan deteksi otomatis lingkungan WSL2 di backend (`lib/cdp-helper.js`) yang secara dinamis mengambil IP gateway Windows Host jika dijalankan di dalam WSL2.
- Menambahkan petunjuk UI di menu Settings tentang cara mengkonfigurasi `netsh interface portproxy` pada Windows Command Prompt untuk mengaktifkan port forwarding WSL2.

## V9.7.21 — Fix Chrome Shutdown Bug on CDP Connection Test (05/07/2026)
- Memperbaiki bug kritis di mana pengujian koneksi CDP (`test-cdp`) memanggil `browser.close()` yang mengakibatkan browser Google Chrome asli pengguna ditutup secara paksa.
- Mengubah pemanggilan `browser.close()` menjadi `browser.disconnect()` pada modul uji koneksi dan scraper utama agar hanya memutus koneksi client tanpa mematikan browser Chrome asli.

## V9.7.20 — Multi-OS Debug Commands for CDP Scraper UI (05/07/2026)
- Menambahkan instruksi dan perintah debugging untuk multi-OS (macOS, Windows, Linux) pada menu Pengaturan CDP.
- Mempermudah penyiapan Chrome remote debugging port di server produksi Linux (Headless VPS) maupun mesin Windows.

## V9.7.19 — Dynamic Chrome Profile Configuration for Scraper (05/07/2026)
- Menambahkan input field konfigurasi baru "Nama Folder Profil Chrome" di UI Pengaturan yang disimpan ke database settings sebagai `scraper_chrome_profile`.
- Memungkinkan penyesuaian profil Chrome secara dinamis untuk memudahkan deployment di server produksi atau mesin tim lainnya yang menggunakan struktur nama profil berbeda (misal Default, Profile 1, Profile 22).
- Petunjuk instruksi perintah Terminal sekarang merujuk secara dinamis ke profil yang dikonfigurasi.

## V9.7.18 — UX Refinement for CDP Chrome Connection UI (05/07/2026)
- Menyembunyikan status kartu koneksi manual (Shopee/Tokopedia Session) ketika opsi CDP aktif.
- Mencegah pengguna dari kekeliruan menekan tombol "Hubungkan" manual yang meluncurkan peramban Playwright bersih (bukan Chrome asli).

## V9.7.17 — Google Chrome CDP Connection Scraper Integration (05/07/2026)
- Mengintegrasikan opsi koneksi CDP (Chrome DevTools Protocol) pada Playwright Scraper.
- Memungkinkan Maknagen terhubung langsung dan mengendalikan peramban Google Chrome asli pengguna (pada port remote debugging 9222 dengan profil Profile 22 / Qowiem29) untuk melewati deteksi bot Shopee/Tokopedia 100% tanpa Captcha.
- Menambahkan menu pengujian koneksi "Test Chrome Connection" dan instruksi lengkap terminal pada halaman Pengaturan Maknagen.

## V9.7.16 — Add Gemini Search Grounding Fallback to E-Commerce Scraper (05/07/2026)
- Menambahkan fallback AI otomatis menggunakan Google Search Grounding (Gemini 2.0 Flash) pada modul `lib/url-scraper.js`.
- Ketika peramban Playwright diblokir oleh Captcha / anti-bot marketplace (seperti shopee verify/captcha), sistem akan secara otomatis beralih mencari info produk, deskripsi, harga, dan gambar dari indeks pencarian Google secara instan tanpa menghentikan antrean scraping massal.

## V9.7.15 — Fix Scraper Session API URL Path Mismatch (05/07/2026)
- Memperbaiki URL pemanggilan API pada connectPlatform di halaman Pengaturan dari `/api/scraper/session/login` menjadi `/api/scraper/session` agar sesuai dengan rute backend Next.js.
- Menyelesaikan error "Unexpected token <" yang disebabkan oleh respons 404 HTML.

## V9.7.14 — Marketplace Scraper Persistent Session Integration (05/07/2026)
- Mengintegrasikan Persistent Browser Profile pada Playwright untuk scraper Shopee dan Tokopedia.
- Menambahkan menu pengaturan baru di UI ("Marketplace Scraper Settings") untuk mengoneksikan akun Shopee/Tokopedia secara manual hanya sekali saja.
- Menyimpan data sesi login secara lokal di folder data/playwright_profile agar scraping massal berikutnya dapat berjalan otomatis 100% di latar belakang (headless mode) tanpa terhambat Captcha.

## V9.7.13 — Bypass Anti-Bot / Login Wall Shopee Manual (05/07/2026)
- Menambahkan deteksi otomatis halaman blokir anti-bot (verify/traffic/error) dan login wall pada Playwright scraper.
- Mengaktifkan fitur polling penundaan (selama 90 detik) di mode headful peramban, membiarkan jendela peramban tetap terbuka agar pengguna lokal dapat menyelesaikan captcha atau login secara manual sebelum melanjutkan pengikisan data secara otomatis.
- Mencegah penutupan instan jendela peramban ketika terjadi pemblokiran lalu lintas di platform Shopee.

## V9.7.12 — Fitur Safety Delay Webhook G-Labs & Settings UI (05/07/2026)
- Menambahkan fitur safety delay (pacing prompt) secara acak pada webhook client sebelum dikirimkan ke G-Labs Automation guna mencegah rate limit Google Flow.
- Menyediakan opsi konfigurasi delay (Enabled, Min Delay, Max Delay) di database settings via API.
- Mengintegrasikan toggle safety delay dan input parameter durasi minimum/maksimum pada UI Settings.

## V9.7.11 — Optimasi Preset FFmpeg CapCut-like (05/07/2026)
- Meningkatkan kualitas encoding video di `lib/video-studio-processor.js` dengan opsi preset `slow`, `crf 18`, profile `high` level `4.1`, frame rate `30fps`, gop size `60`, audio bitrate `192k`, sample rate `48000Hz`, dan flags `faststart` (CapCut-like preset).
- Memindahkan dokumen referensi preset ke `sot/global/FFmpeg_Preset_Facebook_Reels_CapCut_Like.md`.

## V9.7.10 — Penyelarasan Global Aturan Visual Faceless (05/07/2026)
- Menyelaraskan batasan visual Faceless (siku ke bawah, forearm & hand close-up) secara global di seluruh menu dan tipe kampanye (OPC, RE, Recipe Labs, dan Sheets Autopilot).
- Memperbarui presets demografi, konsep karakter, dan prompt builders di `lib/prompts.js` dengan melarang leher, dada, bahu, dan kepala.
- Memperbarui visual scenario dan veo_prompt untuk Module C (Process) di `lib/culinary-sequence-engine.js` agar memperbolehkan interaksi tangan dengan batasan Faceless (siku ke bawah).
- Memperbarui resep statis di `lib/scheduler-processors.js` untuk mengganti guardrail NO HUMANS dengan batasan Faceless (siku ke bawah).
- Memperbarui worker autopilot di `lib/sheets-autopilot-worker.js`.
- Menyelaraskan spesifikasi VSO Blueprint di `sot/global/vso-engine.md` dan Food Styling KB di `kb-seeds/Food Styling & Photography KB.md`.

## V9.7.8 — Penyelarasan Alur Kerja & Opsi Sinkronisasi Video/Audio Recipe Labs (04/07/2026)
- Menambahkan opsi konfigurasi kustom dan "Auto-Pilot Smart Sync" pada opsi FFmpeg Smart Sync di formulir pembuatan video resep.
- Menambahkan parameter range slider untuk tingkat zoom visual (Video Scale), SFX Volume, dan BGM Volume yang tersimpan dalam `config_json` kampanye.
- Menata ulang urutan langkah alur kerja (workflow) pada Accordion Section 5 Recipe Labs agar selaras dengan menu OPC: TTS (Voiceover) ➔ G-Labs Video ➔ FFmpeg Smart Sync ➔ Facebook Draft.

## V9.7.7 — Pembaruan Dokumen SOT (Source of Truth) dengan Spesifikasi Skeduler Baru (04/07/2026)
- Memperbarui berkas spesifikasi `sot/menus/recipe-labs.md` untuk merekam arsitektur skeduler in-memory lokal baru, skema database SQLite (kolom `local_scheduler`), tombol status Start/Stop, dan panel terminal SYSTEM POLLER LOGGER.
- Memperbarui berkas arsitektur global `sot/global/architecture.md` untuk menyesuaikan pemisahan peran skeduler in-memory (RE, OPC, Sheets Autopilot, Recipe Labs) yang secara bawaan nonaktif (default inactive) dan menghapus pemetaan route halaman `/scheduler`.

## V9.7.6 — Desentralisasi Skeduler Lokal & Poller Logger Recipe Labs (04/07/2026)
- Memindahkan sistem pemrosesan kampanye Recipe Labs dari Global Queue Scheduler V4 ke Campaign Local Scheduler (`lib/campaign-scheduler.js`) in-memory.
- Menambahkan tombol global "START/STOP SKEDULER" dan panel console "SYSTEM POLLER LOGGER" di halaman Recipe Labs untuk memantau progress pemrosesan secara langsung.
- Mengatur seluruh tipe skeduler lokal (RE, OPC, Sheets Autopilot, Multiplier, dan Recipe Labs) agar secara bawaan tidak aktif (default: inactive/OFF) saat aplikasi booting, guna menghemat daya pemrosesan CPU dan membersihkan log latar belakang.
- Menghapus halaman menu dashboard Scheduler V4 (`/scheduler`) beserta navigasinya di Sidebar kiri dan tautan monitoring di halaman System Health.

## V9.7.5 — Pembersihan & Penonaktifan Auto-Scheduling Antrean Kampanye (04/07/2026)
- Menonaktifkan pembuatan otomatis pekerjaan latar belakang (auto-scheduling) pada Global Scheduler V4 untuk antrean `re_`, `pillar_` (OPC), dan `glabs_campaign` karena pemrosesan kampanye sudah ditangani secara lokal oleh `campaign-scheduler.js`.
- Memperbarui `DEFAULT_CONFIGS` di `lib/db.js` agar secara bawaan antrean kampanye dinonaktifkan (`is_enabled: 0`) dan diset ke mode `'manual'`.
- Menambahkan prosedur migrasi boot untuk mereset tabel `scheduler_config` ke manual, membersihkan puluhan ribu catatan pekerjaan historis kosong tanpa payload dari `scheduler_jobs` (mengurangi bloat ukuran file DB), serta menjalankan perintah `VACUUM` secara otomatis.

## V9.7.4 — Optimasi Dev File Watcher & Konfigurasi Next.js (04/07/2026)
- Menghapus opsi experimental yang tidak terpakai dan menambahkan blok konfig `turbopack` di `next.config.mjs` untuk kompatibilitas build Next.js 16.
- Menambahkan aturan `watchOptions.ignored` pada konfigurasi Webpack dev server untuk mengabaikan file log di `public/*.txt`/`public/*.log` dan SQLite di `data/` demi menghindari CPU watcher loop (100%+ CPU) akibat penulisan log latar belakang.

## V9.7.3 — Default Tanpa Brand Profile di UI Recipe Labs (04/07/2026)
- Menonaktifkan pemilihan otomatis Brand Profile saat pertama kali memuat list pada form pembuatan kampanye Recipe Labs.
- Menetapkan opsi default untuk Brand Profile DNA Kuliner ke "Tanpa Brand Profile" (Default).

## V9.7.2 — Penyelarasan UI Recipe Labs dengan Standar OPC (04/07/2026)
- Menyematkan field input Parent Folder Nextcloud di accordion Basic Creative Strategy.
- Mengadopsi desain & logika visual lengkap opsi Visual Swap Overrides (VSO) dari OPC.
- Mengubah penanganan Text-to-Speech (TTS Voice) agar dinamis menggunakan model selector MiniMax & Gemini, range slider untuk kecepatan & volume, serta opsi model quality.
- Mengintegrasikan draf postingan Facebook Page lengkap dengan domain server publik publik asinkron seperti pada konfigurasi OPC.

## V9.7.1 — Penyelarasan Kolom Vertikal UI Recipe Labs (04/07/2026)
- Menata ulang layout form input di seluruh 5 accordion konfigurasi video Reels menjadi satu kolom vertikal penuh agar lebih rapi dan scannable.
- Mengubah elemen flex-wrap baris ganda menjadi struktur flex-direction column tunggal.

## V9.7.0 — Revamp UI Recipe Labs & Google Sheets Exporter (04/07/2026)
- Desain ulang form pembuatan kampanye Recipe Labs mengadopsi selektor kartu dan 5 panel accordion konfigurasi OPC lengkap.
- Integrasi Google Sheets Multi-Tab asinkron untuk menyimpan storyboard, voiceover, prompts, captions, dan Video DNA.
- Penyempurnaan culinary prompt builder dengan penegakan aturan temporal klip video (Hook 4s model omni_flash, klip lainnya 8s model veo_31_lite).
- Penambahan kolom spreadsheet_id dan config_json ke skema database SQLite.

## V9.6.0 — Konfigurasi & Pintasan Folder Nextcloud RE/OPC (03/07/2026)
- Menambahkan kustomisasi input Parent Folder Nextcloud di accordion Basic Creative Strategy pada pembuatan & salin kampanye RE dan OPC.
- Menambahkan tombol pintas '☁️ NextCloud' bergaya glassmorphic biru di setiap baris tabel detail kampanye untuk langsung membuka folder aset kampanye di Nextcloud.
- Memperbarui scheduler processors agar otomatis mengunggah video, audio, dan markdown ke folder Nextcloud kustom per kampanye.

## V9.5.2 — Perbaikan FB Draft & Polling G-Labs (03/07/2026)
- Memperbaiki integrasi Facebook Page dan bug polling visual task G-Labs yang macet


## V9.5.1 — Perbaikan Error Koneksi Facebook Page (02/07/2026)
- Menghapus field 'category' dari query endpoint /me untuk mencegah error (#100) saat melakukan tes koneksi menggunakan User Access Token.
- Menambahkan fallback pembacaan manual fb_page_ids di Settings pada fungsi pengujian koneksi.

## V9.5.0 — Pemisahan Skeduler Lokal & Autopilot Penuh RE/OPC (02/07/2026)
- Mengisolasi keaktifan skeduler RE Campaigns dan Organic Pillar Campaigns (OPC) agar berdiri sendiri secara lokal menggunakan setting tersendiri, terpisah dari Skeduler Global.
- Menambahkan API endpoint kontrol lokal untuk RE dan OPC scheduler-control.
- Menghapus panel kontrol "Testing Mode (Local Scheduler)" dan dropdown "Pause Point" pada halaman detail kampanye RE dan OPC.
- Menghapus tombol resume/lanjutkan manual pada detail kampanye sehingga berjalan sepenuhnya autopilot.
- Mempercepat frekuensi polling log terminal dari 5 detik menjadi 3 detik untuk penyelarasan dengan Sheets Autopilot.

## V9.4.0 — Facebook Page Draft Integration & Manual Bypass (02/07/2026)
- Mengubah sakelar publish draft menjadi khusus Facebook Page Draft (Draft ke Facebook).
- Menghapus kewajiban input Facebook Page ID pada Pengaturan Global.
- Menambahkan input opsional 'Facebook Page IDs (Pisahkan dengan koma)' sebagai bypass aman jika Meta API /me/accounts mengembalikan data kosong pada App Development Mode.
- Memilih target Halaman Facebook langsung pada panel pembuatan/copy kampanye RE dan OPC secara dinamis.
- Mengirimkan draf dalam mode Caption-only secara otomatis jika TTS/G-Labs dinonaktifkan pada server pengembangan.
- Memperbaiki scheduler database monitor agar tetap menunggu langkah posting sosial selesai sebelum menandai kampanye rampung.

## V9.3.2 — Integrasi Dinamis KB Food Styling (01/07/2026)
- Mengimplementasikan fungsi helper isFoodOrDrink untuk mendeteksi kata kunci makanan/minuman pada produk dan campaign secara otomatis.
- Menyuntikkan Food Styling & Photography KB secara dinamis pada 8 modul pembangun prompt ketika konten kuliner terdeteksi.
- Menambahkan Food Styling & Photography KB.md ke urutan kompilasi cache master guna menjaga kecocokan caching context paid tier.

## V9.3.1 — Penyempurnaan UI VSO & Sinkronisasi Mandate 67 (01/07/2026)
- Mengimplementasikan logic auto-select Konsep Karakter (Framing) otomatis ke 3D Stylized Claymation ketika subjek 3D dipilih di seluruh halaman UI.
- Memperbarui batas sensor visual Mandate 67 SYARIAT di seluruh file KB seeds, worker backend, dan prompts dari bahu ke bawah menjadi dada/siku ke bawah.
- Mengintegrasikan helper getConceptInstruction di prompts engine untuk mentranslasikan opsi 3D menjadi instruksi visual claymation tanpa wajah yang utuh.

## V9.3.0 — Preset Karakter Kartun 3D Stylized & Harmoni Pakaian Duo (01/07/2026)
- Menambahkan demografi subjek kartun 3D Stylized (Muslimah, Pria, dan Duo dalam satu scene).
- Mengimplementasikan 5 tema harmoni pakaian terkoordinasi untuk subjek duo dan pakaian variasi pria.
- Mengintegrasikan filter pakaian dinamis di antarmuka UI RE Campaigns, Multiplier Lab, Organic Pillar, dan Sheets Autopilot.

## V9.2.2 — Peningkatan Preset VSO & Pria Kaukasia (01/07/2026)
- Menambahkan demografi subjek baru Pria Kaukasia dengan preset pakaian formal hingga kasual.
- Menyempurnakan preset Wanita Gamis Syar'iy untuk memperketat framing strictly faceless (potong wajah, fokus tangan).
- Mengimplementasikan pemfilteran wardrobe dinamis di UI berdasarkan jenis demografi subjek.

## V9.2.1 — Relokasi Cetak Biru Visual Swap Override (VSO) (01/07/2026)
- Memindahkan cetak biru Visual Swap Override (VSO) dari direktori brainstorming ke sot/global/vso-engine.md.
- Memverifikasi detail 7 preset estetika VSO agar selaras dengan file prompts.js.

## V9.2.0 — Kontroler Versi & Lini Masa Git (01/07/2026)
- Membangun kontroler versi terintegrasi langsung pada dasbor System Health.
- Menambahkan lini masa commit Git real-time yang dieksekusi secara dinamis di server.
- Menyediakan asisten rilis otomatis dengan perintah npm run release.

## V9.1.0 — Perapihan Folder SOT
- Merapikan berkas-berkas blueprint yang berserakan ke dalam struktur direktori `sot/`.
- Memperbaiki pemetaan skema database untuk semua tabel kampanye modern dalam cetak biru arsitektur utama.
- Menstandardisasi spesifikasi Facebook Graph API agar selaras dengan sistem posting draf berbasis pengaturan.

## V9.0.0 — Perilisan Modul Recipe Labs
- Mengintegrasikan alur pembuatan resep teks & gambar menggunakan Gemini dan G-Labs.
- Menambahkan pembuatan kolase gambar 2x2 menggunakan pustaka Sharp.
- Menambahkan integrasi ekspor dan pembuatan Nextcloud Public Share Link untuk akses eksternal media.
