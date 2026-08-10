# Universe Manager — SOT

## Deskripsi

Universe Manager adalah fitur MAKNA Flow untuk mengelola multiple cartoon universe secara dinamis melalui database PostgreSQL. Mendukung tipe universe **animal** (PawVille), **mascot_object** (Herbal Grove, Kitchen Town, Rumah Rapi), maupun **human claymation** (Jejak Peradaban Islam, General Clay Story).

Sejak **Tahap 3.6**, user dapat membuat universe baru dari **6 System Preset** bawaan (1-klik via StarterPickerModal) atau tetap membuat dari blank form secara manual.

## Tabel Database

| Tabel | Fungsi |
|---|---|
| `universe_profiles` | Definisi inti universe (nama, slug, tone, style, universe_type, depiction_policy, historical_period, dll.) |
| `universe_characters` | Library karakter per universe dengan canonical prompt, depiction_mode, reference_type, reference image |
| `universe_locations` | Library lokasi per universe dengan deskripsi visual, historical_period, reference_type |
| `universe_episodes` | Memory episode untuk anti-repetition per universe |

Semua tabel bersifat **tenant-aware** (kolom `tenant_id`), otomatis terisolasi via `interceptQuery()` di `lib/db.js`.

## Field Baru — Tahap 3.5 (Human Claymation Support)

### `universe_profiles`
| Field | Type | Default | Keterangan |
|---|---|---|---|
| `universe_type` | TEXT | `animal` | Tipe universe: animal, mascot_object, human |
| `depiction_policy` | TEXT | NULL | Aturan representasi karakter sensitif (wajib untuk tipe human) |
| `historical_period` | TEXT | NULL | Rentang periode historis, misal: Abad ke-7 sampai abad ke-15 |

### `universe_characters`
| Field | Type | Default | Keterangan |
|---|---|---|---|
| `depiction_mode` | TEXT | `normal` | Mode penggambaran: normal, faceless, back_view, silhouette, environment_only |
| `reference_type` | TEXT | `identity` | Jenis referensi: identity, wardrobe |
| `historical_period` | TEXT | NULL | Override periode historis untuk karakter tertentu |

### `universe_locations`
| Field | Type | Default | Keterangan |
|---|---|---|---|
| `historical_period` | TEXT | NULL | Periode historis lokasi |
| `reference_type` | TEXT | `location` | Jenis referensi: location, visual_style |

## Knowledge Domains (8 domain tersedia)

| Domain | Keterangan | Story Template Default |
|---|---|---|
| `general` | Konten umum | problem_solution_7beat |
| `pet_supplies` | Produk hewan peliharaan | pet_problem_solution_7beat |
| `food_culinary` | Makanan dan kuliner | problem_solution_7beat |
| `history` | Sejarah umum | historical_explainer_7beat |
| `islamic_history` | Sejarah peradaban Islam | historical_explainer_7beat |
| `kitchen` | Dapur dan memasak | problem_solution_7beat |
| `home_improvement` | Rumah dan renovasi | problem_solution_7beat |
| `herbal` | Herbal dan tanaman | educational_discovery_7beat |

## Universe Types

| Type | Keterangan |
|---|---|
| `animal` | Karakter hewan (default) — PawVille, KitchenTails |
| `mascot_object` | Karakter maskot/benda |
| `human` | Karakter manusia claymation — Jejak Peradaban Islam |

## Akses UI

- **Menu**: Sidebar -> PLANNING -> Universe Manager
- **URL**: /settings/universes
- **Tab**: Universes | Characters | Locations | Episodes
- Field Universe Type muncul di form universe
- Field Historical Period + Depiction Policy muncul kondisional jika universe_type === human
- Field Depiction Mode + Reference Type tersedia di form Character
- Field Historical Period + Reference Type tersedia di form Location

## Depiction Policy dan Prompt Integration (Tahap 3.5)

Untuk universe bertipe human:
- depiction_policy diinjeksi ke prompt AI via lib/prompts.js dan lib/content-planner-engine.js
- historical_period memicu directive anti-anakronisme di seluruh AI call
- HUMAN PRESENCE directive menjadi dinamis (tidak lagi hardcoded NONE)
- cartoon-continuity-validator.js Check 7 (human presence) dinonaktifkan untuk universe bertipe human

## Anti-Repetition

- getEpisodeDigest(universeId) diinjeksi ke prompt Strategic Skeleton
- Saat Pillar Campaign di-ingest, entry baru direkam ke universe_episodes
- Digest hanya mengambil 30 episode terakhir per universe

## Universe yang Tersedia (Contoh Seed)

1. **PawVille Pet Universe** (pawville) — Type: animal, Domain: pet_supplies
2. **Jejak Peradaban Islam** (jejak-peradaban-islam) — Type: human, Domain: islamic_history, Historical Period: Abad ke-7 s.d. ke-15

> User dapat membuat universe baru dari 6 System Preset (lihat seksi di bawah) atau dari blank form.

## System Presets — Tahap 3.6

Didefinisikan di `lib/universe-presets.js` (immutable, versioned, tidak tersimpan di DB — hanya template).

| Key | Label | Type | Domain | Karakter | Lokasi |
|---|---|---|---|---|---|
| `pawville_pet_story` | PawVille Pet Story | animal | pet_supplies | 3 | 3 |
| `herbal_grove` | Herbal Grove | mascot_object | herbal | 3 | 3 |
| `kitchen_town` | Kitchen Town | mascot_object | kitchen | 3 | 3 |
| `rumah_rapi` | Rumah Rapi | mascot_object | home_improvement | 3 | 3 |
| `jejak_peradaban_islam` | Jejak Peradaban Islam | human | islamic_history | 2 | 2 |
| `general_clay_story` | General Clay Story | human | general | 0 | 0 |

### Cara Membuat Universe dari Preset
1. Buka Universe Manager → klik `+ New Universe`
2. Pilih **Create from Preset** → grid 6 preset muncul
3. Klik card preset → preview detail tampil (tone, visual style, karakter, lokasi)
4. Isi `Universe Name` + `Slug` → klik `Create Universe`
5. Universe baru terbentuk via atomic transaction (karakter & lokasi sekaligus)

### API Endpoints Preset (Tahap 3.6)

| Method | Endpoint | Fungsi |
|---|---|---|
| `GET` | `/api/v2/universe-presets` | List 6 preset (summary) |
| `GET` | `/api/v2/universe-presets/:key` | Detail preset (sanitized, tanpa filesystem path) |
| `POST` | `/api/v2/universe-presets/:key/instantiate` | Clone preset → universe baru (atomic transaction) |

## Centralized KB Routing — Tahap 3.6

Routing KB terpusat via `lib/kb-routing.js`. Tidak ada lagi hardcode domain KB di prompts atau scheduler.

| Domain | KB Files |
|---|---|
| `pet_supplies` | `PET_CONTENT_KB` |
| `herbal` | `HERBAL_CONTENT_KB` |
| `kitchen` | `KITCHEN_CONTENT_KB` |
| `home_improvement` | `HOME_IMPROVEMENT_KB` |
| `history` | `HISTORY_CONTENT_KB` |
| `islamic_history` | `HISTORY_CONTENT_KB` + `ISLAMIC_HISTORY_CONTENT_KB` |
| `food_culinary` | `Food Styling & Photography KB` |
| `general` | *(tidak ada domain KB)* |

**Cartoon universe** selalu mendapat: `CARTOON_UNIVERSE_STORY_ENGINE` + `CARTOON_VISUAL_CONTINUITY_KB` + domain KB + universe profile KB (auto-derived dari slug).

> [!IMPORTANT]
> Bug **fallback PawVille** sudah dihapus di Tahap 3.6. Universe non-PawVille tidak lagi mendapat `PAWVILLE_UNIVERSE_PROFILE` sebagai fallback.

## Batasan

- Universe tidak bisa di-hard-delete jika sudah memiliki episode
- Planner/campaign menyimpan snapshot konfigurasi universe saat pembuatan
- Real-world content planner tidak terpengaruh oleh fitur ini
- Universe bertipe human wajib mengisi depiction_policy untuk keamanan konten
- depiction_mode = faceless atau silhouette direkomendasikan untuk karakter sensitif di universe islamic_history
- System Preset bersifat **immutable** — hanya tersimpan di code, tidak di DB. Perubahan preset memerlukan update `lib/universe-presets.js`
- `reference_image_path` pada karakter/lokasi preset di-null-kan saat clone — user perlu upload referensi sendiri
- Slug harus unik per tenant — clone preset dengan nama berbeda tetap bisa untuk universe kedua bertipe sama
