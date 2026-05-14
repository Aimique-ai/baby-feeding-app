/**
 * Конвертирует WHO Child Growth Standards xlsx + PDF-таблицы в компактные JSON,
 * которые загружаются на сервере для расчёта z-score и перцентилей.
 *
 * Источник: https://www.who.int/tools/child-growth-standards/standards/weight-for-age
 *           https://www.who.int/tools/child-growth-standards/standards/weight-velocity
 *
 * Запуск: pnpm tsx scripts/build-who-data.ts
 *
 * На вход: docs/wfa-*.xlsx, docs/wv-*-zscore.xlsx, и PDF 0–60d (значения захардкожены).
 * На выход: lib/who/data/{wfa,velocity-monthly,velocity-early}.json
 */
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DOCS = path.resolve(SCRIPT_DIR, "../docs");
const OUT = path.resolve(SCRIPT_DIR, "../lib/who/data");

type LMSDaily = { day: number; L: number; M: number; S: number };
type LMSInterval = {
  intervalKey: string; // "0-4wks", "4wks-2mo", "2-3mo", ...
  startDays: number;
  endDays: number;
  L: number;
  M: number;
  S: number;
};

async function readSheet(filename: string): Promise<unknown[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(DOCS, filename));
  const ws = wb.worksheets[0];
  const out: unknown[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const r: unknown[] = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      r[col - 1] = cell.value;
    });
    out.push(r);
  });
  return out;
}

function asNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  if (
    v !== null &&
    typeof v === "object" &&
    "result" in v &&
    typeof (v as { result: unknown }).result === "number"
  )
    return (v as { result: number }).result;
  throw new Error(`not a number: ${JSON.stringify(v)}`);
}

async function parseWfa(filename: string): Promise<LMSDaily[]> {
  const rows = await readSheet(filename);
  // header: Day, L, M, S, SD4neg, ... SD4
  const out: LMSDaily[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r[0] === undefined || r[0] === null) continue;
    out.push({
      day: asNumber(r[0]),
      L: asNumber(r[1]),
      M: asNumber(r[2]),
      S: asNumber(r[3]),
    });
  }
  return out;
}

// Парсит интервалы вида "0 – 4 wks", "4 wks – 2 mo", "2 – 3 mo", ...
function parseIntervalLabel(label: string): { start: number; end: number } {
  const norm = label.replace(/\s+/g, " ").trim();
  // Сначала разбиваем на левый/правый по en-dash или hyphen.
  const m = norm.match(
    /^(\d+(?:\s*wks?|\s*mo)?)\s*[–-]\s*(\d+\s*(?:wks?|mo))$/i,
  );
  if (!m) throw new Error(`cannot parse interval: "${label}"`);
  const toDays = (token: string): number => {
    const tm = token.trim().match(/^(\d+)\s*(wks?|mo)?$/i);
    if (!tm) throw new Error(`bad token: "${token}"`);
    const n = Number(tm[1]);
    const unit = (tm[2] ?? "mo").toLowerCase();
    if (unit.startsWith("w")) return n * 7;
    return Math.round(n * 30.4375);
  };
  const right = toDays(m[2]);
  // Левая часть может быть без единицы — наследует от правой.
  const leftRaw = m[1].trim();
  const leftHasUnit = /wks?|mo/i.test(leftRaw);
  const left = leftHasUnit
    ? toDays(leftRaw)
    : toDays(`${leftRaw} ${/wks?/i.test(m[2]) ? "wks" : "mo"}`);
  return { start: left, end: right };
}

async function parseVelocity(
  filename: string,
  windowKey: string,
): Promise<LMSInterval[]> {
  const rows = await readSheet(filename);
  // header: Interval, L, M, S, Delta, -3 SD, ..., 3 SD
  const out: LMSInterval[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0]) continue;
    const label = String(r[0]);
    const { start, end } = parseIntervalLabel(label);
    out.push({
      intervalKey: `${windowKey}:${label}`,
      startDays: start,
      endDays: end,
      L: asNumber(r[1]),
      M: asNumber(r[2]),
      S: asNumber(r[3]),
    });
  }
  return out;
}

// Эмпирические перцентили из PDF wv-*-0-60d.pdf, вручную перенесены.
// Колонки: P5, P10, P25, P50 (Median). По группам веса при рождении.
type EarlyRow = {
  startDays: number;
  endDays: number;
  byBirthWeight: Record<string, { p50: number; p25: number; p10: number; p5: number }>;
};

const EARLY_BOYS: EarlyRow[] = [
  {
    startDays: 0, endDays: 7,
    byBirthWeight: {
      "2500-3000": { p50: 150, p25: 0, p10: -150, p5: -200 },
      "3000-3500": { p50: 150, p25: 0, p10: -150, p5: -250 },
      "3500-4000": { p50: 150, p25: 0, p10: -250, p5: -300 },
      "4000+":     { p50: 50, p25: -50, p10: -250, p5: -250 },
    },
  },
  {
    startDays: 7, endDays: 14,
    byBirthWeight: {
      "2500-3000": { p50: 250, p25: 150, p10: 0, p5: -100 },
      "3000-3500": { p50: 250, p25: 150, p10: 50, p5: -50 },
      "3500-4000": { p50: 250, p25: 100, p10: 0, p5: -50 },
      "4000+":     { p50: 275, p25: 150, p10: 50, p5: -100 },
    },
  },
  {
    startDays: 14, endDays: 28,
    byBirthWeight: {
      "2500-3000": { p50: 700, p25: 550, p10: 450, p5: 450 },
      "3000-3500": { p50: 650, p25: 550, p10: 450, p5: 350 },
      "3500-4000": { p50: 700, p25: 500, p10: 400, p5: 350 },
      "4000+":     { p50: 725, p25: 550, p10: 400, p5: 400 },
    },
  },
  {
    startDays: 28, endDays: 42,
    byBirthWeight: {
      "2500-3000": { p50: 550, p25: 500, p10: 350, p5: 300 },
      "3000-3500": { p50: 550, p25: 450, p10: 350, p5: 300 },
      "3500-4000": { p50: 550, p25: 450, p10: 350, p5: 300 },
      "4000+":     { p50: 548, p25: 450, p10: 300, p5: 300 },
    },
  },
  {
    startDays: 42, endDays: 60,
    byBirthWeight: {
      "2500-3000": { p50: 650, p25: 550, p10: 450, p5: 450 },
      "3000-3500": { p50: 650, p25: 500, p10: 400, p5: 350 },
      "3500-4000": { p50: 650, p25: 500, p10: 400, p5: 350 },
      "4000+":     { p50: 611, p25: 400, p10: 300, p5: 217 },
    },
  },
];

const EARLY_GIRLS: EarlyRow[] = [
  {
    startDays: 0, endDays: 7,
    byBirthWeight: {
      "2500-3000": { p50: 150, p25: 0, p10: -100, p5: -150 },
      "3000-3500": { p50: 100, p25: 0, p10: -100, p5: -200 },
      "3500-4000": { p50: 100, p25: 0, p10: -150, p5: -250 },
      "4000+":     { p50: 150, p25: 0, p10: -100, p5: -200 },
    },
  },
  {
    startDays: 7, endDays: 14,
    byBirthWeight: {
      "2500-3000": { p50: 200, p25: 100, p10: 0, p5: -100 },
      "3000-3500": { p50: 200, p25: 100, p10: 0, p5: -50 },
      "3500-4000": { p50: 200, p25: 100, p10: 0, p5: -100 },
      "4000+":     { p50: 200, p25: 100, p10: 50, p5: 0 },
    },
  },
  {
    startDays: 14, endDays: 28,
    byBirthWeight: {
      "2500-3000": { p50: 600, p25: 450, p10: 400, p5: 300 },
      "3000-3500": { p50: 550, p25: 436, p10: 350, p5: 300 },
      "3500-4000": { p50: 550, p25: 450, p10: 300, p5: 250 },
      "4000+":     { p50: 600, p25: 450, p10: 300, p5: 200 },
    },
  },
  {
    startDays: 28, endDays: 42,
    byBirthWeight: {
      "2500-3000": { p50: 500, p25: 382, p10: 300, p5: 250 },
      "3000-3500": { p50: 465, p25: 400, p10: 300, p5: 250 },
      "3500-4000": { p50: 457, p25: 325, p10: 295, p5: 200 },
      "4000+":     { p50: 525, p25: 375, p10: 300, p5: 300 },
    },
  },
  {
    startDays: 42, endDays: 60,
    byBirthWeight: {
      "2500-3000": { p50: 550, p25: 400, p10: 300, p5: 289 },
      "3000-3500": { p50: 500, p25: 400, p10: 300, p5: 250 },
      "3500-4000": { p50: 585, p25: 408, p10: 350, p5: 250 },
      "4000+":     { p50: 550, p25: 334, p10: 155, p5: 150 },
    },
  },
];

async function main() {
  await fs.mkdir(OUT, { recursive: true });

  // 1. Weight-for-age, ежедневно
  console.log("parsing weight-for-age...");
  const wfa = {
    boys: await parseWfa("wfa-boys-zscore-expanded-tables.xlsx"),
    girls: await parseWfa("wfa-girls-zscore-expanded-tables.xlsx"),
  };
  await fs.writeFile(path.join(OUT, "wfa.json"), JSON.stringify(wfa));
  console.log(
    `  wfa: boys=${wfa.boys.length}d, girls=${wfa.girls.length}d`,
  );

  // 2. Velocity LMS таблицы (1/2/3/4/6 мес)
  console.log("parsing velocity LMS...");
  const windows = ["1mo", "2mo", "3mo", "4mo", "6mo"] as const;
  const velocity: Record<string, { boys: LMSInterval[]; girls: LMSInterval[] }> = {};
  for (const w of windows) {
    velocity[w] = {
      boys: await parseVelocity(`wv-boys-${w}-zscore.xlsx`, w),
      girls: await parseVelocity(`wv-girls-${w}-zscore.xlsx`, w),
    };
    console.log(
      `  ${w}: boys=${velocity[w].boys.length}, girls=${velocity[w].girls.length}`,
    );
  }
  await fs.writeFile(
    path.join(OUT, "velocity-monthly.json"),
    JSON.stringify(velocity),
  );

  // 3. Early velocity (PDF, эмпирические перцентили 0–60 дн)
  console.log("writing early velocity (PDF data)...");
  await fs.writeFile(
    path.join(OUT, "velocity-early.json"),
    JSON.stringify({ boys: EARLY_BOYS, girls: EARLY_GIRLS }),
  );

  console.log("done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
