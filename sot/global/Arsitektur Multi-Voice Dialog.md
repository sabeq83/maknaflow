# Arsitektur Multi-Voice Dialog — MAKNA Engine

**Status**: AKTIF sejak v10.19.0  
**Modul terkait**: RE Campaigns, OPC Pillar Campaigns, Sheets Autopilot

---

## Konsep Inti

Multi-Voice Dialog memungkinkan 2 karakter maskot berbicara dalam satu klip video dengan **suara yang berbeda dan konsisten**. Suara dikunci per-karakter dalam `voice_cast_json` pada level kampanye.

---

## Arsitektur Data

### 1. `voice_cast_json` (disimpan di tabel `re_campaigns` / `pillar_campaigns` / `sheets_autopilot_campaigns`)

```json
{
  "characters": [
    {
      "id": "ginger",
      "name": "Ginger Guardian",
      "gemini_voice_id": "Algenib",
      "minimax_voice_id": "Indonesian_energetic_streamer_vv2"
    },
    {
      "id": "mint",
      "name": "Mint Cool",
      "gemini_voice_id": "Puck",
      "minimax_voice_id": "Indonesian_crisp_reporter_vv2"
    }
  ]
}
```

**Scope**: Per-kampanye. Setiap kampanye memiliki `voice_cast_json` sendiri.

---

### 2. Format `voiceover` Array (dalam database, kolom `voiceover`)

**Klip tanpa dialog (single voice):**
```json
{
  "clip": 1,
  "narration": "Hai guys! Tau nggak sih jahe itu bisa mengatasi kembung dalam 5 menit?",
  "voice_segments": null
}
```

**Klip dengan dialog (multi-voice):**
```json
{
  "clip": 2,
  "narration": "[GINGER]: Saya Ginger! [MINT]: Dan saya Mint! Bersama kami melawan perut kembung!",
  "voice_segments": [
    { "character_id": "ginger", "text": "Saya Ginger! Kamu tahu nggak sih, jahe itu bisa ngatasi kembung dalam 5 menit?" },
    { "character_id": "mint", "text": "Dan saya Mint! Kombinasi kami bikin perut nyaman sepanjang hari!" }
  ]
}
```

---

## TTS Pipeline Flow

```
voiceover[c]
    │
    ├── voice_segments = null?
    │       ↓ YES
    │   generateMinimaxVO(narration, globalVoicePersona)
    │       ↓
    │   → 1 file audio (clip_N.mp3)
    │
    └── voice_segments = [...] (2 items)?
            ↓ YES
        for each segment:
            charVoice = voiceCast.find(ch.id === segment.character_id)
            generateMinimaxVO(segment.text, charVoice.minimax_voice_id)
            → seg_N_characterA.mp3
            → seg_N_characterB.mp3
        ffmpeg concat [segA, segB] → clip_N.mp3
        ↓
    → 1 file audio per klip (dengan 2 suara berbeda)
    
All clips → ffmpeg concat → combined_final.mp3
```

---

## Aturan Dialog (KB Mandate 94 v2.0)

| Aturan | Nilai |
|---|---|
| Trigger | `audio_segment_mode = ENABLED` + 2 karakter visual hadir |
| Pemilih dialog | **Otonom** (Gemini) |
| Maks karakter per klip | **2** (maks 4 detik/karakter) |
| Format output | `voice_segments` array |
| Konsistensi ID | `character_id` slug harus sama di semua klip |
| Fallback | `voice_segments = null` → gunakan global voice persona |

---

## Voice Mapping (Gemini → Minimax)

Mapping sudah ada di `lib/minimax-tts.js` `GEMINI_TO_MINIMAX_MAP`.  
Untuk karakter maskot baru, tambahkan ke mapping di file tersebut.

**Default Mascot Voice Mapping** (dari Mandate 93):

| Maskot | Gemini Voice ID | Minimax ID | Karakter Suara |
|---|---|---|---|
| Ginger/Jahe | Algenib | Indonesian_energetic_streamer_vv2 | Energik, hangat |
| Mint | Puck | Indonesian_crisp_reporter_vv2 | Segar, tajam |
| Kunyit | Callirrhoe | Indonesian_intellectual_commentator_vv2 | Berwibawa |
| Temulawak | Aoede | Indonesian_crisp_reporter_vv2 | Ceria |
| Wajan | Algenib | Indonesian_energetic_streamer_vv2 | Bertenaga |
| Blender | Puck | Indonesian_crisp_reporter_vv2 | Cepat |
| Kucing | Orus | Indonesian_casual_reporter_vv2 | Santai |
| Anjing | Algenib | Indonesian_energetic_streamer_vv2 | Antusias |

---

## Konsistensi Suara — Mekanisme Kunci

Konsistensi dijamin oleh **`voice_cast_json`** yang disimpan di level kampanye:

1. User set Voice Cast satu kali di UI (atau sistem set otomatis berdasarkan Mascot Universe)
2. `voice_cast_json` tersimpan di database bersama kampanye
3. Setiap klip yang render TTS → lookup `character_id` dari `voice_cast_json`
4. Voice tidak berubah antar klip karena selalu dibaca dari source yang sama

---

## Batasan Diketahui

- **Gemini TTS provider**: Saat ini `gemini-8s-tts.js` hanya support 1 voiceName per request → multi-segment hanya di-support oleh Minimax TTS provider
- **Durasi**: Maks 2 karakter × ~4 detik dalam klip 8 detik. Untuk klip 5 detik (Kling), maks 2 × 2.5 detik
- **Voice Cast scope**: Per-kampanye (tidak shared antar kampanye)
