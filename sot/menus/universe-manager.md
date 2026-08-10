# Universe Manager — SOT

## Deskripsi

Universe Manager adalah fitur MAKNA Flow untuk mengelola multiple cartoon universe secara dinamis melalui database PostgreSQL. Mendukung tipe universe **animal** (PawVille, KitchenTails) maupun **human claymation** (Jejak Peradaban Islam).

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

## Universe yang Tersedia

1. **PawVille Pet Universe** (pawville) - Type: animal, Domain: pet_supplies, 5 karakter, 5 lokasi
2. **KitchenTails Culinary Universe** (kitchentails) - Type: animal, Domain: food_culinary, 2 karakter, 2 lokasi
3. **Jejak Peradaban Islam** (jejak-peradaban-islam) - Type: human, Domain: islamic_history, Historical Period: Abad ke-7 s.d. ke-15, 2 karakter, 2 lokasi

## Batasan

- Universe tidak bisa di-hard-delete jika sudah memiliki episode
- Planner/campaign menyimpan snapshot konfigurasi universe saat pembuatan
- Real-world content planner tidak terpengaruh oleh fitur ini
- Universe bertipe human wajib mengisi depiction_policy untuk keamanan konten
- depiction_mode = faceless atau silhouette direkomendasikan untuk karakter sensitif di universe islamic_history
