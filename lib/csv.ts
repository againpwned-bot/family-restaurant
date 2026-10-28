export type CsvCell = string | number | null | undefined;

// Quotes every cell that needs it, and defuses values a spreadsheet would run as a formula.
export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: CsvCell[][]): string {
  return "﻿" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export function csvResponse(body: string, filename: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
