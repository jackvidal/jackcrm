import { requireUser } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { getBranding } from "@/lib/branding-server";
import { brandingVariables } from "@/lib/branding";

export async function generateMetadata() {
  await requireUser();
  const branding = await getBranding();
  return { title: { absolute: branding.name }, ...(branding.logoUrl ? { icons: { icon: branding.logoUrl } } : {}) };
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const branding = await getBranding();
  const { logoUrl: _logo, ...preferences } = branding;
  const variables = Object.entries(brandingVariables(preferences)).map(([key, value]) => `${key}:${value}`).join(";");

  return (
    <div className="flex min-h-screen bg-secondary/40">
      <style>{`:root,:root.dark{${variables}}`}</style>
      <Sidebar branding={branding} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar fullName={user.fullName} email={user.email} branding={branding} />
        <main className="flex-1 overflow-x-auto p-6">{children}</main>
      </div>
    </div>
  );
}
