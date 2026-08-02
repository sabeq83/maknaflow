# Local Staging on macOS

Local staging runs entirely on loopback: Next.js on `127.0.0.1:5010`, the optional API on `127.0.0.1:7010`, and PostgreSQL on `127.0.0.1:5432`.

## First setup

```bash
cd /Users/sabeqmmursyid/_maknaflow-staging
npm ci
cp .env.staging.local.example .env.staging.local
# Change both passwords in .env.staging.local.
npm run staging:setup
npm run staging:build
```

## Run

```bash
npm run staging:start
```

Open <http://127.0.0.1:5010>. The optional headless API can be started in another terminal:

```bash
npm run staging:api
```

## Verify

```bash
npm run staging:check
lsof -nP -iTCP -sTCP:LISTEN | grep -E ':(5010|7010|5432)\\b'
```

The web and API listeners must show `127.0.0.1`, never `*` or `0.0.0.0`.

## Safety defaults

Schedulers, Redis queues, webhooks, cloud sync, and social posting are disabled in `.env.staging.local`. Enable integrations individually only when deliberately testing them. Never copy `.env.local` from the primary worktree.

## Rebuild

Stop the running web process, then run:

```bash
npm run staging:build
npm run staging:start
```
