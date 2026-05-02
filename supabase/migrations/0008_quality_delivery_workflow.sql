-- ============================================================================
-- Migration 0008 — Quality + delivery workflow
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Quality result enum
-- ----------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'quality_result') then
    create type quality_result as enum (
      'passed',
      'failed',
      'rework'
    );
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 2) Quality records
-- ----------------------------------------------------------------------------

create table if not exists public.quality_records (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  result quality_result not null,
  checked_quantity integer not null check (checked_quantity > 0),
  failed_quantity integer not null default 0 check (failed_quantity >= 0),
  notes text,
  checked_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  constraint quality_records_failed_lte_checked check (failed_quantity <= checked_quantity)
);

create index if not exists quality_records_batch_idx on public.quality_records(batch_id);
create index if not exists quality_records_order_idx on public.quality_records(order_id);
create index if not exists quality_records_result_idx on public.quality_records(result);
create index if not exists quality_records_created_at_idx on public.quality_records(created_at desc);

-- ----------------------------------------------------------------------------
-- 3) Delivery records
-- ----------------------------------------------------------------------------

create table if not exists public.delivery_records (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null unique references public.batches(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  delivered_quantity integer not null check (delivered_quantity > 0),
  recipient_name text not null,
  recipient_phone text,
  notes text,
  delivered_by uuid references public.app_users(id),
  delivered_at timestamptz not null default now()
);

create index if not exists delivery_records_order_idx on public.delivery_records(order_id);
create index if not exists delivery_records_delivered_at_idx on public.delivery_records(delivered_at desc);

-- ----------------------------------------------------------------------------
-- 4) RLS policies
-- ----------------------------------------------------------------------------

alter table public.quality_records enable row level security;
alter table public.delivery_records enable row level security;

create policy quality_records_read on public.quality_records
  for select using (auth.uid() is not null);

create policy quality_records_insert_quality_or_manager on public.quality_records
  for insert with check (
    checked_by = auth.uid()
    and public.fn_current_user_role() in ('admin', 'production_manager', 'quality')
  );

create policy quality_records_update_manager on public.quality_records
  for update
  using (public.fn_is_manager_or_admin())
  with check (public.fn_is_manager_or_admin());

create policy quality_records_delete_manager on public.quality_records
  for delete using (public.fn_is_manager_or_admin());

create policy delivery_records_read on public.delivery_records
  for select using (auth.uid() is not null);

create policy delivery_records_insert_delivery_or_manager on public.delivery_records
  for insert with check (
    delivered_by = auth.uid()
    and public.fn_current_user_role() in ('admin', 'production_manager', 'delivery')
  );

create policy delivery_records_update_manager on public.delivery_records
  for update
  using (public.fn_is_manager_or_admin())
  with check (public.fn_is_manager_or_admin());

create policy delivery_records_delete_manager on public.delivery_records
  for delete using (public.fn_is_manager_or_admin());

-- ----------------------------------------------------------------------------
-- 5) Audit triggers
-- ----------------------------------------------------------------------------

drop trigger if exists trg_audit_quality_records on public.quality_records;
create trigger trg_audit_quality_records
  after insert or update or delete on public.quality_records
  for each row execute function public.fn_audit_trigger();

drop trigger if exists trg_audit_delivery_records on public.delivery_records;
create trigger trg_audit_delivery_records
  after insert or update or delete on public.delivery_records
  for each row execute function public.fn_audit_trigger();

-- ----------------------------------------------------------------------------
-- 6) API hardening
-- ----------------------------------------------------------------------------

revoke all on table
  public.quality_records,
  public.delivery_records
from anon;