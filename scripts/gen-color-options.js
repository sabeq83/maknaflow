import fs from 'fs';
import { execSync } from 'child_process';

const baseDir = '/Users/sabeqmmursyid/.gemini/antigravity-ide/brain/1675ca9d-d643-4782-b726-05936af192a9';

function createSvg(brandBg1, brandBg2, brandBorder, brandText, glowColor, fileName) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1050 260" width="1050" height="260" style="background:#0a0a0c; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <defs>
    <linearGradient id="cardBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0d1322" />
      <stop offset="100%" stop-color="#090d16" />
    </linearGradient>
    <linearGradient id="brandPill" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${brandBg1}" />
      <stop offset="100%" stop-color="${brandBg2}" />
    </linearGradient>
    <linearGradient id="gdriveBtn" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#059669" />
      <stop offset="100%" stop-color="#10b981" />
    </linearGradient>
    <linearGradient id="detailBtn" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2563eb" />
      <stop offset="100%" stop-color="#4f46e5" />
    </linearGradient>
    <filter id="brandGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="${glowColor}" flood-opacity="0.45" />
    </filter>
  </defs>

  <rect x="5" y="5" width="1040" height="250" rx="16" fill="url(#cardBg)" stroke="#1e293b" stroke-width="1.5" />

  <g transform="translate(20, 20)">
    <rect x="0" y="0" width="200" height="155" rx="12" fill="#141c2e" stroke="#334155" stroke-width="1" />
    <rect x="80" y="57" width="40" height="40" rx="10" fill="rgba(59, 130, 246, 0.15)" stroke="rgba(59, 130, 246, 0.4)" stroke-width="1" />
    <polygon points="96,70 110,77 96,84" fill="#60a5fa" />
    <rect x="8" y="8" width="115" height="22" rx="6" fill="rgba(15, 23, 42, 0.9)" stroke="#3b82f6" stroke-width="1" />
    <text x="14" y="23" fill="#60a5fa" font-size="11" font-weight="700" font-family="monospace">OPC-DUMMY-001</text>

    <rect x="0" y="167" width="200" height="38" rx="8" fill="url(#gdriveBtn)" />
    <text x="50" y="191" fill="#ffffff" font-size="12" font-weight="700">📁 Google Drive</text>
  </g>

  <g transform="translate(240, 24)">
    <g filter="url(#brandGlow)">
      <rect x="0" y="0" width="165" height="28" rx="8" fill="url(#brandPill)" stroke="${brandBorder}" stroke-width="1.2" />
      <text x="12" y="19" fill="${brandText}" font-size="12" font-weight="800">🏷️ @dummybrand01</text>
    </g>

    <rect x="175" y="0" width="70" height="28" rx="8" fill="rgba(16, 185, 129, 0.15)" stroke="rgba(16, 185, 129, 0.4)" stroke-width="1" />
    <text x="188" y="19" fill="#34d399" font-size="11" font-weight="700">🌱 OPC</text>

    <rect x="253" y="0" width="160" height="28" rx="8" fill="#1e293b" stroke="#334155" stroke-width="1" />
    <text x="263" y="19" fill="#e2e8f0" font-size="11" font-weight="600">📦 Serum Cokelat Glow</text>

    <text x="425" y="19" fill="#9ca3af" font-size="11" font-weight="600" font-family="monospace">📅 2026-07-25</text>

    <line x1="0" y1="40" x2="520" y2="40" stroke="#1f2937" stroke-width="1" />

    <text x="0" y="64" fill="#ffffff" font-size="15" font-weight="700">Jangan skip serum ini kalau mau kulit glowing seketika! ✨</text>

    <rect x="0" y="78" width="520" height="110" rx="10" fill="#05070d" stroke="#1e293b" stroke-width="1" />
    <text x="14" y="100" fill="#cbd5e1" font-size="11.5" font-family="monospace">Siapa yang masih suka bingung milih serum buat kulit sensitif? 🧐</text>
    <text x="14" y="120" fill="#cbd5e1" font-size="11.5" font-family="monospace">Cobain rahasia kulit sehat pakai Serum Cokelat Glow ini guys! ✨</text>
    <text x="14" y="142" fill="#38bdf8" font-size="11" font-family="monospace">#skincareroutine #glowing #dummybrand01 #fyp #racuntiktok</text>

    <rect x="400" y="152" width="106" height="26" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1" />
    <text x="412" y="169" fill="#cbd5e1" font-size="10.5" font-weight="600">📋 Copy Caption</text>
  </g>

  <g transform="translate(785, 20)">
    <rect x="0" y="0" width="240" height="34" rx="8" fill="#090d16" stroke="#1e293b" stroke-width="1" />
    <text x="12" y="21" fill="#38bdf8" font-size="11" font-weight="700">🎵 TikTok</text>
    <rect x="140" y="6" width="88" height="22" rx="6" fill="rgba(16, 185, 129, 0.2)" stroke="#10b981" stroke-width="1" />
    <text x="154" y="21" fill="#34d399" font-size="10.5" font-weight="700">Published</text>

    <rect x="0" y="42" width="240" height="34" rx="8" fill="#090d16" stroke="#1e293b" stroke-width="1" />
    <text x="12" y="63" fill="#60a5fa" font-size="11" font-weight="700">📘 Facebook</text>
    <rect x="140" y="48" width="88" height="22" rx="6" fill="rgba(245, 158, 11, 0.2)" stroke="#f59e0b" stroke-width="1" />
    <text x="152" y="63" fill="#fbbf24" font-size="10.5" font-weight="700">Scheduled</text>

    <rect x="0" y="84" width="240" height="34" rx="8" fill="#090d16" stroke="#1e293b" stroke-width="1" />
    <text x="12" y="105" fill="#f472b6" font-size="11" font-weight="700">📷 Instagram</text>
    <rect x="140" y="90" width="88" height="22" rx="6" fill="rgba(100, 116, 139, 0.2)" stroke="#475569" stroke-width="1" />
    <text x="146" y="105" fill="#9ca3af" font-size="10.5" font-weight="600">Not Published</text>

    <rect x="0" y="155" width="240" height="50" rx="12" fill="url(#detailBtn)" />
    <text x="68" y="185" fill="#ffffff" font-size="13" font-weight="700">Detail &amp; Status</text>
  </g>
</svg>`;
  const svgPath = `${baseDir}/${fileName}.svg`;
  const pngPath = `${baseDir}/${fileName}.png`;
  fs.writeFileSync(svgPath, svg);
  try {
    execSync(`qlmanage -t -s 1050 -o "${baseDir}" "${svgPath}"`);
    execSync(`cp "${baseDir}/${fileName}.svg.png" "${pngPath}"`);
    console.log(`Saved PNG: ${pngPath}`);
  } catch (err) {
    console.error(`Error converting ${fileName}:`, err.message);
  }
}

// Option A: Gold Amber
createSvg('#b45309', '#d97706', '#f59e0b', '#fef3c7', '#f59e0b', 'option_a_gold');
// Option B: Cyber Cyan
createSvg('#0f766e', '#0d9488', '#14b8a6', '#ccfbf1', '#14b8a6', 'option_b_cyan');
// Option C: Crimson Rose
createSvg('#be123c', '#e11d48', '#f43f5e', '#ffe4e6', '#f43f5e', 'option_c_rose');
// Option D: Emerald Minimalist
createSvg('#064e3b', '#047857', '#10b981', '#d1fae5', '#10b981', 'option_d_emerald');

console.log('All 4 option mockups generated!');
