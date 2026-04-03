import { cn } from "@/lib/utils";

/** Side-view schematic of the Omega template (5 segments, full Ω). */
export function OmegaProfileGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 72 52"
      className={cn("text-foreground", className)}
      aria-hidden
    >
      <path
        d="M 8 40 L 28 40 L 28 12 L 44 12 L 44 40 L 64 40"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
