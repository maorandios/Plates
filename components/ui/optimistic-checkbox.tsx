"use client";

import { useEffect, useState, type ComponentPropsWithoutRef } from "react";
import { flushSync } from "react-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

type Props = Omit<
  ComponentPropsWithoutRef<typeof Checkbox>,
  "checked" | "onCheckedChange"
> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

/**
 * Radix checkbox is controlled from parent props. When the parent re-render is slow
 * (merge + selection + nesting), the checkmark can lag. We show the user's choice
 * immediately, then drop the override once `checked` matches.
 *
 * React 18 batches setOverride + parent setState from the same handler into one
 * commit, so the expensive parent render still blocks the checkmark. We flush the
 * local override synchronously, then defer the parent update to the next task so
 * the browser can paint first.
 */
export function OptimisticCheckbox({
  checked,
  onCheckedChange,
  className,
  ...rest
}: Props) {
  const [override, setOverride] = useState<boolean | null>(null);
  const shown = override !== null ? override : checked;

  useEffect(() => {
    if (override === null) return;
    if (checked === override) {
      setOverride(null);
    }
  }, [checked, override]);

  return (
    <Checkbox
      {...rest}
      className={cn(className)}
      checked={shown}
      onCheckedChange={(v) => {
        const next = v === true;
        flushSync(() => {
          setOverride(next);
        });
        setTimeout(() => {
          onCheckedChange(next);
        }, 0);
      }}
    />
  );
}
