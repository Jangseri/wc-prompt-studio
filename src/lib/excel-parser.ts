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

    // 시트 메타데이터. 병합 개수는 LLM 이 시나리오 트리형 데이터인지
    // 가늠하는 힌트가 됨.
    const rowCount = sheet.rowCount;
    const colCount = sheet.columnCount;
    const mergeCount = sheet.model.merges?.length ?? 0;
    textParts.push(
      `\n=== 시트: ${sheet.name} (행: ${rowCount}, 열: ${colCount}, 병합셀: ${mergeCount}개) ===\n`
    );

    sheet.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        // 병합 자식 셀은 빈칸 처리. ExcelJS 가 자식 셀에 master 값을
        // 자동 반환하기 때문에 그대로 두면 한 값이 N번 반복되어 토큰을
        // 낭비하고 LLM 입력에 노이즈가 됨. 부모 노드는 이미 master 행에
        // 한 번 출력되므로 자식 행에선 비워서 시나리오 트리 모양을
        // 보존한다.
        if (cell.isMerged && cell.master !== cell) {
          cells.push("");
          return;
        }
        let text = extractCellText(cell.value);
        text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        cells.push(text);
      });

      // trailing 빈칸 제거. 모두 빈칸이면 행 자체 스킵.
      while (cells.length > 0 && !cells[cells.length - 1].trim()) cells.pop();
      if (cells.length === 0) return;

      // leading 빈칸 → [colN] 마커로 압축. 분기 깊이를 LLM 에게 전달.
      let leading = 0;
      while (leading < cells.length && !cells[leading].trim()) leading++;
      const remainder = cells.slice(leading);
      const prefix = leading > 0 ? `[col${leading + 1}] ` : "";
      textParts.push(prefix + remainder.join(" | "));
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
