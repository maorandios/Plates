"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
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
import { clientFormSchema, type ClientFormValues } from "@/lib/utils/schemas";
import type { Client } from "@/types";

export interface ClientFormProps {
  defaultValues?: Partial<ClientFormValues>;
  /** Shown after create — read-only */
  generatedShortCode?: string;
  /** Lock fields after successful create */
  readOnly?: boolean;
  onSubmit: (values: ClientFormValues) => void;
  onCancel?: () => void;
  submitLabel?: string;
}

const emptyDefaults: ClientFormValues = {
  fullName: "",
  contactName: "",
  email: "",
  phone: "",
  notes: "",
  status: "active",
};

export function ClientForm({
  defaultValues,
  generatedShortCode,
  readOnly = false,
  onSubmit,
  onCancel,
  submitLabel = "Save",
}: ClientFormProps) {
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: { ...emptyDefaults, ...defaultValues },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4 max-w-lg"
      >
        {generatedShortCode && (
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Client code
            </p>
            <p className="text-2xl font-mono font-bold tracking-widest text-foreground mt-1">
              {generatedShortCode}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Permanent global code for marking and traceability.
            </p>
          </div>
        )}

        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Client name</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. Alon Steel Industries"
                  disabled={readOnly}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="contactName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contact name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Optional"
                  disabled={readOnly}
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="Optional"
                    disabled={readOnly}
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Optional"
                    disabled={readOnly}
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Internal notes"
                  className="min-h-[88px] resize-y"
                  disabled={readOnly}
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={readOnly}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-wrap gap-2 pt-2">
          {!readOnly && <Button type="submit">{submitLabel}</Button>}
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}

export function clientFormValuesFromClient(c: Client): ClientFormValues {
  return {
    fullName: c.fullName,
    contactName: c.contactName ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    notes: c.notes ?? "",
    status: c.status,
  };
}
