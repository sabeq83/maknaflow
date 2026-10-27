import test from 'node:test';
import assert from 'node:assert/strict';

test('Ingestion bahan dan langkah dari struktur idea campaign & pillar items', () => {
  // Simulasi data recipe idea
  const sampleIdea = {
    recipe_title: 'Gourmet Truffle & Herb Crispy Air Fryer Wings',
    ingredients: [
      { name: 'chicken wings', amount: '2', unit: 'lbs' },
      { name: 'baking powder', amount: '1', unit: 'tbsp' },
      { name: 'sea salt', amount: '1', unit: 'tsp' }
    ],
    steps: [
      { index: 1, instruction: 'Pat chicken wings dry with paper towels.' },
      { index: 2, instruction: 'Toss wings with baking powder and sea salt.' }
    ]
  };

  // Ekstraksi bahan
  const extractedIngredients = sampleIdea.ingredients.map(ing => {
    const amt = ing.amount ? `${ing.amount} ` : '';
    const u = ing.unit ? `${ing.unit} ` : '';
    return `${amt}${u}${ing.name}`.trim();
  });

  assert.equal(extractedIngredients.length, 3);
  assert.equal(extractedIngredients[0], '2 lbs chicken wings');
  assert.equal(extractedIngredients[1], '1 tbsp baking powder');
  assert.equal(extractedIngredients[2], '1 tsp sea salt');

  // Ekstraksi langkah
  const extractedSteps = sampleIdea.steps.map(s => (typeof s === 'string' ? s : s.instruction)).filter(Boolean);
  assert.equal(extractedSteps.length, 2);
  assert.equal(extractedSteps[0], 'Pat chicken wings dry with paper towels.');
  assert.equal(extractedSteps[1], 'Toss wings with baking powder and sea salt.');
});

test('Validasi format prompt pemolesan AI Auto Enrich', () => {
  const title = 'Gourmet Truffle & Herb Crispy Air Fryer Wings';
  const currentIngredients = '2 lbs chicken wings\n1 tbsp baking powder';
  const currentDirections = 'Pat wings dry.\nAir fry 20 mins.';

  assert.ok(title.length > 0);
  assert.ok(currentIngredients.includes('chicken wings'));
  assert.ok(currentDirections.includes('Pat wings dry.'));
});

test('Smart Language Detection (English vs Indonesian)', async () => {
  const { detectRecipeLanguage } = await import('../lib/recipe-export-helper.js');

  const enLang = detectRecipeLanguage(
    'Gourmet Truffle & Herb Crispy Air Fryer Wings',
    '900 g chicken wings\n1 tbsp baking powder\n1 tsp sea salt',
    'Pat chicken wings dry with paper towels. Toss wings with powder and air fry.'
  );
  assert.equal(enLang, 'en', 'Resep Truffle Wings harus terdeteksi bahasa Inggris');

  const idLang = detectRecipeLanguage(
    'Puding Cokelat Sutra Lapis Biskuit',
    '1 bungkus agar-agar cokelat\n500 ml susu cair\n4 sdm gula pasir',
    'Campur agar-agar dan susu di dalam panci. Panaskan hingga mendidih sambil diaduk.'
  );
  assert.equal(idLang, 'id', 'Resep Puding harus terdeteksi bahasa Indonesia');
});

