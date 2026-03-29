import type { ReactNode } from "react";
import { redirect } from "next/navigation";

/**
 * Legacy batch / quote-job routes are disabled for the MVP.
 * The only quotation flow is Quick Quote at /quick-quote.
 */
export default function BatchesRedirectLayout({ children: _children }: { children: ReactNode }) {
  redirect("/quick-quote");
}
