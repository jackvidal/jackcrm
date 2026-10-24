"use client";

import { LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useAuthActions } from "@convex-dev/auth/react";
import { t } from "@/i18n/he";
import { BrandMark } from "./brand-mark";
import type { Branding } from "@/lib/branding";

export function Topbar({
  fullName,
  email,
  branding,
}: {
  fullName: string | null;
  email: string;
  branding: Branding;
}) {
  const { signOut } = useAuthActions();
  async function logoutAction() { await signOut(); window.location.assign("/login"); }
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-sm">
      <div className="min-w-0 md:hidden"><BrandMark name={branding.name} logoUrl={branding.logoUrl} /></div>
      <h1 className="hidden text-base font-medium text-muted-foreground md:block">
        {t.dashboard.welcome}
        {fullName ? `, ${fullName}` : ""}
      </h1>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full">
            <UserIcon className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{fullName ?? "—"}</span>
              <span className="text-xs text-muted-foreground" dir="ltr">
                {email}
              </span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <form action={logoutAction}>
            <DropdownMenuItem asChild>
              <button
                type="submit"
                className="flex w-full cursor-pointer items-center gap-2 text-destructive"
              >
                <LogOut className="h-4 w-4" />
                {t.nav.logout}
              </button>
            </DropdownMenuItem>
          </form>
        </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
