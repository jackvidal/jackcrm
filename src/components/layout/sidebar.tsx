"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  CheckSquare,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/he";
import { BrandMark } from "./brand-mark";
import type { Branding } from "@/lib/branding";

const items = [
  { href: "/dashboard", label: t.nav.dashboard, icon: LayoutDashboard },
  { href: "/leads", label: t.nav.leads, icon: Users },
  { href: "/meetings", label: t.nav.meetings, icon: CalendarDays },
  { href: "/tasks", label: t.nav.tasks, icon: CheckSquare },
  { href: "/settings", label: t.nav.settings, icon: Settings },
];

export function Sidebar({ branding }: { branding: Branding }) {
  const pathname = usePathname();

  return (
    <aside className="brand-sidebar hidden w-60 shrink-0 border-s border-border md:block" data-custom={!!branding.sidebarColor}>
      <div className="flex h-16 items-center px-4"><BrandMark name={branding.name} logoUrl={branding.logoUrl} /></div>
      <nav className="mt-4 px-3">
        <ul className="space-y-1">
          {items.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href ||
              (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
