# MAKNA ENGINE — Architecture Blueprint

> **Version**: v10.20.18 | **Last Updated**: 2026-07-19 | **Status**: Active Production

---

## 1. Tech Stack & Environment

### Frontend
| Layer | Technology | Version |
|---|---|---|
| Framework | **Next.js** (App Router) | `16.2.5` |
| UI Library | **React** | `19.2.4` |
| Rendering | **Client Components** (`'use client'`) + Server Components | — |
| Routing | Next.js App Router (file-system based) | — |
| Styling | Vanilla CSS (`globals.css`) — single global stylesheet | — |
| Font | Google Fonts: **Inter** (sans-serif) + **JetBrains Mono** (monospace) | — |
| State Management | **React `useState` / `useEffect`** (local, no global store) | — |

### Backend
| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js (Next.js Server) | via Next.js |
| API Layer | Next.js **Route Handlers** (`app/api/**/route.js`) | — |
| AI Engine | **Google Gemini** (`@google/generative-ai`) | `^0.24.1` |
| Job Queue / Scheduler | Custom SQLite-backed **Scheduler V4** (20+ queues) | — |
| Background Daemons | `instrumentation.js` — auto-boots on server start | — |
| Media Processing | **FFmpeg** (`fluent-ffmpeg`) + `ffprobe-static` | `^2.1.3` |
| TTS | Gemini TTS (`gemini-8s-tts.js`) + MiniMax TTS (`minimax-tts.js`) | — |
| Web Scraping | **Playwright** | `^1.60.0` |
| Cloud Storage | **Google Drive API** (`googleapis`) + **Nextcloud / WebDAV** (`webdav`) | — |
| Image Processing | **Sharp** + `@imgly/background-removal-node` | `^0.35.2` |
| Archive | `archiver` + `adm-zip` | — |
| Spreadsheet | **Google Sheets API** + `xlsx` | — |

### Database
| Layer | Technology | Version |
|---|---|---|
| Engine | **SQLite** (file-based) via `better-sqlite3` | `^12.9.0` |
| DB File | `data/makna.db` (runtime) | — |
| ORM / Query | Raw SQL — no ORM; thin wrapper in `lib/db.js` | — |
| Migration Strategy | **Safe ALTER TABLE** migrations at startup via `initSchema()` | — |
| Pragma | `journal_mode = TRUNCATE` · `foreign_keys = ON` | — |

### Environment Variables (`.env.local`)
```
MAKNA_SCHEDULER=1          # Auto-start Scheduler V4 on boot
GEMINI_API_KEY=...         # (also stored in DB settings table)
```

---

## 2. Project Structure

```
_maknagen/
│
├── app/                          # Next.js App Router root
│   ├── layout.js                 # Root HTML shell, imports globals.css
│   ├── page.js                   # Dashboard (/) — stats + quick start
│   ├── globals.css               # SINGLE global CSS file (design system)
│   │
│   ├── components/
│   │   └── Sidebar.js            # Global navigation sidebar (Client Component)
│   │
│   │   # === WORKFLOW MODULES ===
│   ├── instant-factory/          # 1-Stage Instant Campaign
│   ├── re-campaigns/             # RE (Reverse-Engineer) Campaigns
│   ├── pillar-campaigns/         # Organic Pillar Content Campaigns
│   ├── products/                 # Product Database (CRUD + scraper)
│   ├── deconstruct/              # Deconstruct Lab (Discovery Engine)
│   ├── multiplier-lab/           # Multiplier Lab (angle variants)
│   ├── glabs-campaigns/          # Google Labs Batch Campaigns
│   ├── sheets-autopilot/         # Sheets-driven autopilot campaigns
│   │
│   │   # === TOOL MODULES ===
│   ├── video-studio/             # FFmpeg Studio (standalone jobs)
│   ├── tts-studio/               # TTS batch generation studio
│   ├── scraper/                  # Video Library (download/manage)
│   ├── sync/                     # MAKNA Hub Sync (cloud sync)
│   ├── re-plus-recomm/           # RE + Recommendation Engine
│   │
│   │   # === SYSTEM MODULES ===
│   ├── settings/
│   │   ├── page.js               # Global settings (API keys, KB)
│   │   └── brand-profiles/       # Brand DNA management
│   ├── system-health/            # System audit & health dashboard
│   ├── reports/                  # Analytics & reporting
│   │
│   └── api/                      # API Route Handlers
│       ├── stats/                # Dashboard stats
│       ├── kb/                   # Knowledge Base CRUD
│       ├── ideas/                # Ideation engine
│       ├── assets/               # Asset generation
│       ├── pipeline-v54/         # 5-Stage AI pipeline
│       ├── settings/             # Settings CRUD
│       ├── reverse/              # RE analysis
│       ├── scraper/              # Web scraper
│       ├── scheduler/            # Scheduler control
│       ├── reports/              # Report generation
│       ├── export/               # Export builder
│       ├── drive/                # Google Drive API
│       ├── sync/                 # Cloud sync
│       ├── google/               # Google OAuth helpers
│       ├── tts-studio/           # TTS Studio API
│       ├── video-studio/         # Video Studio API
│       ├── sheets-autopilot/     # Sheets Autopilot API
│       ├── production/           # Production assets API
│       ├── automation/           # Automation helpers
│       ├── campaign-portability/ # Import/Export campaigns
│       ├── webhook/              # Outbound webhook client
│       └── v2/                   # v2 API namespace
│           ├── products/         # Product CRUD v2
│           ├── deconstruct/      # Deconstruct Lab API
│           ├── multiplier/       # Multiplier Lab API
│           ├── re-campaigns/     # RE Campaigns API v2
│           ├── pillar-campaigns/ # Pillar Campaigns API v2
│           ├── instant-factory/  # Instant Factory API v2
│           ├── glabs-campaigns/  # G Labs API v2
│           ├── re-plus-recomm/   # RE Plus Recomm API v2
│           ├── brand-profiles/   # Brand DNA API v2
│           └── system-health/    # System Health API v2
│
├── lib/                          # Server-side utilities & workers
│   ├── db.js                     # SQLite singleton + full schema init
│   ├── gemini.js                 # Gemini AI client (resilient, multi-key)
│   ├── prompts.js                # All prompt templates (~103KB)
│   ├── scheduler.js              # Scheduler V4 engine (queue runner)
│   ├── scheduler-processors.js   # All queue job processors (~274KB)
│   ├── campaign-scheduler.js     # Campaign-level local scheduler
│   ├── cloud-sync-scheduler.js   # Cloud hub sync daemon
│   ├── sheets-autopilot-worker.js # Sheets campaign worker
│   ├── re-multiplier-worker.js   # Multiplier Lab worker
│   ├── re-recomm-engine.js       # Recommendation engine
│   ├── export-builder.js         # Export/ZIP builder
│   ├── drive-uploader.js         # Google Drive uploader
│   ├── drive-sync-helper.js      # Drive sync utilities
│   ├── nextcloud-helper.js       # Nextcloud WebDAV helpers
│   ├── nextcloud-sync-helper.js  # Nextcloud sync daemon helper
│   ├── smart-sync-engine.js      # Intelligent sync engine
│   ├── playwright-scraper.js     # Playwright video scraper
│   ├── url-scraper.js            # URL content scraper
│   ├── video-downloader.js       # Video download utility
│   ├── video-studio-processor.js # FFmpeg processing logic
│   ├── gemini-8s-tts.js          # Gemini TTS (8s chunks)
│   ├── minimax-tts.js            # MiniMax TTS client
│   ├── voice-personas.js         # Voice persona catalog
│   ├── audio-helper.js           # Audio processing utils
│   ├── bg-remover.js             # Background removal
│   ├── google-auth.js            # Google OAuth2 client
│   ├── kb-stitcher.js            # Knowledge Base assembler
│   ├── json-parser.js            # Resilient JSON parser
│   ├── error-logger.js           # System audit logger
│   └── webhook-client.js         # Outbound webhook sender
│
├── data/                         # Runtime data directory
│   └── makna.db                  # Primary SQLite database
│
├── public/                       # Static assets
├── kb-seeds/                     # Seed knowledge base files (.md)
├── brainstorming/                # Internal notes & docs
├── instrumentation.js            # Next.js server boot hooks
├── next.config.mjs               # Next.js config (serverExternalPackages)
├── jsconfig.json                 # JS path aliases
└── package.json                  # Dependencies & scripts
```

---

## 3. Core Architecture & Routing

### 3.1 Application Layout Pattern

Every page follows a **consistent two-panel layout**:

```
┌──────────────────────────────────────────────────────────────┐
│  .app-layout  (display: flex; height: 100vh)                 │
│                                                              │
│  ┌─────────────┐  ┌───────────────────────────────────────┐ │
│  │  <Sidebar>  │  │  <main class="main-content">          │ │
│  │  (fixed     │  │  (margin-left: 260px; overflow-y auto)│ │
│  │   260px)    │  │                                       │ │
│  │             │  │  .page-container (max-width: 1200px)  │ │
│  │             │  │  └── .page-header                     │ │
│  │             │  │  └── [page content]                   │ │
│  └─────────────┘  └───────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

> **Note:** Every `page.js` manually imports and renders `<Sidebar />` — there is **no nested layout** wrapping modules.

### 3.2 Routing Map

| URL Path | Page File | Description |
|---|---|---|
| `/` | `app/page.js` | Dashboard & stats |
| `/instant-factory` | `app/instant-factory/page.js` | 1-stage campaign creation |
| `/re-campaigns` | `app/re-campaigns/page.js` | RE campaign management |
| `/pillar-campaigns` | `app/pillar-campaigns/page.js` | Organic pillar campaigns |
| `/products` | `app/products/page.js` | Product database & scraper |
| `/deconstruct` | `app/deconstruct/page.js` | Deconstruct Lab (discovery) |
| `/multiplier-lab` | `app/multiplier-lab/page.js` | Multiplier Lab (variants) |
| `/glabs-campaigns` | `app/glabs-campaigns/page.js` | G Labs batch campaigns |
| `/sheets-autopilot` | `app/sheets-autopilot/page.js` | Sheets-driven automation |
| `/video-studio` | `app/video-studio/page.js` | FFmpeg Studio |
| `/tts-studio` | `app/tts-studio/page.js` | TTS batch studio |
| `/scraper` | `app/scraper/page.js` | Video Library |
| `/sync` | `app/sync/page.js` | MAKNA Hub Sync |
| `/re-plus-recomm` | `app/re-plus-recomm/page.js` | RE + Recomm Engine |
| `/settings` | `app/settings/page.js` | API keys, KB, global config |
| `/settings/brand-profiles` | `app/settings/brand-profiles/page.js` | Brand DNA profiles |
| `/product-bridge-inject` | `app/product-bridge-inject/page.js` | Product Bridging Injector |
| `/system-health` | `app/system-health/page.js` | System audit & health |
| `/reports` | `app/reports/page.js` | Analytics reports |

### 3.3 Data Flow Architecture

```
Browser (Client Component)
        │
        │  fetch('/api/...')
        ▼
Next.js Route Handler (app/api/**/route.js)
        │
        ├── import { getDb }        from 'lib/db.js'
        ├── import { callGemini }   from 'lib/gemini.js'
        └── import { processJob }   from 'lib/scheduler-processors.js'
        │
        ▼
┌──────────────────────┐    ┌──────────────────────┐
│   SQLite (makna.db)  │    │   Gemini AI API       │
│   via better-sqlite3 │    │   (multi-key pool)    │
└──────────────────────┘    └──────────────────────┘
        │
        │  External Services
        ▼
┌──────────────────────────────────────────────────┐
│  Google Drive API  │  Nextcloud WebDAV  │  MiniMax│
│  Google Sheets API │  Playwright        │  FFmpeg  │
└──────────────────────────────────────────────────┘
```

### 3.4 Background Scheduler Architecture

The server boots three daemons via `instrumentation.js`:

```
Next.js Server Start
        │
        ├── [if MAKNA_SCHEDULER=1] startScheduler()        (Scheduler V4 polling loop)
        ├── [always] startCampaignScheduler()              (Campaign-level local scheduler)
        └── [always] startCloudSyncScheduler()             (Cloud Hub sync daemon)
```

- **Campaign-level Local Scheduler (`lib/campaign-scheduler.js`)**: Berjalan secara penuh secara *in-memory* dan mengendalikan alur pemrosesan sekuensial kampanye modern (RE Campaigns, OPC/Pillar Campaigns, Instant Factory, Recipe Labs, dan Product Bridging Injector). Seluruh skeduler lokal berstatus **nonaktif secara bawaan (default inactive/OFF)** pada saat aplikasi diaktifkan dan harus dinyalakan manual menggunakan tombol Start/Stop Skeduler di header masing-masing halaman dashboard.
- **Scheduler V4 (`lib/scheduler.js`)**: Mesin antrean berbasis database SQLite (`scheduler_jobs`) untuk tugas-tugas latar belakang lainnya seperti *product scraper*. Dashboard visualnya (`/scheduler`) telah dihapus secara permanen dari navigasi.

| Queue Name | Label | AI Cost |
|---|---|---|
| `scraper` | Video Scraper | 0 |
| `analyzer` | RE Analyzer | 1 |
| `ideation` | Ideation | 1 |
| `production` | Production | 1 |
| `glabs` | G Labs Webhook | 0 |
| `re_scraper` | RE Campaign Scraper | 0 |
| `re_analyzer` | RE Campaign Analyzer | 1 |
| `re_tts` | RE Campaign TTS | 0 |
| `re_glabs` | RE Campaign AI Visuals | 0 |
| `re_ffmpeg` | RE Campaign FFmpeg Muxer | 0 |
| `re_social_poster` | RE Campaign Social Poster | 0 |
| `re_plus_recomm` | RE Plus Recomm Sourcing | 1 |
| `pillar_sourcing` | Pillar Product JIT Sourcing | 1 |
| `pillar_generator` | Pillar Storyboard Generator | 1 |
| `pillar_tts` | Pillar Campaign TTS Voice | 0 |
| `pillar_glabs` | Pillar Campaign AI Visuals | 0 |
| `pillar_ffmpeg` | Pillar Campaign FFmpeg Muxer | 0 |
| `pillar_social_poster` | Pillar Campaign Social Poster | 0 |
| `product_scraper` | Product Scraper | 1 |
| `re_deconstruct` | RE Deconstruct Lab | 1 |

### 3.5 State Management

- **No global state store** (no Redux, Zustand, Context API).
- All state is **local React `useState`** within each page component.
- Server-side data is fetched via `fetch('/api/...')` in `useEffect` on mount.
- Polling is used for long-running operations (jobs, scheduler status).
- Toasts & loading indicators are local `useState` booleans per page.

### 3.6 Gemini AI Key Resolution Strategy

```
resolveApiKey()
    │
    ├── if explicitKey        → use it directly
    ├── if tier = 'paid'      → getSetting('gemini_api_key') from DB settings table
    └── if tier = 'free'      → getAvailableApiKey() from pool (gemini_api_keys table)
                                 with daily quota tracking (api_key_usages table)
```

**Resilience**: 4-retry exponential backoff on `503`, with automatic model fallback:
`gemini-2.5-flash` → `gemini-flash-latest`

---

## 4. Data Schema / Models

### `knowledge_bases` — AI Knowledge Base
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `name` | TEXT | KB display name |
| `content` | TEXT | Full markdown content |
| `file_type` | TEXT | Default: `'md'` |
| `file_size` | INTEGER | Bytes |
| `created_at` | DATETIME | Auto |

---

### `product_extractions` — Product Database
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `input_source` | TEXT | URL or raw text |
| `is_url` | INTEGER | Boolean flag |
| `product_name` | TEXT | |
| `product_description` | TEXT | |
| `unique_selling_point` | TEXT | |
| `target_audience` | TEXT | |
| `pain_point_solved` | TEXT | |
| `key_visuals_extracted` | TEXT | JSON |
| `raw_response` | TEXT | Gemini raw output |
| `created_at` | DATETIME | Auto |

---

### `re_campaigns` — RE (Reverse-Engineer) Campaigns
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `campaign_name` | TEXT | |
| `status` | TEXT | `running` / `paused` / `done` |
| `target_spreadsheet_id` | TEXT | Google Sheets URL/ID |
| `target_markdown_url` | TEXT | |
| `aspect_ratio` | TEXT | `9:16`, `16:9`, `1:1` |
| `target_ai` | TEXT | AI video engine target |
| `custom_instruction` | TEXT | |
| `brand_profile_id` | TEXT FK | → `brand_profiles` |
| `is_bridging_active` | INTEGER | Boolean |
| `target_clips_count` | INTEGER | |
| `bridge_at_clip` | INTEGER | |
| `bridge_duration_clips` | INTEGER | |
| `bridging_mode` | TEXT | `select_existing` / `manual_input` / `url_extract` |
| `target_product_id` | TEXT FK | → `product_extractions` |
| `ephemeral_product_data` | TEXT | |
| `promotion_style` | TEXT | `Softselling`, `Hardselling` |
| `post_youtube_draft` | INTEGER | Boolean |
| `post_tiktok_draft` | INTEGER | Boolean |
| `post_facebook_draft` | INTEGER | Boolean |
| `voice_provider` | TEXT | `gemini`, `minimax` |
| `voice_persona` | TEXT | e.g. `Kore` |
| `voice_speed` | REAL | Default: `1.0` |
| `voice_volume` | REAL | Default: `1.0` |
| `ffmpeg_sync_option` | TEXT | |
| `ffmpeg_video_scale` | REAL | |
| `ffmpeg_sfx_volume` | REAL | |
| `ffmpeg_bgm_volume` | REAL | |
| `video_model` | TEXT | e.g. `veo_31_lite` |
| `local_scheduler` | INTEGER | Boolean |
| `scheduler_pause_at` | TEXT | |
| `words_per_clip` | TEXT | |
| `face_visibility` | TEXT | |
| `enable_tts` | INTEGER | Boolean |
| `enable_glabs` | INTEGER | Boolean |
| `enable_ffmpeg` | INTEGER | Boolean |
| `enable_social_post` | INTEGER | Boolean |
| `visual_mode` | TEXT | `pure_t2v`, `hybrid_lock` |
| `product_ref_image_path` | TEXT | |
| `product_filename_declare` | TEXT | |
| `angle_multiplier` | INTEGER | |
| `visual_overrides_json` | TEXT | |
| `tts_model_quality` | TEXT | |
| `target_language` | TEXT | Default: `'id-ID'` |
| `visual_style` | TEXT | |
| `facebook_page_id` | TEXT | |
| `facebook_server_url` | TEXT | |
| `nextcloud_parent_folder` | TEXT | Default: `'MAKNA_Production_Final'` |
| `fb_draft_mode` | TEXT | |
| `sync_mode` | TEXT | |
| `sfx_setting` | TEXT | `without_sfx`, etc. |
| `enable_vo_audit` | INTEGER | Boolean |
| `enable_audio_segment` | INTEGER | Boolean |
| `voice_cast_json` | TEXT | JSON string of voices assigned |
| `created_at` | DATETIME | Auto |

---

### `re_campaign_items` — Individual Videos in RE Campaign
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `campaign_id` | TEXT FK | → `re_campaigns` |
| `source_url` | TEXT | TikTok/IG/YT URL |
| `scrape_status` | TEXT | `pending` → `done` |
| `local_video_path` | TEXT | |
| `analyze_status` | TEXT | `pending` → `done` |
| `result_json` | TEXT | Storyboard/analysis |
| `tts_status` | TEXT | |
| `tts_batch_id` | TEXT | |
| `visual_status` | TEXT | |
| `visual_tasks_json` | TEXT | |
| `visual_clip_paths` | TEXT | |
| `ffmpeg_status` | TEXT | |
| `ffmpeg_output_path` | TEXT | |
| `upload_status` | TEXT | |
| `drive_link` | TEXT | Final output URL |
| `social_post_status` | TEXT | |
| `social_links_json` | TEXT | |
| `retry_count` | INTEGER | |
| `t2i_start_frame_path` | TEXT | |
| `original_deconstruction_json` | TEXT | Competitor verbatim/translation/visual analysis |
| `new_video_plan_json` | TEXT | Upgraded script & visual prompts plan |
| `video_dna_json` | TEXT | Structured Video DNA metrics (10 parameters) |
| `t2i_images_json` | TEXT | Downloaded start frame T2I path array |
| `workflow_status` | TEXT | `pending` ➔ `ready_for_review` ➔ `production_processing` ➔ `completed` |
| `regenerate_start_frames_status` | TEXT | |
| `regenerate_start_frames_progress` | TEXT | |
| `product_url` | TEXT | |
| `original_voiceover` | TEXT | |
| `tiktok_safe_voiceover` | TEXT | |
| `compliance_status` | TEXT | |
| `compliance_score` | INTEGER | |
| `compliance_log_json` | TEXT | |
| `selected_vo_version` | TEXT | Default: `'original'` |

---

### `re_item_angle_variants` — Multiplier Angle Variants
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `re_item_id` | INTEGER FK | → `re_campaign_items` |
| `angle_name` | TEXT | |
| `angle_category` | TEXT | |
| `matrix_strategy_used` | TEXT | |
| `system_targeting` | TEXT | |
| `voice_persona_assigned` | TEXT | |
| `angle_description` | TEXT | |
| `visual_tasks_json` | TEXT | |
| `ffmpeg_output_path` | TEXT | |
| `drive_link` | TEXT | |

---

### `brand_profiles` — Brand DNA
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `brand_name` | TEXT | |
| `tone_of_voice` | TEXT | e.g. `Kasual/Gaul` |
| `visual_signature` | TEXT | Visual brand rules |
| `color_palette` | TEXT | |
| `forbidden_elements` | TEXT | |
| `brand_slogan_or_cta` | TEXT | |
| `raw_guideline_text` | TEXT | Full uploaded guideline |
| `guideline_filename` | TEXT | |
| `created_at` | DATETIME | Auto |

---

### `re_deconstruct_batches` — Deconstruct Lab Batches
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `batch_name` | TEXT | |
| `target_recommendation_count` | INTEGER | Default: 3 |
| `status` | TEXT | `processing` → `done` |
| `total_videos` | INTEGER | |
| `processed_videos` | INTEGER | |
| `created_at` | DATETIME | Auto |

---

### `re_deconstructed_assets` — Deconstructed Video Results
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `batch_id` | TEXT FK | → `re_deconstruct_batches` |
| `source_url` | TEXT | Source video URL |
| `original_caption` | TEXT | |
| `local_video_path` | TEXT | |
| `gemini_file_uri` | TEXT | Uploaded file URI |
| `original_storyboard_json` | TEXT | AI-generated storyboard |
| `product_ideas_json` | TEXT | Extracted product angles |
| `viral_pattern_summary` | TEXT | Viral hook analysis |
| `status` | TEXT | `pending_download` → `done` |
| `error_message` | TEXT | |
| `tags` | TEXT | |

---

### `re_multiplier_tasks` — Multiplier Lab Tasks
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `deconstruct_asset_id` | TEXT FK | → `re_deconstructed_assets` |
| `target_product_url` | TEXT | |
| `affiliate_url` | TEXT | |
| `vso_config_json` | TEXT | Visual/storyboard overrides |
| `bridging_config_json` | TEXT | |
| `audio_config_json` | TEXT | |
| `remake_storyboard_json` | TEXT | |
| `t2i_i2v_prompts_json` | TEXT | Generated prompts |
| `new_caption` | TEXT | |
| `ffmpeg_output_path` | TEXT | Final video path |
| `status` | TEXT | `pending_resolution` → `done` |

---

### `sheets_campaigns` — Sheets Autopilot Campaigns
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `campaign_name` | TEXT | |
| `campaign_type` | TEXT | Campaign type category |
| `spreadsheet_id` | TEXT | Google Sheets ID |
| `gdrive_folder_id` | TEXT | Output Drive folder |
| `status` | TEXT | `active` / `paused` |
| `visual_mode` | TEXT | `hybrid_lock`, etc. |
| `enable_tts` | INTEGER | Boolean |
| `enable_ffmpeg` | INTEGER | Boolean |
| `enable_social_post` | INTEGER | Boolean |
| `visual_style` | TEXT | e.g. `Cinematic` |
| `created_at` | DATETIME | Auto |

---

### `sheets_jobs` — Sheets Autopilot Job Queue
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `campaign_id` | TEXT FK | → `sheets_campaigns` |
| `batch_id` | TEXT | |
| `row_index` | INTEGER | Spreadsheet row |
| `url_or_topic` | TEXT | Input source |
| `status` | TEXT | `pending` → `done` |
| `storyboard` | TEXT | |
| `voiceover` | TEXT | |
| `visual_status` | TEXT | |
| `ffmpeg_status` | TEXT | |
| `gdrive_folder_url` | TEXT | |
| `retry_count` | INTEGER | |

---

### `tts_studio_batches` — TTS Studio Sessions
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `source_type` | TEXT | Origin of text |
| `provider_active` | TEXT | `gemini` / `minimax` |
| `voice_persona` | TEXT | Voice name |
| `tts_model_quality` | TEXT | e.g. `speech-2.8-turbo` |
| `config_speed` | REAL | Default: `1.0` |
| `config_volume` | REAL | Default: `1.0` |

---

### `tts_studio_clips` — TTS Studio Individual Clips
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `batch_id` | TEXT FK | → `tts_studio_batches` |
| `clip_index` | INTEGER | Order in batch |
| `source_text` | TEXT | Text to synthesize |
| `audio_path` | TEXT | Output file path |
| `status` | TEXT | `pending` → `done` |

---

### `scheduler_jobs` — Job Queue
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `queue_name` | TEXT | Named queue |
| `status` | TEXT | `pending` → `running` → `done` / `failed` |
| `payload` | TEXT | JSON serialized inputs |
| `result` | TEXT | JSON serialized output |
| `error_note` | TEXT | |
| `attempts` | INTEGER | Retry count |
| `max_attempts` | INTEGER | Default: 3 |
| `run_at` | DATETIME | Scheduled run time |
| `started_at` | DATETIME | |
| `completed_at` | DATETIME | |

---

### `scheduler_config` — Per-Queue Configuration
| Column | Type | Notes |
|---|---|---|
| `queue_name` | TEXT PK | |
| `is_enabled` | INTEGER | Boolean |
| `mode` | TEXT | `time_window` / `interval` |
| `interval_minutes` | INTEGER | |
| `jobs_per_day` | INTEGER | |
| `window_start` | TEXT | e.g. `09:00` |
| `window_end` | TEXT | e.g. `17:00` |

---

### `gemini_api_keys` — Multi-Key Quota Pool
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `key_name` | TEXT | Display name |
| `api_key` | TEXT UNIQUE | Gemini API key |
| `tier` | TEXT | `FREE` / `PAID` |
| `daily_limit` | INTEGER | Default: 20 |
| `is_active` | INTEGER | Boolean |

---

### `api_key_usages` — Daily Usage Tracking
| Column | Type | Notes |
|---|---|---|
| `date` | TEXT | `YYYY-MM-DD` |
| `key_id` | INTEGER FK | → `gemini_api_keys` |
| `used_count` | INTEGER | |

---

### `settings` — Key-Value Store
| Column | Type | Notes |
|---|---|---|
| `key` | TEXT PK | Setting name |
| `value` | TEXT | Setting value (string) |

**Known keys**: `gemini_api_key`, `gemini_api_tier`, `drive_folder_id`, `nextcloud_url`, `minimax_api_key`, dll.

---

### `system_audit_logs` — Error Audit Trail
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `severity_level` | TEXT | `WARNING`, `ERROR`, `CRITICAL` |
| `module_name` | TEXT | Source module |
| `reference_id` | TEXT | Related entity ID |
| `error_message` | TEXT | |
| `human_resolution_hint` | TEXT | Actionable resolution |
| `is_resolved` | INTEGER | Boolean flag |
| `created_at` | DATETIME | Auto |

---

### `recipe_campaigns` — Recipe Campaigns Config
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | Format: `rcamp_[timestamp]_[hash]` |
| `category` | TEXT | Makanan/Minuman/Kue/Dessert/etc. |
| `custom_category` | TEXT | |
| `visual_style` | TEXT | Default: `'Food Porn'` |
| `nextcloud_parent_folder`| TEXT | Default: `'MAKNA_Recipes'` |
| `post_to_facebook` | INTEGER | Boolean |
| `enable_glabs` | INTEGER | Boolean |
| `target_recipe_count` | INTEGER| |
| `images_per_recipe` | INTEGER | Default: 4 |
| `status` | TEXT | `processing` / `completed` / `failed` |
| `nextcloud_folder_url` | TEXT | Public Share URL |
| `created_at` | DATETIME | Auto |

---

### `recipe_items` — Recipe Campaigns Items
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | Format: `rcitem_[campaign_id]_[index]` |
| `campaign_id` | TEXT FK | → `recipe_campaigns` |
| `recipe_title` | TEXT | |
| `recipe_markdown_text` | TEXT | |
| `t2i_prompts_json` | TEXT | JSON string of 4 prompts |
| `img_1_raw_path` | TEXT | Local path of raw ingredients |
| `img_2_process_path` | TEXT | Local path of cooking process |
| `img_3_result_path` | TEXT | Local path of finished result |
| `img_4_plated_path` | TEXT | Local path of plated layout |
| `img_grid_path` | TEXT | Local path of grid collage |
| `fb_post_id` | TEXT | Facebook draft post ID |
| `fb_post_status` | TEXT | Facebook posting status |
| `status` | TEXT | |
| `created_at` | DATETIME | Auto |

---

### `glabs_campaigns` — G Labs Campaigns
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `source_spreadsheet_id` | TEXT | Google Sheets URL/ID |
| `target_drive_folder_id` | TEXT | Drive Folder URL/ID |
| `current_batch` | INTEGER | |
| `status` | TEXT | `active` / `paused` / `completed` |
| `created_at` | DATETIME | Auto |

---

### `glabs_tasks` — G Labs Individual Tasks
| Column | Type | Notes |
|---|---|---|
| `task_id` | TEXT PK | G Labs Task ID |
| `campaign_id` | TEXT | Campaign ID |
| `item_id` | INTEGER | |
| `clip_index` | INTEGER | |
| `prompt` | TEXT | Visual Prompt |
| `status` | TEXT | `processing` / `completed` / `failed` |
| `video_url` | TEXT | Resulting video URL |
| `created_at` | DATETIME | Auto |
| `completed_at` | DATETIME | |

---

### `re_plus_recomm_jobs` — RE Plus Recomm Jobs
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | Format: `repr_[timestamp]` |
| `campaign_name` | TEXT | |
| `source_urls_json` | TEXT | Competitor URLs JSON |
| `target_recommendations_count` | INTEGER | |
| `status` | TEXT | `pending` / `scraping` / `analyzing` / `completed` / `failed` |
| `created_at` | DATETIME | Auto |

---

### `re_plus_recomm_outputs` — RE Plus Recomm Results
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | Format: `repo_[timestamp]` |
| `recomm_job_id` | TEXT FK | → `re_plus_recomm_jobs` |
| `source_url` | TEXT | Competitor URL |
| `video_deconstruction_json` | TEXT | Storyboard/viral deconstruction |
| `recommended_product_name` | TEXT | Product name suggested |
| `short_description` | TEXT | |
| `unique_selling_point` | TEXT | |
| `scraped_image_url` | TEXT | |
| `local_image_path` | TEXT | |
| `is_selected_by_user` | INTEGER | Boolean flag |
| `created_at` | DATETIME | Auto |

---

### `instant_campaigns` — Instant Campaigns
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `product_name` | TEXT | |
| `product_description` | TEXT | |
| `product_source_type` | TEXT | `url` / `image` / `text_only` |
| `product_media_path` | TEXT | |
| `product_url` | TEXT | |
| `status` | TEXT | `pending` / `running` / `completed` / `failed` |
| `is_mass_production` | INTEGER | Boolean |
| `local_scheduler` | INTEGER | Boolean |
| `scheduler_pause_at` | TEXT | Timestamp if paused |
| `enable_glabs` | INTEGER | Boolean |
| `enable_tts` | INTEGER | Boolean |
| `enable_ffmpeg` | INTEGER | Boolean |
| `enable_social_post` | INTEGER | Boolean |
| `post_youtube_draft` | INTEGER | Boolean |
| `post_tiktok_draft` | INTEGER | Boolean |
| `post_facebook_draft` | INTEGER | Boolean |
| `is_bridging_active` | INTEGER | Boolean |
| `bridge_at_clip` | INTEGER | |
| `visual_mode` | TEXT | e.g. `hybrid_lock` |
| `created_at` | DATETIME | Auto |

---

### `instant_campaign_configs` — Instant Campaigns Creative Config
| Column | Type | Notes |
|---|---|---|
| `campaign_id` | TEXT PK FK | → `instant_campaigns` |
| `narrative_mode` | TEXT | |
| `visual_style` | TEXT | |
| `words_per_clip` | INTEGER | |
| `target_ai_engine` | TEXT | |
| `face_visibility` | TEXT | |
| `aspect_ratio` | TEXT | |
| `total_clips` | INTEGER | |
| `voice_persona` | TEXT | |
| `speed_control` | REAL | |
| `custom_instruction` | TEXT | |
| `target_language` | TEXT | Default: `'id-ID'` |

---

### `instant_campaign_outputs` — Instant Campaigns JSON Output
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `campaign_id` | TEXT FK | → `instant_campaigns` |
| `unified_production_json` | TEXT | Storyboard & Script details |
| `error_log` | TEXT | |

---

### `instant_campaign_items` — Instant Campaigns Individual Items
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `campaign_id` | TEXT FK | → `instant_campaigns` |
| `generation_status` | TEXT | |
| `tts_status` | TEXT | |
| `tts_batch_id` | TEXT | |
| `visual_status` | TEXT | |
| `visual_clip_paths` | TEXT | |
| `ffmpeg_status` | TEXT | |
| `ffmpeg_output_path` | TEXT | |
| `social_post_status` | TEXT | |

---

### `pillar_campaigns` — Pillar Campaigns Config
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `campaign_name` | TEXT | |
| `status` | TEXT | `pending` / `running` / `completed` |
| `content_pillar` | TEXT | |
| `custom_hook` | TEXT | |
| `visual_action_guideline` | TEXT | |
| `custom_instruction` | TEXT | |
| `brand_profile_id` | TEXT FK | → `brand_profiles` |
| `narrative_mode` | TEXT | |
| `visual_style` | TEXT | |
| `face_visibility` | TEXT | |
| `is_bridging_active` | INTEGER | Boolean |
| `target_clips_count` | INTEGER | |
| `bridge_at_clip` | INTEGER | |
| `bridging_mode` | TEXT | |
| `target_product_id` | TEXT FK | → `product_extractions` |
| `ephemeral_product_data` | TEXT | JSON string |
| `aspect_ratio` | TEXT | |
| `target_ai` | TEXT | |
| `video_model` | TEXT | |
| `visual_mode` | TEXT | |
| `product_ref_image_path` | TEXT | |
| `product_filename_declare` | TEXT | |
| `visual_overrides_json` | TEXT | |
| `enable_tts` | INTEGER | Boolean |
| `enable_ffmpeg` | INTEGER | Boolean |
| `enable_social_post` | INTEGER | Boolean |
| `voice_provider` | TEXT | |
| `voice_persona` | TEXT | |
| `words_per_clip` | TEXT | |
| `created_at` | DATETIME | Auto |
| `enable_glabs` | INTEGER | Boolean |
| `upload_markdown` | INTEGER | Boolean |
| `upload_spreadsheet` | INTEGER | Boolean |
| `target_spreadsheet_id` | TEXT | |
| `target_markdown_url` | TEXT | |
| `local_scheduler` | INTEGER | Boolean |
| `scheduler_pause_at` | TEXT | |
| `is_mass_production` | INTEGER | Boolean |
| `tts_model_quality` | TEXT | |
| `voice_speed` | REAL | |
| `voice_volume` | REAL | |
| `target_language` | TEXT | Default: `'id-ID'` |
| `ffmpeg_sync_option` | TEXT | |
| `ffmpeg_video_scale` | REAL | |
| `ffmpeg_sfx_volume` | REAL | |
| `ffmpeg_bgm_volume` | REAL | |
| `post_facebook_draft` | INTEGER | Boolean |
| `facebook_page_id` | TEXT | |
| `facebook_server_url` | TEXT | |
| `nextcloud_parent_folder` | TEXT | Default: `'MAKNA_Production_Final'` |
| `fb_draft_mode` | TEXT | |
| `bridge_duration_clips` | INTEGER | |
| `sfx_setting` | TEXT | `without_sfx`, etc. |
| `enable_vo_audit` | INTEGER | Boolean |
| `enable_audio_segment` | INTEGER | Boolean |
| `voice_cast_json` | TEXT | JSON string of voices assigned |

---

### `pillar_campaign_items` — Pillar Campaigns Individual Items
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `campaign_id` | TEXT FK | → `pillar_campaigns` |
| `generation_status` | TEXT | |
| `result_json` | TEXT | Storyboard/analysis |
| `tts_status` | TEXT | |
| `tts_batch_id` | TEXT | |
| `visual_status` | TEXT | |
| `visual_tasks_json` | TEXT | |
| `visual_clip_paths` | TEXT | |
| `ffmpeg_status` | TEXT | |
| `ffmpeg_output_path` | TEXT | |
| `upload_status` | TEXT | |
| `drive_link` | TEXT | Final output URL |
| `social_post_status` | TEXT | |
| `social_links_json` | TEXT | |
| `t2i_start_frame_path` | TEXT | |
| `retry_count` | INTEGER | |
| `row_creative_payload` | TEXT | |
| `new_video_plan_json` | TEXT | Upgraded script & visual prompts plan |
| `video_dna_json` | TEXT | Structured Video DNA metrics (10 parameters) |
| `t2i_images_json` | TEXT | Downloaded start frame T2I path array |
| `workflow_status` | TEXT | `pending` ➔ `ready_for_review` ➔ `production_processing` ➔ `completed` |
| `regenerate_start_frames_status` | TEXT | |
| `regenerate_start_frames_progress` | TEXT | |
| `original_voiceover` | TEXT | |
| `tiktok_safe_voiceover` | TEXT | |
| `compliance_status` | TEXT | |
| `compliance_score` | INTEGER | |
| `compliance_log_json` | TEXT | |
| `selected_vo_version` | TEXT | Default: `'original'` |
| `created_at` | DATETIME | Auto |

---

### `bridge_injector_campaigns` — Product Bridging Campaigns Config
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `campaign_name` | TEXT | |
| `original_script_md` | TEXT | Original VO script input |
| `bridging_mode` | TEXT | `select_existing` / `manual_input` / `url_extract` |
| `target_product_id` | TEXT FK | → `product_extractions` |
| `ephemeral_product_data` | TEXT | Raw string URL or manual details JSON |
| `status` | TEXT | Campaign stage tracking |
| `created_at` | DATETIME | Auto |

---

### `bridge_injector_outputs` — Product Bridging Campaign Outputs
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `campaign_id` | TEXT FK | → `bridge_injector_campaigns` |
| `injected_vo_1` | TEXT | Updated VO Clip 1 |
| `injected_vo_2` | TEXT | Updated VO Clip 2 (Product) |
| `injected_vo_3` | TEXT | Updated VO Clip 3 |
| `injected_vo_4` | TEXT | Updated VO Clip 4 |
| `clip2_t2i_prompt` | TEXT | |
| `clip2_i2v_prompt` | TEXT | |
| `clip2_t2i_task_id` | TEXT | G-Labs rendering task ID |
| `clip2_t2i_image_path` | TEXT | Downloaded start frame image |
| `clip2_i2v_task_id` | TEXT | G-Labs rendering video task ID |
| `clip2_video_path` | TEXT | Downloaded final video |
| `injected_script_md_path` | TEXT | Local combined Markdown VO path |
| `created_at` | DATETIME | Auto |

---

### `ffmpeg_studio_jobs` — Standalone FFmpeg Studio Jobs
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `video_source_type` | TEXT | |
| `video_path` | TEXT | |
| `audio_source_type` | TEXT | |
| `audio_path` | TEXT | |
| `sync_option` | TEXT | |
| `bgm_path` | TEXT | |
| `bgm_volume` | REAL | |
| `output_path` | TEXT | |
| `status` | TEXT | `pending` / `processing` / `completed` / `failed` |
| `error_note` | TEXT | |
| `created_at` | DATETIME | Auto |

---

## 5. Styling & UI Rules

### 5.1 Design Philosophy
- **Dark mode only** — deep space aesthetic, no light mode toggle.
- **Glassmorphism** — cards with `backdrop-filter: blur(20px)` and semi-transparent backgrounds.
- **Accent color** — purple/violet brand identity (`#6c5ce7`).
- **Micro-animations** — hover lift (`translateY(-2px)`), glow transitions.
- Single global stylesheet `app/globals.css` — no CSS modules, no Tailwind.

### 5.2 CSS Custom Properties (Design Tokens)

```css
/* Backgrounds */
--bg-primary:     #0a0a0f;                   /* Page background */
--bg-secondary:   #12121a;                   /* Sidebar background */
--bg-card:        rgba(20, 20, 35, 0.8);     /* Card background */
--bg-card-hover:  rgba(30, 30, 50, 0.9);     /* Card hover */
--bg-glass:       rgba(255, 255, 255, 0.03); /* Glass overlay */

/* Borders */
--border:         rgba(255, 255, 255, 0.12);
--border-hover:   rgba(255, 255, 255, 0.22);

/* Text */
--text-primary:   #e8e8f0;
--text-secondary: #b0b0c8;
--text-muted:     #7a7a98;

/* Accent (Brand Color) */
--accent:         #6c5ce7;
--accent-light:   #a29bfe;
--accent-glow:    rgba(108, 92, 231, 0.3);

/* Semantic Colors */
--success:        #00b894;
--success-glow:   rgba(0, 184, 148, 0.2);
--warning:        #fdcb6e;
--danger:         #e17055;
--danger-glow:    rgba(225, 112, 85, 0.2);
--info:           #74b9ff;

/* Spacing & Shape */
--radius:         12px;
--radius-sm:      8px;
--radius-lg:      16px;
--sidebar-w:      260px;

/* Typography */
--font-sans:      'Inter', system-ui, sans-serif;
--font-mono:      'JetBrains Mono', monospace;

/* Effects */
--shadow:         0 4px 24px rgba(0, 0, 0, 0.4);
--shadow-lg:      0 8px 40px rgba(0, 0, 0, 0.6);
--transition:     0.2s cubic-bezier(0.4, 0, 0.2, 1);
```

### 5.3 Global CSS Class Catalog

| Category | Classes |
|---|---|
| **Layout** | `.app-layout`, `.sidebar`, `.main-content`, `.page-container`, `.page-header` |
| **Cards** | `.card`, `.card-title`, `.card-title .icon` |
| **Stats** | `.stats-grid`, `.stat-card`, `.stat-label`, `.stat-value` |
| **Stat Variants** | `.stat-value.accent`, `.stat-value.success`, `.stat-value.warning`, `.stat-value.info` |
| **Forms** | `.form-group`, `.form-label`, `.form-input`, `.form-select`, `.form-textarea` |
| **Form Layouts** | `.form-grid` (2-col), `.form-grid-3` (3-col) |
| **Buttons** | `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-success`, `.btn-danger` |
| **Button Sizes** | `.btn-sm`, `.btn-lg`, `.btn-block` |
| **Navigation** | `.sidebar-brand`, `.sidebar-nav`, `.nav-link`, `.nav-link.active`, `.nav-section`, `.nav-icon` |
| **KB Management** | `.kb-list`, `.kb-item`, `.kb-item-info`, `.kb-item-name`, `.kb-item-meta`, `.kb-item-actions` |
| **Upload** | `.upload-area`, `.upload-area.dragover`, `.upload-icon`, `.upload-hint` |
| **Checkbox Group** | `.checkbox-group`, `.checkbox-item`, `.checkbox-item.selected` |
| **Tables** | `.ideas-table` |

### 5.4 Typographic Scale

| Use Case | Size | Weight | Font |
|---|---|---|---|
| Page Heading (`h2`) | `1.8rem` | 700 | Inter |
| Card Title | `1rem` | 600 | Inter |
| Body Text | `0.9rem` | 400 | Inter |
| Form Label | `0.8rem` | 600 | Inter (uppercase) |
| Nav Link | `0.88rem` | 500 | Inter |
| Nav Section | `0.65rem` | 600 | Inter (uppercase) |
| Stat Value | `2rem` | 700 | JetBrains Mono |
| Brand Name | `1.2rem` | 700 | JetBrains Mono |
| Version Tag | `0.7rem` | — | JetBrains Mono (uppercase) |

### 5.5 Interaction & Animation Rules

| Interaction | Rule |
|---|---|
| Hover lift | `transform: translateY(-2px)` — stat cards, primary buttons |
| Focus ring | `box-shadow: 0 0 0 3px var(--accent-glow)` — form inputs |
| Active nav | bg `var(--accent-glow)` · text `var(--accent-light)` · border accent |
| Transition speed | `0.2s cubic-bezier(0.4,0,0.2,1)` — applied globally via `--transition` |
| Disabled state | `opacity: 0.5; cursor: not-allowed` on `.btn:disabled` |
| Drag-over | `.upload-area.dragover` — border turns accent, bg becomes `var(--accent-glow)` |
| Stat card hover | Top accent bar `opacity: 0 → 1` (3px gradient strip) |
| Card hover | `border-color: var(--border-hover)` |

### 5.6 Standard Page Construction Pattern

```jsx
'use client';

import Sidebar from '../components/Sidebar';
import { useState, useEffect } from 'react';

export default function FeaturePage() {
  // 1. Local state declarations
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  // 2. Data fetching on mount
  useEffect(() => { fetchData(); }, []);
  async function fetchData() {
    const res = await fetch('/api/v2/feature');
    const json = await res.json();
    if (json.success) setData(json.data);
    setLoading(false);
  }

  // 3. Action handlers
  async function handleAction() { /* ... */ }

  // 4. JSX: always .app-layout > <Sidebar/> + .main-content > .page-container
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-container">
          <div className="page-header">
            <h2>Feature Title</h2>
            <p>Short description</p>
          </div>
          {/* Content using .card, .btn, .form-group, etc. */}
        </div>
      </main>
    </div>
  );
}
```

---

*Generated from live codebase analysis — MAKNA Engine v8.8+*
