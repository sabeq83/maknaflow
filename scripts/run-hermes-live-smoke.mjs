import { execSync } from 'node:child_process';
import assert from 'node:assert/strict';

console.log('🚀 === MAKNA FLOW: HERMES LIVE SMOKE RUN-ONCE (DEV) === 🧪');

const smokeScript = `import urllib.request, json, os, plistlib, hashlib, time, sys

plist_path = os.path.expanduser("~/Library/LaunchAgents/ai.hermes.gateway.plist")
with open(plist_path, "rb") as f:
    pl = plistlib.load(f)
token = pl.get("EnvironmentVariables", {}).get("MAKNA_OPERATOR_API_TOKEN", "")

headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json",
    "Idempotency-Key": f"smoke_hermes_{int(time.time())}"
}

payload = {
    "mode": "run_once",
    "name": "Live Smoke Rolled Oat Hermes",
    "brand_profile_id": "df382ce8-2145-4464-ae63-79375ff3aff2",
    "product_id": "pe_rolled_oat_sahabat",
    "preset_key": "dapurbotani_kampanye_produk_4_klip",
    "video_count": 6,
    "platform": "tiktok",
    "research": {
        "query": "Resep Sarapan Praktis dan Sehat Menggunakan Rolled Oat Premium Sahabat"
    },
    "review_mode": "start_frames",
    "publishing_policy": {
        "mode": "draft_only"
    }
}

# 1. Enqueue Run Once
print("1. Enqueueing Hermes Run Once via POST /api/operator/v2/content-runs...")
t0 = time.time()
req = urllib.request.Request(
    "http://127.0.0.1:5020/api/operator/v2/content-runs",
    data=json.dumps(payload).encode("utf-8"),
    headers=headers,
    method="POST"
)
with urllib.request.urlopen(req) as resp:
    post_status = resp.status
    post_body = json.loads(resp.read().decode())
latency_ms = (time.time() - t0) * 1000

print(f"   -> HTTP Status: {post_status} in {latency_ms:.1f}ms")
print(f"   -> Response: {json.dumps(post_body)}")

run_id = post_body.get("run_id")

# 2. Idempotency Replay Check
print("\\n2. Testing Idempotency Replay with same Idempotency-Key...")
req_replay = urllib.request.Request(
    "http://127.0.0.1:5020/api/operator/v2/content-runs",
    data=json.dumps(payload).encode("utf-8"),
    headers=headers,
    method="POST"
)
with urllib.request.urlopen(req_replay) as resp:
    replay_status = resp.status
    replay_body = json.loads(resp.read().decode())

print(f"   -> Replay HTTP Status: {replay_status}")
print(f"   -> Replay Response: {json.dumps(replay_body)}")

print(json.dumps({
    "post_status": post_status,
    "latency_ms": latency_ms,
    "run_id": run_id,
    "replayed_initial": post_body.get("replayed"),
    "replayed_second": replay_body.get("replayed"),
    "replayed_run_id_match": replay_body.get("run_id") == run_id
}))
`;

const res = execSync('ssh masbenu@100.95.245.55 "python3 -"', { input: smokeScript, encoding: 'utf8' }).trim();
const lastLine = res.split('\n').filter(Boolean).pop();
const data = JSON.parse(lastLine);

console.log('\n--- ENQUEUE VERIFICATION ---');
console.log(`- POST Status: ${data.post_status}`);
console.log(`- Latency: ${data.latency_ms.toFixed(1)}ms (budget < 2000ms)`);
console.log(`- Run ID: ${data.run_id}`);
console.log(`- Replayed initial: ${data.replayed_initial}`);
console.log(`- Replayed second: ${data.replayed_second}`);
console.log(`- Replay Run ID match: ${data.replayed_run_id_match}`);

assert.equal(data.post_status, 202, 'Enqueue must return HTTP 202');
assert.ok(data.latency_ms < 2000, `Enqueue took ${data.latency_ms}ms, exceeding 2000ms`);
assert.ok(data.run_id.startsWith('car_'), 'run_id must start with car_');
assert.equal(data.replayed_initial, false, 'Initial enqueue must have replayed=false');
assert.equal(data.replayed_second, true, 'Second enqueue must have replayed=true');
assert.equal(data.replayed_run_id_match, true, 'Replayed run_id must match original');

console.log('\n✅ ENQUEUE & IDEMPOTENCY REPLAY VERIFIED SUCCESSFULLY!');
