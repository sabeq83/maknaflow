# Implementation Plan — Tenant, Gemini Key Pool, dan Plugin MAKNA Content Operator

## 1. Tujuan dan Ruang Lingkup

Implementasi ini akan:

1. Memperbaiki penyimpanan Gemini API Key Pool agar setiap key benar-benar tersimpan, terisolasi per tenant, dan hasil impor tidak memberikan status sukses palsu.
2. Menambahkan provisioning dan pengelolaan tenant oleh `superadmin`, termasuk pembuatan admin pertama tenant.
3. Memastikan user, settings, Gemini key, brand, planner, campaign, dan Operator API selalu berjalan dalam tenant aktif.
4. Membuat plugin Codex `makna-content-operator` sebagai antarmuka aman di atas Operator API/CLI MAKNA yang sudah tersedia.

Tidak termasuk dalam scope:

- Social publishing ke Facebook, Instagram, atau TikTok.
- Penyimpanan kredensial sosial media.
- Browser automation untuk platform sosial.

## 2. Keputusan Arsitektur

### 2.1 Model akses

| Peran | Kewenangan |
|---|---|
| `superadmin` | Membuat, melihat, mengubah status tenant, dan membuat admin awal tenant. Tidak otomatis membaca data operasional tenant. |
| `admin` | Mengelola user, brand, settings, dan key pool hanya dalam tenant sendiri. |
| `user` | Menggunakan menu dan brand sesuai permission dalam tenant sendiri. |
| `operator` | Service identity bertoken dan terikat pada tepat satu tenant serta scope tertentu. |

Tenant bukan akun. Satu tenant adalah batas organisasi/data dan dapat memiliki banyak akun admin/user.

### 2.2 Bootstrap superadmin

- Akun superadmin pertama dibuat melalui CLI satu kali, bukan melalui UI publik dan bukan melalui seed password default.
- CLI menerima username/email dan membaca password secara interaktif atau dari secret environment khusus proses; password tidak boleh muncul dalam argumen, log, atau shell history.
- Superadmin merupakan identitas control-plane dan tidak terikat ke tenant operasional.
- Pembuatan superadmin berikutnya hanya dapat dilakukan oleh superadmin aktif dan seluruh perubahan dicatat dalam audit log.
- Tenant admin tidak dapat membuat, mengubah, atau menaikkan role user menjadi `superadmin`.
- Sistem mencegah penonaktifan superadmin aktif terakhir.

### 2.3 Provisioning tenant atomik

`POST /api/admin/tenants` menjalankan satu transaksi:

1. Membuat tenant dengan ID/slug stabil, nama, timezone, dan status.
2. Membuat default `tenant_settings` tanpa menyalin secret tenant lain.
3. Membuat akun admin awal dengan `tenant_id` baru.
4. Memberikan semua menu tenant-admin kepada admin awal.
5. Menulis audit event tanpa menyimpan password/API key.

Jika satu tahap gagal, seluruh transaksi dibatalkan.

### 2.4 Gemini key pool

- `gemini_api_keys.id` memakai PostgreSQL identity/sequence.
- Keunikan API key diberlakukan per tenant melalui `(tenant_id, api_key)`.
- Bulk insert selalu membawa `tenant_id` dari konteks autentikasi, bukan dari request body.
- Hasil impor dipisahkan menjadi `added`, `duplicate`, `rejected`, dan `failed`.
- API tidak boleh mengembalikan sukses jika seluruh insert mengalami kegagalan database.
- Nilai key tetap dimasking di response dan log.

### 2.5 Plugin `makna-content-operator`

- Business logic tetap di MAKNA Operator API; plugin tidak mengakses database langsung.
- Plugin berisi skill operasional dan script client tipis untuk `create`, `status`, `wait`, dan `approve`.
- Plugin memakai base URL dan bearer token tenant-scoped.
- Social post tidak menjadi command atau permission plugin.
- Scaffold mengikuti format plugin Codex dengan `.codex-plugin/plugin.json`, `skills/`, dan `scripts/`; marketplace lokal dibuat hanya pada tahap instalasi setelah persetujuan lokasi pengguna.

## 3. Tahapan Implementasi

### Tahap A — Fondasi schema dan isolasi tenant

- Tambahkan metadata tenant: `slug`, `timezone`, `status`, dan timestamps.
- Tambahkan audit table untuk aksi superadmin.
- Perbaiki sequence/default ID Gemini key pool.
- Ubah unique constraint Gemini key menjadi tenant-scoped.
- Tambahkan constraint/index tenant pada user dan resource terkait.
- Migrasi harus idempotent serta mempertahankan data `default_tenant`.

### Tahap B — Gemini Key Pool

- Satukan single dan bulk insert melalui repository tenant-aware.
- Jangan lagi mengubah exception database menjadi “duplikat”.
- Perbaiki kontrak response dan tampilan ringkasan impor.
- Tambahkan masking dan refresh pool setelah impor.
- Uji insert single, 21 key bulk, duplicate, invalid key, dan isolasi dua tenant.

### Tahap C — Bootstrap dan pengamanan superadmin

- Tambahkan CLI `npm run admin -- create-superadmin` untuk bootstrap awal.
- Validasi password, hash dengan mekanisme autentikasi yang sama, dan cegah duplikasi username/email.
- Tambahkan service control-plane untuk membuat, menonaktifkan, dan reset password superadmin secara teraudit.
- Pastikan superadmin tidak memperoleh tenant context operasional secara implisit.
- Cegah tenant admin mengirim atau mengubah role menjadi `superadmin`.
- Cegah sistem kehilangan seluruh superadmin aktif.

### Tahap D — Tenant Management

- Buat service provisioning transaksional.
- Buat API list/create/update tenant khusus superadmin.
- Buat halaman Tenant Management.
- Batasi User Management admin ke tenant aktif.
- Sediakan aktivasi/nonaktif tenant; penghapusan permanen tidak disediakan pada versi awal.

### Tahap E — Operator tenant-scoped

- Ganti konfigurasi satu token global menjadi registry token hash dengan `tenant_id` dan scopes.
- Operator API mendapatkan tenant hanya dari identitas token.
- Worker memproses job berdasarkan tenant job, bukan satu env tenant global.
- Tambahkan command CLI `whoami` dan pemeriksaan capability.

### Tahap F — Plugin Codex

- Scaffold `makna-content-operator` menggunakan helper `plugin-creator`.
- Tambahkan skill workflow, script wrapper, contoh payload, dan guardrail approval.
- Validasi manifest dan skill.
- Uji plugin terhadap staging dengan job idempotent dan tanpa akses social publishing.

## 4. Perubahan File dan Before/After Code

### 4.1 `lib/db-pg.js`

**Code Sebelum (Current/Before)**

```js
CREATE TABLE IF NOT EXISTS operator_jobs (...);
// Belum ada migrasi identity gemini_api_keys dan metadata tenant lengkap.
```

**Code Sesudah (Proposed/After)**

```js
await migrateTenantManagement(pool);
await migrateGeminiKeyPoolIdentity(pool);

// idempotent migration:
// tenants.slug, timezone, status, updated_at
// gemini_api_keys.id sequence/default
// UNIQUE (tenant_id, api_key)
// tenant_audit_events
// operator_credentials (token_hash, tenant_id, scopes, status)
```

### 4.2 `lib/db.js`

**Code Sebelum (Current/Before)**

```js
try {
  await pgQuery(
    'INSERT INTO gemini_api_keys (key_name, api_key, tier, daily_limit) VALUES ($1,$2,$3,$4)',
    values
  );
} catch (e) {
  skippedCount++;
}
```

**Code Sesudah (Proposed/After)**

```js
const tenantId = getActiveTenantId();
const result = await insertTenantGeminiKeys({ tenantId, keys });
return {
  added: result.added,
  duplicates: result.duplicates,
  failures: result.failures
};
```

Tambahkan repository/query tenant provisioning, tenant listing, status update, audit event, serta operator credential lookup. Semua query operasional wajib menyertakan `tenant_id` eksplisit.

### 4.3 `app/api/keys/route.js`

**Code Sebelum (Current/Before)**

```js
return NextResponse.json({
  success: true,
  message: `Berhasil mengimpor ${result.addedCount} API Key baru ke pool.`
});
```

**Code Sesudah (Proposed/After)**

```js
const success = result.added > 0 || result.duplicates > 0;
return NextResponse.json({
  success,
  summary: {
    added: result.added,
    duplicates: result.duplicates,
    rejected: rejectedKeys.length,
    failed: result.failures.length
  },
  errors: maskImportFailures(result.failures)
}, { status: success ? 200 : 500 });
```

### 4.4 `app/settings/page.js`

**Code Sebelum (Current/Before)**

```js
if (data.success) {
  showToast(data.message);
  fetchPool();
}
```

**Code Sesudah (Proposed/After)**

```js
setImportSummary(data.summary);
await fetchPool();
showToast(formatImportResult(data.summary), data.success ? 'success' : 'error');
```

UI menampilkan empat angka terpisah dan tidak pernah menampilkan nilai API key utuh.

### 4.5 `scripts/admin.mjs` dan `package.json`

**Code Sebelum (Current/Before)**

```json
{
  "scripts": {
    "operator": "node scripts/makna-operator.mjs"
  }
}
```

Belum ada jalur aman untuk membuat akun superadmin pertama.

**Code Sesudah (Proposed/After)**

```json
{
  "scripts": {
    "admin": "node scripts/admin.mjs",
    "operator": "node scripts/makna-operator.mjs"
  }
}
```

```js
// npm run admin -- create-superadmin --username <name> --email <email>
// Password dibaca dari prompt tersembunyi atau MAKNA_ADMIN_BOOTSTRAP_PASSWORD,
// tidak diterima sebagai argumen CLI dan tidak pernah dicetak.
await createSuperadmin({ username, email, password, actor: 'bootstrap-cli' });
```

Command bootstrap ditolak jika superadmin sudah ada, kecuali dijalankan melalui jalur otorisasi superadmin aktif yang terpisah.

### 4.6 `lib/superadmin-service.js` — file baru

**Code Sebelum (Current/Before)**

```js
// Belum ada service lifecycle superadmin.
```

**Code Sesudah (Proposed/After)**

```js
export async function createSuperadmin(input, actor) {
  validateStrongPassword(input.password);
  return withTransaction(async tx => {
    const user = await insertControlPlaneUser(tx, {
      ...input,
      tenantId: null,
      role: 'superadmin'
    });
    await recordTenantAudit(tx, actor, null, 'superadmin.created');
    return sanitizeUser(user);
  });
}

export async function deactivateSuperadmin(id, actor) {
  await assertAnotherActiveSuperadminExists(id);
  // update status dan audit secara transaksional
}
```

### 4.7 `lib/tenant-admin.js` — file baru

**Code Sebelum (Current/Before)**

```js
// Belum ada service provisioning tenant.
```

**Code Sesudah (Proposed/After)**

```js
export async function provisionTenant(input, actor) {
  return withTransaction(async tx => {
    const tenant = await createTenant(tx, normalizeTenant(input));
    const admin = await createTenantAdmin(tx, tenant.id, input.admin);
    await seedTenantSettings(tx, tenant.id, input.defaults);
    await grantTenantAdminMenus(tx, admin.id);
    await recordTenantAudit(tx, actor, tenant.id, 'tenant.created');
    return { tenant, admin: sanitizeUser(admin) };
  });
}
```

### 4.8 `app/api/admin/tenants/route.js` — file baru

**Code Sebelum (Current/Before)**

```js
// Tidak ada endpoint tenant management.
```

**Code Sesudah (Proposed/After)**

```js
export async function GET(req) {
  requireSuperadmin(req);
  return NextResponse.json({ tenants: await listTenantsWithCounts() });
}

export async function POST(req) {
  const actor = requireSuperadmin(req);
  const result = await provisionTenant(await req.json(), actor);
  return NextResponse.json({ success: true, ...result }, { status: 201 });
}
```

### 4.9 `app/api/admin/tenants/[tenantId]/route.js` — file baru

**Code Sebelum (Current/Before)**

```js
// Tidak ada endpoint status tenant.
```

**Code Sesudah (Proposed/After)**

```js
export async function PATCH(req, { params }) {
  const actor = requireSuperadmin(req);
  return updateTenantStatus((await params).tenantId, await req.json(), actor);
}
```

Endpoint hanya mendukung update metadata/status; tidak menyediakan hard delete.

### 4.10 `app/settings/tenants/page.js` — file baru

**Code Sebelum (Current/Before)**

```jsx
// Belum ada halaman Tenant Management.
```

**Code Sesudah (Proposed/After)**

```jsx
<TenantTable tenants={tenants} />
<CreateTenantDialog
  fields={['name', 'slug', 'timezone', 'admin_username', 'admin_email', 'admin_password']}
/>
```

Halaman menampilkan jumlah user/brand/key per tenant, status, timezone, dan aksi aktivasi/nonaktif.

### 4.11 `app/components/Sidebar.js`

**Code Sebelum (Current/Before)**

```js
{ label: 'User Management', href: '/settings/users', adminOnly: true }
```

**Code Sesudah (Proposed/After)**

```js
{ label: 'Tenant Management', href: '/settings/tenants', superadminOnly: true },
{ label: 'User Management', href: '/settings/users', adminOnly: true }
```

### 4.12 `app/api/admin/users/route.js`

**Code Sebelum (Current/Before)**

```js
const { username, email, password, role = 'user' } = body;
await db.prepare('INSERT INTO users (...) VALUES (...)').run(...);
```

**Code Sesudah (Proposed/After)**

```js
const admin = requireTenantAdmin(req);
await createUser({
  tenantId: admin.tenantId,
  username,
  email,
  password,
  role: normalizeTenantRole(role)
});
```

Admin tenant tidak boleh membuat `superadmin` dan tidak boleh mengirim `tenant_id` sendiri.

### 4.13 `lib/auth.js`

**Code Sebelum (Current/Before)**

```js
if (currentUser.role === 'superadmin') {
  return { tenantId: '__none__' };
}
```

**Code Sesudah (Proposed/After)**

```js
export function requireSuperadmin(req) { /* platform control plane only */ }
export function requireTenantAdmin(req) { /* current tenant only */ }
export function assertTenantActive(user) { /* reject suspended tenant */ }
```

Superadmin tetap tidak memperoleh akses implisit ke data planner/campaign tenant.

### 4.14 `lib/operator-auth.js`

**Code Sebelum (Current/Before)**

```js
return {
  tenantId: process.env.MAKNA_OPERATOR_TENANT_ID || 'default_tenant',
  actor: 'operator-api'
};
```

**Code Sesudah (Proposed/After)**

```js
const credential = await findOperatorCredential(hashToken(suppliedToken));
assertActiveCredential(credential);
return {
  tenantId: credential.tenant_id,
  actor: credential.id,
  scopes: credential.scopes
};
```

### 4.15 `lib/operator-content-worker.js`

**Code Sebelum (Current/Before)**

```js
const tenantId = process.env.MAKNA_OPERATOR_TENANT_ID || 'default_tenant';
await tenantContext.run(tenantId, processNextJob);
```

**Code Sesudah (Proposed/After)**

```js
for (const tenantId of await listTenantsWithQueuedOperatorJobs()) {
  await tenantContext.run(tenantId, () => processNextTenantJob(tenantId));
}
```

### 4.16 `scripts/makna-operator.mjs`

**Code Sebelum (Current/Before)**

```js
npm run operator -- create|status|approve
```

**Code Sesudah (Proposed/After)**

```js
npm run operator -- whoami
npm run operator -- create --file request.json --wait
npm run operator -- status <job-id> --watch
npm run operator -- approve <job-id> --all
```

CLI menampilkan identitas tenant/scope tanpa mencetak token.

### 4.17 `plugins/makna-content-operator/.codex-plugin/plugin.json` — file baru

**Code Sebelum (Current/Before)**

```json
// Plugin belum ada.
```

**Code Sesudah (Proposed/After)**

```json
{
  "name": "makna-content-operator",
  "version": "0.1.0",
  "description": "Create and operate tenant-scoped MAKNA content jobs through the official Operator API."
}
```

Manifest final akan dihasilkan dan divalidasi dengan helper resmi `plugin-creator`, bukan diasumsikan manual.

### 4.18 `plugins/makna-content-operator/skills/content-operator/SKILL.md` — file baru

**Code Sebelum (Current/Before)**

```md
<!-- Skill belum ada. -->
```

**Code Sesudah (Proposed/After)**

```md
# MAKNA Content Operator

Use the Operator API for create, status, wait, and approval workflows.
Never request or enable social publishing.
Require explicit approval before approving generated storyboards.
```

### 4.19 `plugins/makna-content-operator/scripts/makna-content-operator.mjs` — file baru

**Code Sebelum (Current/Before)**

```js
// Belum ada wrapper plugin.
```

**Code Sesudah (Proposed/After)**

```js
// Thin wrapper over the supported Operator HTTP contract.
// Commands: whoami, create, status, wait, approve.
// Secrets are read from environment and never printed.
```

### 4.20 `scripts/test-tenant-key-pool.mjs` dan `scripts/test-operator-content.mjs`

**Code Sebelum (Current/Before)**

```js
// Belum ada coverage tenant/key pool lengkap;
// operator test masih menggunakan konfigurasi tenant tunggal.
```

**Code Sesudah (Proposed/After)**

```js
await testTenantProvisioningRollback();
await testInitialSuperadminBootstrap();
await testTenantAdminCannotCreateSuperadmin();
await testLastSuperadminCannotBeDisabled();
await testBulkImport21Keys();
await testCrossTenantIsolation();
await testOperatorTokenTenantBinding();
await testOperatorIdempotency();
```

## 5. Strategi Verifikasi

1. Migrasi dijalankan dua kali dan tetap idempotent.
2. Bootstrap superadmin pertama tanpa password di argumen/log, lalu verifikasi login.
3. Pastikan bootstrap kedua ditolak, tenant admin tidak dapat membuat superadmin, dan superadmin aktif terakhir tidak dapat dinonaktifkan.
4. Buat Tenant A dan Tenant B beserta admin awal.
5. Admin A tidak dapat melihat user, brand, key, planner, atau job Tenant B.
6. Impor 21 Gemini key ke Tenant A; UI dan database harus menunjukkan hasil yang sama.
7. Ulangi key yang sama dan pastikan dihitung sebagai duplicate, bukan failure.
8. Simulasikan error database dan pastikan UI tidak mengatakan sukses.
9. Buat operator credential berbeda untuk Tenant A/B dan pastikan job terikat benar.
10. Jalankan CLI dan plugin: `whoami`, create idempotent, status/wait, approval.
11. Pastikan payload `enable_social_post=true` tetap ditolak.
12. Jalankan lint, test terkait, build produksi, dan smoke test staging.

## 6. Strategi Rilis

- Satu patch release setelah seluruh checklist dan verifikasi berhasil.
- Jalankan SOP `release-non-interactive` dengan changelog tenant provisioning, Gemini Key Pool, dan plugin operator.
- Pastikan branch `main` dan tag rilis terunggah ke remote.
- Deploy Node 1 hanya melalui `npm run deploy:node1` jika pengguna meminta deployment produksi/staging Node 1.

## Execution Task List

- [x] Audit schema, constraint, dan seluruh query tenant-sensitive.
- [x] Tambahkan migrasi tenant metadata, audit, Gemini key ID, dan unique tenant-scoped.
- [x] Refaktor repository Gemini Key Pool menjadi tenant-aware dan error-transparent.
- [x] Perbaiki API serta UI hasil impor Gemini key.
- [x] Tambahkan test Gemini single/bulk/duplicate/failure dan isolasi tenant.
- [x] Implementasikan CLI bootstrap superadmin tanpa password pada argumen atau log.
- [x] Implementasikan lifecycle, audit, dan perlindungan superadmin aktif terakhir.
- [x] Tambahkan test bootstrap/login serta larangan eskalasi role oleh tenant admin.
- [x] Implementasikan service provisioning tenant transaksional.
- [x] Implementasikan API Tenant Management khusus superadmin.
- [x] Implementasikan UI Tenant Management dan navigasi berbasis role.
- [x] Kunci User Management serta status login ke tenant aktif.
- [x] Migrasikan autentikasi Operator API ke credential tenant-scoped dan scopes.
- [x] Perbarui worker dan CLI untuk multi-tenant serta command `whoami`.
- [x] Scaffold plugin `makna-content-operator` dengan skill dan script wrapper.
- [x] Validasi manifest/plugin dan lakukan smoke test terhadap staging.
- [x] Jalankan lint, test, build, dan regression test Content Planner/OPC.
- [x] Perbarui seluruh checkbox secara real-time selama eksekusi.
- [x] Jalankan patch release, verifikasi tag dan sinkronisasi `main` sesuai SOP.
