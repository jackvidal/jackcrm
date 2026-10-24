import Papa from "papaparse";
import { IMPORT_LIMIT, IMPORT_MAX_BYTES, type ImportCell, type ImportSheet } from "./lead-import";

export function prepareSheet(name: string, data: ImportCell[][]): ImportSheet {
  const first = data.findIndex((row) => row.some((cell) => cell !== null && String(cell).trim()));
  if (first < 0) throw new Error("הגיליון ריק");
  const header = data[first];
  if (header.length > 50) throw new Error("אפשר לייבא עד 50 עמודות בקובץ");
  const headers = header.map((cell, i) => String(cell ?? "").trim() || `עמודה ${i + 1}`);
  const rows = data.slice(first + 1).map((cells, index) => ({ row: first + index + 2, cells })).filter(({ cells }) => cells.some((cell) => cell !== null && String(cell).trim()));
  if (!rows.length) throw new Error("נדרשת שורת כותרות ולפחות ליד אחד");
  if (rows.length > IMPORT_LIMIT) throw new Error(`אפשר לייבא עד ${IMPORT_LIMIT.toLocaleString()} לידים בקובץ. פצלו את הקובץ ונסו שוב.`);
  if (rows.some(({ cells }) => cells.slice(headers.length).some((cell) => cell != null && String(cell).trim()))) throw new Error("נמצאו נתונים בעמודות ללא כותרת. הוסיפו כותרות לכל העמודות.");
  if (rows.some(({ cells }) => cells.some((cell) => typeof cell === "string" && cell.length > 10000))) throw new Error("נמצא תא ארוך מדי; קיצרו תאים ל־10,000 תווים לכל היותר");
  return { name, headers, rows };
}
export function parseCsv(text: string): ImportSheet {
  const result = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), { dynamicTyping: false, skipEmptyLines: false });
  const error = result.errors.find((item) => item.code !== "UndetectableDelimiter");
  if (error) throw new Error(`מבנה CSV לא תקין: בדקו מרכאות ומפרידים ליד רשומה ${(error.row ?? 0) + 1}`);
  return prepareSheet("CSV", result.data);
}
export async function readImportFile(file: File, encoding: "utf-8" | "windows-1255"): Promise<ImportSheet[]> {
  if (!file.size || file.size > IMPORT_MAX_BYTES) throw new Error("בחרו קובץ בגודל עד 5 MB");
  if (/\.csv$/i.test(file.name)) {
    let text: string;
    try { text = new TextDecoder(encoding, { fatal: true }).decode(await file.arrayBuffer()); }
    catch { throw new Error("קידוד הקובץ אינו מתאים. בחרו קידוד עברית Windows או שמרו מחדש כ־CSV UTF-8."); }
    return [parseCsv(text)];
  }
  if (/\.xlsx$/i.test(file.name)) {
    const { default: readExcel } = await import("read-excel-file/browser");
    let sheets;
    try { sheets = await readExcel(file); } catch { throw new Error("לא ניתן לקרוא את קובץ ה־Excel. ודאו שזה קובץ xlsx תקין ללא סיסמה."); }
    const populated = sheets.filter((sheet) => sheet.data.some((row) => row.some((cell) => cell != null && String(cell).trim())));
    if (!populated.length) throw new Error("הקובץ אינו מכיל נתונים");
    return populated.map((sheet) => {
      // The library's Date type declaration uses DateConstructor; values are Date instances.
      const data = sheet.data.map((row) => row.map((cell): ImportCell => cell instanceof Date ? cell : typeof cell === "string" || typeof cell === "number" || typeof cell === "boolean" ? cell : null));
      try { return prepareSheet(sheet.sheet, data); }
      catch (error) { return { name: sheet.sheet, headers: [], rows: [], error: error instanceof Error ? error.message : "גיליון לא תקין" }; }
    });
  }
  throw new Error("נתמכים קובצי CSV ו־XLSX. קובץ XLS יש לשמור מחדש כ־XLSX.");
}
export function downloadCsv(filename: string, rows: unknown[][]) {
  const csv = Papa.unparse(rows, { escapeFormulae: true });
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
