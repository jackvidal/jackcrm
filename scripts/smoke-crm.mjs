import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
process.loadEnvFile(".env.local");
process.loadEnvFile(".env.test.local");
if (!process.env.CRM_TEST_EMAIL || !process.env.CRM_TEST_PASSWORD) throw new Error("Test credentials are missing");
if (process.env.CONVEX_DEPLOYMENT !== "dev:unique-porcupine-370") throw new Error("This smoke test is restricted to the jackcrm development deployment");
const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL, { logger: false });
const signIn = await client.action(makeFunctionReference("auth:signIn"), { provider: "password", params: { flow: "signIn", email: process.env.CRM_TEST_EMAIL, password: process.env.CRM_TEST_PASSWORD } });
if (!signIn.tokens?.token) throw new Error("Sign in failed");
client.setAuth(signIn.tokens.token);
const read = (table, where = {}) => client.query(makeFunctionReference("crm:page"), { table, where, paginationOpts: { cursor: null, numItems: 100 } });
const write = (commands) => client.mutation(makeFunctionReference("crm:commit"), { commands });
const ownerId = (await read("profile")).page[0].id;
let lead;
try {
  [lead] = await write([{ table: "lead", operation: "create", data: { ownerId, fullName: "API smoke test" } }]);
  const [task, meeting, call] = await write([
    { table: "task", operation: "create", data: { ownerId, leadId: lead.id, title: "Smoke task", priority: "HIGH" } },
    { table: "meeting", operation: "create", data: { ownerId, leadId: lead.id, scheduledAt: Date.now(), status: "SCHEDULED" } },
    { table: "call", operation: "create", data: { ownerId, leadId: lead.id, occurredAt: Date.now(), direction: "OUTBOUND" } },
  ]);
  if ((await read("lead", { id: lead.id })).page[0].status !== "MEETING_SCHEDULED") throw new Error("Pipeline update failed");
  await write([{ table: "task", operation: "update", where: { id: task.id }, data: { status: "DONE", completedAt: Date.now() } }]);
  const bytes = Buffer.alloc(44);
  bytes.write("RIFF", 0); bytes.writeUInt32LE(36, 4); bytes.write("WAVEfmt ", 8); bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22); bytes.writeUInt32LE(8000, 24); bytes.writeUInt32LE(16000, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34); bytes.write("data", 36);
  const endpoint = new URL("/call-audio", process.env.NEXT_PUBLIC_CONVEX_SITE_URL);
  endpoint.searchParams.set("callId", call.id); endpoint.searchParams.set("filename", "smoke.wav");
  const uploaded = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${signIn.tokens.token}`, "Content-Type": "audio/wav" }, body: bytes });
  if (!uploaded.ok) throw new Error(`Upload failed: ${uploaded.status}`);
  const downloaded = await fetch(endpoint, { headers: { Authorization: `Bearer ${signIn.tokens.token}` } });
  if (!downloaded.ok || !Buffer.from(await downloaded.arrayBuffer()).equals(bytes)) throw new Error("Stored audio mismatch");
  const denied = await fetch(endpoint);
  if (denied.status !== 401) throw new Error("Anonymous audio access was not rejected");
  await write([{ table: "meeting", operation: "update", where: { id: meeting.id }, data: { status: "COMPLETED" } }]);
  if ((await read("lead", { id: lead.id })).page[0].status !== "MEETING_COMPLETED") throw new Error("Completion update failed");
  console.log("Live development checks passed: login, profile, lead, task, meeting pipeline, call, private audio upload/download and anonymous rejection.");
} finally {
  if (lead) await write([{ table: "lead", operation: "delete", where: { id: lead.id } }]);
  await client.action(makeFunctionReference("auth:signOut"), {});
  console.log("Smoke CRM records removed; cleanup of related records and audio is scheduled.");
}
