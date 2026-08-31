import crypto from 'crypto';

export function normalizeHermesResearchBrief(input, policy = {}) {
  const schemaVersion = String(input.schema_version || '1');
  if (schemaVersion !== '1') {
    throw new Error(`Schema version tidak didukung: ${schemaVersion}`);
  }

  const researchedAt = input.researched_at ? new Date(input.researched_at) : null;
  if (!researchedAt || isNaN(researchedAt.getTime())) {
    throw new Error('researched_at wajib berupa format ISO-8601 yang valid.');
  }

  const maxAgeHours = Number(policy.max_research_age_hours || 48);
  const ageHours = (Date.now() - researchedAt.getTime()) / (1000 * 60 * 60);
  if (ageHours > maxAgeHours) {
    throw new Error(`Evidence kadaluarsa: ${ageHours.toFixed(1)} jam (maksimal ${maxAgeHours} jam).`);
  }

  const query = String(input.query || '').trim();
  if (!query) throw new Error('Query wajib diisi.');

  const summary = String(input.summary || '').trim();
  if (summary.length > 5000) throw new Error('Summary melebihi batas maksimum 5000 karakter.');

  const sources = Array.isArray(input.sources) ? input.sources : [];
  if (sources.length > 30) throw new Error('Jumlah sumber melebihi batas maksimum 30.');

  const sourceMap = new Map();
  for (const s of sources) {
    const id = String(s.id || '').trim();
    const url = String(s.url || '').trim();
    if (!id || !url) throw new Error('Setiap source wajib memiliki id dan url.');
    if (id.length > 100 || sourceMap.has(id)) throw new Error(`Source id duplikat atau terlalu panjang: ${id}`);
    if (!url.startsWith('https://')) throw new Error(`URL non-HTTPS tidak diizinkan: ${url}`);
    if (url.length > 1024) throw new Error('URL sumber melebihi batas 1024 karakter.');
    sourceMap.set(id, s);
  }

  const insights = Array.isArray(input.insights) ? input.insights : [];
  if (insights.length > 30) throw new Error('Jumlah insights melebihi batas maksimum 30.');

  for (const i of insights) {
    const claim = String(i.claim || '').trim();
    if (!claim) throw new Error('Insight claim tidak boleh kosong.');
    const confidence = Number(i.confidence ?? 0.0);
    if (confidence < 0 || confidence > 1) {
      throw new Error(`Confidence score tidak valid: ${confidence}`);
    }
    const sourceIds = Array.isArray(i.source_ids) ? i.source_ids : [];
    for (const srcId of sourceIds) {
      if (!sourceMap.has(srcId)) {
        throw new Error(`Insight claim merujuk source_id yang tidak ada: ${srcId}`);
      }
    }
  }

  const recommendedAngles = Array.isArray(input.recommended_angles) ? input.recommended_angles : [];
  if (recommendedAngles.length > 12) throw new Error('Jumlah recommended angles melebihi batas maksimum 12.');

  for (const a of recommendedAngles) {
    const title = String(a.title || '').trim();
    if (!title) throw new Error('Angle title tidak boleh kosong.');
    const risk = String(a.risk_level || 'low').toLowerCase();
    if (!['low', 'medium', 'high'].includes(risk)) {
      throw new Error(`Risk level tidak valid: ${a.risk_level}`);
    }
    const sourceIds = Array.isArray(a.source_ids) ? a.source_ids : [];
    for (const srcId of sourceIds) {
      if (!sourceMap.has(srcId)) {
        throw new Error(`Angle merujuk source_id yang tidak ada: ${srcId}`);
      }
    }
  }

  return Object.freeze({
    schema_version: schemaVersion,
    query,
    researched_at: researchedAt.toISOString(),
    locale: String(input.locale || 'id-ID').trim(),
    summary,
    insights: insights.map(i => ({
      claim: String(i.claim).trim(),
      confidence: Number(i.confidence),
      source_ids: (i.source_ids || []).map(String)
    })),
    sources: sources.map(s => {
      const publishedAt = s.published_at ? new Date(s.published_at) : null;
      const retrievedAt = s.retrieved_at ? new Date(s.retrieved_at) : new Date();
      if ((publishedAt && Number.isNaN(publishedAt.getTime())) || Number.isNaN(retrievedAt.getTime())) {
        throw new Error(`Timestamp source tidak valid: ${s.id}`);
      }
      return {
      id: String(s.id).trim(),
      url: String(s.url).trim(),
      title: String(s.title || '').trim().slice(0, 500),
      publisher: String(s.publisher || '').trim().slice(0, 300),
      published_at: publishedAt ? publishedAt.toISOString() : null,
      retrieved_at: retrievedAt.toISOString()
    }}),
    recommended_angles: recommendedAngles.map(a => ({
      title: String(a.title).trim(),
      reason: String(a.reason || '').trim(),
      risk_level: String(a.risk_level).toLowerCase(),
      source_ids: (a.source_ids || []).map(String)
    })),
    prohibited_claims: (Array.isArray(input.prohibited_claims) ? input.prohibited_claims : []).map(String).map(s => s.trim()).filter(Boolean).slice(0, 30),
    limitations: (Array.isArray(input.limitations) ? input.limitations : []).map(String).map(s => s.trim()).filter(Boolean).slice(0, 30)
  });
}

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = sortDeep(value[key]);
    return result;
  }, {});
}

export function hashHermesResearchBrief(brief) {
  return crypto.createHash('sha256').update(JSON.stringify(sortDeep(brief))).digest('hex');
}
