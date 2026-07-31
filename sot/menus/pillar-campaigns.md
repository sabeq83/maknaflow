# **BLUEPRINT SISTEM: ORGANIC PILLAR CAMPAIGN (OPC) V10.20.48**

Dokumen ini merangkum arsitektur, skema database, aturan alur kerja (workflow), mekanisme VSO, **3-Layered Compliance Architecture**, serta antarmuka pemulihan aset dari fitur **Organic Pillar Campaign (OPC)** yang telah sepenuhnya dikembangkan dan diintegrasikan pada MAKNA Engine V10.20.48.

---

## **1. PARADIGMA KONTEN & VALUE PROPOSITION**

OPC dirancang dengan pendekatan *Top-Down Creative Strategy* yang berorientasi pada retensi audiens organik dengan menggunakan struktur **Sandwich Placement (Soft-Selling)**.

*   **Zona 1: The Core Hook (Klip 1)**
    Membuka video murni menggunakan teks "Hook" yang dimasukkan pengguna. Fokus penuh pada retensi 3-5 detik pertama tanpa menyebut produk.
*   **Zona 2: The Organic Companion (Klip 2/Bridging Clip)**
    Produk disisipkan secara halus sebagai properti pelengkap aktivitas (misalnya: *"Sambil ngebahas ini, aku kebetulan lagi rutin pakai [Nama Produk] karena [USP]..."*). Visual pada klip ini dikunci menggunakan **Hybrid Lock Mode** (Imagen 4 T2I -> Veo 3.1 Lite / Kling I2V) demi menjaga konsistensi bentuk produk dari foto referensi yang dikonversi otomatis menjadi **Base64 Data-URI (`resolveProductBase64`)**.
*   **Zona 3: Pillar Continuation (Klip 3, 4, dst.)**
    Narasi dan visual wajib kembali fokus 100% membahas topik utama (**Pilar Konten**) tanpa mempromosikan produk lagi. Menghindari impresi iklan *hard-sell* sehingga penonton mendapatkan nilai edukasi utuh.

---

## **2. ARSITEKTUR KEPATUHAN (3-LAYERED TIKTOK COMPLIANCE ARCHITECTURE)**

Guna menjamin kepatuhan mutlak 100% terhadap kebijakan TikTok Shop & [COMPLIANCE_GUIDE.md](file:///Users/sabeqmmursyid/_maknaflow/kb/COMPLIANCE_GUIDE.md), OPC menerapkan **3-Layered Compliance Architecture**:

```
[ Raw Product Data (E-Commerce/Shopee) ]
                   │
                   ▼
┌───────────────────────────────────────────────────────────┐
│ Layer 1: Pre-Prompt Local Title Sanitizer (< 1 ms)        │
│ - 0 Call API (Lokal Regex Sanitizer)                      │
│ - Cleans: "NEZAFIT Teh Diet Detox..." → "NEZAFIT Teh..."   │
└───────────────────────────────────────────────────────────┘
                   │
                   ▼
┌───────────────────────────────────────────────────────────┐
│ Layer 2: Single-Pass Prompt Generator Call 1 (1 Call API) │
│ - Mandatory Negative Lexicon Blocker Mandate              │
│ - Strict Prohibition: detox, usus kotor, pelangsing, dll.│
│ - Output: Storyboard, VO, Video DNA, & Captions (>99% pass│
└───────────────────────────────────────────────────────────┘
                   │
                   ▼
┌───────────────────────────────────────────────────────────┐
│ Layer 3: Closed-Loop AI Compliance Audit (Zero-Touch)     │
│ - Automatic background audit against COMPLIANCE_GUIDE.md  │
│ - Auto-Rewrite: Produces safe_voiceover if issues found   │
│ - 0 Touch: No human approval button blocking queue        │
└───────────────────────────────────────────────────────────┘
```

1.  **Layer 1 (Pre-Prompt Local Title Sanitizer — < 1 ms)**: Membersihkan kata promo agresif (*detox, pelangsing, usus kotor*) dari nama produk e-commerce mentah secara lokal sebelum dimasukkan ke prompt Gemini.
2.  **Layer 2 (Single-Pass Call 1 Prompt Mandate)**: Menyuntikkan `MANDATORY NEGATIVE LEXICON BLOCKER` langsung ke dalam prompt Call 1.
3.  **Layer 3 (Closed-Loop AI Compliance Audit — Zero-Touch)**: Apabila naskah Call 1 terdeteksi memuat kata berisiko, AI Compliance Audit secara otomatis menulis ulang naskah ke versi `tiktok_safe_voiceover` dan menyimpannya ke database tanpa menghentikan antrean.

---

## **3. STRUKTUR DATABASE (data/makna_grid.db)**

Konfigurasi kampanye OPC dan item-itemnya disimpan dalam dua tabel utama yang saling berelasi:

### **Tabel: `pillar_campaigns`**
```sql
CREATE TABLE IF NOT EXISTS pillar_campaigns (
  id TEXT PRIMARY KEY,
  campaign_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  content_pillar TEXT NOT NULL,
  custom_hook TEXT NOT NULL,
  visual_action_guideline TEXT NOT NULL,
  custom_instruction TEXT,
  brand_profile_id TEXT REFERENCES brand_profiles(id) ON DELETE SET NULL,
  narrative_mode TEXT DEFAULT 'Storytelling',
  visual_style TEXT DEFAULT 'Cinematic',
  face_visibility TEXT DEFAULT 'Faceless',
  is_bridging_active INTEGER DEFAULT 0,
  target_clips_count INTEGER DEFAULT 4,
  bridge_at_clip INTEGER DEFAULT 2,
  bridge_duration_clips INTEGER DEFAULT 1,
  bridging_mode TEXT DEFAULT 'select_existing',
  target_product_id TEXT REFERENCES product_extractions(id) ON DELETE SET NULL,
  ephemeral_product_data TEXT,
  aspect_ratio TEXT DEFAULT '9:16',
  target_ai TEXT DEFAULT 'Google Veo (8s)',
  video_model TEXT DEFAULT 'veo_31_lite',
  visual_mode TEXT DEFAULT 'hybrid_lock',
  product_ref_image_path TEXT,
  target_language TEXT DEFAULT 'id-ID',
  enable_vo_audit INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### **Tabel: `pillar_campaign_items`**
```sql
CREATE TABLE IF NOT EXISTS pillar_campaign_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id TEXT NOT NULL REFERENCES pillar_campaigns(id) ON DELETE CASCADE,
  item_index INTEGER NOT NULL,
  hook TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  compliance_status TEXT DEFAULT 'pending',
  selected_vo_version TEXT DEFAULT 'original',
  original_voiceover TEXT,
  tiktok_safe_voiceover TEXT,
  compliance_score TEXT,
  compliance_log_json TEXT,
  result_json TEXT,
  t2i_start_frame_path TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## **4. ALUR KERJA AUTOMATED VIDEO PRODUCTION (5 PHASES)**

```text
[1. Pillar Generator] ──► [2. TTS Studio Audio] ──► [3. G-Labs I2V Video] ──► [4. FFmpeg Stitch] ──► [5. Social Package / Caption]
```

*   **Phase 1 (Pillar Generator)**: Menghasilkan Storyboard, Naskah Voiceover, dan Social Media Package.
*   **Phase 2 (TTS Studio)**: Mengonversi naskah voiceover aman (`tiktok_safe_voiceover`) menjadi file audio `.mp3`.
*   **Phase 3 (G-Labs I2V)**: Mengirimkan Start Frame Base64 (`resolveProductBase64`) ke G-Labs Webhook (`mode: 'start_image'`).
*   **Phase 4 (FFmpeg Assembly)**: Menggabungkan file video `.mp4` dan file audio `.mp3` menjadi video utuh.
*   **Phase 5 (Social Media Package & UI Tab 2)**: Menampilkan Caption Universal secara otomatis di UI Tab 2 (`/pillar-campaigns/[id]`).
