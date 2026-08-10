import { requireSession } from "@/lib/session";
import { signOut } from "@/lib/auth";
import { ROLE_LABELS } from "@virtelon/core/rbac";
import { NavLink } from "@/components/ui/nav-link";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  DashboardIcon,
  LeadsIcon,
  CampaignsIcon,
  OutreachIcon,
  AnalyticsIcon,
  ServicesIcon,
  TeamIcon,
  SettingsIcon,
} from "@/components/ui/nav-icons";

const WORKSPACE_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: <DashboardIcon /> },
  { href: "/leads", label: "Leads", icon: <LeadsIcon /> },
  { href: "/campaigns", label: "Campaigns", icon: <CampaignsIcon /> },
  { href: "/outreach", label: "Outreach", icon: <OutreachIcon /> },
  { href: "/analytics", label: "Analytics", icon: <AnalyticsIcon /> },
];

const ORG_LINKS = [
  { href: "/settings/offerings", label: "Services", icon: <ServicesIcon /> },
  { href: "/team", label: "Team", icon: <TeamIcon /> },
  { href: "/settings/organization", label: "Settings", icon: <SettingsIcon /> },
];

function initials(name: string | null | undefined, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSession();

  return (
    <div className="grid min-h-screen grid-cols-[226px_1fr]">
      <aside className="sticky top-0 flex h-screen flex-col gap-5 overflow-y-auto border-r border-(--rail-border) bg-(--rail-bg) p-3.5 text-(--rail-ink)">
        <div className="flex items-center gap-2.5 px-1.5">
          <div className="font-serif-display flex h-8 w-8 flex-none items-center justify-center rounded-md bg-(--accent) text-base font-semibold text-(--accent-ink)">
            V
          </div>
          <div>
            <div className="text-sm font-semibold">Virtelon</div>
            <div className="text-[11.5px] text-(--rail-sub)">{user.organizationSlug}</div>
          </div>
        </div>

        <div>
          <div className="px-2.5 pb-1 text-[10px] font-bold tracking-wide text-(--rail-sub) uppercase">Workspace</div>
          <nav className="flex flex-col gap-0.5">
            {WORKSPACE_LINKS.map((link) => (
              <NavLink key={link.href} href={link.href} icon={link.icon}>
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div>
          <div className="px-2.5 pb-1 text-[10px] font-bold tracking-wide text-(--rail-sub) uppercase">Organization</div>
          <nav className="flex flex-col gap-0.5">
            {ORG_LINKS.map((link) => (
              <NavLink key={link.href} href={link.href} icon={link.icon}>
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex-1" />

        <div className="flex flex-col gap-2">
          <ThemeToggle className="w-full" />
          <div className="flex items-center gap-2 border-t border-(--rail-border) px-1 pt-2.5">
            <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-(--accent-fill) text-[11px] font-bold text-(--accent)">
              {initials(user.name, user.email)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold">{user.name ?? user.email}</div>
              <div className="text-[10.5px] text-(--rail-sub)">{ROLE_LABELS[user.role]}</div>
            </div>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="w-full rounded-md px-2.5 py-1.5 text-left text-xs text-(--rail-sub) transition hover:bg-white/5 hover:text-(--rail-ink)"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="p-8">
        <div className="mx-auto max-w-[1180px]">{children}</div>
      </main>
    </div>
  );
}
