-- ============================================================================
-- Migration 0012 — Order file descriptions and storage upload policies
-- ============================================================================

alter table public.order_files
  add column if not exists description text;

comment on column public.order_files.description is 'تفاصيل مختصرة عن ملف الطلب مثل ملاحظات التصميم أو شعار التطريز.';

drop policy if exists order_files_storage_read on storage.objects;
create policy order_files_storage_read on storage.objects
  for select
  using (bucket_id = 'order-files' and auth.uid() is not null);

drop policy if exists order_files_storage_insert on storage.objects;
create policy order_files_storage_insert on storage.objects
  for insert
  with check (bucket_id = 'order-files' and auth.uid() is not null);

drop policy if exists order_files_storage_update on storage.objects;
create policy order_files_storage_update on storage.objects
  for update
  using (bucket_id = 'order-files' and public.fn_is_manager_or_admin())
  with check (bucket_id = 'order-files' and public.fn_is_manager_or_admin());

drop policy if exists order_files_storage_delete on storage.objects;
create policy order_files_storage_delete on storage.objects
  for delete
  using (bucket_id = 'order-files' and public.fn_is_manager_or_admin());