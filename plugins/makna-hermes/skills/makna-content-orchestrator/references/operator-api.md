# Operator API Reference

Base URL berasal dari `MAKNA_OPERATOR_BASE_URL`. Di Dev, gunakan `http://127.0.0.1:5020`. Gunakan bearer token tanpa pernah menampilkannya.

---

## 1. Resolve Katalog (Filtered)

```http
GET /api/operator/v2/content-catalog?brand=dapurbotani&product=Rolled%20Oat&preset=dapurbotani_kampanye_produk_4_klip&campaign_kind=product_campaign&limit=20
Authorization: Bearer <token>
```

Memerlukan scope `automation:read`.

### Response 200:
```json
{
  "success": true,
  "brands": [
    { "id": "bp_xxx", "name": "dapurbotani", "slug": "dapurbotani", "exact_match": true }
  ],
  "products": [
    { "id": "pe_xxx", "name": "Rolled Oat Premium Sahabat", "target_audience": "Dewasa muda", "exact_match": true }
  ],
  "presets": [
    { "key": "dapurbotani_kampanye_produk_4_klip", "label": "Dapur Botani 4 Klip", "campaign_kinds": ["product_campaign"], "compatible": true, "exact_match": true }
  ]
}
```

---

## 2. Buat One-Time Campaign (Run-Once)

```http
POST /api/operator/v2/content-runs
Authorization: Bearer <token>
Idempotency-Key: hermes:<conversation-id>:<request-id>
Content-Type: application/json
```

Memerlukan scope `automation:write`.

### Request Body:
```json
{
  "mode": "run_once",
  "name": "Rolled Oat Premium Sahabat — One Time",
  "brand_profile_id": "bp_xxx",
  "product_id": "pe_xxx",
  "preset_key": "dapurbotani_kampanye_produk_4_klip",
  "video_count": 6,
  "platform": "tiktok",
  "research": {
    "query": "Tren terbaru yang relevan untuk Rolled Oat Premium Sahabat dan target konsumennya",
    "locale": "id-ID",
    "max_research_age_hours": 24,
    "source_policy": "primary_and_reputable"
  },
  "review_mode": "start_frames",
  "publishing_policy": { "mode": "draft_only" }
}
```

### Response 202 (Accepted dalam < 2 detik):
```json
{
  "success": true,
  "run_id": "car_xxx",
  "agent_run_id": "arun_xxx",
  "status": "research_queued",
  "status_url": "/api/operator/v2/content-runs/car_xxx",
  "review_url": "/content-automations?run=car_xxx",
  "replayed": false
}
```

---

## 3. Monitor Status Run (Bounded)

```http
GET /api/operator/v2/content-runs/{id}
Authorization: Bearer <token>
```

Memerlukan scope `automation:read`.

### Response 200:
```json
{
  "success": true,
  "run_id": "car_xxx",
  "status": "awaiting_manual_review",
  "stage": "start_frames",
  "items": { "total": 6, "ready": 6, "failed": 0 },
  "action_required": "Review start frames in MAKNA",
  "review_url": "/content-automations?run=car_xxx",
  "publishing_mode": "draft_only"
}
```

Public Bounded States:
- `queued`
- `research_queued`
- `researching`
- `planning`
- `generating_start_frames`
- `awaiting_manual_review`
- `producing`
- `syncing_contentflow`
- `completed_draft`
- `retry_wait`
- `failed`
- `cancelled`

---

## 4. Error Codes

- `CATALOG_AMBIGUOUS`: Filter menghasilkan banyak kandidat; minta klarifikasi.
- `BRAND_NOT_FOUND`: ID brand tidak ditemukan.
- `PRODUCT_NOT_FOUND`: ID produk tidak ditemukan.
- `PRESET_NOT_FOUND`: Preset key tidak ditemukan.
- `PRESET_CAMPAIGN_KIND_MISMATCH`: Preset tidak kompatibel dengan jenis campaign.
- `VIDEO_COUNT_INVALID`: Jumlah video tidak sesuai (harus 6, 12, 18, 24, atau 30).
- `RUN_ONCE_DISABLED`: Fitur dinonaktifkan di server.
- `IDEMPOTENCY_KEY_REQUIRED`: Header `Idempotency-Key` tidak disediakan.
- `IDEMPOTENCY_CONFLICT`: Header `Idempotency-Key` sama telah digunakan untuk payload berbeda.
- `RUN_NOT_FOUND`: Run ID tidak ditemukan.
