// These are the scalar filters used by the existing server-rendered CRM.
export type Scalar = string | number | boolean | null;
export type Condition = Scalar | { in?: Scalar[]; notIn?: Scalar[]; lt?: Scalar; lte?: Scalar; gt?: Scalar; gte?: Scalar; contains?: string; mode?: "insensitive" };
export type Where = { [field: string]: Condition | Where[] | undefined };
export type Row = Record<string, any>;

export function matches(row: Row, where: Where = {}): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (condition === undefined) return true;
    if (key === "OR") return (condition as Where[]).some((part) => matches(row, part));
    if (key === "AND") return (condition as Where[]).every((part) => matches(row, part));
    const value = row[key];
    if (condition === null || typeof condition !== "object") return value === condition;
    const c = condition as Exclude<Condition, Scalar>;
    if (c.in && !c.in.includes(value)) return false;
    if (c.notIn && (value === null || c.notIn.includes(value))) return false;
    if (c.lt !== undefined && (value == null || !(value < c.lt!))) return false;
    if (c.lte !== undefined && (value == null || !(value <= c.lte!))) return false;
    if (c.gt !== undefined && (value == null || !(value > c.gt!))) return false;
    if (c.gte !== undefined && (value == null || !(value >= c.gte!))) return false;
    if (c.contains !== undefined) {
      if (typeof value !== "string") return false;
      if (!(c.mode === "insensitive" ? value.toLowerCase().includes(c.contains.toLowerCase()) : value.includes(c.contains))) return false;
    }
    return true;
  });
}
