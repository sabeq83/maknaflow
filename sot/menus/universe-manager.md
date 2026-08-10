# Universe Manager — SOT

## Deskripsi

Universe Manager adalah fitur MAKNA Flow untuk mengelola multiple cartoon universe secara dinamis melalui database PostgreSQL. Fitur ini menggantikan sistem manifest statis yang sebelumnya hardcoded di `lib/universe-manifests.js`.

## Tabel Database

| Tabel | Fungsi |
|---|---|
| `universe_profiles` | Definisi inti universe (nama, slug, tone, style, dll.) |
| `universe_characters` | Library karakter per universe dengan canonical prompt dan reference image |
| `universe_locations` | Library lokasi per universe dengan deskripsi visual |
| `universe_episodes` | Memory episode untuk anti-repetition per universe |

Semua tabel bersifat **tenant-aware** (kolom `tenant_id`), otomatis terisolasi via `interceptQuery()` di `lib/db.js`.

## Akses UI

- **Menu**: Sidebar → PLANNING → "🏰 Universe Manager"
- **URL**: `/settings/universes`
- **Tab**: Universes | Characters | Locations | Episodes

## API Endpoints

| Method | Path | Fungsi |
|---|---|---|
| GET | `/api/v2/universe-profiles` | List semua universe aktif |
| POST | `/api/v2/universe-profiles` | Buat universe baru |
| GET | `/api/v2/universe-profiles/[id]` | Detail universe + statistik |
| PUT | `/api/v2/universe-profiles/[id]` | Update universe |
| DELETE | `/api/v2/universe-profiles/[id]` | Archive/hapus universe |
| GET | `/api/v2/universe-profiles/[id]/characters` | List karakter |
| POST | `/api/v2/universe-profiles/[id]/characters` | Tambah karakter |
| GET/PUT/DELETE | `/api/v2/universe-profiles/[id]/characters/[charId]` | CRUD karakter |
| GET/POST | `/api/v2/universe-profiles/[id]/locations` | CRUD lokasi |
| PUT/DELETE | `/api/v2/universe-profiles/[id]/locations/[locId]` | Update/hapus lokasi |
| GET | `/api/v2/universe-profiles/[id]/episodes` | Episode memory + digest |

## Arsitektur Hybrid Manifest

`lib/universe-manifests.js` menggunakan **hybrid loader**:
1. Saat boot: auto-load dari DB ke in-memory cache (delayed 2 detik)
2. Fungsi `getUniverseManifest(slug)` membaca dari cache DB
3. Fallback ke data statis PawVille jika DB belum ready
4. `refreshManifestCache()` dipanggil setelah CRUD untuk invalidasi cache

## Anti-Repetition

- Saat Content Planner mengeksekusi AI call pertama (Strategic Skeleton), sistem mengambil `getEpisodeDigest(universeId)` dan menyuntikkan daftar masalah/hook/resolusi yang sudah pernah digunakan ke prompt AI
- Saat Pillar Campaign di-ingest, sistem merekam entry baru ke `universe_episodes`
- Digest hanya mengambil 30 episode terakhir per universe

## Universe yang Tersedia

1. **PawVille Pet Universe** (`pawville`) — Domain: pet_supplies, 5 karakter, 5 lokasi
2. **KitchenTails Culinary Universe** (`kitchentails`) — Domain: food_culinary, 2 karakter, 2 lokasi

## Batasan

- Universe tidak bisa di-hard-delete jika sudah memiliki episode
- Planner/campaign menyimpan **snapshot** konfigurasi universe saat pembuatan
- Real-world content planner tidak terpengaruh oleh fitur ini
