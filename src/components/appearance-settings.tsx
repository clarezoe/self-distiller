"use client";

import { useSyncExternalStore, useTransition } from "react";
import { useTheme } from "next-themes";
import { useLocale, useTranslations } from "next-intl";
import { setLocale } from "@/i18n/actions";
import { LOCALES } from "@/i18n/config";

const card = "space-y-5 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800";

// Tri-state theme segmented control + language checklist. Theme is client-only
// (next-themes), language flips the `locale` cookie via a server action.
export function AppearanceSettings() {
  const t = useTranslations("appearance");
  const { theme, setTheme } = useTheme();
  const locale = useLocale();
  const [pending, startTransition] = useTransition();

  // Avoid hydration mismatch: theme is unknown on the server, so only reflect
  // the active segment after mount. useSyncExternalStore returns the server
  // snapshot (false) during SSR and the client snapshot (true) after hydration.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const themeOptions = [
    { value: "system", label: t("themeSystem") },
    { value: "light", label: t("themeLight") },
    { value: "dark", label: t("themeDark") },
  ];

  const localeLabel: Record<string, string> = {
    en: t("languageEn"),
    zh: t("languageZh"),
  };

  function changeLocale(next: string) {
    if (next === locale) return;
    startTransition(() => {
      void setLocale(next);
    });
  }

  return (
    <section className={card}>
      <header>
        <h2 className="font-medium">{t("title")}</h2>
        <p className="text-sm text-neutral-500">{t("subtitle")}</p>
      </header>

      <div className="space-y-2">
        <p className="text-sm font-medium">{t("themeLabel")}</p>
        <div className="inline-flex rounded-md border border-neutral-300 p-0.5 dark:border-neutral-700">
          {themeOptions.map((o) => {
            const active = mounted && theme === o.value;
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={active}
                onClick={() => setTheme(o.value)}
                className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                    : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">{t("languageLabel")}</p>
        <ul className="space-y-1">
          {LOCALES.map((l) => {
            const active = locale === l;
            return (
              <li key={l}>
                <button
                  type="button"
                  onClick={() => changeLocale(l)}
                  disabled={pending}
                  className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm disabled:opacity-50 ${
                    active
                      ? "border-neutral-900 dark:border-white"
                      : "border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                  }`}
                >
                  <span className={`w-4 ${active ? "" : "opacity-0"}`}>✓</span>
                  <span>{localeLabel[l]}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
