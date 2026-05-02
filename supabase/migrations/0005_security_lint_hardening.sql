-- ============================================================================
-- Migration 0005 — Security lint hardening
-- Fix mutable search_path + remove anon exposure where safe.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Fix mutable search_path warnings
-- ----------------------------------------------------------------------------

create or replace function public.fn_is_admin()
returns boolean
language sql
stable
set search_path = public
as $$
  select public.fn_current_user_role() = 'admin';
$$;

create or replace function public.fn_is_manager_or_admin()
returns boolean
language sql
stable
set search_path = public
as $$
  select public.fn_current_user_role() in ('admin', 'production_manager');
$$;

create or replace function public.fn_set_batch_code()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.batch_code is null or new.batch_code = '' then
    new.batch_code := public.fn_next_batch_code();
  end if;
  return new;
end;
$$;

create or replace function public.fn_set_order_number()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.order_number is null or new.order_number = '' then
    new.order_number := public.fn_next_order_number();
  end if;
  return new;
end;
$$;

create or replace function public.fn_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2) Remove anonymous access to internal tables (GraphQL exposure)
-- ----------------------------------------------------------------------------

revoke all on table
  public.app_users,
  public.audit_log,
  public.batch_counters,
  public.batch_transfers,
  public.batches,
  public.customers,
  public.order_counters,
  public.order_files,
  public.order_items,
  public.orders,
  public.quantity_movements,
  public.system_settings
from anon;

-- ----------------------------------------------------------------------------
-- 3) Prevent anon RPC access to SECURITY DEFINER functions (except PIN verify)
-- ----------------------------------------------------------------------------

revoke execute on function public.fn_audit_trigger() from anon;
revoke execute on function public.fn_current_user_role() from anon;
revoke execute on function public.fn_current_user_department() from anon;
revoke execute on function public.fn_hash_pin(text) from anon;
revoke execute on function public.fn_next_batch_code() from anon;
revoke execute on function public.fn_next_order_number() from anon;
