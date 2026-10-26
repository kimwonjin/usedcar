// CSV 내려받기 공통: 엑셀에서 한글·키릴 문자가 깨지지 않도록 UTF-8 BOM을 붙인다
export function csvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  // 수식으로 해석되는 값(=, +, -, @ 시작)은 엑셀 수식 실행을 막는다. 전화번호·숫자(+77010000099, -5)는 그대로
  const safe = /^[=+\-@]/.test(text) && !/^[+-]?\d+$/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function csvResponse<R>(name: string, columns: [string, (r: R) => unknown][], rows: R[]) {
  const lines = [
    columns.map(([column]) => column).join(","),
    ...rows.map((r) => columns.map(([, get]) => csvCell(get(r))).join(",")),
  ];
  const date = new Date().toISOString().slice(0, 10);
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="satu-${name}-${date}.csv"`,
      "cache-control": "no-store",
    },
  });
}
