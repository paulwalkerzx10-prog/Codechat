export type AccentColor = 'violet' | 'emerald' | 'rose' | 'amber' | 'sky' | 'indigo';

export interface ColorTheme {
  primary: AccentColor;
  bgAccent: string;      // e.g., "bg-violet-600"
  bgHover: string;       // e.g., "hover:bg-violet-700"
  bgLight: string;       // e.g., "bg-violet-50"
  hoverBgLight: string;  // e.g., "hover:bg-violet-50"
  bgBorder: string;      // e.g., "border-violet-600"
  bgLightBorder: string; // e.g., "border-violet-100"
  hoverBorderLight: string; // e.g., "hover:border-violet-200"
  textAccent: string;    // e.g., "text-violet-600"
  hoverTextAccent: string; // e.g., "hover:text-violet-700"
  textDark: string;      // e.g., "text-violet-800"
  hoverTextDark: string; // e.g., "hover:text-violet-800"
  textLight: string;     // e.g., "text-violet-400"
  textMuted: string;     // e.g., "text-violet-300"
  textOnLight: string;   // e.g., "text-violet-900"
  shadowAccent: string;  // e.g., "shadow-violet-600/30"
  shadowLight: string;   // e.g., "shadow-violet-600/10"
  ringAccent: string;    // e.g., "focus:border-violet-500"
  fillAccent: string;    // e.g., "fill-violet-600"
}

export const THEMES: Record<AccentColor, ColorTheme> = {
  violet: {
    primary: 'violet',
    bgAccent: 'bg-violet-600',
    bgHover: 'hover:bg-violet-700',
    bgLight: 'bg-violet-50',
    hoverBgLight: 'hover:bg-violet-50',
    bgBorder: 'border-violet-600',
    bgLightBorder: 'border-violet-100',
    hoverBorderLight: 'hover:border-violet-200',
    textAccent: 'text-violet-600',
    hoverTextAccent: 'hover:text-violet-700',
    textDark: 'text-violet-850',
    hoverTextDark: 'hover:text-violet-850',
    textLight: 'text-violet-400',
    textMuted: 'text-violet-300',
    textOnLight: 'text-violet-900',
    shadowAccent: 'shadow-violet-600/30',
    shadowLight: 'shadow-violet-600/10',
    ringAccent: 'focus:border-violet-500',
    fillAccent: 'fill-violet-600'
  },
  emerald: {
    primary: 'emerald',
    bgAccent: 'bg-emerald-600',
    bgHover: 'hover:bg-emerald-700',
    bgLight: 'bg-emerald-50',
    hoverBgLight: 'hover:bg-emerald-50',
    bgBorder: 'border-emerald-600',
    bgLightBorder: 'border-emerald-100',
    hoverBorderLight: 'hover:border-emerald-200',
    textAccent: 'text-emerald-600',
    hoverTextAccent: 'hover:text-emerald-700',
    textDark: 'text-emerald-800',
    hoverTextDark: 'hover:text-emerald-800',
    textLight: 'text-emerald-400',
    textMuted: 'text-emerald-300',
    textOnLight: 'text-emerald-950',
    shadowAccent: 'shadow-emerald-600/30',
    shadowLight: 'shadow-emerald-600/10',
    ringAccent: 'focus:border-emerald-500',
    fillAccent: 'fill-emerald-600'
  },
  rose: {
    primary: 'rose',
    bgAccent: 'bg-rose-600',
    bgHover: 'hover:bg-rose-700',
    bgLight: 'bg-rose-50',
    hoverBgLight: 'hover:bg-rose-50',
    bgBorder: 'border-rose-600',
    bgLightBorder: 'border-rose-100',
    hoverBorderLight: 'hover:border-rose-200',
    textAccent: 'text-rose-600',
    hoverTextAccent: 'hover:text-rose-700',
    textDark: 'text-rose-800',
    hoverTextDark: 'hover:text-rose-800',
    textLight: 'text-rose-400',
    textMuted: 'text-rose-300',
    textOnLight: 'text-rose-950',
    shadowAccent: 'shadow-rose-600/30',
    shadowLight: 'shadow-rose-600/10',
    ringAccent: 'focus:border-rose-500',
    fillAccent: 'fill-rose-600'
  },
  amber: {
    primary: 'amber',
    bgAccent: 'bg-amber-600',
    bgHover: 'hover:bg-amber-700',
    bgLight: 'bg-amber-50',
    hoverBgLight: 'hover:bg-amber-50',
    bgBorder: 'border-amber-600',
    bgLightBorder: 'border-amber-100',
    hoverBorderLight: 'hover:border-amber-200',
    textAccent: 'text-amber-600',
    hoverTextAccent: 'hover:text-amber-700',
    textDark: 'text-amber-800',
    hoverTextDark: 'hover:text-amber-800',
    textLight: 'text-amber-400',
    textMuted: 'text-amber-300',
    textOnLight: 'text-amber-950',
    shadowAccent: 'shadow-amber-600/30',
    shadowLight: 'shadow-amber-600/10',
    ringAccent: 'focus:border-amber-500',
    fillAccent: 'fill-amber-600'
  },
  sky: {
    primary: 'sky',
    bgAccent: 'bg-sky-600',
    bgHover: 'hover:bg-sky-700',
    bgLight: 'bg-sky-50',
    hoverBgLight: 'hover:bg-sky-50',
    bgBorder: 'border-sky-600',
    bgLightBorder: 'border-sky-100',
    hoverBorderLight: 'hover:border-sky-200',
    textAccent: 'text-sky-600',
    hoverTextAccent: 'hover:text-sky-700',
    textDark: 'text-sky-800',
    hoverTextDark: 'hover:text-sky-800',
    textLight: 'text-sky-400',
    textMuted: 'text-sky-300',
    textOnLight: 'text-sky-950',
    shadowAccent: 'shadow-sky-600/30',
    shadowLight: 'shadow-sky-600/10',
    ringAccent: 'focus:border-sky-500',
    fillAccent: 'fill-sky-600'
  },
  indigo: {
    primary: 'indigo',
    bgAccent: 'bg-indigo-600',
    bgHover: 'hover:bg-indigo-700',
    bgLight: 'bg-indigo-50',
    hoverBgLight: 'hover:bg-indigo-50',
    bgBorder: 'border-indigo-600',
    bgLightBorder: 'border-indigo-100',
    hoverBorderLight: 'hover:border-indigo-200',
    textAccent: 'text-indigo-600',
    hoverTextAccent: 'hover:text-indigo-700',
    textDark: 'text-indigo-800',
    hoverTextDark: 'hover:text-indigo-800',
    textLight: 'text-indigo-400',
    textMuted: 'text-indigo-300',
    textOnLight: 'text-indigo-950',
    shadowAccent: 'shadow-indigo-600/30',
    shadowLight: 'shadow-indigo-600/10',
    ringAccent: 'focus:border-indigo-500',
    fillAccent: 'fill-indigo-600'
  }
};

export const DEFAULT_ACCENT: AccentColor = 'violet';

export function getTheme(color: string | undefined): ColorTheme {
  const c = (color || DEFAULT_ACCENT) as AccentColor;
  return THEMES[c] || THEMES[DEFAULT_ACCENT];
}
