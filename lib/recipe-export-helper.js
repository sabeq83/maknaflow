/**
 * Recipe Export Helper
 * Membangun & mem-parsing format HTML standar Android WebView 
 * Sesuai parity dengan logic HtmlSanitizer.php pada webadmin Android apps
 */

export function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function unescapeHtml(str = '') {
  return String(str)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/<br\s*\/?>/gi, '\n');
}

/**
 * Membangun format deskripsi HTML standar Android WebView:
 * - SUMMARY :
 * - INGREDIENTS : (Base + Optional Grouped Toppings/Sauce)
 * - DIRECTION :
 */
export function buildRecipeDescriptionHtml({ 
  summary = '', 
  baseIngredients = [], 
  ingredientGroups = [], 
  directions = [] 
}) {
  const parts = [];

  // 1. SUMMARY
  if (summary && summary.trim()) {
    parts.push('<p><strong>SUMMARY :</strong></p>');
    parts.push(`<p>${escapeHtml(summary.trim()).replace(/\n/g, '<br>')}</p>`);
  }

  // 2. INGREDIENTS
  const cleanBase = (baseIngredients || [])
    .map(s => (typeof s === 'string' ? s.trim() : ''))
    .filter(Boolean);
    
  const cleanGroups = (ingredientGroups || []).filter(g => 
    g && g.name && Array.isArray(g.items) && g.items.some(item => typeof item === 'string' && item.trim())
  );

  if (cleanBase.length > 0 || cleanGroups.length > 0) {
    if (parts.length > 0) parts.push('<hr />');
    parts.push('<p><strong>INGREDIENTS :</strong></p>');

    if (cleanBase.length > 0) {
      parts.push('<ul>');
      cleanBase.forEach(item => parts.push(`  <li>${escapeHtml(item)}</li>`));
      parts.push('</ul>');
    }

    // Sub-kelompok dinamis dan opsional (For the sauce :, For the marinade :, etc.)
    cleanGroups.forEach(group => {
      parts.push(`<p><strong>${escapeHtml(group.name.trim())}</strong></p>`);
      parts.push('<ul>');
      group.items
        .map(item => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean)
        .forEach(item => parts.push(`  <li>${escapeHtml(item)}</li>`));
      parts.push('</ul>');
    });
  }

  // 3. DIRECTION
  const cleanSteps = (directions || [])
    .map(s => (typeof s === 'string' ? s.trim() : ''))
    .filter(Boolean);

  if (cleanSteps.length > 0) {
    if (parts.length > 0) parts.push('<hr />');
    parts.push('<p><strong>DIRECTION :</strong></p>');
    parts.push('<ol>');
    cleanSteps.forEach(step => parts.push(`  <li>${escapeHtml(step)}</li>`));
    parts.push('</ol>');
  }

  return parts.join('\n');
}

/**
 * Parsing HTML deskripsi kembali ke struktur data objek
 */
export function parseRecipeDescriptionHtml(html = '') {
  if (!html || typeof html !== 'string') {
    return { summary: '', baseIngredients: [], ingredientGroups: [], directions: [] };
  }

  let summary = '';
  const baseIngredients = [];
  const ingredientGroups = [];
  const directions = [];

  // Extract Summary
  const summaryMatch = html.match(/<p><strong>SUMMARY\s*:<\/strong><\/p>\s*<p>(.*?)<\/p>/is);
  if (summaryMatch) {
    summary = unescapeHtml(summaryMatch[1].trim());
  }

  // Extract Ingredients section
  const ingSectionMatch = html.match(/<p><strong>INGREDIENTS\s*:<\/strong><\/p>(.*?)(?:<hr\s*\/?>|<p><strong>DIRECTION|$)/is);
  if (ingSectionMatch) {
    const ingSectionHtml = ingSectionMatch[1];
    
    // Split by sub-group headers: <p><strong>For the ... :</strong></p>
    const subGroupRegex = /<p><strong>(For the\s+[^:]+:)<\/strong><\/p>\s*<ul>(.*?)<\/ul>/gis;
    let baseUlHtml = ingSectionHtml;
    
    let match;
    while ((match = subGroupRegex.exec(ingSectionHtml)) !== null) {
      const groupName = unescapeHtml(match[1].trim());
      const groupUl = match[2];
      const items = [];
      const liMatches = groupUl.matchAll(/<li>(.*?)<\/li>/gi);
      for (const li of liMatches) {
        items.push(unescapeHtml(li[1].trim()));
      }
      if (items.length > 0) {
        ingredientGroups.push({ name: groupName, items });
      }
      // Remove parsed sub-groups from baseUlHtml
      baseUlHtml = baseUlHtml.replace(match[0], '');
    }

    // Parse base ingredients (the first remaining <ul>)
    const baseUlMatch = baseUlHtml.match(/<ul>(.*?)<\/ul>/is);
    if (baseUlMatch) {
      const liMatches = baseUlMatch[1].matchAll(/<li>(.*?)<\/li>/gi);
      for (const li of liMatches) {
        baseIngredients.push(unescapeHtml(li[1].trim()));
      }
    }
  }

  // Extract Directions section
  const dirMatch = html.match(/<p><strong>DIRECTION\s*:<\/strong><\/p>\s*<ol>(.*?)<\/ol>/is);
  if (dirMatch) {
    const liMatches = dirMatch[1].matchAll(/<li>(.*?)<\/li>/gi);
    for (const li of liMatches) {
      directions.push(unescapeHtml(li[1].trim()));
    }
  }

  // Fallback untuk teks mentah / legacy tanpa markup HTML standar
  if (!summary && baseIngredients.length === 0 && directions.length === 0 && html.trim()) {
    summary = unescapeHtml(html.replace(/<[^>]*>/g, '').trim());
  }

  return { summary, baseIngredients, ingredientGroups, directions };
}

/**
 * Smart Language Detector untuk konten kuliner (English vs Indonesian)
 */
export function detectRecipeLanguage(title = '', ingredients = '', directions = '') {
  const combined = `${title} ${ingredients} ${directions}`.toLowerCase();

  const englishTokens = [
    'chicken', 'wings', 'pork', 'beef', 'salmon', 'fish', 'air fryer', 'tbsp', 'tsp', 'cup', 'cups',
    'powder', 'truffle', 'parmesan', 'salt', 'pepper', 'bake', 'toss', 'fry', 'roast', 'garlic',
    'sauce', 'butter', 'oil', 'bowl', 'pan', 'heat', 'minutes', 'serve', 'with', 'and', 'the',
    'crispy', 'golden', 'cooked', 'drizzle', 'chopped', 'seasoning', 'thyme', 'rosemary', 'dip'
  ];

  const indonesianTokens = [
    'ayam', 'bawang', 'cabe', 'cabai', 'goreng', 'rebus', 'sendok', 'sdm', 'sdt', 'bumbu',
    'tahu', 'tempe', 'santan', 'saus', 'sambal', 'garam', 'lada', 'minyak', 'panaskan',
    'aduk', 'potong', 'masak', 'menit', 'dan', 'dengan', 'untuk', 'rasa', 'puding', 'tepung',
    'iris', 'tumis', 'kukus', 'haluskan', 'secukupnya'
  ];

  let enScore = 0;
  let idScore = 0;

  for (const token of englishTokens) {
    const regex = new RegExp(`\\b${token}\\b`, 'gi');
    const matches = combined.match(regex);
    if (matches) enScore += matches.length;
  }

  for (const token of indonesianTokens) {
    const regex = new RegExp(`\\b${token}\\b`, 'gi');
    const matches = combined.match(regex);
    if (matches) idScore += matches.length;
  }

  return enScore >= idScore ? 'en' : 'id';
}

