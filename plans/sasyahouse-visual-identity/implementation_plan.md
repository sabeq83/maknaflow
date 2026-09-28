# Implementation Plan — SasyaHouse Modern Visual Identity Preset & Prompt Sanitization

## Ringkasan

Rencana ini menyusun arsitektur visual resmi dan permanen untuk brand **SasyaHouse** (Kost Muslimah Eksklusif Sigura-gura, Malang) agar setiap pembuatan konten masa depan (Pillar Campaigns, OPC, Instant Factory) secara otomatis menghasilkan visual **Modern Minimalist Gen Z** (fotorealistis, aesthetic Korean/Scandinavian, meja putih/light oak bersih, pencahayaan hangat, dan bebas dari furnitur rustic atau ilustrasi editorial politik).

Selain itu, rencana ini juga membersihkan 10 kemunculan kata `rustic` pada kampanye aktif `opc_260928_kllhub` sehingga selaras 100% dengan identitas baru ini.

---

## 1. Rincian Seluruh Field Visual Identity Schema v2 (SasyaHouse)

Berikut spesifikasi lengkap 12 kelompok parameter Visual Identity Schema v2 yang akan didaftarkan ke tabel `visual_identity_presets`:

```json
{
  "schema_version": "2",
  "label": "SasyaHouse Modern Muslimah Lifestyle",
  "description": "Visual identity resmi SasyaHouse: Mahasiswi muslimah faceless hands-only, gaya hidup modern minimalis Gen Z, kuliner & hunian estetik di Sigura-gura Malang.",
  
  "subject": {
    "kind": "human",
    "faceless_mode": "hands_only",
    "demographic_key": "syari_classic",
    "custom_description": "a graceful Southeast Asian Muslimah student, delicate female hands with smooth light skin, slender fingers, natural neat fingernails, strictly faceless framing, camera focused entirely on forearms and hands, cropped from elbow down",
    "character_count": 1,
    "population_mode": "single"
  },
  
  "visual_language": {
    "primary_style": "culinary_cinematic",
    "supporting_styles": ["commercial_product_cinematic", "cinematic_realistic"],
    "disabled_styles": ["editorial_graphic_novel", "shadow_silhouette", "clay_political_theater"]
  },
  
  "mode_routing": {
    "hook": "culinary_cinematic",
    "context": "commercial_product_cinematic",
    "mechanism": "culinary_cinematic",
    "consequence": "commercial_product_cinematic",
    "evidence_reveal": "commercial_product_cinematic",
    "conclusion": "culinary_cinematic"
  },
  
  "rendering": {
    "geometry": "photorealistic_clean",
    "textures": [
      "natural_skin_textures",
      "authentic_steam_and_moisture",
      "clean_matte_white_surface",
      "light_natural_oak_wood"
    ],
    "shadow_style": "soft_natural",
    "finish": "photorealistic_cinematic"
  },
  
  "composition": {
    "primary_idea_count": 1,
    "primary_subject_count": 1,
    "negative_space": "required",
    "safe_zone": "vertical_social_ui"
  },
  
  "metaphor_engine": {
    "enabled": false,
    "pattern": "direct_visual_evidence"
  },
  
  "wardrobe": {
    "mode": "fixed",
    "preset_key": "terracotta_amber",
    "custom_description": "modest long flowing sleeves in Amber Haze and Warm Terracotta tones covering the arms completely down to the wrists, clean neat fabric cuffs (strictly wrists covered)",
    "primary_color": "#C86D51",
    "secondary_color": "#E89A3C",
    "material": "breathable matte cotton fabric",
    "sleeve_policy": "wrists_covered",
    "accessories": ["dainty minimalist silver wristwatch with slim strap"]
  },
  
  "environment": {
    "preset_key": "custom",
    "custom_description": "clean modern minimalist white study desk with light natural oak wood accents, aesthetic Korean-Scandinavian student room in Sigura-gura Malang, warm ambient lighting, laptop with high-speed internet charts, tidy pastel stationery, clean shared pantry and RO drinking station",
    "material_palette": [
      "clean white matte laminate",
      "light natural oak wood",
      "smooth ceramic",
      "clear glass"
    ],
    "props": [
      "modern laptop",
      "aesthetic pastel notebook",
      "ceramic mug with warm drink",
      "minimalist desk lamp",
      "mini potted succulent"
    ],
    "background_density": "balanced"
  },
  
  "lighting": {
    "preset_key": "window_daylight",
    "custom_description": "illuminated by soft natural warm golden daylight coming from side window, gentle ambient glow, appetizing highlights on food and surfaces, realistic soft-shadow roll-off",
    "color_temperature": "warm_neutral",
    "contrast": "soft"
  },
  
  "camera": {
    "framing": "forearms_and_hands",
    "perspective": "third_person",
    "lens_look": "natural_50mm",
    "depth_of_field": "shallow",
    "movement": "subtle_handheld"
  },
  
  "style": {
    "preset_key": "culinary_cinematic",
    "custom_description": "premium modern Gen Z student lifestyle and culinary cinematography, warm inviting ambience, clean 8k photorealism",
    "aspect_ratio": "9:16"
  },
  
  "guardrails": {
    "face_visibility": "prohibited",
    "reflection_face": "prohibited",
    "unintended_people": "prohibited",
    "extra_people": "prohibited",
    "intentional_crowd": "allowed_faceless",
    "identity_drift": "prohibited",
    "wardrobe_drift": "prohibited",
    "required_negative_prompts": [
      "rustic wooden table",
      "worn-out rough wooden desk",
      "cluttered messy desk",
      "dark gloomy lighting",
      "political editorial illustration",
      "flat 2D vector clipart",
      "visible human face",
      "exposed arms",
      "bare skin above wrists",
      "unappetizing food"
    ]
  }
}
```

---

## 2. Pembaruan Brand Profile `sasyahouse`

File/Tabel: `staging.brand_profiles` & `dev.brand_profiles` (ID: `bce49806-4e43-4360-90ea-9aa083b807e8`)

| Parameter | Sebelum | Sesudah |
|---|---|---|
| `visual_signature` | `clean aesthetic` | `Modern Gen Z minimalist aesthetic, clean white study desk with light oak accents, cozy air-conditioned bedroom with warm ambient glow, clean modern pantry, photorealistic lifestyle cinematography.` |
| `color_palette` | `null` | `Amber Haze, Terracotta, Clean Matte White, Light Natural Oak Wood, Warm Pastel Beige` |
| `forbidden_elements` | `null` | `rustic wooden table, worn-out furniture, dim dark room, political editorial illustration, flat vector clipart, visible human faces, bare skin above wrists` |

---

## 3. Pembersihan Prompt Kampanye Aktif `opc_260928_kllhub`

Pembersihan kata `rustic` pada 10 titik:
1. `staging.pillar_campaigns.visual_overrides_json`: Mengganti `authentic rustic wooden table` ➔ `clean modern minimalist cafe table and sleek white pantry surface`.
2. `staging.pillar_campaign_items` (Item 1448 s.d. 1454):
   - Klip 1 T2I: `rustic wooden student study desk surface` ➔ `clean modern minimalist white study desk with light oak wood accents`
   - Klip 1 I2V: `rustic table surface` ➔ `sleek modern minimalist tabletop with smooth matte finish`
   - Seluruh blok `resolved_visual_overrides` pada ke-7 item.

---

## 4. Before & After Code Snippets

### `scripts/create-sasyahouse-preset.mjs` (New File)

**Code Sebelum (Current/Before)**: *Belum ada script otomatis pendaftaran preset SasyaHouse.*

**Code Sesudah (Proposed/After)**:
```js
import { getPgPool, closePgPool } from '../lib/db-pg.js';
import { validateAndNormalizeVisualIdentity } from '../lib/visual-identity-contract.js';

export async function upsertSasyaHousePreset() {
  const pool = getPgPool();
  const config = validateAndNormalizeVisualIdentity({
    schema_version: '2',
    label: 'SasyaHouse Modern Muslimah Lifestyle',
    subject: {
      kind: 'human',
      faceless_mode: 'hands_only',
      demographic_key: 'syari_classic',
      population_mode: 'single'
    },
    visual_language: {
      primary_style: 'culinary_cinematic',
      supporting_styles: ['commercial_product_cinematic', 'cinematic_realistic'],
      disabled_styles: ['editorial_graphic_novel', 'shadow_silhouette', 'clay_political_theater']
    },
    wardrobe: {
      mode: 'fixed',
      preset_key: 'terracotta_amber',
      custom_description: 'modest long flowing sleeves in Amber Haze and Warm Terracotta tones covering the arms completely down to the wrists',
      sleeve_policy: 'wrists_covered'
    },
    environment: {
      preset_key: 'custom',
      custom_description: 'clean modern minimalist white study desk with light natural oak wood accents, aesthetic Korean-Scandinavian student room in Sigura-gura Malang, warm ambient lighting, laptop with high-speed internet, tidy pastel stationery'
    },
    style: {
      preset_key: 'culinary_cinematic',
      aspect_ratio: '9:16'
    }
  });

  const query = `
    INSERT INTO visual_identity_presets (key, label, description, source, status, version, config_json)
    VALUES ($1, $2, $3, 'tenant', 'active', 1, $4)
    ON CONFLICT (key) DO UPDATE
    SET label = EXCLUDED.label, description = EXCLUDED.description, config_json = EXCLUDED.config_json, version = visual_identity_presets.version + 1, updated_at = CURRENT_TIMESTAMP
    RETURNING id, key, label, version;
  `;

  return pool.query(query, ['sasyahouse_modern_muslimah_lifestyle', 'SasyaHouse Modern Muslimah Lifestyle', 'Visual identity resmi SasyaHouse: Mahasiswi muslimah faceless hands-only, gaya hidup modern minimalis Gen Z.', JSON.stringify(config)]);
}
```

---

## Execution Task List

- [x] Simulasikan seluruh 12 kelompok parameter Visual Identity SasyaHouse pada Mockup HTML / Plan Review.
- [x] Buat skrip pendaftaran preset `sasyahouse_modern_muslimah_lifestyle` ke tabel `visual_identity_presets` di database PostgreSQL.
- [x] Daftarkan preset ke skema `dev` dan `staging`.
- [x] Perbarui Brand Profile `sasyahouse` (`visual_signature`, `color_palette`, `forbidden_elements`) di `dev` dan `staging`.
- [x] Bersihkan seluruh 10 kemunculan kata `rustic` pada kampanye aktif `opc_260928_kllhub` (`pillar_campaigns` & `pillar_campaign_items`).
- [x] Verifikasi hasil prompt T2I dan I2V pada seluruh baris item 1448 s.d. 1454.
- [x] Lakukan pengujian unit test dan validasi konsistensi database.
- [x] Dokumentasikan hasil akhir dan panduan pemilihan preset untuk pembuatan konten berikutnya.
