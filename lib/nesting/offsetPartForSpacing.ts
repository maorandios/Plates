/**
 * SVGNest applies spacing internally via Clipper offset on parts (+0.5×spacing) and bin
 * inset (−0.5×spacing). Do not double-apply spacing in the app — reserve this module for a
 * future explicit polygon-offset path only if SvgNest spacing is bypassed.
 */
export const SPACING_APPLIED_INSIDE_SVGNEST = true as const;
