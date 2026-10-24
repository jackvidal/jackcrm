import { z } from "zod";
import { LEAD_STATUSES, type PipelineStatus } from "./leads";

export const DEFAULT_STATUS_COLORS: Record<PipelineStatus, string> = {
  NEW: "#2563eb", CONTACTED: "#0891b2", FOLLOW_UP: "#ea580c",
  MEETING_SCHEDULED: "#9333ea", MEETING_COMPLETED: "#4f46e5",
  PROPOSAL_SENT: "#0d9488", NEGOTIATION: "#ca8a04", DEAL_CLOSED: "#16a34a", DEAL_LOST: "#dc2626",
};
export const METRIC_KEYS = ["total", "new", "meetings", "overdue", "won"] as const;
export type MetricKey = typeof METRIC_KEYS[number];
export const METRIC_LABELS: Record<MetricKey, string> = { total: "סה״כ לידים", new: "לידים חדשים", meetings: "פגישות השבוע", overdue: "משימות באיחור", won: "עסקאות שנסגרו" };
export const DEFAULT_METRIC_COLORS: Record<MetricKey, string> = { total: "#2563eb", new: "#ea580c", meetings: "#9333ea", overdue: "#dc2626", won: "#16a34a" };
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "יש לבחור צבע בפורמט HEX, למשל #2563eb");
export const brandingSchema = z.object({
  name: z.string().trim().min(1, "יש להזין שם למערכת").max(60, "שם המערכת מוגבל ל־60 תווים"),
  primaryColor: color,
  sidebarColor: color.nullable(),
  statusColors: z.object(Object.fromEntries(LEAD_STATUSES.map((key) => [key, color])) as Record<PipelineStatus, typeof color>).strict(),
  metricColors: z.object(Object.fromEntries(METRIC_KEYS.map((key) => [key, color])) as Record<MetricKey, typeof color>).strict(),
}).strict();
export type BrandingPreferences = z.infer<typeof brandingSchema>;
export type Branding = BrandingPreferences & { logoUrl: string | null };
export const DEFAULT_BRANDING: BrandingPreferences = { name: "Leadero", primaryColor: "#2563eb", sidebarColor: null, statusColors: DEFAULT_STATUS_COLORS, metricColors: DEFAULT_METRIC_COLORS };
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;

function rgb(hex: string) { return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255); }
function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrastText(hex: string) {
  const value = luminance(hex);
  return (value + 0.05) / 0.05 > 1.05 / (value + 0.05) ? "#000000" : "#ffffff";
}
// Keep the selected brand fill exact, while making links readable on each theme.
function readableColor(hex: string, background: string) {
  const bg = luminance(background), target = contrastText(background) === "#000000" ? 0 : 1;
  const source = rgb(hex);
  for (let step = 0; step <= 20; step++) {
    const candidate = "#" + source.map((v) => Math.round((v + (target - v) * step / 20) * 255).toString(16).padStart(2, "0")).join("");
    const value = luminance(candidate);
    if ((Math.max(value, bg) + 0.05) / (Math.min(value, bg) + 0.05) >= 5) return candidate;
  }
  return contrastText(background);
}
function hsl(hex: string) {
  const [r, g, b] = rgb(hex), max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min, l = (max + min) / 2;
  let h = 0;
  if (delta) h = max === r ? ((g - b) / delta + 6) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return `${h * 60} ${delta ? delta / (1 - Math.abs(2 * l - 1)) * 100 : 0}% ${l * 100}%`;
}
// Validated hex values only. Global variables also reach Radix portaled menus.
export function brandingVariables(preferences: BrandingPreferences): Record<string, string> {
  const p = brandingSchema.parse(preferences);
  const result: Record<string, string> = { "--primary": hsl(p.primaryColor), "--primary-foreground": hsl(contrastText(p.primaryColor)), "--ring": hsl(p.primaryColor), "--brand-ink-light": readableColor(p.primaryColor, "#ffffff"), "--brand-ink-dark": readableColor(p.primaryColor, "#0f172a") };
  if (p.sidebarColor) { result["--brand-sidebar"] = p.sidebarColor; result["--brand-sidebar-text"] = contrastText(p.sidebarColor); }
  for (const status of LEAD_STATUSES) { result[`--lead-${status}`] = p.statusColors[status]; result[`--lead-${status}-text`] = contrastText(p.statusColors[status]); }
  for (const metric of METRIC_KEYS) result[`--metric-${metric}`] = p.metricColors[metric];
  return result;
}
export function statusColor(status: PipelineStatus) { return `var(--lead-${status}, ${DEFAULT_STATUS_COLORS[status]})`; }

export function logoMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if ([137,80,78,71,13,10,26,10].every((value, i) => bytes[i] === value)) return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}
