import React from 'react';
import {
  ZapIcon,
  DropletIcon,
  HammerIcon,
  WrenchIcon,
  SnowflakeIcon,
  PaintbrushIcon,
  SparklesIcon,
  FlameIcon,
  BrickWallIcon,
  CarIcon,
} from '../components/icons/Icons';

export interface CategoryTheme {
  id: string;
  name: string;
  colorName: string;
  // Full card background and border (tinted per category)
  cardBg: string;
  cardBorder: string;
  cardHover: string;
  cardDivider: string;
  // Icon badge classes (slightly more saturated for contrast against tinted bg)
  badgeBg: string;
  iconColor: string;
  badgeBorder: string;
  // Call to action link styling
  link: string;
  // Legacy / fallback accents
  cardBorderTop: string;
  cardBorderHover: string;
  cardBgTint: string;
  // Chip / Pill tag for reuse in listings, search, and booking cards
  chip: string;
  dot: string;
  // Trade icon component
  icon: React.ComponentType<{ className?: string }>;
}

export const CATEGORY_THEMES: Record<string, CategoryTheme> = {
  electrician: {
    id: 'electrician',
    name: 'Electrician',
    colorName: 'amber',
    cardBg: 'bg-amber-50 dark:bg-amber-950/30',
    cardBorder: 'border-amber-200 dark:border-amber-800/50',
    cardHover: 'hover:border-amber-400 dark:hover:border-amber-700 hover:shadow-md',
    cardDivider: 'border-amber-200/70 dark:border-amber-800/60',
    badgeBg: 'bg-amber-100 dark:bg-amber-900/50',
    iconColor: 'text-amber-700 dark:text-amber-400',
    badgeBorder: 'border border-amber-300/80 dark:border-amber-700/60',
    link: 'text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300',
    cardBorderTop: 'border-t-4 border-t-amber-400 dark:border-t-amber-500',
    cardBorderHover: 'hover:border-amber-400/80 dark:hover:border-amber-500/80',
    cardBgTint: 'bg-amber-50 dark:bg-amber-950/30',
    chip: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60',
    dot: 'bg-amber-500 dark:bg-amber-400',
    icon: ZapIcon,
  },
  plumber: {
    id: 'plumber',
    name: 'Plumber',
    colorName: 'blue',
    cardBg: 'bg-blue-50 dark:bg-blue-950/30',
    cardBorder: 'border-blue-200 dark:border-blue-800/50',
    cardHover: 'hover:border-blue-400 dark:hover:border-blue-700 hover:shadow-md',
    cardDivider: 'border-blue-200/70 dark:border-blue-800/60',
    badgeBg: 'bg-blue-100 dark:bg-blue-900/50',
    iconColor: 'text-blue-600 dark:text-blue-400',
    badgeBorder: 'border border-blue-300/80 dark:border-blue-700/60',
    link: 'text-blue-700 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300',
    cardBorderTop: 'border-t-4 border-t-blue-400 dark:border-t-blue-500',
    cardBorderHover: 'hover:border-blue-400/80 dark:hover:border-blue-500/80',
    cardBgTint: 'bg-blue-50 dark:bg-blue-950/30',
    chip: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60',
    dot: 'bg-blue-500 dark:bg-blue-400',
    icon: DropletIcon,
  },
  carpenter: {
    id: 'carpenter',
    name: 'Carpenter',
    colorName: 'orange',
    cardBg: 'bg-orange-50 dark:bg-orange-950/30',
    cardBorder: 'border-orange-200 dark:border-orange-800/50',
    cardHover: 'hover:border-orange-400 dark:hover:border-orange-700 hover:shadow-md',
    cardDivider: 'border-orange-200/70 dark:border-orange-800/60',
    badgeBg: 'bg-orange-100 dark:bg-orange-900/50',
    iconColor: 'text-orange-600 dark:text-orange-400',
    badgeBorder: 'border border-orange-300/80 dark:border-orange-700/60',
    link: 'text-orange-700 hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-300',
    cardBorderTop: 'border-t-4 border-t-orange-400 dark:border-t-orange-500',
    cardBorderHover: 'hover:border-orange-400/80 dark:hover:border-orange-500/80',
    cardBgTint: 'bg-orange-50 dark:bg-orange-950/30',
    chip: 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border border-orange-200/80 dark:border-orange-800/60',
    dot: 'bg-orange-500 dark:bg-orange-400',
    icon: HammerIcon,
  },
  mechanic: {
    id: 'mechanic',
    name: 'Mechanic',
    colorName: 'slate',
    cardBg: 'bg-slate-50 dark:bg-slate-950/30',
    cardBorder: 'border-slate-200 dark:border-slate-800/50',
    cardHover: 'hover:border-slate-400 dark:hover:border-slate-700 hover:shadow-md',
    cardDivider: 'border-slate-200/70 dark:border-slate-800/60',
    badgeBg: 'bg-slate-100 dark:bg-slate-900/50',
    iconColor: 'text-slate-600 dark:text-slate-400',
    badgeBorder: 'border border-slate-300/80 dark:border-slate-700/60',
    link: 'text-slate-700 hover:text-slate-800 dark:text-slate-300 dark:hover:text-slate-200',
    cardBorderTop: 'border-t-4 border-t-slate-400 dark:border-t-slate-500',
    cardBorderHover: 'hover:border-slate-400/80 dark:hover:border-slate-500/80',
    cardBgTint: 'bg-slate-50 dark:bg-slate-950/30',
    chip: 'bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/60',
    dot: 'bg-slate-500 dark:bg-slate-400',
    icon: WrenchIcon,
  },
  'ac technician': {
    id: 'ac technician',
    name: 'AC Technician',
    colorName: 'cyan',
    cardBg: 'bg-cyan-50 dark:bg-cyan-950/30',
    cardBorder: 'border-cyan-200 dark:border-cyan-800/50',
    cardHover: 'hover:border-cyan-400 dark:hover:border-cyan-700 hover:shadow-md',
    cardDivider: 'border-cyan-200/70 dark:border-cyan-800/60',
    badgeBg: 'bg-cyan-100 dark:bg-cyan-900/50',
    iconColor: 'text-cyan-700 dark:text-cyan-400',
    badgeBorder: 'border border-cyan-300/80 dark:border-cyan-700/60',
    link: 'text-cyan-700 hover:text-cyan-800 dark:text-cyan-400 dark:hover:text-cyan-300',
    cardBorderTop: 'border-t-4 border-t-cyan-400 dark:border-t-cyan-500',
    cardBorderHover: 'hover:border-cyan-400/80 dark:hover:border-cyan-500/80',
    cardBgTint: 'bg-cyan-50 dark:bg-cyan-950/30',
    chip: 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-800 dark:text-cyan-300 border border-cyan-200/80 dark:border-cyan-800/60',
    dot: 'bg-cyan-500 dark:bg-cyan-400',
    icon: SnowflakeIcon,
  },
  painter: {
    id: 'painter',
    name: 'Painter',
    colorName: 'purple',
    cardBg: 'bg-purple-50 dark:bg-purple-950/30',
    cardBorder: 'border-purple-200 dark:border-purple-800/50',
    cardHover: 'hover:border-purple-400 dark:hover:border-purple-700 hover:shadow-md',
    cardDivider: 'border-purple-200/70 dark:border-purple-800/60',
    badgeBg: 'bg-purple-100 dark:bg-purple-900/50',
    iconColor: 'text-purple-600 dark:text-purple-400',
    badgeBorder: 'border border-purple-300/80 dark:border-purple-700/60',
    link: 'text-purple-700 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300',
    cardBorderTop: 'border-t-4 border-t-purple-400 dark:border-t-purple-500',
    cardBorderHover: 'hover:border-purple-400/80 dark:hover:border-purple-500/80',
    cardBgTint: 'bg-purple-50 dark:bg-purple-950/30',
    chip: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/60',
    dot: 'bg-purple-500 dark:bg-purple-400',
    icon: PaintbrushIcon,
  },
  cleaner: {
    id: 'cleaner',
    name: 'Cleaner',
    colorName: 'teal',
    cardBg: 'bg-teal-50 dark:bg-teal-950/30',
    cardBorder: 'border-teal-200 dark:border-teal-800/50',
    cardHover: 'hover:border-teal-400 dark:hover:border-teal-700 hover:shadow-md',
    cardDivider: 'border-teal-200/70 dark:border-teal-800/60',
    badgeBg: 'bg-teal-100 dark:bg-teal-900/50',
    iconColor: 'text-teal-700 dark:text-teal-400',
    badgeBorder: 'border border-teal-300/80 dark:border-teal-700/60',
    link: 'text-teal-700 hover:text-teal-800 dark:text-teal-400 dark:hover:text-teal-300',
    cardBorderTop: 'border-t-4 border-t-teal-400 dark:border-t-teal-500',
    cardBorderHover: 'hover:border-teal-400/80 dark:hover:border-teal-500/80',
    cardBgTint: 'bg-teal-50 dark:bg-teal-950/30',
    chip: 'bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border border-teal-200/80 dark:border-teal-800/60',
    dot: 'bg-teal-500 dark:bg-teal-400',
    icon: SparklesIcon,
  },
  welder: {
    id: 'welder',
    name: 'Welder',
    colorName: 'red',
    cardBg: 'bg-red-50 dark:bg-red-950/30',
    cardBorder: 'border-red-200 dark:border-red-800/50',
    cardHover: 'hover:border-red-400 dark:hover:border-red-700 hover:shadow-md',
    cardDivider: 'border-red-200/70 dark:border-red-800/60',
    badgeBg: 'bg-red-100 dark:bg-red-900/50',
    iconColor: 'text-red-600 dark:text-red-400',
    badgeBorder: 'border border-red-300/80 dark:border-red-700/60',
    link: 'text-red-700 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300',
    cardBorderTop: 'border-t-4 border-t-red-400 dark:border-t-red-500',
    cardBorderHover: 'hover:border-red-400/80 dark:hover:border-red-500/80',
    cardBgTint: 'bg-red-50 dark:bg-red-950/30',
    chip: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200/80 dark:border-red-800/60',
    dot: 'bg-red-500 dark:bg-red-400',
    icon: FlameIcon,
  },
  mason: {
    id: 'mason',
    name: 'Mason',
    colorName: 'stone',
    cardBg: 'bg-stone-50 dark:bg-stone-950/30',
    cardBorder: 'border-stone-200 dark:border-stone-800/50',
    cardHover: 'hover:border-stone-400 dark:hover:border-stone-700 hover:shadow-md',
    cardDivider: 'border-stone-200/70 dark:border-stone-800/60',
    badgeBg: 'bg-stone-100 dark:bg-stone-900/50',
    iconColor: 'text-stone-600 dark:text-stone-400',
    badgeBorder: 'border border-stone-300/80 dark:border-stone-700/60',
    link: 'text-stone-700 hover:text-stone-800 dark:text-stone-300 dark:hover:text-stone-200',
    cardBorderTop: 'border-t-4 border-t-stone-400 dark:border-t-stone-500',
    cardBorderHover: 'hover:border-stone-400/80 dark:hover:border-stone-500/80',
    cardBgTint: 'bg-stone-50 dark:bg-stone-950/30',
    chip: 'bg-stone-50 dark:bg-stone-900/40 text-stone-700 dark:text-stone-300 border border-stone-200/80 dark:border-stone-700/60',
    dot: 'bg-stone-500 dark:bg-stone-400',
    icon: BrickWallIcon,
  },
  driver: {
    id: 'driver',
    name: 'Driver',
    colorName: 'indigo',
    cardBg: 'bg-indigo-50 dark:bg-indigo-950/30',
    cardBorder: 'border-indigo-200 dark:border-indigo-800/50',
    cardHover: 'hover:border-indigo-400 dark:hover:border-indigo-700 hover:shadow-md',
    cardDivider: 'border-indigo-200/70 dark:border-indigo-800/60',
    badgeBg: 'bg-indigo-100 dark:bg-indigo-900/50',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    badgeBorder: 'border border-indigo-300/80 dark:border-indigo-700/60',
    link: 'text-indigo-700 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300',
    cardBorderTop: 'border-t-4 border-t-indigo-400 dark:border-t-indigo-500',
    cardBorderHover: 'hover:border-indigo-400/80 dark:hover:border-indigo-500/80',
    cardBgTint: 'bg-indigo-50 dark:bg-indigo-950/30',
    chip: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60',
    dot: 'bg-indigo-500 dark:bg-indigo-400',
    icon: CarIcon,
  },
};

// Aliases for alternate category naming conventions
const CATEGORY_ALIASES: Record<string, string> = {
  electrical: 'electrician',
  plumbing: 'plumber',
  carpentry: 'carpenter',
  painting: 'painter',
  cleaning: 'cleaner',
  welding: 'welder',
  masonry: 'mason',
  driving: 'driver',
  hvac: 'ac technician',
  'hvac / ac repair': 'ac technician',
  'appliance repair': 'ac technician',
  ac: 'ac technician',
};

// Array of themes to cycle through for unrecognized or dynamically created categories
const THEME_CYCLE: CategoryTheme[] = Object.values(CATEGORY_THEMES);

/**
 * Returns a standardized, accessible color and icon theme for a given service category.
 * Matches by exact name, normalized lowercase name, alias, or hashes unrecognized inputs
 * to guarantee an attractive, non-clashing visual theme.
 */
export function getCategoryTheme(categoryNameOrId?: string | number | null): CategoryTheme {
  if (categoryNameOrId == null) {
    return CATEGORY_THEMES['mechanic'];
  }

  const raw = String(categoryNameOrId).trim().toLowerCase();

  // 1. Direct match
  if (CATEGORY_THEMES[raw]) {
    return CATEGORY_THEMES[raw];
  }

  // 2. Alias match
  if (CATEGORY_ALIASES[raw] && CATEGORY_THEMES[CATEGORY_ALIASES[raw]]) {
    return CATEGORY_THEMES[CATEGORY_ALIASES[raw]];
  }

  // 3. Substring match (e.g. "air conditioner" -> "ac technician")
  for (const [key, theme] of Object.entries(CATEGORY_THEMES)) {
    if (raw.includes(key) || key.includes(raw)) {
      return theme;
    }
  }

  for (const [alias, canonical] of Object.entries(CATEGORY_ALIASES)) {
    if (raw.includes(alias)) {
      return CATEGORY_THEMES[canonical];
    }
  }

  // 4. Deterministic hash fallback
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % THEME_CYCLE.length;
  return THEME_CYCLE[index];
}
