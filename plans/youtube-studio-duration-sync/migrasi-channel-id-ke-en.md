# Rencana Implementasi: Migrasi Bahasa Channel dari id-ID ke en-US (Re-use Aset Visual)

Rencana ini merinci langkah-langkah untuk mengubah bahasa naskah dan suara pengisi (TTS) episode `ytep_3suyq35q` ke Bahasa Inggris (`en-US`) dengan tetap menggunakan file video visual claymation yang sudah dibuat sebelumnya.

## Tahapan Eksekusi

### 1. Tahap 1: Konfigurasi Database (Episode Locale & Voice Persona)
Kita akan memperbarui metadata episode `ytep_3suyq35q` di database `dev` agar mengenali konfigurasi lokalisasi baru:
- Mengubah `locale` menjadi `en-US`.
- Mengubah `voice_persona` menjadi pengisi suara Bahasa Inggris (misalnya `en-US-Wavenet-F` untuk Google TTS, atau suara Minimax Inggris yang didukung).

### 2. Tahap 2: Regenerasi Naskah & Auto-Fit (Bahasa Inggris)
Kita memicu pembuatan naskah Bahasa Inggris baru:
- Men-generate naskah Bahasa Inggris baru (karena locale sudah menjadi `en-US`, prompt AI otomatis menyesuaikan).
- Menjalankan **Auto-fit Narration** untuk menyeimbangkan pacing agar sesuai dengan profil `kids_educational_id` (102 WPM).
- Menyetujui (Approve) naskah hasil auto-fit tersebut sebagai versi naskah aktif yang baru.

### 3. Tahap 3: Eksekusi Skrip Penyelaras Aset (Asset Aligner)
Kita jalankan skrip scratch `scratch-align-english-assets.mjs` yang akan:
- Membaca naskah Bahasa Inggris yang baru disetujui.
- Mengambil paket produksi aktif saat ini (yang berisi visual video yang sudah sukses dibuat).
- Memperbarui teks (`prompt_snapshot`) pada seluruh aset `voiceover` di paket tersebut dengan teks naskah Bahasa Inggris yang baru.
- Mengubah status aset `voiceover` kembali menjadi `queued`.
- Menghapus job perakitan video (`assembly`) yang lama.
- Membuat job antrean produksi `voiceover` baru di tabel `youtube_production_jobs` dan `scheduler_jobs`.
- **Membiarkan aset visual (video) tetap berstatus `succeeded` dengan path video lama yang utuh.**

### 4. Tahap 4: Verifikasi
Setelah berjalan:
- Pekerja produksi otomatis men-generate suara bahasa Inggris baru.
- Setelah selesai, sistem otomatis merakit video akhir menggunakan file visual claymation lama dengan file audio bahasa Inggris baru.

---

## Rincian Perubahan & Skrip Utilitas

### Skrip Penyelaras Aset (`scratch-align-english-assets.mjs`)
Skrip utilitas ini akan diletakkan di folder scratch dan dieksekusi sekali untuk menyinkronkan data di database dev.

```javascript
import { getPgPool, pgQuery } from './lib/db-pg.js';
import { loadDbCaches } from './lib/db.js';
import { getEpisode, getLatestScript } from './lib/youtube-studio-repository.js';
import { getProductionPackageByEpisode, getProductionAssets } from './lib/youtube-studio-production-repository.js';

async function run() {
  const pool = getPgPool();
  const episodeId = 'ytep_3suyq35q';
  const actor = { username: 'system_english_localizer' };

  try {
    await loadDbCaches();

    console.log('1. Fetching active episode and script...');
    const episode = await getEpisode(episodeId);
    const script = await getLatestScript(episodeId);
    if (!script || script.status !== 'approved') {
      throw new Error('Latest script is not approved! Please approve the English script first.');
    }

    console.log('2. Fetching active production package...');
    const pkg = await getProductionPackageByEpisode(episodeId);
    if (!pkg) throw new Error('No active production package found');

    const assets = await getProductionAssets(pkg.id);
    const voiceoverAssets = assets.filter(a => a.asset_type === 'voiceover').sort((a, b) => a.scene_index - b.scene_index);
    const scenes = script.script_json.scenes;

    console.log('3. Syncing English voiceover text to assets...');
    for (const voAsset of voiceoverAssets) {
      const scene = scenes.find(s => s.scene_index === voAsset.scene_index + 1 || s.scene_index === voAsset.scene_index);
      const newVoiceoverText = scene ? scene.voiceover : null;

      if (!newVoiceoverText) {
        console.warn(`No voiceover text found in script for scene index ${voAsset.scene_index}`);
        continue;
      }

      console.log(`Updating Scene ${voAsset.scene_index} Voiceover -> "${newVoiceoverText.slice(0, 30)}..."`);
      
      // Update asset status and text
      await pgQuery(`
        UPDATE youtube_production_assets 
        SET status = 'queued', prompt_snapshot = $1, output_asset_json = NULL, error_code = NULL, error_message = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [newVoiceoverText, voAsset.id]);

      // Remove any existing voiceover job
      await pgQuery(`
        DELETE FROM youtube_production_jobs 
        WHERE asset_id = $1 AND job_kind = 'voiceover'
      `, [voAsset.id]);
    }

    // Set package status back to generating
    await pgQuery(`
      UPDATE youtube_production_packages 
      SET status = 'generating', preview_asset_json = NULL, final_asset_json = NULL, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1
    `, [pkg.id]);

    // Delete old assembly jobs
    await pgQuery(`
      DELETE FROM youtube_production_jobs 
      WHERE production_package_id = $1 AND job_kind IN ('assembly', 'final_render')
    `, [pkg.id]);

    // Queue voiceover jobs
    const tenantId = 'default_tenant';
    for (const voAsset of voiceoverAssets) {
      const jobId = `ytpj_en_${Math.random().toString(36).slice(2, 10)}`;
      const idempotencyKey = `idemp_prod_job_${voAsset.id}_en_v1`;

      await pgQuery(`
        INSERT INTO youtube_production_jobs (id, tenant_id, production_package_id, asset_id, job_kind, idempotency_key, status)
        VALUES ($1, $2, $3, $4, 'voiceover', $5, 'queued')
      `, [jobId, tenantId, pkg.id, voAsset.id, idempotencyKey]);

      await pgQuery(`
        INSERT INTO scheduler_jobs (queue_name, payload) 
        VALUES ($1, $2)
      `, ['youtube_production_asset', JSON.stringify({ job_id: jobId, tenant_id: tenantId })]);
    }

    console.log('Successfully aligned English voiceover assets and queued jobs!');

  } catch (e) {
    console.error('Localization sync failed:', e);
  } finally {
    await new Promise(r => setTimeout(r, 2000));
    await pool.end();
  }
}

run();
```
