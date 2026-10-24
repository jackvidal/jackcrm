"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthToken } from "@convex-dev/auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveBrandingAction, refreshBrandLogoAction } from "@/app/(dashboard)/settings/actions";
import { brandingSchema, contrastText, DEFAULT_BRANDING, LOGO_MAX_BYTES, METRIC_KEYS, METRIC_LABELS, type Branding, type BrandingPreferences } from "@/lib/branding";
import { LEAD_STATUSES } from "@/lib/leads";
import { t } from "@/i18n/he";

function ColorField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return <div className="space-y-1.5">
    <Label htmlFor={id}>{label}</Label>
    <div className="flex items-center gap-2">
      <input type="color" aria-label={`בחירת צבע: ${label}`} value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"} onChange={(event) => onChange(event.target.value)} className="h-10 w-12 shrink-0 cursor-pointer rounded-md border bg-card p-1" />
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} dir="ltr" maxLength={7} pattern="#[0-9a-fA-F]{6}" required className="font-mono" />
    </div>
  </div>;
}

export function BrandingSettings({ initial }: { initial: Branding }) {
  const { logoUrl: initialLogo, ...initialPreferences } = initial;
  const [preferences, setPreferences] = useState<BrandingPreferences>(initialPreferences);
  const [logoUrl, setLogoUrl] = useState(initialLogo);
  const [busy, setBusy] = useState<"save" | "upload" | "remove" | null>(null);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const token = useAuthToken();
  const router = useRouter();
  const parsed = brandingSchema.safeParse(preferences);
  const preview = parsed.success ? parsed.data : initialPreferences;
  const change = (update: Partial<BrandingPreferences>) => { setPreferences((p) => ({ ...p, ...update })); setMessage(""); };

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    lock.current = true; setBusy("save"); setError(""); setMessage("");
    try {
      const result = await saveBrandingAction(parsed.data);
      if (result.error) throw new Error(result.error);
      setMessage("העיצוב נשמר והוחל על המערכת"); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "השמירה נכשלה. נסו שוב."); }
    finally { lock.current = false; setBusy(null); }
  }

  async function logo(file?: File) {
    if (lock.current) return;
    setError(""); setMessage("");
    if (file && (!file.size || file.size > LOGO_MAX_BYTES || !["image/png", "image/jpeg", "image/webp"].includes(file.type))) {
      setError("בחרו קובץ PNG, JPG או WebP בגודל עד 2 MB");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    lock.current = true; setBusy(file ? "upload" : "remove");
    try {
      if (file) {
        if (!token) throw new Error("יש להתחבר מחדש כדי להעלות לוגו");
        // Decode before upload so an invalid image cannot replace the current logo.
        const bitmap = await createImageBitmap(file); bitmap.close();
        const response = await fetch(new URL("/brand-logo", process.env.NEXT_PUBLIC_CONVEX_SITE_URL!), { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": file.type }, body: file });
        if (!response.ok) throw new Error("העלאת הלוגו נכשלה. בדקו את הקובץ ונסו שוב.");
      }
      const result = await refreshBrandLogoAction(!file);
      if (result.error) throw new Error(result.error);
      setLogoUrl(result.logoUrl ?? null);
      setMessage(file ? "הלוגו הועלה ונשמר" : "הלוגו הוסר"); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "עדכון הלוגו נכשל. נסו שוב."); }
    finally { lock.current = false; setBusy(null); if (inputRef.current) inputRef.current.value = ""; }
  }

  return <Card id="branding">
    <CardHeader><CardTitle>מיתוג וצבעים</CardTitle><CardDescription>התאימו את המערכת לעסק שלכם. השינויים נשמרים בחשבון שלכם בלבד.</CardDescription></CardHeader>
    <CardContent>
      <form onSubmit={save} className="space-y-6">
        <fieldset disabled={!!busy} className="min-w-0 space-y-6">
          <div className="space-y-2"><Label htmlFor="brand-name">שם המערכת / העסק</Label><Input id="brand-name" value={preferences.name} maxLength={60} required onChange={(event) => change({ name: event.target.value })} /></div>
          <div className="space-y-3">
            <Label htmlFor="brand-logo">לוגו העסק</Label>
            <div className="flex flex-wrap items-center gap-3">
              {logoUrl && <img src={logoUrl} alt="הלוגו הנוכחי" className="h-16 w-28 rounded-md border bg-white object-contain p-2" />}
              <input ref={inputRef} id="brand-logo" type="file" accept="image/png,image/jpeg,image/webp" className="block w-full min-w-0 text-sm file:me-3 file:cursor-pointer file:rounded-md file:border file:bg-secondary file:px-3 file:py-2 file:text-foreground sm:w-auto" onChange={(event) => { const file = event.target.files?.[0]; if (file) void logo(file); }} />
              {logoUrl && <Button type="button" variant="outline" onClick={() => void logo()}>הסרת לוגו</Button>}
            </div>
            <p className="text-xs text-muted-foreground">PNG, JPG או WebP, עד 2 MB. העלאה והסרת לוגו נשמרות מיד.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <ColorField id="brand-primary" label="צבע ראשי — כפתורים והדגשות" value={preferences.primaryColor} onChange={(primaryColor) => change({ primaryColor })} />
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={preferences.sidebarColor !== null} onChange={(event) => change({ sidebarColor: event.target.checked ? "#172554" : null })} />רקע מותאם לתפריט</label>
              {preferences.sidebarColor !== null ? <ColorField id="brand-sidebar" label="צבע רקע התפריט" value={preferences.sidebarColor} onChange={(sidebarColor) => change({ sidebarColor })} /> : <p className="text-xs text-muted-foreground">הרקע מתאים את עצמו למצב הבהיר או הכהה.</p>}
            </div>
          </div>
          <fieldset className="space-y-3"><legend className="mb-3 text-sm font-semibold">צבעי שלבי המכירה</legend><div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {LEAD_STATUSES.map((status) => <ColorField key={status} id={`color-${status}`} label={t.leads.status[status]} value={preferences.statusColors[status]} onChange={(value) => change({ statusColors: { ...preferences.statusColors, [status]: value } })} />)}
          </div></fieldset>
          <fieldset className="space-y-3"><legend className="mb-3 text-sm font-semibold">צבעי כרטיסי הסיכום בדשבורד</legend><div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {METRIC_KEYS.map((key) => <ColorField key={key} id={`metric-${key}`} label={METRIC_LABELS[key]} value={preferences.metricColors[key]} onChange={(value) => change({ metricColors: { ...preferences.metricColors, [key]: value } })} />)}
          </div></fieldset>
          <div className="space-y-3 rounded-xl border bg-muted/30 p-4" aria-label="תצוגה מקדימה של המיתוג">
            <h3 className="text-sm font-semibold">תצוגה מקדימה</h3>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg p-3" style={{ background: preview.sidebarColor ?? "hsl(var(--card))", color: preview.sidebarColor ? contrastText(preview.sidebarColor) : undefined }}>
              <div className="flex min-w-0 items-center gap-2">{logoUrl && <img src={logoUrl} alt="" className="h-9 w-16 rounded bg-white object-contain p-1" />}<bdi className="break-all font-semibold">{preview.name}</bdi></div>
              <span className="rounded-md px-3 py-2 text-sm" style={{ background: preview.primaryColor, color: contrastText(preview.primaryColor) }}>ליד חדש</span>
            </div>
            <div className="flex flex-wrap gap-2">{LEAD_STATUSES.map((status) => <span key={status} className="rounded-full px-2.5 py-1 text-xs" style={{ background: preview.statusColors[status], color: contrastText(preview.statusColors[status]) }}>{t.leads.status[status]}</span>)}</div>
            <div className="grid gap-2 sm:grid-cols-3">{METRIC_KEYS.map((key) => <div key={key} className="rounded-md border border-t-4 bg-card p-3 text-xs" style={{ borderTopColor: preview.metricColors[key] }}>{METRIC_LABELS[key]}</div>)}</div>
          </div>
          <div className="flex flex-wrap justify-between gap-3">
            <Button type="button" variant="outline" onClick={() => { change({ ...DEFAULT_BRANDING, name: preferences.name }); setError(""); }}>איפוס צבעים לברירת מחדל</Button>
            <Button type="submit">{busy === "save" ? "שומר עיצוב…" : "שמירת עיצוב"}</Button>
          </div>
        </fieldset>
        {busy && busy !== "save" && <p role="status" className="text-sm">{busy === "upload" ? "מעלה לוגו…" : "מסיר לוגו…"}</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {message && <p role="status" className="text-sm">{message}</p>}
      </form>
    </CardContent>
  </Card>;
}
