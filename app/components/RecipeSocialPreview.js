'use client';

import { useState } from 'react';

/**
 * RecipeSocialPreview Component
 * Renders structured recipe details, ingredients list, and social publishing package
 * 100% styled using Semantic CSS tokens from app/theme.css
 */
export default function RecipeSocialPreview({
  recipeTextMarkdown = '',
  recipeTextPlain = '',
  recipePayload = null,
  socialMediaPackage = null,
  caption = '',
  onCopy = null
}) {
  const [copiedKey, setCopiedKey] = useState(null);

  function copyText(text, key) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
    if (onCopy) onCopy(text, key);
  }

  const recipe = typeof recipePayload === 'string' ? JSON.parse(recipePayload || '{}') : (recipePayload || {});
  const socialPkg = typeof socialMediaPackage === 'string' ? JSON.parse(socialMediaPackage || '{}') : (socialMediaPackage || {});
  const displayCaption = socialPkg.caption_snapshot || socialPkg.caption || caption || recipeTextPlain || '';

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border-subtle)',
      borderRadius: '12px',
      padding: '16px',
      marginTop: '12px'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>🍳</span>
          <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-primary)' }}>
            {recipe.title || recipe.recipe_title || 'Naskah Resep &amp; Paket Sosial'}
          </span>
          <span style={{
            background: 'var(--recipe-accent-soft, var(--status-warning-soft))',
            color: 'var(--recipe-accent, var(--status-warning))',
            border: '1px solid var(--recipe-accent, var(--status-warning))',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 700
          }}>
            Resep Lengkap
          </span>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          {recipeTextPlain && (
            <button
              type="button"
              onClick={() => copyText(recipeTextPlain, 'recipe_plain')}
              style={{
                padding: '4px 10px',
                background: copiedKey === 'recipe_plain' ? 'var(--status-success)' : 'var(--surface-interactive)',
                color: copiedKey === 'recipe_plain' ? 'var(--on-action-primary)' : 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {copiedKey === 'recipe_plain' ? '✓ Tersalin!' : '📋 Salin Resep'}
            </button>
          )}
          {displayCaption && (
            <button
              type="button"
              onClick={() => copyText(displayCaption, 'caption')}
              style={{
                padding: '4px 10px',
                background: copiedKey === 'caption' ? 'var(--status-success)' : 'var(--action-primary)',
                color: 'var(--on-action-primary)',
                border: 'none',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {copiedKey === 'caption' ? '✓ Tersalin!' : '📱 Salin Caption'}
            </button>
          )}
        </div>
      </div>

      {/* Meta tags */}
      {(recipe.servings || recipe.prep_minutes || recipe.cook_minutes) && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          {recipe.servings && <span>👥 <strong>{recipe.servings}</strong></span>}
          {(recipe.prep_minutes || recipe.cook_minutes) && (
            <span>⏱️ <strong>{Number(recipe.prep_minutes || 0) + Number(recipe.cook_minutes || 0)} Menit</strong> ({recipe.prep_minutes || 0}p+{recipe.cook_minutes || 0}m)</span>
          )}
          {recipe.difficulty && <span style={{ color: 'var(--status-success)' }}>⚡ <strong>{recipe.difficulty}</strong></span>}
        </div>
      )}

      {/* Ingredients preview */}
      {Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>Bahan-Bahan Utama:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {recipe.ingredients.map((ing, idx) => (
              <span key={idx} style={{
                background: ing.product_id ? 'var(--status-info-soft)' : 'var(--surface-raised)',
                color: ing.product_id ? 'var(--status-info)' : 'var(--text-primary)',
                border: `1px solid ${ing.product_id ? 'var(--status-info)' : 'var(--border-subtle)'}`,
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: ing.product_id ? 700 : 500
              }}>
                {ing.amount ? `${ing.amount} ` : ''}{ing.unit ? `${ing.unit} ` : ''}{ing.name || ing}
                {ing.product_id && ' 🥛 (Produk Utama)'}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Caption Preview Box */}
      {displayCaption && (
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>Preview Caption Lengkap:</div>
          <pre style={{
            margin: 0,
            whiteSpace: 'pre-wrap',
            fontFamily: 'inherit',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            background: 'var(--surface-raised)',
            padding: '10px 12px',
            borderRadius: '8px',
            maxHeight: '160px',
            overflowY: 'auto',
            border: '1px solid var(--border-subtle)'
          }}>
            {displayCaption}
          </pre>
        </div>
      )}
    </div>
  );
}
