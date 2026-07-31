# **DOCUMENT SOT: 3-LAYERED TIKTOK COMPLIANCE GATE ARCHITECTURE**

Dokumen ini merupakan **Source of Truth (SOT)** resmi mengenai arsitektur sistem kepatuhan **3-Layered Compliance Architecture (v2.2.29)** pada MAKNA Flow Multi-Node Cluster.

---

## 🏗️ ARSITEKTUR 3-LAYERED COMPLIANCE

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

---

## 📌 DETAIL IMPLEMENETASI 3 LAYER

### 1. **Layer 1: Pre-Prompt Product Title & Info Sanitizer (`lib/product-sanitizer.js`)**
*   **Kecepatan & Overhead**: **0 Call API** (< 1 milidetik lokal).
*   **Fungsi Utama**: `sanitizeProductTitle(rawTitle)` dan `sanitizeProductUsp(rawUsp)`.
*   **Pola Regex**: `/\b(detox|detoks|detoksifikasi|pelangsing|penurun\s+berat\s+badan|slimming|usus\s+kotor|luntur\s+lemak|tanpa\s+efek\s+samping|tanpa\s+ketergantungan|ampuh|pembakar\s+lemak|obat\s+penyakit|menyembuhkan|mengobati)\b/gi`.
*   **Dampak**: Menghilangkan akar penyebab utama AI menyerap kata terlarang dari judul e-commerce mentah.

### 2. **Layer 2: Prompt Generator Call 1 Mandate (`lib/prompts.js`)**
*   **Mandat Utama**: `MANDATORY NEGATIVE LEXICON BLOCKER` disuntikkan secara eksplisit ke dalam `UNIVERSAL_ZERO_TESTIMONY_MANDATE`.
*   **Aturan**: Melarang mutlak kata/turunan kata *detox, detoks, usus kotor, pelangsing, peluntur lemak, tanpa efek samping, tanpa ketergantungan*.
*   **Hasil**: **>99% draft naskah Call 1 langsung lulus 100% compliant**.

### 3. **Layer 3: Closed-Loop AI Compliance Audit (`lib/tiktok-compliance-service.js`)**
*   **Sifat Eksekusi**: **100% Otomatis (Zero-Touch)** tanpa menunggu tombol approval manusia.
*   **Output Audit**:
    *   `pass`: Langsung menggunakan naskah original.
    *   `revise`: Gemini AI Compliance Auditor menulis ulang naskah secara utuh (*paraphrase & re-framing*) ke versi `tiktok_safe_voiceover` dan otomatis disimpan ke database.
*   **Aturan Scheduler**: Apabila `selected_vo_version` bernilai `tiktok_safe`, scheduler secara otomatis mengalirkan naskah revisi aman ke pengisi suara (TTS) dan Webhook G-Labs.
