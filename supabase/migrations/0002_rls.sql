-- ============================================================================
-- Migration 0002 — Row Level Security (RLS)
-- مرجع: docs/requirements/modules-and-features-ar.md §3.1
-- مبدأ: لا توجد صلاحيات ضمنية. كل قراءة/كتابة محكومة بدور المستخدم.
-- ============================================================================

-- تفعيل RLS على كل الجداول
alter table public.app_users enable row level security;
alter table public.system_settings enable row level security;
alter table public.audit_log enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.batches enable row level security;
alter table public.batch_transfers enable row level security;
alter table public.quantity_movements enable row level security;
alter table public.order_files enable row level security;

-- ----------------------------------------------------------------------------
-- Helper: هل المستخدم الحالي بدور معيّن؟
-- ----------------------------------------------------------------------------
create or replace function public.fn_current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.app_users where id = auth.uid() and is_active = true;
$$;

create or replace function public.fn_is_admin()
returns boolean
language sql
stable
as $$
  select public.fn_current_user_role() = 'admin';
$$;

create or replace function public.fn_is_manager_or_admin()
returns boolean
language sql
stable
as $$
  select public.fn_current_user_role() in ('admin', 'production_manager');
$$;

-- ----------------------------------------------------------------------------
-- app_users: المستخدم يقرأ نفسه + الإدارة تقرأ/تكتب الكل
-- ----------------------------------------------------------------------------
create policy app_users_select_self on public.app_users
  for select using (id = auth.uid() or public.fn_is_admin());

create policy app_users_admin_all on public.app_users
  for all using (public.fn_is_admin()) with check (public.fn_is_admin());

-- ----------------------------------------------------------------------------
-- system_settings: قراءة للكل، كتابة للإدارة فقط
-- ----------------------------------------------------------------------------
create policy settings_read_all on public.system_settings
  for select using (auth.uid() is not null);

create policy settings_admin_write on public.system_settings
  for all using (public.fn_is_admin()) with check (public.fn_is_admin());

-- ----------------------------------------------------------------------------
-- audit_log: قراءة فقط للإدارة ومدير الإنتاج، إدراج عبر triggers (security definer)
-- ----------------------------------------------------------------------------
create policy audit_log_read on public.audit_log
  for select using (public.fn_is_manager_or_admin());

-- ----------------------------------------------------------------------------
-- customers / orders / order_items: قراءة لكل مستخدم نشط، كتابة بحسب الدور
-- ----------------------------------------------------------------------------
create policy customers_read on public.customers
  for select using (auth.uid() is not null);
create policy customers_write on public.customers
  for all using (public.fn_current_user_role() in ('admin','production_manager','accountant'))
  with check (public.fn_current_user_role() in ('admin','production_manager','accountant'));

create policy orders_read on public.orders
  for select using (auth.uid() is not null);
create policy orders_write on public.orders
  for all using (public.fn_is_manager_or_admin())
  with check (public.fn_is_manager_or_admin());

create policy order_items_read on public.order_items
  for select using (auth.uid() is not null);
create policy order_items_write on public.order_items
  for all using (public.fn_is_manager_or_admin())
  with check (public.fn_is_manager_or_admin());

-- ----------------------------------------------------------------------------
-- batches / transfers / movements: قراءة للكل، كتابة لمستخدم نشط
-- (التحقق التفصيلي على مستوى التطبيق — Server Actions)
-- ----------------------------------------------------------------------------
create policy batches_read on public.batches
  for select using (auth.uid() is not null);
create policy batches_write on public.batches
  for all using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy transfers_read on public.batch_transfers
  for select using (auth.uid() is not null);
create policy transfers_write on public.batch_transfers
  for all using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy movements_read on public.quantity_movements
  for select using (auth.uid() is not null);
create policy movements_write on public.quantity_movements
  for all using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy order_files_read on public.order_files
  for select using (auth.uid() is not null);
create policy order_files_write on public.order_files
  for all using (auth.uid() is not null)
  with check (auth.uid() is not null);
