const LANGUAGE_NAMES: Record<string, string> = {
  zh: "中文",
  en: "English",
  sv: "Svenska",
  sr: "Srpski",
};

/** Human-readable label for a language code, e.g. "zh" -> "中文 (zh)". Unknown values are returned as-is. */
export function languageLabel(code: string): string {
  const name = LANGUAGE_NAMES[code.trim().toLowerCase()];
  return name ? `${name} (${code})` : code;
}
