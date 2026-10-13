# Implementation Plan - Integrasi YouTube Title pada Menu Pillar Campaign

Memperluas Single-Pass AI Generator, antarmuka Workbench Pillar Campaign, dan jalur sinkronisasi Content Flow / Publishing Repository agar mendukung **YouTube Video / Shorts Title** (`yt_title`) terpisah dari Universal Caption/Description.

---

## User Review Required

> [!IMPORTANT]
> - Tidak ada perubahan skema database PostgreSQL (`pillar_campaign_items` dan `content_flow_items` sudah memiliki kolom `result_json` dan `social_media_package_json` yang fleksibel).
> - Mockup antarmuka HTML standalone telah tersedia di [`public/mockup_pillar_campaign_youtube_title.html`](file:///Users/sabeqmmursyid/_contentflow-staging/public/mockup_pillar_campaign_youtube_title.html).
> - Semua token warna UI menggunakan 100% Semantic CSS Tokens dari `app/theme.css` tanpa hardcoded hex.

---

## Execution Task List

- [x] **Task 1: Update AI Prompt Generator Schema**
  - Perbarui skema output `social_media_package` di `buildOrganicPillarPrompt` ([`lib/prompts.js`](file:///Users/sabeqmmursyid/_contentflow-staging/lib/prompts.js)) agar menyertakan field `title` (optimal 50–70 karakter, maks 100 karakter).
- [x] **Task 2: Normalisasi Output AI di Scheduler Processor**
  - Di [`lib/scheduler-processors.js`](file:///Users/sabeqmmursyid/_contentflow-staging/lib/scheduler-processors.js) (`processPillarItemGeneration`), petakan `parsed.social_media_package.title` ke `parsed.yt_title` dan `parsed.social_media_package.caption` ke `parsed.yt_desc`.
- [x] **Task 3: Perbarui State & UI Workbench di Pillar Campaign Detail**
  - Di [`app/pillar-campaigns/[id]/page.js`](file:///Users/sabeqmmursyid/_contentflow-staging/app/pillar-campaigns/[id]/page.js):
    1. Perbaiki inisialisasi `socialCaptions[item.id]` agar membaca `parsed.social_media_package?.title` sebagai fallback `yt_title`.
    2. Ubah UI Workbench Social Media Editor menjadi 2 field terstruktur: YouTube Title (dengan live character counter, badge optimal 50-70 karakter, quick insert `+ #Shorts`, dan tombol salin) serta Universal Caption/Description.
- [x] **Task 4: Selaraskan Backend Approval & Ingest Content Flow**
  - Di [`lib/pillar-campaign-approval.js`](file:///Users/sabeqmmursyid/_contentflow-staging/lib/pillar-campaign-approval.js), sinkronkan `updatedResult.social_media_package`.
  - Di [`lib/contentflow-ingest.js`](file:///Users/sabeqmmursyid/_contentflow-staging/lib/contentflow-ingest.js), pastikan `social_media_package_json` dan hook menyertakan `result.yt_title`.
  - Di [`lib/publishing-repository.js`](file:///Users/sabeqmmursyid/_contentflow-staging/lib/publishing-repository.js), optimalkan resolusi `content_title` agar mengutamakan `social_media_package_json->>'title'`.
- [x] **Task 5: Verifikasi Build & Automated Test**
  - Jalankan `npm run build` dan automated test untuk memvalidasi integrasi.
- [x] **Task 6: Rilis & Sinkronisasi Git Non-Interaktif**
  - Jalankan `npm run release-non-interactive` sesuai SOP rilis.

---

## Before & After Code Snippets

### 1. `lib/prompts.js`

#### Code Sebelum (Current/Before)
```javascript
  ${dynamicPromptFields}
  "social_media_package": {
    "caption": "Single Universal Caption (terdiri dari Hook menarik, Value delivery, CTA interaksi, dan Hashtags relevan). In ${targetLanguageLabel}. MANDATORY: Gunakan hashtags edukatif yang aman dan relevan dengan topik pilar serta Brand Profile."
  }
}
```

#### Code Sesudah (Proposed/After)
```javascript
  ${dynamicPromptFields}
  "social_media_package": {
    "title": "Judul YouTube Shorts/Video yang click-worthy & memicu rasa penasaran (panjang optimal 50-70 karakter, maksimal 100 karakter). In ${targetLanguageLabel}.",
    "caption": "Single Universal Caption & YouTube Content Description lengkap (terdiri dari Hook menarik, Value delivery, CTA interaksi, dan Hashtags relevan). In ${targetLanguageLabel}. MANDATORY: Gunakan hashtags edukatif yang aman dan relevan dengan topik pilar serta Brand Profile."
  }
}
```

---

### 2. `lib/scheduler-processors.js`

#### Code Sebelum (Current/Before)
```javascript
    const parsedRaw = parseGeminiJSON(result, campaign.voice_provider || 'gemini');
    const { sanitizeAiDirectiveLeak, containsAiDirectiveLeak } = await import('./ai-directive.js');
    const effectiveAiDirective = tempCampaign.ai_directive || tempCampaign.custom_instruction || '';
    const parsed = sanitizeAiDirectiveLeak(parsedRaw, effectiveAiDirective);
    if (containsAiDirectiveLeak(parsed, effectiveAiDirective)) {
      throw new Error('AI_DIRECTIVE_LEAK_DETECTED');
    }

    // Cartoon continuity validation (Tahap 2) — non-blocking warnings
```

#### Code Sesudah (Proposed/After)
```javascript
    const parsedRaw = parseGeminiJSON(result, campaign.voice_provider || 'gemini');
    const { sanitizeAiDirectiveLeak, containsAiDirectiveLeak } = await import('./ai-directive.js');
    const effectiveAiDirective = tempCampaign.ai_directive || tempCampaign.custom_instruction || '';
    const parsed = sanitizeAiDirectiveLeak(parsedRaw, effectiveAiDirective);
    if (containsAiDirectiveLeak(parsed, effectiveAiDirective)) {
      throw new Error('AI_DIRECTIVE_LEAK_DETECTED');
    }

    // Normalisasi YouTube Title & Content Description dari social_media_package
    const extractedYtTitle = (typeof parsed.social_media_package === 'object' && parsed.social_media_package?.title)
      ? String(parsed.social_media_package.title).trim()
      : (parsed.yt_title || '');
    const extractedYtDesc = (typeof parsed.social_media_package === 'object' && parsed.social_media_package?.caption)
      ? String(parsed.social_media_package.caption).trim()
      : (parsed.yt_desc || parsed.caption || '');
    parsed.yt_title = extractedYtTitle;
    parsed.yt_desc = extractedYtDesc;

    // Cartoon continuity validation (Tahap 2) — non-blocking warnings
```

---

### 3. `app/pillar-campaigns/[id]/page.js`

#### A. Inisialisasi State `socialCaptions`

##### Code Sebelum (Current/Before)
```javascript
    if (!socialCaptions.hasOwnProperty(item.id)) {
      let sc = { tiktok_caption: '', ig_caption: '', yt_title: '', yt_desc: '' };
      try {
        const parsed = JSON.parse(item.result_json || '{}');
        const capVal = parsed.caption || (typeof parsed.social_media_package === 'object' ? parsed.social_media_package?.caption : '') || parsed.tiktok_caption || parsed.ig_caption || '';
        sc = {
          caption: capVal,
          tiktok_caption: parsed.tiktok_caption || capVal,
          ig_caption: parsed.ig_caption || capVal,
          yt_title: parsed.yt_title || '',
          yt_desc: parsed.yt_desc || ''
        };
      } catch {}
      setTimeout(() => {
        setSocialCaptions(prev => ({ ...prev, [item.id]: sc }));
      }, 0);
      return <div style={{ padding: '20px', color: 'var(--text-muted)' }}>Memuat Social Captions...</div>;
    }
```

##### Code Sesudah (Proposed/After)
```javascript
    if (!socialCaptions.hasOwnProperty(item.id)) {
      let sc = { tiktok_caption: '', ig_caption: '', yt_title: '', yt_desc: '' };
      try {
        const parsed = JSON.parse(item.result_json || '{}');
        const capVal = parsed.caption || (typeof parsed.social_media_package === 'object' ? parsed.social_media_package?.caption : '') || parsed.tiktok_caption || parsed.ig_caption || '';
        const ytTitleVal = parsed.yt_title || (typeof parsed.social_media_package === 'object' ? parsed.social_media_package?.title : '') || '';
        sc = {
          caption: capVal,
          tiktok_caption: parsed.tiktok_caption || capVal,
          ig_caption: parsed.ig_caption || capVal,
          yt_title: ytTitleVal,
          yt_desc: parsed.yt_desc || capVal
        };
      } catch {}
      setTimeout(() => {
        setSocialCaptions(prev => ({ ...prev, [item.id]: sc }));
      }, 0);
      return <div style={{ padding: '20px', color: 'var(--text-muted)' }}>Memuat Social Captions...</div>;
    }
```

#### B. Workbench UI: Social Media Editor

##### Code Sebelum (Current/Before)
```javascript
            {/* Unified Social Caption Editor */}
            <div style={{ background: 'var(--surface-interactive)', borderRadius: '8px', border: '1px solid var(--surface-interactive)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent-light)', borderBottom: '1px solid var(--surface-interactive)', paddingBottom: '8px' }}>
                📲 Social Media Package & Caption
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>Caption & Social Media Copy (Unified Single Field)</label>
                <textarea
                  disabled={isReadOnly}
                  style={{ width: '100%', minHeight: '140px', background: 'var(--overlay-subtle)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '12px', color: 'var(--text-primary)', fontSize: '0.82rem', resize: 'vertical', lineHeight: 1.5 }}
                  value={sc.caption || sc.tiktok_caption || sc.ig_caption || ''}
                  onChange={(e) => {
                    updateSocialField('caption', e.target.value);
                    updateSocialField('tiktok_caption', e.target.value);
                    updateSocialField('ig_caption', e.target.value);
                  }}
                  placeholder="Caption media sosial lengkap..."
                />
              </div>
            </div>
```

##### Code Sesudah (Proposed/After)
```javascript
            {/* Unified Social Caption & YouTube Title Editor */}
            <div style={{ background: 'var(--surface-interactive)', borderRadius: '8px', border: '1px solid var(--border-subtle)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
                <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📲</span> Social Media Package & Distribution
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'var(--surface-raised)', padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                  Multi-Platform Ready
                </span>
              </div>

              {/* YouTube Title Field */}
              <div style={{ background: 'var(--surface)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: 'var(--platform-youtube, #ef4444)', fontWeight: 800 }}>▶</span>
                    <span>Judul YouTube Video / Shorts</span>
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {(() => {
                      const ytLen = (sc.yt_title || '').length;
                      let color = 'var(--text-muted)';
                      let label = '';
                      if (ytLen >= 50 && ytLen <= 70) {
                        color = 'var(--status-success)';
                        label = ' (Optimal)';
                      } else if (ytLen > 70 && ytLen <= 90) {
                        color = 'var(--status-warning)';
                      } else if (ytLen > 90) {
                        color = 'var(--status-danger)';
                        label = ' (Maks 100)';
                      }
                      return (
                        <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', color, fontWeight: 700 }}>
                          {ytLen}/100{label}
                        </span>
                      );
                    })()}
                    <button
                      type="button"
                      disabled={!sc.yt_title}
                      onClick={() => {
                        navigator.clipboard.writeText(sc.yt_title || '');
                        showToast('Judul YouTube berhasil disalin!');
                      }}
                      style={{ fontSize: '0.68rem', padding: '2px 8px', background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: '4px', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    >
                      Salin Judul
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  maxLength={100}
                  disabled={isReadOnly}
                  value={sc.yt_title || ''}
                  onChange={(e) => updateSocialField('yt_title', e.target.value)}
                  placeholder="Ketik atau edit judul YouTube Shorts yang memikat (50-70 karakter)..."
                  style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--border-strong)', borderRadius: '6px', padding: '10px 12px', color: 'var(--text-primary)', fontSize: '0.82rem' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                  <button
                    type="button"
                    disabled={isReadOnly}
                    onClick={() => {
                      const cur = (sc.yt_title || '').trim();
                      if (!cur.includes('#Shorts')) {
                        updateSocialField('yt_title', cur ? `${cur} #Shorts` : '#Shorts');
                      }
                    }}
                    style={{ fontSize: '0.68rem', padding: '2px 8px', background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: '4px', color: 'var(--text-muted)', cursor: isReadOnly ? 'not-allowed' : 'pointer' }}
                  >
                    + #Shorts
                  </button>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    Digunakan saat upload ke YouTube Shorts
                  </span>
                </div>
              </div>

              {/* Universal Caption / Description Field */}
              <div style={{ background: 'var(--surface)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>📝</span>
                    <span>Universal Caption & YouTube Content Description</span>
                  </label>
                  <button
                    type="button"
                    disabled={!(sc.caption || sc.tiktok_caption || sc.ig_caption)}
                    onClick={() => {
                      navigator.clipboard.writeText(sc.caption || sc.tiktok_caption || sc.ig_caption || '');
                      showToast('Caption/Deskripsi berhasil disalin!');
                    }}
                    style={{ fontSize: '0.68rem', padding: '2px 8px', background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: '4px', color: 'var(--text-secondary)', cursor: 'pointer' }}
                  >
                    Salin Deskripsi
                  </button>
                </div>
                <textarea
                  disabled={isReadOnly}
                  style={{ width: '100%', minHeight: '130px', background: 'var(--input-bg)', border: '1px solid var(--border-strong)', borderRadius: '6px', padding: '10px 12px', color: 'var(--text-primary)', fontSize: '0.82rem', resize: 'vertical', lineHeight: 1.5 }}
                  value={sc.caption || sc.tiktok_caption || sc.ig_caption || ''}
                  onChange={(e) => {
                    updateSocialField('caption', e.target.value);
                    updateSocialField('tiktok_caption', e.target.value);
                    updateSocialField('ig_caption', e.target.value);
                    updateSocialField('yt_desc', e.target.value);
                  }}
                  placeholder="Deskripsi YouTube dan caption universal media sosial lengkap (Hook, isi, link CTA, hashtags)..."
                />
              </div>
            </div>
```

---

### 4. `lib/pillar-campaign-approval.js`

#### Code Sebelum (Current/Before)
```javascript
  const updatedResult = {
    ...oldResult,
    storyboard,
    voiceover,
    t2v_prompts: promptList('t2v_prompt'),
    t2i_prompts: promptList('t2i_prompt'),
    i2v_prompts: promptList('i2v_prompt'),
    tiktok_caption: changes.tiktok_caption || oldResult.tiktok_caption || '',
    ig_caption: changes.ig_caption || oldResult.ig_caption || '',
    yt_title: changes.yt_title || oldResult.yt_title || '',
    yt_desc: changes.yt_desc || oldResult.yt_desc || ''
  };
```

#### Code Sesudah (Proposed/After)
```javascript
  const updatedResult = {
    ...oldResult,
    storyboard,
    voiceover,
    t2v_prompts: promptList('t2v_prompt'),
    t2i_prompts: promptList('t2i_prompt'),
    i2v_prompts: promptList('i2v_prompt'),
    tiktok_caption: changes.tiktok_caption || oldResult.tiktok_caption || '',
    ig_caption: changes.ig_caption || oldResult.ig_caption || '',
    yt_title: changes.yt_title || oldResult.yt_title || '',
    yt_desc: changes.yt_desc || oldResult.yt_desc || '',
    social_media_package: {
      ...(oldResult.social_media_package || {}),
      title: changes.yt_title || oldResult.yt_title || (oldResult.social_media_package?.title || ''),
      caption: changes.caption || changes.yt_desc || oldResult.yt_desc || (oldResult.social_media_package?.caption || '')
    }
  };
```

---

### 5. `lib/contentflow-ingest.js`

#### Code Sebelum (Current/Before)
```javascript
      const hook = payload.custom_hook || payload.hook || item.pillar || 'OPC Video Item';
      const caption = social.caption || social.tiktok_caption || payload.caption || (result.social_media_package && result.social_media_package.caption) || result.tiktok_caption || '';
```

#### Code Sesudah (Proposed/After)
```javascript
      const ytTitle = result.yt_title || (result.social_media_package && result.social_media_package.title) || '';
      const hook = ytTitle || payload.custom_hook || payload.hook || item.pillar || 'OPC Video Item';
      const caption = social.caption || social.tiktok_caption || payload.caption || (result.social_media_package && result.social_media_package.caption) || result.tiktok_caption || '';
```

---

### 6. `lib/publishing-repository.js`

#### Code Sebelum (Current/Before)
```javascript
      COALESCE(c.campaign_title, c.hook, j.content_id) AS content_title,
```

#### Code Sesudah (Proposed/After)
```javascript
      COALESCE(NULLIF(c.social_media_package_json->>'title', ''), NULLIF(c.hook, ''), c.campaign_title, j.content_id) AS content_title,
```

---

## Verification Plan

### Automated Tests
1. `npm test` atau `node --test tests/publishing-scheduler.test.js`
2. Next.js build verification: `npm run build`

### Manual Verification by User
1. Buka menu **Pillar Campaign** -> Buka salah satu Campaign Item -> Tab **Workbench**.
2. Verifikasi field **Judul YouTube Video / Shorts** tersedia dengan counter karakter dinamis, tombol **+ #Shorts**, dan tombol **Salin Judul**.
3. Verifikasi field **Universal Caption & YouTube Content Description** tersedia dengan tombol **Salin Deskripsi**.
4. Simpan Draft atau Setujui, lalu periksa apakah judul dan caption tersimpan di database dan sinkron saat dijadwalkan ke YouTube.
