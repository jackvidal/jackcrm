"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useConvex } from "convex/react";
import { Download, Upload } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { LEAD_STATUSES, type PipelineStatus } from "@/lib/leads";
import { IMPORT_BATCH, IMPORT_FIELDS, cellText, mapImportRows, separateFileDuplicates, suggestMapping, suggestStatus, type ColumnMapping, type ImportField, type ImportOutcome, type ImportRow, type ImportSheet } from "@/lib/lead-import";
import { downloadCsv, parseCsv, readImportFile } from "@/lib/lead-import-file";
import { refreshImportedLeadsAction } from "@/app/(dashboard)/leads/import/actions";
import { t } from "@/i18n/he";

type Stage = "upload" | "mapping" | "checking" | "preview" | "importing" | "paused" | "done";
const selectClass = "h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm";
const resultLabels: Record<ImportOutcome["status"], string> = { ready: "מוכן לייבוא", created: "יובא", duplicate: "כפילות — דילוג", conflict: "התנגשות — דילוג", invalid: "שגיאה — דילוג" };
const fields = Object.keys(IMPORT_FIELDS) as ImportField[];

export function LeadImport() {
  const client = useConvex();
  const [stage, setStage] = useState<Stage>("upload"), [loading, setLoading] = useState(false);
  const [filename, setFilename] = useState(""), [encoding, setEncoding] = useState<"utf-8" | "windows-1255">("utf-8");
  const [pasted, setPasted] = useState("");
  const [sheets, setSheets] = useState<ImportSheet[]>([]), [sheetIndex, setSheetIndex] = useState(0);
  const [mapping, setMapping] = useState<ColumnMapping>({}), [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [defaultStatus, setDefaultStatus] = useState<PipelineStatus>("NEW");
  const [error, setError] = useState(""), [progress, setProgress] = useState(0), [page, setPage] = useState(0);
  const [outcomes, setOutcomes] = useState<ImportOutcome[]>([]), [plan, setPlan] = useState<ImportRow[]>([]);
  const requestId = useRef(""), offset = useRef(0), lock = useRef(false), stop = useRef(false), mounted = useRef(true);
  const fileInput = useRef<HTMLInputElement>(null);
  const sheet = sheets[sheetIndex];
  const busy = loading || stage === "checking" || stage === "importing";
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; stop.current = true; }; }, []);
  useEffect(() => {
    if (stage !== "importing") return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [stage]);
  const statuses = useMemo(() => sheet && mapping.status !== undefined ? [...new Set(sheet.rows.map(({ cells }) => cellText(cells[mapping.status!])).filter(Boolean))] : [], [sheet, mapping.status]);
  const outcomeMap = useMemo(() => new Map(outcomes.map((row) => [row.row, row])), [outcomes]);
  const checked = useMemo(() => sheet ? mapImportRows(sheet, mapping, statusMap, defaultStatus) : [], [sheet, mapping, statusMap, defaultStatus]);
  const counts = { ready: 0, created: 0, duplicate: 0, invalid: 0, conflict: 0 };
  for (const result of outcomes) counts[result.status]++;

  function loaded(data: ImportSheet[], name: string) {
    setFilename(name); setSheets(data); setSheetIndex(0); setMapping(suggestMapping(data[0].headers)); setStatusMap({}); setOutcomes([]); setPlan([]); setPage(0); setStage("mapping");
  }
  async function load(file: File) {
    if (lock.current) return;
    lock.current = true; setLoading(true); setError("");
    try {
      const data = await readImportFile(file, encoding);
      if (!mounted.current) return;
      loaded(data, file.name);
    } catch (e) { setError(e instanceof Error ? e.message : "לא ניתן לקרוא את הקובץ"); }
    finally { lock.current = false; setLoading(false); if (fileInput.current) fileInput.current.value = ""; }
  }
  function changeSheet(index: number) { setSheetIndex(index); setMapping(suggestMapping(sheets[index].headers)); setStatusMap({}); setPage(0); setError(""); }
  async function preview() {
    if (!sheet || lock.current) return;
    if (mapping.fullName === undefined && mapping.firstName === undefined) { setError("יש למפות שם מלא או שם פרטי"); return; }
    lock.current = true; setStage("checking"); setError(""); setProgress(0); setPage(0);
    const { candidates, outcomes: localResults } = separateFileDuplicates(checked);
    const results = [...localResults];
    try {
      for (let i = 0; i < candidates.length; i += IMPORT_BATCH) {
        if (!mounted.current) return;
        results.push(...await client.query(api.leadImports.preview, { rows: candidates.slice(i, i + IMPORT_BATCH) }));
        setProgress(Math.min(i + IMPORT_BATCH, candidates.length));
      }
      if (!mounted.current) return;
      const ready = new Set(results.filter((row) => row.status === "ready").map((row) => row.row));
      setPlan(candidates.filter((row) => ready.has(row.row))); setOutcomes(results); requestId.current = crypto.randomUUID(); offset.current = 0; setStage("preview");
    } catch { setError("בדיקת הכפילויות לא הושלמה. בדקו את החיבור ונסו שוב; עדיין לא יובאו לידים."); setStage("mapping"); }
    finally { lock.current = false; }
  }
  async function run() {
    if (lock.current || !plan.length) return;
    lock.current = true; stop.current = false; setStage("importing"); setError("");
    try {
      while (offset.current < plan.length) {
        if (stop.current || !mounted.current) { if (mounted.current) setStage("paused"); return; }
        const batch = plan.slice(offset.current, offset.current + IMPORT_BATCH);
        const results = await client.mutation(api.leadImports.commit, { requestId: requestId.current, rows: batch });
        offset.current += batch.length;
        if (!mounted.current) return;
        setOutcomes((old) => { const update = new Map(results.map((row) => [row.row, row])); return old.map((row) => update.get(row.row) ?? row); });
        setProgress(offset.current);
      }
      setStage("done");
    } catch { setStage("paused"); setError("הייבוא נעצר. לידים שכבר נשמרו נשארים במערכת. לחצו על המשך כדי לבדוק שוב את המנה האחרונה ולהמשיך ללא ייבוא חוזר."); }
    finally {
      lock.current = false;
      try { await refreshImportedLeadsAction(); } catch { /* Leads are committed; opening the list loads them again. */ }
    }
  }
  function report() {
    if (!sheet) return;
    downloadCsv("lead-import-report.csv", [["מספר שורה", "תוצאה", "הסבר", ...sheet.headers], ...sheet.rows.map(({ row, cells }) => { const outcome = outcomeMap.get(row); return [row, outcome ? resultLabels[outcome.status] : "טרם נבדק", outcome?.reason ?? "", ...cells.map(cellText)]; })]);
  }

  return <div className="space-y-5">
    <p className="text-sm text-muted-foreground">ייבוא מקובץ Excel ‏(XLSX) או CSV, עד 5,000 לידים ו־5 MB. בוחרים קובץ, מתאימים עמודות ובודקים לפני הייבוא.</p>
    {stage === "upload" && <Card><CardHeader><CardTitle>1. בחירת קובץ</CardTitle></CardHeader><CardContent className="space-y-4">
      <div className="space-y-2"><Label htmlFor="import-file">קובץ הלידים</Label><Input ref={fileInput} id="import-file" type="file" accept=".csv,.xlsx" disabled={loading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void load(file); }} /></div>
      <div className="max-w-sm space-y-2"><Label htmlFor="csv-encoding">קידוד CSV</Label><select id="csv-encoding" className={selectClass} value={encoding} disabled={loading} onChange={(event) => setEncoding(event.target.value as typeof encoding)}><option value="utf-8">UTF-8 (מומלץ)</option><option value="windows-1255">עברית Windows</option></select></div>
      <p className="text-sm text-muted-foreground">השורה הראשונה היא שורת הכותרות. כדי לשמור אפס בתחילת מספר טלפון, הגדירו את עמודת הטלפון ב־Excel כטקסט.</p>
      <Button type="button" variant="outline" disabled={loading} onClick={() => downloadCsv("lead-import-template.csv", [["שם מלא", "אימייל", "טלפון", "חברה", "אתר", "מקור", "סטטוס", "תאריך פולואפ", "הערות"], ["נועה לוי", "noa@example.com", "", "עסק לדוגמה", "https://example.com", "import", "ליד חדש", "", "ליד פיקטיבי לדוגמה — החליפו בפרטים שלכם"]])}><Download className="h-4 w-4" />הורדת קובץ לדוגמה</Button>
      <details className="space-y-3 rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">או הדביקו טבלה מ־Excel / Google Sheets</summary><div className="space-y-3 pt-3"><Label htmlFor="import-paste">כותרות ושורות להדבקה</Label><textarea id="import-paste" className="min-h-32 w-full rounded-md border bg-background p-3 text-sm" value={pasted} maxLength={5 * 1024 * 1024} disabled={loading} onChange={(event) => setPasted(event.target.value)} /><Button type="button" variant="outline" disabled={loading || !pasted.trim()} onClick={() => { setError(""); try { loaded([parseCsv(pasted)], "טבלה שהודבקה"); } catch (e) { setError(e instanceof Error ? e.message : "טבלה לא תקינה"); } }}>קריאת הטבלה</Button></div></details>
      {loading && <p role="status">קורא את הקובץ…</p>}
    </CardContent></Card>}

    {(stage === "mapping" || stage === "checking") && sheet && <Card><CardHeader><CardTitle>2. התאמת עמודות</CardTitle><p className="break-all text-sm text-muted-foreground">{filename} · {sheet.rows.length.toLocaleString()} שורות</p></CardHeader><CardContent className="space-y-6">
      <fieldset disabled={busy} className="min-w-0 space-y-5">
        {sheets.length > 1 && <div className="space-y-2"><Label htmlFor="import-sheet">גיליון לייבוא</Label><select id="import-sheet" className={selectClass} value={sheetIndex} onChange={(event) => changeSheet(Number(event.target.value))}>{sheets.map((item, i) => <option key={i} value={i}>{item.name}</option>)}</select></div>}
        {sheet.error ? <p role="alert" className="text-destructive">{sheet.error}</p> : <>
          <p className="text-sm text-muted-foreground">בחרו את העמודה המתאימה לכל שדה. שדות שלא ימופו לא ייובאו. נדרש שם מלא או שם פרטי.</p>
          <div className="grid gap-4 sm:grid-cols-2">{fields.map((field) => <div key={field} className="space-y-1.5"><Label htmlFor={`map-${field}`}>{IMPORT_FIELDS[field]}</Label><select id={`map-${field}`} className={selectClass} value={mapping[field] ?? ""} onChange={(event) => { setMapping((old) => ({ ...old, [field]: event.target.value === "" ? undefined : Number(event.target.value) })); if (field === "status") setStatusMap({}); }}><option value="">לא לייבא</option>{sheet.headers.map((header, i) => <option key={i} value={i} disabled={Object.entries(mapping).some(([other, col]) => other !== field && col === i)}>{i + 1}. {header}</option>)}</select>{mapping[field] !== undefined && <p className="truncate text-xs text-muted-foreground">לדוגמה: <bdi>{cellText(sheet.rows[0]?.cells[mapping[field]!]).slice(0, 100) || "תא ריק"}</bdi></p>}</div>)}</div>
          <div className="max-w-sm space-y-2"><Label htmlFor="import-default-status">סטטוס כשאין ערך בקובץ</Label><select id="import-default-status" className={selectClass} value={defaultStatus} onChange={(event) => setDefaultStatus(event.target.value as PipelineStatus)}>{LEAD_STATUSES.map((status) => <option key={status} value={status}>{t.leads.status[status]}</option>)}</select></div>
          {statuses.length > 0 && <div className="space-y-3"><h3 className="font-medium">התאמת הסטטוסים מהקובץ</h3>{statuses.length > 100 ? <p className="text-destructive">נמצאו יותר מ־100 ערכי סטטוס שונים. בדקו שנבחרה עמודת הסטטוס הנכונה.</p> : <div className="grid gap-3 sm:grid-cols-2">{statuses.map((value, i) => <div key={value} className="space-y-1.5"><Label htmlFor={`import-status-${i}`}><bdi>{value}</bdi></Label><select id={`import-status-${i}`} className={selectClass} value={Object.hasOwn(statusMap, value) ? statusMap[value] : suggestStatus(value)} onChange={(event) => setStatusMap((old) => ({ ...old, [value]: event.target.value }))}><option value="">בחרו שלב במערכת</option>{LEAD_STATUSES.map((status) => <option key={status} value={status}>{t.leads.status[status]}</option>)}</select></div>)}</div>}</div>}
          <p className="text-xs text-muted-foreground">תאריך פולואפ: YYYY-MM-DD או DD/MM/YYYY. כפילויות מזוהות לפי אימייל או טלפון ללא רווחים ומקפים; השתמשו בקידומת מדינה אחידה.</p>
        </>}
        <div className="flex flex-wrap justify-between gap-3"><Button type="button" variant="outline" onClick={() => { setStage("upload"); setError(""); }}>בחירת קובץ אחר</Button><Button type="button" disabled={!!sheet.error || statuses.length > 100} onClick={() => void preview()}>בדיקה ותצוגה מקדימה</Button></div>
      </fieldset>
      {stage === "checking" && <p role="status">בודק שורות וכפילויות… {progress.toLocaleString()}</p>}
    </CardContent></Card>}

    {["preview", "importing", "paused", "done"].includes(stage) && sheet && <Card><CardHeader><CardTitle>{stage === "done" ? "הייבוא הושלם" : stage === "paused" ? "הייבוא מושהה" : "3. תצוגה מקדימה וייבוא"}</CardTitle><p className="break-all text-sm text-muted-foreground">{filename} · {sheet.name}</p></CardHeader><CardContent className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["מוכנים / נותרו", counts.ready], ["יובאו", counts.created], ["כפילויות", counts.duplicate], ["שגיאות לבדיקה", counts.invalid + counts.conflict]].map(([label, count]) => <div key={label} className="rounded-lg border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-semibold">{count}</p></div>)}</div>
      <p className="text-sm">ייובאו רק שורות תקינות שאינן כפולות. לידים קיימים לא ישתנו. אפשר להוריד דוח, לתקן שורות בקובץ ולייבא אותו שוב.</p>
      <div className="overflow-x-auto rounded-lg border"><table className="w-full text-start text-sm"><thead className="bg-muted/50"><tr>{["שורה", "שם", "אימייל / טלפון", "סטטוס במערכת", "תוצאה"].map((label) => <th key={label} className="whitespace-nowrap p-3 text-start font-medium">{label}</th>)}</tr></thead><tbody>{checked.slice(page * 25, page * 25 + 25).map((row) => { const result = outcomeMap.get(row.row); return <tr key={row.row} className="border-t"><td className="p-3">{row.row}</td><td className="max-w-48 break-words p-3"><bdi>{row.name || "—"}</bdi></td><td className="p-3"><bdi>{row.data?.email || row.data?.phone || "—"}</bdi></td><td className="whitespace-nowrap p-3">{row.data ? t.leads.status[row.data.status] : "—"}</td><td className="min-w-48 p-3"><span className={result?.status === "invalid" || result?.status === "conflict" ? "text-destructive" : "font-medium"}>{result ? resultLabels[result.status] : "טרם נבדק"}</span><p className="mt-1 text-xs text-muted-foreground">{result?.reason}</p></td></tr>; })}</tbody></table></div>
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted-foreground">עמוד {page + 1} מתוך {Math.ceil(checked.length / 25)}</p><div className="flex gap-2"><Button type="button" size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>הקודם</Button><Button type="button" size="sm" variant="outline" disabled={(page + 1) * 25 >= checked.length} onClick={() => setPage((p) => p + 1)}>הבא</Button></div></div>
      {stage === "importing" && <div role="status" className="space-y-2"><p>מייבא… {progress} מתוך {plan.length}. השאירו את העמוד פתוח עד לסיום.</p><progress className="w-full" max={plan.length} value={progress} aria-label="התקדמות הייבוא" /></div>}
      <div className="flex flex-wrap gap-3">
        {stage === "preview" && <><Button type="button" disabled={!plan.length} onClick={() => { setProgress(0); void run(); }}><Upload className="h-4 w-4" />ייבוא {plan.length.toLocaleString()} לידים</Button><Button type="button" variant="outline" onClick={() => { setStage("mapping"); setError(""); }}>חזרה למיפוי</Button></>}
        {stage === "importing" && <Button type="button" variant="outline" onClick={() => { stop.current = true; }}>השהיה אחרי המנה הנוכחית</Button>}
        {stage === "paused" && <Button type="button" onClick={() => void run()}>המשך ייבוא</Button>}
        {stage !== "importing" && <Button type="button" variant="outline" onClick={report}><Download className="h-4 w-4" />הורדת דוח שורות</Button>}
        {stage === "done" && <><Button asChild><Link href="/leads">לצפייה בלידים</Link></Button><Button type="button" variant="outline" onClick={() => { setStage("upload"); setError(""); }}>ייבוא קובץ נוסף</Button></>}
      </div>
    </CardContent></Card>}
    {error && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
  </div>;
}
