-- ============================================================================
-- Migration 0003 — توليد كود الدفعة B-YYYY-XXXXXX
-- مرجع: docs/plan/system-master-plan-ar.md §1.1 (Phase 1)
-- ============================================================================

-- عداد سنوي للدفعات
create table public.batch_counters (
  year integer primary key,
  last_seq integer not null default 0
);

-- توليد الكود التالي بشكل ذرّي
create or replace function public.fn_next_batch_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer := extract(year from now())::int;
  v_seq integer;
begin
  insert into public.batch_counters(year, last_seq)
    values (v_year, 1)
  on conflict (year) do update
    set last_seq = batch_counters.last_seq + 1
  returning last_seq into v_seq;

  return format('B-%s-%s', v_year, lpad(v_seq::text, 6, '0'));
end;
$$;

-- إذا لم يُمرَّر batch_code، نولّده تلقائيًا
create or replace function public.fn_set_batch_code()
returns trigger language plpgsql as $$
begin
  if new.batch_code is null or new.batch_code = '' then
    new.batch_code := public.fn_next_batch_code();
  end if;
  return new;
end;
$$;

create trigger trg_batches_auto_code
  before insert on public.batches
  for each row execute function public.fn_set_batch_code();

-- نفس الفكرة لرقم الطلب O-YYYY-XXXXXX
create table public.order_counters (
  year integer primary key,
  last_seq integer not null default 0
);

create or replace function public.fn_next_order_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer := extract(year from now())::int;
  v_seq integer;
begin
  insert into public.order_counters(year, last_seq)
    values (v_year, 1)
  on conflict (year) do update
    set last_seq = order_counters.last_seq + 1
  returning last_seq into v_seq;

  return format('O-%s-%s', v_year, lpad(v_seq::text, 6, '0'));
end;
$$;

create or replace function public.fn_set_order_number()
returns trigger language plpgsql as $$
begin
  if new.order_number is null or new.order_number = '' then
    new.order_number := public.fn_next_order_number();
  end if;
  return new;
end;
$$;

create trigger trg_orders_auto_number
  before insert on public.orders
  for each row execute function public.fn_set_order_number();
