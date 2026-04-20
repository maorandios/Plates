import { forwardRef } from "react";

/**
 * File-with-fold + centered “DXF” pill — matches common DXF file affordances (line art + label).
 */
export const DxfFileBadgeIcon = forwardRef<
  SVGSVGElement,
  React.SVGProps<SVGSVGElement>
>(function DxfFileBadgeIcon({ className, ...props }, ref) {
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.35}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      {...props}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <rect
        x="3.5"
        y="9"
        width="17"
        height="7.5"
        rx="2"
        fill="currentColor"
        fillOpacity="0.08"
        stroke="currentColor"
        strokeWidth={1.2}
      />
      <text
        x="12"
        y="15.25"
        textAnchor="middle"
        fill="currentColor"
        stroke="none"
        strokeWidth="0"
        fontSize="6.25"
        fontWeight="700"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        letterSpacing="-0.02em"
      >
        DXF
      </text>
    </svg>
  );
});

DxfFileBadgeIcon.displayName = "DxfFileBadgeIcon";
