import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TARGET_EMAIL = "jack@jackvidal.com";

const profile = await prisma.profile.findUnique({
  where: { email: TARGET_EMAIL },
});
if (!profile) {
  console.error(`No profile found for ${TARGET_EMAIL}.`);
  console.error("Existing profiles:");
  const all = await prisma.profile.findMany();
  for (const p of all) console.error(`  - ${p.email}`);
  process.exit(1);
}
console.log(`Owner: ${profile.email} (${profile.id})\n`);

const leads = [
  { fullName: "דוד כהן",        company: "Tech Solutions Ltd",  email: "david@techsolutions.co.il",   phone: "+972-50-123-4567", websiteUrl: "https://techsolutions.co.il", status: "NEW",                source: "manual",  notes: "מתעניין בפתרון CRM למשרד שלו" },
  { fullName: "מיכל לוי",       company: "Marketing Pro",       email: "michal@marketingpro.co.il",   phone: "+972-52-234-5678", websiteUrl: "https://marketingpro.co.il", status: "MEETING_SCHEDULED",  source: "manual",  notes: "פגישה ראשונה ב־15 לחודש, מנהלת חברת שיווק קטנה" },
  { fullName: "יוסי מזרחי",     company: "InnoVate Digital",    email: "yossi@innovate.co.il",        phone: "+972-54-345-6789", websiteUrl: "https://innovate.co.il",     status: "NEW",                source: "manual",  notes: null },
  { fullName: "רונית פרץ",      company: "Bright Studios",      email: "ronit@brightstudios.com",     phone: "+972-50-456-7890", websiteUrl: "https://brightstudios.com",  status: "DEAL_CLOSED",        source: "manual",  notes: "סגרה חבילה שנתית, מרוצה מאוד" },
  { fullName: "אסף דהן",        company: "Solar Energy IL",     email: "asaf@solar-il.co.il",         phone: "+972-53-567-8901", websiteUrl: "https://solar-il.co.il",     status: "MEETING_COMPLETED",  source: "cal.com", notes: "פגישה עברה טוב, מחכה להחלטה לגבי תקציב" },
  { fullName: "נועה אברהם",     company: "Kosher Kitchen",      email: "noa@kosherkitchen.co.il",     phone: "+972-58-678-9012", websiteUrl: null,                          status: "NEW",                source: "manual",  notes: "הגיעה דרך המלצה מלקוח קיים" },
  { fullName: "איתי ביטון",     company: "Fitness First TLV",   email: "itay@fitnessfirst.co.il",     phone: "+972-50-789-0123", websiteUrl: "https://fitnessfirst.co.il", status: "DEAL_LOST",          source: "manual",  notes: "בחר במתחרה בגלל מחיר" },
  { fullName: "שירה אזולאי",    company: "DesignHub",           email: "shira@designhub.co.il",       phone: "+972-52-890-1234", websiteUrl: "https://designhub.co.il",    status: "MEETING_SCHEDULED",  source: "cal.com", notes: "פגישה ב־22 לחודש, מחפשת פתרון לסטודיו עיצוב" },
  { fullName: "עמית חדד",       company: "CodeWave",            email: "amit@codewave.io",            phone: "+972-54-901-2345", websiteUrl: "https://codewave.io",        status: "NEW",                source: "manual",  notes: null },
  { fullName: "ליאור סבן",      company: "RealEstate IL",       email: "lior@realestate-il.com",      phone: "+972-50-012-3456", websiteUrl: "https://realestate-il.com",  status: "MEETING_COMPLETED",  source: "manual",  notes: "מעוניין להתקדם, ממתין לחתימה" },
  { fullName: "דניאל אוחנה",    company: "Yoga Studio TLV",     email: "daniel@yogatlv.co.il",        phone: "+972-53-123-4567", websiteUrl: "https://yogatlv.co.il",      status: "DEAL_CLOSED",        source: "cal.com", notes: "התחילה עם החבילה הבסיסית, יש פוטנציאל לשדרוג" },
  { fullName: "מאיה עמר",       company: "Beauty Lounge",       email: "maya@beautylounge.co.il",     phone: "+972-58-234-5678", websiteUrl: null,                          status: "NEW",                source: "import", notes: "מאחסנת לקוחות באקסל כיום, מוכנה למעבר" },
  { fullName: "גיא חזן",        company: "Cyber Defense",       email: "guy@cyberdefense.co.il",      phone: "+972-50-345-6789", websiteUrl: "https://cyberdefense.co.il", status: "MEETING_SCHEDULED",  source: "manual",  notes: "פגישה טכנית — מעוניין לדעת על אבטחה ו־RLS" },
  { fullName: "טל ישראלי",      company: "Israeli Wines",       email: "tal@israeliwines.com",        phone: "+972-52-456-7890", websiteUrl: "https://israeliwines.com",   status: "NEW",                source: "manual",  notes: "יקב בוטיק קטן, מחפש לעקוב אחרי לקוחות B2B" },
  { fullName: "רן שמעון",       company: "Pet Care Plus",       email: "ran@petcareplus.co.il",       phone: "+972-54-567-8901", websiteUrl: "https://petcareplus.co.il",  status: "MEETING_COMPLETED",  source: "manual",  notes: "רשת חנויות קטנה, פגישה עברה מצוין" },
  { fullName: "איל אלעזר",      company: "Photo Pro Studio",    email: "eyal@photopro.co.il",         phone: "+972-50-678-9012", websiteUrl: "https://photopro.co.il",     status: "DEAL_LOST",          source: "import", notes: "בחר לדחות את ההחלטה לרבעון הבא" },
  { fullName: "שני פרידמן",     company: "TechStartup IL",      email: "shani@techstartup.co.il",     phone: "+972-53-789-0123", websiteUrl: "https://techstartup.co.il",  status: "NEW",                source: "manual",  notes: null },
  { fullName: "אורי גולדברג",   company: "LogisticPro",         email: "uri@logisticpro.co.il",       phone: "+972-58-890-1234", websiteUrl: "https://logisticpro.co.il",  status: "MEETING_SCHEDULED",  source: "cal.com", notes: "חברת לוגיסטיקה, מחפש לעקוב אחר לידים בצינור המכירה" },
  { fullName: "יעל ברק",        company: "EdTech Israel",       email: "yael@edtech-il.com",          phone: "+972-50-901-2345", websiteUrl: "https://edtech-il.com",      status: "DEAL_CLOSED",        source: "manual",  notes: "סגרה חבילה פרימיום, מתעניינת באינטגרציות נוספות" },
  { fullName: "רועי סלע",       company: "Mobile Apps Co",      email: "roi@mobileapps.co.il",        phone: "+972-52-012-3456", websiteUrl: "https://mobileapps.co.il",   status: "NEW",                source: "manual",  notes: "פיתוח אפליקציות, התעניין דרך לינקדאין" },
];

console.log(`Creating ${leads.length} leads...\n`);

// Spread createdAt across last 14 days for realism
const now = Date.now();
const created = await Promise.all(
  leads.map((lead, i) =>
    prisma.lead.create({
      data: {
        ...lead,
        ownerId: profile.id,
        createdAt: new Date(now - i * (14 * 24 * 60 * 60 * 1000) / leads.length),
      },
    }),
  ),
);

console.log(`✓ Created ${created.length} leads:\n`);
const byStatus = created.reduce((acc, l) => ((acc[l.status] = (acc[l.status] || 0) + 1), acc), {});
for (const [status, count] of Object.entries(byStatus)) {
  console.log(`  ${status}: ${count}`);
}

await prisma.$disconnect();
