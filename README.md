# uniform-manufacturing-company

نظام إدارة مصنع الزي الموحد — **لوكل (On‑Premise) + تابلت (Touch Friendly)** مع تتبع دفعات غير مكلف.

## التقنيات

- **Frontend & Backend:** Next.js 15 (App Router) + TypeScript + React 19
- **التنسيق:** Tailwind CSS مع دعم RTL/عربي كامل
- **قاعدة البيانات والمصادقة:** Supabase (PostgreSQL + Auth + Storage + RLS)
- **النشر:** On-Premise (Self-Hosted Supabase داخل الشبكة)

## التشغيل المحلي

```bash
# 1) ثبّت التبعيات
npm install

# 2) انسخ متغيرات البيئة وعبّئها
cp .env.example .env.local

# (Windows PowerShell بديل)
# Copy-Item .env.example .env.local

# المتغيرات المطلوبة لتشغيل Phase 0 حاليًا:
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - TABLET_SESSION_SECRET (عند تفعيل دخول التابلت بـ PIN)
# تحصل عليها من Supabase Dashboard → Project Settings → API
# ملاحظة: SUPABASE_SERVICE_ROLE_KEY سرّي وغير مطلوب في Phase 0.

# 3) شغّل migrations على Supabase (محليًا أو Self-Hosted)
#    افتح Supabase Studio → SQL Editor ونفّذ بالترتيب:
#      supabase/migrations/0001_initial.sql
#      supabase/migrations/0002_rls.sql
#      supabase/migrations/0003_batch_codes.sql
#      supabase/migrations/0004_tablet_pin_and_rls_hardening.sql
#      supabase/migrations/0005_security_lint_hardening.sql
#      supabase/migrations/0006_archive_checklist_and_files.sql
#      supabase/migrations/0007_order_details_purchasing_inventory.sql
#      supabase/migrations/0008_quality_delivery_workflow.sql
#      supabase/migrations/0009_finance_invoices_payments.sql
#      supabase/migrations/0010_inventory_variants_order_reservations.sql
#      supabase/migrations/0011_inventory_reservation_release.sql

# 4) أنشئ مستخدم Admin من Supabase Auth Dashboard ثم أدخله في app_users
# 5) شغّل التطبيق
npm run dev
```

ثم افتح <http://localhost:3000>

## الأوامر المتاحة

| الأمر | الوصف |
| --- | --- |
| `npm run dev` | تشغيل التطوير |
| `npm run build` | بناء الإنتاج |
| `npm run start` | تشغيل الإنتاج |
| `npm run lint` | فحص ESLint |
| `npm run typecheck` | فحص TypeScript |

## هيكل المشروع

```text
src/
├── app/                      # صفحات Next.js (App Router)
│   ├── login/                # تسجيل دخول الكمبيوتر
│   ├── tablet/               # واجهات التابلت + PIN
│   ├── dashboard/            # لوحة التحكم
│   └── api/                  # نقاط API
├── lib/
│   ├── supabase/             # عملاء Supabase (browser/server/middleware)
│   ├── auth/                 # المصادقة + الصلاحيات
│   └── types/                # أنواع TypeScript
└── middleware.ts             # حماية المسارات + تجديد الجلسة

supabase/
├── migrations/               # SQL Migrations (مرتبة)
│   ├── 0001_initial.sql      # الجداول + Audit Log + الكيانات الخماسية
│   ├── 0002_rls.sql          # Row Level Security
│   └── 0003_batch_codes.sql  # توليد B-YYYY-XXXXXX و O-YYYY-XXXXXX
└── seed/                     # بيانات تجريبية (تطوير فقط)
```

## الوثائق

- 📘 [الخطة الرئيسية للنظام](docs/plan/system-master-plan-ar.md) — Baseline + خطة التنفيذ (Roadmap) + قرار تتبع الدفعات.
- 📗 [وحدات النظام والمميزات](docs/requirements/modules-and-features-ar.md) — تفصيل كل وحدة وربطها بالخماسية الأساسية.
- 📙 [الوضع الحالي → المستهدف](docs/process/as-is-to-be-ar.md) — مقارنة As‑Is vs To‑Be لكل محور تشغيلي.

## الخماسية الأساسية للنظام

1. الطلب (Order)
2. بنود الطلب (Order Items)
3. الدفعات (Batches)
4. حركات الانتقال والفروقات (Transfers & Quantity Movements)
5. الملفات والأرشفة (Files + Archive Checklist)

> أي رؤية/مقترح لا يرتبط بهذه الخماسية = خارج نطاق النظام الأساسي.

## القرارات المحسومة

- **النشر:** On‑Premise داخل الشركة.
- **الواجهة:** كمبيوتر + تابلت (Touch Friendly) بـ PIN في أرض المصنع.
- **تتبع الدفعات:** كود دفعة `B-YYYY-XXXXXX` + قائمة "دفعات اليوم" (Phase 1) — مع إمكانية إضافة Barcode 1D ثم QR لاحقًا.
- **أسماء الأقسام:** عامة — القص / الخياطة / التطريز / الجودة / التغليف والكي / التسليم. ✅
- **سياسة 14 قطعة:** معطلة افتراضيًا — تُستخدم عند الحاجة بقرار إداري صريح فقط. ✅

## حالة التنفيذ

- ✅ **Phase 0** — البنية الأساسية (هذا الـ PR): Next.js + Supabase + RLS + Audit Log + المصادقة + هيكل التابلت + الصلاحيات + الإعدادات
- ⏳ **Phase 1** — MVP خط الإنتاج (PR منفصل قادم): الطلبات + الدفعات + التسليم/الاستلام بـ PIN
- ⏳ **Phase 2** — المشتريات والمخزون
- ⏳ **Phase 3** — التسليم والفواتير والعينات
- ⏳ **Phase 4** — التحليلات والكتالوج
