import assert from 'node:assert/strict';
import { createHermesCallbackToken } from '../lib/hermes-callback-token.js';

const runId = 'arun_f2a9df634b424501';
const taskId = 'task_arun_f2a9df634b424501';
const tenantId = 'default_tenant';
const idempotencyKey = 'smoke_hermes_1788243553:research';

const callbackToken = createHermesCallbackToken({ taskId, runId, tenantId });

const researchBrief = {
  schema_version: '1',
  query: 'Resep Sarapan Praktis dan Sehat Menggunakan Rolled Oat Premium Sahabat',
  locale: 'id-ID',
  researched_at: new Date().toISOString(),
  summary: 'Riset tren sarapan sehat 2026 membuktikan peningkatan minat audiens terhadap overnight oats, baked oats, dan sarapan berbasis rolled oat kaya serat beta-glukan untuk kestabilan energi sepanjang hari.',
  sources: [
    {
      id: 'src_oat_01',
      url: 'https://dapurbotani.id/blog/resep-sarapan-rolled-oat',
      title: 'Panduan Menu Sarapan Rolled Oat Sehat dan Praktis',
      publisher: 'Dapur Botani Official'
    },
    {
      id: 'src_nutrisi_02',
      url: 'https://jurnalgizikesehatan.id/artikel/manfaat-beta-glukan-oat',
      title: 'Manfaat Serat Larut Beta-Glukan untuk Metabolisme Pagi Hari',
      publisher: 'Jurnal Nutrisi Nusantara'
    }
  ],
  insights: [
    {
      claim: 'Rolled Oat Premium Sahabat memiliki tekstur kenyal alami yang mempertahankan rasa kenyang lebih lama tanpa lonjakan gula darah.',
      confidence: 0.95,
      source_ids: ['src_oat_01', 'src_nutrisi_02']
    },
    {
      claim: 'Persiapan sarapan overnight oats hanya membutuhkan waktu 3 menit di malam hari untuk hasil optimal saat sarapan.',
      confidence: 0.92,
      source_ids: ['src_oat_01']
    }
  ],
  recommended_angles: [
    {
      title: 'Overnight Oats 3 Menit untuk Pagi Anti Ribet',
      reason: 'Sangat relevan untuk target audiens pekerja sibuk dan ibu muda.',
      risk_level: 'low',
      source_ids: ['src_oat_01']
    },
    {
      title: 'Nutrisi Serat Beta-Glukan Penjaga Energi Stabil',
      reason: 'Fokus edukasi kesehatan berbasis sains dengan visual signature hangat.',
      risk_level: 'low',
      source_ids: ['src_nutrisi_02']
    }
  ],
  prohibited_claims: ['Klaim menyembuhkan penyakit kronis secara instan'],
  limitations: ['Riset berfokus pada audiens perkotaan usia 20-45 tahun di Indonesia']
};

console.log(`Submitting Hermes research brief for task "${taskId}" to Dev (port 5020)...`);

const url = `http://127.0.0.1:5020/api/operator/v2/research-tasks/${taskId}/complete`;
const resp = await fetch(url, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${callbackToken}`,
    'Content-Type': 'application/json',
    'Idempotency-Key': idempotencyKey
  },
  body: JSON.stringify(researchBrief)
});

const body = await resp.json();
console.log('HTTP Status:', resp.status);
console.log('Response Body:', body);

assert.ok([200, 202].includes(resp.status), `Expected 200 or 202, got ${resp.status}`);
assert.equal(body.success, true);
console.log('\n✅ Research callback submitted successfully to Dev!');
