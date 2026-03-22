"use client";

import type { Control, FieldPath, FieldValues } from "react-hook-form";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CUTTING_METHOD_LABELS,
  CUTTING_METHOD_OPTIONS,
} from "@/types/production";
interface CuttingMethodFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  disabled?: boolean;
}

export function CuttingMethodField<T extends FieldValues>({
  control,
  name,
  disabled,
}: CuttingMethodFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Cutting method</FormLabel>
          <Select
            disabled={disabled}
            onValueChange={field.onChange}
            value={field.value}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="Select cutting method" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {CUTTING_METHOD_OPTIONS.map((m) => (
                <SelectItem key={m} value={m}>
                  {CUTTING_METHOD_LABELS[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormDescription>
            Required — nesting and cut rules will use this later (laser vs plasma vs oxy-fuel).
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
