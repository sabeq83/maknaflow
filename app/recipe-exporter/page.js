'use client';

import React, { useState, useEffect } from 'react';
import RecipeExportModal from '@/app/components/recipe-export/RecipeExportModal';
import DedicatedVideoLightbox from '@/app/components/recipe-export/DedicatedVideoLightbox';
import '@/app/components/recipe-export/recipe-export.css';

const MOCK_FALLBACK_RECIPES = {
  labs: [
    {
      id: 'rcitem_1',
      source: 'Recipe Labs (#rcitem_1)',
      hasSummary: true,
      hasVideo: true,
      videoMutedReady: true,
      videoR2Url: 'https://pub-r2.maknaflow.com/recipes/rcitem_1_muted.mp4',
      title: 'Ultimate Crispy Air Fryer Baked Potato',
      time: '10 mins prep | 45 mins cook',
      category: 'Air Fryer',
      image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80',
      t2i_prompt_4_3: "Award-winning 4:3 food photography of ultimate crispy air fryer baked potato, eye-level 45-degree angle, split open with fluffy steaming interior, lavishly topped with melted cheddar, diced ripe tomatoes, and pickled jalapeños, resting on a rustic ceramic plate, cozy kitchen ambient lighting, warm shallow depth of field --ar 4:3 --stylize 250",
      summary: "Experience the ultimate baked potato transformation with your air fryer! This method delivers an incredibly crispy, golden-brown skin that gives way to a luxuriously fluffy and tender interior, all achieved in a fraction of the traditional oven time. A versatile canvas for distinct, delectable toppings, this dish proves that convenience doesn't compromise on gourmet flavor or satisfying texture.",
      baseIng: "1 baking potato, scrubbed and dried\nlight rapeseed or sunflower oil\nsalt and freshly ground black pepper",
      groups: [
        { name: "For the cheddar and jalapeño topping :", items: ["small handful grated cheddar", "1 ripe tomato, diced", "few green jalapeño pepper slices from a jar"] }
      ],
      directions: "Thoroughly scrub and dry the potato.\nLightly rub the surface with oil, then season generously with salt and black pepper.\nPlace directly into the air fryer basket at 200°C (400°F) for 40-50 minutes, flipping halfway.\nSplit open and spoon toppings generously over the steaming interior."
    },
    {
      id: 'rcitem_legacy_1',
      source: 'Recipe Labs (#rcitem_old_99)',
      hasSummary: false,
      hasVideo: false,
      videoMutedReady: false,
      videoR2Url: '',
      title: 'Spicy Garlic Butter Shrimp Skewers',
      time: '15 mins',
      category: 'Main Course',
      image: 'https://images.unsplash.com/photo-1559742811-822873691df8?w=600&auto=format&fit=crop&q=80',
      t2i_prompt_4_3: "",
      summary: '',
      baseIng: "400g raw tiger prawns, peeled and deveined\n3 cloves garlic, minced\n2 tbsp unsalted butter, melted\n1 tsp red chili flakes\n1 tbsp fresh chopped parsley\n1 lime, cut into wedges",
      groups: [],
      directions: "Thread peeled prawns onto wooden skewers.\nWhisk melted butter, minced garlic, and chili flakes in a bowl.\nBrush garlic butter generously over shrimp.\nAir fry or grill for 5-7 minutes until pink and lightly charred. Serve with fresh lime."
    }
  ],
  campaign: [
    {
      id: 'pln_row_video_1',
      source: 'Recipe Campaign (OPC Video Reel #1)',
      hasSummary: false,
      hasVideo: true,
      videoMutedReady: false,
      videoR2Url: '',
      title: 'Crispy Air Fryer Tofu Bites with Peanut Dip',
      time: '25 mins',
      category: 'Vegetarian',
      image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80',
      t2i_prompt_4_3: "",
      summary: '',
      baseIng: "1 block firm tofu, pressed and cubed\n1 tbsp cornstarch\n1 tbsp soy sauce\n3 tbsp smooth peanut butter\n1 tbsp maple syrup\n1 tbsp warm water\n1 tsp chili garlic sauce",
      groups: [],
      directions: "Toss tofu cubes with soy sauce and cornstarch until lightly coated.\nAir fry at 200°C for 15 minutes, shaking the basket halfway.\nMix peanut butter, maple syrup, chili garlic sauce, and warm water until silky.\nDip hot crispy tofu in spicy peanut sauce."
    }
  ]
};

export default function RecipeExporterPage() {
  const [source, setSource] = useState('labs'); // 'labs' | 'campaign'
  const [filter, setFilter] = useState('all'); // 'all' | 'ready' | 'legacy' | 'video'
  const [recipes, setRecipes] = useState(MOCK_FALLBACK_RECIPES.labs);
  const [activeExportRecipe, setActiveExportRecipe] = useState(null);
  const [activeLightboxRecipe, setActiveLightboxRecipe] = useState(null);
  const [r2Configured, setR2Configured] = useState(false);

  useEffect(() => {
    // Cek konfigurasi Cloudflare R2
    fetch('/api/settings/r2')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.config) setR2Configured(d.config.isConfigured);
      })
      .catch(() => {});

    // Coba fetch recipes dari API
    fetch(`/api/recipes?source=${source}`)
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.data) && d.data.length > 0) {
          setRecipes(d.data);
        } else {
          setRecipes(MOCK_FALLBACK_RECIPES[source] || []);
        }
      })
      .catch(() => {
        setRecipes(MOCK_FALLBACK_RECIPES[source] || []);
      });
  }, [source]);

  const filteredRecipes = recipes.filter(r => {
    if (filter === 'ready') return r.hasSummary;
    if (filter === 'legacy') return !r.hasSummary;
    if (filter === 'video') return r.hasVideo || r.videoR2Url;
    return true;
  });

  return (
    <div style={{ padding: '28px', maxWidth: '1440px', margin: '0 auto' }}>
      
      {/* Top Bar Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '1.8rem' }}>📱</span>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Recipe Exporter & Webadmin Sync Hub
            </h1>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Standarisasi Resep Android • AI Auto Enrich • Cover 4:3 • FFmpeg Video Muting & Cloudflare R2 CDN
            </div>
          </div>
        </div>

        {/* Source Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--surface)', padding: '4px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
          <button
            type="button"
            className={`btn btn-sm ${source === 'labs' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.78rem' }}
            onClick={() => setSource('labs')}
          >
            🧪 Recipe Labs
          </button>
          <button
            type="button"
            className={`btn btn-sm ${source === 'campaign' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.78rem' }}
            onClick={() => setSource('campaign')}
          >
            📊 Recipe Campaign (Content Planner)
          </button>
        </div>
      </div>

      {/* Overview Context Card */}
      <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px 20px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
            {source === 'labs' ? '🧪 Sumber: Studio Resep Mandiri (Recipe Labs)' : '📊 Sumber: Kampanye Konten Kuliner (Content Planner)'}
          </strong>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            {source === 'labs'
              ? 'Menampilkan hasil racikan resep kuliner yang siap dikonversi ke format aplikasi mobile Android.'
              : 'Menampilkan naskah dan aset video kampanye kuliner hasil kurasi Content Planner yang siap disinkronkan ke webadmin.'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="recipe-pixel-chip" style={{ color: r2Configured ? 'var(--status-success)' : 'var(--status-warning)', borderColor: r2Configured ? 'var(--status-success)' : 'var(--status-warning)' }}>
            ☁️ Cloudflare R2: {r2Configured ? 'Terkoneksi' : 'Kredensial Belum Diset'}
          </span>
          <a href="/settings" className="btn btn-sm btn-outline" style={{ fontSize: '0.72rem' }}>
            ⚙️ Pengaturan Storage
          </a>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
        {[
          { id: 'all', label: 'Semua Resep' },
          { id: 'ready', label: '✓ Siap Ekspor (Full Standard)' },
          { id: 'legacy', label: '⚠️ Perlu AI Enrich' },
          { id: 'video', label: '🎬 Memiliki Video' }
        ].map(t => (
          <button
            key={t.id}
            type="button"
            className={`recipe-sub-tab-btn ${filter === t.id ? 'active' : ''}`}
            onClick={() => setFilter(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Recipe Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
        {filteredRecipes.map(item => (
          <div
            key={item.id}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-card)',
              transition: 'transform var(--transition)'
            }}
          >
            {/* Media Cover */}
            <div style={{ position: 'relative', width: '100%', height: '180px', background: 'var(--canvas)' }}>
              <img
                src={item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80'}
                alt={item.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <span style={{ position: 'absolute', top: '10px', left: '10px', background: 'var(--overlay-backdrop)', color: 'var(--text-primary)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 700 }}>
                {item.source}
              </span>
              {item.hasVideo && (
                <span style={{ position: 'absolute', top: '10px', right: '10px', background: 'var(--status-warning-soft)', color: 'var(--status-warning)', border: '1px solid var(--status-warning)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 700 }}>
                  🎬 Video
                </span>
              )}
            </div>

            {/* Card Content */}
            <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                {item.title}
              </h3>
              
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <span className="recipe-pixel-chip">⏱️ {item.time}</span>
                <span className="recipe-pixel-chip">🏷️ {item.category}</span>
                {item.videoR2Url && (
                  <span className="recipe-pixel-chip" style={{ color: 'var(--status-success)', borderColor: 'var(--status-success)' }}>
                    ☁️ R2 Synced
                  </span>
                )}
              </div>

              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4, margin: '4px 0 0 0', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {item.summary || '(Resep ini belum memiliki summary dan kelompok bahan. Buka modal export untuk menjalankan 1-Klik AI Auto Enrich).'}
              </p>
            </div>

            {/* Card Footer */}
            <div style={{ padding: '12px 16px', background: 'var(--surface-raised)', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', color: item.hasSummary ? 'var(--status-success)' : 'var(--status-warning)', fontWeight: 700 }}>
                {item.hasSummary ? '✓ Full Android Standard' : '⚠️ Resep Lama'}
              </span>

              <div style={{ display: 'flex', gap: '6px' }}>
                {item.hasVideo && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                    onClick={() => setActiveLightboxRecipe(item)}
                    title="Putar Video Ter-Mute (FFmpeg)"
                  >
                    <span>🔇</span> <span>Preview</span>
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ padding: '4px 12px', fontSize: '0.72rem' }}
                  onClick={() => setActiveExportRecipe(item)}
                >
                  <span>🚀</span> <span>Export</span>
                </button>
              </div>
            </div>

          </div>
        ))}
      </div>

      {/* Modal Tuning & Simulator */}
      {activeExportRecipe && (
        <RecipeExportModal
          recipe={activeExportRecipe}
          onClose={() => setActiveExportRecipe(null)}
          onSuccess={(res) => {
            alert(`Resep "${res.title}" berhasil dipublikasikan!`);
          }}
        />
      )}

      {/* Lightbox Dedicated Modal */}
      {activeLightboxRecipe && (
        <DedicatedVideoLightbox
          recipe={activeLightboxRecipe}
          onClose={() => setActiveLightboxRecipe(null)}
          onProceedToExport={(rec) => {
            setActiveLightboxRecipe(null);
            setActiveExportRecipe(rec);
          }}
        />
      )}

    </div>
  );
}
