import fs from 'fs';
import { execSync } from 'child_process';

const baseDir = '/Users/sabeqmmursyid/.gemini/antigravity-ide/brain/1675ca9d-d643-4782-b726-05936af192a9';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1050 480" width="1050" height="480" style="background:#0a0a0c; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <defs>
    <linearGradient id="cardBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0d1322" />
      <stop offset="100%" stop-color="#090d16" />
    </linearGradient>
    <linearGradient id="btnPrimary" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2563eb" />
      <stop offset="100%" stop-color="#4f46e5" />
    </linearGradient>
  </defs>

  <!-- Header Section -->
  <text x="20" y="35" fill="#ffffff" font-size="22" font-weight="800">Command Center Dashboard</text>
  <text x="20" y="55" fill="#9ca3af" font-size="12">Ringkasan Eksekutif &amp; Akses Cepat MAKNA Grid System</text>

  <!-- BARIS 1: 4 METRIC CARDS -->
  <!-- Card 1: Content Ready -->
  <rect x="20" y="75" width="235" height="90" rx="14" fill="url(#cardBg)" stroke="#1e293b" stroke-width="1.5" />
  <text x="36" y="98" fill="#9ca3af" font-size="11" font-weight="600">🎬 KONTEN SIAP PUBLISH</text>
  <text x="36" y="135" fill="#38bdf8" font-size="28" font-weight="800">102</text>
  <text x="100" y="135" fill="#34d399" font-size="11">Video Ready</text>

  <!-- Card 2: Active Campaigns -->
  <rect x="275" y="75" width="235" height="90" rx="14" fill="url(#cardBg)" stroke="#1e293b" stroke-width="1.5" />
  <text x="291" y="98" fill="#9ca3af" font-size="11" font-weight="600">🌱 KAMPANYE AKTIF</text>
  <text x="291" y="135" fill="#34d399" font-size="28" font-weight="800">12</text>
  <text x="340" y="135" fill="#9ca3af" font-size="11">OPC &amp; Strategic</text>

  <!-- Card 3: Products Catalog -->
  <rect x="530" y="75" width="235" height="90" rx="14" fill="url(#cardBg)" stroke="#1e293b" stroke-width="1.5" />
  <text x="546" y="98" fill="#9ca3af" font-size="11" font-weight="600">📦 KATALOG PRODUK</text>
  <text x="546" y="135" fill="#fbbf24" font-size="28" font-weight="800">10</text>
  <text x="590" y="135" fill="#9ca3af" font-size="11">SKUs Active</text>

  <!-- Card 4: Server Cluster Health -->
  <rect x="785" y="75" width="245" height="90" rx="14" fill="url(#cardBg)" stroke="#1e293b" stroke-width="1.5" />
  <text x="801" y="98" fill="#9ca3af" font-size="11" font-weight="600">🟢 SERVER CLUSTER</text>
  <text x="801" y="135" fill="#34d399" font-size="22" font-weight="800">3 / 3 Nodes</text>
  <text x="915" y="135" fill="#34d399" font-size="11">Healthy</text>

  <!-- BARIS 2: QUICK LAUNCHPAD (4 BUTTONS) -->
  <rect x="20" y="185" width="1010" height="75" rx="14" fill="url(#cardBg)" stroke="#1e293b" stroke-width="1.5" />
  <text x="36" y="208" fill="#9ca3af" font-size="11" font-weight="700">⚡ QUICK LAUNCHPAD</text>

  <rect x="36" y="218" width="220" height="32" rx="8" fill="url(#btnPrimary)" />
  <text x="65" y="239" fill="#ffffff" font-size="11.5" font-weight="700">+ Buat Kampanye OPC</text>

  <rect x="270" y="218" width="220" height="32" rx="8" fill="#1e293b" stroke="#334155" stroke-width="1" />
  <text x="295" y="239" fill="#e2e8f0" font-size="11.5" font-weight="700">📄 Import Planner Sheet</text>

  <rect x="504" y="218" width="220" height="32" rx="8" fill="#1e293b" stroke="#334155" stroke-width="1" />
  <text x="535" y="239" fill="#e2e8f0" font-size="11.5" font-weight="700">📱 ContentFlow Hub</text>

  <rect x="738" y="218" width="220" height="32" rx="8" fill="#1e293b" stroke="#334155" stroke-width="1" />
  <text x="770" y="239" fill="#e2e8f0" font-size="11.5" font-weight="700">🧪 Recipe Engine Labs</text>

  <!-- BARIS 3: RECENT CONTENT FEED (LEFT) & PLATFORM READINESS (RIGHT) -->
  <!-- Left Side: Recent Content List -->
  <rect x="20" y="280" width="670" height="180" rx="14" fill="url(#cardBg)" stroke="#1e293b" stroke-width="1.5" />
  <text x="36" y="305" fill="#ffffff" font-size="13" font-weight="700">📱 5 Konten Siap Publish Terbaru</text>

  <!-- Item 1 -->
  <rect x="36" y="318" width="638" height="36" rx="8" fill="#090d16" stroke="#1f2937" stroke-width="1" />
  <text x="50" y="341" fill="#93c5fd" font-size="11" font-weight="800">🏷️ @dummybrand01</text>
  <text x="170" y="341" fill="#ffffff" font-size="11.5">Jangan skip serum ini kalau mau kulit glowing seketika! ✨</text>
  <text x="555" y="341" fill="#34d399" font-size="10.5" font-weight="700">TikTok Published</text>

  <!-- Item 2 -->
  <rect x="36" y="358" width="638" height="36" rx="8" fill="#090d16" stroke="#1f2937" stroke-width="1" />
  <text x="50" y="381" fill="#fca5a5" font-size="11" font-weight="800">🏷️ @dummybrand02</text>
  <text x="170" y="381" fill="#ffffff" font-size="11.5">Bikin sarapan sehat cuma 5 menit, rasanya nagih banget! 🥗</text>
  <text x="555" y="381" fill="#fbbf24" font-size="10.5" font-weight="700">FB Scheduled</text>

  <!-- Item 3 -->
  <rect x="36" y="398" width="638" height="36" rx="8" fill="#090d16" stroke="#1f2937" stroke-width="1" />
  <text x="50" y="421" fill="#93c5fd" font-size="11" font-weight="800">🏷️ @dummybrand01</text>
  <text x="170" y="421" fill="#ffffff" font-size="11.5">Sunscreen lokal terbaik anti lengket dan no whitecast! ☀️</text>
  <text x="555" y="421" fill="#9ca3af" font-size="10.5" font-weight="600">Not Published</text>

  <!-- Right Side: Platform Readiness Progress -->
  <rect x="710" y="280" width="320" height="180" rx="14" fill="url(#cardBg)" stroke="#1e293b" stroke-width="1.5" />
  <text x="726" y="305" fill="#ffffff" font-size="13" font-weight="700">📊 Progress Publikasi</text>

  <!-- TikTok Progress Bar -->
  <text x="726" y="335" fill="#38bdf8" font-size="11" font-weight="700">🎵 TikTok (45% Published)</text>
  <rect x="726" y="342" width="280" height="8" rx="4" fill="#1e293b" />
  <rect x="726" y="342" width="126" height="8" rx="4" fill="#38bdf8" />

  <!-- FB Progress Bar -->
  <text x="726" y="375" fill="#60a5fa" font-size="11" font-weight="700">📘 Facebook (30% Published)</text>
  <rect x="726" y="382" width="280" height="8" rx="4" fill="#1e293b" />
  <rect x="726" y="382" width="84" height="8" rx="4" fill="#60a5fa" />

  <!-- IG Progress Bar -->
  <text x="726" y="415" fill="#f472b6" font-size="11" font-weight="700">📷 Instagram (25% Published)</text>
  <rect x="726" y="422" width="280" height="8" rx="4" fill="#1e293b" />
  <rect x="726" y="422" width="70" height="8" rx="4" fill="#f472b6" />
</svg>`;

const svgPath = `${baseDir}/dashboard_mockup.svg`;
const pngPath = `${baseDir}/dashboard_mockup.png`;
fs.writeFileSync(svgPath, svg);
execSync(`qlmanage -t -s 1050 -o "${baseDir}" "${svgPath}"`);
execSync(`cp "${baseDir}/dashboard_mockup.svg.png" "${pngPath}"`);
console.log('Dashboard Mockup PNG saved:', pngPath);
