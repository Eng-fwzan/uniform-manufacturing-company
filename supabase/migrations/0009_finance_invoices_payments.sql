-- ============================================================================
-- Migration 0009 — Finance: invoices + payments
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'invoice_status') then
    create type invoice_status as enum (
      'draft',
      'issued',
      'partially_paid',
      'paid',
      'cancelled'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'payment_method') then
    create type payment_method as enum (
      'cash',
      'bank_transfer',
      'card',
      'cheque',
      'other'
    );
  end if;
end $$;

create table if not exists public.invoice_counters (
  year integer primary key,
  last_seq integer not null default 0
);

create or replace function public.fn_next_invoice_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer := extract(year from now())::int;
  v_seq integer;
begin
  insert into public.invoice_counters(year, last_seq)
    values (v_year, 1)
  on conflict (year) do update
    set last_seq = invoice_counters.last_seq + 1
  returning last_seq into v_seq;

  return format('INV-%s-%s', v_year, lpad(v_seq::text, 6, '0'));
end;
$$;

create or replace function public.fn_set_invoice_number()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.invoice_number is null or new.invoice_number = '' then
    new.invoice_number := public.fn_next_invoice_number();
  end if;
  return new;
end;
$$;

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  order_id uuid not null unique references public.orders(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  status invoice_status not null default 'issued',
  issue_date date not null default current_date,
  due_date date,
  subtotal_amount numeric(12,2) not null default 0 check (subtotal_amount >= 0),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  tax_amount numeric(12,2) not null default 0 check (tax_amount >= 0),
  total_amount numeric(12,2) not null check (total_amount >= 0),
  notes text,
  created_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_total_matches_parts check (
    total_amount = subtotal_amount - discount_amount + tax_amount
  )
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity numeric(12,2) not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  total_amount numeric(12,2) not null check (total_amount >= 0),
  created_at timestamptz not null default now(),
  constraint invoice_items_total_matches_parts check (total_amount = quantity * unit_price)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  payment_date date not null default current_date,
  method payment_method not null default 'cash',
  reference_number text,
  notes text,
  recorded_by uuid references public.app_users(id),
  created_at timestamptz not null default now()
);

create index if not exists invoices_order_idx on public.invoices(order_id);
create index if not exists invoices_customer_idx on public.invoices(customer_id);
create index if not exists invoices_status_idx on public.invoices(status);
create index if not exists invoices_due_date_idx on public.invoices(due_date);
create index if not exists invoice_items_invoice_idx on public.invoice_items(invoice_id);
create index if not exists payments_invoice_idx on public.payments(invoice_id);
create index if not exists payments_date_idx on public.payments(payment_date desc);

drop trigger if exists trg_invoices_auto_number on public.invoices;
create trigger trg_invoices_auto_number
  before insert on public.invoices
  for each row execute function public.fn_set_invoice_number();

alter table public.invoice_counters enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;

create policy invoices_read on public.invoices
  for select using (auth.uid() is not null);

create policy invoices_insert_finance on public.invoices
  for insert with check (
    created_by = auth.uid()
    and public.fn_current_user_role() in ('admin', 'accountant')
  );

create policy invoices_update_finance on public.invoices
  for update
  using (public.fn_current_user_role() in ('admin', 'accountant'))
  with check (public.fn_current_user_role() in ('admin', 'accountant'));

create policy invoices_delete_admin on public.invoices
  for delete using (public.fn_current_user_role() = 'admin');

create policy invoice_items_read on public.invoice_items
  for select using (auth.uid() is not null);

create policy invoice_items_insert_finance on public.invoice_items
  for insert with check (public.fn_current_user_role() in ('admin', 'accountant'));

create policy invoice_items_update_finance on public.invoice_items
  for update
  using (public.fn_current_user_role() in ('admin', 'accountant'))
  with check (public.fn_current_user_role() in ('admin', 'accountant'));

create policy invoice_items_delete_admin on public.invoice_items
  for delete using (public.fn_current_user_role() = 'admin');

create policy payments_read on public.payments
  for select using (auth.uid() is not null);

create policy payments_insert_finance on public.payments
  for insert with check (
    recorded_by = auth.uid()
    and public.fn_current_user_role() in ('admin', 'accountant')
  );

create policy payments_update_finance on public.payments
  for update
  using (public.fn_current_user_role() in ('admin', 'accountant'))
  with check (public.fn_current_user_role() in ('admin', 'accountant'));

create policy payments_delete_admin on public.payments
  for delete using (public.fn_current_user_role() = 'admin');

drop trigger if exists trg_invoices_updated_at on public.invoices;
create trigger trg_invoices_updated_at before update on public.invoices
  for each row execute function public.fn_set_updated_at();

drop trigger if exists trg_audit_invoices on public.invoices;
create trigger trg_audit_invoices
  after insert or update or delete on public.invoices
  for each row execute function public.fn_audit_trigger();

drop trigger if exists trg_audit_payments on public.payments;
create trigger trg_audit_payments
  after insert or update or delete on public.payments
  for each row execute function public.fn_audit_trigger();

revoke all on table
  public.invoice_counters,
  public.invoices,
  public.invoice_items,
  public.payments
from anon;

revoke execute on function public.fn_next_invoice_number() from anon, authenticated;
revoke execute on function public.fn_set_invoice_number() from anon, authenticated;