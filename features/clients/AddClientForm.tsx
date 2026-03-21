"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { addClientSchema, type AddClientFormValues } from "@/lib/utils/schemas";
import { saveClient, saveBatch, getBatchById, getClientsByBatch } from "@/lib/store";
import { nanoid } from "@/lib/utils/nanoid";
import { deriveClientCode } from "@/lib/codegen/clientCode";
import type { Client } from "@/types";

interface AddClientFormProps {
  batchId: string;
  onClientAdded: (client: Client) => void;
}

export function AddClientForm({ batchId, onClientAdded }: AddClientFormProps) {
  const form = useForm<AddClientFormValues>({
    resolver: zodResolver(addClientSchema),
    defaultValues: { fullName: "" },
  });

  function onSubmit(values: AddClientFormValues) {
    const existingClients = getClientsByBatch(batchId);
    const existingCodes = existingClients.map((c) => c.code);

    const code = deriveClientCode(values.fullName, existingCodes);

    const client: Client = {
      id: nanoid(),
      batchId,
      fullName: values.fullName.trim(),
      code,
      uploadedFileIds: [],
      createdAt: new Date().toISOString(),
    };

    saveClient(client);

    // Update batch clientIds
    const batch = getBatchById(batchId);
    if (batch) {
      saveBatch({
        ...batch,
        clientIds: [...batch.clientIds, client.id],
        status: batch.status === "draft" ? "active" : batch.status,
        updatedAt: new Date().toISOString(),
      });
    }

    form.reset();
    onClientAdded(client);
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex items-end gap-3"
      >
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel>Client Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Acme Steel Works" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="mb-0.5">
          Add Client
        </Button>
      </form>
    </Form>
  );
}
