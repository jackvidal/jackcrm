import type { Prisma } from "@prisma/client";
import { isDateOnly, LEAD_STATUSES, OPEN_LEAD_STATUSES, type PipelineStatus } from "./leads";

export type LeadSearch = { q?: string; status?: string; view?: string; followUp?: string; scope?: string; sort?: string; day?: string };

export function leadWhere(ownerId: string, search: LeadSearch, today: string): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = { ownerId };
  if (LEAD_STATUSES.includes(search.status as PipelineStatus)) where.status = search.status as PipelineStatus;
  const term = search.q?.trim();
  if (term) where.OR = ["fullName", "company", "email", "phone"].map((key) => ({ [key]: { contains: term, mode: "insensitive" } }));
  const day = search.day && isDateOnly(search.day) ? search.day : today;
  const filters: Prisma.LeadWhereInput[] = [];
  if (search.scope === "open" || ["today", "overdue", "none"].includes(search.followUp ?? "")) filters.push({ status: { in: [...OPEN_LEAD_STATUSES] } });
  if (search.followUp === "today") filters.push({ followUpDate: day });
  if (search.followUp === "overdue") filters.push({ followUpDate: { lt: day } });
  if (search.followUp === "none") filters.push({ followUpDate: null });
  if (filters.length) where.AND = filters;
  return where;
}

export function leadOrder(sort?: string): Prisma.LeadOrderByWithRelationInput[] {
  if (sort === "name") return [{ fullName: "asc" }, { createdAt: "desc" }];
  if (sort === "updated") return [{ updatedAt: "desc" }];
  if (sort === "followup") return [{ followUpDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }];
  return [{ createdAt: "desc" }];
}
