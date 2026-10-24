/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { brandingVariables, contrastText, DEFAULT_BRANDING, LOGO_MAX_BYTES } from "../src/lib/branding";

const modules = import.meta.glob("../convex/**/*.ts");
const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6N8AAAAASUVORK5CYII="), (c) => c.charCodeAt(0));

describe("Customer branding", () => {
  test("settings are isolated per account and reject anonymous/service callers and injected ownership", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "owner" }), other = t.withIdentity({ subject: "other" });
    const preferences = { ...DEFAULT_BRANDING, name: "עסק לדוגמה", primaryColor: "#eab308" };
    await owner.mutation(api.branding.save, { preferences });
    expect(await owner.query(api.branding.current, {})).toMatchObject(preferences);
    expect(await other.query(api.branding.current, {})).toMatchObject(DEFAULT_BRANDING);
    await other.mutation(api.branding.save, { preferences: { ...DEFAULT_BRANDING, name: "אחר" } });
    expect((await owner.query(api.branding.current, {})).name).toBe("עסק לדוגמה");
    await expect(t.query(api.branding.current, {})).rejects.toThrow("Unauthorized");
    await expect(t.mutation(api.branding.save, { preferences })).rejects.toThrow("Unauthorized");
    await expect(owner.mutation(api.branding.save, { preferences: { ...preferences, ownerId: "other" } })).rejects.toThrow("Invalid branding");
    const service = t.withIdentity({ issuer: "https://jackcrm.internal", subject: "jackcrm-service", role: "service" });
    await expect(service.mutation(api.branding.save, { preferences })).rejects.toThrow("Forbidden");
  });

  test("all color fields validate before persistence and CSS serialization", async () => {
    const t = convexTest(schema, modules).withIdentity({ subject: "owner" });
    for (const preferences of [
      { ...DEFAULT_BRANDING, primaryColor: "red;}</style><script>" },
      { ...DEFAULT_BRANDING, sidebarColor: "url(https://example.com)" },
      { ...DEFAULT_BRANDING, statusColors: { ...DEFAULT_BRANDING.statusColors, NEW: "red" } },
      { ...DEFAULT_BRANDING, metricColors: { ...DEFAULT_BRANDING.metricColors, won: "#123" } },
      { ...DEFAULT_BRANDING, name: " " },
    ]) await expect(t.mutation(api.branding.save, { preferences })).rejects.toThrow("Invalid branding");
    expect(() => brandingVariables({ ...DEFAULT_BRANDING, primaryColor: "</style>" })).toThrow();
    expect(contrastText("#ffffff")).toBe("#000000");
    expect(contrastText("#000000")).toBe("#ffffff");
    expect(contrastText("#ffff00")).toBe("#000000");
  });

  test("logo upload, replacement and removal stay owner-scoped and clean up files", async () => {
    const t = convexTest(schema, modules), owner = t.withIdentity({ subject: "owner" }), other = t.withIdentity({ subject: "other" });
    const upload = (bytes = png) => owner.fetch("/brand-logo", { method: "POST", body: bytes });
    expect((await upload(new Uint8Array([...png, 0]))).status).toBe(200);
    const before = (await owner.query(api.branding.current, {})).logoUrl;
    expect(before).toBeTruthy();
    expect((await other.query(api.branding.current, {})).logoUrl).toBeNull();
    await other.mutation(api.branding.removeLogo, {});
    expect((await owner.query(api.branding.current, {})).logoUrl).toBe(before);
    expect((await upload()).status).toBe(200);
    expect((await owner.query(api.branding.current, {})).logoUrl).not.toBe(before);
    expect(await t.run(async (ctx) => (await ctx.db.system.query("_storage").collect()).length)).toBe(1);
    await owner.mutation(api.branding.removeLogo, {});
    expect((await owner.query(api.branding.current, {})).logoUrl).toBeNull();
    expect(await t.run(async (ctx) => (await ctx.db.system.query("_storage").collect()).length)).toBe(0);
  });

  test("logo HTTP boundary rejects unauthenticated, SVG and oversized uploads", async () => {
    const t = convexTest(schema, modules), owner = t.withIdentity({ subject: "owner" });
    expect((await t.fetch("/brand-logo", { method: "POST", body: png })).status).toBe(401);
    expect((await owner.fetch("/brand-logo", { method: "POST", headers: { "Content-Type": "image/png" }, body: "<svg><script>alert(1)</script></svg>" })).status).toBe(415);
    expect((await owner.fetch("/brand-logo", { method: "POST", body: new Uint8Array(LOGO_MAX_BYTES + 1) })).status).toBe(413);
    expect((await owner.query(api.branding.current, {})).logoUrl).toBeNull();
  });
});
