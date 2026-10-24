import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { LeadImport } from "@/components/leads/lead-import";

export default async function LeadImportPage() {
  await requireUser();
  return <div className="mx-auto max-w-5xl space-y-5"><Link href="/leads" className="text-sm text-primary hover:underline">חזרה ללידים</Link><h1 className="text-2xl font-semibold">ייבוא לידים מקובץ</h1><LeadImport /></div>;
}
