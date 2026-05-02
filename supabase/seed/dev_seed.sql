-- ============================================================================
-- Seed: بيانات أولية للتطوير المحلي فقط
-- لا تستخدم هذا الملف في الإنتاج، لأنه ينشئ PINs تجريبية معروفة للأقسام.
--
-- التشغيل المحلي الآمن بدون reset:
--   .\.tools\supabase\supabase.exe db query -f supabase/seed/dev_seed.sql
-- ============================================================================

do $$
declare
  v_tablet_user record;
  v_admin_id uuid;
  v_actor_id uuid;
  v_customer_id uuid;
  v_order_id uuid;
  v_order_item_id uuid;
  v_batch_id uuid;
  v_inventory_item_id uuid;
  v_purchase_request_id uuid;
begin
  for v_tablet_user in
    select *
    from (values
      ('tablet-cutting@local.test', 'مشغل تابلت القص', 'cutting', 'cutting', '1111'),
      ('tablet-sewing@local.test', 'مشغل تابلت الخياطة', 'sewing', 'sewing', '2222'),
      ('tablet-embroidery@local.test', 'مشغل تابلت التطريز', 'embroidery', 'embroidery', '3333'),
      ('tablet-quality@local.test', 'مشغل تابلت الجودة', 'quality', 'quality', '4444'),
      ('tablet-packing@local.test', 'مشغل تابلت التغليف', 'packing', 'packing', '5555'),
      ('tablet-delivery@local.test', 'مشغل تابلت التسليم', 'delivery', 'delivery', '6666')
    ) as seed(email, full_name, role_name, department_code, pin)
  loop
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    select
      '00000000-0000-0000-0000-000000000000'::uuid,
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      v_tablet_user.email,
      extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', v_tablet_user.full_name, 'local_seed', true),
      now(),
      now()
    where not exists (
      select 1
      from auth.users existing_user
      where lower(existing_user.email) = lower(v_tablet_user.email)
    );

    insert into public.app_users (
      id,
      full_name,
      email,
      role,
      department,
      pin_hash,
      is_active,
      updated_at
    )
    select
      auth_user.id,
      v_tablet_user.full_name,
      v_tablet_user.email,
      v_tablet_user.role_name::public.user_role,
      v_tablet_user.department_code::public.department_code,
      extensions.crypt(v_tablet_user.pin, extensions.gen_salt('bf', 10)),
      true,
      now()
    from auth.users auth_user
    where lower(auth_user.email) = lower(v_tablet_user.email)
    on conflict (email) do update
      set full_name = excluded.full_name,
          role = excluded.role,
          department = excluded.department,
          pin_hash = excluded.pin_hash,
          is_active = true,
          updated_at = now();
  end loop;

  select id
  into v_admin_id
  from public.app_users
  where role = 'admin' and is_active = true
  order by created_at desc
  limit 1;

  select coalesce(
    v_admin_id,
    (select id from public.app_users where department = 'cutting' and is_active = true limit 1)
  )
  into v_actor_id;

  insert into public.customers (
    name,
    phone,
    classification,
    credit_limit,
    payment_terms_days,
    notes
  )
  select
    'شركة تجربة النظام',
    '0500000000',
    'credit_approved',
    50000,
    30,
    'local-dev-seed'
  where not exists (
    select 1 from public.customers where name = 'شركة تجربة النظام'
  );

  select id
  into v_customer_id
  from public.customers
  where name = 'شركة تجربة النظام'
  order by created_at
  limit 1;

  insert into public.orders (
    order_number,
    customer_id,
    track,
    status,
    due_date,
    notes,
    created_by
  )
  values (
    'O-DEMO-LOCAL-0001',
    v_customer_id,
    'production',
    'in_progress',
    current_date + 10,
    'local-dev-seed: طلب تجريبي لدورة الكمبيوتر والتابلت',
    v_actor_id
  )
  on conflict (order_number) do update
    set customer_id = excluded.customer_id,
        track = excluded.track,
        status = excluded.status,
        due_date = excluded.due_date,
        notes = excluded.notes,
        updated_at = now()
  returning id into v_order_id;

  select id
  into v_order_item_id
  from public.order_items
  where order_id = v_order_id
    and notes = 'local-dev-seed:order-item-1'
  order by created_at
  limit 1;

  if v_order_item_id is null then
    insert into public.order_items (
      order_id,
      product_type,
      fabric,
      color,
      embroidery_spec,
      size_breakdown,
      quantity,
      accessories,
      measurements,
      notes
    )
    values (
      v_order_id,
      'قميص تجريبي',
      'قطن مخلوط',
      'أزرق كحلي',
      'شعار صغير على الصدر',
      '{"S":4,"M":8,"L":8,"XL":4}'::jsonb,
      24,
      '{"buttons":"أزرق","label":"UMC"}'::jsonb,
      '{"chest_cm":54,"length_cm":76}'::jsonb,
      'local-dev-seed:order-item-1'
    )
    returning id into v_order_item_id;
  else
    update public.order_items
    set product_type = 'قميص تجريبي',
        fabric = 'قطن مخلوط',
        color = 'أزرق كحلي',
        embroidery_spec = 'شعار صغير على الصدر',
        size_breakdown = '{"S":4,"M":8,"L":8,"XL":4}'::jsonb,
        quantity = 24,
        accessories = '{"buttons":"أزرق","label":"UMC"}'::jsonb,
        measurements = '{"chest_cm":54,"length_cm":76}'::jsonb
    where id = v_order_item_id;
  end if;

  insert into public.batches (
    batch_code,
    order_id,
    order_item_id,
    current_department,
    quantity,
    status,
    created_by
  )
  values (
    'B-DEMO-LOCAL-0001',
    v_order_id,
    v_order_item_id,
    'cutting',
    24,
    'received',
    v_actor_id
  )
  on conflict (batch_code) do update
    set order_id = excluded.order_id,
        order_item_id = excluded.order_item_id,
        current_department = excluded.current_department,
        quantity = excluded.quantity,
        status = excluded.status,
        updated_at = now()
  returning id into v_batch_id;

  update public.batch_transfers
  set status = 'rejected',
      notes = concat_ws(E'\n', notes, 'local-dev-seed reset the demo batch to cutting')
  where batch_id = v_batch_id
    and status <> 'rejected';

  select id
  into v_inventory_item_id
  from public.inventory_items
  where name = 'قماش قطني تجريبي'
  order by created_at
  limit 1;

  if v_inventory_item_id is null then
    insert into public.inventory_items (
      name,
      category,
      unit,
      min_quantity
    )
    values (
      'قماش قطني تجريبي',
      'fabric',
      'متر',
      50
    )
    returning id into v_inventory_item_id;
  else
    update public.inventory_items
    set category = 'fabric',
        unit = 'متر',
        min_quantity = 50,
        is_active = true,
        updated_at = now()
    where id = v_inventory_item_id;
  end if;

  if not exists (
    select 1
    from public.inventory_movements
    where inventory_item_id = v_inventory_item_id
      and reference_type = 'local-dev-seed'
  ) then
    insert into public.inventory_movements (
      inventory_item_id,
      movement_type,
      quantity,
      reference_type,
      reference_id,
      notes,
      recorded_by
    )
    values (
      v_inventory_item_id,
      'in',
      120,
      'local-dev-seed',
      v_order_id,
      'رصيد افتتاحي للتجربة المحلية',
      v_actor_id
    );
  end if;

  insert into public.purchase_requests (
    request_number,
    status,
    department,
    requested_by,
    needed_by,
    notes
  )
  values (
    'PR-DEMO-LOCAL-0001',
    'submitted',
    'cutting',
    v_actor_id,
    current_date + 7,
    'local-dev-seed: طلب شراء تجريبي'
  )
  on conflict (request_number) do update
    set status = excluded.status,
        department = excluded.department,
        requested_by = excluded.requested_by,
        needed_by = excluded.needed_by,
        notes = excluded.notes,
        updated_at = now()
  returning id into v_purchase_request_id;

  if not exists (
    select 1
    from public.purchase_request_items
    where request_id = v_purchase_request_id
      and item_name = 'أزرار قميص تجريبية'
  ) then
    insert into public.purchase_request_items (
      request_id,
      item_name,
      category,
      quantity,
      unit,
      notes
    )
    values (
      v_purchase_request_id,
      'أزرار قميص تجريبية',
      'accessory',
      250,
      'قطعة',
      'local-dev-seed'
    );
  end if;
end $$;
