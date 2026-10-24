import type { MutationCtx } from "../_generated/server";
import type { Table } from "./models";
import type { Row, Where } from "./filters";
import { findOne, write } from "./store";

// Only called inside a verified service mutation. Unlike the server repository,
// this operates entirely within the caller's single Convex transaction.
export function webhookStore(ctx: MutationCtx) {
  const service = { service: true, userId: "jackcrm-service" };
  return new Proxy({} as Record<Table, {
    findFirst(args: { where: Where }): Promise<Row | null>;
    create(args: { data: Row }): Promise<Row>;
    update(args: { where: Where; data: Row }): Promise<Row>;
    updateMany(args: { where: Where; data: Row }): Promise<{ count: number }>;
    upsert(args: { where: Where; create: Row; update: Row }): Promise<Row>;
  }>, {
    get(_target, table: Table) {
      return {
        findFirst: ({ where }: { where: Where }) => findOne(ctx, service, table, where),
        ...Object.fromEntries((["create", "update", "updateMany", "upsert"] as const).map((operation) => [operation, (args: { where?: Where; data?: Row; create?: Row; update?: Row }) => write(ctx, service, { table, operation, ...args, data: operation === "upsert" ? args.update : args.data })])),
      };
    },
  });
}
