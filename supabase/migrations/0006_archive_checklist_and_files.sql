-- ============================================================================
-- Migration 0006 — Archive checklist + files
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Checklist templates
-- ----------------------------------------------------------------------------

create table if not exists public.archive_checklist_templates (
  key text primary key,
  label text not null,
  sort_order integer not null default 0
);

insert into public.archive_checklist_templates (key, label, sort_order) values
  ('design_approval', 'اعتماد التصميم/التطريز', 1),
  ('final_photos', 'صور نهائية/مستندات داعمة', 2),
  ('delivery_note', 'سند تسليم', 3),
  ('invoice', 'فاتورة', 4),
  ('customer_signature', 'توقيع استلام العميل', 5)
on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
-- 2) Order archive checklist per order
-- ----------------------------------------------------------------------------

create table if not exists public.order_archive_checklist (
  order_id uuid references public.orders(id) on delete cascade,
  item_key text references public.archive_checklist_templates(key) on delete cascade,
  is_done boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.app_users(id),
  primary key (order_id, item_key)
);

alter table public.order_archive_checklist enable row level security;

create policy order_archive_checklist_read on public.order_archive_checklist
  for select using (auth.uid() is not null);

create policy order_archive_checklist_update on public.order_archive_checklist
  for update
  using (public.fn_is_manager_or_admin())
  with check (public.fn_is_manager_or_admin());

-- ----------------------------------------------------------------------------
-- 3) Seed checklist rows for each order
-- ----------------------------------------------------------------------------

create or replace function public.fn_seed_order_archive_checklist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.order_archive_checklist (order_id, item_key, is_done)
  select new.id, t.key, false
  from public.archive_checklist_templates t
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists trg_orders_seed_archive_checklist on public.orders;

create trigger trg_orders_seed_archive_checklist
  after insert on public.orders
  for each row execute function public.fn_seed_order_archive_checklist();

-- Backfill for existing orders
insert into public.order_archive_checklist (order_id, item_key, is_done)
select o.id, t.key, false
from public.orders o
cross join public.archive_checklist_templates t
where not exists (
  select 1
  from public.order_archive_checklist c
  where c.order_id = o.id and c.item_key = t.key
);

-- ----------------------------------------------------------------------------
-- 4) Storage bucket + policies for order files
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('order-files', 'order-files', true)
on conflict (id) do nothing;
