import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatRecipeTextMarkdown,
  formatRecipeTextPlain,
  buildRecipeSocialPackage
} from '../lib/recipe-social-package.js';

test('formatRecipeTextMarkdown formats full structured markdown without truncation', () => {
  const recipe = {
    title: 'Matcha Chia Pudding',
    servings: '2 Porsi',
    prep_minutes: 10,
    cook_minutes: 0,
    ingredients: [
      { name: 'Chia Seeds', amount: '4', unit: 'sdm' },
      { name: 'Susu Oat Barista', amount: '200', unit: 'ml', product_id: 'prod_1' },
      { name: 'Bubuk Matcha', amount: '1', unit: 'sdt' }
    ],
    steps: [
      { index: 1, instruction: 'Campurkan chia seeds dengan susu oat dan matcha.' },
      { index: 2, instruction: 'Aduk rata lalu diamkan di kulkas minimal 2 jam.' }
    ],
    tips: [
      'Gunakan whisk agar bubuk matcha tidak menggumpal.'
    ]
  };

  const md = formatRecipeTextMarkdown(recipe);
  assert.ok(md.includes('# Matcha Chia Pudding'), 'Must include title header');
  assert.ok(md.includes('Porsi: 2 Porsi'), 'Must include servings');
  assert.ok(md.includes('10 Menit'), 'Must include total time');
  assert.ok(md.includes('- 4 sdm Chia Seeds'), 'Must list ingredients');
  assert.ok(md.includes('(Produk Utama)'), 'Must tag product_id');
  assert.ok(md.includes('1. Campurkan chia seeds'), 'Must list steps');
  assert.ok(md.includes('## Tips Chef:'), 'Must include tips');
});

test('formatRecipeTextPlain formats full plain text for clipboard copy', () => {
  const recipe = {
    title: 'Matcha Chia Pudding',
    servings: '2 Porsi',
    prep_minutes: 5,
    cook_minutes: 5,
    ingredients: [
      { name: 'Susu Oat', amount: '200', unit: 'ml', product_id: 'prod_1' }
    ],
    steps: [
      { index: 1, instruction: 'Aduk hingga rata.' }
    ],
    tips: ['Sajikan dingin.']
  };

  const plain = formatRecipeTextPlain(recipe);
  assert.ok(plain.includes('MATCHA CHIA PUDDING'));
  assert.ok(plain.includes('BAHAN-BAHAN:'));
  assert.ok(plain.includes('• 200 ml Susu Oat'));
  assert.ok(plain.includes('CARA MEMBUAT:'));
  assert.ok(plain.includes('1. Aduk hingga rata.'));
  assert.ok(plain.includes('TIPS:'));
});

test('buildRecipeSocialPackage creates full platform caption package', () => {
  const recipe = {
    title: 'Iced Matcha Latte',
    servings: '1 Gelas',
    prep_minutes: 5,
    cook_minutes: 0,
    ingredients: [
      { name: 'Susu Oat', amount: '150', unit: 'ml', product_id: 'prod_1' }
    ],
    steps: [
      { index: 1, instruction: 'Tuang susu oat dan es batu.' }
    ]
  };

  const pkg = buildRecipeSocialPackage(recipe, {
    hook: 'Stop beli matcha mahal di kafe!',
    cta: 'Cek produk di keranjang kuning!'
  });

  assert.ok(pkg.caption_with_recipe.includes('Stop beli matcha mahal di kafe!'));
  assert.ok(pkg.caption_with_recipe.includes('BAHAN-BAHAN:'));
  assert.ok(pkg.caption_with_recipe.includes('CARA MEMBUAT:'));
  assert.ok(pkg.caption_with_recipe.includes('Cek produk di keranjang kuning!'));
  assert.ok(Array.isArray(pkg.hashtags) && pkg.hashtags.length > 0);
  assert.ok(pkg.platform_captions.tiktok);
});
