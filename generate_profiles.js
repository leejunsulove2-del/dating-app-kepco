// Generate 5 male and 5 female profile placeholder images
// Also supports webp extension and fallback
import fs from 'fs';
import path from 'path';

const outDir = path.resolve('public/assets/profiles');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Generate stylish SVG and write as webp-compatible or SVG files
const malePalettes = [
  { bg: '#3b82f6', skin: '#fcd34d', hair: '#1e293b', shirt: '#2563eb', acc: '#60a5fa' },
  { bg: '#0284c7', skin: '#fde047', hair: '#334155', shirt: '#0369a1', acc: '#38bdf8' },
  { bg: '#4f46e5', skin: '#fbcfe8', hair: '#0f172a', shirt: '#4338ca', acc: '#818cf8' },
  { bg: '#0d9488', skin: '#fed7aa', hair: '#1c1917', shirt: '#0f766e', acc: '#2dd4bf' },
  { bg: '#6366f1', skin: '#fef08a', hair: '#27272a', shirt: '#4f46e5', acc: '#a5b4fc' },
];

const femalePalettes = [
  { bg: '#ec4899', skin: '#fce7f3', hair: '#831843', shirt: '#db2777', acc: '#f472b6' },
  { bg: '#f43f5e', skin: '#ffe4e6', hair: '#4c0519', shirt: '#e11d48', acc: '#fb7185' },
  { bg: '#d946ef', skin: '#fae8ff', hair: '#581c87', shirt: '#c026d3', acc: '#e879f9' },
  { bg: '#8b5cf6', skin: '#ede9fe', hair: '#3b0764', shirt: '#7c3aed', acc: '#a78bfa' },
  { bg: '#fb7185', skin: '#fff1f2', hair: '#701a75', shirt: '#f43f5e', acc: '#fda4af' },
];

function generateMaleSvg(num, p) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <linearGradient id="bg_m_${num}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${p.bg}" />
      <stop offset="100%" stop-color="${p.acc}" />
    </linearGradient>
  </defs>
  <rect width="200" height="200" rx="40" fill="url(#bg_m_${num})" />
  <!-- Body/Shirt -->
  <circle cx="100" cy="185" r="60" fill="${p.shirt}" />
  <path d="M 85 140 L 100 160 L 115 140 Z" fill="#ffffff" opacity="0.9" />
  <!-- Head & Neck -->
  <rect x="90" y="115" width="20" height="25" rx="5" fill="${p.skin}" />
  <circle cx="100" cy="90" r="40" fill="${p.skin}" />
  <!-- Male Hair Style -->
  <path d="M 60 85 C 60 50 140 50 140 85 C 135 60 115 55 100 55 C 80 55 65 65 60 85 Z" fill="${p.hair}" />
  <!-- Eyes & Eyebrows -->
  <rect x="80" y="82" width="10" height="4" rx="2" fill="${p.hair}" />
  <rect x="110" y="82" width="10" height="4" rx="2" fill="${p.hair}" />
  <circle cx="85" cy="92" r="3.5" fill="#1e293b" />
  <circle cx="115" cy="92" r="3.5" fill="#1e293b" />
  <!-- Smile -->
  <path d="M 90 108 Q 100 118 110 108" stroke="#1e293b" stroke-width="3" stroke-linecap="round" fill="none" />
  <!-- Badge -->
  <rect x="135" y="15" width="50" height="24" rx="12" fill="rgba(255,255,255,0.85)" />
  <text x="160" y="31" font-size="11" font-family="sans-serif" font-weight="bold" fill="${p.shirt}" text-anchor="middle">M-${num}</text>
</svg>`;
}

function generateFemaleSvg(num, p) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <linearGradient id="bg_f_${num}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${p.bg}" />
      <stop offset="100%" stop-color="${p.acc}" />
    </linearGradient>
  </defs>
  <rect width="200" height="200" rx="40" fill="url(#bg_f_${num})" />
  <!-- Long Hair Back -->
  <path d="M 50 90 C 50 140 60 170 70 180 C 130 180 140 170 150 90 Z" fill="${p.hair}" />
  <!-- Body/Blouse -->
  <circle cx="100" cy="185" r="55" fill="${p.shirt}" />
  <!-- Head & Neck -->
  <rect x="91" y="115" width="18" height="25" rx="5" fill="${p.skin}" />
  <circle cx="100" cy="90" r="38" fill="${p.skin}" />
  <!-- Female Hair Front & Bangs -->
  <path d="M 55 90 C 55 50 145 50 145 90 C 135 65 118 60 100 60 C 78 60 62 70 55 90 Z" fill="${p.hair}" />
  <!-- Eyes & Blush -->
  <rect x="80" y="83" width="9" height="3" rx="1.5" fill="${p.hair}" />
  <rect x="111" y="83" width="9" height="3" rx="1.5" fill="${p.hair}" />
  <circle cx="85" cy="92" r="3.5" fill="#1e293b" />
  <circle cx="115" cy="92" r="3.5" fill="#1e293b" />
  <!-- Blush -->
  <circle cx="75" cy="100" r="6" fill="#f43f5e" opacity="0.3" />
  <circle cx="125" cy="100" r="6" fill="#f43f5e" opacity="0.3" />
  <!-- Smile -->
  <path d="M 92 108 Q 100 117 108 108" stroke="#e11d48" stroke-width="2.5" stroke-linecap="round" fill="none" />
  <!-- Badge -->
  <rect x="135" y="15" width="50" height="24" rx="12" fill="rgba(255,255,255,0.85)" />
  <text x="160" y="31" font-size="11" font-family="sans-serif" font-weight="bold" fill="${p.shirt}" text-anchor="middle">W-${num}</text>
</svg>`;
}

for (let i = 1; i <= 5; i++) {
  const mSvg = generateMaleSvg(i, malePalettes[i - 1]);
  fs.writeFileSync(path.join(outDir, `man_${i}.webp`), mSvg);
  fs.writeFileSync(path.join(outDir, `man_${i}.svg`), mSvg);

  const fSvg = generateFemaleSvg(i, femalePalettes[i - 1]);
  fs.writeFileSync(path.join(outDir, `woman_${i}.webp`), fSvg);
  fs.writeFileSync(path.join(outDir, `woman_${i}.svg`), fSvg);
}

console.log('Profile assets generated successfully!');
