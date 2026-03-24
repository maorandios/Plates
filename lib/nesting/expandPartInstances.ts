import type { Part, ProcessedGeometry } from "@/types";

export interface NestablePartInstance {
  partInstanceId: string;
  partId: string;
  partName: string;
  clientId: string;
  clientCode: string;
  material?: string;
  thicknessMm: number | null;
  outer: [number, number][];
  holes: [number, number][][];
  netAreaMm2: number;
  markingText: string;
}

export function expandPartInstances(
  parts: Part[],
  geometryByPartId: Map<string, ProcessedGeometry>,
  markingByPartId: Map<string, string>
): NestablePartInstance[] {
  const out: NestablePartInstance[] = [];
  for (const p of parts) {
    const pg = geometryByPartId.get(p.id);
    if (!pg) continue;
    const qty = Math.max(0, Math.floor(p.quantity ?? 1));
    if (qty < 1) continue;
    const mark = markingByPartId.get(p.id) ?? (p.partName.trim() || "—");
    for (let i = 0; i < qty; i++) {
      out.push({
        partInstanceId: `${p.id}::${i + 1}`,
        partId: p.id,
        partName: p.partName,
        clientId: p.clientId,
        clientCode: p.clientCode,
        material: p.material,
        thicknessMm: p.thickness ?? null,
        outer: pg.outer.map(([x, y]) => [x, y] as [number, number]),
        holes: pg.holes.map((h) =>
          h.map(([x, y]) => [x, y] as [number, number])
        ),
        netAreaMm2: pg.area,
        markingText: mark,
      });
    }
  }
  return out;
}
