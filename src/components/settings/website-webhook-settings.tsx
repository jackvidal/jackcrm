"use client";

import { useEffect, useState, useTransition } from "react";
import type { FunctionReturnType } from "convex/server";
import { Copy, Eye, EyeOff, Link2 } from "lucide-react";
import type { api } from "../../../convex/_generated/api";
import { configureWebsiteWebhookAction } from "@/app/(dashboard)/settings/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/utils";

type Webhook = FunctionReturnType<typeof api.leadWebhooks.current>;

export function WebsiteWebhookSettings({ initialWebhook }: { initialWebhook: Webhook }) {
  const [webhook, setWebhook] = useState(initialWebhook);
  const [origin, setOrigin] = useState("");
  const [visible, setVisible] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  useEffect(() => { setOrigin(window.location.origin); }, []);
  useEffect(() => { setWebhook(initialWebhook); }, [initialWebhook]);
  const url = webhook?.enabled && origin ? `${origin}/api/webhooks/leads?token=${webhook.token}` : "";

  function configure(action: "create" | "rotate" | "disable") {
    if (action === "rotate" && !confirm("החלפת הכתובת תפסיק את פעולת הכתובת הקיימת. לאחר מכן יש לעדכן אותה בטפסים המחוברים. להמשיך?")) return;
    if (action === "disable" && !confirm("להשבית קליטת לידים מטפסי האתר? הלידים הקיימים יישמרו.")) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await configureWebsiteWebhookAction(action);
        if (result.error) { setError(result.error); return; }
        setWebhook(result.webhook ?? null);
        setVisible(false);
        toast({ title: action === "disable" ? "הוובהוק הושבת" : "כתובת הוובהוק מוכנה לחיבור", variant: "success" });
      } catch { setError("לא ניתן לעדכן את הוובהוק כרגע. נסו שוב."); }
    });
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "הכתובת הועתקה", variant: "success" });
    } catch { setError("ההעתקה לא הצליחה. אפשר להציג את הכתובת ולהעתיק ידנית."); }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Link2 className="h-5 w-5" />לידים מטופס באתר</CardTitle>
        <CardDescription>חברו טופס באתר או כלי אוטומציה לוובהוק האישי שלכם. כל פנייה חדשה תיכנס לחשבון כליד חדש.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm font-medium">מצב: {webhook?.enabled ? "פעיל" : "לא פעיל"}</p>
        {webhook?.enabled ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="website-webhook-url">כתובת הוובהוק</Label>
              <div className="flex gap-2">
                <Input id="website-webhook-url" type={visible ? "text" : "password"} value={url} readOnly dir="ltr" autoComplete="off" className="min-w-0 text-start" />
                <Button variant="outline" size="icon" onClick={() => setVisible(!visible)} aria-label={visible ? "הסתר כתובת" : "הצג כתובת"}>{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                <Button variant="outline" onClick={copyUrl} disabled={!url}><Copy className="h-4 w-4" />העתקה</Button>
              </div>
              <p className="text-xs text-muted-foreground">הכתובת כוללת מפתח אישי. הדביקו אותה בהגדרות הוובהוק של הטופס או בצד השרת, ולא בקוד גלוי של האתר.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={pending} onClick={() => configure("rotate")}>החלפת כתובת</Button>
              <Button variant="outline" disabled={pending} onClick={() => configure("disable")}>השבתת וובהוק</Button>
            </div>
          </>
        ) : <Button disabled={pending} onClick={() => configure("create")}>{pending ? "יוצר כתובת..." : webhook ? "יצירת כתובת והפעלה מחדש" : "יצירת כתובת וובהוק"}</Button>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {webhook && <p className="text-sm text-muted-foreground">{webhook.lastReceivedAt ? `פנייה אחרונה: ${formatDateTime(new Date(webhook.lastReceivedAt))} · ${webhook.receivedCount} פניות התקבלו` : "עדיין לא התקבלו פניות דרך הוובהוק"}</p>}

        <details className="rounded-md border border-border p-3 text-sm">
          <summary className="cursor-pointer font-medium">הוראות חיבור ומיפוי שדות</summary>
          <div className="mt-3 space-y-3 leading-relaxed">
            <p>בחרו בפעולת Webhook בטופס או ב־Make / Zapier, הדביקו את הכתובת ושלחו בקשת POST. נתמכים JSON, טופס רגיל וטופס multipart ללא קבצים.</p>
            <p>ב־Elementor הוסיפו Webhook לפעולות לאחר שליחה, הפעילו Advanced Data והגדירו את מזהי השדות לפי הטבלה. נתמכים גם שדות מקוננים בתוך fields או form_fields.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead><tr className="border-b"><th className="py-2 text-start">שדה</th><th className="py-2 text-start">מזהים נתמכים</th><th className="py-2 text-start">חובה</th></tr></thead>
                <tbody>
                  {[
                    ["שם מלא", "fullName / full_name / name", "כן"],
                    ["אימייל", "email", "אימייל או טלפון"],
                    ["טלפון", "phone / telephone / tel / mobile", "אימייל או טלפון"],
                    ["חברה", "company / company_name", "לא"],
                    ["אתר", "websiteUrl / website_url / website", "לא"],
                    ["תוכן הפנייה", "notes / message / comments", "לא"],
                    ["מקור", "source / utm_source", "לא — ברירת המחדל: טופס אתר"],
                  ].map(([label, keys, required]) => <tr key={label} className="border-b last:border-0"><td className="py-2 pe-3">{label}</td><td className="py-2 pe-3" dir="ltr">{keys}</td><td className="py-2">{required}</td></tr>)}
                </tbody>
              </table>
            </div>
            <p>אפשר לשלוח גם first_name ו־last_name במקום שם מלא. טלפון נשלח כטקסט, כולל קידומת המדינה אם קיימת.</p>
            <pre dir="ltr" className="overflow-x-auto rounded bg-muted p-3 text-left text-xs">{JSON.stringify({ fullName: "ישראל ישראלי", email: "lead@example.com", company: "עסק לדוגמה", message: "אשמח לשמוע פרטים", source: "website", submissionId: "unique-form-submission-123" }, null, 2)}</pre>
            <p>פנייה עם אימייל או טלפון קיימים תתווסף כהערה לליד הקיים, בלי לשנות את שלב המכירה. אם האימייל והטלפון שייכים לשני לידים שונים, תוחזר שגיאת 409 לבדיקת הפרטים.</p>
            <p>למניעת כפילויות בשליחה חוזרת, שלחו submissionId ייחודי לכל פנייה ושמרו אותו בניסיונות חוזרים. ללא מזהה, תוכן זהה מסונן באותו יום UTC. בקשה תקינה מחזירה 200 עם ok: true.</p>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
