"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createBatchSchema, type CreateBatchFormValues } from "@/lib/utils/schemas";
import { saveBatch } from "@/lib/store";
import { nanoid } from "@/lib/utils/nanoid";
import type { Batch } from "@/types";
import { CuttingMethodField } from "@/features/batches/components/CuttingMethodField";

export function BatchForm() {
  const router = useRouter();

  const form = useForm<CreateBatchFormValues>({
    resolver: zodResolver(createBatchSchema),
    defaultValues: {
      name: "",
      notes: "",
      cuttingMethod: "laser" as const,
    },
  });

  function onSubmit(values: CreateBatchFormValues) {
    const now = new Date().toISOString();
    const batch: Batch = {
      id: nanoid(),
      name: values.name.trim(),
      notes: values.notes?.trim() || undefined,
      status: "draft",
      clientIds: [],
      cuttingMethod: values.cuttingMethod,
      createdAt: now,
      updatedAt: now,
    };

    saveBatch(batch);
    router.push(`/batches/${batch.id}`);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Batch Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. March Production Run #1"
                  autoFocus
                  {...field}
                />
              </FormControl>
              <FormDescription>
                A descriptive name for this production / cutting batch.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <CuttingMethodField control={form.control} name="cuttingMethod" />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Any additional information about this batch…"
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            Create Batch
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
