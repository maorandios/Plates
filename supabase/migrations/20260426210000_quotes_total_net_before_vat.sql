-- Net subtotal after discount, before VAT — matches quote document “לפני מע״מ” for list display.
alter table public.quotes
  add column if not exists total_net_before_vat double precision;

comment on column public.quotes.total_net_before_vat is
  'Total price before VAT (after discount if any), aligned with the quote PDF.';
