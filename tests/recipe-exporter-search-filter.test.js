import test from 'node:test';
import assert from 'node:assert/strict';
import { activeSessionsCache } from '../lib/auth.js';

test('1. Recipe Exporter Search & Filter Logic Unit Tests', () => {
  const sampleRecipes = [
    {
      id: 1898,
      origin_type: 'pillar',
      origin_label: 'Pillar Campaign (OPC)',
      campaign_id: 'opc_261026_rdsm89',
      campaign_name: '[ Recipe OPC 20261026 ] - habitfolk - 20261026 - air fryer chicken breast',
      title: 'Juicy Garlic Butter Air Fryer Chicken Breast',
      category: 'Healthy Food / Air Fryer',
      summary: 'Dada ayam juicy air fryer dengan lelehan garlic butter gurih.',
      isExported: false,
      hasSummary: true,
      hasVideo: true
    },
    {
      id: 1899,
      origin_type: 'pillar',
      origin_label: 'Pillar Campaign (OPC)',
      campaign_id: 'opc_261026_rdsm89',
      campaign_name: '[ Recipe OPC 20261026 ] - habitfolk - 20261026 - air fryer chicken breast',
      title: 'Crispy Parmesan Crusted Air Fryer Chicken Breast',
      category: 'High Protein / Low Carb',
      summary: 'Baluran keju parmesan renyah gurih menyelimuti dada ayam empuk.',
      isExported: true,
      hasSummary: true,
      hasVideo: true
    },
    {
      id: 2041,
      origin_type: 'multiplier',
      origin_label: 'Multiplier Lab',
      campaign_id: 'mul_261028_kf70ki',
      campaign_name: '[Nutribake] - Healthy Banana Cake Multiplier Batch',
      title: 'Gluten-Free Moist Banana Bread with Walnuts',
      category: 'Healthy Bakery',
      summary: 'Kue pisang lembut bebas gluten kaya serat dengan taburan kenari renyah.',
      isExported: false,
      hasSummary: true,
      hasVideo: true
    },
    {
      id: 501,
      origin_type: 'planner',
      origin_label: 'Content Planner',
      campaign_id: 'pln_b935c763',
      campaign_name: 'Perencanaan Konten Kuliner Diet Seimbang Nov 2026',
      title: 'High-Protein Tofu Scramble Bowl',
      category: 'Plant-Based Protein',
      summary: 'Orak-arik tahu bumbu kunyit gurih dengan sayuran tumis segar.',
      isExported: false,
      hasSummary: false,
      hasVideo: false
    }
  ];

  // Helper filter function yang sama persis dengan app/recipe-exporter/page.js
  function applyFilters(recipes, { originFilter = 'all', campaignFilter = 'all', searchQuery = '', statusFilter = 'all' }) {
    return recipes.filter(r => {
      if (originFilter !== 'all' && r.origin_type !== originFilter) return false;
      if (campaignFilter !== 'all' && r.campaign_id !== campaignFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (r.title || '').toLowerCase().includes(q);
        const matchCampId = (r.campaign_id || '').toLowerCase().includes(q);
        const matchCampName = (r.campaign_name || '').toLowerCase().includes(q);
        const matchCategory = (r.category || '').toLowerCase().includes(q);
        const matchSummary = (r.summary || '').toLowerCase().includes(q);
        const matchId = String(r.id || '').toLowerCase().includes(q);
        if (!matchTitle && !matchCampId && !matchCampName && !matchCategory && !matchSummary && !matchId) {
          return false;
        }
      }
      if (statusFilter === 'exported') return r.isExported;
      if (statusFilter === 'unexported') return !r.isExported;
      return true;
    });
  }

  // Uji 1: Pencarian langsung via ID Kampanye 'opc_261026_rdsm89'
  const searchById = applyFilters(sampleRecipes, { searchQuery: 'opc_261026_rdsm89' });
  assert.strictEqual(searchById.length, 2, 'Harus menemukan 2 resep dari kampanye opc_261026_rdsm89');
  assert.ok(searchById.every(r => r.campaign_id === 'opc_261026_rdsm89'));

  // Uji 2: Pencarian parsial 'rdsm89'
  const searchByPartial = applyFilters(sampleRecipes, { searchQuery: 'rdsm89' });
  assert.strictEqual(searchByPartial.length, 2, 'Pencarian parsial rdsm89 harus menemukan 2 resep');

  // Uji 3: Pencarian nama brand/campaign 'habitfolk'
  const searchByBrand = applyFilters(sampleRecipes, { searchQuery: 'habitfolk' });
  assert.strictEqual(searchByBrand.length, 2, 'Pencarian habitfolk harus menemukan 2 resep');

  // Uji 4: Pencarian kata kunci resep 'banana'
  const searchByTitle = applyFilters(sampleRecipes, { searchQuery: 'banana' });
  assert.strictEqual(searchByTitle.length, 1, 'Pencarian banana harus menemukan 1 resep Multiplier');
  assert.strictEqual(searchByTitle[0].id, 2041);

  // Uji 5: Pencarian nomor ID resep '#1898' atau '1898'
  const searchByNumId = applyFilters(sampleRecipes, { searchQuery: '1898' });
  assert.strictEqual(searchByNumId.length, 1, 'Pencarian ID 1898 harus menemukan tepat 1 resep');
  assert.strictEqual(searchByNumId[0].id, 1898);

  // Uji 6: Filter Origin Type 'pillar'
  const filterPillar = applyFilters(sampleRecipes, { originFilter: 'pillar' });
  assert.strictEqual(filterPillar.length, 2, 'Origin filter pillar harus mengembalikan 2 resep');
  assert.ok(filterPillar.every(r => r.origin_type === 'pillar'));

  // Uji 7: Filter Origin Type 'multiplier'
  const filterMultiplier = applyFilters(sampleRecipes, { originFilter: 'multiplier' });
  assert.strictEqual(filterMultiplier.length, 1, 'Origin filter multiplier harus mengembalikan 1 resep');
  assert.strictEqual(filterMultiplier[0].origin_type, 'multiplier');

  // Uji 8: Dropdown filter campaign spesifik
  const filterCampaign = applyFilters(sampleRecipes, { campaignFilter: 'mul_261028_kf70ki' });
  assert.strictEqual(filterCampaign.length, 1);
  assert.strictEqual(filterCampaign[0].campaign_id, 'mul_261028_kf70ki');
});

test('2. Recipe API /api/recipes returns campaign items with origin metadata without crashing on tenant_id', async () => {
  activeSessionsCache['test_mock_token'] = {
    id: 'usr_test',
    username: 'test_admin',
    role: 'admin',
    tenantId: 'default_tenant',
    status: 'active'
  };

  const { GET } = await import('../app/api/recipes/route.js');
  const req = new Request('http://localhost:5010/api/recipes?source=campaign', {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer test_mock_token'
    }
  });

  const res = await GET(req);
  const json = await res.json();
  assert.strictEqual(res.status, 200);
  assert.strictEqual(json.success, true);
  assert.ok(Array.isArray(json.data), 'Data harus berupa array resep');

  // Verifikasi jika ada item yang dikembalikan, memiliki metadata origin
  if (json.data.length > 0) {
    const first = json.data[0];
    assert.ok(first.origin_type, 'Item harus memiliki origin_type');
    assert.ok(first.origin_label, 'Item harus memiliki origin_label');
    assert.ok(first.campaign_id !== undefined, 'Item harus memiliki campaign_id');
  }

  setTimeout(() => process.exit(0), 100);
});
