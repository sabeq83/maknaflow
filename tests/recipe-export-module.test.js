import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRecipeDescriptionHtml,
  parseRecipeDescriptionHtml
} from '../lib/recipe-export-helper.js';

test('buildRecipeDescriptionHtml generates clean Android WebView HTML for simple recipe (no groups)', () => {
  const payload = {
    summary: 'A simple high-protein breakfast scrambled eggs.',
    baseIngredients: [
      '3 large free-range eggs',
      '1 tbsp grass-fed butter',
      'Salt and black pepper to taste'
    ],
    ingredientGroups: [],
    directions: [
      'Whisk eggs with salt and pepper in a bowl.',
      'Melt butter in a non-stick pan over medium-low heat.',
      'Pour eggs and stir gently until soft curds form.'
    ]
  };

  const html = buildRecipeDescriptionHtml(payload);

  // Assert standard headers
  assert.ok(html.includes('<p><strong>SUMMARY :</strong></p>'), 'Must contain SUMMARY header');
  assert.ok(html.includes('A simple high-protein breakfast'), 'Must contain summary body');
  assert.ok(html.includes('<p><strong>INGREDIENTS :</strong></p>'), 'Must contain INGREDIENTS header');
  assert.ok(html.includes('<li>3 large free-range eggs</li>'), 'Must format base ingredients as ul/li');
  assert.ok(html.includes('<p><strong>DIRECTION :</strong></p>'), 'Must contain DIRECTION header');
  assert.ok(html.includes('<ol>'), 'Directions must be formatted as ol');
  assert.ok(html.includes('<li>Whisk eggs with salt and pepper in a bowl.</li>'), 'Must format directions as ol/li');

  // CRITICAL RULE: In simple recipes without distinct parts, there should be NO hardcoded "topping" or "For the"
  assert.ok(!html.includes('For the'), 'Must NOT invent "For the" header when ingredientGroups is empty');
  assert.ok(!html.toLowerCase().includes('topping'), 'Must NOT invent "topping" header when not applicable');
});

test('buildRecipeDescriptionHtml generates adaptive group headers for complex recipes', () => {
  const payload = {
    summary: 'Crispy Korean Fried Chicken with sweet gochujang glaze.',
    baseIngredients: [
      '500g chicken thighs, cut into bite-sized pieces',
      '1 cup potato starch'
    ],
    ingredientGroups: [
      {
        name: 'For the Marinade :',
        items: ['1 tbsp grated ginger', '2 cloves garlic minced', '1 tbsp soy sauce']
      },
      {
        name: 'For the Glaze :',
        items: ['2 tbsp gochujang', '2 tbsp honey', '1 tbsp brown sugar']
      }
    ],
    directions: [
      'Marinate chicken for 30 minutes.',
      'Coat with starch and deep fry until golden.',
      'Toss chicken in warm glaze.'
    ]
  };

  const html = buildRecipeDescriptionHtml(payload);

  assert.ok(html.includes('<p><strong>For the Marinade :</strong></p>'), 'Must render Marinade group header');
  assert.ok(html.includes('<li>1 tbsp grated ginger</li>'), 'Must render Marinade items');
  assert.ok(html.includes('<p><strong>For the Glaze :</strong></p>'), 'Must render Glaze group header');
  assert.ok(html.includes('<li>2 tbsp gochujang</li>'), 'Must render Glaze items');
});

test('parseRecipeDescriptionHtml accurately extracts parts back from HTML', () => {
  const original = {
    summary: 'Creamy avocado toast with poached eggs.',
    baseIngredients: ['2 slices sourdough bread', '1 ripe avocado, mashed'],
    ingredientGroups: [
      {
        name: 'For the Topping :',
        items: ['1 pinch red pepper flakes', '1 tsp extra virgin olive oil']
      }
    ],
    directions: ['Toast the bread until golden.', 'Spread mashed avocado.', 'Top with olive oil and chili flakes.']
  };

  const html = buildRecipeDescriptionHtml(original);
  const parsed = parseRecipeDescriptionHtml(html);

  assert.equal(parsed.summary, original.summary);
  assert.deepEqual(parsed.baseIngredients, original.baseIngredients);
  assert.equal(parsed.ingredientGroups.length, 1);
  assert.equal(parsed.ingredientGroups[0].name, 'For the Topping :');
  assert.deepEqual(parsed.ingredientGroups[0].items, original.ingredientGroups[0].items);
  assert.deepEqual(parsed.directions, original.directions);
});

test('parseRecipeDescriptionHtml handles plain text or legacy description gracefully', () => {
  const legacyText = 'Cara membuat nasi goreng enak:\n1. Siapkan nasi.\n2. Tumis bawang.\n3. Masukkan nasi.';
  const parsed = parseRecipeDescriptionHtml(legacyText);

  assert.ok(parsed.summary.length > 0 || parsed.directions.length > 0);
  assert.ok(Array.isArray(parsed.baseIngredients));
  assert.ok(Array.isArray(parsed.ingredientGroups));
  assert.ok(Array.isArray(parsed.directions));
});
