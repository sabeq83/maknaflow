// Voice Personas Definition (Google TTS Mappings)
// Sumber: V5 Instant Product-to-Content Factory Blueprint Appendix

export const VOICE_PERSONAS = [
  // --- FEMALE VOICES ---
  {
    id: "Aoede",
    alias: "Farah",
    gender: "Female",
    description: "Ramah, Ceria, Mainstream (Lifestyle, Review)",
    identity_layer: { voice_id: "Aoede", google_technical_id: "id-ID-Neural2-A", gender: "Female", biological_age: "20", origin: "Jakarta_Pusat" },
    acoustic_layer: { timbre: "Bright_Cheerful", pitch_floor: "High", vocal_tract_length: "Short", breath_signature: "Light_Quick" },
    sociological_layer: { accent: "Mainstream_Jakarta", class_code: "General_Pop" }
  },
  {
    id: "Leda",
    alias: "Salma",
    gender: "Female",
    description: "Lembut, Sopan, Keibuan (Parenting, Quotes)",
    identity_layer: { voice_id: "Leda", google_technical_id: "id-ID-Wavenet-A", gender: "Female", biological_age: "35", origin: "Bandung_Soft" },
    acoustic_layer: { timbre: "Warm_Round", pitch_floor: "Mid-Low", vocal_tract_length: "Medium", breath_signature: "Relaxed_Deep" },
    sociological_layer: { accent: "Polite_Indonesian", class_code: "Maternal_Care" }
  },
  {
    id: "Despina",
    alias: "Zara",
    gender: "Female",
    description: "Energik, Lugas, Cepat (Promo, Racun TikTok)",
    identity_layer: { voice_id: "Despina", google_technical_id: "id-ID-Wavenet-D", gender: "Female", biological_age: "22", origin: "Jakarta_Selatan" },
    acoustic_layer: { timbre: "Sharp_Airy", pitch_floor: "High-Mid", vocal_tract_length: "Short", breath_signature: "Audible_Sharp_Inhale" },
    sociological_layer: { accent: "Urban_Jaksel_Slang", class_code: "Trendsetter" }
  },
  {
    id: "Callirrhoe",
    alias: "Rania",
    gender: "Female",
    description: "Profesional, Jelas, Anchor (Berita, Corporate)",
    identity_layer: { voice_id: "Callirrhoe", google_technical_id: "id-ID-Standard-A", gender: "Female", biological_age: "30", origin: "Jakarta_Formal" },
    acoustic_layer: { timbre: "Clear_Precise", pitch_floor: "Mid", vocal_tract_length: "Medium", breath_signature: "Controlled_Steady" },
    sociological_layer: { accent: "Broadcast_Standard", class_code: "Professional" }
  },
  {
    id: "Autonoe",
    alias: "Noura",
    gender: "Female",
    description: "Inspiratif, Hangat, Storyteller (Dokumenter, Soft-Sell)",
    identity_layer: { voice_id: "Autonoe", google_technical_id: "id-ID-Standard-B", gender: "Female", biological_age: "28", origin: "Neutral_Warm" },
    acoustic_layer: { timbre: "Resonant_Flowing", pitch_floor: "Mid", vocal_tract_length: "Medium", breath_signature: "Expressive_Pause" },
    sociological_layer: { accent: "Narrative_Indonesian", class_code: "Storyteller" }
  },
  {
    id: "Erinome",
    alias: "Lina",
    gender: "Female",
    description: "Halus, Menenangkan, ASMR (Skincare, Spa)",
    identity_layer: { voice_id: "Erinome", google_technical_id: "id-ID-Wavenet-C", gender: "Female", biological_age: "24", origin: "Soft_Whisper" },
    acoustic_layer: { timbre: "Breathy_Delicate", pitch_floor: "Mid", vocal_tract_length: "Short", breath_signature: "Heavy_ASMR_Breath" },
    sociological_layer: { accent: "Soft_Spoken", class_code: "Intimate" }
  },
  {
    id: "Laomedeia",
    alias: "Malika",
    gender: "Female",
    description: "Tegas, Berani, Dominan (Motivasi Keras, Bahaya)",
    identity_layer: { voice_id: "Laomedeia", google_technical_id: "id-ID-Standard-C", gender: "Female", biological_age: "32", origin: "Jakarta_Corporate" },
    acoustic_layer: { timbre: "Hard_Metallic", pitch_floor: "Low-Mid", vocal_tract_length: "Medium", breath_signature: "Short_Punchy" },
    sociological_layer: { accent: "Assertive_Standard", class_code: "Authority" }
  },
  {
    id: "Achernar",
    alias: "Safira",
    gender: "Female",
    description: "Anggun, Elegan, Luxury (Perhiasan, Fashion)",
    identity_layer: { voice_id: "Achernar", google_technical_id: "id-ID-Neural2-A", gender: "Female", biological_age: "29", origin: "High_Society" },
    acoustic_layer: { timbre: "Velvet_Smooth", pitch_floor: "Mid-Low", vocal_tract_length: "Medium", breath_signature: "Slow_Controlled" },
    sociological_layer: { accent: "Sophisticated_Indo", class_code: "Luxury" }
  },

  // --- MALE VOICES ---
  {
    id: "Charon",
    alias: "Bilal",
    gender: "Male",
    description: "Deep, Naratif, Berat (Trailer, Horor, Otomotif)",
    identity_layer: { voice_id: "Charon", google_technical_id: "id-ID-Standard-C", gender: "Male", biological_age: "45", origin: "Deep_Voice_Talent" },
    acoustic_layer: { timbre: "Deep_Gravel", pitch_floor: "Low", vocal_tract_length: "Long", breath_signature: "Rumbling_Chest" },
    sociological_layer: { accent: "Dramatic_Standard", class_code: "Narrator" }
  },
  {
    id: "Puck",
    alias: "Zayn",
    gender: "Male",
    description: "Muda, Bersemangat, Gen Z (Game, Gadget)",
    identity_layer: { voice_id: "Puck", google_technical_id: "id-ID-Wavenet-B", gender: "Male", biological_age: "19", origin: "Jakarta_Youth" },
    acoustic_layer: { timbre: "Bright_Thin", pitch_floor: "High", vocal_tract_length: "Short", breath_signature: "Excited_Pant" },
    sociological_layer: { accent: "Gaming_Slang", class_code: "Youth" }
  },
  {
    id: "Fenrir",
    alias: "Umar",
    gender: "Male",
    description: "Berat, Maskulin, Berwibawa (Kesehatan, Investasi)",
    identity_layer: { voice_id: "Fenrir", google_technical_id: "id-ID-Neural2-C", gender: "Male", biological_age: "50", origin: "Formal_Authority" },
    acoustic_layer: { timbre: "Full_Resonant", pitch_floor: "Low", vocal_tract_length: "Long", breath_signature: "Steady_Weighted" },
    sociological_layer: { accent: "Formal_Baku", class_code: "Leader" }
  },
  {
    id: "Orus",
    alias: "Faris",
    gender: "Male",
    description: "Santai, Sejuk, Teman Nongkrong (Podcast, Vlog)",
    identity_layer: { voice_id: "Orus", google_technical_id: "id-ID-Standard-B", gender: "Male", biological_age: "27", origin: "Jakarta_Chill" },
    acoustic_layer: { timbre: "Raspy_Relaxed", pitch_floor: "Mid-Low", vocal_tract_length: "Medium", breath_signature: "Lazy_Exhale" },
    sociological_layer: { accent: "Coffee_Shop_Talk", class_code: "Everyman" }
  },
  {
    id: "Algenib",
    alias: "Samir",
    gender: "Male",
    description: "Ceria, High Energy, Sales (Promo, Elektronik)",
    identity_layer: { voice_id: "Algenib", google_technical_id: "id-ID-Wavenet-C", gender: "Male", biological_age: "30", origin: "Sales_Floor" },
    acoustic_layer: { timbre: "Loud_Compressed", pitch_floor: "High-Mid", vocal_tract_length: "Medium", breath_signature: "Power_Inhale" },
    sociological_layer: { accent: "Sales_Pitch_Standard", class_code: "Commercial" }
  },
  {
    id: "Iapetus",
    alias: "Idris",
    gender: "Male",
    description: "Serius, Edukatif, Dosen (Tutorial, Edukasi)",
    identity_layer: { voice_id: "Iapetus", google_technical_id: "id-ID-Standard-A", gender: "Male", biological_age: "40", origin: "Academic_Hall" },
    acoustic_layer: { timbre: "Dry_Clear", pitch_floor: "Mid", vocal_tract_length: "Medium", breath_signature: "Minimal" },
    sociological_layer: { accent: "Educated_Formal", class_code: "Academic" }
  }
];

export function getVoicePersona(id) {
  return VOICE_PERSONAS.find(v => v.id === id) || VOICE_PERSONAS[0];
}
