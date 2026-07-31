import { getSetting } from './db.js';

const FB_GRAPH_URL = 'https://graph.facebook.com/v19.0';

const EMOJI_MAP = [
  { keywords: ['cokelat', 'chocolate', 'kakao', 'cocoa'], emoji: '🍫' },
  { keywords: ['telur', 'egg', 'kuning telur', 'putih telur'], emoji: '🥚' },
  { keywords: ['mentega', 'butter', 'margarin'], emoji: '🧈' },
  { keywords: ['gula', 'sugar', 'kastor', 'vanila'], emoji: '🍬' },
  { keywords: ['tepung', 'flour', 'terigu', 'maizena'], emoji: '🌾' },
  { keywords: ['susu', 'milk', 'keju', 'krim', 'cream'], emoji: '🥛' },
  { keywords: ['frambos', 'raspberry', 'stroberi', 'strawberry', 'beri', 'berry', 'buah'], emoji: '🍓' },
  { keywords: ['lemon', 'jeruk', 'nipis', 'citrus'], emoji: '🍋' },
  { keywords: ['bawang', 'garlic', 'onion'], emoji: '🧄' },
  { keywords: ['daging', 'beef', 'steak'], emoji: '🥩' },
  { keywords: ['ayam', 'chicken'], emoji: '🍗' },
  { keywords: ['ikan', 'fish', 'seafood', 'udang'], emoji: '🐟' },
  { keywords: ['garam', 'salt', 'bumbu', 'lada', 'merica', 'rempah'], emoji: '🧂' },
  { keywords: ['minyak', 'oil'], emoji: '🫗' },
  { keywords: ['daun', 'mint', 'seledri', 'parsley', 'kemangi'], emoji: '🌿' },
  { keywords: ['kopi', 'coffee'], emoji: '☕' },
  { keywords: ['air', 'water'], emoji: '💧' }
];

const NUMBER_BADGES = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '1️⃣1️⃣', '1️⃣2️⃣'];

const CTA_VARIATIONS = [
  "📌 Jangan lupa Simpan resep ini & Follow halaman kami untuk inspirasi resep lezat setiap hari! 👨‍🍳✨",
  "💬 Bagaimana menurutmu resep ini? Tulis pendapatmu & kreasimu di kolom komentar ya! 👇😋",
  "🔄 Bagikan (Share) resep praktis ini ke keluarga & sahabat tercinta! 📲❤️",
  "🌟 Like, Komen, dan Simpan post ini agar tidak kehilangan resepnya saat mau masak nanti! 🔥"
];

function getIngredientEmoji(lineText) {
  const lower = lineText.toLowerCase();
  for (const item of EMOJI_MAP) {
    if (item.keywords.some(kw => lower.includes(kw))) {
      return item.emoji;
    }
  }
  return '🔹';
}

/**
 * Mengubah markdown resep menjadi caption Facebook yang estetik, rapi, dan penuh emoji.
 * @param {string} rawTitle 
 * @param {string} markdownText 
 */
export function formatFacebookRecipeCaption(rawTitle, markdownText) {
  if (!markdownText) {
    return `✨ INSPIRASI RESEP HARI INI ✨\n🍳 ${rawTitle || 'Resep Lezat'}`;
  }

  const lines = markdownText.split('\n');
  const formattedLines = [];
  let currentSection = 'intro'; // 'intro', 'ingredients', 'instructions'
  let stepCounter = 0;

  // Extract cleaned title
  let title = rawTitle;
  if (!title) {
    const titleLine = lines.find(l => l.startsWith('# '));
    title = titleLine ? titleLine.replace(/^#\s+/, '').trim() : 'Resep Spesial Lezat';
  }

  formattedLines.push('✨ INSPIRASI RESEP HARI INI ✨');
  formattedLines.push(`🍳 ${title.toUpperCase()}`);
  formattedLines.push('');

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Skip h1 title line
    if (trimmed.startsWith('# ')) continue;

    // Detect section headers cleanly
    const lower = trimmed.toLowerCase();
    const isHeading = trimmed.startsWith('#') || trimmed.startsWith('**');

    if (isHeading && (lower.includes('bahan') || lower.includes('ingredient'))) {
      if (currentSection !== 'ingredients') {
        currentSection = 'ingredients';
        formattedLines.push('');
        formattedLines.push('🛒 BAHAN-BAHAN:');
      }
      continue;
    }

    if (isHeading && (lower.includes('cara') || lower.includes('instruksi') || lower.includes('langkah') || lower.includes('instruction'))) {
      if (currentSection !== 'instructions') {
        currentSection = 'instructions';
        formattedLines.push('');
        formattedLines.push('👩‍🍳 CARA MEMBUAT:');
      }
      continue;
    }

    if (trimmed.startsWith('## ') || trimmed.startsWith('### ')) {
      const headerText = trimmed.replace(/^#+\s+/, '').replace(/\*/g, '').trim();
      formattedLines.push('');
      formattedLines.push(`📌 ${headerText.toUpperCase()}:`);
      continue;
    }

    // Format content by section
    if (currentSection === 'ingredients') {
      if (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('+')) {
        const cleanItem = trimmed.replace(/^[-*+]\s+/, '').trim();
        const emoji = getIngredientEmoji(cleanItem);
        formattedLines.push(`${emoji} ${cleanItem}`);
      } else {
        formattedLines.push(`▪️ ${trimmed}`);
      }
    } else if (currentSection === 'instructions') {
      let cleanStep = trimmed;
      if (/^\d+[\.\)]/.test(trimmed)) {
        cleanStep = trimmed.replace(/^\d+[\.\)]\s*/, '').trim();
      } else if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
        cleanStep = trimmed.replace(/^[-*]\s*/, '').trim();
      }
      
      const badge = NUMBER_BADGES[stepCounter] || `${stepCounter + 1}.`;
      stepCounter++;
      formattedLines.push(`${badge} ${cleanStep}`);
    } else {
      // Intro / description paragraph
      formattedLines.push(trimmed);
    }
  }

  // Pick dynamic CTA
  const randomCta = CTA_VARIATIONS[Math.floor(Math.random() * CTA_VARIATIONS.length)];
  
  formattedLines.push('');
  formattedLines.push(randomCta);
  formattedLines.push('');
  formattedLines.push('#ResepPraktis #InspirasiMasak #KulinerIndonesia #ResepRumahan #DapurMakna');

  return formattedLines.join('\n');
}

/**
 * Mengambil Page Access Token murni milik Halaman Facebook tujuan.
 */
async function getPageAccessToken(pageId, token) {
  // 1. Coba dapatkan dari /me/accounts terlebih dahulu (Metode paling aman untuk User Token)
  try {
    const res = await fetch(`${FB_GRAPH_URL}/me/accounts?access_token=${encodeURIComponent(token)}`);
    const data = await res.json();
    if (data && data.data && data.data.length > 0) {
      const pageObj = data.data.find(p => String(p.id) === String(pageId));
      if (pageObj && pageObj.access_token) {
        console.log(`[Facebook Helper] Successfully exchanged User Token for Page Access Token of Page #${pageId} via /me/accounts`);
        return pageObj.access_token;
      }
    }
  } catch (err) {
    console.warn('[Facebook Token Exchange via /me/accounts Warning]:', err.message);
  }

  // 2. Fallback ke cara lama (langsung tanya ke page node jika token adalah Page Token langsung)
  try {
    const res = await fetch(`${FB_GRAPH_URL}/${pageId}?fields=access_token&access_token=${encodeURIComponent(token)}`);
    const data = await res.json();
    if (data && data.access_token) {
      console.log(`[Facebook Helper] Successfully retrieved true Page Access Token for Page #${pageId} via direct fields`);
      return data.access_token;
    }
  } catch (err) {
    console.warn('[Facebook Token Exchange Warning]:', err.message);
  }
  return token;
}

export async function testFacebookConnection(pageId, pageToken) {
  const token = pageToken ? pageToken.trim() : getSetting('fb_page_token');

  if (!token) {
    return { success: false, error: 'Access token Facebook wajib diisi.' };
  }

  let targetId = pageId ? pageId.trim() : getSetting('fb_page_id');
  if (!targetId) {
    const manualPageIdsStr = (getSetting('fb_page_ids') || '').trim();
    if (manualPageIdsStr) {
      const ids = manualPageIdsStr.split(',').map(id => id.trim()).filter(Boolean);
      if (ids.length > 0) {
        targetId = ids[0];
      }
    }
  }

  // JIKA ADA TARGET ID: Test ID tersebut secara langsung (dengan menukar token ke Page Token secara terisolasi)
  if (targetId) {
    try {
      console.log(`[Facebook Test] Verifying connection for target Page ID: ${targetId}...`);
      const pageAccessToken = await getPageAccessToken(targetId, token);
      
      const response = await fetch(`${FB_GRAPH_URL}/${targetId}?fields=id,name&access_token=${encodeURIComponent(pageAccessToken)}`);
      const result = await response.json();

      if (result.error) {
        console.error('[Facebook Test Error]:', result.error.message);
        return { success: false, error: result.error.message };
      }

      console.log(`[Facebook Test] Successfully connected to "${result.name}" (${result.id})`);
      return {
        success: true,
        page_id: result.id,
        page_name: result.name,
        page_token: pageAccessToken, // Return exchanged Page Token
        category: 'Halaman Facebook'
      };
    } catch (error) {
      console.error('[Facebook Test Network Error]:', error.message);
      return { success: false, error: error.message };
    }
  }

  // JIKA TIDAK ADA TARGET ID: Auto-resolve dari daftar /me/accounts
  try {
    console.log('[Facebook Test] Auto-resolving page ID from token via /me/accounts...');
    const accountsRes = await fetch(`${FB_GRAPH_URL}/me/accounts?access_token=${encodeURIComponent(token)}`);
    const accountsData = await accountsRes.json();

    if (accountsData && accountsData.data && accountsData.data.length > 0) {
      const firstPage = accountsData.data[0];
      console.log(`[Facebook Test] Resolved first page: "${firstPage.name}" (${firstPage.id})`);
      return {
        success: true,
        page_id: firstPage.id,
        page_name: firstPage.name,
        page_token: firstPage.access_token,
        category: 'Halaman Facebook'
      };
    }

    // Fallback: Jika /me/accounts kosong, coba direct check ke /me (mungkin token adalah Page Token langsung)
    console.log('[Facebook Test] /me/accounts empty, trying direct /me profile check...');
    const meRes = await fetch(`${FB_GRAPH_URL}/me?fields=id,name&access_token=${encodeURIComponent(token)}`);
    const meData = await meRes.json();

    if (meData && !meData.error) {
      console.log(`[Facebook Test] Resolved direct profile: "${meData.name}" (${meData.id})`);
      return {
        success: true,
        page_id: meData.id,
        page_name: meData.name,
        page_token: token,
        category: 'Halaman Facebook'
      };
    }

    const errMsg = meData?.error?.message || 'Token tidak memiliki akses ke Halaman Facebook manapun.';
    console.error('[Facebook Test Error]:', errMsg);
    return { success: false, error: errMsg };
  } catch (error) {
    console.error('[Facebook Test Network Error]:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Mengambil daftar Halaman Facebook yang terhubung dengan Token Akses.
 * @param {string} [token] - Token Akses (User / Page)
 */
export async function getConnectedFacebookPages(token) {
  const pageToken = token || getSetting('fb_page_token');
  if (!pageToken) {
    return { success: false, error: 'Access token Facebook belum dikonfigurasi di Pengaturan.' };
  }

  const cleanToken = pageToken.trim();
  const pagesList = [];
  const seenIds = new Set();

  // 1. Dapatkan dari /me/accounts secara dinamis
  try {
    console.log('[Facebook Helper] Fetching connected accounts from /me/accounts...');
    const res = await fetch(`${FB_GRAPH_URL}/me/accounts?access_token=${encodeURIComponent(cleanToken)}`);
    const data = await res.json();

    if (data && data.data && data.data.length > 0) {
      for (const p of data.data) {
        if (!seenIds.has(p.id)) {
          seenIds.add(p.id);
          pagesList.push({
            id: p.id,
            name: p.name,
            category: p.category || 'Halaman Facebook'
          });
        }
      }
    }
  } catch (err) {
    console.warn('[Facebook Helper] /me/accounts error:', err.message);
  }

  // 2. Muat detail Halaman secara manual dari ID yang didaftarkan di Pengaturan (Bypass Batasan/Bug Meta)
  const manualPageIdsStr = (getSetting('fb_page_ids') || getSetting('fb_page_id') || '').trim();
  if (manualPageIdsStr) {
    const ids = manualPageIdsStr.split(',').map(id => id.trim()).filter(Boolean);
    console.log(`[Facebook Helper] Fetching manual page details for: ${ids.join(', ')}`);
    for (const pageId of ids) {
      if (!seenIds.has(pageId)) {
        try {
          const pageRes = await fetch(`${FB_GRAPH_URL}/${pageId}?fields=id,name,category&access_token=${encodeURIComponent(cleanToken)}`);
          const pageData = await pageRes.json();
          if (pageData && !pageData.error) {
            seenIds.add(pageId);
            pagesList.push({
              id: pageData.id,
              name: pageData.name,
              category: pageData.category || 'Halaman Facebook'
            });
          } else {
            console.warn(`[Facebook Helper] Error fetching manual page ${pageId}:`, pageData?.error?.message);
          }
        } catch (pageErr) {
          console.warn(`[Facebook Helper] Network error fetching manual page ${pageId}:`, pageErr.message);
        }
      }
    }
  }

  // 3. Fallback Dinamis Akhir: Cek profil token /me jika belum ada halaman sama sekali yang terdeteksi
  if (pagesList.length === 0) {
    try {
      console.log('[Facebook Helper] Dynamic Fallback: Checking token profile via /me...');
      const pageRes = await fetch(`${FB_GRAPH_URL}/me?fields=id,name&access_token=${encodeURIComponent(cleanToken)}`);
      const pageData = await pageRes.json();
      if (pageData && !pageData.error) {
        pagesList.push({
          id: pageData.id,
          name: pageData.name,
          category: pageData.category || 'Halaman Facebook'
        });
      }
    } catch (_) {}
  }

  return { success: true, pages: pagesList };
}

/**
 * Mengirimkan postingan ke Halaman Facebook (Facebook Page) dalam status DRAFT / UNPUBLISHED.
 * @param {Object} params
 * @param {string} params.message - Teks status/caption postingan
 * @param {string} [params.mediaUrl] - URL publik gambar/video
 * @param {string} [params.mediaType] - 'image', 'video', atau 'text_only'
 * @param {string} [params.pageId] - ID Halaman target override
 * @param {string} [params.pageToken] - Token Akses Halaman target override
 */
export async function postDraftToFacebookPage({ message, mediaUrl, mediaType = 'text_only', pageId = null, pageToken = null }) {
  let targetPageId = pageId ? String(pageId).trim() : getSetting('fb_page_id');
  if (!targetPageId || targetPageId === 'undefined' || targetPageId === 'null') {
    const manualPageIdsStr = (getSetting('fb_page_ids') || '').trim();
    if (manualPageIdsStr) {
      const ids = manualPageIdsStr.split(',').map(id => id.trim()).filter(Boolean);
      if (ids.length > 0) {
        targetPageId = ids[0];
      }
    }
  }
  const targetToken = pageToken ? String(pageToken).trim() : getSetting('fb_page_token');

  if (!targetPageId || !targetToken) {
    throw new Error('Kredensial Facebook Page (ID / Token) belum dikonfigurasi.');
  }

  const cleanPageId = targetPageId.trim();
  const cleanToken = targetToken.trim();

  // Dapatkan True Page Access Token khusus milik Page tersebut untuk mengabaikan issue User Scope
  const truePageToken = await getPageAccessToken(cleanPageId, cleanToken);

  const isImage = mediaType === 'image' && mediaUrl;
  const isVideo = mediaType === 'video' && mediaUrl;
  
  let endpoint;
  if (isImage) {
    endpoint = `/${cleanPageId}/photos`;
  } else if (isVideo) {
    endpoint = `/${cleanPageId}/videos`;
  } else {
    endpoint = `/${cleanPageId}/feed`;
  }
  
  const payload = {
    access_token: truePageToken,
    published: false, // MANDATORY GUARDRAIL: Selalu buat sebagai DRAFT / Unpublished
    unpublished_content_type: 'DRAFT' // Enforce Meta Business Suite DRAFT tab routing
  };

  if (isImage) {
    payload.message = message;
    payload.url = mediaUrl;
  } else if (isVideo) {
    payload.description = message; // Facebook videos API uses 'description' instead of 'message'
    payload.file_url = mediaUrl;   // Videos API uses 'file_url' instead of 'url'
  } else {
    payload.message = message;
  }

  try {
    console.log(`[Facebook Draft] Dispatching ${isImage ? 'photo' : (isVideo ? 'video' : 'text')} draft to ${endpoint}...`);
    const response = await fetch(`${FB_GRAPH_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (result.error) {
      console.error('[Facebook API Error]:', result.error.message);
      return { success: false, error: result.error.message };
    }

    console.log(`[Facebook Draft] Successfully created draft post #${result.id}`);
    return { success: true, fb_post_id: result.id };
  } catch (error) {
    console.error('[Facebook Network Error]:', error.message);
    return { success: false, error: error.message };
  }
}
