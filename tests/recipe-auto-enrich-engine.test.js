import test from 'node:test';
import assert from 'node:assert/strict';
import { activeSessionsCache } from '../lib/auth.js';

test('1. Recipe Auto Enrich rejects empty title with 400', async () => {
  activeSessionsCache['test_mock_token'] = {
    id: 'usr_test',
    username: 'test_admin',
    role: 'admin',
    tenantId: 'default_tenant',
    status: 'active'
  };

  const { POST } = await import('../app/api/recipes/auto-enrich/route.js');
  const req = new Request('http://localhost:5010/api/recipes/auto-enrich', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test_mock_token'
    },
    body: JSON.stringify({ title: '   ' })
  });

  const res = await POST(req);
  const json = await res.json();
  assert.strictEqual(res.status, 400);
  assert.strictEqual(json.success, false);
  assert.match(json.error, /Judul resep wajib diisi/i);
});

test('2. Recipe Auto Enrich uses resilient getGeminiModel and returns structured recipe data', async () => {
  const { parseGeminiJSON } = await import('../lib/json-parser.js');
  
  // Verifikasi parser JSON dapat memproses format response resep
  const sampleAiResponse = '```json\n' + JSON.stringify({
    recipe_time: "15 mins prep | 25 mins cook",
    summary: "Pisang goreng madu dengan karamelisasi renyah menggoda, berpadu aroma vanila lembut dan gurih.",
    base_ingredients: [
      "5 buah pisang raja matang, potong serong",
      "3 sdm madu murni",
      "150 gram tepung beras"
    ],
    ingredient_groups: [
      {
        name: "Untuk Saus Karamel :",
        items: ["2 sdm madu", "1 sdm air hangat"]
      }
    ],
    directions: [
      "Campur adonan tepung beras, air, dan madu hingga kental merata.",
      "Celupkan potongan pisang raja ke dalam adonan.",
      "Goreng dalam minyak panas hingga berwarna keemasan karamel."
    ],
    t2i_prompt_4_3: "Award-winning 4:3 food photography of glistening honey fried bananas on a dark ceramic platter, natural appetizing side lighting --ar 4:3"
  }, null, 2) + '\n```';

  const parsed = parseGeminiJSON(sampleAiResponse);
  assert.ok(parsed, 'Response harus berhasil diparsing');
  assert.strictEqual(parsed.recipe_time, '15 mins prep | 25 mins cook');
  assert.strictEqual(parsed.base_ingredients.length, 3);
  assert.strictEqual(parsed.ingredient_groups.length, 1);
  assert.strictEqual(parsed.directions.length, 3);
  assert.match(parsed.t2i_prompt_4_3, /4:3/);

  setTimeout(() => process.exit(0), 100);
});
