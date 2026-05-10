import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const events = await prisma.webhookEvent.findMany({
  orderBy: { createdAt: "desc" },
  take: 10,
});

console.log("\n=== webhook_events (most recent 10) ===");
console.log(`Found ${events.length} event(s)\n`);
for (const e of events) {
  const payload = e.payload;
  console.log(`[${e.createdAt.toISOString()}] ${e.source} / ${e.externalId}`);
  console.log(`  processed: ${e.processedAt ?? "NO"}`);
  console.log(`  error: ${e.error ?? "—"}`);
  console.log(
    `  organizer email: ${payload?.payload?.organizer?.email ?? "(missing)"}`,
  );
  console.log(
    `  attendee email: ${payload?.payload?.attendees?.[0]?.email ?? "(missing)"}`,
  );
  console.log("");
}

console.log("\n=== profiles ===");
const profiles = await prisma.profile.findMany();
for (const p of profiles) {
  console.log(`${p.email} (calOrganizerEmail=${p.calOrganizerEmail ?? "NULL"})`);
}

console.log("\n=== leads (most recent 5) ===");
const leads = await prisma.lead.findMany({
  orderBy: { createdAt: "desc" },
  take: 5,
});
console.log(`Found ${leads.length} lead(s)`);
for (const l of leads) {
  console.log(`  ${l.fullName} — ${l.email} — source=${l.source} — status=${l.status}`);
}

await prisma.$disconnect();
