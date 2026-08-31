# Operator API

Base URL berasal dari `MAKNA_OPERATOR_BASE_URL`. Gunakan bearer token tanpa pernah menampilkannya.

## Resolve katalog

```http
GET /api/operator/v2/content-automations/catalog?search=<product>&limit=20
```

Memerlukan scope `automation:read`. Respons menyediakan `brands`, `products`, dan `presets` dengan identifier resmi. Jangan menebak identifier.

## Buat automation

```http
POST /api/operator/v2/content-automations
Authorization: Bearer <token>
Idempotency-Key: hermes:<conversation-or-request-id>
Content-Type: application/json
```

Memerlukan scope `automation:write`. Contoh enam video produk, riset setiap hari pukul 07.00, manual review, dan TikTok pukul 18.30:

```json
{
  "name": "Daily Product XXX",
  "campaign_kind": "product_campaign",
  "status": "active",
  "timezone": "Asia/Jakarta",
  "frequency": "daily",
  "schedule": { "hour": 7, "minute": 0 },
  "missed_run_policy": "skip",
  "operator_request": {
    "planner": {
      "planner_focus": "product_campaign",
      "planner_count": 6,
      "brand_id": "<brand-id>",
      "product_id": "<product-id>",
      "product_name": "XXX",
      "product_description": "<verified product description>",
      "target_audience": "<verified audience>",
      "platform": "tiktok"
    },
    "selection": { "mode": "all" },
    "research": {
      "query": "Riset tren terbaru yang relevan untuk produk XXX dan target konsumennya",
      "locale": "id-ID",
      "max_research_age_hours": 24,
      "production_count": 6,
      "source_policy": "primary_and_reputable",
      "prohibited_topics": []
    },
    "opc": {
      "preset": "<preset-key>",
      "basic_strategy": {
        "brand_profile_id": "<brand-id>",
        "product_id": "<product-id>",
        "target_product_id": "<product-id>"
      },
      "workflow": {
        "approval_mode": "start_frames",
        "auto_sync_contentflow": true,
        "enable_social_post": false
      }
    }
  },
  "publishing_policy": {
    "mode": "approval_required",
    "platform": "tiktok",
    "account_ids": ["<repliz-account-id>"],
    "publish_time": "18:30",
    "timezone": "Asia/Jakarta",
    "missed_slot_policy": "next_day"
  }
}
```

Untuk draft aman, gunakan `status: paused` dan `publishing_policy.mode: draft_only` dengan `account_ids: []`.

Jika server mengembalikan `HERMES_AUTO_PUBLISH_DISABLED`, jangan mencoba endpoint lain. Jelaskan bahwa approval manusia masih diwajibkan. Jika `Idempotency-Key` conflict, berhenti; jangan membuat key baru.
