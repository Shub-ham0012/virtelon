"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({
  href,
  icon,
  children,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${
        active
          ? "bg-white/10 font-semibold text-(--rail-ink)"
          : "text-(--rail-sub) hover:bg-white/5 hover:text-(--rail-ink)"
      }`}
    >
      <span className={`h-4 w-4 flex-none ${active ? "text-(--accent)" : ""}`}>{icon}</span>
      <span className="flex-1">{children}</span>
      {badge}
    </Link>
  );
}
