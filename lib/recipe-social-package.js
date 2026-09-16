/**
 * Formatter deterministik untuk naskah resep media sosial
 */

export function formatRecipeTextMarkdown(recipe = {}) {
  const title = (recipe.title || 'Resep Kuliner').trim();
  const servings = recipe.servings || recipe.estimated_servings || '1-2 Porsi';
  const prep = Number.isInteger(Number(recipe.prep_minutes)) ? Number(recipe.prep_minutes) : 2;
  const cook = Number.isInteger(Number(recipe.cook_minutes)) ? Number(recipe.cook_minutes) : 3;
  const totalTime = prep + cook;

  let md = `# ${title}\n\nPorsi: ${servings} | Estimasi Waktu: ${totalTime} Menit\n\n## Bahan-Bahan:\n`;

  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  if (ingredients.length === 0) {
    md += `- Bahan-bahan sesuai selera\n`;
  } else {
    for (const ing of ingredients) {
      const amount = ing.amount ? `${ing.amount} ` : '';
      const unit = ing.unit ? `${ing.unit} ` : '';
      const name = ing.name || 'Bahan';
      const prodTag = ing.product_id ? ' (Produk Utama)' : '';
      md += `- ${amount}${unit}${name}${prodTag}\n`;
    }
  }

  md += `\n## Cara Membuat:\n`;
  const steps = Array.isArray(recipe.steps) ? recipe.steps : [];
  if (steps.length === 0) {
    md += `1. Campurkan semua bahan hingga merata.\n`;
  } else {
    steps.forEach((step, idx) => {
      const num = step.index || (idx + 1);
      const instruction = step.instruction || 'Lakukan langkah memasak.';
      md += `${num}. ${instruction}\n`;
    });
  }

  const tips = Array.isArray(recipe.tips) ? recipe.tips : [];
  if (tips.length > 0) {
    md += `\n## Tips Chef:\n`;
    for (const tip of tips) {
      md += `- ${tip}\n`;
    }
  }

  return md;
}

export function formatRecipeTextPlain(recipe = {}) {
  const title = (recipe.title || 'Resep Kuliner').trim().toUpperCase();
  const servings = recipe.servings || recipe.estimated_servings || '1 Porsi';
  const prep = Number.isInteger(Number(recipe.prep_minutes)) ? Number(recipe.prep_minutes) : 2;
  const cook = Number.isInteger(Number(recipe.cook_minutes)) ? Number(recipe.cook_minutes) : 3;
  const totalTime = prep + cook;

  let text = `${title}\nPorsi: ${servings} | Waktu: ${totalTime} Menit\n\nBAHAN-BAHAN:\n`;

  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  if (ingredients.length === 0) {
    text += `• Bahan-bahan secukupnya\n`;
  } else {
    for (const ing of ingredients) {
      const amount = ing.amount ? `${ing.amount} ` : '';
      const unit = ing.unit ? `${ing.unit} ` : '';
      const name = ing.name || 'Bahan';
      text += `• ${amount}${unit}${name}\n`;
    }
  }

  text += `\nCARA MEMBUAT:\n`;
  const steps = Array.isArray(recipe.steps) ? recipe.steps : [];
  if (steps.length === 0) {
    text += `1. Campurkan semua bahan hingga merata.\n`;
  } else {
    steps.forEach((step, idx) => {
      const num = step.index || (idx + 1);
      const instruction = step.instruction || 'Lakukan langkah memasak.';
      text += `${num}. ${instruction}\n`;
    });
  }

  const tips = Array.isArray(recipe.tips) ? recipe.tips : [];
  if (tips.length > 0) {
    text += `\nTIPS:\n`;
    for (const tip of tips) {
      text += `• ${tip}\n`;
    }
  }

  return text;
}

export function buildRecipeSocialPackage(recipe = {}, copy = {}) {
  const hook = copy.hook || 'Rahasia resep enak 3 menit di rumah! ✨';
  const cta = copy.cta || 'Simpan & bagikan resep ini! Cek produk di keranjang/link bio ya! 👇';
  const plainRecipe = formatRecipeTextPlain(recipe);

  const defaultHashtags = [
    '#ResepViral',
    '#ResepPraktis',
    '#KulinerTikTok',
    '#ResepMudah',
    '#HomeCafe'
  ];
  const hashtags = Array.isArray(copy.hashtags) && copy.hashtags.length > 0 ? copy.hashtags : defaultHashtags;
  const hashtagsStr = hashtags.join(' ');

  const captionWithRecipe = `${hook}\n\n${plainRecipe}\n\n${cta}\n\n${hashtagsStr}`.trim();
  const captionShort = `${hook}\n\n${cta}\n\n${hashtagsStr}`.trim();

  return {
    caption_with_recipe: captionWithRecipe,
    caption_short: captionShort,
    hashtags,
    cta,
    platform_captions: {
      tiktok: captionWithRecipe,
      instagram: captionWithRecipe,
      youtube_shorts: captionShort,
      facebook: captionWithRecipe
    }
  };
}
