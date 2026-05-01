-- ============================================================================
-- Migration 0001 — Phase 0: البنية الأساسية
-- نظام مصنع الزي الموحد
-- مرجع: docs/plan/system-master-plan-ar.md §4 (Phase 0)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Enum types
-- ----------------------------------------------------------------------------

create type user_role as enum (
  'admin',
  'production_manager',
  'purchasing',
  'warehouse',
  'cutting',
  'sewing',
  'embroidery',
  'quality',
  'packing',
  'delivery',
  'accountant'
);

create type department_code as enum (
  'cutting',
  'sewing',
  'embroidery',
  'quality',
  'packing',
  'delivery'
);

-- ----------------------------------------------------------------------------
-- 2) جدول المستخدمين (يربط مع auth.users)
-- ----------------------------------------------------------------------------

create table public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role user_role not null,
  department department_code,
  -- PIN مُجزّأ (hash) لاعتماد التابلت — لا يُخزَّن أبدًا كنص واضح
  pin_hash text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index app_users_role_idx on public.app_users(role);
create index app_users_department_idx on public.app_users(department) where department is not null;

-- ----------------------------------------------------------------------------
-- 3) إعدادات النظام (key/value)
-- ----------------------------------------------------------------------------

create table public.system_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.app_users(id)
);

-- القيم الافتراضية المحسومة (مرجع: README + الخطة الرئيسية §0)
insert into public.system_settings (key, value, description) values
  ('departments', '["cutting","sewing","embroidery","quality","packing","delivery"]'::jsonb,
    'الأقسام المعتمدة (محسومة): القص/الخياطة/التطريز/الجودة/التغليف/التسليم'),
  ('min_order_quantity_policy', '{"enabled": false, "min_quantity": 14}'::jsonb,
    'سياسة 14 قطعة: معطلة افتراضيًا — تُفعّل بقرار إداري'),
  ('purchasing_schedule', '{"days_per_week": 2, "default_days": ["sunday","wednesday"]}'::jsonb,
    'جدولة المشتريات: يومان أسبوعيًا + استثناء طارئ بموافقة'),
  ('overdue_customer_policy', '{"block_new_orders": true, "require_approval": true}'::jsonb,
    'منع طلب جديد للعميل المتعثر إلا بموافقة موثقة'),
  ('tablet_session_timeout_min', '30'::jsonb,
    'مدة جلسة التابلت بعد آخر نشاط (دقائق)');

-- ----------------------------------------------------------------------------
-- 4) سجل التدقيق (Audit Log)
-- مرجع: docs/requirements/modules-and-features-ar.md §3.1
-- ----------------------------------------------------------------------------

create table public.audit_log (
  id bigserial primary key,
  user_id uuid references public.app_users(id) on delete set null,
  action text not null,                    -- INSERT / UPDATE / DELETE / CUSTOM
  entity_type text not null,               -- اسم الجدول أو نوع الكيان
  entity_id text,                          -- معرّف السجل المتأثر
  old_data jsonb,
  new_data jsonb,
  metadata jsonb,                          -- بيانات إضافية (IP، Device، ...)
  created_at timestamptz not null default now()
);

create index audit_log_entity_idx on public.audit_log(entity_type, entity_id);
create index audit_log_user_idx on public.audit_log(user_id);
create index audit_log_created_at_idx on public.audit_log(created_at desc);

-- Trigger function عام لتسجيل تغييرات الجداول الحساسة
create or replace function public.fn_audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  -- محاولة استخراج user_id من جلسة Supabase
  begin
    v_user_id := auth.uid();
  exception when others then
    v_user_id := null;
  end;

  if (TG_OP = 'DELETE') then
    insert into public.audit_log(user_id, action, entity_type, entity_id, old_data)
    values (v_user_id, 'DELETE', TG_TABLE_NAME, OLD.id::text, to_jsonb(OLD));
    return OLD;
  elsif (TG_OP = 'UPDATE') then
    insert into public.audit_log(user_id, action, entity_type, entity_id, old_data, new_data)
    values (v_user_id, 'UPDATE', TG_TABLE_NAME, NEW.id::text, to_jsonb(OLD), to_jsonb(NEW));
    return NEW;
  elsif (TG_OP = 'INSERT') then
    insert into public.audit_log(user_id, action, entity_type, entity_id, new_data)
    values (v_user_id, 'INSERT', TG_TABLE_NAME, NEW.id::text, to_jsonb(NEW));
    return NEW;
  end if;

  return null;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5) الكيانات الخماسية الأساسية (هيكل أولي — تفاصيلها في Phase 1)
-- مرجع: docs/plan/system-master-plan-ar.md §2
-- ----------------------------------------------------------------------------

-- 5.1 العملاء
create type customer_classification as enum ('cash', 'credit_approved', 'overdue');

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  classification customer_classification not null default 'cash',
  credit_limit numeric(12,2) default 0,
  payment_terms_days integer default 0,
  sales_rep_id uuid references public.app_users(id),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5.2 الطلب (Order)
create type order_track as enum ('production', 'sample', 'modification');
create type order_status as enum ('draft', 'in_progress', 'completed', 'archived', 'cancelled');

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,                    -- مثلا O-2026-000123
  customer_id uuid not null references public.customers(id),
  track order_track not null default 'production',
  parent_order_id uuid references public.orders(id),    -- لربط العينة/التعديل بالأصل
  status order_status not null default 'draft',
  due_date date,
  notes text,
  created_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_customer_idx on public.orders(customer_id);
create index orders_status_idx on public.orders(status);
create index orders_parent_idx on public.orders(parent_order_id) where parent_order_id is not null;

-- 5.3 بنود الطلب
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_type text not null,             -- قميص/بنطال/جاكيت/عباءة/...
  fabric text,
  color text,
  embroidery_spec text,
  size_breakdown jsonb,                   -- {"S":10,"M":20,"L":15} أو تفصيل خاص
  quantity integer not null check (quantity > 0),
  notes text,
  created_at timestamptz not null default now()
);

create index order_items_order_idx on public.order_items(order_id);

-- 5.4 الدفعات
create type batch_status as enum ('open', 'in_transit', 'received', 'closed');

create table public.batches (
  id uuid primary key default gen_random_uuid(),
  batch_code text not null unique,        -- B-YYYY-XXXXXX
  order_id uuid not null references public.orders(id),
  order_item_id uuid references public.order_items(id),
  current_department department_code,
  quantity integer not null check (quantity > 0),
  status batch_status not null default 'open',
  created_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index batches_order_idx on public.batches(order_id);
create index batches_dept_idx on public.batches(current_department);
create index batches_status_idx on public.batches(status);
create index batches_created_at_idx on public.batches(created_at desc);

-- 5.5 حركات الانتقال (Transfers)
create type transfer_status as enum ('sent', 'received', 'rejected');

create table public.batch_transfers (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id),
  from_department department_code,        -- null = من المخزن/البداية
  to_department department_code not null,
  quantity_sent integer not null check (quantity_sent > 0),
  quantity_received integer,
  sent_by uuid not null references public.app_users(id),
  received_by uuid references public.app_users(id),
  sent_at timestamptz not null default now(),
  received_at timestamptz,
  status transfer_status not null default 'sent',
  notes text
);

create index batch_transfers_batch_idx on public.batch_transfers(batch_id);
create index batch_transfers_status_idx on public.batch_transfers(status);

-- 5.6 فروقات الكميات (Quantity Movements)
create type movement_type as enum (
  'extra_cut',     -- زيادة قص
  'shortage',      -- نقص
  'damaged',       -- تالف
  'waste',         -- هدر
  'free_giveaway', -- تسليم مجاني
  'rework'         -- إعادة عمل
);

create table public.quantity_movements (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.batches(id),
  order_id uuid not null references public.orders(id),
  department department_code,
  movement_type movement_type not null,
  quantity integer not null,              -- موجبة أو سالبة حسب الحركة
  reason text not null,
  recorded_by uuid not null references public.app_users(id),
  created_at timestamptz not null default now()
);

create index qm_order_idx on public.quantity_movements(order_id);
create index qm_batch_idx on public.quantity_movements(batch_id);
create index qm_type_idx on public.quantity_movements(movement_type);

-- 5.7 الملفات والأرشفة
create table public.order_files (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  file_path text not null,                -- مسار في Supabase Storage
  file_type text not null,                -- design / mockup / receipt / photo / ...
  file_name text not null,
  uploaded_by uuid references public.app_users(id),
  created_at timestamptz not null default now()
);

create index order_files_order_idx on public.order_files(order_id);

-- ----------------------------------------------------------------------------
-- 6) ربط Audit Triggers بالجداول الحساسة
-- ----------------------------------------------------------------------------

create trigger trg_audit_app_users
  after insert or update or delete on public.app_users
  for each row execute function public.fn_audit_trigger();

create trigger trg_audit_orders
  after insert or update or delete on public.orders
  for each row execute function public.fn_audit_trigger();

create trigger trg_audit_batches
  after insert or update or delete on public.batches
  for each row execute function public.fn_audit_trigger();

create trigger trg_audit_batch_transfers
  after insert or update or delete on public.batch_transfers
  for each row execute function public.fn_audit_trigger();

create trigger trg_audit_quantity_movements
  after insert or update or delete on public.quantity_movements
  for each row execute function public.fn_audit_trigger();

create trigger trg_audit_settings
  after insert or update or delete on public.system_settings
  for each row execute function public.fn_audit_trigger();

-- ----------------------------------------------------------------------------
-- 7) تحديث updated_at تلقائيًا
-- ----------------------------------------------------------------------------

create or replace function public.fn_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_app_users_updated_at before update on public.app_users
  for each row execute function public.fn_set_updated_at();
create trigger trg_customers_updated_at before update on public.customers
  for each row execute function public.fn_set_updated_at();
create trigger trg_orders_updated_at before update on public.orders
  for each row execute function public.fn_set_updated_at();
create trigger trg_batches_updated_at before update on public.batches
  for each row execute function public.fn_set_updated_at();
