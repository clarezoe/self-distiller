// Cookie-based locale (no URL prefix) for the internal 2-language panel.
export const LOCALES = ["en", "zh"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

// Cookie the panel reads/writes to remember the owner's language choice.
export const LOCALE_COOKIE = "locale";

export function isLocale(value: string | undefined): value is Locale {
  return value === "en" || value === "zh";
}
