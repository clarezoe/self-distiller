"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Desktop sidebar link with active-route highlighting + aria-current.
export function SidebarLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="block rounded-md px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-200 aria-[current=page]:bg-neutral-200 aria-[current=page]:font-semibold dark:text-neutral-300 dark:hover:bg-neutral-800 dark:aria-[current=page]:bg-neutral-800"
    >
      {children}
    </Link>
  );
}
