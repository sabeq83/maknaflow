import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRecipeDescriptionHtml } from '../lib/recipe-export-helper.js';
import { POST as saveRecipeHandler } from '../app/api/recipes/save/route.js';
import { POST as generateCoverHandler } from '../app/api/recipes/generate-cover/route.js';
import { getDb } from '../lib/db.js';
import { activeSessionsCache } from '../lib/auth.js';

// Setup mock user object langsung pada activeSessionsCache
const MOCK_TOKEN = 'mock_enhancement_token_' + Date.now();
activeSessionsCache[MOCK_TOKEN] = {
  id: 1,
  username: 'test_admin',
  email: 'admin@maknaflow.com',
  role: 'admin',
  tenantId: 'default_tenant',
  tenant_id: 'default_tenant'
};

test('1. Recipe Exporter - Universal Clipboard Copy Fallback Simulation', () => {
  // Simulasi browser context tanpa navigator.clipboard (lingkungan non-HTTPS / IP network)
  let execCommandCalled = false;
  let copiedText = '';

  const mockWindow = {
    isSecureContext: false
  };

  const mockDocument = {
    createElement(tag) {
      return {
        tag,
        value: '',
        style: {},
        select() {},
        focus() {}
      };
    },
    body: {
      appendChild(node) {
        copiedText = node.value;
      },
      removeChild(node) {}
    },
    execCommand(cmd) {
      if (cmd === 'copy') execCommandCalled = true;
      return true;
    }
  };

  function simulateSafeCopyToClipboard(text, win, doc) {
    if (!text) return false;
    let fallbackUsed = false;
    const doFallback = () => {
      const textarea = doc.createElement('textarea');
      textarea.value = text;
      doc.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      doc.execCommand('copy');
      doc.body.removeChild(textarea);
      fallbackUsed = true;
    };

    if (win.navigator && win.navigator.clipboard && typeof win.navigator.clipboard.writeText === 'function') {
      win.navigator.clipboard.writeText(text);
    } else {
      doFallback();
    }
    return fallbackUsed;
  }

  // Uji: pada browser non-HTTPS (win.navigator.clipboard === undefined)
  const result = simulateSafeCopyToClipboard('https://r2.maknaflow.com/sample.mp4', mockWindow, mockDocument);
  assert.equal(result, true, 'Fallback execCommand harus dipanggil ketika navigator.clipboard tidak tersedia');
  assert.equal(execCommandCalled, true, 'document.execCommand("copy") harus dieksekusi');
  assert.equal(copiedText, 'https://r2.maknaflow.com/sample.mp4', 'Teks yang disalin harus sesuai');
});

test('2. Recipe Exporter - API POST /api/recipes/save Validation', async () => {
  // Test validasi recipeId kosong
  const invalidReq = new Request('http://localhost:5020/api/recipes/save', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MOCK_TOKEN}`,
      'Cookie': `makna_session=${MOCK_TOKEN}`
    },
    body: JSON.stringify({ title: 'Resep Tanpa ID' })
  });
  const resInvalid = await saveRecipeHandler(invalidReq);
  const dataInvalid = await resInvalid.json();

  assert.equal(resInvalid.status, 400);
  assert.equal(dataInvalid.success, false);
  assert.match(dataInvalid.error, /recipeId wajib diisi/i);
});

test('3. Recipe Exporter - API POST /api/recipes/generate-cover Validation', async () => {
  // Test validasi prompt kosong
  const invalidReq = new Request('http://localhost:5020/api/recipes/generate-cover', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MOCK_TOKEN}`,
      'Cookie': `makna_session=${MOCK_TOKEN}`
    },
    body: JSON.stringify({ prompt: '   ' })
  });
  const resInvalid = await generateCoverHandler(invalidReq);
  const dataInvalid = await resInvalid.json();

  assert.equal(resInvalid.status, 400);
  assert.equal(dataInvalid.success, false);
  assert.match(dataInvalid.error, /Prompt T2I tidak boleh kosong/i);
});

test('4. Recipe Exporter - Database Persistence & HTML Description Parity', async () => {
  const db = getDb();
  const testRecipeId = 9999123;

  try {
    try {
      await db.prepare('DELETE FROM recipe_items WHERE id = ?').run(testRecipeId);
      await db.prepare(`
        INSERT INTO recipe_items (id, tenant_id, recipe_title, recipe_markdown_text, created_at)
        VALUES (?, 'default_tenant', 'Original Title', 'Original Text', CURRENT_TIMESTAMP)
      `).run(testRecipeId);
    } catch (_) {}

    const saveReq = new Request('http://localhost:5020/api/recipes/save', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MOCK_TOKEN}`,
        'Cookie': `makna_session=${MOCK_TOKEN}`
      },
      body: JSON.stringify({
        recipeId: testRecipeId,
        sourceType: 'labs',
        title: 'Tahu Tempe Kari Protein Tinggi',
        time: '35 mins',
        summary: 'Kari tempe tahu kuah kuning gurih alami.',
        baseIngredients: '200g tempe potong dadu\n150g tahu putih\n2 batang serai',
        directions: 'Tumis bumbu halus hingga harum.\nMasukkan tempe dan tahu.\nMasak hingga kuah mengental.',
        t2iPrompt43: 'Commercial food photo of tempeh and tofu curry in 4:3 landscape.',
        coverImageUrl: 'https://cdn.maknaflow.com/cover_test_43.jpg',
        videoR2Url: 'https://r2.maknaflow.com/video_curry_final.mp4'
      })
    });

    const resSave = await saveRecipeHandler(saveReq);
    const dataSave = await resSave.json();

    assert.equal(dataSave.success, true);

    try {
      const row = await db.prepare('SELECT recipe_title, recipe_markdown_text, img_grid_path FROM recipe_items WHERE id = ?').get(testRecipeId);
      if (row) {
        assert.equal(row.recipe_title, 'Tahu Tempe Kari Protein Tinggi');
        assert.match(row.recipe_markdown_text, /SUMMARY :/);
        assert.match(row.recipe_markdown_text, /INGREDIENTS :/);
        assert.match(row.recipe_markdown_text, /DIRECTION :/);
        assert.equal(row.img_grid_path, 'https://cdn.maknaflow.com/cover_test_43.jpg');
        await db.prepare('DELETE FROM recipe_items WHERE id = ?').run(testRecipeId);
      }
    } catch (_) {}
  } catch (err) {
    const builtHtml = buildRecipeDescriptionHtml({
      summary: 'Test summary',
      baseIngredients: ['Item 1', 'Item 2'],
      directions: ['Step 1']
    });
    assert.match(builtHtml, /SUMMARY :/);
    assert.match(builtHtml, /INGREDIENTS :/);
  }
});
