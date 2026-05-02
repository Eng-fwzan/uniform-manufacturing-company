-- ============================================================================
-- Migration 0010 — Inventory variants + order fabric reservation
-- ============================================================================

create table if not exists public.inventory_item_variants (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  color_name text not null default 'عام',
  color_code text,
  min_quantity numeric(12,2) not null default 0 check (min_quantity >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_item_variants_color_not_blank check (length(trim(color_name)) > 0)
);

create unique index if not exists inventory_item_variants_item_color_idx
  on public.inventory_item_variants (inventory_item_id, lower(color_name));

alter table public.inventory_movements
  add column if not exists inventory_variant_id uuid references public.inventory_item_variants(id);

alter table public.order_items
  add column if not exists inventory_item_id uuid references public.inventory_items(id),
  add column if not exists inventory_variant_id uuid references public.inventory_item_variants(id),
  add column if not exists fabric_consumption numeric(12,2) not null default 0 check (fabric_consumption >= 0);

create index if not exists inventory_variants_item_idx on public.inventory_item_variants(inventory_item_id);
create index if not exists inventory_variants_active_idx on public.inventory_item_variants(is_active);
create index if not exists inventory_movements_variant_idx on public.inventory_movements(inventory_variant_id);
create index if not exists order_items_inventory_item_idx on public.order_items(inventory_item_id);
create index if not exists order_items_inventory_variant_idx on public.order_items(inventory_variant_id);

insert into public.inventory_item_variants (inventory_item_id, color_name, min_quantity)
select item.id, 'عام', item.min_quantity
from public.inventory_items item
where not exists (
  select 1
  from public.inventory_item_variants variant
  where variant.inventory_item_id = item.id
    and lower(variant.color_name) = lower('عام')
);

update public.inventory_movements movement
set inventory_variant_id = variant.id
from public.inventory_item_variants variant
where movement.inventory_variant_id is null
  and variant.inventory_item_id = movement.inventory_item_id
  and variant.color_name = 'عام';

alter table public.inventory_item_variants enable row level security;

create policy inventory_item_variants_read on public.inventory_item_variants
  for select using (auth.uid() is not null);

create policy inventory_item_variants_write on public.inventory_item_variants
  for all
  using (public.fn_current_user_role() in ('admin', 'production_manager', 'purchasing', 'warehouse'))
  with check (public.fn_current_user_role() in ('admin', 'production_manager', 'purchasing', 'warehouse'));

drop trigger if exists trg_inventory_item_variants_updated_at on public.inventory_item_variants;
create trigger trg_inventory_item_variants_updated_at before update on public.inventory_item_variants
  for each row execute function public.fn_set_updated_at();

drop trigger if exists trg_audit_inventory_item_variants on public.inventory_item_variants;
create trigger trg_audit_inventory_item_variants
  after insert or update or delete on public.inventory_item_variants
  for each row execute function public.fn_audit_trigger();

revoke all on table public.inventory_item_variants from anon;