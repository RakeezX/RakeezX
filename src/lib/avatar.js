/**
 * RAKEEZ X — Student Avatars (Recovery B / RB-01)
 *
 * 100% Offline-first, deterministic, cartoon-style masculine student avatars.
 * - License: CC0 1.0 (Public Domain Dedication)
 * - Zero external network calls (no api.dicebear.com or third-party requests)
 * - Neutral greyscale / monochrome cartoon line art (no skin-tone classification or differentiation)
 * - Deterministic hash mapping from student.id -> consistent avatar across all screens & reloads
 * - Initials fallback support
 */

import { raw, esc } from './dom.js';

/** Deterministic string hash (djb2) */
export function hashStudentId(id) {
  const str = String(id ?? '');
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Extracts first meaningful Arabic letter for fallback initials */
export function studentInitial(name) {
  const clean = String(name ?? '').trim().replace(/^[\d٠-٩\s\-.)،:]+/, '');
  return clean ? clean.charAt(0) : 'ط';
}

/**
 * 16 distinct cartoon student avatar vector paths (viewBox: 0 0 64 64).
 * Clean, charming, boy/male student representations in greyscale line art.
 */
const AVATAR_SVGS = [
  // 0: Short neat hair, friendly smile
  (bg) => `
    <rect width="64" height="64" rx="32" fill="${bg}"/>
    <!-- Shirt -->
    <path d="M18 58c2-9 8-13 14-13s12 4 14 13" fill="#cbd5e1" stroke="#334155" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M28 45l4 6 4-6" fill="#94a3b8" stroke="#334155" stroke-width="2"/>
    <!-- Head & Neck -->
    <path d="M28 41v5h8v-5" fill="#f8fafc" stroke="#334155" stroke-width="2.2"/>
    <circle cx="32" cy="30" r="14" fill="#f8fafc" stroke="#334155" stroke-width="2.5"/>
    <!-- Hair -->
    <path d="M18 28c0-8 6-14 14-14s14 6 14 14c-4-3-9-4-14-3-5 1-10 0-14 3z" fill="#475569" stroke="#334155" stroke-width="2" stroke-linejoin="round"/>
    <path d="M22 17c3-2 8-3 12-2" stroke="#64748b" stroke-width="1.8" stroke-linecap="round" fill="none"/>
    <!-- Ears -->
    <circle cx="18" cy="31" r="2.8" fill="#f8fafc" stroke="#334155" stroke-width="2"/>
    <circle cx="46" cy="31" r="2.8" fill="#f8fafc" stroke="#334155" stroke-width="2"/>
    <!-- Eyes & Brows -->
    <circle cx="27" cy="29" r="1.8" fill="#1e293b"/>
    <circle cx="37" cy="29" r="1.8" fill="#1e293b"/>
    <path d="M24.5 25.5c1.5-.8 3.5-.8 5 0" stroke="#334155" stroke-width="1.6" stroke-linecap="round" fill="none"/>
    <path d="M34.5 25.5c1.5-.8 3.5-.8 5 0" stroke="#334155" stroke-width="1.6" stroke-linecap="round" fill="none"/>
    <!-- Smile -->
    <path d="M28.5 35c1.8 2 5.2 2 7 0" stroke="#334155" stroke-width="2.2" stroke-linecap="round" fill="none"/>
  `,

  // 1: Glasses & side part
  (bg) => `
    <rect width="64" height="64" rx="32" fill="${bg}"/>
    <path d="M18 58c2-9 8-13 14-13s12 4 14 13" fill="#94a3b8" stroke="#334155" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M28 41v5h8v-5" fill="#f8fafc" stroke="#334155" stroke-width="2.2"/>
    <circle cx="32" cy="30" r="14" fill="#f8fafc" stroke="#334155" stroke-width="2.5"/>
    <!-- Hair side-parted -->
    <path d="M18 27c0-8 6-13 14-13 9 0 14 5 14 12-4-2-8-3-12-2-6 1-11 0-16 3z" fill="#334155" stroke="#334155" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="18" cy="31" r="2.8" fill="#f8fafc" stroke="#334155" stroke-width="2"/>
    <circle cx="46" cy="31" r="2.8" fill="#f8fafc" stroke="#334155" stroke-width="2"/>
    <!-- Glasses -->
    <rect x="23" y="26" width="7.5" height="6.5" rx="2" fill="none" stroke="#0f172a" stroke-width="2"/>
    <rect x="33.5" y="26" width="7.5" height="6.5" rx="2" fill="none" stroke="#0f172a" stroke-width="2"/>
    <path d="M30.5 29h3" stroke="#0f172a" stroke-width="2"/>
    <path d="M19 28.5l4 .5M45 28.5l-4 .5" stroke="#0f172a" stroke-width="1.8"/>
    <!-- Eyes -->
    <circle cx="26.7" cy="29.2" r="1.3" fill="#0f172a"/>
    <circle cx="37.3" cy="29.2" r="1.3" fill="#0f172a"/>
    <!-- Smile -->
    <path d="M29 36.5c1.5 1.5 4.5 1.5 6 0" stroke="#334155" stroke-width="2" stroke-linecap="round" fill="none"/>
  `,

  // 2: Spiky / energetic hair & broad grin
  (bg) => `
    <rect width="64" height="64" rx="32" fill="${bg}"/>
    <path d="M17 58c2-9 8-13 15-13s13 4 15 13" fill="#cbd5e1" stroke="#334155" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="32" cy="48" r="1.5" fill="#334155"/>
    <circle cx="32" cy="53" r="1.5" fill="#334155"/>
    <path d="M28 41v5h8v-5" fill="#f8fafc" stroke="#334155" stroke-width="2.2"/>
    <circle cx="32" cy="30" r="14" fill="#f8fafc" stroke="#334155" stroke-width="2.5"/>
    <!-- Spiky Hair -->
    <path d="M18 26l3-6 4 3 4-8 5 6 4-7 4 7 4-3 1 9c-5-2-9-2-14-1-4 1-8 0-12 0z" fill="#475569" stroke="#334155" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="18" cy="31" r="2.8" fill="#f8fafc" stroke="#334155" stroke-width="2"/>
    <circle cx="46" cy="31" r="2.8" fill="#f8fafc" stroke="#334155" stroke-width="2"/>
    <!-- Eyes -->
    <circle cx="27" cy="29" r="1.8" fill="#1e293b"/>
    <circle cx="37" cy="29" r="1.8" fill="#1e293b"/>
    <path d="M24.5 25c1.8-1 4-1 5.5 0" stroke="#334155" stroke-width="1.8" stroke-linecap="round" fill="none"/>
    <path d="M34 25c1.5-1 3.7-1 5.5 0" stroke="#334155" stroke-width="1.8" stroke-linecap="round" fill="none"/>
    <!-- Open Smile -->
    <path d="M27.5 35c0 3 2 5 4.5 5s4.5-2 4.5-5z" fill="#334155" stroke="#334155" stroke-width="1.5"/>
    <path d="M29 35.5h6" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
  `,

  // 3: Wavy / fluffy curls
  (bg) => `
    <rect width="64" height="64" rx="32" fill="${bg}"/>
    <path d="M18 58c2-9 8-13 14-13s12 4 14 13" fill="#e2e8f0" stroke="#334155" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M25 45l7 6 7-6" stroke="#64748b" stroke-width="1.8" fill="none"/>
    <path d="M28 41v5h8v-5" fill="#f8fafc" stroke="#334155" stroke-width="2.2"/>
    <circle cx="32" cy="30" r="14" fill="#f8fafc" stroke="#334155" stroke-width="2.5"/>
    <!-- Curls -->
    <path d="M17 26c-1-3 1-7 4-8 1-3 4-5 8-5 3-2 7-1 9 1 3-1 7 1 8 4 3 2 4 6 2 9-5-2-9-3-15-2-6 1-11 0-16 1z" fill="#1e293b" stroke="#334155" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="18" cy="31" r="2.8" fill="#f8fafc" stroke="#334155" stroke-width="2"/>
    <circle cx="46" cy="31" r="2.8" fill="#f8fafc" stroke="#334155" stroke-width="2"/>
    <!-- Eyes & Smile -->
    <circle cx="27" cy="30" r="1.8" fill="#0f172a"/>
    <circle cx="37" cy="30" r="1.8" fill="#0f172a"/>
    <path d="M28.5 36c1.8 1.8 5.2 1.8 7 0" stroke="#334155" stroke-width="2.2" stroke-linecap="round" fill="none"/>
  `,

  // 4: Student Cap / Beanie
  (bg) => `
    <rect width="64" height="64" rx="32" fill="${bg}"/>
    <path d="M18 58c2-9 8-13 14-13s12 4 14 13" fill="#64748b" stroke="#334155" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M28 41v5h8v-5" fill="#f8fafc" stroke="#334155" stroke-width="2.2"/>
    <circle cx="32" cy="30" r="14" fill="#f8fafc" stroke="#334155" stroke-width="2.5"/>
    <!-- Cap -->
    <path d="M17 25c0-7 6-12 15-12s15 5 15 12z" fill="#334155" stroke="#334155" stroke-width="2" stroke-linejoin="round"/>
    <path d="M15 25h34" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
    <circle cx="18" cy="32" r="2.8" fill="#f8fafc" stroke="#334155" stroke-width="2"/>
    <circle cx="46" cy="32" r="2.8" fill="#f8fafc" stroke="#334155" stroke-width="2"/>
    <!-- Eyes & Smile -->
    <circle cx="27" cy="30" r="1.8" fill="#1e293b"/>
    <circle cx="37" cy="30" r="1.8" fill="#1e293b"/>
    <path d="M29 36c1.5 1.5 4.5 1.5 6 0" stroke="#334155" stroke-width="2" stroke-linecap="round" fill="none"/>
  `,

  // 5: Round specs & curly fringe
  (bg) => `
    <rect width="64" height="64" rx="32" fill="${bg}"/>
    <path d="M18 58c2-9 8-13 14-13s12 4 14 13" fill="#cbd5e1" stroke="#334155" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M28 41v5h8v-5" fill="#f8fafc" stroke="#334155" stroke-width="2.2"/>
    <circle cx="32" cy="30" r="14" fill="#f8fafc" stroke="#334155" stroke-width="2.5"/>
    <!-- Hair -->
    <path d="M18 28c0-8 6-14 14-14s14 6 14 14c-3-3-7-4-11-2-2 1-5 1-8-1-3-1-6 0-9 3z" fill="#475569" stroke="#334155" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="18" cy="31" r="2.8" fill="#f8fafc" stroke="#334155" stroke-width="2"/>
    <circle cx="46" cy="31" r="2.8" fill="#f8fafc" stroke="#334155" stroke-width="2"/>
    <!-- Round glasses -->
    <circle cx="27" cy="29.5" r="4.5" fill="none" stroke="#1e293b" stroke-width="1.9"/>
    <circle cx="37" cy="29.5" r="4.5" fill="none" stroke="#1e293b" stroke-width="1.9"/>
    <path d="M31.5 29.5h1" stroke="#1e293b" stroke-width="2"/>
    <circle cx="27" cy="29.5" r="1.4" fill="#1e293b"/>
    <circle cx="37" cy="29.5" r="1.4" fill="#1e293b"/>
    <!-- Smile -->
    <path d="M29 37c1.5 1.5 4.5 1.5 6 0" stroke="#334155" stroke-width="2" stroke-linecap="round" fill="none"/>
  `,

  // 6: Short buzz cut with cheerful smile & freckles
  (bg) => `
    <rect width="64" height="64" rx="32" fill="${bg}"/>
    <path d="M18 58c2-9 8-13 14-13s12 4 14 13" fill="#94a3b8" stroke="#334155" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M28 41v5h8v-5" fill="#f8fafc" stroke="#334155" stroke-width="2.2"/>
    <circle cx="32" cy="30" r="14" fill="#f8fafc" stroke="#334155" stroke-width="2.5"/>
    <!-- Buzz cut hair -->
    <path d="M18 28c0-8 6-13 14-13s14 5 14 13c-4-2-9-2-14-1-5 1-10 0-14 1z" fill="#64748b" stroke="#334155" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="18" cy="31" r="2.8" fill="#f8fafc" stroke="#334155" stroke-width="2"/>
    <circle cx="46" cy="31" r="2.8" fill="#f8fafc" stroke="#334155" stroke-width="2"/>
    <!-- Eyes -->
    <circle cx="27" cy="29" r="1.8" fill="#1e293b"/>
    <circle cx="37" cy="29" r="1.8" fill="#1e293b"/>
    <!-- Freckles -->
    <circle cx="23.5" cy="32.5" r=".7" fill="#64748b"/>
    <circle cx="25" cy="33.5" r=".7" fill="#64748b"/>
    <circle cx="39" cy="33.5" r=".7" fill="#64748b"/>
    <circle cx="40.5" cy="32.5" r=".7" fill="#64748b"/>
    <!-- Smile -->
    <path d="M28 35.5c2 2.2 6 2.2 8 0" stroke="#334155" stroke-width="2.2" stroke-linecap="round" fill="none"/>
  `,

  // 7: Modern textured quiff
  (bg) => `
    <rect width="64" height="64" rx="32" fill="${bg}"/>
    <path d="M18 58c2-9 8-13 14-13s12 4 14 13" fill="#cbd5e1" stroke="#334155" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M32 45v13" stroke="#94a3b8" stroke-width="2" stroke-dasharray="2 2"/>
    <path d="M28 41v5h8v-5" fill="#f8fafc" stroke="#334155" stroke-width="2.2"/>
    <circle cx="32" cy="30" r="14" fill="#f8fafc" stroke="#334155" stroke-width="2.5"/>
    <!-- Quiff -->
    <path d="M18 27c0-6 4-11 11-13 4-3 9-1 12 4 3 3 5 7 5 9-4-2-9-3-14-1-5 2-10 0-14 1z" fill="#334155" stroke="#334155" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="18" cy="31" r="2.8" fill="#f8fafc" stroke="#334155" stroke-width="2"/>
    <circle cx="46" cy="31" r="2.8" fill="#f8fafc" stroke="#334155" stroke-width="2"/>
    <!-- Eyes & Brows -->
    <circle cx="27" cy="29.5" r="1.8" fill="#1e293b"/>
    <circle cx="37" cy="29.5" r="1.8" fill="#1e293b"/>
    <path d="M24.5 25.5c1.5-.6 3.5-.6 5 0" stroke="#334155" stroke-width="1.6" stroke-linecap="round" fill="none"/>
    <path d="M34.5 25.5c1.5-.6 3.5-.6 5 0" stroke="#334155" stroke-width="1.6" stroke-linecap="round" fill="none"/>
    <!-- Gentle Smile -->
    <path d="M28.5 36c1.8 1.5 5.2 1.5 7 0" stroke="#334155" stroke-width="2" stroke-linecap="round" fill="none"/>
  `,

  // 8: Forward bangs & hoodie
  (bg) => `
    <rect width="64" height="64" rx="32" fill="${bg}"/>
    <path d="M16 58c2-10 8-14 16-14s14 4 16 14" fill="#475569" stroke="#334155" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M26 44c2 3 4 5 6 5s4-2 6-5" stroke="#f8fafc" stroke-width="2" fill="none"/>
    <circle cx="32" cy="30" r="14" fill="#f8fafc" stroke="#334155" stroke-width="2.5"/>
    <!-- Bangs -->
    <path d="M18 28c0-8 6-14 14-14s14 6 14 14c-3-1-5 2-8 0-3-1-5 1-8 0-3-1-6 2-9 0z" fill="#1e293b" stroke="#334155" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="18" cy="31" r="2.8" fill="#f8fafc" stroke="#334155" stroke-width="2"/>
    <circle cx="46" cy="31" r="2.8" fill="#f8fafc" stroke="#334155" stroke-width="2"/>
    <circle cx="27" cy="30" r="1.8" fill="#1e293b"/>
    <circle cx="37" cy="30" r="1.8" fill="#1e293b"/>
    <path d="M29 36c1.5 1.5 4.5 1.5 6 0" stroke="#334155" stroke-width="2" stroke-linecap="round" fill="none"/>
  `,

  // 9: Winking / energetic student
  (bg) => `
    <rect width="64" height="64" rx="32" fill="${bg}"/>
    <path d="M18 58c2-9 8-13 14-13s12 4 14 13" fill="#cbd5e1" stroke="#334155" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M28 41v5h8v-5" fill="#f8fafc" stroke="#334155" stroke-width="2.2"/>
    <circle cx="32" cy="30" r="14" fill="#f8fafc" stroke="#334155" stroke-width="2.5"/>
    <path d="M18 27c1-7 7-13 14-13s13 6 14 13c-4-2-8-3-13-1-5 2-10 0-15 1z" fill="#475569" stroke="#334155" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="18" cy="31" r="2.8" fill="#f8fafc" stroke="#334155" stroke-width="2"/>
    <circle cx="46" cy="31" r="2.8" fill="#f8fafc" stroke="#334155" stroke-width="2"/>
    <!-- Left eye open, right eye winking -->
    <circle cx="27" cy="29" r="1.8" fill="#1e293b"/>
    <path d="M35 29c1-1 3-1 4 0" stroke="#1e293b" stroke-width="2.2" stroke-linecap="round" fill="none"/>
    <path d="M28 35.5c1.8 2.2 5.5 2.2 7.5 0" stroke="#334155" stroke-width="2.2" stroke-linecap="round" fill="none"/>
  `,

  // 10: Center-parted neat style
  (bg) => `
    <rect width="64" height="64" rx="32" fill="${bg}"/>
    <path d="M18 58c2-9 8-13 14-13s12 4 14 13" fill="#94a3b8" stroke="#334155" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M28 41v5h8v-5" fill="#f8fafc" stroke="#334155" stroke-width="2.2"/>
    <circle cx="32" cy="30" r="14" fill="#f8fafc" stroke="#334155" stroke-width="2.5"/>
    <!-- Center part curtain hair -->
    <path d="M18 28c0-8 6-14 14-14s14 6 14 14c-4-4-9-4-14 0-5-4-10-4-14 0z" fill="#334155" stroke="#334155" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="18" cy="31" r="2.8" fill="#f8fafc" stroke="#334155" stroke-width="2"/>
    <circle cx="46" cy="31" r="2.8" fill="#f8fafc" stroke="#334155" stroke-width="2"/>
    <circle cx="26.5" cy="29.5" r="1.8" fill="#1e293b"/>
    <circle cx="37.5" cy="29.5" r="1.8" fill="#1e293b"/>
    <path d="M29 36.5c1.5 1.5 4.5 1.5 6 0" stroke="#334155" stroke-width="2" stroke-linecap="round" fill="none"/>
  `,

  // 11: High top curls
  (bg) => `
    <rect width="64" height="64" rx="32" fill="${bg}"/>
    <path d="M18 58c2-9 8-13 14-13s12 4 14 13" fill="#cbd5e1" stroke="#334155" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M28 41v5h8v-5" fill="#f8fafc" stroke="#334155" stroke-width="2.2"/>
    <circle cx="32" cy="30" r="14" fill="#f8fafc" stroke="#334155" stroke-width="2.5"/>
    <!-- High curls -->
    <path d="M19 25c-1-5 2-10 6-12 4-2 10-2 14 0 4 2 7 7 6 12-4-1-8-2-13 0-5-2-9-1-13 0z" fill="#1e293b" stroke="#334155" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="18" cy="31" r="2.8" fill="#f8fafc" stroke="#334155" stroke-width="2"/>
    <circle cx="46" cy="31" r="2.8" fill="#f8fafc" stroke="#334155" stroke-width="2"/>
    <circle cx="27" cy="29.5" r="1.8" fill="#1e293b"/>
    <circle cx="37" cy="29.5" r="1.8" fill="#1e293b"/>
    <path d="M28.5 36c1.8 2 5.2 2 7 0" stroke="#334155" stroke-width="2.2" stroke-linecap="round" fill="none"/>
  `,

  // 12: Collared shirt & side-sweep
  (bg) => `
    <rect width="64" height="64" rx="32" fill="${bg}"/>
    <path d="M18 58c2-9 8-13 14-13s12 4 14 13" fill="#f1f5f9" stroke="#334155" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M26 45l6 6-6 7M38 45l-6 6 6 7" stroke="#334155" stroke-width="2" fill="none"/>
    <path d="M28 41v5h8v-5" fill="#f8fafc" stroke="#334155" stroke-width="2.2"/>
    <circle cx="32" cy="30" r="14" fill="#f8fafc" stroke="#334155" stroke-width="2.5"/>
    <path d="M18 28c1-8 7-14 14-14 8 0 14 6 14 14-4-2-9-4-15-2-5 2-9 1-13 2z" fill="#475569" stroke="#334155" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="18" cy="31" r="2.8" fill="#f8fafc" stroke="#334155" stroke-width="2"/>
    <circle cx="46" cy="31" r="2.8" fill="#f8fafc" stroke="#334155" stroke-width="2"/>
    <circle cx="27" cy="29.5" r="1.8" fill="#1e293b"/>
    <circle cx="37" cy="29.5" r="1.8" fill="#1e293b"/>
    <path d="M29 36c1.5 1.5 4.5 1.5 6 0" stroke="#334155" stroke-width="2" stroke-linecap="round" fill="none"/>
  `,

  // 13: Thick frames & warm grin
  (bg) => `
    <rect width="64" height="64" rx="32" fill="${bg}"/>
    <path d="M18 58c2-9 8-13 14-13s12 4 14 13" fill="#cbd5e1" stroke="#334155" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M28 41v5h8v-5" fill="#f8fafc" stroke="#334155" stroke-width="2.2"/>
    <circle cx="32" cy="30" r="14" fill="#f8fafc" stroke="#334155" stroke-width="2.5"/>
    <path d="M18 27c0-7 6-13 14-13s14 6 14 13c-4-2-8-3-12-1-6 2-11 0-16 1z" fill="#334155" stroke="#334155" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="18" cy="31" r="2.8" fill="#f8fafc" stroke="#334155" stroke-width="2"/>
    <circle cx="46" cy="31" r="2.8" fill="#f8fafc" stroke="#334155" stroke-width="2"/>
    <!-- Thick modern glasses -->
    <rect x="22.5" y="25.5" width="8.5" height="7.5" rx="2" fill="none" stroke="#1e293b" stroke-width="2.2"/>
    <rect x="33" y="25.5" width="8.5" height="7.5" rx="2" fill="none" stroke="#1e293b" stroke-width="2.2"/>
    <path d="M31 29h2" stroke="#1e293b" stroke-width="2.2"/>
    <circle cx="26.7" cy="29.2" r="1.4" fill="#1e293b"/>
    <circle cx="37.3" cy="29.2" r="1.4" fill="#1e293b"/>
    <path d="M28.5 37c1.8 1.8 5.2 1.8 7 0" stroke="#334155" stroke-width="2" stroke-linecap="round" fill="none"/>
  `,

  // 14: Sporty crew hair & jersey
  (bg) => `
    <rect width="64" height="64" rx="32" fill="${bg}"/>
    <path d="M18 58c2-9 8-13 14-13s12 4 14 13" fill="#475569" stroke="#334155" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M28 45h8" stroke="#ffffff" stroke-width="2"/>
    <path d="M28 41v5h8v-5" fill="#f8fafc" stroke="#334155" stroke-width="2.2"/>
    <circle cx="32" cy="30" r="14" fill="#f8fafc" stroke="#334155" stroke-width="2.5"/>
    <path d="M18 27c0-7 6-13 14-13s14 6 14 13c-4-2-9-2-14 0-5 2-10 0-14 0z" fill="#64748b" stroke="#334155" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="18" cy="31" r="2.8" fill="#f8fafc" stroke="#334155" stroke-width="2"/>
    <circle cx="46" cy="31" r="2.8" fill="#f8fafc" stroke="#334155" stroke-width="2"/>
    <circle cx="27" cy="29.5" r="1.8" fill="#1e293b"/>
    <circle cx="37" cy="29.5" r="1.8" fill="#1e293b"/>
    <path d="M28.5 36c1.8 2 5.2 2 7 0" stroke="#334155" stroke-width="2.2" stroke-linecap="round" fill="none"/>
  `,

  // 15: Friendly smile with round cheeks
  (bg) => `
    <rect width="64" height="64" rx="32" fill="${bg}"/>
    <path d="M18 58c2-9 8-13 14-13s12 4 14 13" fill="#cbd5e1" stroke="#334155" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M28 41v5h8v-5" fill="#f8fafc" stroke="#334155" stroke-width="2.2"/>
    <circle cx="32" cy="30" r="14" fill="#f8fafc" stroke="#334155" stroke-width="2.5"/>
    <path d="M18 28c0-8 6-14 14-14s14 6 14 14c-4-3-8-3-13-1-5 2-10 0-15 1z" fill="#334155" stroke="#334155" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="18" cy="31" r="2.8" fill="#f8fafc" stroke="#334155" stroke-width="2"/>
    <circle cx="46" cy="31" r="2.8" fill="#f8fafc" stroke="#334155" stroke-width="2"/>
    <circle cx="27" cy="29.5" r="1.8" fill="#1e293b"/>
    <circle cx="37" cy="29.5" r="1.8" fill="#1e293b"/>
    <!-- Cheerful rosy blush accents in soft greyscale -->
    <ellipse cx="23.5" cy="33" rx="2" ry="1" fill="#e2e8f0"/>
    <ellipse cx="40.5" cy="33" rx="2" ry="1" fill="#e2e8f0"/>
    <path d="M28 35.5c2 2.5 6 2.5 8 0" stroke="#334155" stroke-width="2.2" stroke-linecap="round" fill="none"/>
  `,
];

/** Clean neutral background palette for the avatar base */
const AVATAR_BG_PALETTE = [
  '#f1f5f9',
  '#f3f4f6',
  '#e2e8f0',
  '#f8fafc',
  '#edf2f7',
  '#e5e7eb',
];

/**
 * Returns raw HTML string of the deterministic student avatar SVG.
 * @param {Object} student - student record { id, name }
 * @param {'xxs'|'xs'|'sm'|'md'|'lg'|'xl'} [size='sm'] - size variant
 * @param {string} [extraClass=''] - optional extra CSS class
 */
export function studentAvatar(student, size = 'sm', extraClass = '') {
  if (!student) {
    return raw(`<span class="student-avatar student-avatar--${size} ${esc(extraClass)}" aria-hidden="true"><span class="student-avatar__fallback">ط</span></span>`);
  }

  const hash = hashStudentId(student.id ?? student.name);
  const variantIndex = hash % AVATAR_SVGS.length;
  const bgIndex = (hash >> 4) % AVATAR_BG_PALETTE.length;
  const bg = AVATAR_BG_PALETTE[bgIndex];
  const initial = studentInitial(student.name);

  const svgContent = AVATAR_SVGS[variantIndex](bg);

  return raw(`
    <span class="student-avatar student-avatar--${size} ${esc(extraClass)}" aria-hidden="true">
      <svg class="student-avatar__svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" role="img">
        ${svgContent}
      </svg>
      <span class="student-avatar__fallback sr-only">${initial}</span>
    </span>
  `.trim());
}
