import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { BendTemplateId } from "./types";

/** Matches plate preview / metric accent in quick quote. */
const GLYPH_CLASS = "text-[#00FF9F]";

/** Thin schematic strokes (side-view icons). */
const STROKE = 2.2;

function GlyphSvg({
  className,
  children,
  viewBox,
}: {
  className?: string;
  children: ReactNode;
  viewBox: string;
}) {
  return (
    <svg
      viewBox={viewBox}
      className={cn(GLYPH_CLASS, className)}
      fill="none"
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** L — זוית: heavy vertical + horizontal meeting at 90°. */
export function LProfileGlyph({ className }: { className?: string }) {
  return (
    <GlyphSvg viewBox="0 0 72 52" className={className}>
      <path
        d="M 14 44 L 14 14 L 54 14"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </GlyphSvg>
  );
}

/** U — תעלה: squared channel, open upward. */
export function UProfileGlyph({ className }: { className?: string }) {
  return (
    <GlyphSvg viewBox="0 0 72 52" className={className}>
      <path
        d="M 16 16 L 16 42 L 56 42 L 56 16"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </GlyphSvg>
  );
}

/** Z — מדרגה: top run, drop, bottom run (three thick segments). */
export function ZProfileGlyph({ className }: { className?: string }) {
  return (
    <GlyphSvg viewBox="0 0 72 52" className={className}>
      <path
        d="M 8 14 H 46 V 36 H 64"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </GlyphSvg>
  );
}

/** Omega — אומגה: five segments, hat / Ω profile. */
export function OmegaProfileGlyph({ className }: { className?: string }) {
  return (
    <GlyphSvg viewBox="0 0 72 52" className={className}>
      <path
        d="M 6 42 L 26 42 L 26 12 L 46 12 L 46 42 L 66 42"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </GlyphSvg>
  );
}

/** Gutter — מרזב: bath with outward lips at top (side view). */
export function GutterProfileGlyph({ className }: { className?: string }) {
  return (
    <GlyphSvg viewBox="0 0 72 52" className={className}>
      <path
        d="M 6 20 L 12 14 L 12 40 L 60 40 L 60 14 L 66 20"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </GlyphSvg>
  );
}

/** Custom — מותאם אישית: stepped path, several bends. */
export function CustomProfileGlyph({ className }: { className?: string }) {
  return (
    <GlyphSvg viewBox="0 0 72 52" className={className}>
      <path
        d="M 6 42 L 6 30 L 22 30 L 22 18 L 40 18 L 40 28 L 54 28 L 54 14 L 66 14"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </GlyphSvg>
  );
}

const GLYPH_BY_TEMPLATE: Record<
  BendTemplateId,
  React.ComponentType<{ className?: string }>
> = {
  l: LProfileGlyph,
  u: UProfileGlyph,
  z: ZProfileGlyph,
  omega: OmegaProfileGlyph,
  gutter: GutterProfileGlyph,
  custom: CustomProfileGlyph,
};

/** Picker tile icon — uniform size via `className` (e.g. `h-10 w-[4.5rem]`). */
export function BendTemplatePickerGlyph({
  id,
  className,
}: {
  id: BendTemplateId;
  className?: string;
}) {
  const Cmp = GLYPH_BY_TEMPLATE[id];
  return <Cmp className={className} />;
}
