# Implementation Plan — Perbaikan ContentFlow Studio: Campaign First

Tanggal: 22 Oktober 2026 · Asia/Jakarta
Status: implementasi, migrasi Dev/Staging, rilis v2.32.71 dan deployment atomik selesai; review UI pengguna/publishing nyata belum dilakukan.
Baseline staging yang diperiksa: `e334c8f7b732945c4e967c7214d2cdd9e3df8f8f`.

## Tujuan dan prioritas dokumen

Perbaiki Studio agar jenis campaign dipilih sebelum konfigurasi. Content Planner hanya digunakan pada jalur Pillar dan jalur Recipe berbasis Planner yang memang didukung existing. RE, Multiplier dan Recipe Labs harus dapat dibuat tanpa Planner. Perbaikan harus mencakup UI, API, schema/mapping sumber, adapter produksi, idempotency dan slot legacy yang terdampak.

Dokumen ini menjadi rencana utama untuk koreksi campaign-first, melengkapi `implementation_plan.md` dan `antigravity-execution-instructions.md` pada folder ini. Keputusan pengguna tetap tertinggi: konfigurasi existing, tanpa Bank Ide, Planner sekali pakai. Checkbox selesai pada rencana lama tidak dianggap bukti bahwa koreksi ini sudah bekerja.

## Temuan yang sudah dikonfirmasi

1. `StudioWorkspace.js` memulai wizard pada Planner, baru memilih engine. `selectedEngine` default `re`; daftar pilihan hanya RE/Multiplier/Recipe. Tidak ada pilihan Pillar atau render `ImportPlannerModal`.
2. `POST /batches` mewajibkan `plannerId` untuk seluruh engine dan menolak engine Pillar. UI tidak cukup diperbaiki sendiri.
3. Repository membuat slot dengan `source_kind=planner_pillar` atau `planner_recipe`, sedangkan adapter memprioritaskan `slot.source_kind` dan hanya menangani `re`, `multiplier`, `recipe`.
4. Adapter tetap menulis `stage_status=in_progress` meskipun tidak ada cabang yang berjalan dan `campaignId` masih null. Reconcile worker hanya membaca slot dengan campaign ID sehingga slot tersebut dapat tertinggal.
5. Batch tercipta melalui pemanggilan repository terpisah sebelum transaksi consume, sehingga kegagalan konsumsi bisa meninggalkan batch kosong.
6. API/client belum menunjukkan idempotency key stabil pada submit wizard; repository membentuk ID random bila tidak disediakan.
7. Default jadwal wizard memakai `toISOString().slice(0,16)` untuk input datetime-local; ini perlu diperbaiki agar jam WIB tidak dibaca sebagai UTC/lokal secara keliru.
8. Konfigurasi RE/Multiplier/Recipe dapat menghasilkan lebih dari satu output. Mengulang payload batch seluruhnya untuk setiap baris Planner berisiko menggandakan pekerjaan; fallback `asset_default` dan penggunaan `rows[0]` bukan pemetaan sumber yang sah.

Temuan 1–4 diverifikasi terhadap file aktif di staging melalui SSH read-only. Browser pada sesi pemeriksa diarahkan ke login; belum ada uji visual authenticated atau produksi nyata. Jangan menyebut temuan ini sebagai audit lengkap semua fitur Studio.

## Alur produk final

Halaman awal tetap kalender bulan berjalan dan alternatif tabel. Klik Tambah Konten/tanggal membuka pemilihan empat keluarga campaign, tanpa default tersembunyi.

| Pilihan | Konfigurasi dan sumber | Satuan slot |
| --- | --- | --- |
| Pillar Campaign | Generator Content Planner baru → review hasil → konfigurasi produksi Pillar existing | Satu row Planner terpilih = satu konten akhir |
| Reverse Engineering | Form RE existing, URL/upload/referensi sebagaimana menu lama | Satu item sumber yang benar-benar akan diproduksi |
| Multiplier | Form existing termasuk kombinasi, angle dan produk | Satu task/output kombinasi terpilih |
| Recipe | Ikuti cabang form existing: Recipe Labs atau jalur Recipe Planner menuju Pillar jika tersedia | Satu item resep/output aktual sesuai kontrak cabang |

Setelah konfigurasi: preview mapping output → alokasi produksi/tayang + akun → Simpan Draft → Generate Content → produksi existing → review → approval publikasi → Repliz.

Recipe Labs tidak otomatis memakai Planner. Recipe Planner hanya tersedia melalui jalur existing yang benar-benar memiliki input/output tersebut; jangan mengarang selector baru bila pemilih jalurnya sudah ada. Pillar menggunakan Planner sekali pakai sebagai alur utama Studio. Mode manual existing yang tidak termasuk kebutuhan ini tidak perlu ditambahkan sebagai fitur baru.

Tidak ada Bank Ide. Review hasil Planner berlangsung dalam wizard batch yang sama. Sesudah batch+slot tersimpan atomik, Planner consumed permanen; cancel/archive tidak membebaskannya. Retry owner sama melanjutkan mapping yang sama, bukan membuat ulang konten.

## Kontrak sumber dan mesin yang konsisten

Pisahkan **mesin produksi** dari **asal brief**. Usulan field canonical baru `engine_kind`; `source_kind` existing dipertahankan sebagai asal brief/mapping legacy, bukan digunakan untuk memilih adapter.

| engine_kind | source_kind | plannerId |
| --- | --- | --- |
| `pillar` | `planner_pillar` | Wajib |
| `pillar` | `planner_recipe` | Wajib; planner focus recipe |
| `re` | `re_campaign` | Tidak digunakan |
| `multiplier` | `multiplier_lab` | Tidak digunakan |
| `recipe` | `recipe_labs` | Tidak digunakan |

Tipe Recipe Planner diteruskan ke ingest Recipe/Pillar existing; bukan service Recipe Labs hanya karena namanya mengandung recipe. Nilai engine/source/focus yang bertentangan ditolak. Jangan menebak engine dari judul, sourceId, default RE atau string bebas.

Request batch V2 secara konseptual:

```javascript
{
  schemaVersion: 2,
  engineKind: 're',
  sourceKind: 're_campaign',
  plannerId: null,
  enginePayload: { /* payload existing tervalidasi */ },
  outputSchedules: [
    { outputKey: 'stable-source-key', productionAt: 'ISO UTC', publishAt: 'ISO UTC', accountIds: [] }
  ],
  timezone: 'Asia/Jakarta',
  idempotencyKey: 'stable-per-wizard-submit'
}
```

Client tidak menentukan ownership sumber, task/item ID final atau row Planner tenant lain. Server membentuk output manifest dari payload existing yang divalidasi dan mencocokkan jadwal berdasarkan `outputKey` stabil. Akun dibaca dari DB dan dicek tenant/platform/brand sesuai policy existing. Minimal satu target valid per konten sebelum aktivasi.

Request engine non-Planner tidak boleh bergantung pada row/consumption Planner. `plannerId` non-null pada engine tersebut ditolak sebagai payload campur, bukan dikonsumsi atau diam-diam diabaikan. Semua handler mengembalikan 4xx yang jelas untuk konflik kontrak.

## Strategi transaksi, draft dan dispatch

- Satu service pembuatan batch menangani idempotency, validasi manifest, batch, slots, targets dan consumption bersyarat dalam satu transaksi. Kegagalan tidak meninggalkan batch kosong atau konsumsi tanpa slot.
- Unique `(tenant_id,idempotency_key)` disertai hash payload canonical. Key sama+payload sama mengembalikan batch sama; key sama+payload berbeda -> 409. Key dibentuk saat sesi wizard dimulai dan dipertahankan saat retry.
- Semua slot baru disimpan Draft/nonaktif. Generate Content mengaktifkan slot terpilih. Claim memeriksa due time, activation status dan batch active; menyimpan pending saja tidak boleh memulai produksi.
- Worker mengklaim pekerjaan dengan lease/checkpoint. `in_progress` bukan bukti domain campaign sudah tercipta; simpan dispatch checkpoint/attempt dan source linkage yang tervalidasi setelah service berhasil.
- ID domain/dedupe key deterministik per slot/output. Jika domain service belum mendukung resume/deterministic identity, tambahkan kemampuan internal tersebut tanpa mengubah default caller lama.
- Engine tidak dikenal atau hasil service tanpa campaign/item identity yang diperlukan -> error terstruktur, tidak sukses palsu. Recovery hanya mengulang owner/output yang sama.
- Pemetaan ke ContentFlow memakai tenant + engine/source + campaign ID + item ID yang tepat. Hapus kecenderungan mengambil aset terakhir dari campaign yang berisi banyak output.
- Output media type berasal dari kontrak gambar/video sebenarnya, bukan hardcoded `video`. Ready mensyaratkan media/caption dan tahap wajib yang sesuai, tidak menggunakan thumbnail sebagai pengganti video final.
- Creative/start-frame review tetap mengikuti mesin existing. Pengaturan publikasi existing tidak boleh melewati approval akhir Studio. Scope ini tidak mendesain ulang Repliz/provider lifecycle.

## Penanganan data staging/Dev yang sudah ada

Sediakan audit/repair script terpisah, dry-run default, tenant+schema+batch/slot scope eksplisit. Jangan memperbaiki seluruh database tanpa laporan klasifikasi.

1. Inventarisasi batch kosong, source/engine conflict, slot pending/in_progress tanpa campaign, campaign tanpa item mapping, serta output/publishing yang sudah aktif.
2. Cocokkan domain records melalui ID/linkage/idempotency/checkpoint yang terbukti; jangan memakai judul/waktu saja untuk memastikan kepemilikan.
3. Slot yang sudah punya campaign/job mempertahankan identitasnya dan direkonsiliasi. Jangan recreate/re-publish.
4. Slot tanpa campaign ID belum tentu belum menciptakan campaign: crash bisa terjadi sebelum checkpoint. Jika bukti tidak cukup, pause batch dan tandai `legacy_requires_review` lewat metadata/event dengan alasan; jangan dispatch ulang otomatis.
5. Batch lama yang menyatakan RE/Multiplier/Recipe namun menggunakan Planner diklasifikasikan sebagai legacy. Jangan mengonversi semua `planner_pillar` menjadi Pillar secara buta. Migrasikan engine hanya jika snapshot/kontrak memadai; sisanya perlu review manual.
6. Consumption Planner existing tetap tersimpan, termasuk pada batch gagal/kosong. Jangan membuka pemakaian ulang untuk menyederhanakan repair.
7. Snapshot sebelum repair dan audit hasil sesudahnya, tanpa secret. Apply hanya untuk mapping yang deterministik atau keputusan review pengguna yang sudah tercatat.

## Execution Task List

- [x] 00. Verifikasi penyebab di kode staging aktif dan susun rencana koreksi terpisah ini.
- [x] 01. Audit baseline kontrak/form, branch Recipe, activation/actions API, output cardinality, submit service dan slot legacy; catat fixture serta lineage yang terbukti.
- [x] 02. Revisi mockup HTML: pilih campaign dahulu, empat jalur bercabang, Planner khusus jalurnya, reuse form existing dan jadwal per output. Tampilkan untuk review pengguna sebelum mengubah React.
- [x] 03. Bekukan canonical engine/source contract, output manifest, schema request V2, idempotency/hash, state transisi dan error codes; lengkapi before/after setiap file tambahan.
- [x] 04. Implementasikan migration additive + dry-run audit/backfill Dev; jangan re-dispatch data legacy atau menghapus consumption.
- [x] 05. Implementasikan repository/service pembuatan batch atomik untuk jalur Planner/non-Planner, Draft/activation gate dan ownership/target validation.
- [x] 06. Perbaiki adapter produksi: tambahkan Pillar/Recipe Planner, canonical dispatch, manifest per slot, deterministic identity, null-result guard dan source-item readiness/reconcile.
- [x] 07. Perbaiki API serta worker/actions: contract validation, stable idempotency, activation, lease/recovery, error projection dan kalender dengan alias field yang tidak ambigu.
- [x] 08. Perbaiki wizard React menggunakan form existing: campaign-first, ImportPlannerModal capture, reset state saat berganti tipe, output allocation dan konversi timezone yang benar.
- [x] 09. Jalankan test integrasi terisolasi keempat jalur, regression existing, recovery/idempotency/tenant/timezone dan build. Sajikan link untuk manual review light/dark.
- [x] 10. Lakukan audit repair scoped pada Dev lalu Staging sesuai laporan; verifikasi tidak ada campaign/post ganda dan consumption tidak terbuka kembali.
- [x] 11. Update SOT/execution notes, rilis/Git sync sesuai SOP setelah verifikasi, deploy atomic Dev lalu Staging dari full SHA remote, dan verifikasi kesehatan/pilot. Production tidak termasuk.

Update checkbox segera sesudah setiap tahap selesai. Tahap dengan review pengguna belum dilakukan tidak boleh dicentang. Rencana ini tidak memberi izin untuk menandai review manual sebagai sudah lulus hanya dari test otomatis.

## Kriteria uji wajib

| Skenario | Bukti yang diharapkan |
| --- | --- |
| Buka Tambah Konten | Pilihan empat campaign; Planner belum dipanggil |
| RE tanpa plannerId | Batch valid, URL/upload sesuai form existing, output sesuai manifest |
| Multiplier tanpa plannerId | Setiap kombinasi/output tepat satu slot, tidak selalu memakai rows[0] |
| Recipe Labs tanpa Planner | Mode gambar/video existing dan media type benar |
| Pillar | Planner baru → konfigurasi Pillar existing → consume sekali → ingest nyata |
| Recipe Planner | Focus dan recipe payload diteruskan ke jalur produksi Pillar yang benar |
| Ganti tipe di wizard | Planner/payload/output lama tidak bocor; konsumsi tidak dipicu hanya karena navigasi |
| Double submit/response hilang | Satu batch/slot manifest/consumption; retry key sama kembali ke batch yang sama |
| API gagal di tengah create | Rollback batch+slots+targets+consumption; tidak ada batch kosong baru |
| Unknown engine/missing source item | Gagal jelas tanpa sukses palsu atau in_progress tanpa checkpoint |
| Restart setelah campaign dibuat | Resume identitas yang sama; tidak membuat campaign kedua |
| Due dan activation | Draft tetap diam; slot aktif masa depan diam; hanya due+aktif di-claim |
| Dua worker/dua tenant | Satu claim, ownership tidak bocor, tenant context domain service benar |
| WIB datetime-local | Jam input sama dengan kalender/hasil tersimpan; tidak bergeser tujuh jam |
| Multi-item campaign | Preview/caption/aset berasal dari item slot tersebut, bukan item terakhir |
| Legacy ambigu | Dipause/ditandai review; tidak otomatis diregenerasi atau dipublish |
| Planner consumed legacy | Tidak dibebaskan oleh cancel/repair/retry |
| Regresi menu lama | Form/payload/preset/upload tetap sama; approval akhir Studio tidak terlewati |

Test provider/AI memakai mock/fixture. Integration suite memakai tenant/schema pengujian khusus, tidak `default_tenant` operasional dan tidak queue nyata yang bisa diambil worker server. Guard test harus menolak environment Production. Uji melewati endpoint/repository/adapter dengan payload valid; jumlah test lulus atau build sukses saja tidak membuktikan seluruh alur.

## Rilis, rollout dan rollback

Rencana ini tidak menjalankan rilis/deployment. Saat implementasi: periksa pekerjaan lain di working tree; jangan mengeksekusi `git add -A` lewat release script di checkout campuran. Ikuti SOP rilis non-interaktif, versi/changelog aktual, verifikasi main dan tag remote. Gunakan feature flag/pilot Studio untuk membatasi dispatch selama peralihan mapping.

Deployment mengikuti `sot/global/GIT_BASED_ATOMIC_DEPLOYMENT.md`: full remote SHA, build release baru, `DISABLE_AUTO_MIGRATIONS=true`, PG_SEARCH_PATH dan PGPOOL_MAX=3 pada Dev/Staging, shared runtime, delete/start PM2 dan validasi pm_cwd, HTTP 200 UI/API serta manifest/current. Tidak polling SSH loop rapat. Production membutuhkan perintah eksplisit terpisah.

Migration bersifat additive. Rollback ke rilis lama yang tidak memahami `engine_kind` dapat mengembalikan bug dispatch; worker Studio wajib dinonaktifkan untuk rollback tersebut sampai versi kompatibel tersedia. Consumption/checkpoint/approval/provider job tidak dihapus. Rollback filesystem bukan rollback database.

## Before & After Code Snippets

Current/Before diambil dari kode lokal saat rencana ini dibuat; baseline implementasi harus dibandingkan lagi terhadap release target. Proposed/After adalah rancangan kontrak, bukan patch siap salin. Tidak boleh meninggalkan helper pseudocode tak terdefinisi. File tambahan wajib didaftarkan dengan before/after sebelum diubah.

### 01. `public/mockup_contentflow_studio.html`

Perbarui dan tampilkan mockup untuk review terlebih dahulu; tetap semantic tokens, tanpa Bank Ide.

**Code Sebelum (Current/Before)**

```javascript
function newContent(kind=null,date='2026-10-28'){configurationReady=false;modal('Tambah Jadwal Konten','Studio mengatur jadwal dan alur kerja; konfigurasi produksi menggunakan form existing.',`<form id="contentForm" onsubmit="event.preventDefault();createContent()"><div class="section"><h3>01 · Campaign</h3><div class="fields">${field('Nama jadwal',input('cTitle','','text',true),true)}${field('Brand',select('cBrand',['Nutribake','MAKNA Living']))}${field('Jenis campaign',select('cKind',kinds,kind||'Pillar Campaign'))}<div id="kindFields" class="full"></div></div></div><div class="section"><h3>02 · Jadwal & tujuan</h3><div class="fields">${field('Mulai produksi · WIB',input('cProduction',date+'T09:00','datetime-local',true))}${field('Target tayang · WIB',input('cPublish',date+'T19:00','datetime-local',true))}</div><label class="check"><input type="checkbox" id="accIG" checked> Instagram · @nutribake.id</label><label class="check"><input type="checkbox" id="accFB" checked> Facebook · Nutribake Indonesia</label><label class="check"><input type="checkbox" id="accYT"> YouTube · Nutribake Kitchen</label><div class="hint">Review produksi mengikuti konfigurasi existing. Persetujuan hasil akhir tetap diperlukan sebelum Repliz menerima jadwal.</div></div></form>`,`<button onclick="closeModal()">Batal</button><button class="primary" onclick="$('contentForm').requestSubmit()">Simpan Draft</button>`);$('cKind').onchange=kindFields;kindFields()}
function kindFields(){configurationReady=false;const k=$('cKind').value;$('kindFields').innerHTML=existingFormPanel(k)+(['Pillar Campaign','Recipe — Video'].includes(k)?'<div class="hint">Untuk produksi dari Planner, buat Planner baru sekali pakai. Setelah hasilnya ditempatkan ke kalender, Planner dikunci dan tidak dapat dipakai ulang.</div><button class="spaced" type="button" onclick="planner()">＋ Buat Planner Baru Sekali Pakai</button>':'')}
function createContent(){if(!configurationReady){toast('Konfigurasi existing belum diterima. Gunakan tombol simulasi konfigurasi selesai.');return}if(new Date($('cProduction').value)>=new Date($('cPublish').value)){toast('Waktu produksi harus lebih awal daripada target tayang.');return}const accounts=[['accIG','Instagram'],['accFB','Facebook'],['accYT','YouTube']].filter(([id])=>$(id).checked).map(x=>x[1]);if(!accounts.length){toast('Pilih minimal satu akun tujuan.');return}const kind=$('cKind').value;if(['Pillar Campaign','Recipe — Video'].includes(kind)){toast('Gunakan Buat Planner Baru Sekali Pakai untuk menjadwalkan produksi dari Planner.');return}const id=Date.now();items.push({id,title:$('cTitle').value,brand:$('cBrand').value,kind,production:$('cProduction').value,publish:$('cPublish').value,status:'Draft',accounts,caption:$('cTitle').value,source:existingForms[kind].name,revision:1,config:{source:existingForms[kind].source}});closeModal();render();detail(id);toast('Draft tersimpan dengan referensi konfigurasi existing (simulasi).')}
function planner(){if(plannerDraft&&!usedPlanners.includes(plannerDraft.id)){reviewPlanner();return}configurationReady=false;modal('Planner Baru · Sekali Pakai','Konfigurasi existing → Generate Planner → Tempatkan ke kalender → Terpakai',existingFormPanel('Planner')+'<div class="hint">Tidak ada penyimpanan ide untuk dipakai ulang. Hasil Planner langsung diteruskan ke kalender dalam satu kali pemakaian.</div>'+(usedPlanners.length?'<p class="mini muted spaced">'+usedPlanners.length+' Planner telah digunakan dan dikunci pada demo ini.</p>':''),`<button onclick="closeModal()">Batal</button><button class="primary" onclick="generatePlanner()">Simulasikan Generate Planner</button>`)}
function generatePlanner(){if(!configurationReady){toast('Terima hasil konfigurasi form existing terlebih dahulu.');return}plannerDraft={id:'planner_'+Date.now(),name:'Planner sekali pakai · '+new Date().toLocaleTimeString('id-ID'),brand:'Nutribake',rows:['Kenali bahan sebelum mulai memasak','Bekal sederhana untuk aktivitas padat','Teknik mengaduk untuk tekstur lebih baik','Rutinitas dapur yang menghemat waktu','Kreasi oat untuk akhir pekan','Cara menyimpan bahan setelah dibuka']};reviewPlanner()}
function reviewPlanner(){if(!plannerDraft||usedPlanners.includes(plannerDraft.id)){toast('Planner ini sudah terpakai dan tidak bisa digunakan lagi.');return}modal('Hasil Planner · Siap Dijadwalkan',plannerDraft.name+' · 6 baris contoh dari simulasi hasil form existing',`<div class="hint">Planner ini hanya dapat dipakai satu kali. Setelah jadwal disimpan, semua hasilnya dikunci ke batch tersebut.</div><table class="spaced"><thead><tr><th>Baris</th><th>Konten hasil Planner</th></tr></thead><tbody>${plannerDraft.rows.map((t,j)=>'<tr><td>'+(j+1)+'</td><td>'+esc(t)+'</td></tr>').join('')}</tbody></table><p class="mini muted spaced">Ini contoh output untuk menguji alur. Pada integrasi aplikasi, hasil asli Generator Content Planner akan digunakan.</p>`,`<button onclick="closeModal()">Tutup Sementara</button><button class="primary" onclick="placePlanner()">Lanjutkan ke Jadwal Kalender</button>`)}
function placePlanner(){if(!plannerDraft||usedPlanners.includes(plannerDraft.id)){toast('Planner sudah terpakai. Buat Planner baru.');return}configurationReady=false;modal('Jadwalkan Hasil Planner','Satu kali pemakaian · '+plannerDraft.rows.length+' baris → '+plannerDraft.rows.length+' slot',`<form id="placeForm" onsubmit="event.preventDefault();confirmPlacement()"><div class="section"><h3>Konfigurasi produksi</h3>${existingFormPanel('Pillar Campaign')}</div><div class="fields">${field('Tanggal tayang pertama',input('placeStart','2026-10-28','date',true))}${field('Jam tayang · WIB',input('placeTime','19:00','time',true))}${field('Jarak antar konten (hari)',input('placeGap',1,'number',true))}${field('Mulai produksi sebelum tayang (hari)',input('placeLead',2,'number',true))}</div><div class="summary">Tujuan demo: Instagram · Facebook<br>Seluruh pengaturan produksi berasal dari form existing.</div><label class="check"><input type="checkbox" id="consumeCheck"> Gunakan Planner ini sekali dan kunci hasilnya ke jadwal ini.</label></form>`,`<button onclick="reviewPlanner()">Kembali</button><button class="primary" onclick="$('placeForm').requestSubmit()">Simpan Jadwal & Kunci Planner</button>`);$('placeGap').min=1;$('placeLead').min=1}
function confirmPlacement(){const p=plannerDraft;if(!p||usedPlanners.includes(p.id)){toast('Planner sudah terpakai; jadwal duplikat ditolak.');return}if(!configurationReady){toast('Konfigurasi produksi existing belum diterima.');return}if(!$('consumeCheck').checked){toast('Konfirmasikan pemakaian sekali Planner ini.');return}const start=$('placeStart').value,time=$('placeTime').value,gap=Number($('placeGap').value),lead=Number($('placeLead').value),base=Date.now();const fmt=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');p.rows.forEach((title,j)=>{const d=new Date(start+'T12:00');d.setDate(d.getDate()+j*gap);const publish=fmt(d)+'T'+time;d.setDate(d.getDate()-lead);items.push({id:base+j,title,brand:p.brand,kind:'Pillar Campaign',production:fmt(d)+'T09:00',publish,status:'Draft',caption:title,accounts:['Instagram','Facebook'],source:p.name+' · Baris '+(j+1)+' · TERPAKAI',plannerId:p.id,plannerRow:j+1,revision:1,config:{source:existingForms['Pillar Campaign'].source}})});usedPlanners.push(p.id);const count=p.rows.length;plannerDraft=null;month=new Date(start+'T12:00');month.setDate(1);closeModal();switchView('calendar');toast(count+' slot tersimpan. Planner dikunci dan tidak dapat digunakan ulang.')}
```

**Code Sesudah (Proposed/After)**

```javascript
// Tampilkan empat pilihan campaign sebelum form apa pun.
// Pillar: Planner baru -> hasil -> form Pillar existing -> jadwal.
// RE/Multiplier/Recipe Labs: form existing -> output manifest -> jadwal.
// Recipe Planner hanya pada jalur existing yang membutuhkannya.
// Panel referensi form HTML tetap jujur sebagai mockup, bukan field rekaan.
```

### 02. `app/components/contentflow-studio/StudioWorkspace.js`

Ganti numbered wizard tetap dengan branching state. Caption/approval drawer existing dipertahankan kecuali source readiness yang terdampak.

**Code Sebelum (Current/Before)**

```javascript
  const [wizardStep, setWizardStep] = useState(1); // 1: Planner, 2: Engine Select, 3: Engine Form, 4: Schedule Allocation
  const [createdPlanner, setCreatedPlanner] = useState(null); // { id, title, rows: [] }
  const [selectedEngine, setSelectedEngine] = useState('re'); // 're' | 'multiplier' | 'recipe'
  const [enginePayload, setEnginePayload] = useState(null);
  const [slotScheduleMap, setSlotScheduleMap] = useState({});
  const [wizardSubmitting, setWizardSubmitting] = useState(false);
  const [wizardError, setWizardError] = useState('');

```

**Code Sesudah (Proposed/After)**

```javascript
const [wizardStage, setWizardStage] = useState('choose_campaign');
const [engineKind, setEngineKind] = useState(null);
const [sourceKind, setSourceKind] = useState(null);
// Pilih flow berdasarkan engine/source; tidak memanggil Planner untuk RE/Multiplier/Labs.
// Reset payload, outputs, schedules dan idempotency sesi saat mengganti tipe.
// Render ImportPlannerModal capture untuk Pillar; alokasi berdasarkan outputKey.
// datetime-local <-> UTC dikonversi eksplisit menggunakan timezone tenant.
```

### 03. `app/components/ImportPlannerModal.js`

Saat ini form belum memiliki callback capture pada signature; jangan mengklaim reuse Pillar selesai tanpa merender konfigurasi nyata.

**Code Sebelum (Current/Before)**

```javascript
export default function ImportPlannerModal({
  isOpen,
  onClose,
  initialPlannerId = '',
  onSuccess
}) {
  const [planners, setPlanners] = useState([]);
  const [selectedPlannerId, setSelectedPlannerId] = useState(initialPlannerId);
```

**Code Sesudah (Proposed/After)**

```javascript
export default function ImportPlannerModal({
  isOpen, onClose, initialPlannerId = '', onSuccess,
  onConfigurationSubmit = null,
}) {
  // Gunakan field, preset, upload dan validator existing.
  // Callback capture mengembalikan validated production settings tanpa ingest/start.
  // Caller lama tanpa callback mempertahankan perilaku existing.
}
```

### 04. `lib/contentflow-studio-contract.js`

Satu tabel pemetaan otoritatif dipakai UI/API/repository/adapter; jangan punya enum berbeda antar layer.

**Code Sebelum (Current/Before)**

```javascript
export const SOURCE_KINDS = [
  'planner_pillar',
  'planner_recipe',
  're_campaign',
  'multiplier_lab',
  'recipe_labs'
];

```

**Code Sesudah (Proposed/After)**

```javascript
export const ENGINE_KINDS = ['pillar', 're', 'multiplier', 'recipe'];
export const ENGINE_SOURCE_RULES = {
  pillar: ['planner_pillar', 'planner_recipe'],
  re: ['re_campaign'],
  multiplier: ['multiplier_lab'],
  recipe: ['recipe_labs'],
};
// Validator menerima plannerId hanya untuk dua source Planner;
// validates output manifest, schedules, timezone, targets dan schemaVersion.
```

### 05. `app/api/v2/contentflow-studio/batches/route.js`

Hapus mandatory Planner universal, engine allowlist lama dan create-then-consume terpisah. Stable idempotency header/body sesuai kontrak final.

**Code Sebelum (Current/Before)**

```javascript
export const POST = withTenantContext(async (request, user) => {
  try {
    const tenantId = getActiveTenantId() || 'default_tenant';
    const body = await request.json();

    const {
      plannerId,
      engine,
```

**Code Sesudah (Proposed/After)**

```javascript
export const POST = withTenantContext(async (request, user) => {
  const payload = await request.json();
  const input = validateStudioBatchRequest(payload);
  const result = await createStudioBatchAtomically({
    ...input, tenantId: getActiveTenantId(), actorId: user.id,
  });
  return NextResponse.json({ success: true, data: result });
});
// Error 4xx dipertahankan; server memvalidasi owner/role/account, bukan percaya client.
```

### 06. `lib/contentflow-studio-repository.js`

Refactor method legacy dengan compatibility wrapper internal bila diperlukan; tidak membiarkan caller lama dapat menciptakan batch parsial. Alias query kalender/reconcile jangan menimpa s.source_kind.

**Code Sebelum (Current/Before)**

```javascript
export async function createStudioBatch({
  tenantId = null,
  title,
  sourceKind,
  sourceId = null,
  configurationJson = {},
  idempotencyKey = null,
  createdBy = 'user'
```

**Code Sesudah (Proposed/After)**

```javascript
export async function createStudioBatchAtomically(input) {
  return withPgTransaction(async client => {
    // Lock idempotency/owner; return existing exact request atau 409 hash mismatch.
    // Validate canonical engine/source dan authoritative output manifest.
    // Jika Planner: reserve+consume di transaksi yang sama dengan batch/slots/targets.
    // Jika non-Planner: tidak akses consumption; slots dari output existing tervalidasi.
    // Simpan engine_kind terpisah, source_kind eksplisit, Draft/nonaktif.
  });
}
// Claim memilih s.* + alias b.engine_kind AS batch_engine_kind;
// predicate: tenant, activation active, batch active, due; lease/checkpoint atomik.
```

### 07. `lib/contentflow-studio-batch-service.js`

Nama akhir wrapper/service dipilih satu saja saat implementasi agar tidak terjadi siklus import/dua implementasi transaksi. Output count tidak ditentukan baris Planner untuk semua mesin.

**Code Sebelum (Current/Before)**

```javascript
// File belum ada.
```

**Code Sesudah (Proposed/After)**

```javascript
export async function buildValidatedOutputManifest(input) {
  // Existing domain validators -> stable output keys/snapshots; tidak enqueue produksi.
  // Planner rows verified tenant/owner; RE references; Multiplier combinations;
  // Recipe actual output contract. Satu manifest output = satu slot.
}
export async function createStudioBatchAtomically(input) {
  // Service orchestration menuju transactional repository; tidak call AI dalam transaksi.
}
```

### 08. `lib/contentflow-studio-adapters.js`

Hapus fallback sourceKind campur, asset_default, pengulangan seluruh urls dan rows[0]. Jangan overwrite hook/brief existing dari field snapshot yang tidak sesuai kontrak.

**Code Sebelum (Current/Before)**

```javascript
export async function dispatchSlotProduction(slot) {
  const tenantId = slot.tenant_id || 'default_tenant';
  const sourceKind = slot.source_kind || slot.batch_source_kind;
  const batchConfig = typeof slot.batch_config === 'string'
    ? JSON.parse(slot.batch_config)
    : (slot.batch_config || {});

  let campaignId = null;
```

**Code Sesudah (Proposed/After)**

```javascript
export async function dispatchSlotProduction(slot) {
  const engine = resolveCanonicalEngine(slot);
  const result = await dispatchOwnedOutput({
    engine, slot, deterministicOwner: slot.id,
  });
  assertValidDomainIdentity(result);
  return checkpointSuccessfulDispatch(slot, result);
}
// pillar/planner_pillar -> ingest Pillar existing;
// pillar/planner_recipe -> ingest Recipe/Pillar existing;
// re/multiplier/recipe -> service existing dengan satu output manifest tepat.
// Unknown engine -> STUDIO_ENGINE_UNSUPPORTED; tanpa null-success.
// Reconcile exact tenant+source+campaign+item, readiness media sesuai contract.
```

### 09. `lib/contentflow-studio-worker.js`

State retry dipastikan masuk enum/schema bila ditambah; tidak memperkenalkan nilai enum tak terdaftar. Worker harus menerima tenant context yang benar saat memanggil db/domain services.

**Code Sebelum (Current/Before)**

```javascript
export async function runStudioWorkerTick(workerId = 'studio-worker-1', tenantId = 'default_tenant') {
  let claimedSlot = null;
  try {
    // 1. Claim due slot with atomic SKIP LOCKED
    claimedSlot = await claimDueStudioSlot(workerId, tenantId);

    if (claimedSlot) {
      console.log(`[Studio Worker] Claimed due slot #${claimedSlot.slot_number} (${claimedSlot.id}) for batch ${claimedSlot.batch_id}`);
```

**Code Sesudah (Proposed/After)**

```javascript
export async function runStudioWorkerTick(workerId, tenantId) {
  // Claim due active output dengan lease; resume checkpoint domain jika sudah tercipta.
  // dispatch -> persist result; classified failure -> retry_wait/failed projection
  // atau pending+next_attempt_at sesuai schema final, bukan in_progress null selamanya.
  // Reconcile exact source item; recover stale lease tanpa duplicate domain submit.
  // Batch legacy ambiguous tidak eligible sampai hasil audit disetujui.
}
```

### 10. `lib/campaign-submission-service.js`

Perubahan internal ini mencegah duplikasi saat response hilang/restart. Default domain/prompt/preset caller lama tidak diubah.

**Code Sebelum (Current/Before)**

```javascript
export async function submitReCampaign({ tenantId, payload, productRefImagePath = null }) {
  if (!tenantId) tenantId = getActiveTenantId() || 'default_tenant';

  const id = generateCampaignId('re');
  const urls = payload.urls || [];

  const rawIdentity = {
    preset_id: payload.visual_identity_preset_id,
```

**Code Sesudah (Proposed/After)**

```javascript
export async function submitReCampaign({ tenantId, payload, productRefImagePath = null, executionOwner = null }) {
  // Existing caller tanpa executionOwner tetap backward compatible.
  // Studio owner -> deterministic identity + request hash + resume/checkpoint.
  // Payload sudah dibatasi pada output slot yang benar; tidak seluruh daftar batch.
}
// Terapkan invariant yang sama pada submitMultiplierCampaign dan submitRecipeCampaign.
```

### 11. `lib/pillar-campaign-ingest.js`

Owner sama diperlukan untuk dispatch setiap slot setelah consumption batch; jangan memberi bypass boolean dari request browser.

**Code Sebelum (Current/Before)**

```javascript
export async function ingestPlannerToPillarCampaign({
  plannerId,
  selectedRowIds = [],
  campaignName,
  globalSettings = {},
  campaignId: requestedCampaignId = null
}) {
  if (!plannerId) throw new PillarCampaignIngestError('planner_id wajib diisi');
```

**Code Sesudah (Proposed/After)**

```javascript
export async function ingestPlannerToPillarCampaign(input) {
  // Terima server-verified consumptionOwner milik batch yang sudah consumed.
  // Row subset harus termasuk snapshot/manifest owner; caller lain ditolak.
  // Deterministic campaignId dan resume existing bundle; hanya output due.
  // Preserve seluruh settings/prompt/pipeline dan review mode existing.
}
```

### 12. `lib/recipe-campaign-ingest.js`

Gunakan ingest khusus jika contract actual membutuhkannya; jangan mengalihkan hasil Recipe Planner ke Recipe Labs generic.

**Code Sebelum (Current/Before)**

```javascript
export async function ingestRecipePlannerToPillarCampaign({
  plannerId,
  selectedRowIds = [],
  campaignName = null,
  tenantId = null
}) {
  if (!plannerId) throw new Error('planner_id wajib diisi.');
  const db = getDb();
```

**Code Sesudah (Proposed/After)**

```javascript
export async function ingestRecipePlannerToPillarCampaign(input) {
  // Jalur Recipe Planner; verifikasi focus, snapshot, row ownership dan deterministic ID.
  // Kontrol aktivasi due; jangan otomatis mulai semua rows masa depan.
  // Return campaign dan item mapping nyata untuk output slot tersebut.
}
```

### 13. `lib/content-planner-consumption.js`

Baca ulang service aktual sebelum memilih helper; perluasan ini khusus owner retry/dispatch yang sah, bukan pelonggaran single-use.

**Code Sebelum (Current/Before)**

```javascript
import { pgQuery, withPgTransaction } from './db-pg.js';
import { getActiveTenantId } from './tenant-context.js';
import crypto from 'crypto';

export class PlannerConsumptionError extends Error {
  constructor(message, status = 409, code = 'PLANNER_ALREADY_CONSUMED') {
    super(message);
    this.name = 'PlannerConsumptionError';
```

**Code Sesudah (Proposed/After)**

```javascript
// Tambah/rapikan verifikasi owner konsumsi untuk dispatch milik batch yang sama.
// Unique tenant+planner tetap; input owner diturunkan dari session/job server.
// Retry batch yang sama mengembalikan konsumsi yang sama; owner lain -> 409.
// Tidak menghapus ledger saat repair/cancel, tidak unlock consumed untuk slot baru.
// Mutasi Planner dari menu/API/Operator tetap guarded.
```

### 14. `scripts/migrate-contentflow-studio-campaign-first.mjs`

Migrasi additive baru dan dapat dijalankan ulang; constraints dipasang setelah audit data legacy, tidak memaksakan mapping salah.

**Code Sebelum (Current/Before)**

```javascript
// File belum ada.
```

**Code Sesudah (Proposed/After)**

```javascript
// Default --dry-run; --apply + schema allowlist dev/staging eksplisit.
// Add engine_kind/config schema version/lease fields/manifest keys bila belum ada.
// Backfill hanya mapping terbukti; catat ambiguous tanpa auto dispatch.
// Idempotent migration + transaction/advisory lock; jangan edit migration lama untuk rerun saja.
// Tidak ada network/AI/provider calls dan tidak menyentuh public/Production.
```

### 15. `scripts/audit-repair-contentflow-studio.mjs`

Pisahkan repair data operasional dari DDL dan dari test. Guard ketat environment dan explicit apply scope.

**Code Sebelum (Current/Before)**

```javascript
// File belum ada.
```

**Code Sesudah (Proposed/After)**

```javascript
// Dry-run: classify scoped tenant/schema/batch/slot dan output bukti non-secret.
// Apply: only verified mappings/checkpoints; preserve consumption/jobs/approvals.
// Ambiguous -> pause/requires-review metadata, never blind retry or delete.
// Export before/after report dan verify no duplicate domain/publishing identity.
```

### 16. `tests/contentflow-studio.test.js`

Jangan hanya mengganti expected string agar suite hijau; assertion harus membuktikan perilaku yang diminta.

**Code Sebelum (Current/Before)**

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ensurePlannerNotConsumed,
  withPlannerConsumptionOwner,
  withPlannerGenerationLease,
  assertPlannerResearchApplicationAllowed
} from '../lib/content-planner-consumption.js';
```

**Code Sesudah (Proposed/After)**

```javascript
// Tambah contract matrix canonical engine/source + conditional plannerId.
// Stable output count/mapping, timezone conversion, unknown engine/null result.
// Same request key+hash -> same batch; different hash -> 409.
// Retain regression approval hash/scheduling existing yang masih valid.
```

### 17. `tests/contentflow-studio-e2e.test.js`

Suite E2E lama membuat Planner untuk batch RE; fixture itu harus diubah, bukan dipertahankan sebagai kontrak produk.

**Code Sebelum (Current/Before)**

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { pgQuery } from '../lib/db-pg.js';
import {
  createStudioBatch,
  consumePlannerIntoBatch,
  getCalendarProjection,
  recordStudioApproval
```

**Code Sesudah (Proposed/After)**

```javascript
// Dedicated test schema/tenant; reject production DB; transactional fixture cleanup.
// Lewati API/service/repository/adapter untuk Pillar, RE, Multiplier, Recipe.
// Assert correct domain engine, non-null source item and exact output cardinality.
// Test failure rollback, lease recovery, activation/due, idempotent retry,
// consumed owner, per-item ContentFlow linkage dan legacy blocked state.
// Mock provider/AI; jangan menanam pending job di tenant operasional.
```

### 18. `sot/menus/contentflow-studio.md`

SOT mengikuti perilaku akhir setelah test dan manual review, bukan klaim 11 tahap selesai lama.

**Code Sebelum (Current/Before)**

```javascript
# ContentFlow Studio — Source of Truth (SOT)

## 1. Ikhtisar & Arsitektur

ContentFlow Studio adalah orkestrator kampanye konten visual end-to-end yang menyatukan perencanaan ide (Content Planner), eksekusi mesin produksi multi-engine (RE Campaign, Multiplier Lab, Recipe Labs), dan penerbitan terjadwal lintas platform (Repliz Publishing Engine & ContentFlow Hub).

// Diagram alur existing (cuplikan berhenti sebelum diagram).
graph TD
```

**Code Sesudah (Proposed/After)**

```javascript
# ContentFlow Studio
// Perbarui flow campaign-first, canonical engine/source, conditional Planner,
// single-use, Draft/activation, output mapping, timezone dan repair runbook.
// Cantumkan batas migrasi legacy, checkpoint/recovery, pilot/rollback compatible.
// Dokumentasikan yang benar-benar terverifikasi, bukan hanya daftar file dibuat.
```

## File terkait yang perlu diverifikasi sebelum perluasan scope

`app/api/v2/contentflow-studio/slots/[id]/route.js`, API actions yang benar-benar tersedia, calendar route, `ImportPlannerModal` callers, dan permission/feature flags harus diaudit di tahap 01. Jika activation/recovery/error projection membutuhkan perubahan, tambahkan before/after file tersebut sebelum coding. Tidak membuat route baru hanya karena tercantum dalam rencana lama bila implementasi aktual sudah punya kontrak setara.

`app/theme.css`, engine prompt/generator, dan lifecycle Repliz/publishing existing dipakai tanpa perubahan awal. `package.json`, lockfile dan changelog berubah pada rilis: catat before/after versi aktual setelah remote/version history diverifikasi.

## Laporan akhir pelaksana

Sertakan matriks empat campaign (Planner diperlukan/tidak, output count, source engine/item, hasil test), hasil audit/repair data legacy dan schema yang disentuh, link manual review, checkbox aktual, build/test evidence, versi/SHA/tag/remote verification dan health Dev/Staging. Bedakan test agen dari review pengguna. Jelaskan batasan tersisa dan jangan mengklaim selesai jika adapter Pillar atau jalur non-Planner masih placeholder.

### Tambahan file eksekusi: `plans/contentflow-studio/campaign-first-execution-notes.md`

**Code Sebelum (Current/Before)**
```text
File belum ada.
```
**Code Sesudah (Proposed/After)**
```text
Catatan baseline, audit, hasil test, migrasi, repair dan deployment aktual.
```

### File tambahan sebelum eksekusi: manifest, actions dan boot worker

File baru `lib/contentflow-studio-manifest.js`: Before file belum ada; After shared pure output manifest + timezone conversion + canonical engine/source validation (browser/server).
File baru `app/api/v2/contentflow-studio/batches/[id]/actions/route.js`: Before file belum ada; After tenant-owned explicit activation/pause, no automatic generation.
`instrumentation.js`: Before boot worker Studio belum tersedia; After boot worker guarded environment, uses tenant-scoped due batches, no duplicate interval.
`app/api/v2/contentflow-studio/slots/[id]/route.js`: Before query `s.*, b.source_kind` overwrites slot source; After alias `batch_source_kind` and `batch_engine_kind`.
File baru `tests/contentflow-studio-campaign-first.test.mjs`: Before file belum ada; After pure contract matrix + isolated PostgreSQL integration gated schema with mocked domain/provider calls.

### Perluasan transaksi DB: `lib/db-pg.js`
**Code Sebelum (Current/Before)**
```javascript
export async function withPgTransaction(callback) {
  const client = await getPgPool().connect();
```
**Code Sesudah (Proposed/After)**
```javascript
export async function withPgTransaction(callback) {
  const inherited = pgTransactionContext.getStore();
  if (inherited) return callback(inherited);
  const client = await getPgPool().connect();
```
Service domain Multiplier membuka transaksi nested. Reuse transaction context diperlukan supaya create/checkpoint outer benar-benar atomik dan pool 3 tidak deadlock. Error nested tidak diserap; outer rollback tetap otoritatif.

### Dependency blocker ditemukan: approval route memakai kolom yang tidak ada
`app/api/v2/contentflow-studio/slots/[id]/approve-publish/route.js` Before: membaca creative_snapshot_json lalu menulis publishing_status/approval_revision_hash yang tidak ada pada DDL. After: memakai final_media_url/final_caption/revision_hash dan target status; approval intent durable atomik, publish_mode live existing, source ContentFlow ID valid, revisi wajib. Scope koreksi diperlukan agar output baru bisa direview/publish; lifecycle provider existing dipertahankan.
`app/api/v2/contentflow-studio/calendar/route.js` Before: projection publishing_status tidak tersedia, metrics completed. After: derived target status, ready/needs_review metrics, brand snapshot valid.

### Dependency transaksi RE: `lib/db.js`
**Code Sebelum (Current/Before)**
```javascript
try { db.prepare('ALTER TABLE re_campaigns ADD COLUMN generate_recipe INTEGER DEFAULT 0').run(); } catch (_) {}
```
**Code Sesudah (Proposed/After)**
```javascript
await db.prepare('ALTER TABLE re_campaigns ADD COLUMN IF NOT EXISTS generate_recipe INTEGER DEFAULT 0').run();
```
DDL lama yang gagal tanpa await membatalkan transaksi create RE. Await idempotent DDL diperlukan untuk atomic dispatch.

### Pemulihan intent approval: `lib/contentflow-studio-publishing.js`
**Code Sebelum (Current/Before)**
```text
File belum ada.
```
**Code Sesudah (Proposed/After)**
```javascript
export async function resumeApprovedStudioPublishing(tenantId, slotId = null) {
  // Resume only targets with durable approved_at/revision and scheduling status;
  // stable content/account/time idempotency uses existing publishing service.
}
```
Route approval dan worker memakai helper sama. Caption/aset tidak boleh diubah sesudah intent approval aktif tanpa pembatalan eksplisit, untuk menghindari race job lama vs revisi baru.

### Rilis aktual yang direncanakan: package/changelog/lockfile
**Code Sebelum (Current/Before)**
```text
package.json version 2.32.70; package-lock.json root/version 2.23.20; changelog latest V2.32.70.
```
**Code Sesudah (Proposed/After)**
```text
package.json dan root lockfile version 2.32.71; changelog entry Campaign-first berisi koreksi mesin/Planner/idempotency.
```

## Hotfix tombol Buat Batch pada HTTP private IP

Penyebab: `startWizard()` memanggil `crypto.randomUUID()` (secure-context-only) sebelum `setShowWizard(true)`. Staging memakai HTTP Tailscale IP. Ini nonvisual event-handler bug; tampilan/mockup campaign-first tidak berubah.

### Execution Task List — hotfix
- [x] H1. Ganti generator idempotency client dengan helper yang kompatibel HTTP dan pertahankan key stabil per submit.
- [x] H2. Uji randomUUID tidak tersedia/throw, fallback getRandomValues, dan keunikan; build.
- [x] H3. Rilis patch dan deploy atomic Dev/Staging; verifikasi SHA, health, dan perbaikan handler di release aktif.

### `lib/contentflow-studio-manifest.js`
**Code Sebelum (Current/Before)**
```javascript
// Belum ada helper idempotency key untuk browser HTTP.
```
**Code Sesudah (Proposed/After)**
```javascript
export function createStudioIdempotencyKey(provider = globalThis.crypto) {
  // randomUUID bila tersedia; getRandomValues pada HTTP; fallback unik non-auth.
}
```
### `app/components/contentflow-studio/StudioWorkspace.js`
**Code Sebelum (Current/Before)**
```javascript
setSubmitKey(crypto.randomUUID()); setWizardError(''); setWizardStep(0); setShowWizard(true);
```
**Code Sesudah (Proposed/After)**
```javascript
setSubmitKey(createStudioIdempotencyKey()); setWizardError(''); setWizardStep(0); setShowWizard(true);
```
### `tests/contentflow-studio-campaign-first.test.mjs`
**Code Sebelum (Current/Before)**
```javascript
// Belum menguji ketiadaan randomUUID pada HTTP origin.
```
**Code Sesudah (Proposed/After)**
```javascript
// Provider tanpa randomUUID, randomUUID throw, getRandomValues fallback, no-crypto uniqueness.
```

Hotfix release metadata Before: package.json dan package-lock.json 2.32.71, changelog V2.32.71. After: 2.32.72, entry HTTP-compatible wizard ID.
