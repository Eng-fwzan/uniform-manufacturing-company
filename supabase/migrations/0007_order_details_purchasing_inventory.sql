-- ============================================================================
-- Migration 0007 — Order details + purchasing + inventory foundation
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Order item details
-- ----------------------------------------------------------------------------

alter table public.order_items
  add column if not exists accessories jsonb not null default '{}'::jsonb,
  add column if not exists measurements jsonb not null default '{}'::jsonb;

-- ----------------------------------------------------------------------------
-- 2) Enum types
-- ----------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'purchase_request_status') then
    create type purchase_request_status as enum (
      'draft',
      'submitted',
      'approved',
      'ordered',
      'received',
      'cancelled'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'inventory_item_category') then
    create type inventory_item_category as enum (
      'fabric',
      'thread',
      'accessory',
      'finished_good',
      'other'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'inventory_movement_type') then
    create type inventory_movement_type as enum (
      'in',
      'out',
      'adjustment',
      'reservation'
    );
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 3) Purchase requests
-- ----------------------------------------------------------------------------

create table if not exists public.purchase_request_counters (
  year integer primary key,
  last_seq integer not null default 0
);

create or replace function public.fn_next_purchase_request_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer := extract(year from now())::int;
  v_seq integer;
begin
  insert into public.purchase_request_counters(year, last_seq)
    values (v_year, 1)
  on conflict (year) do update
    set last_seq = purchase_request_counters.last_seq + 1
  returning last_seq into v_seq;

  return format('PR-%s-%s', v_year, lpad(v_seq::text, 6, '0'));
end;
$$;

create table if not exists public.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null unique,
  status purchase_request_status not null default 'submitted',
  department department_code,
  requested_by uuid references public.app_users(id),
  approved_by uuid references public.app_users(id),
  approved_at timestamptz,
  needed_by date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.purchase_requests(id) on delete cascade,
  item_name text not null,
  category inventory_item_category not null default 'other',
  quantity numeric(12,2) not null check (quantity > 0),
  unit text not null default 'قطعة',
  notes text,
  created_at timestamptz not null default now()
);

create or replace function public.fn_set_purchase_request_number()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.request_number is null or new.request_number = '' then
    new.request_number := public.fn_next_purchase_request_number();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_purchase_requests_auto_number on public.purchase_requests;
create trigger trg_purchase_requests_auto_number
  before insert on public.purchase_requests
  for each row execute function public.fn_set_purchase_request_number();

create index if not exists purchase_requests_status_idx on public.purchase_requests(status);
create index if not exists purchase_requests_department_idx on public.purchase_requests(department);
create index if not exists purchase_request_items_request_idx on public.purchase_request_items(request_id);

-- ----------------------------------------------------------------------------
-- 4) Inventory
-- ----------------------------------------------------------------------------

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category inventory_item_category not null default 'other',
  unit text not null default 'قطعة',
  min_quantity numeric(12,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items(id),
  movement_type inventory_movement_type not null,
  quantity numeric(12,2) not null check (quantity > 0),
  reference_type text,
  reference_id uuid,
  notes text,
  recorded_by uuid references public.app_users(id),
  created_at timestamptz not null default now()
);

create index if not exists inventory_items_category_idx on public.inventory_items(category);
create index if not exists inventory_movements_item_idx on public.inventory_movements(inventory_item_id);
create index if not exists inventory_movements_type_idx on public.inventory_movements(movement_type);

-- ----------------------------------------------------------------------------
-- 5) RLS policies
-- ----------------------------------------------------------------------------

alter table public.purchase_request_counters enable row level security;
alter table public.purchase_requests enable row level security;
alter table public.purchase_request_items enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;

create policy purchase_requests_read on public.purchase_requests
  for select using (auth.uid() is not null);

create policy purchase_requests_insert on public.purchase_requests
  for insert with check (
    auth.uid() is not null
    and requested_by = auth.uid()
  );

create policy purchase_requests_update_purchasing_or_manager on public.purchase_requests
  for update
  using (public.fn_current_user_role() in ('admin', 'production_manager', 'purchasing'))
  with check (public.fn_current_user_role() in ('admin', 'production_manager', 'purchasing'));

create policy purchase_request_items_read on public.purchase_request_items
  for select using (auth.uid() is not null);

create policy purchase_request_items_write on public.purchase_request_items
  for all using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy inventory_items_read on public.inventory_items
  for select using (auth.uid() is not null);

create policy inventory_items_write on public.inventory_items
  for all using (public.fn_current_user_role() in ('admin', 'production_manager', 'purchasing', 'warehouse'))
  with check (public.fn_current_user_role() in ('admin', 'production_manager', 'purchasing', 'warehouse'));

create policy inventory_movements_read on public.inventory_movements
  for select using (auth.uid() is not null);

create policy inventory_movements_insert on public.inventory_movements
  for insert with check (
    auth.uid() is not null
    and recorded_by = auth.uid()
  );

-- ----------------------------------------------------------------------------
-- 6) Audit and updated_at triggers
-- ----------------------------------------------------------------------------

drop trigger if exists trg_purchase_requests_updated_at on public.purchase_requests;
create trigger trg_purchase_requests_updated_at before update on public.purchase_requests
  for each row execute function public.fn_set_updated_at();

drop trigger if exists trg_inventory_items_updated_at on public.inventory_items;
create trigger trg_inventory_items_updated_at before update on public.inventory_items
  for each row execute function public.fn_set_updated_at();

drop trigger if exists trg_audit_purchase_requests on public.purchase_requests;
create trigger trg_audit_purchase_requests
  after insert or update or delete on public.purchase_requests
  for each row execute function public.fn_audit_trigger();

drop trigger if exists trg_audit_inventory_items on public.inventory_items;
create trigger trg_audit_inventory_items
  after insert or update or delete on public.inventory_items
  for each row execute function public.fn_audit_trigger();

drop trigger if exists trg_audit_inventory_movements on public.inventory_movements;
create trigger trg_audit_inventory_movements
  after insert or update or delete on public.inventory_movements
  for each row execute function public.fn_audit_trigger();

-- ----------------------------------------------------------------------------
-- 7) API hardening
-- ----------------------------------------------------------------------------

revoke all on table
  public.purchase_request_counters,
  public.purchase_requests,
  public.purchase_request_items,
  public.inventory_items,
  public.inventory_movements
from anon;

revoke execute on function public.fn_next_purchase_request_number() from anon, authenticated;
revoke execute on function public.fn_set_purchase_request_number() from anon, authenticated;
