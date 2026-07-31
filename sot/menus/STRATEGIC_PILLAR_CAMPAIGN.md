# STRATEGIC_PILLAR_CAMPAIGN.md

## 1. Purpose

This document defines the architecture that allows the web application to:

1. Capture approved Content Planner output.
2. Convert each planner row into a structured campaign item.
3. Process each campaign item through a **Single-Pass Engine (1-Call Gemini AI Architecture)**.
4. Generate storyboard, voice-over, 10 Video DNA parameters, T2I prompts, I2V prompts, captions, CTA, SEO metadata, and publishing assets in a single pass.
5. Preserve traceability from strategic planning to final published content via Strategic Lock.
6. Execute 5-phase automated video production (Generator + Start Frame T2I, TTS, G-Labs I2V, FFmpeg Assembly, Social Poster).
7. Support regeneration, TikTok compliance validation, approval, and analytics feedback.

The system treats one Content Planner row as one strategic campaign unit.

```text
1 Planner Row
    ↓
1 Strategic Campaign Item
    ↓
1-Call Single-Pass Creative & Publishing Package
    ↓
5-Phase Video Production (Start Frame, TTS, G-Labs I2V, FFmpeg, Social Post)
    ↓
1 Final Content Package
```

---

# 2. Core Architecture (Single-Pass Engine)

```text
CONTENT PLANNER
Pillar + CEP + W'S Matrix + Context + VFO
Strategic Angle + Hook + Visual Action + Product
                    │
                    ▼
        PLANNER INGESTION LAYER
                    │
                    ▼
      STRATEGIC CAMPAIGN BUILDER
 (4 Accordions: Strategy, Aesthetics, Bridging, VSO)
                    │
                    ▼
┌────────────────────────────────────────────────────────┐
│ SINGLE-PASS ENGINE (1-CALL GEMINI CREATIVE & PUBLISHING)│
│ Storyboard + Voice-Over + Video DNA + Social Package   │
└────────────────────────────────────────────────────────┘
                    │
                    ▼
         TIKTOK COMPLIANCE GATE
                    │
                    ▼
 ┌──────────────────────────────────────────────────────┐
 │ 5-PHASE SCHEDULER ENGINE (OPC PARITY)               │
 │ 1. Generator & Start Frame T2I                       │
 │ 2. Text-to-Speech (TTS Audio)                        │
 │ 3. G-Labs I2V Video Generation & Sandwich Bridging   │
 │ 4. FFmpeg Video Stitching & Assembly                 │
 │ 5. Cloud Upload & Social Poster                      │
 └──────────────────────────────────────────────────────┘
                    │
                    ▼
  FINAL VIDEO CONTENT & SOCIAL PUBLISHING PACKAGE
```

The web application must not send the raw planner table directly to Gemini without normalization.

The planner must first be converted into a stable internal object called:

```text
Strategic Campaign Item
```

---

# 3. Strategic Campaign Concept

A Strategic Campaign is the operational bridge between the Content Planner and content production.

It contains:

```text
Strategic Intent
Creative Direction
Product Assignment
Production Configuration
Publishing Configuration
Validation State
Generation History
```

Recommended hierarchy:

```text
Campaign
    ├── Campaign Item 1
    ├── Campaign Item 2
    ├── Campaign Item 3
    └── Campaign Item N
```

Example:

```text
Campaign:
Premium Cocoa Powder — 7-Day Campaign

Campaign Items:
1. Healthy Breakfast
2. Healthy Drinks
3. Healthy Dessert
4. Healthy Lifestyle
```

---

# 4. Planner Ingestion Layer

## 4.1. Accepted Planner Columns

The system captures:

- Pillar
- Category CEP
- W'S Matrix
- Context
- VFO
- Strategic Angle
- Hook
- Visual Action
- Product

Optional operational fields:

- Planner Row ID
- Brand ID
- Product ID
- Platform
- Selling Intent
- Communication Intent
- Priority
- Status
- Locked Fields
- Planner Version

---

## 4.2. Planner Input JSON

Example:

```json
{
  "planner_id": "pln_001",
  "brand_id": "nutribake",
  "platform": "tiktok",
  "rows": [
    {
      "planner_row_id": "pln_row_001",
      "pillar": "Healthy Breakfast",
      "cep_category": "Routine-Based",
      "ws_matrix": "When + While Doing What",
      "context": "Pukul 06.30 sebelum berangkat kerja",
      "vfo": "Concrete",
      "strategic_angle": "The Life Hack",
      "hook": "Sarapan cokelat cuma 2 menit? Besok pagi wajib coba ini.",
      "visual_action": "Top view oatmeal, susu dituang, Premium Cocoa Powder ditabur menghasilkan swirl cokelat.",
      "product_id": "premium_cocoa_powder",
      "product": "Premium Cocoa Powder"
    }
  ]
}
```

---

## 4.3. Planner Ingestion Responsibilities

The Planner Ingestion Layer must:

1. Validate required columns.
2. Normalize field names.
3. Resolve brand, pillar, product, and framework IDs.
4. Reject unknown values.
5. Store the original planner row.
6. Create one Strategic Campaign Item per planner row.
7. Preserve source relationships.

Flow:

```text
Planner Row
    ↓
Schema Validation
    ↓
ID Resolution
    ↓
Strategic Validation
    ↓
Campaign Item Creation
```

---

# 5. Strategic Campaign Builder

The Strategic Campaign Builder enriches each planner row with production configuration.

## 5.1. Input

From Content Planner:

- Pillar
- Category CEP
- W'S Matrix
- Context
- VFO
- Strategic Angle
- Hook
- Visual Action
- Product

From Brand Configuration:

- Brand Profile
- Brand Voice
- Target Audience
- Visual Identity
- Product Rules
- Compliance Rules

From Production Configuration:

- Video Format
- Scene Count
- Scene Duration
- Total Duration
- Aspect Ratio
- Main Platform
- Visual Mode
- Product Placement Rule
- Voice-over Mode
- T2I Model
- I2V Model

---

## 5.2. Strategic Campaign Item Schema

```json
{
  "campaign_item_id": "cmp_item_001",
  "campaign_id": "cmp_001",
  "source": {
    "planner_id": "pln_001",
    "planner_row_id": "pln_row_001",
    "planner_version": "1.0"
  },
  "strategy": {
    "pillar": "Healthy Breakfast",
    "cep_category": "Routine-Based",
    "ws_matrix": "When + While Doing What",
    "context": "Pukul 06.30 sebelum berangkat kerja",
    "vfo": "Concrete",
    "strategic_angle": "The Life Hack",
    "hook": "Sarapan cokelat cuma 2 menit? Besok pagi wajib coba ini.",
    "visual_action": "Top view oatmeal, susu dituang, Premium Cocoa Powder ditabur menghasilkan swirl cokelat."
  },
  "product": {
    "product_id": "premium_cocoa_powder",
    "product_name": "Premium Cocoa Powder"
  },
  "production_config": {
    "format": "short_video",
    "scene_count": 4,
    "scene_duration_seconds": 8,
    "aspect_ratio": "9:16",
    "visual_mode": "faceless_hands_only",
    "main_platform": "tiktok"
  },
  "status": "ready_for_call_1"
}
```

---

# 6. Campaign Status Lifecycle

Each campaign item must have a controlled lifecycle.

```text
draft
    ↓
planner_validated
    ↓
ready_for_call_1
    ↓
call_1_processing
    ↓
creative_generated
    ↓
creative_validated
    ↓
ready_for_call_2
    ↓
call_2_processing
    ↓
publishing_generated
    ↓
final_validated
    ↓
approved
    ↓
in_production
    ↓
published
    ↓
measured
```

Failure states:

```text
planner_invalid
creative_failed
creative_needs_revision
publishing_failed
publishing_needs_revision
compliance_failed
```

---

# 7. CALL 1 — Creative Production Engine

## 7.1. Purpose

Call 1 transforms one Strategic Campaign Item into a complete creative production package.

Call 1 may develop the planner row, but it must not replace its strategic foundation.

Locked strategic fields:

- Pillar
- CEP
- W'S Matrix
- Context
- VFO
- Strategic Angle
- Product

The Hook and Visual Action may be refined, not strategically changed.

---

## 7.2. Input

### Strategic Campaign Item

- Pillar
- Category CEP
- W'S Matrix
- Context
- VFO
- Strategic Angle
- Planner Hook
- Planner Visual Action
- Product

### Brand Context

- Brand Profile
- Target Audience
- Brand Visual Identity
- Product Knowledge
- Product Placement Rules

### Production Configuration

- Format Video
- Number of Scenes
- Duration per Scene
- Total Duration
- Aspect Ratio
- Main Platform
- Visual Mode
- Voice-over Mode
- Language
- T2I Configuration
- I2V Configuration

---

## 7.3. Knowledge Base

### Mandatory

- Strategic Frameworks
- Strategic Decision Tree
- Narrative Structure
- Realist Viral Narrative
- Visual Style Guide
- Prompt System

### Conditional

- Auteur Guide
- Location Guide
- Character Roles
- Character Psychology

Conditional loading rules:

```text
IF narrative_mode = psychodrama
→ load Character Psychology

IF visual execution uses recurring characters
→ load Character Roles

IF location continuity is important
→ load Location Guide

IF auteur style is explicitly selected
→ load Auteur Guide
```

---

## 7.4. Tasks

1. Validate the Strategic Campaign Item.
2. Interpret the strategic foundation.
3. Refine the final hook.
4. Select narrative mode.
5. Determine the content structure.
6. Build the storyboard.
7. Divide the content into scenes.
8. Write scene-level voice-over.
9. Compile master voice-over.
10. Generate on-screen text.
11. Generate T2I prompt per scene.
12. Generate I2V prompt per scene.
13. Generate negative prompt.
14. Generate continuity reference.
15. Determine product visibility per scene.
16. Preserve visual, product, and narrative consistency.
17. Generate a publishing summary for Call 2.
18. Return strict JSON.

---

## 7.5. Call 1 Output Schema

```json
{
  "campaign_item_id": "cmp_item_001",
  "creative_direction": {
    "pillar": "Healthy Breakfast",
    "cep_category": "Routine-Based",
    "ws_matrix": "When + While Doing What",
    "context": "Pukul 06.30 sebelum berangkat kerja",
    "vfo": "Concrete",
    "strategic_angle": "The Life Hack",
    "narrative_mode": "viral_hook",
    "planner_hook": "Sarapan cokelat cuma 2 menit? Besok pagi wajib coba ini.",
    "final_hook": "Sarapan cokelat dua menit sebelum kerja? Besok pagi coba cara ini.",
    "core_message": "Premium Cocoa Powder makes a fast breakfast visually appealing and easy to prepare."
  },
  "storyboard": [
    {
      "scene_number": 1,
      "duration_seconds": 8,
      "scene_function": "hook",
      "visual_action": "Top view mangkuk oatmeal kosong di meja pagi, tangan meletakkannya dengan cepat.",
      "camera": {
        "shot_type": "top_view",
        "movement": "static",
        "framing": "extreme_close_up"
      },
      "objects": [
        "oatmeal bowl",
        "milk",
        "Premium Cocoa Powder"
      ],
      "product_visibility": {
        "visible": true,
        "visibility_level": "partial",
        "placement": "right side of frame"
      },
      "voice_over": "Sarapan cokelat dua menit sebelum kerja?",
      "on_screen_text": "Cuma 2 menit",
      "transition": "hard_cut",
      "t2i_prompt": "...",
      "i2v_prompt": "...",
      "negative_prompt": "...",
      "continuity_reference": {
        "environment_id": "env_morning_kitchen_01",
        "hand_profile_id": "hands_female_01",
        "product_packaging_id": "premium_cocoa_powder_pack_01"
      }
    }
  ],
  "voice_over": {
    "master_vo": "...",
    "word_count": 28,
    "estimated_duration_seconds": 24
  },
  "publishing_summary": {
    "content_summary": "...",
    "main_message": "...",
    "primary_keyword": "sarapan cokelat cepat",
    "secondary_keywords": [
      "oatmeal cokelat",
      "sarapan praktis"
    ],
    "recommended_cta_intent": "soft_sell",
    "product_name": "Premium Cocoa Powder"
  },
  "validation": {
    "strategic_alignment": "pass",
    "visual_feasibility": "pass",
    "product_consistency": "pass",
    "compliance_precheck": "pass",
    "issues": []
  }
}
```

---

## 7.6. Call 1 Processing Flow

```text
Strategic Campaign Item
        │
        ▼
Strategic Lock Validation
        │
        ▼
Narrative Mode Selection
        │
        ▼
Final Hook Development
        │
        ▼
Storyboard Architecture
        │
        ▼
Scene Breakdown
        │
        ▼
Voice-over + On-screen Text
        │
        ▼
T2I + I2V Prompt Generation
        │
        ▼
Continuity Mapping
        │
        ▼
Creative Validation
        │
        ▼
Creative Content Package
```

---

# 8. Creative Validation Layer

Call 1 output must be validated before Call 2.

## 8.1. Structural Validation

Required objects:

- Creative Direction
- Storyboard
- Master VO
- Publishing Summary
- Validation

Each storyboard scene must contain:

- Duration
- Function
- Visual Action
- Camera
- Objects
- Product Visibility
- Voice-over
- On-screen Text
- Transition
- T2I Prompt
- I2V Prompt
- Negative Prompt
- Continuity Reference

---

## 8.2. Strategic Validation

Check:

```text
Planner Pillar = Creative Pillar
Planner CEP = Creative CEP
Planner Context = Creative Context
Planner VFO = Creative VFO
Planner Angle = Creative Angle
Planner Product = Creative Product
```

The system must reject output if Gemini silently changes a locked field.

---

## 8.3. Production Validation

Check:

- Total scene duration equals configured duration.
- Scene count matches configuration.
- Product appears according to placement rules.
- Visual actions are executable.
- Voice-over fits duration.
- Continuity IDs are consistent.
- T2I and I2V prompts refer to the same objects and environment.

---

## 8.4. Selective Regeneration

Do not repeat all of Call 1 when only one component fails.

Examples:

```text
Invalid final hook
→ regenerate Creative Direction only.

Invalid scene 3 visual
→ regenerate scene 3 only.

Voice-over too long
→ regenerate Master VO and scene VO only.

Product packaging inconsistent
→ regenerate affected prompts only.
```

---

# 9. Creative Content Package Database

Recommended table:

```text
creative_content_packages
- id
- campaign_item_id
- planner_row_id
- creative_version
- model_name
- prompt_version
- knowledge_versions
- creative_direction_json
- storyboard_json
- voice_over_json
- publishing_summary_json
- validation_json
- status
- created_at
- updated_at
```

Recommended scene table:

```text
creative_scenes
- id
- creative_content_package_id
- scene_number
- duration_seconds
- function
- visual_action
- camera_json
- objects_json
- product_visibility_json
- voice_over
- on_screen_text
- transition
- t2i_prompt
- i2v_prompt
- negative_prompt
- continuity_reference_json
- status
```

Separating scenes allows:

- Scene-level regeneration
- Scene-level production tracking
- Scene-level asset storage
- Scene-level analytics

---

# 10. CALL 2 — Publishing Engine (Legacy / Manual Fallback)

> [!NOTE]
> **V10.20.74 Single-Pass Architecture Unification**: Pemanggilan Call 2 secara terpisah telah disatukan secara otomatis ke dalam **Call 1 (Single-Pass Engine)**. Dalam pipeline eksekusi otomatis (`processStrategicGenerator`), Call 1 memproduksi Storyboard, Audio Scripts, Video DNA, dan Social Media Package (Caption, Hashtags, CTA) sekaligus dalam 1x Call Gemini AI. Dokumentasi Call 2 di bawah ini dipertahankan sebagai spesifikasi format aset penerbitan dan acuan untuk manual fallback endpoint (`executeCall2PublishingEngine`).

## 10.1. Purpose

Call 2 transforms the approved Creative Content Package into platform-specific publishing assets.

Call 2 does not rewrite the creative strategy.

It adapts the approved content for each platform.

---

## 10.2. Input

- Campaign Item ID
- Content Planner Row
- Creative Direction
- Final Hook
- Master Voice-over
- Publishing Summary
- Product
- Target Audience
- Brand Voice
- Platform Rules
- Selling Intent
- Communication Intent
- Primary Platform
- Requested Publishing Platforms

---

## 10.3. Knowledge Base

- Brand Voice Guide
- Platform Copywriting Guide
- CTA Rules
- Compliance Guide
- SEO Guide

Optional:

- Campaign-specific keyword data
- Current product campaign terms
- Platform-specific character limits

---

## 10.4. Tasks

1. Generate TikTok caption.
2. Generate Facebook caption.
3. Generate Instagram caption.
4. Generate YouTube title.
5. Generate YouTube description.
6. Generate keywords.
7. Generate hashtags.
8. Adapt CTA per platform.
9. Preserve Brand Voice.
10. Preserve strategic message.
11. Validate compliance.
12. Return strict JSON.

---

## 10.5. Call 2 Output Schema

```json
{
  "campaign_item_id": "cmp_item_001",
  "publishing_assets": {
    "tiktok": {
      "caption": "...",
      "cta": "...",
      "hashtags": [
        "#sarapansehat",
        "#oatmealcokelat"
      ]
    },
    "facebook": {
      "caption": "...",
      "cta": "..."
    },
    "instagram": {
      "caption": "...",
      "cta": "...",
      "hashtags": [
        "#sarapanpraktis",
        "#resepsehat"
      ]
    },
    "youtube": {
      "title": "...",
      "description": "...",
      "keywords": [
        "sarapan cokelat cepat",
        "oatmeal cokelat"
      ],
      "hashtags": [
        "#Shorts",
        "#SarapanSehat"
      ]
    }
  },
  "compliance": {
    "status": "pass",
    "issues": [],
    "revised_fields": []
  },
  "seo": {
    "primary_keyword": "sarapan cokelat cepat",
    "secondary_keywords": [
      "oatmeal cokelat",
      "sarapan praktis"
    ],
    "search_intent": "informational_commercial"
  }
}
```

---

## 10.6. Call 2 Processing Flow

```text
Approved Creative Content Package
        │
        ▼
Publishing Context Assembly
        │
        ▼
Brand Voice Application
        │
        ▼
Platform Adaptation
        │
        ▼
Caption + CTA Generation
        │
        ▼
SEO + Keyword Generation
        │
        ▼
Compliance Validation
        │
        ▼
Publishing Content Package
```

---

# 11. Publishing Content Package Database

```text
publishing_content_packages
- id
- campaign_item_id
- creative_content_package_id
- publishing_version
- model_name
- prompt_version
- knowledge_versions
- tiktok_json
- facebook_json
- instagram_json
- youtube_json
- seo_json
- compliance_json
- status
- created_at
- updated_at
```

---

# 12. Final Content Package

The web application merges:

```text
Strategic Campaign Item
+
Creative Content Package
+
Publishing Content Package
```

into:

```text
Final Content Package
```

Final package schema:

```json
{
  "final_content_package_id": "fcp_001",
  "campaign_id": "cmp_001",
  "campaign_item_id": "cmp_item_001",
  "planner_source": {},
  "strategy": {},
  "creative_direction": {},
  "storyboard": [],
  "voice_over": {},
  "publishing_assets": {},
  "production_assets": [],
  "validation": {},
  "status": "approved"
}
```

---

# 13. Final Content Package Database

```text
final_content_packages
- id
- campaign_id
- campaign_item_id
- planner_row_id
- creative_content_package_id
- publishing_content_package_id
- final_package_json
- approval_status
- production_status
- publishing_status
- created_at
- updated_at
```

---

# 14. End-to-End Relationship

```text
content_planners
    ↓
planner_rows
    ↓
strategic_campaigns
    ↓
strategic_campaign_items
    ↓
creative_content_packages
    ↓
creative_scenes
    ↓
publishing_content_packages
    ↓
final_content_packages
    ↓
generated_assets
    ↓
published_posts
    ↓
content_analytics
```

Recommended foreign-key relationships:

```text
planner_rows.id
→ strategic_campaign_items.planner_row_id

strategic_campaign_items.id
→ creative_content_packages.campaign_item_id

creative_content_packages.id
→ publishing_content_packages.creative_content_package_id

publishing_content_packages.id
→ final_content_packages.publishing_content_package_id
```

---

# 15. API Architecture

## Create Strategic Campaign

```http
POST /api/strategic-campaigns
```

Request:

```json
{
  "planner_id": "pln_001",
  "name": "Premium Cocoa Powder — Week 1",
  "selected_row_ids": [
    "pln_row_001",
    "pln_row_002"
  ],
  "production_config": {
    "scene_count": 4,
    "scene_duration_seconds": 8,
    "aspect_ratio": "9:16",
    "visual_mode": "faceless_hands_only"
  }
}
```

---

## Generate Call 1

```http
POST /api/strategic-campaign-items/{campaign_item_id}/generate-creative
```

---

## Validate Call 1

```http
POST /api/creative-content-packages/{package_id}/validate
```

---

## Regenerate Scene

```http
POST /api/creative-content-packages/{package_id}/scenes/{scene_id}/regenerate
```

---

## Generate Call 2

```http
POST /api/strategic-campaign-items/{campaign_item_id}/generate-publishing
```

Call 2 may only run when:

```text
creative_validation_status = pass
```

---

## Approve Final Package

```http
POST /api/final-content-packages/{package_id}/approve
```

---

# 16. User Interface Architecture

## Strategic Campaign Page

Display:

- Campaign name
- Planner source
- Total campaign items
- Status summary
- Product
- Platform
- Production configuration

Campaign item table:

| Status | Pillar | CEP | Context | VFO | Angle | Product | Creative | Publishing | Action |
|---|---|---|---|---|---|---|---|---|---|

Actions:

- Generate Creative
- Review Creative
- Regenerate
- Generate Publishing
- Review Publishing
- Approve
- Send to Production

---

## Campaign Item Detail Page

Sections:

```text
1. Planner Source
2. Strategic Lock
3. Creative Direction
4. Storyboard
5. Voice-over
6. T2I Prompts
7. I2V Prompts
8. Publishing Assets
9. Validation
10. Generation History
```

---

# 17. Locking Rules

The system must distinguish strategic fields from generative fields.

## Strategically Locked

- Pillar
- CEP
- W'S Matrix
- Context
- VFO
- Strategic Angle
- Product

## Refinable

- Hook
- Visual Action
- Narrative Mode
- Storyboard
- Voice-over
- T2I Prompt
- I2V Prompt
- Caption
- CTA
- Hashtag

If a user edits a locked field, downstream packages become stale.

Example:

```text
Change Product
→ invalidate Creative Package
→ invalidate Publishing Package
→ require regeneration
```

---

# 18. Dependency Invalidation

```text
Change Pillar
→ invalidate all downstream output.

Change CEP
→ invalidate narrative, hook, storyboard, publishing.

Change Context
→ invalidate hook, storyboard, VO, publishing.

Change VFO
→ invalidate angle interpretation, hook, storyboard, publishing.

Change Strategic Angle
→ invalidate hook, narrative, storyboard, publishing.

Change Hook
→ review storyboard and publishing.

Change Visual Action
→ invalidate affected scenes and prompts.

Change Product
→ invalidate all creative and publishing output.
```

---

# 19. Two-Call Execution Rules

## Rule 1

One campaign item uses one Call 1 and one Call 2 under normal conditions.

```text
1 Campaign Item = 2 Gemini Calls
```

## Rule 2

Batch generation may process multiple campaign items, but every item must retain its own:

- Campaign Item ID
- Planner Row ID
- Creative Package
- Publishing Package
- Validation Result

## Rule 3

Call 2 must never run before Call 1 passes validation.

## Rule 4

Gemini must return strict JSON.

## Rule 5

The application, not Gemini, manages:

- IDs
- Status
- Foreign keys
- Versioning
- Retries
- Locks
- Approval
- Persistence

---

# 20. Prompt Assembly

## Call 1 Prompt Context

Load only:

```text
Strategic Campaign Item
Strategic Frameworks
Strategic Decision Tree
Narrative Structure
Realist Viral Narrative
Visual Style Guide
Prompt System
Relevant Brand Profile
Relevant Product Knowledge
Production Configuration
```

Do not load publishing-only KBs unless required for pre-compliance.

---

## Call 2 Prompt Context

Load only:

```text
Approved Creative Content Package
Brand Voice Guide
Platform Copywriting Guide
CTA Rules
Compliance Guide
SEO Guide
Target Audience
Requested Platforms
```

This prevents unnecessary token usage and instruction conflict.

---

# 21. Versioning

Every generated package must store:

```text
Gemini model
Call type
Prompt version
Knowledge-base versions
Planner version
Campaign version
Generation timestamp
Regeneration count
```

Example:

```json
{
  "generation_metadata": {
    "model": "gemini",
    "call_type": "creative_production",
    "prompt_version": "creative_call_v2",
    "planner_version": "1.0",
    "campaign_version": "1.0",
    "knowledge_versions": {
      "strategic_frameworks": "47.9.6",
      "strategic_decision_tree": "1.0",
      "visual_style_guide": "1.0"
    }
  }
}
```

---

# 22. Failure Handling

## Invalid Planner Row

```text
Do not create Campaign Item.
Return validation issues.
```

## Invalid Call 1 JSON

```text
Retry with JSON repair.
If still invalid, mark creative_failed.
```

## Strategic Drift

```text
Reject output.
Regenerate affected sections.
```

## Invalid Call 2 JSON

```text
Retry with JSON repair.
If still invalid, mark publishing_failed.
```

## Compliance Failure

```text
Regenerate only the non-compliant fields.
```

## Partial Failure

If one campaign item fails:

```text
Other campaign items continue processing.
```

---

# 23. Recommended Implementation Sequence

## Phase 1 — Planner Capture

Build:

- Planner row parser
- Schema validation
- Planner-to-campaign conversion
- Campaign and campaign item database

## Phase 2 — Call 1

Build:

- Creative prompt assembler
- Gemini Call 1 integration
- Strict JSON parser
- Creative package storage
- Storyboard scene storage
- Creative validator

## Phase 3 — Call 2

Build:

- Publishing prompt assembler
- Gemini Call 2 integration
- Publishing package storage
- Compliance validator

## Phase 4 — Workflow

Build:

- Status lifecycle
- Locking
- Selective regeneration
- Approval
- Final package merger

## Phase 5 — Production Integration

Build:

- T2I job creation
- I2V job creation
- Voice-over job creation
- Asset storage
- Video assembly
- Publishing scheduler

---

# 24. Minimum Viable Product

The MVP requires:

```text
1. Select approved planner rows.
2. Create Strategic Campaign.
3. Convert each planner row into a Campaign Item.
4. Run Call 1.
5. Store storyboard, VO, T2I, and I2V prompts.
6. Validate Call 1.
7. Run Call 2.
8. Store platform publishing assets.
9. Merge Final Content Package.
10. Export JSON.
```

Do not implement analytics feedback or automatic video generation before this flow is stable.

---

# 25. Future Analytics Feedback Loop

After publishing:

```text
Final Content Package
    ↓
Published Post
    ↓
Performance Analytics
    ↓
Campaign Item
    ↓
Planner Strategy
```

Store performance against:

- Pillar
- CEP
- W'S Matrix
- Context
- VFO
- Strategic Angle
- Hook
- Visual Action
- Product
- Narrative Mode
- Scene Structure

This allows the web app to learn which strategic combinations perform best.

Example:

```text
Routine-Based
+
Concrete
+
The Life Hack
+
Morning Context
+
Premium Cocoa Powder
=
High retention and high product clicks
```

The result may later be used to improve future planner generation.

---

# 26. Final Architecture

```text
┌──────────────────────────────────────────────┐
│               CONTENT PLANNER                │
│ Pillar | CEP | W'S | Context | VFO | Angle   │
│ Hook | Visual Action | Product               │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│          PLANNER INGESTION LAYER             │
│ Schema | Normalization | ID Resolution       │
│ Strategic Validation                         │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│          STRATEGIC PILLAR CAMPAIGN           │
│ Campaign → Campaign Items                    │
│ Strategy Lock | Production Configuration     │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│ CALL 1 — CREATIVE PRODUCTION ENGINE          │
│ Creative Direction | Storyboard | VO         │
│ T2I | I2V | Continuity | Publishing Summary  │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│            CREATIVE VALIDATION               │
│ Strategy | Structure | Feasibility           │
│ Product | Duration | Continuity               │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│ CALL 2 — PUBLISHING ENGINE                   │
│ Caption | CTA | SEO | Hashtag | Compliance   │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│          FINAL CONTENT PACKAGE               │
│ Strategy + Creative + Publishing             │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│              CONTENT PRODUCTION              │
│ T2I | I2V | VO | Assembly | Publishing       │
└──────────────────────────────────────────────┘
```

---

# 27. Final Summary

```text
Content Planner
→ Strategic Campaign
→ Campaign Item
→ Call 1 Creative Production
→ Creative Validation
→ Call 2 Publishing
→ Final Content Package
→ Content Production
```

Operational formula:

```text
1 Planner Row
=
1 Strategic Campaign Item
=
1 Creative Content Package
+
1 Publishing Content Package
=
1 Final Content Package
```

Standard generation formula:

```text
1 Content = 2 Gemini Calls
```

The Strategic Pillar Campaign becomes the central orchestration object that connects planning, AI generation, production, publishing, and analytics.
