import React from 'react';

// Ultra-lightweight, high-quality SVG Avatars for Dogs (Male) and Cats (Female)
// Each avatar is vectorized, crisp at all resolutions, and less than 1KB in size.

export interface AvatarItem {
  id: string;
  name: string;
  gender: 'male' | 'female';
  dataUri: string;
  svgContent: string;
}

// 5 Distinct Cute Dog Avatars for Males
export const DOG_AVATARS: AvatarItem[] = [
  {
    id: 'dog_1',
    name: '시바견 댕댕이',
    gender: 'male',
    svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <defs>
        <linearGradient id="bg_dog1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#fed7aa"/>
          <stop offset="100%" stop-color="#fdba74"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#bg_dog1)"/>
      <!-- Ears -->
      <polygon points="25,45 15,15 45,30" fill="#c2410c"/>
      <polygon points="28,40 22,22 40,32" fill="#fed7aa"/>
      <polygon points="75,45 85,15 55,30" fill="#c2410c"/>
      <polygon points="72,40 78,22 60,32" fill="#fed7aa"/>
      <!-- Face -->
      <ellipse cx="50" cy="56" rx="34" ry="30" fill="#ea580c"/>
      <!-- White muzzle -->
      <ellipse cx="50" cy="64" rx="20" ry="16" fill="#fff7ed"/>
      <ellipse cx="38" cy="46" rx="8" ry="8" fill="#fff7ed" opacity="0.6"/>
      <ellipse cx="62" cy="46" rx="8" ry="8" fill="#fff7ed" opacity="0.6"/>
      <!-- Eyes -->
      <ellipse cx="38" cy="50" rx="4" ry="4.5" fill="#1c1917"/>
      <circle cx="39.5" cy="48.5" r="1.5" fill="#ffffff"/>
      <ellipse cx="62" cy="50" rx="4" ry="4.5" fill="#1c1917"/>
      <circle cx="63.5" cy="48.5" r="1.5" fill="#ffffff"/>
      <!-- Nose & Mouth -->
      <ellipse cx="50" cy="62" rx="4.5" ry="3" fill="#1c1917"/>
      <path d="M46,67 Q50,71 54,67" stroke="#1c1917" stroke-width="2" fill="none" stroke-linecap="round"/>
      <!-- Cheeks -->
      <ellipse cx="30" cy="60" rx="5" ry="3" fill="#fb7185" opacity="0.6"/>
      <ellipse cx="70" cy="60" rx="5" ry="3" fill="#fb7185" opacity="0.6"/>
    </svg>`,
    dataUri: '',
  },
  {
    id: 'dog_2',
    name: '골든리트리버 댕댕이',
    gender: 'male',
    svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <defs>
        <linearGradient id="bg_dog2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#fef08a"/>
          <stop offset="100%" stop-color="#fde047"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#bg_dog2)"/>
      <!-- Floppy Ears -->
      <ellipse cx="18" cy="50" rx="10" ry="20" fill="#ca8a04" transform="rotate(15 18 50)"/>
      <ellipse cx="82" cy="50" rx="10" ry="20" fill="#ca8a04" transform="rotate(-15 82 50)"/>
      <!-- Head -->
      <circle cx="50" cy="52" r="32" fill="#eab308"/>
      <!-- Muzzle -->
      <ellipse cx="50" cy="62" rx="18" ry="14" fill="#fef9c3"/>
      <!-- Eyes -->
      <circle cx="37" cy="48" r="4" fill="#1c1917"/>
      <circle cx="38.5" cy="46.5" r="1.5" fill="#ffffff"/>
      <circle cx="63" cy="48" r="4" fill="#1c1917"/>
      <circle cx="64.5" cy="46.5" r="1.5" fill="#ffffff"/>
      <!-- Nose & Mouth & Tongue -->
      <ellipse cx="50" cy="59" rx="5" ry="3.5" fill="#1c1917"/>
      <path d="M46,65 Q50,69 54,65" stroke="#1c1917" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M48,67 Q50,76 52,67 Z" fill="#f43f5e"/>
      <ellipse cx="28" cy="56" rx="4" ry="2.5" fill="#fb7185" opacity="0.6"/>
      <ellipse cx="72" cy="56" rx="4" ry="2.5" fill="#fb7185" opacity="0.6"/>
    </svg>`,
    dataUri: '',
  },
  {
    id: 'dog_3',
    name: '허스키 댕댕이',
    gender: 'male',
    svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <defs>
        <linearGradient id="bg_dog3" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#e0e7ff"/>
          <stop offset="100%" stop-color="#c7d2fe"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#bg_dog3)"/>
      <!-- Pointy Ears -->
      <polygon points="26,45 18,14 46,30" fill="#334155"/>
      <polygon points="28,40 23,22 41,32" fill="#cbd5e1"/>
      <polygon points="74,45 82,14 54,30" fill="#334155"/>
      <polygon points="72,40 77,22 59,32" fill="#cbd5e1"/>
      <!-- Head Mask -->
      <circle cx="50" cy="54" r="32" fill="#475569"/>
      <polygon points="50,30 38,48 50,44 62,48" fill="#f8fafc"/>
      <!-- Face White -->
      <path d="M30,55 Q50,38 70,55 Q72,82 50,84 Q28,82 30,55 Z" fill="#f8fafc"/>
      <!-- Cool Blue Eyes -->
      <ellipse cx="38" cy="51" rx="4" ry="4.5" fill="#0284c7"/>
      <circle cx="39.5" cy="49.5" r="1.5" fill="#ffffff"/>
      <ellipse cx="62" cy="51" rx="4" ry="4.5" fill="#0284c7"/>
      <circle cx="63.5" cy="49.5" r="1.5" fill="#ffffff"/>
      <!-- Nose & Mouth -->
      <polygon points="46,60 54,60 50,65" fill="#0f172a"/>
      <path d="M46,67 Q50,71 54,67" stroke="#0f172a" stroke-width="2" fill="none" stroke-linecap="round"/>
    </svg>`,
    dataUri: '',
  },
  {
    id: 'dog_4',
    name: '비숑 댕댕이',
    gender: 'male',
    svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <defs>
        <linearGradient id="bg_dog4" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#bae6fd"/>
          <stop offset="100%" stop-color="#7dd3fc"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#bg_dog4)"/>
      <!-- Fluffy Cloud Head -->
      <circle cx="30" cy="40" r="16" fill="#ffffff"/>
      <circle cx="70" cy="40" r="16" fill="#ffffff"/>
      <circle cx="30" cy="65" r="16" fill="#ffffff"/>
      <circle cx="70" cy="65" r="16" fill="#ffffff"/>
      <circle cx="50" cy="32" r="16" fill="#ffffff"/>
      <circle cx="50" cy="52" r="28" fill="#ffffff"/>
      <!-- Big Black Eyes -->
      <circle cx="38" cy="48" r="4.5" fill="#09090b"/>
      <circle cx="39.5" cy="46.5" r="1.8" fill="#ffffff"/>
      <circle cx="62" cy="48" r="4.5" fill="#09090b"/>
      <circle cx="63.5" cy="46.5" r="1.8" fill="#ffffff"/>
      <!-- Shiny Nose & Mouth -->
      <ellipse cx="50" cy="56" rx="5" ry="4" fill="#09090b"/>
      <circle cx="51.5" cy="54.5" r="1.2" fill="#ffffff"/>
      <path d="M46,62 Q50,66 54,62" stroke="#09090b" stroke-width="2" fill="none" stroke-linecap="round"/>
      <!-- Pink Blushes -->
      <ellipse cx="28" cy="55" rx="5" ry="3.5" fill="#fda4af" opacity="0.8"/>
      <ellipse cx="72" cy="55" rx="5" ry="3.5" fill="#fda4af" opacity="0.8"/>
    </svg>`,
    dataUri: '',
  },
  {
    id: 'dog_5',
    name: '웰시코기 댕댕이',
    gender: 'male',
    svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <defs>
        <linearGradient id="bg_dog5" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#bbf7d0"/>
          <stop offset="100%" stop-color="#86efac"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#bg_dog5)"/>
      <!-- Big Corgi Ears -->
      <polygon points="20,42 10,10 40,24" fill="#d97706"/>
      <polygon points="23,38 16,18 36,27" fill="#fef3c7"/>
      <polygon points="80,42 90,10 60,24" fill="#d97706"/>
      <polygon points="77,38 84,18 64,27" fill="#fef3c7"/>
      <!-- Face -->
      <circle cx="50" cy="55" r="32" fill="#d97706"/>
      <!-- White Stripe -->
      <polygon points="50,30 45,55 55,55" fill="#ffffff"/>
      <ellipse cx="50" cy="65" rx="20" ry="14" fill="#ffffff"/>
      <!-- Eyes -->
      <circle cx="36" cy="50" r="4" fill="#1c1917"/>
      <circle cx="37.5" cy="48.5" r="1.5" fill="#ffffff"/>
      <circle cx="64" cy="50" r="4" fill="#1c1917"/>
      <circle cx="65.5" cy="48.5" r="1.5" fill="#ffffff"/>
      <!-- Nose & Smile -->
      <ellipse cx="50" cy="62" rx="4.5" ry="3" fill="#1c1917"/>
      <path d="M46,67 Q50,71 54,67" stroke="#1c1917" stroke-width="2" fill="none" stroke-linecap="round"/>
      <ellipse cx="28" cy="60" rx="4.5" ry="2.5" fill="#fb7185" opacity="0.6"/>
      <ellipse cx="72" cy="60" rx="4.5" ry="2.5" fill="#fb7185" opacity="0.6"/>
    </svg>`,
    dataUri: '',
  },
];

// 5 Distinct Cute Cat Avatars for Females
export const CAT_AVATARS: AvatarItem[] = [
  {
    id: 'cat_1',
    name: '치즈태비 냥이',
    gender: 'female',
    svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <defs>
        <linearGradient id="bg_cat1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#fecdd3"/>
          <stop offset="100%" stop-color="#fda4af"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#bg_cat1)"/>
      <!-- Cat Ears -->
      <polygon points="22,42 16,16 42,28" fill="#f59e0b"/>
      <polygon points="24,38 20,22 38,30" fill="#fecdd3"/>
      <polygon points="78,42 84,16 58,28" fill="#f59e0b"/>
      <polygon points="76,38 80,22 62,30" fill="#fecdd3"/>
      <!-- Face -->
      <circle cx="50" cy="54" r="32" fill="#fbbf24"/>
      <!-- Tabby Stripes -->
      <path d="M46,26 L50,34 L54,26" stroke="#d97706" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <path d="M38,32 L44,38" stroke="#d97706" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M62,32 L56,38" stroke="#d97706" stroke-width="2" fill="none" stroke-linecap="round"/>
      <!-- Muzzle -->
      <ellipse cx="50" cy="65" rx="16" ry="12" fill="#fffbeb"/>
      <!-- Big Sparkling Green/Gold Eyes -->
      <ellipse cx="37" cy="49" rx="5" ry="5.5" fill="#10b981"/>
      <ellipse cx="37" cy="49" rx="2.5" ry="4.5" fill="#064e3b"/>
      <circle cx="39" cy="47" r="1.8" fill="#ffffff"/>
      <ellipse cx="63" cy="49" rx="5" ry="5.5" fill="#10b981"/>
      <ellipse cx="63" cy="49" rx="2.5" ry="4.5" fill="#064e3b"/>
      <circle cx="65" cy="47" r="1.8" fill="#ffffff"/>
      <!-- Nose & Mouth -->
      <polygon points="48,60 52,60 50,63" fill="#f43f5e"/>
      <path d="M46,65 Q50,68 54,65" stroke="#78350f" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <!-- Whiskers -->
      <line x1="22" y1="59" x2="36" y2="61" stroke="#78350f" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="22" y1="65" x2="36" y2="64" stroke="#78350f" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="78" y1="59" x2="64" y2="61" stroke="#78350f" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="78" y1="65" x2="64" y2="64" stroke="#78350f" stroke-width="1.5" stroke-linecap="round"/>
      <!-- Cheeks -->
      <ellipse cx="28" cy="57" rx="4.5" ry="3" fill="#fb7185" opacity="0.6"/>
      <ellipse cx="72" cy="57" rx="4.5" ry="3" fill="#fb7185" opacity="0.6"/>
    </svg>`,
    dataUri: '',
  },
  {
    id: 'cat_2',
    name: '터키시앙고라 백묘 냥이',
    gender: 'female',
    svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <defs>
        <linearGradient id="bg_cat2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ddd6fe"/>
          <stop offset="100%" stop-color="#c4b5fd"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#bg_cat2)"/>
      <!-- Ears -->
      <polygon points="22,42 16,14 42,26" fill="#ffffff"/>
      <polygon points="24,38 20,20 38,28" fill="#fda4af"/>
      <polygon points="78,42 84,14 58,26" fill="#ffffff"/>
      <polygon points="76,38 80,20 62,28" fill="#fda4af"/>
      <!-- Pure White Head -->
      <circle cx="50" cy="54" r="32" fill="#ffffff"/>
      <!-- Odd Eyes (Blue & Yellow/Amber) -->
      <ellipse cx="37" cy="49" rx="5" ry="5.5" fill="#0284c7"/>
      <circle cx="38.5" cy="47" r="1.8" fill="#ffffff"/>
      <ellipse cx="63" cy="49" rx="5" ry="5.5" fill="#f59e0b"/>
      <circle cx="64.5" cy="47" r="1.8" fill="#ffffff"/>
      <!-- Little Pink Nose & Smile -->
      <polygon points="48,59 52,59 50,62" fill="#fb7185"/>
      <path d="M46,64 Q50,67 54,64" stroke="#475569" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <!-- Cute Bow on Head -->
      <polygon points="42,28 50,33 42,38" fill="#ec4899"/>
      <polygon points="58,28 50,33 58,38" fill="#ec4899"/>
      <circle cx="50" cy="33" r="3" fill="#f43f5e"/>
      <!-- Whiskers -->
      <line x1="22" y1="58" x2="35" y2="60" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="22" y1="64" x2="35" y2="63" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="78" y1="58" x2="65" y2="60" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="78" y1="64" x2="65" y2="63" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/>
      <!-- Cheeks -->
      <ellipse cx="28" cy="56" rx="4.5" ry="3" fill="#f472b6" opacity="0.5"/>
      <ellipse cx="72" cy="56" rx="4.5" ry="3" fill="#f472b6" opacity="0.5"/>
    </svg>`,
    dataUri: '',
  },
  {
    id: 'cat_3',
    name: '러시안블루 회색 냥이',
    gender: 'female',
    svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <defs>
        <linearGradient id="bg_cat3" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#e0f2fe"/>
          <stop offset="100%" stop-color="#bae6fd"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#bg_cat3)"/>
      <!-- Ears -->
      <polygon points="22,42 16,14 42,26" fill="#64748b"/>
      <polygon points="24,38 20,20 38,28" fill="#cbd5e1"/>
      <polygon points="78,42 84,14 58,26" fill="#64748b"/>
      <polygon points="76,38 80,20 62,28" fill="#cbd5e1"/>
      <!-- Sleek Grey Head -->
      <circle cx="50" cy="54" r="32" fill="#94a3b8"/>
      <!-- Emerald Green Eyes -->
      <ellipse cx="37" cy="49" rx="5" ry="5.5" fill="#10b981"/>
      <ellipse cx="37" cy="49" rx="2" ry="4" fill="#047857"/>
      <circle cx="39" cy="47" r="1.8" fill="#ffffff"/>
      <ellipse cx="63" cy="49" rx="5" ry="5.5" fill="#10b981"/>
      <ellipse cx="63" cy="49" rx="2" ry="4" fill="#047857"/>
      <circle cx="65" cy="47" r="1.8" fill="#ffffff"/>
      <!-- Nose & Mouth -->
      <polygon points="48,59 52,59 50,62" fill="#475569"/>
      <path d="M46,64 Q50,67 54,64" stroke="#334155" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <!-- Whiskers -->
      <line x1="22" y1="58" x2="35" y2="60" stroke="#475569" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="22" y1="64" x2="35" y2="63" stroke="#475569" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="78" y1="58" x2="65" y2="60" stroke="#475569" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="78" y1="64" x2="65" y2="63" stroke="#475569" stroke-width="1.5" stroke-linecap="round"/>
      <ellipse cx="28" cy="56" rx="4.5" ry="3" fill="#fb7185" opacity="0.6"/>
      <ellipse cx="72" cy="56" rx="4.5" ry="3" fill="#fb7185" opacity="0.6"/>
    </svg>`,
    dataUri: '',
  },
  {
    id: 'cat_4',
    name: '삼색이 냥이',
    gender: 'female',
    svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <defs>
        <linearGradient id="bg_cat4" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#fed7aa"/>
          <stop offset="100%" stop-color="#fdba74"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#bg_cat4)"/>
      <!-- Ears: Left Black, Right Orange -->
      <polygon points="22,42 16,14 42,26" fill="#1e293b"/>
      <polygon points="24,38 20,20 38,28" fill="#fda4af"/>
      <polygon points="78,42 84,14 58,26" fill="#ea580c"/>
      <polygon points="76,38 80,20 62,28" fill="#fed7aa"/>
      <!-- Calico Head Base -->
      <circle cx="50" cy="54" r="32" fill="#ffffff"/>
      <!-- Patches -->
      <path d="M22,45 Q35,30 45,40 L35,58 Z" fill="#1e293b"/>
      <path d="M78,45 Q65,30 55,40 L65,58 Z" fill="#ea580c"/>
      <!-- Big Sparkling Amber Eyes -->
      <ellipse cx="37" cy="49" rx="5" ry="5.5" fill="#f59e0b"/>
      <circle cx="39" cy="47" r="1.8" fill="#ffffff"/>
      <ellipse cx="63" cy="49" rx="5" ry="5.5" fill="#f59e0b"/>
      <circle cx="65" cy="47" r="1.8" fill="#ffffff"/>
      <!-- Nose & Mouth -->
      <polygon points="48,59 52,59 50,62" fill="#f43f5e"/>
      <path d="M46,64 Q50,67 54,64" stroke="#1e293b" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <!-- Whiskers -->
      <line x1="22" y1="58" x2="35" y2="60" stroke="#64748b" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="22" y1="64" x2="35" y2="63" stroke="#64748b" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="78" y1="58" x2="65" y2="60" stroke="#64748b" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="78" y1="64" x2="65" y2="63" stroke="#64748b" stroke-width="1.5" stroke-linecap="round"/>
      <ellipse cx="28" cy="57" rx="4.5" ry="3" fill="#fb7185" opacity="0.6"/>
      <ellipse cx="72" cy="57" rx="4.5" ry="3" fill="#fb7185" opacity="0.6"/>
    </svg>`,
    dataUri: '',
  },
  {
    id: 'cat_5',
    name: '턱시도 냥이',
    gender: 'female',
    svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <defs>
        <linearGradient id="bg_cat5" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#fef08a"/>
          <stop offset="100%" stop-color="#fde047"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#bg_cat5)"/>
      <!-- Black Ears -->
      <polygon points="22,42 16,14 42,26" fill="#0f172a"/>
      <polygon points="24,38 20,20 38,28" fill="#fda4af"/>
      <polygon points="78,42 84,14 58,26" fill="#0f172a"/>
      <polygon points="76,38 80,20 62,28" fill="#fda4af"/>
      <!-- Tuxedo Head (Black with White V) -->
      <circle cx="50" cy="54" r="32" fill="#0f172a"/>
      <polygon points="50,42 34,75 66,75" fill="#ffffff"/>
      <!-- Big Golden Eyes -->
      <ellipse cx="37" cy="49" rx="5" ry="5.5" fill="#eab308"/>
      <ellipse cx="37" cy="49" rx="2" ry="4" fill="#713f12"/>
      <circle cx="39" cy="47" r="1.8" fill="#ffffff"/>
      <ellipse cx="63" cy="49" rx="5" ry="5.5" fill="#eab308"/>
      <ellipse cx="63" cy="49" rx="2" ry="4" fill="#713f12"/>
      <circle cx="65" cy="47" r="1.8" fill="#ffffff"/>
      <!-- Nose & Mouth -->
      <polygon points="48,59 52,59 50,62" fill="#f43f5e"/>
      <path d="M46,64 Q50,67 54,64" stroke="#0f172a" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <!-- Whiskers -->
      <line x1="22" y1="58" x2="35" y2="60" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="22" y1="64" x2="35" y2="63" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="78" y1="58" x2="65" y2="60" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="78" y1="64" x2="65" y2="63" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
      <ellipse cx="28" cy="57" rx="4.5" ry="3" fill="#fb7185" opacity="0.6"/>
      <ellipse cx="72" cy="57" rx="4.5" ry="3" fill="#fb7185" opacity="0.6"/>
    </svg>`,
    dataUri: '',
  },
];

// Helper to convert SVG text to RFC 3986 URL encoded Data-URI
function svgToDataUri(svg: string): string {
  const cleanSvg = svg.replace(/\s+/g, ' ').trim();
  return `data:image/svg+xml;utf8,${encodeURIComponent(cleanSvg)}`;
}

// Populate Data URIs
DOG_AVATARS.forEach((a) => {
  a.dataUri = svgToDataUri(a.svgContent);
});

CAT_AVATARS.forEach((a) => {
  a.dataUri = svgToDataUri(a.svgContent);
});

// Import comprehensive 500+ Animal Avatar Library
import rawAnimalAvatars from '../data/animalAvatars.json';

export interface AnimalAvatarMeta {
  id: string;
  fileName: string;
  url: string;
  species: string;
  koreanSpecies: string;
  name: string;
  bgTheme: string;
  accessory: string;
}

export const ANIMAL_AVATARS: AnimalAvatarMeta[] = rawAnimalAvatars as AnimalAvatarMeta[];

export const SPECIES_CATEGORIES = [
  { id: 'all', name: '전체 (525종)', icon: '🐾' },
  { id: 'fox', name: '여우', icon: '🦊' },
  { id: 'bear', name: '곰', icon: '🐻' },
  { id: 'wolf', name: '늑대', icon: '🐺' },
  { id: 'giraffe', name: '기린', icon: '🦒' },
  { id: 'rabbit', name: '토끼', icon: '🐰' },
  { id: 'dog', name: '강아지', icon: '🐶' },
  { id: 'cat', name: '고양이', icon: '🐱' },
  { id: 'panda', name: '판다', icon: '🐼' },
  { id: 'deer', name: '사슴', icon: '🦌' },
  { id: 'squirrel', name: '다람쥐', icon: '🐿️' },
  { id: 'hamster', name: '햄스터', icon: '🐹' },
  { id: 'tiger', name: '호랑이', icon: '🐯' },
  { id: 'penguin', name: '펭귄', icon: '🐧' },
  { id: 'koala', name: '코알라', icon: '🐨' },
  { id: 'otter', name: '수달', icon: '🦦' },
];

/**
 * Filter animal avatars by species or search keyword
 */
export function filterAvatars(species = 'all', query = ''): AnimalAvatarMeta[] {
  let list = ANIMAL_AVATARS;
  if (species && species !== 'all') {
    list = list.filter((a) => a.species === species);
  }
  if (query.trim()) {
    const q = query.toLowerCase().trim();
    list = list.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.koreanSpecies.includes(q) ||
        a.id.includes(q)
    );
  }
  return list;
}

/**
 * Get random animal avatar from library
 */
export function getRandomAnimalAvatar(species?: string): AnimalAvatarMeta {
  const pool = species && species !== 'all' ? filterAvatars(species) : ANIMAL_AVATARS;
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx] || ANIMAL_AVATARS[0];
}

/**
 * Get guaranteed valid, ultra-lightweight avatar for user from 500+ rich animal avatars
 * Falls back consistently according to user seed.
 */
export function getAvatarForUser(gender: 'male' | 'female' | string, seed: string | number = 0): string {
  let num = 0;
  if (typeof seed === 'number') {
    num = Math.abs(seed);
  } else if (typeof seed === 'string') {
    for (let i = 0; i < seed.length; i++) {
      num = (num << 5) - num + seed.charCodeAt(i);
      num |= 0;
    }
    num = Math.abs(num);
  }

  if (ANIMAL_AVATARS && ANIMAL_AVATARS.length > 0) {
    const selected = ANIMAL_AVATARS[num % ANIMAL_AVATARS.length];
    if (selected) {
      return selected.url;
    }
  }

  const isFemale = gender === 'female' || gender === 'woman';
  const fallbackList = isFemale ? CAT_AVATARS : DOG_AVATARS;
  const avatar = fallbackList[num % fallbackList.length];
  return avatar ? avatar.dataUri : fallbackList[0].dataUri;
}

/**
 * Safe image fallback resolver on <img> onError
 */
export function handleAvatarError(
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  gender: 'male' | 'female' | string = 'male',
  seed: string | number = 0
): void {
  const target = e.currentTarget;
  const safeUri = getAvatarForUser(gender, seed);
  if (target.src !== safeUri) {
    target.src = safeUri;
  }
}

