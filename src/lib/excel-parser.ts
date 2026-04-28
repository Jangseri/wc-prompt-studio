import ExcelJS from "exceljs";
import { logger } from "./logger";

export interface ExcelParseResult {
  textContent: string;
  sheetNames: string[];
}

export async function parseExcel(
  buffer: Buffer,
  rid?: string
): Promise<ExcelParseResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const sheetNames: string[] = [];
  const textParts: string[] = [];

  workbook.eachSheet((sheet) => {
    sheetNames.push(sheet.name);

    // Sheet metadata
    const rowCount = sheet.rowCount;
    const colCount = sheet.columnCount;
    const mergeCount = sheet.model.merges?.length ?? 0;
    textParts.push(
      `\n=== 시트: ${sheet.name} (행: ${rowCount}, 열: ${colCount}, 병합셀: ${mergeCount}개) ===\n`
    );

    // Build merge map: cell address → master cell value
    const mergeMap = new Map<string, string>();
    if (sheet.model.merges) {
      for (const mergeRange of sheet.model.merges) {
        // mergeRange format: "A1:C3"
        const [startRef] = mergeRange.split(":");
        const masterCell = sheet.getCell(startRef);
        const masterValue = extractCellText(masterCell.value);
        if (masterValue.trim()) {
          mergeMap.set(startRef, masterValue);
        }
      }
    }

    // Parse rows
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        let text = extractCellText(cell.value);
        text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        cells.push(text);
      });

      const nonEmptyCells = cells.filter((c) => c.trim());
      if (nonEmptyCells.length === 0) return;

      // Single cell with internal line breaks → output as-is (preserves structure)
      // Multiple cells → join with " | " as column separator
      if (nonEmptyCells.length === 1) {
        textParts.push(nonEmptyCells[0]);
      } else {
        textParts.push(nonEmptyCells.join(" | "));
      }
    });
  });

  const textContent = textParts.join("\n");
  logger.info("[parse] xlsx", {
    rid,
    sheets: sheetNames.length,
    textLength: textContent.length,
  });

  return {
    textContent,
    sheetNames,
  };
}

function extractCellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "object" && "richText" in value) {
    return (value as { richText: { text: string }[] }).richText
      .map((rt) => rt.text)
      .join("");
  }
  if (typeof value === "object" && "text" in value) {
    return String((value as { text: string }).text);
  }
  if (typeof value === "object" && "result" in value) {
    return String((value as { result: unknown }).result ?? "");
  }
  return String(value);
}
