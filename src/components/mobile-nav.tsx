"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

const tabBase =
  "flex min-h-[56px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 whitespace-nowrap text-xs font-medium";

// Fixed bottom tab bar (below md). The first tab is the primary action (interview).
// `moreSlot` is server-rendered content (user email + sign-out form) shown in the sheet.
export function MobileNav({
  primary,
  tabs,
  more,
  moreLabel,
  closeLabel,
  navLabel,
  moreSheetLabel,
  moreSlot,
}: {
  primary: NavItem;
  tabs: NavItem[];
  more: NavItem[];
  moreLabel: string;
  closeLabel: string;
  navLabel: string;
  moreSheetLabel: string;
  moreSlot: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const moreBtn = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    sheet.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        moreBtn.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const moreActive = more.some((m) => isActive(pathname, m.href));
  const primaryActive = isActive(pathname, primary.href);

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label={closeLabel}
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div
            id="mobile-more-sheet"
            ref={sheet}
            role="dialog"
            aria-label={moreSheetLabel}
            className="absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-2xl border-t border-neutral-200 bg-white p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] dark:border-neutral-800 dark:bg-neutral-950"
          >
            <ul className="space-y-1">
              {more.map((m) => (
                <li key={m.href}>
                  <Link
                    href={m.href}
                    aria-current={isActive(pathname, m.href) ? "page" : undefined}
                    className="flex min-h-11 items-center rounded-md px-3 text-base text-neutral-800 hover:bg-neutral-100 aria-[current=page]:bg-neutral-200 aria-[current=page]:font-semibold dark:text-neutral-200 dark:hover:bg-neutral-800 dark:aria-[current=page]:bg-neutral-800"
                  >
                    {m.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-3 border-t border-neutral-200 pt-3 dark:border-neutral-800">{moreSlot}</div>
          </div>
        </div>
      ) : null}

      <nav
        aria-label={navLabel}
        className="fixed inset-x-0 bottom-0 z-50 flex border-t border-neutral-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-neutral-800 dark:bg-neutral-950/95"
      >
        <Link
          href={primary.href}
          aria-current={primaryActive ? "page" : undefined}
          className={`${tabBase} mx-1 my-1 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 ${primaryActive ? "ring-2 ring-neutral-400" : ""}`}
        >
          <span className="max-w-full truncate">{primary.label}</span>
        </Link>
        {tabs.map((t) => {
          const active = isActive(pathname, t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`${tabBase} ${active ? "text-neutral-900 dark:text-white" : "text-neutral-500"} ${active ? "border-t-2 border-neutral-900 dark:border-white" : "border-t-2 border-transparent"}`}
            >
              <span className="max-w-full truncate">{t.label}</span>
            </Link>
          );
        })}
        <button
          ref={moreBtn}
          type="button"
          aria-expanded={open}
          aria-controls="mobile-more-sheet"
          aria-haspopup="dialog"
          onClick={() => setOpen((o) => !o)}
          className={`${tabBase} ${moreActive || open ? "text-neutral-900 dark:text-white" : "text-neutral-500"} border-t-2 ${moreActive ? "border-neutral-900 dark:border-white" : "border-transparent"}`}
        >
          <span className="max-w-full truncate">{moreLabel}</span>
        </button>
      </nav>
    </>
  );
}
