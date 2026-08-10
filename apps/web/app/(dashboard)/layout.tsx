import Link from "next/link";
import { requireSession } from "@/lib/session";
import { signOut } from "@/lib/auth";
import { ROLE_LABELS } from "@virtelon/core/rbac";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/leads", label: "Leads" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/outreach", label: "Outreach" },
  { href: "/settings/offerings", label: "Services" },
  { href: "/team", label: "Team" },
  { href: "/settings/organization", label: "Settings" },
];

const COMING_SOON = ["Inbox", "Follow-ups", "Analytics", "Integrations"];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSession();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-col border-r border-(--border) bg-(--surface) p-4">
        <div className="mb-6 px-2">
          <div className="text-sm font-semibold">{user.organizationSlug}</div>
          <div className="text-xs text-(--sub)">Virtelon Platform</div>
        </div>

        <nav className="flex-1 space-y-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block rounded-lg px-3 py-2 text-sm hover:bg-(--bg)"
            >
              {link.label}
            </Link>
          ))}

          <div className="mt-6 px-3 text-xs font-medium uppercase tracking-wide text-(--sub)">
            Coming soon
          </div>
          {COMING_SOON.map((label) => (
            <div key={label} className="cursor-not-allowed rounded-lg px-3 py-2 text-sm text-(--sub)">
              {label}
            </div>
          ))}
        </nav>

        <div className="border-t border-(--border) pt-3">
          <div className="px-2 text-sm">{user.name ?? user.email}</div>
          <div className="px-2 text-xs text-(--sub)">{ROLE_LABELS[user.role]}</div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button type="submit" className="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-(--bg)">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
