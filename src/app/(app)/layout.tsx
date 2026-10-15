import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { MobileNav } from "@/components/mobile-nav";
import { SidebarLink } from "@/components/sidebar-link";
import { getCurrentUser, signOut } from "@/lib/auth";

const SECTIONS = [
  { href: "/", key: "dashboard" },
  { href: "/import", key: "import" },
  { href: "/interview", key: "interview" },
  { href: "/calibration", key: "calibration" },
  { href: "/self-model", key: "selfModel" },
  { href: "/contexts", key: "contexts" },
  { href: "/tasks", key: "tasks" },
  { href: "/versions", key: "versions" },
  { href: "/settings", key: "settings" },
] as const;

// Mobile bottom bar: Interview is the primary tab; the rest go to the "More" sheet.
const MOBILE_PRIMARY = "/interview";
const MOBILE_TABS = ["/", "/self-model", "/tasks"];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const tNav = await getTranslations("nav");
  const tCommon = await getTranslations("common");

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  const labelOf = (href: string) => {
    const sec = SECTIONS.find((x) => x.href === href)!;
    return { href, label: tNav(sec.key) };
  };
  const moreItems = SECTIONS.filter(
    (x) => x.href !== MOBILE_PRIMARY && !MOBILE_TABS.includes(x.href),
  ).map((x) => labelOf(x.href));

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <header className="sticky top-0 z-30 flex min-h-12 shrink-0 items-center border-b border-neutral-200 bg-white/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden dark:border-neutral-800 dark:bg-neutral-950/95">
        <p className="text-sm font-semibold">{tCommon("appName")}</p>
      </header>
      <aside className="hidden w-60 shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 p-4 md:flex dark:border-neutral-800 dark:bg-neutral-950">
        <div className="px-2 pb-4">
          <p className="text-sm font-semibold">{tCommon("appName")}</p>
        </div>
        <nav className="flex-1 space-y-1">
          {SECTIONS.map((s) => (
            <SidebarLink key={s.href} href={s.href}>
              {tNav(s.key)}
            </SidebarLink>
          ))}
        </nav>
        <div className="space-y-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
          <p className="truncate px-2 text-xs text-neutral-500">{user.email}</p>
          <form action={logout}>
            <button
              type="submit"
              className="w-full rounded-md px-2 py-1.5 text-left text-sm text-neutral-700 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              {tCommon("signOut")}
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] md:p-8">
        {children}
      </main>
      <MobileNav
        primary={{ ...labelOf(MOBILE_PRIMARY), label: tNav("interviewShort") }}
        tabs={MOBILE_TABS.map(labelOf)}
        more={moreItems}
        moreLabel={tNav("more")}
        closeLabel={tNav("close")}
        navLabel={tNav("primaryNav")}
        moreSheetLabel={tNav("moreSections")}
        moreSlot={
          <div className="space-y-1">
            <p className="truncate px-3 text-xs text-neutral-500">{user.email}</p>
            <form action={logout}>
              <button
                type="submit"
                className="flex min-h-11 w-full items-center rounded-md px-3 text-left text-base text-neutral-800 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                {tCommon("signOut")}
              </button>
            </form>
            <p className="px-3 pt-2 text-xs text-neutral-500">{tNav("installHelp")}</p>
          </div>
        }
      />
    </div>
  );
}
