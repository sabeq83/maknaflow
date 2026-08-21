# SOT: Visual Identity Studio (Design with AI)

Visual Identity Studio di MAKNA Flow mendukung pembuatan preset identitas visual baik secara manual maupun berbasis kognitif otonom melalui fitur **Design with AI**.

---

## 1. Alur Kerja (Workflow)
Penyusunan identitas visual menggunakan alur modular yang memisahkan pembentukan draf kognitif dari penyimpanan permanen:
1. **Brief Entry:** Pengguna memasukkan Creative Brief berupa arahan seed visual (natural language) dan filter penunjang.
2. **AI Single-Pass Generation:** Sistem memanggil satu API Call ke Gemini AI untuk menyusun draf identitas visual lengkap.
3. **Validation & Compliance Checking:** Server memproses draf, menerapkan normalisasi, mengunci guardrails faceless, dan menghasilkan laporan kepatuhan (*compliance report*).
4. **Interactive Review & Refinement:** Pengguna dapat meninjau, mengedit parameter draf secara langsung, atau mengirimkan instruksi penyempurnaan (*refinement*) satu langkah.
5. **Handoff & Persistence:** Melalui aksi `Continue in Studio Editor`, draf diumpankan untuk mengisi form editor utama. Penyimpanan preset ke database tetap dikendalikan secara eksplisit oleh pengguna melalui API existing.

---

## 2. API Endpoints

### POST `/api/v2/visual-identities/ai/generate`
Membuat draf visual identity baru berdasarkan brief kognitif.
- **Request Body (AI Creative Brief):**
  ```json
  {
    "seed": "Skincare Muslimah premium, tone sage green hangat",
    "subject_kind": "human",
    "faceless_mode": "hands_only",
    "aspect_ratio": "9:16",
    "variation_level": "balanced",
    "mood": "calm",
    "wardrobe_direction": "gamis sage, wrists covered",
    "color_direction": "sage green, cream",
    "environment_direction": "nordic kitchen",
    "lighting_direction": "window daylight",
    "camera_direction": "close-up hands",
    "style_direction": "cinematic photo",
    "special_constraints": "no mirror showing face"
  }
  ```
- **Response Body (AI Output Envelope):**
  ```json
  {
    "success": true,
    "data": {
      "label": "Sage Skincare Preset",
      "description": "Premium faceless skincare aesthetic",
      "suggested_preset_key": "sage_skincare_preset",
      "creative_rationale": "Using soft window lights to build trust...",
      "config": {
        "schema_version": "1",
        "subject": { "kind": "human", "faceless_mode": "hands_only" },
        "wardrobe": { "mode": "fixed", "preset_key": "sage_muted" },
        "environment": { "preset_key": "nordic_kitchen" },
        "lighting": { "preset_key": "window_daylight" },
        "camera": { "framing": "forearms_and_hands" },
        "style": { "preset_key": "cinematic_realistic" },
        "guardrails": { "face_visibility": "prohibited" }
      },
      "compliance": {
        "status": "compliant",
        "score": 100,
        "checks": [],
        "corrections": [],
        "warnings": []
      },
      "resolved_preview": {
        "subject_prompt": "...",
        "wardrobe_prompt": "...",
        "environment_prompt": "..."
      }
    }
  }
  ```

### POST `/api/v2/visual-identities/ai/refine`
Menyempurnakan draf visual identity yang ada dengan instruksi teks satu langkah.
- **Request Body:**
  ```json
  {
    "brief": { ... },
    "current_draft": { ... },
    "instruction": "Buat pencahayaan lebih dramatis dan ganti palette wardrobe ke mocca"
  }
  ```

---

## 3. Cost & Security Controls
- **Single-Call Architecture:** Setiap aksi generate atau refine hanya memicu maksimal satu call ke Gemini API.
- **Strict Validation:** Input seed dibatasi maksimal 3.000 karakter, dan instruksi refine maksimal 1.000 karakter.
- **Prompt Injection Defense:** Input pengguna diperlakukan sebagai untrusted data di dalam prompt envelope kognitif.
- **Faceless Invariants Enforcement:** Jika pengguna meminta "visible face" pada model manusia, server secara deterministik mengoreksinya menjadi "prohibited" atau menolak request dengan error `FACELESS_POLICY_VIOLATION` (Status `422`).
- **No Persistence:** Data draf AI yang dibatalkan (*cancelled*) tidak pernah disimpan ke database.

---

## 4. Error Mapping
- `400 INVALID_AI_VISUAL_BRIEF`: Validasi skema brief gagal.
- `422 FACELESS_POLICY_VIOLATION`: Upaya pelemahan guardrail wajah yang terdeteksi pada teks input.
- `422 INVALID_AI_VISUAL_OUTPUT`: Format JSON dari Gemini tidak lengkap atau cacat.
- `429/503 AI_TEMPORARILY_UNAVAILABLE`: Quota limit atau overload layanan Gemini.
- `500 INTERNAL_ERROR`: Internal server error.
