-- ============================================================================
-- Migration 0004 — Tablet PIN + RLS Hardening
-- يعالج آثار Phase 0.5 قبل بدء Phase 1.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ----------------------------------------------------------------------------
-- 1) Helper functions
-- ----------------------------------------------------------------------------

create or replace function public.fn_current_user_department()
returns department_code
language sql
stable
security definer
set search_path = public
as $$
  select department
  from public.app_users
  where id = auth.uid() and is_active = true;
$$;

create or replace function public.fn_hash_pin(p_pin text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if public.fn_is_admin() is not true then
    raise exception 'forbidden';
  end if;

  if p_pin !~ '^\d{4,6}$' then
    raise exception 'PIN must be 4 to 6 digits';
  end if;

  return extensions.crypt(p_pin, extensions.gen_salt('bf', 10));
end;
$$;

create or replace function public.verify_department_pin(
  p_pin text,
  p_dept department_code
)
returns table (
  id uuid,
  full_name text,
  role user_role,
  department department_code
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select u.id, u.full_name, u.role, u.department
  from public.app_users u
  where u.is_active = true
    and u.department = p_dept
    and u.pin_hash is not null
    and p_pin ~ '^\d{4,6}$'
    and u.pin_hash = extensions.crypt(p_pin, u.pin_hash)
  limit 1;
$$;

revoke all on function public.fn_hash_pin(text) from public;
grant execute on function public.fn_hash_pin(text) to authenticated;

revoke all on function public.verify_department_pin(text, department_code) from public;
grant execute on function public.verify_department_pin(text, department_code) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2) حماية جداول العدادات من الوصول المباشر عبر API
-- ----------------------------------------------------------------------------

alter table public.batch_counters enable row level security;
alter table public.order_counters enable row level security;

-- ----------------------------------------------------------------------------
-- 3) تشديد سياسات كتابة الدفعات والتحويلات والحركات والملفات
-- ----------------------------------------------------------------------------

drop policy if exists batches_write on public.batches;
drop policy if exists transfers_write on public.batch_transfers;
drop policy if exists movements_write on public.quantity_movements;
drop policy if exists order_files_write on public.order_files;

create policy batches_insert_manager on public.batches
  for insert
  with check (
    public.fn_is_manager_or_admin()
    and (created_by is null or created_by = auth.uid())
  );

create policy batches_update_department_or_manager on public.batches
  for update
  using (
    public.fn_is_manager_or_admin()
    or current_department = public.fn_current_user_department()
  )
  with check (
    public.fn_is_manager_or_admin()
    or current_department = public.fn_current_user_department()
  );

create policy batches_delete_manager on public.batches
  for delete
  using (public.fn_is_manager_or_admin());

create policy transfers_insert_department_or_manager on public.batch_transfers
  for insert
  with check (
    public.fn_is_manager_or_admin()
    or (
      sent_by = auth.uid()
      and public.fn_current_user_department() is not null
      and (
        from_department = public.fn_current_user_department()
        or to_department = public.fn_current_user_department()
      )
    )
  );

create policy transfers_update_department_or_manager on public.batch_transfers
  for update
  using (
    public.fn_is_manager_or_admin()
    or public.fn_current_user_department() in (from_department, to_department)
  )
  with check (
    public.fn_is_manager_or_admin()
    or (
      public.fn_current_user_department() in (from_department, to_department)
      and (received_by is null or received_by = auth.uid())
    )
  );

create policy transfers_delete_manager on public.batch_transfers
  for delete
  using (public.fn_is_manager_or_admin());

create policy movements_insert_department_or_manager on public.quantity_movements
  for insert
  with check (
    recorded_by = auth.uid()
    and (
      public.fn_is_manager_or_admin()
      or department = public.fn_current_user_department()
    )
  );

create policy movements_update_manager on public.quantity_movements
  for update
  using (public.fn_is_manager_or_admin())
  with check (public.fn_is_manager_or_admin());

create policy movements_delete_manager on public.quantity_movements
  for delete
  using (public.fn_is_manager_or_admin());

create policy order_files_insert_active_user on public.order_files
  for insert
  with check (
    public.fn_current_user_role() is not null
    and (uploaded_by is null or uploaded_by = auth.uid())
  );

create policy order_files_update_owner_or_manager on public.order_files
  for update
  using (
    public.fn_is_manager_or_admin()
    or uploaded_by = auth.uid()
  )
  with check (
    public.fn_is_manager_or_admin()
    or uploaded_by = auth.uid()
  );

create policy order_files_delete_owner_or_manager on public.order_files
  for delete
  using (
    public.fn_is_manager_or_admin()
    or uploaded_by = auth.uid()
  );