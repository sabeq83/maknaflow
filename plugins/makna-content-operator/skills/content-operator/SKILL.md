---
name: content-operator
description: Create, inspect, wait for, and approve tenant-scoped MAKNA content production jobs through the official Operator API without browser interaction. Use when the user asks Codex to operate MAKNA content planning or campaign production. Social publishing is out of scope.
---

# MAKNA Content Operator

Use `scripts/makna-content-operator.mjs` as the supported client. Do not access the MAKNA database directly.

## Configuration

Require `MAKNA_OPERATOR_BASE_URL` and `MAKNA_OPERATOR_API_TOKEN`. Run `whoami` before a mutation and verify that the returned tenant matches the user's intended tenant. Never print or repeat the token.

## Workflow

1. Run `whoami`.
2. Prepare a JSON request matching the Operator API content-job contract.
3. Ensure `production.enable_social_post` is absent or `false`.
4. Run `create --file <path> --key <stable-idempotency-key>`.
5. Use `status` or `wait` to monitor the job.
6. If status is `awaiting_approval`, summarize the storyboard/result and obtain explicit user approval before running `approve`.

## Guardrails

- Never use this plugin for Facebook, Instagram, TikTok, or any other social publishing.
- Do not approve a storyboard without explicit approval in the current conversation.
- Reuse the same idempotency key for retries of the same payload.
- Stop if `whoami` reports an unexpected tenant or missing scope.
- Do not expose bearer tokens, Gemini keys, passwords, or raw secret-bearing responses.

## Commands

```bash
node scripts/makna-content-operator.mjs whoami
node scripts/makna-content-operator.mjs create --file request.json --key batch-001
node scripts/makna-content-operator.mjs status <job-id>
node scripts/makna-content-operator.mjs wait <job-id>
node scripts/makna-content-operator.mjs approve <job-id> --all
```
