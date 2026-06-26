import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
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

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="px-2 pb-4">
          <p className="text-sm font-semibold">{tCommon("appName")}</p>
        </div>
        <nav className="flex-1 space-y-1">
          {SECTIONS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="block rounded-md px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              {tNav(s.key)}
            </Link>
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
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
