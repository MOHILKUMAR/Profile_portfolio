import en from './en.json';
import hi from './hi.json';
import es from './es.json';

export const LOCALES = ['en', 'hi', 'es'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

/** Native names, used in the language switcher so each option reads in its own language. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  hi: 'हिन्दी',
  es: 'Español',
};

/** BCP 47 tags for the html lang attribute and hreflang alternates. */
export const LOCALE_TAGS: Record<Locale, string> = {
  en: 'en',
  hi: 'hi-IN',
  es: 'es',
};

type Dictionary = Record<string, string>;

const dictionaries: Record<Locale, Dictionary> = {
  en: en as Dictionary,
  hi: hi as Dictionary,
  es: es as Dictionary,
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** Reads the locale out of a pathname, e.g. "/hi/projects" gives "hi". */
export function localeFromPath(pathname: string): Locale {
  const first = pathname.split('/').filter(Boolean)[0];
  return isLocale(first) ? first : DEFAULT_LOCALE;
}

/** Drops a locale prefix, e.g. "/hi/projects" gives "/projects". */
export function stripLocale(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  if (isLocale(parts[0])) parts.shift();
  return '/' + parts.join('/');
}

/**
 * Builds a path for a locale. The default locale has no prefix
 * (prefixDefaultLocale is false), every other locale does.
 */
export function localizePath(path: string, locale: Locale): string {
  const clean = ('/' + path.replace(/^\/+/, '')).replace(/\/+$/, '') || '/';
  if (locale === DEFAULT_LOCALE) return clean;
  return clean === '/' ? `/${locale}` : `/${locale}${clean}`;
}

/**
 * Returns a `t` function for a locale. Missing keys fall back to English,
 * then to the key itself, so a half finished translation never renders blank.
 * Placeholders use {name} syntax.
 */
export function useTranslations(locale: Locale) {
  const dict = dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
  const fallback = dictionaries[DEFAULT_LOCALE];

  return function t(key: string, vars?: Record<string, string | number>): string {
    let value = dict[key] ?? fallback[key] ?? key;
    if (vars) {
      for (const [name, replacement] of Object.entries(vars)) {
        value = value.split(`{${name}}`).join(String(replacement));
      }
    }
    return value;
  };
}

export type Translate = ReturnType<typeof useTranslations>;
