# Rencana Implementasi Tahap 3 — Universe Platform

**Tujuan**: Menjadikan MAKNA Flow sebagai platform serial character content yang tangguh, mendukung berbagai universe dan niche, dengan pemisahan data yang dinamis di level database.

---

## 3.1 [NEW] Universe Manager (CRUD)

#### Halaman: `/settings/universes`

- Tabel `universe_profiles` di database:
  ```sql
  CREATE TABLE universe_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    premise TEXT,
    tone TEXT,
    human_presence TEXT DEFAULT 'none',
    default_visual_style TEXT DEFAULT 'cinematic_3d_clay',
    default_scene_count INTEGER DEFAULT 7,
    default_scene_duration INTEGER DEFAULT 8,
    cta_personality TEXT,
    rules_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  ```
- CRUD UI untuk membuat, mengedit, dan menghapus universe profiles.
- Dropdown Content Planner berisi semua universe dari DB secara dinamis (bukan hardcoded).

---

## 3.2 [NEW] Character Library & Location Library

- Tabel `universe_characters`:
  ```sql
  CREATE TABLE universe_characters (
    id TEXT PRIMARY KEY,
    universe_id TEXT REFERENCES universe_profiles(id),
    name TEXT NOT NULL,
    species TEXT, breed TEXT,
    body_shape TEXT, fur_color TEXT, eye_color TEXT,
    wardrobe TEXT, personality TEXT,
    movement_style TEXT, relative_size TEXT,
    role TEXT,
    reference_image_path TEXT,
    canonical_prompt TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  ```
- Tabel `universe_locations`:
  ```sql
  CREATE TABLE universe_locations (
    id TEXT PRIMARY KEY,
    universe_id TEXT REFERENCES universe_profiles(id),
    name TEXT NOT NULL,
    visual_description TEXT,
    lighting_default TEXT,
    props TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  ```
- UI: Character Library grid dengan upload reference image.
- UI: Location Library dengan visual preview.

---

## 3.3 [NEW] Episode Memory

- Tabel `universe_episodes`:
  ```sql
  CREATE TABLE universe_episodes (
    id TEXT PRIMARY KEY,
    universe_id TEXT REFERENCES universe_profiles(id),
    planner_row_id TEXT,
    campaign_item_id TEXT,
    product_used TEXT,
    problem_used TEXT,
    main_character TEXT,
    supporting_characters TEXT,
    location TEXT,
    hook_keywords TEXT,
    resolution_pattern TEXT,
    cta_used TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  ```
- Anti-repetition per universe + karakter + produk (bukan hanya per produk).
- Digest extraction mirip HARM tapi berdasarkan universe ID.

---

## 3.4 [NEW] Multi-Universe Support

- Content Planner dropdown menampilkan semua universe dari DB secara dinamis.
- Setiap universe bisa memiliki domain knowledge berbeda.
- Contoh ekspansi masa depan: Kitchen Cartoon Universe, Herbal Cartoon Universe, Fashion Universe.

---

## Execution Task List — Tahap 3

- [ ] Desain dan buat tabel `universe_profiles`, `universe_characters`, `universe_locations`, `universe_episodes`
- [ ] Buat halaman `/settings/universes` (CRUD)
- [ ] Buat Character Library UI dengan upload reference image
- [ ] Buat Location Library UI
- [ ] Implementasi Episode Memory dan anti-repetition per universe
- [ ] Integrasi dropdown universe di Content Planner (dynamic dari DB)
- [ ] Migrasi PawVille dari file KB ke `universe_profiles` record di DB
- [ ] Testing: buat universe kedua selain PawVille
- [ ] Dokumentasi SOT `sot/menus/universe-manager.md`

---

## Batasan MVP (Tahap 3 TIDAK Mencakup)

- ❌ Editor visual universe yang kompleks
- ❌ Generator karakter otomatis
- ❌ Seluruh spesies hewan (cukup kucing, anjing, hewan kecil)
- ❌ Auto-rendering dari Content Planner (tetap via OPC)
- ❌ Multi-karakter lip-sync
- ❌ Branching narrative
- ❌ Lebih dari 1 universe per planner session
