import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, signOut } from "@/lib/auth";

const SECTIONS = [
  { href: "/", label: "Dashboard" },
  { href: "/import", label: "Import" },
  { href: "/interview", label: "Interview Studio" },
  { href: "/calibration", label: "Calibration" },
  { href: "/self-model", label: "Self Model" },
  { href: "/contexts", label: "Contexts" },
  { href: "/tasks", label: "Tasks" },
  { href: "/versions", label: "Versions" },
  { href: "/settings", label: "Settings" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="px-2 pb-4">
          <p className="text-sm font-semibold">Self Distiller</p>
        </div>
        <nav className="flex-1 space-y-1">
          {SECTIONS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="block rounded-md px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              {s.label}
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
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
