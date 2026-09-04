import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = path.join(process.cwd(), 'public', 'assets', 'profiles');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Color palettes for backgrounds
const BG_PALETTES = [
  { id: 'peach', start: '#fed7aa', end: '#fdba74' },
  { id: 'rose', start: '#fecdd3', end: '#fda4af' },
  { id: 'lavender', start: '#ddd6fe', end: '#c4b5fd' },
  { id: 'sky', start: '#bae6fd', end: '#7dd3fc' },
  { id: 'mint', start: '#bbf7d0', end: '#86efac' },
  { id: 'lemon', start: '#fef08a', end: '#fde047' },
  { id: 'sunset', start: '#fed7aa', end: '#f43f5e' },
  { id: 'aurora', start: '#a7f3d0', end: '#67e8f9' },
  { id: 'lilac', start: '#f5d0fe', end: '#e879f9' },
  { id: 'ocean', start: '#c7d2fe', end: '#818cf8' },
];

// Animals specs
const ANIMALS = [
  {
    species: 'fox',
    korean: '여우',
    variants: [
      { name: '붉은여우', base: '#ea580c', earInner: '#fed7aa', muzzle: '#fff7ed', cheek: '#ea580c' },
      { name: '사막여우', base: '#f59e0b', earInner: '#fef3c7', muzzle: '#ffffff', cheek: '#f59e0b' },
      { name: '북극여우', base: '#f8fafc', earInner: '#fecdd3', muzzle: '#ffffff', cheek: '#e2e8f0' },
      { name: '은빛여우', base: '#475569', earInner: '#cbd5e1', muzzle: '#f1f5f9', cheek: '#334155' },
      { name: '골든여우', base: '#d97706', earInner: '#fef3c7', muzzle: '#fffbeb', cheek: '#b45309' },
    ],
    drawHead: (v, bg, acc) => `
      <!-- Ears -->
      <polygon points="20,45 12,12 44,28" fill="${v.base}"/>
      <polygon points="23,40 17,20 38,30" fill="${v.earInner}"/>
      <polygon points="80,45 88,12 56,28" fill="${v.base}"/>
      <polygon points="77,40 83,20 62,30" fill="${v.earInner}"/>
      <!-- Face -->
      <path d="M20,50 Q50,28 80,50 Q85,75 50,86 Q15,75 20,50 Z" fill="${v.base}"/>
      <!-- White Cheeks -->
      <path d="M22,54 Q38,48 50,60 Q34,80 22,66 Z" fill="${v.muzzle}"/>
      <path d="M78,54 Q62,48 50,60 Q66,80 78,66 Z" fill="${v.muzzle}"/>
      <polygon points="45,62 55,62 50,68" fill="#1c1917"/>
      <!-- Eyes -->
      <ellipse cx="36" cy="50" rx="4" ry="4.5" fill="#1c1917"/>
      <circle cx="37.5" cy="48" r="1.5" fill="#ffffff"/>
      <ellipse cx="64" cy="50" rx="4" ry="4.5" fill="#1c1917"/>
      <circle cx="65.5" cy="48" r="1.5" fill="#ffffff"/>
      <!-- Nose & Mouth -->
      <path d="M47,70 Q50,73 53,70" stroke="#1c1917" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <ellipse cx="28" cy="62" rx="4" ry="2.5" fill="#fb7185" opacity="0.6"/>
      <ellipse cx="72" cy="62" rx="4" ry="2.5" fill="#fb7185" opacity="0.6"/>
    `
  },
  {
    species: 'bear',
    korean: '곰',
    variants: [
      { name: '갈색곰', base: '#78350f', earInner: '#d97706', muzzle: '#fef3c7' },
      { name: '아기백곰', base: '#f8fafc', earInner: '#fecdd3', muzzle: '#e2e8f0' },
      { name: '초코곰', base: '#451a03', earInner: '#9a3412', muzzle: '#fed7aa' },
      { name: '꿀곰돌이', base: '#b45309', earInner: '#fde047', muzzle: '#fef9c3' },
      { name: '밀크티곰', base: '#a8a29e', earInner: '#e7e5e4', muzzle: '#fafaf9' },
    ],
    drawHead: (v, bg, acc) => `
      <!-- Ears -->
      <circle cx="26" cy="30" r="14" fill="${v.base}"/>
      <circle cx="26" cy="30" r="8" fill="${v.earInner}"/>
      <circle cx="74" cy="30" r="14" fill="${v.base}"/>
      <circle cx="74" cy="30" r="8" fill="${v.earInner}"/>
      <!-- Face -->
      <circle cx="50" cy="55" r="33" fill="${v.base}"/>
      <!-- Muzzle -->
      <ellipse cx="50" cy="64" rx="18" ry="14" fill="${v.muzzle}"/>
      <!-- Eyes -->
      <circle cx="37" cy="48" r="4" fill="#1c1917"/>
      <circle cx="38.5" cy="46.5" r="1.5" fill="#ffffff"/>
      <circle cx="63" cy="48" r="4" fill="#1c1917"/>
      <circle cx="64.5" cy="46.5" r="1.5" fill="#ffffff"/>
      <!-- Nose & Mouth -->
      <ellipse cx="50" cy="61" rx="5.5" ry="4" fill="#1c1917"/>
      <path d="M46,67 Q50,71 54,67" stroke="#1c1917" stroke-width="2" fill="none" stroke-linecap="round"/>
      <ellipse cx="28" cy="58" rx="4.5" ry="3" fill="#fb7185" opacity="0.6"/>
      <ellipse cx="72" cy="58" rx="4.5" ry="3" fill="#fb7185" opacity="0.6"/>
    `
  },
  {
    species: 'wolf',
    korean: '늑대',
    variants: [
      { name: '회색늑대', base: '#475569', earInner: '#94a3b8', muzzle: '#f1f5f9', eye: '#38bdf8' },
      { name: '흑늑대', base: '#1e293b', earInner: '#475569', muzzle: '#cbd5e1', eye: '#facc15' },
      { name: '설원늑대', base: '#e2e8f0', earInner: '#cbd5e1', muzzle: '#ffffff', eye: '#0ea5e9' },
      { name: '황혼늑대', base: '#334155', earInner: '#64748b', muzzle: '#e2e8f0', eye: '#a855f7' },
      { name: '푸른늑대', base: '#1e3a8a', earInner: '#3b82f6', muzzle: '#dbeafe', eye: '#38bdf8' },
    ],
    drawHead: (v, bg, acc) => `
      <!-- Ears -->
      <polygon points="22,46 14,14 44,28" fill="${v.base}"/>
      <polygon points="24,40 18,22 38,30" fill="${v.earInner}"/>
      <polygon points="78,46 86,14 56,28" fill="${v.base}"/>
      <polygon points="76,40 82,22 62,30" fill="${v.earInner}"/>
      <!-- Head -->
      <polygon points="50,26 24,50 30,76 50,86 70,76 76,50" fill="${v.base}"/>
      <!-- Muzzle -->
      <polygon points="50,46 36,66 50,82 64,66" fill="${v.muzzle}"/>
      <!-- Fierce Eyes -->
      <polygon points="32,48 42,46 38,53" fill="${v.eye || '#38bdf8'}"/>
      <circle cx="37" cy="49" r="1.5" fill="#0f172a"/>
      <polygon points="68,48 58,46 62,53" fill="${v.eye || '#38bdf8'}"/>
      <circle cx="63" cy="49" r="1.5" fill="#0f172a"/>
      <!-- Nose & Mouth -->
      <polygon points="46,65 54,65 50,71" fill="#0f172a"/>
      <path d="M46,74 Q50,77 54,74" stroke="#0f172a" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    `
  },
  {
    species: 'giraffe',
    korean: '기린',
    variants: [
      { name: '노랑기린', base: '#fde047', spot: '#ca8a04', earInner: '#fef08a' },
      { name: '오렌지기린', base: '#fed7aa', spot: '#ea580c', earInner: '#ffedd5' },
      { name: '사탕기린', base: '#fbcfe8', spot: '#ec4899', earInner: '#fdf2f8' },
      { name: '골든기린', base: '#fef08a', spot: '#d97706', earInner: '#fef9c3' },
      { name: '카라멜기린', base: '#fed7aa', spot: '#9a3412', earInner: '#fff7ed' },
    ],
    drawHead: (v, bg, acc) => `
      <!-- Horns (Ossicones) -->
      <line x1="40" y1="35" x2="36" y2="15" stroke="${v.spot}" stroke-width="4" stroke-linecap="round"/>
      <circle cx="35" cy="14" r="5" fill="${v.spot}"/>
      <line x1="60" y1="35" x2="64" y2="15" stroke="${v.spot}" stroke-width="4" stroke-linecap="round"/>
      <circle cx="65" cy="14" r="5" fill="${v.spot}"/>
      <!-- Ears -->
      <ellipse cx="20" cy="38" rx="10" ry="6" fill="${v.base}" transform="rotate(-20 20 38)"/>
      <ellipse cx="20" cy="38" rx="6" ry="3" fill="${v.earInner}" transform="rotate(-20 20 38)"/>
      <ellipse cx="80" cy="38" rx="10" ry="6" fill="${v.base}" transform="rotate(20 80 38)"/>
      <ellipse cx="80" cy="38" rx="6" ry="3" fill="${v.earInner}" transform="rotate(20 80 38)"/>
      <!-- Face -->
      <ellipse cx="50" cy="54" rx="26" ry="30" fill="${v.base}"/>
      <!-- Spots -->
      <circle cx="36" cy="38" r="4" fill="${v.spot}"/>
      <circle cx="64" cy="38" r="4" fill="${v.spot}"/>
      <ellipse cx="50" cy="34" rx="5" ry="3" fill="${v.spot}"/>
      <!-- Muzzle -->
      <ellipse cx="50" cy="68" rx="18" ry="12" fill="${v.spot}" opacity="0.3"/>
      <!-- Big Gentle Eyes with Lashes -->
      <ellipse cx="38" cy="48" rx="4.5" ry="5" fill="#1c1917"/>
      <circle cx="39.5" cy="46.5" r="1.6" fill="#ffffff"/>
      <path d="M34,44 L31,41" stroke="#1c1917" stroke-width="1.5" stroke-linecap="round"/>
      <ellipse cx="62" cy="48" rx="4.5" ry="5" fill="#1c1917"/>
      <circle cx="63.5" cy="46.5" r="1.6" fill="#ffffff"/>
      <path d="M66,44 L69,41" stroke="#1c1917" stroke-width="1.5" stroke-linecap="round"/>
      <!-- Nostrils & Smile -->
      <circle cx="45" cy="66" r="2" fill="#1c1917"/>
      <circle cx="55" cy="66" r="2" fill="#1c1917"/>
      <path d="M47,72 Q50,75 53,72" stroke="#1c1917" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <ellipse cx="28" cy="56" rx="4" ry="2.5" fill="#fb7185" opacity="0.6"/>
      <ellipse cx="72" cy="56" rx="4" ry="2.5" fill="#fb7185" opacity="0.6"/>
    `
  },
  {
    species: 'rabbit',
    korean: '토끼',
    variants: [
      { name: '눈꽃토끼', base: '#ffffff', earInner: '#fda4af', muzzle: '#fff1f2' },
      { name: '복숭아토끼', base: '#fed7aa', earInner: '#f43f5e', muzzle: '#fff7ed' },
      { name: '잿빛토끼', base: '#cbd5e1', earInner: '#fecdd3', muzzle: '#f8fafc' },
      { name: '라벤더토끼', base: '#e9d5ff', earInner: '#f472b6', muzzle: '#faf5ff' },
      { name: '달토끼', base: '#fef08a', earInner: '#fb7185', muzzle: '#fffbeb' },
    ],
    drawHead: (v, bg, acc) => `
      <!-- Long Ears -->
      <ellipse cx="36" cy="22" rx="8" ry="22" fill="${v.base}" transform="rotate(-8 36 22)"/>
      <ellipse cx="36" cy="22" rx="4.5" ry="16" fill="${v.earInner}" transform="rotate(-8 36 22)"/>
      <ellipse cx="64" cy="22" rx="8" ry="22" fill="${v.base}" transform="rotate(8 64 22)"/>
      <ellipse cx="64" cy="22" rx="4.5" ry="16" fill="${v.earInner}" transform="rotate(8 64 22)"/>
      <!-- Face -->
      <circle cx="50" cy="58" r="30" fill="${v.base}"/>
      <!-- Eyes -->
      <ellipse cx="36" cy="52" rx="4.5" ry="5.5" fill="#1c1917"/>
      <circle cx="38" cy="50" r="1.8" fill="#ffffff"/>
      <circle cx="35" cy="54" r="1" fill="#ffffff"/>
      <ellipse cx="64" cy="52" rx="4.5" ry="5.5" fill="#1c1917"/>
      <circle cx="66" cy="50" r="1.8" fill="#ffffff"/>
      <circle cx="63" cy="54" r="1" fill="#ffffff"/>
      <!-- Nose & Mouth (Y shape) -->
      <polygon points="48,61 52,61 50,64" fill="#fb7185"/>
      <path d="M50,64 L50,67 M46,69 Q50,67 50,67 Q50,67 54,69" stroke="#1c1917" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <!-- Whiskers -->
      <line x1="22" y1="62" x2="34" y2="63" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="78" y1="62" x2="66" y2="63" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/>
      <!-- Rosy Cheeks -->
      <ellipse cx="28" cy="62" rx="5.5" ry="3.5" fill="#fb7185" opacity="0.7"/>
      <ellipse cx="72" cy="62" rx="5.5" ry="3.5" fill="#fb7185" opacity="0.7"/>
    `
  },
  {
    species: 'dog',
    korean: '강아지',
    variants: [
      { name: '시바견', base: '#ea580c', earInner: '#fed7aa', muzzle: '#fff7ed' },
      { name: '골든리트리버', base: '#eab308', earInner: '#ca8a04', muzzle: '#fef9c3' },
      { name: '비숑', base: '#ffffff', earInner: '#fecdd3', muzzle: '#f4f4f5' },
      { name: '허스키', base: '#475569', earInner: '#cbd5e1', muzzle: '#f8fafc' },
      { name: '웰시코기', base: '#d97706', earInner: '#fef3c7', muzzle: '#ffffff' },
    ],
    drawHead: (v, bg, acc) => `
      <!-- Ears -->
      <polygon points="24,42 14,14 44,26" fill="${v.base}"/>
      <polygon points="26,38 20,20 38,28" fill="${v.earInner}"/>
      <polygon points="76,42 86,14 56,26" fill="${v.base}"/>
      <polygon points="74,38 80,20 62,28" fill="${v.earInner}"/>
      <!-- Head -->
      <ellipse cx="50" cy="56" rx="32" ry="28" fill="${v.base}"/>
      <ellipse cx="50" cy="64" rx="19" ry="15" fill="${v.muzzle}"/>
      <!-- Eyes -->
      <circle cx="37" cy="49" r="4.5" fill="#1c1917"/>
      <circle cx="38.5" cy="47.5" r="1.6" fill="#ffffff"/>
      <circle cx="63" cy="49" r="4.5" fill="#1c1917"/>
      <circle cx="64.5" cy="47.5" r="1.6" fill="#ffffff"/>
      <!-- Nose & Mouth -->
      <ellipse cx="50" cy="61" rx="5" ry="3.5" fill="#1c1917"/>
      <path d="M46,66 Q50,70 54,66" stroke="#1c1917" stroke-width="2" fill="none" stroke-linecap="round"/>
      <ellipse cx="28" cy="60" rx="4.5" ry="3" fill="#fb7185" opacity="0.6"/>
      <ellipse cx="72" cy="60" rx="4.5" ry="3" fill="#fb7185" opacity="0.6"/>
    `
  },
  {
    species: 'cat',
    korean: '고양이',
    variants: [
      { name: '치즈태비', base: '#fbbf24', earInner: '#fecdd3', eye: '#10b981' },
      { name: '백묘', base: '#ffffff', earInner: '#fda4af', eye: '#0284c7' },
      { name: '러시안블루', base: '#94a3b8', earInner: '#cbd5e1', eye: '#10b981' },
      { name: '삼색이', base: '#fed7aa', earInner: '#fda4af', eye: '#f59e0b' },
      { name: '턱시도', base: '#0f172a', earInner: '#fda4af', eye: '#eab308', muzzle: '#ffffff' },
    ],
    drawHead: (v, bg, acc) => `
      <!-- Cat Ears -->
      <polygon points="22,42 16,14 42,26" fill="${v.base}"/>
      <polygon points="24,38 20,20 38,28" fill="${v.earInner}"/>
      <polygon points="78,42 84,14 58,26" fill="${v.base}"/>
      <polygon points="76,38 80,20 62,28" fill="${v.earInner}"/>
      <!-- Head -->
      <circle cx="50" cy="54" r="32" fill="${v.base}"/>
      ${v.muzzle ? `<ellipse cx="50" cy="65" rx="18" ry="13" fill="${v.muzzle}"/>` : ''}
      <!-- Eyes -->
      <ellipse cx="37" cy="49" rx="5" ry="5.5" fill="${v.eye || '#10b981'}"/>
      <circle cx="38.5" cy="47" r="1.8" fill="#ffffff"/>
      <ellipse cx="63" cy="49" rx="5" ry="5.5" fill="${v.eye || '#10b981'}"/>
      <circle cx="64.5" cy="47" r="1.8" fill="#ffffff"/>
      <!-- Nose & Mouth -->
      <polygon points="48,59 52,59 50,62" fill="#fb7185"/>
      <path d="M46,64 Q50,67 54,64" stroke="#475569" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <!-- Whiskers -->
      <line x1="22" y1="59" x2="35" y2="61" stroke="#475569" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="78" y1="59" x2="65" y2="61" stroke="#475569" stroke-width="1.5" stroke-linecap="round"/>
      <ellipse cx="28" cy="57" rx="4.5" ry="3" fill="#fb7185" opacity="0.6"/>
      <ellipse cx="72" cy="57" rx="4.5" ry="3" fill="#fb7185" opacity="0.6"/>
    `
  },
  {
    species: 'panda',
    korean: '판다',
    variants: [
      { name: '자이언트판다', base: '#ffffff', patch: '#0f172a', cheek: '#fb7185' },
      { name: '베이비판다', base: '#ffffff', patch: '#334155', cheek: '#f43f5e' },
      { name: '브라운판다', base: '#fffbeb', patch: '#78350f', cheek: '#fb7185' },
      { name: '핑크판다', base: '#fdf2f8', patch: '#831843', cheek: '#ec4899' },
      { name: '골든판다', base: '#fefce8', patch: '#713f12', cheek: '#f59e0b' },
    ],
    drawHead: (v, bg, acc) => `
      <!-- Ears -->
      <circle cx="25" cy="28" r="13" fill="${v.patch}"/>
      <circle cx="75" cy="28" r="13" fill="${v.patch}"/>
      <!-- Head -->
      <circle cx="50" cy="55" r="33" fill="${v.base}"/>
      <!-- Eye Patches -->
      <ellipse cx="36" cy="49" rx="8" ry="10" fill="${v.patch}" transform="rotate(-15 36 49)"/>
      <ellipse cx="64" cy="49" rx="8" ry="10" fill="${v.patch}" transform="rotate(15 64 49)"/>
      <!-- Eyes Inside -->
      <circle cx="36" cy="48" r="3.5" fill="#ffffff"/>
      <circle cx="36" cy="48" r="2" fill="#09090b"/>
      <circle cx="37" cy="47" r="1" fill="#ffffff"/>
      <circle cx="64" cy="48" r="3.5" fill="#ffffff"/>
      <circle cx="64" cy="48" r="2" fill="#09090b"/>
      <circle cx="65" cy="47" r="1" fill="#ffffff"/>
      <!-- Nose & Mouth -->
      <ellipse cx="50" cy="62" rx="6" ry="4" fill="${v.patch}"/>
      <path d="M46,67 Q50,71 54,67" stroke="${v.patch}" stroke-width="2" fill="none" stroke-linecap="round"/>
      <ellipse cx="26" cy="62" rx="5" ry="3.5" fill="${v.cheek}" opacity="0.6"/>
      <ellipse cx="74" cy="62" rx="5" ry="3.5" fill="${v.cheek}" opacity="0.6"/>
    `
  },
  {
    species: 'deer',
    korean: '사슴',
    variants: [
      { name: '꽃사슴', base: '#d97706', spot: '#ffffff', earInner: '#fef3c7' },
      { name: '아기밤비', base: '#ea580c', spot: '#ffffff', earInner: '#fed7aa' },
      { name: '화이트디어', base: '#f8fafc', spot: '#e2e8f0', earInner: '#fecdd3' },
      { name: '골든디어', base: '#ca8a04', spot: '#fef9c3', earInner: '#fef08a' },
      { name: '루돌프사슴', base: '#b45309', spot: '#fef3c7', earInner: '#ffedd5', redNose: true },
    ],
    drawHead: (v, bg, acc) => `
      <!-- Antlers -->
      <path d="M38,30 Q30,12 25,10 M32,20 Q22,18 20,22" stroke="#78350f" stroke-width="3" stroke-linecap="round" fill="none"/>
      <path d="M62,30 Q70,12 75,10 M68,20 Q78,18 80,22" stroke="#78350f" stroke-width="3" stroke-linecap="round" fill="none"/>
      <!-- Ears -->
      <ellipse cx="22" cy="40" rx="12" ry="7" fill="${v.base}" transform="rotate(-25 22 40)"/>
      <ellipse cx="22" cy="40" rx="8" ry="4" fill="${v.earInner}" transform="rotate(-25 22 40)"/>
      <ellipse cx="78" cy="40" rx="12" ry="7" fill="${v.base}" transform="rotate(25 78 40)"/>
      <ellipse cx="78" cy="40" rx="8" ry="4" fill="${v.earInner}" transform="rotate(25 78 40)"/>
      <!-- Head -->
      <path d="M30,42 Q50,30 70,42 Q78,74 50,84 Q22,74 30,42 Z" fill="${v.base}"/>
      <!-- Spots -->
      <circle cx="42" cy="38" r="2.5" fill="${v.spot}"/>
      <circle cx="58" cy="38" r="2.5" fill="${v.spot}"/>
      <circle cx="50" cy="34" r="2.5" fill="${v.spot}"/>
      <!-- Muzzle -->
      <ellipse cx="50" cy="72" rx="14" ry="9" fill="#fffbeb"/>
      <!-- Big Innocent Eyes -->
      <ellipse cx="38" cy="52" rx="5" ry="6" fill="#1c1917"/>
      <circle cx="40" cy="50" r="2" fill="#ffffff"/>
      <ellipse cx="62" cy="52" rx="5" ry="6" fill="#1c1917"/>
      <circle cx="64" cy="50" r="2" fill="#ffffff"/>
      <!-- Nose & Mouth -->
      <ellipse cx="50" cy="70" rx="4" ry="3" fill="${v.redNose ? '#ef4444' : '#1c1917'}"/>
      <path d="M47,74 Q50,77 53,74" stroke="#1c1917" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <ellipse cx="28" cy="62" rx="4" ry="2.5" fill="#fb7185" opacity="0.6"/>
      <ellipse cx="72" cy="62" rx="4" ry="2.5" fill="#fb7185" opacity="0.6"/>
    `
  },
  {
    species: 'squirrel',
    korean: '다람쥐',
    variants: [
      { name: '도토리다람쥐', base: '#c2410c', stripe: '#7c2d12', cheek: '#ffedd5' },
      { name: '줄무늬다람쥐', base: '#d97706', stripe: '#451a03', cheek: '#fffbeb' },
      { name: '하늘다람쥐', base: '#94a3b8', stripe: '#334155', cheek: '#f8fafc' },
      { name: '금빛다람쥐', base: '#f59e0b', stripe: '#92400e', cheek: '#fef3c7' },
      { name: '초코다람쥐', base: '#78350f', stripe: '#3b0764', cheek: '#fed7aa' },
    ],
    drawHead: (v, bg, acc) => `
      <!-- Tiny Round Ears -->
      <circle cx="28" cy="30" r="10" fill="${v.base}"/>
      <circle cx="28" cy="30" r="6" fill="#fed7aa"/>
      <circle cx="72" cy="30" r="10" fill="${v.base}"/>
      <circle cx="72" cy="30" r="6" fill="#fed7aa"/>
      <!-- Face with chubby cheeks -->
      <circle cx="50" cy="54" r="32" fill="${v.base}"/>
      <!-- Stripes on Forehead -->
      <line x1="50" y1="26" x2="50" y2="44" stroke="${v.stripe}" stroke-width="3" stroke-linecap="round"/>
      <line x1="44" y1="30" x2="44" y2="42" stroke="${v.stripe}" stroke-width="2.2" stroke-linecap="round"/>
      <line x1="56" y1="30" x2="56" y2="42" stroke="${v.stripe}" stroke-width="2.2" stroke-linecap="round"/>
      <!-- Puffy Cheeks -->
      <circle cx="34" cy="64" r="15" fill="${v.cheek}"/>
      <circle cx="66" cy="64" r="15" fill="${v.cheek}"/>
      <!-- Eyes -->
      <circle cx="36" cy="50" r="4.5" fill="#1c1917"/>
      <circle cx="37.5" cy="48.5" r="1.6" fill="#ffffff"/>
      <circle cx="64" cy="50" r="4.5" fill="#1c1917"/>
      <circle cx="65.5" cy="48.5" r="1.6" fill="#ffffff"/>
      <!-- Tiny Nose & Buck Tooth -->
      <ellipse cx="50" cy="61" rx="3.5" ry="2.5" fill="#1c1917"/>
      <rect x="48" y="65" width="4" height="4" rx="1" fill="#ffffff" stroke="#1c1917" stroke-width="1"/>
      <ellipse cx="26" cy="62" rx="4" ry="2.5" fill="#fb7185" opacity="0.6"/>
      <ellipse cx="74" cy="62" rx="4" ry="2.5" fill="#fb7185" opacity="0.6"/>
    `
  },
  {
    species: 'hamster',
    korean: '햄스터',
    variants: [
      { name: '골든햄스터', base: '#f59e0b', belly: '#ffffff', ear: '#fecdd3' },
      { name: '드워프햄스터', base: '#94a3b8', belly: '#ffffff', ear: '#fda4af' },
      { name: '푸딩햄스터', base: '#fde047', belly: '#fffbeb', ear: '#fecdd3' },
      { name: '화이트햄스터', base: '#ffffff', belly: '#fff1f2', ear: '#fda4af' },
      { name: '로보햄스터', base: '#d97706', belly: '#ffffff', ear: '#fecdd3' },
    ],
    drawHead: (v, bg, acc) => `
      <!-- Ears -->
      <ellipse cx="26" cy="30" rx="9" ry="8" fill="${v.base}"/>
      <ellipse cx="26" cy="30" rx="5" ry="4.5" fill="${v.ear}"/>
      <ellipse cx="74" cy="30" rx="9" ry="8" fill="${v.base}"/>
      <ellipse cx="74" cy="30" rx="5" ry="4.5" fill="${v.ear}"/>
      <!-- Super Round Head -->
      <circle cx="50" cy="56" r="33" fill="${v.base}"/>
      <!-- Puffy White Muzzle -->
      <ellipse cx="50" cy="66" rx="20" ry="14" fill="${v.belly}"/>
      <!-- Big Beads Eyes -->
      <circle cx="36" cy="50" r="5" fill="#09090b"/>
      <circle cx="38" cy="48" r="2" fill="#ffffff"/>
      <circle cx="64" cy="50" r="5" fill="#09090b"/>
      <circle cx="66" cy="48" r="2" fill="#ffffff"/>
      <!-- Tiny Pink Nose & Teeth -->
      <polygon points="48,60 52,60 50,63" fill="#fb7185"/>
      <path d="M47,65 Q50,68 53,65" stroke="#1c1917" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <!-- Cheeks -->
      <ellipse cx="25" cy="63" rx="5" ry="3.5" fill="#fb7185" opacity="0.7"/>
      <ellipse cx="75" cy="63" rx="5" ry="3.5" fill="#fb7185" opacity="0.7"/>
    `
  },
  {
    species: 'tiger',
    korean: '호랑이',
    variants: [
      { name: '용맹호랑이', base: '#f97316', stripe: '#18181b', muzzle: '#fff7ed' },
      { name: '백호랑이', base: '#f8fafc', stripe: '#475569', muzzle: '#ffffff' },
      { name: '황금호랑이', base: '#eab308', stripe: '#713f12', muzzle: '#fef9c3' },
      { name: '아기호랑이', base: '#fb923c', stripe: '#27272a', muzzle: '#ffffff' },
      { name: '흑호랑이', base: '#334155', stripe: '#020617', muzzle: '#cbd5e1' },
    ],
    drawHead: (v, bg, acc) => `
      <!-- Ears -->
      <circle cx="25" cy="28" r="13" fill="${v.base}"/>
      <circle cx="25" cy="28" r="8" fill="#18181b"/>
      <circle cx="25" cy="28" r="4" fill="#ffffff"/>
      <circle cx="75" cy="28" r="13" fill="${v.base}"/>
      <circle cx="75" cy="28" r="8" fill="#18181b"/>
      <circle cx="75" cy="28" r="4" fill="#ffffff"/>
      <!-- Head -->
      <circle cx="50" cy="55" r="33" fill="${v.base}"/>
      <!-- Tiger Stripes (Forehead 王) -->
      <line x1="42" y1="28" x2="58" y2="28" stroke="${v.stripe}" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="45" y1="33" x2="55" y2="33" stroke="${v.stripe}" stroke-width="2.2" stroke-linecap="round"/>
      <line x1="50" y1="26" x2="50" y2="38" stroke="${v.stripe}" stroke-width="2.5" stroke-linecap="round"/>
      <!-- Side Stripes -->
      <path d="M20,50 L30,52" stroke="${v.stripe}" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M22,60 L32,60" stroke="${v.stripe}" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M80,50 L70,52" stroke="${v.stripe}" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M78,60 L68,60" stroke="${v.stripe}" stroke-width="2.5" stroke-linecap="round"/>
      <!-- White Muzzle -->
      <ellipse cx="50" cy="65" rx="19" ry="14" fill="${v.muzzle}"/>
      <!-- Amber Eyes -->
      <ellipse cx="36" cy="49" rx="4.5" ry="5" fill="#ca8a04"/>
      <circle cx="37.5" cy="47.5" r="1.6" fill="#ffffff"/>
      <circle cx="36" cy="49" r="2.5" fill="#18181b"/>
      <ellipse cx="64" cy="49" rx="4.5" ry="5" fill="#ca8a04"/>
      <circle cx="65.5" cy="47.5" r="1.6" fill="#ffffff"/>
      <circle cx="64" cy="49" r="2.5" fill="#18181b"/>
      <!-- Nose & Mouth -->
      <polygon points="45,61 55,61 50,66" fill="#f43f5e"/>
      <path d="M46,68 Q50,72 54,68" stroke="#18181b" stroke-width="2" fill="none" stroke-linecap="round"/>
      <ellipse cx="28" cy="62" rx="4.5" ry="3" fill="#fb7185" opacity="0.6"/>
      <ellipse cx="72" cy="62" rx="4.5" ry="3" fill="#fb7185" opacity="0.6"/>
    `
  },
  {
    species: 'penguin',
    korean: '펭귄',
    variants: [
      { name: '황제펭귄', base: '#0f172a', belly: '#ffffff', beak: '#f59e0b', cheek: '#fef08a' },
      { name: '아델리펭귄', base: '#1e293b', belly: '#f8fafc', beak: '#ea580c', cheek: '#fb7185' },
      { name: '요정펭귄', base: '#0284c7', belly: '#ffffff', beak: '#facc15', cheek: '#fda4af' },
      { name: '분홍펭귄', base: '#be185d', belly: '#fdf2f8', beak: '#f59e0b', cheek: '#f472b6' },
      { name: '아기펭귄', base: '#64748b', belly: '#ffffff', beak: '#f97316', cheek: '#fda4af' },
    ],
    drawHead: (v, bg, acc) => `
      <!-- Head -->
      <circle cx="50" cy="54" r="33" fill="${v.base}"/>
      <!-- White Belly & Face Heart -->
      <path d="M30,50 Q50,32 70,50 Q75,82 50,85 Q25,82 30,50 Z" fill="${v.belly}"/>
      <!-- Big Round Eyes -->
      <circle cx="38" cy="49" r="4.5" fill="#0f172a"/>
      <circle cx="39.5" cy="47.5" r="1.6" fill="#ffffff"/>
      <circle cx="62" cy="49" r="4.5" fill="#0f172a"/>
      <circle cx="63.5" cy="47.5" r="1.6" fill="#ffffff"/>
      <!-- Beak -->
      <polygon points="46,58 54,58 50,67" fill="${v.beak}"/>
      <!-- Cheeks -->
      <circle cx="28" cy="58" r="4.5" fill="${v.cheek}" opacity="0.7"/>
      <circle cx="72" cy="58" r="4.5" fill="${v.cheek}" opacity="0.7"/>
    `
  },
  {
    species: 'koala',
    korean: '코알라',
    variants: [
      { name: '유칼리코알라', base: '#94a3b8', earInner: '#ffffff', nose: '#1e293b' },
      { name: '잿빛코알라', base: '#64748b', earInner: '#f1f5f9', nose: '#0f172a' },
      { name: '베이지코알라', base: '#d6d3d1', earInner: '#fafaf9', nose: '#44403c' },
      { name: '블루코알라', base: '#cbd5e1', earInner: '#ffffff', nose: '#334155' },
      { name: '솜사탕코알라', base: '#e2e8f0', earInner: '#fce7f3', nose: '#1e293b' },
    ],
    drawHead: (v, bg, acc) => `
      <!-- Big Fluffy Ears -->
      <circle cx="22" cy="38" r="16" fill="${v.base}"/>
      <circle cx="22" cy="38" r="10" fill="${v.earInner}"/>
      <circle cx="78" cy="38" r="16" fill="${v.base}"/>
      <circle cx="78" cy="38" r="10" fill="${v.earInner}"/>
      <!-- Head -->
      <circle cx="50" cy="55" r="32" fill="${v.base}"/>
      <!-- Eyes -->
      <circle cx="36" cy="48" r="4" fill="#0f172a"/>
      <circle cx="37.5" cy="46.5" r="1.5" fill="#ffffff"/>
      <circle cx="64" cy="48" r="4" fill="#0f172a"/>
      <circle cx="65.5" cy="46.5" r="1.5" fill="#ffffff"/>
      <!-- Giant Iconic Koala Nose -->
      <ellipse cx="50" cy="60" rx="8" ry="12" fill="${v.nose}"/>
      <ellipse cx="48" cy="56" rx="2" ry="3" fill="#ffffff" opacity="0.3"/>
      <!-- Mouth -->
      <path d="M46,74 Q50,77 54,74" stroke="#0f172a" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <ellipse cx="28" cy="60" rx="4.5" ry="3" fill="#fb7185" opacity="0.6"/>
      <ellipse cx="72" cy="60" rx="4.5" ry="3" fill="#fb7185" opacity="0.6"/>
    `
  },
  {
    species: 'otter',
    korean: '수달',
    variants: [
      { name: '해달', base: '#78350f', muzzle: '#fed7aa', ear: '#451a03' },
      { name: '강수달', base: '#9a3412', muzzle: '#ffedd5', ear: '#7c2d12' },
      { name: '황금수달', base: '#ca8a04', muzzle: '#fef3c7', ear: '#854d0e' },
      { name: '초코수달', base: '#571c0c', muzzle: '#fed7aa', ear: '#3f1208' },
      { name: '밀크수달', base: '#a8a29e', muzzle: '#f5f5f4', ear: '#78716c' },
    ],
    drawHead: (v, bg, acc) => `
      <!-- Tiny Ears -->
      <ellipse cx="24" cy="40" rx="7" ry="6" fill="${v.ear}"/>
      <ellipse cx="76" cy="40" rx="7" ry="6" fill="${v.ear}"/>
      <!-- Head -->
      <ellipse cx="50" cy="54" rx="32" ry="28" fill="${v.base}"/>
      <!-- Muzzle -->
      <ellipse cx="50" cy="63" rx="19" ry="14" fill="${v.muzzle}"/>
      <!-- Eyes -->
      <circle cx="37" cy="48" r="4" fill="#0f172a"/>
      <circle cx="38.5" cy="46.5" r="1.5" fill="#ffffff"/>
      <circle cx="63" cy="48" r="4" fill="#0f172a"/>
      <circle cx="64.5" cy="46.5" r="1.5" fill="#ffffff"/>
      <!-- Nose & Mouth -->
      <ellipse cx="50" cy="59" rx="5" ry="3.5" fill="#0f172a"/>
      <path d="M46,65 Q50,69 54,65" stroke="#0f172a" stroke-width="2" fill="none" stroke-linecap="round"/>
      <!-- Whiskers -->
      <line x1="22" y1="62" x2="36" y2="63" stroke="#78716c" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="78" y1="62" x2="64" y2="63" stroke="#78716c" stroke-width="1.5" stroke-linecap="round"/>
      <ellipse cx="28" cy="59" rx="4.5" ry="3" fill="#fb7185" opacity="0.6"/>
      <ellipse cx="72" cy="59" rx="4.5" ry="3" fill="#fb7185" opacity="0.6"/>
    `
  },
];

// Accessories (10 distinct accessories / effects)
const ACCESSORIES = [
  { id: 'sparkle', draw: '<circle cx="20" cy="20" r="2" fill="#ffffff"/><circle cx="80" cy="22" r="2.5" fill="#ffffff"/><path d="M22,14 L24,18 L28,20 L24,22 L22,26 L20,22 L16,20 L20,18 Z" fill="#fef08a"/>' },
  { id: 'heart', draw: '<path d="M78,16 A3.5,3.5 0 0,0 72,20 A3.5,3.5 0 0,0 66,16 A3.5,3.5 0 0,0 63,22 Q63,27 72,32 Q81,27 81,22 A3.5,3.5 0 0,0 78,16 Z" fill="#f43f5e"/>' },
  { id: 'glasses', draw: '<circle cx="37" cy="49" r="8" stroke="#d97706" stroke-width="2" fill="none"/><circle cx="63" cy="49" r="8" stroke="#d97706" stroke-width="2" fill="none"/><line x1="45" y1="49" x2="55" y2="49" stroke="#d97706" stroke-width="2"/>' },
  { id: 'ribbon', draw: '<polygon points="43,24 50,29 43,34" fill="#ec4899"/><polygon points="57,24 50,29 57,34" fill="#ec4899"/><circle cx="50" cy="29" r="3" fill="#f43f5e"/>' },
  { id: 'bowtie', draw: '<polygon points="44,80 50,84 44,88" fill="#3b82f6"/><polygon points="56,80 50,84 56,88" fill="#3b82f6"/><circle cx="50" cy="84" r="2.5" fill="#1d4ed8"/>' },
  { id: 'leaf', draw: '<path d="M50,18 Q58,12 60,20 Q56,26 50,24 Q48,20 50,18 Z" fill="#22c55e"/><path d="M50,24 L54,18" stroke="#15803d" stroke-width="1"/>' },
  { id: 'flower', draw: '<circle cx="74" cy="24" r="4" fill="#fb7185"/><circle cx="70" cy="21" r="3" fill="#fda4af"/><circle cx="78" cy="21" r="3" fill="#fda4af"/><circle cx="70" cy="27" r="3" fill="#fda4af"/><circle cx="78" cy="27" r="3" fill="#fda4af"/><circle cx="74" cy="24" r="2" fill="#fef08a"/>' },
  { id: 'star', draw: '<polygon points="76,14 78,19 83,19 79,22 81,27 76,24 72,27 74,22 70,19 75,19" fill="#facc15"/>' },
  { id: 'music', draw: '<circle cx="74" cy="22" r="3" fill="#8b5cf6"/><circle cx="82" cy="18" r="3" fill="#8b5cf6"/><path d="M77,22 L77,14 L85,10 L85,18" stroke="#8b5cf6" stroke-width="2" fill="none"/>' },
  { id: 'crown', draw: '<polygon points="40,24 44,28 50,22 56,28 60,24 58,31 42,31" fill="#facc15" stroke="#ca8a04" stroke-width="1"/>' },
];

console.log('Generating 500+ animal profile avatar SVGs...');

const avatarMetadata = [];
let totalGenerated = 0;

// 15 species. Each will have 35 unique variations = 525 SVGs total.
for (const animal of ANIMALS) {
  let countForSpecies = 0;
  for (let vIdx = 0; vIdx < animal.variants.length; vIdx++) {
    const variant = animal.variants[vIdx];

    for (let bIdx = 0; bIdx < BG_PALETTES.length; bIdx++) {
      if (countForSpecies >= 35) break; // 35 per species = 525 total
      countForSpecies++;
      totalGenerated++;

      const bg = BG_PALETTES[bIdx];
      const acc = ACCESSORIES[(bIdx + vIdx) % ACCESSORIES.length];
      const id = `${animal.species}_${countForSpecies}`;
      const name = `${variant.name} ${countForSpecies}`;

      const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <defs>
    <linearGradient id="bg_${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg.start}"/>
      <stop offset="100%" stop-color="${bg.end}"/>
    </linearGradient>
  </defs>
  <circle cx="50" cy="50" r="48" fill="url(#bg_${id})"/>
  ${animal.drawHead(variant, bg, acc)}
  ${acc.draw}
</svg>`.trim();

      const fileName = `${id}.svg`;
      const filePath = path.join(OUTPUT_DIR, fileName);
      fs.writeFileSync(filePath, svgContent, 'utf8');

      avatarMetadata.push({
        id,
        fileName,
        url: `/assets/profiles/${fileName}`,
        species: animal.species,
        koreanSpecies: animal.korean,
        name,
        bgTheme: bg.id,
        accessory: acc.id,
      });
    }
  }
}

console.log(`Successfully created ${totalGenerated} ultra-lightweight SVG avatars in public/assets/profiles!`);

// Save metadata file for frontend indexing
const metaPath = path.join(process.cwd(), 'src', 'data', 'animalAvatars.json');
fs.mkdirSync(path.dirname(metaPath), { recursive: true });
fs.writeFileSync(metaPath, JSON.stringify(avatarMetadata, null, 2), 'utf8');
console.log(`Saved metadata to ${metaPath}`);
