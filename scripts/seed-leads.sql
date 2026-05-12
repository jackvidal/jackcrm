-- ════════════════════════════════════════════════════════════════════════════
-- Seed 20 Hebrew leads for jack@jackvidal.com
--
-- HOW TO RUN:
-- 1. Open Supabase → your jackcrm project → SQL Editor → New query
-- 2. Paste this entire file
-- 3. Click Run
--
-- The DO block resolves the owner UUID from the email automatically and
-- inserts 20 leads spread across the last 14 days with varied statuses.
-- Safe to re-run: leads will be inserted again (no UNIQUE constraint),
-- so only run this once unless you want duplicates.
-- ════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  owner_uuid UUID;
BEGIN
  SELECT id INTO owner_uuid FROM public.profiles WHERE email = 'jack@jackvidal.com';
  IF owner_uuid IS NULL THEN
    RAISE EXCEPTION 'No profile found for jack@jackvidal.com — sign up on the live site first';
  END IF;

  INSERT INTO public.leads
    (id, owner_id, full_name, email, phone, company, website_url, source, status, notes, created_at, updated_at)
  VALUES
    (gen_random_uuid(), owner_uuid, 'דוד כהן',        'david@techsolutions.co.il',   '+972-50-123-4567', 'Tech Solutions Ltd', 'https://techsolutions.co.il', 'manual',  'NEW'::"LeadStatus",                'מתעניין בפתרון CRM למשרד שלו',                            NOW() - INTERVAL '0 days',  NOW()),
    (gen_random_uuid(), owner_uuid, 'מיכל לוי',       'michal@marketingpro.co.il',   '+972-52-234-5678', 'Marketing Pro',      'https://marketingpro.co.il',  'manual',  'MEETING_SCHEDULED'::"LeadStatus",  'פגישה ראשונה ב־15 לחודש, מנהלת חברת שיווק קטנה',          NOW() - INTERVAL '1 days',  NOW()),
    (gen_random_uuid(), owner_uuid, 'יוסי מזרחי',     'yossi@innovate.co.il',        '+972-54-345-6789', 'InnoVate Digital',   'https://innovate.co.il',      'manual',  'NEW'::"LeadStatus",                NULL,                                                       NOW() - INTERVAL '2 days',  NOW()),
    (gen_random_uuid(), owner_uuid, 'רונית פרץ',      'ronit@brightstudios.com',     '+972-50-456-7890', 'Bright Studios',     'https://brightstudios.com',   'manual',  'DEAL_CLOSED'::"LeadStatus",        'סגרה חבילה שנתית, מרוצה מאוד',                             NOW() - INTERVAL '3 days',  NOW()),
    (gen_random_uuid(), owner_uuid, 'אסף דהן',        'asaf@solar-il.co.il',         '+972-53-567-8901', 'Solar Energy IL',    'https://solar-il.co.il',      'cal.com', 'MEETING_COMPLETED'::"LeadStatus",  'פגישה עברה טוב, מחכה להחלטה לגבי תקציב',                  NOW() - INTERVAL '4 days',  NOW()),
    (gen_random_uuid(), owner_uuid, 'נועה אברהם',     'noa@kosherkitchen.co.il',     '+972-58-678-9012', 'Kosher Kitchen',     NULL,                          'manual',  'NEW'::"LeadStatus",                'הגיעה דרך המלצה מלקוח קיים',                              NOW() - INTERVAL '5 days',  NOW()),
    (gen_random_uuid(), owner_uuid, 'איתי ביטון',     'itay@fitnessfirst.co.il',     '+972-50-789-0123', 'Fitness First TLV',  'https://fitnessfirst.co.il',  'manual',  'DEAL_LOST'::"LeadStatus",          'בחר במתחרה בגלל מחיר',                                     NOW() - INTERVAL '6 days',  NOW()),
    (gen_random_uuid(), owner_uuid, 'שירה אזולאי',    'shira@designhub.co.il',       '+972-52-890-1234', 'DesignHub',          'https://designhub.co.il',     'cal.com', 'MEETING_SCHEDULED'::"LeadStatus",  'פגישה ב־22 לחודש, מחפשת פתרון לסטודיו עיצוב',             NOW() - INTERVAL '7 days',  NOW()),
    (gen_random_uuid(), owner_uuid, 'עמית חדד',       'amit@codewave.io',            '+972-54-901-2345', 'CodeWave',           'https://codewave.io',         'manual',  'NEW'::"LeadStatus",                NULL,                                                       NOW() - INTERVAL '8 days',  NOW()),
    (gen_random_uuid(), owner_uuid, 'ליאור סבן',      'lior@realestate-il.com',      '+972-50-012-3456', 'RealEstate IL',      'https://realestate-il.com',   'manual',  'MEETING_COMPLETED'::"LeadStatus",  'מעוניין להתקדם, ממתין לחתימה',                            NOW() - INTERVAL '9 days',  NOW()),
    (gen_random_uuid(), owner_uuid, 'דניאל אוחנה',    'daniel@yogatlv.co.il',        '+972-53-123-4567', 'Yoga Studio TLV',    'https://yogatlv.co.il',       'cal.com', 'DEAL_CLOSED'::"LeadStatus",        'התחילה עם החבילה הבסיסית, יש פוטנציאל לשדרוג',            NOW() - INTERVAL '10 days', NOW()),
    (gen_random_uuid(), owner_uuid, 'מאיה עמר',       'maya@beautylounge.co.il',     '+972-58-234-5678', 'Beauty Lounge',      NULL,                          'import',  'NEW'::"LeadStatus",                'מאחסנת לקוחות באקסל כיום, מוכנה למעבר',                   NOW() - INTERVAL '11 days', NOW()),
    (gen_random_uuid(), owner_uuid, 'גיא חזן',        'guy@cyberdefense.co.il',      '+972-50-345-6789', 'Cyber Defense',      'https://cyberdefense.co.il',  'manual',  'MEETING_SCHEDULED'::"LeadStatus",  'פגישה טכנית — מעוניין לדעת על אבטחה ו־RLS',               NOW() - INTERVAL '12 days', NOW()),
    (gen_random_uuid(), owner_uuid, 'טל ישראלי',      'tal@israeliwines.com',        '+972-52-456-7890', 'Israeli Wines',      'https://israeliwines.com',    'manual',  'NEW'::"LeadStatus",                'יקב בוטיק קטן, מחפש לעקוב אחרי לקוחות B2B',               NOW() - INTERVAL '13 days', NOW()),
    (gen_random_uuid(), owner_uuid, 'רן שמעון',       'ran@petcareplus.co.il',       '+972-54-567-8901', 'Pet Care Plus',      'https://petcareplus.co.il',   'manual',  'MEETING_COMPLETED'::"LeadStatus",  'רשת חנויות קטנה, פגישה עברה מצוין',                       NOW() - INTERVAL '13 days', NOW()),
    (gen_random_uuid(), owner_uuid, 'איל אלעזר',      'eyal@photopro.co.il',         '+972-50-678-9012', 'Photo Pro Studio',   'https://photopro.co.il',      'import',  'DEAL_LOST'::"LeadStatus",          'בחר לדחות את ההחלטה לרבעון הבא',                          NOW() - INTERVAL '12 days', NOW()),
    (gen_random_uuid(), owner_uuid, 'שני פרידמן',     'shani@techstartup.co.il',     '+972-53-789-0123', 'TechStartup IL',     'https://techstartup.co.il',   'manual',  'NEW'::"LeadStatus",                NULL,                                                       NOW() - INTERVAL '11 days', NOW()),
    (gen_random_uuid(), owner_uuid, 'אורי גולדברג',   'uri@logisticpro.co.il',       '+972-58-890-1234', 'LogisticPro',        'https://logisticpro.co.il',   'cal.com', 'MEETING_SCHEDULED'::"LeadStatus",  'חברת לוגיסטיקה, מחפש לעקוב אחר לידים בצינור המכירה',      NOW() - INTERVAL '10 days', NOW()),
    (gen_random_uuid(), owner_uuid, 'יעל ברק',        'yael@edtech-il.com',          '+972-50-901-2345', 'EdTech Israel',      'https://edtech-il.com',       'manual',  'DEAL_CLOSED'::"LeadStatus",        'סגרה חבילה פרימיום, מתעניינת באינטגרציות נוספות',         NOW() - INTERVAL '9 days',  NOW()),
    (gen_random_uuid(), owner_uuid, 'רועי סלע',       'roi@mobileapps.co.il',        '+972-52-012-3456', 'Mobile Apps Co',     'https://mobileapps.co.il',    'manual',  'NEW'::"LeadStatus",                'פיתוח אפליקציות, התעניין דרך לינקדאין',                    NOW() - INTERVAL '8 days',  NOW());

  RAISE NOTICE 'Inserted 20 leads for jack@jackvidal.com';
END $$;

-- Verify (optional — paste this separately to count):
-- SELECT status, COUNT(*) FROM leads
-- WHERE owner_id = (SELECT id FROM profiles WHERE email = 'jack@jackvidal.com')
-- GROUP BY status ORDER BY status;
