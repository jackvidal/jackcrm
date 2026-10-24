import "server-only";
import type { PrismaClient } from "@prisma/client";
import { api } from "../../../convex/_generated/api";
import { dateFields, fields, type Table } from "../../../convex/lib/models";
import type { Row, Where } from "../../../convex/lib/filters";
import type { Write } from "../../../convex/lib/store";
import { convexClient } from "./client";
import { LEAD_STATUSES } from "../leads";

// Transitional, explicitly limited repository contract. Prisma supplies only
// erased TypeScript shapes; every runtime read/write goes to Convex.
type ReadMethod = "findMany" | "findFirst" | "findUnique" | "count";
type WriteMethod = "create" | "createMany" | "update" | "updateMany" | "delete" | "deleteMany" | "upsert";
export type Database = { [T in Table]: Pick<PrismaClient[T], ReadMethod | WriteMethod> };
type Options = { where?: Where; orderBy?: Row | Row[]; take?: number; select?: Row; include?: Row; data?: Row | Row[]; create?: Row; update?: Row };

function wire(value: any): any {
  if (value instanceof Date) return value.getTime();
  if (Array.isArray(value)) return value.map(wire);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).map(([k, v]) => [k, wire(v)]));
  return value;
}
function hydrate(table: Table, row: Row): Row {
  const result = { ...row };
  for (const key of dateFields[table]) if (result[key] !== null && result[key] !== undefined) result[key] = new Date(result[key]);
  return result;
}
const enumOrder: Record<string, string[]> = {
  "lead.status": [...LEAD_STATUSES],
  "task.status": ["PENDING", "IN_PROGRESS", "DONE", "CANCELED"],
  "task.priority": ["LOW", "MEDIUM", "HIGH"],
  "meeting.status": ["SCHEDULED", "COMPLETED", "CANCELED", "NO_SHOW"],
};
function sortRows(table: Table, rows: Row[], orderBy?: Row | Row[]) {
  const orders = orderBy ? (Array.isArray(orderBy) ? orderBy : [orderBy]) : [];
  rows.sort((a, b) => {
    for (const order of orders) for (const [key, specification] of Object.entries(order as Record<string, any>)) {
      const direction = typeof specification === "string" ? specification : specification.sort;
      const nulls = typeof specification === "object" ? specification.nulls : undefined;
      const x = a[key], y = b[key];
      if (x === y) continue;
      if (x == null || y == null) {
        const nullFirst = nulls ? nulls === "first" : direction === "desc";
        return (x == null ? -1 : 1) * (nullFirst ? 1 : -1);
      }
      const values = enumOrder[`${table}.${key}`];
      const left = values ? values.indexOf(x) : x;
      const right = values ? values.indexOf(y) : y;
      if (left !== right) return (left < right ? -1 : 1) * (direction === "desc" ? -1 : 1);
    }
    return 0;
  });
}
const relations: Record<string, [Table, string, string, boolean]> = {
  "lead.leadNotes": ["leadNote", "id", "leadId", true],
  "lead.meetings": ["meeting", "id", "leadId", true],
  "lead.analyses": ["websiteAnalysis", "id", "leadId", true],
  "lead.tasks": ["task", "id", "leadId", true],
  "lead.calls": ["call", "id", "leadId", true],
  "lead.whatsappMessages": ["whatsappMessage", "id", "leadId", true],
  "leadNote.author": ["profile", "authorId", "id", false],
  "meeting.lead": ["lead", "leadId", "id", false],
  "task.lead": ["lead", "leadId", "id", false],
};

export function createDatabase(service = false): Database {
  async function read(table: Table, options: Options = {}): Promise<Row[]> {
    const client = await convexClient(service);
    const rows: Row[] = [];
    let cursor: string | null = null;
    do {
      const result: { page: Row[]; isDone: boolean; continueCursor: string } = await client.query(api.crm.page, { table, where: wire(options.where ?? {}), paginationOpts: { cursor, numItems: 100 } });
      rows.push(...result.page);
      cursor = result.isDone ? null : result.continueCursor;
    } while (cursor !== null);
    sortRows(table, rows, options.orderBy);
    const limited = options.take === undefined ? rows : rows.slice(0, options.take);
    return Promise.all(limited.map(async (row) => {
      const result = hydrate(table, row);
      for (const [key, nested] of Object.entries(options.include ?? {})) {
        if (!nested) continue;
        const relation = relations[`${table}.${key}`];
        if (!relation) throw new Error(`Unsupported relation ${table}.${key}`);
        const [target, sourceKey, targetKey, many] = relation;
        const nestedOptions = typeof nested === "object" ? nested : {};
        const records = await read(target, { ...nestedOptions, where: { ...nestedOptions.where, [targetKey]: row[sourceKey] } });
        result[key] = many ? records : records[0] ?? null;
      }
      if (options.select) return Object.fromEntries(Object.entries(options.select).filter(([, enabled]) => enabled).map(([key]) => [key, result[key]]));
      return result;
    }));
  }
  async function commit(commands: Write[]) {
    const client = await convexClient(service);
    return client.mutation(api.crm.commit, { commands: wire(commands) });
  }
  const database: Record<string, unknown> = {};
  for (const table of Object.keys(fields) as Table[]) {
    database[table] = {
      findMany: (options?: Options) => read(table, options),
      findFirst: async (options: Options = {}) => (await read(table, { ...options, take: 1 }))[0] ?? null,
      findUnique: async (options: Options) => (await read(table, { ...options, take: 1 }))[0] ?? null,
      count: async (options?: Options) => (await read(table, options)).length,
      ...Object.fromEntries((["create", "update", "upsert", "delete", "updateMany", "deleteMany"] as const).map((operation) => [operation, async (options: Options) => {
        const [result] = await commit([{ table, operation, where: options.where, data: (operation === "upsert" ? options.update : options.data) as Row | undefined, create: options.create }]);
        return operation.endsWith("Many") ? result : hydrate(table, result);
      }])),
      createMany: async (options: Options) => {
        const rows = Array.isArray(options.data) ? options.data : [options.data!];
        if (rows.length > 100) throw new Error("createMany supports up to 100 rows per atomic batch");
        await commit(rows.map((data) => ({ table, operation: "create", data })));
        return { count: rows.length };
      },
    };
  }
  return database as Database;
}
