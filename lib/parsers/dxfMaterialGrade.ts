/**
 * Extract material / steel grade strings from DXF text (TEXT, MTEXT, blocks, layers).
 *
 * Supports:
 * - EN (S235, S355JR, …) and ST-52 family
 * - US plate lines like `6+PL3/8+A36` (splits on `+`)
 * - Bare ASTM-style designations (A36, A572-50, …)
 * - Compound standard references: AISC, AISI, ASTM, AWS, ASME, SSPC, UBC, BS, DIN, JIS
 */

import DxfParser from "dxf-parser";

/** Parsed DXF shape from dxf-parser (minimal typing). */
interface DxfBlock {
  entities?: unknown[];
}

export interface ParsedDxfLike {
  entities?: unknown[];
  blocks?: Record<string, DxfBlock>;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object";
}

/** Strip MTEXT control sequences enough for regex matching */
function flattenMtext(s: string): string {
  return s
    .replace(/\{\\[^;]*;/g, " ")
    .replace(/\\P/gi, " ")
    .replace(/[{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pushTextFromEntity(ent: Record<string, unknown>, sink: (s: string) => void): void {
  const type = ent.type;
  if (type === "TEXT" || type === "MTEXT") {
    const t = ent.text;
    if (typeof t === "string" && t.trim()) {
      sink(type === "MTEXT" ? flattenMtext(t) : t);
    }
  }
  if (type === "ATTDEF") {
    const t = ent.text;
    if (typeof t === "string" && t.trim()) sink(t);
    const tag = ent.tag;
    if (typeof tag === "string" && tag.trim()) sink(tag);
  }
  const layer = ent.layer;
  if (typeof layer === "string" && layer.trim()) sink(layer);
}

function walkEntityList(entities: unknown[] | undefined, sink: (s: string) => void): void {
  if (!Array.isArray(entities)) return;
  for (const e of entities) {
    if (!isRecord(e)) continue;
    pushTextFromEntity(e, sink);
  }
}

/** Collect searchable strings from model space and all block definitions */
export function collectDxfStringsForMaterial(parsed: ParsedDxfLike | null | undefined): string[] {
  if (!parsed) return [];
  const out: string[] = [];
  const sink = (s: string) => out.push(s);
  walkEntityList(parsed.entities, sink);
  const blocks = parsed.blocks;
  if (blocks && typeof blocks === "object") {
    for (const b of Object.values(blocks)) {
      walkEntityList(b?.entities, sink);
    }
  }
  return out;
}

/** AISC, AISI, ASTM, AWS, ASME, SSPC, UBC, BS, DIN, JIS + designation (e.g. ASTM A36, BS EN 10025-2) */
const STANDARD_CODES =
  "AISC|AISI|ASTM|AWS|ASME|SSPC|UBC|BS|DIN|JIS";

/**
 * Order: longer / more specific matches first where it matters.
 */
const GRADE_PATTERNS: RegExp[] = [
  new RegExp(
    `\\b(?:${STANDARD_CODES})(?:\\s+[\\w./\\-]+){1,8}\\b`,
    "gi"
  ),
  /\bS\d{3}[A-Z]{0,4}\b/gi, // S235 S355 S355JR S275J2 ...
  /\bSt\d{2}[\s.-]*\d\b/gi, // St52-3 St37-2
  /\bST[\s.-]*\d{2}(?:[\s.-]*\d)?\b/gi, // ST-52 ST52 ST 52
  /\bA\d{2,3}(?:\s*GR\.?\s*\d+|-\d+)?\b/gi, // A36 A529 A572-50 (after STANDARD so "ASTM A36" wins as full ref)
];

/** Normalize for deduping ST-52 vs ST52 vs ST 52 */
const DEDUPE_KEY = (s: string) =>
  s.toUpperCase().replace(/[\s.-]+/g, "");

function canonicalizeStandardCompound(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toUpperCase();
}

function canonicalizeGrade(raw: string): string {
  const t = raw.trim().replace(/\s+/g, " ").toUpperCase();
  if (!t) return t;
  if (new RegExp(`^(${STANDARD_CODES})\\b`, "i").test(t)) {
    return canonicalizeStandardCompound(raw);
  }
  const st3 = t.match(/^ST-(\d{2})-(\d)$/);
  if (st3) return `ST-${st3[1]}-${st3[2]}`;
  const st2h = t.match(/^ST-(\d{2})$/);
  if (st2h) return `ST-${st2h[1]}`;
  const st2x = t.match(/^ST(\d{2})-(\d)$/);
  if (st2x) return `ST-${st2x[1]}-${st2x[2]}`;
  const st2 = t.match(/^ST(\d{2})$/);
  if (st2) return `ST-${st2[1]}`;
  const en = t.match(/^S\s*(\d{3})\s*([A-Z]*)$/);
  if (en) return `S${en[1]}${en[2] || ""}`;
  const astmBare = t.match(/^A(\d{2,3})(?:-(\d+)|\s*GR\.?\s*(\d+))?$/);
  if (astmBare) {
    const n = astmBare[1];
    const suf = astmBare[2] ?? astmBare[3];
    return suf ? `A${n}-${suf}` : `A${n}`;
  }
  return t.replace(/\s/g, "");
}

/**
 * Find all grade-like substrings in a chunk of text.
 */
export function findMaterialGradesInText(text: string): string[] {
  const found = new Set<string>();
  const displayByKey = new Map<string, string>();

  for (const re of GRADE_PATTERNS) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    const r = new RegExp(re.source, re.flags);
    while ((match = r.exec(text)) !== null) {
      const raw = match[0];
      const canon = canonicalizeGrade(raw);
      if (canon.length < 3) continue;
      const key = DEDUPE_KEY(canon);
      if (!displayByKey.has(key) || canon.length > displayByKey.get(key)!.length) {
        displayByKey.set(key, canon);
      }
      found.add(key);
    }
  }

  return [...displayByKey.values()];
}

/**
 * Pick the best single grade from many strings (longest canonical wins — e.g. S355JR over S355).
 */
export function pickBestMaterialGrade(strings: string[]): string | undefined {
  const expanded: string[] = [];
  for (const s of strings) {
    expanded.push(s);
    if (s.includes("+")) {
      for (const part of s.split("+").map((p) => p.trim())) {
        if (part) expanded.push(part);
      }
    }
  }
  const all: string[] = [];
  for (const s of expanded) {
    all.push(...findMaterialGradesInText(s));
  }
  if (all.length === 0) return undefined;
  const byKey = new Map<string, string>();
  for (const g of all) {
    const key = DEDUPE_KEY(g);
    const prev = byKey.get(key);
    if (!prev || g.length >= prev.length) byKey.set(key, g);
  }
  const unique = [...byKey.values()];
  unique.sort((a, b) => b.length - a.length || a.localeCompare(b));
  return unique[0];
}

export function extractMaterialGradeFromParsedDxf(
  parsed: ParsedDxfLike | null | undefined
): string | undefined {
  return pickBestMaterialGrade(collectDxfStringsForMaterial(parsed));
}

/** When only the flat entity list is available (no blocks — e.g. slim storage). */
export function extractMaterialGradeFromEntities(
  entities: unknown[] | undefined
): string | undefined {
  if (!entities?.length) return undefined;
  const strings: string[] = [];
  walkEntityList(entities, (s) => strings.push(s));
  return pickBestMaterialGrade(strings);
}

/** Full parse of DXF text (includes BLOCKS) — use on upload and when file text is available on rebuild. */
export function extractMaterialGradeFromDxfText(content: string): string | undefined {
  try {
    const parser = new DxfParser();
    const parsed = parser.parseSync(content) as ParsedDxfLike;
    return extractMaterialGradeFromParsedDxf(parsed);
  } catch {
    return undefined;
  }
}
