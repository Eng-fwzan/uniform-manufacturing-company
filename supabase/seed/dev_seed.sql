-- ============================================================================
-- Seed: بيانات أولية للتطوير
-- ⚠️ هذا الملف للتطوير المحلي فقط — لا يُستخدم في الإنتاج
--
-- لتشغيله بعد إنشاء مستخدم Admin من Supabase Auth Dashboard:
--   1) سجّل المستخدم في Supabase Auth بإيميل admin@example.com
--   2) خذ UUID وضعه في :admin_id أدناه
--   3) شغّل: psql -f supabase/seed/dev_seed.sql
-- ============================================================================

-- مثال: إدراج ملف المستخدم الإداري
-- insert into public.app_users (id, full_name, email, role)
-- values ('PUT-AUTH-USER-UUID-HERE', 'مدير النظام', 'admin@example.com', 'admin');

-- عملاء تجريبيون
insert into public.customers (name, phone, classification, credit_limit, payment_terms_days) values
  ('شركة التعليم الأهلي', '0501112233', 'credit_approved', 50000, 30),
  ('مطعم الأصالة', '0504445566', 'cash', 0, 0),
  ('مستشفى الشفاء', '0507778899', 'credit_approved', 80000, 45);
