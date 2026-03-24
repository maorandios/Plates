/**
 * SVGNest input SVG is rebuilt per sheet because strip offsets depend on part order/count.
 * Heavy work is footprint preparation (cached in `NestingFootprintGeometryCache`).
 * This module is a placeholder for future memoization if strip layout stabilizes.
 */

export function describeSvgConversionStrategy(): string {
  return "Footprint geometry is cached per unique outer+spacing+simplify; SVG string is rebuilt per pack for strip layout.";
}
