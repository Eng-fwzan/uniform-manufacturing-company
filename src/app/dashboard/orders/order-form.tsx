"use client";

import { useActionState, useEffect, useRef, useState, type ChangeEvent } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { createCustomerAction, type CustomerFormState } from "../customers/actions";
import { createOrderAction, type OrderFormState } from "./actions";

type CustomerOption = { id: string; name: string };

type FabricVariantOption = {
  id: string;
  name: string;
  color_name: string;
  unit: string;
  balance: number;
};

const initialState: OrderFormState = {};
const initialCustomerState: CustomerFormState = {};

type ImagePreview = {
  url: string;
  name: string;
  size: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-tablet btn-primary w-full" disabled={pending}>
      {pending ? "جارٍ الحفظ..." : "إنشاء الطلب"}
    </button>
  );
}

export default function OrderForm({
  canCreate,
  canManageCustomers,
  customers,
  fabricVariants,
  className = "card space-y-4",
}: {
  canCreate: boolean;
  canManageCustomers: boolean;
  customers: CustomerOption[];
  fabricVariants: FabricVariantOption[];
  className?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const customerFormRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(createOrderAction, initialState);
  const [customerState, customerAction] = useActionState(createCustomerAction, initialCustomerState);
  const [designPreview, setDesignPreview] = useState<ImagePreview | null>(null);
  const [logoPreview, setLogoPreview] = useState<ImagePreview | null>(null);

  useEffect(() => {
    if (!state?.success) return;
    formRef.current?.reset();
    setDesignPreview((preview) => {
      if (preview) URL.revokeObjectURL(preview.url);
      return null;
    });
    setLogoPreview((preview) => {
      if (preview) URL.revokeObjectURL(preview.url);
      return null;
    });
    router.refresh();
  }, [router, state?.success]);

  useEffect(() => {
    if (!customerState?.success) return;
    customerFormRef.current?.reset();
    router.refresh();
  }, [customerState?.success, router]);

  useEffect(() => {
    return () => {
      if (designPreview) URL.revokeObjectURL(designPreview.url);
      if (logoPreview) URL.revokeObjectURL(logoPreview.url);
    };
  }, [designPreview, logoPreview]);

  function handlePreviewChange(
    event: ChangeEvent<HTMLInputElement>,
    setPreview: (updater: (preview: ImagePreview | null) => ImagePreview | null) => void,
  ) {
    const file = event.target.files?.[0] ?? null;
    setPreview((previous) => {
      if (previous) URL.revokeObjectURL(previous.url);
      if (!file) return null;

      return {
        url: URL.createObjectURL(file),
        name: file.name,
        size: formatFileSize(file.size),
      };
    });
  }

  if (!canCreate) {
    return (
      <div className="card text-sm text-slate-600">
        ليس لديك صلاحية لإنشاء طلب جديد.
      </div>
    );
  }

  if (customers.length === 0 && !canManageCustomers) {
    return (
      <div className="card text-sm text-slate-600">
        يجب إضافة عميل واحد على الأقل قبل إنشاء الطلبات.
      </div>
    );
  }

  if (fabricVariants.length === 0) {
    return (
      <div className="card text-sm text-slate-600">
        سجل قماشًا واحدًا على الأقل في المخزون مع اللون والرصيد قبل إنشاء الطلبات.
      </div>
    );
  }

  return (
    <>
    {canManageCustomers && (
      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-900">إضافة عميل سريع</h3>
          <p className="mt-1 text-sm text-slate-600">
            أضف اسم العميل هنا وسيظهر في قائمة العملاء وفي اختيار الطلب بعد الحفظ.
          </p>
        </div>
        <form ref={customerFormRef} action={customerAction} className="grid gap-3 lg:grid-cols-[1fr_12rem_auto] lg:items-end">
          <input type="hidden" name="classification" value="cash" />
          <input type="hidden" name="credit_limit" value="0" />
          <input type="hidden" name="payment_terms_days" value="0" />
          <div>
            <label htmlFor="quick_customer_name" className="block text-sm font-medium text-slate-700 mb-1">
              اسم العميل الجديد
            </label>
            <input id="quick_customer_name" name="name" className="input-field" placeholder="مثال: شركة النور" />
          </div>
          <div>
            <label htmlFor="quick_customer_phone" className="block text-sm font-medium text-slate-700 mb-1">
              الجوال
            </label>
            <input id="quick_customer_phone" name="phone" className="input-field" dir="ltr" />
          </div>
          <QuickCustomerButton />
        </form>
        {customerState?.error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {customerState.error}
          </div>
        )}
        {customerState?.success && !customerState.error && (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            تم حفظ العميل. إذا لم يظهر فورًا في القائمة أغلق النافذة وافتحها مرة أخرى.
          </div>
        )}
      </section>
    )}

    {customers.length === 0 ? (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        أضف العميل أولًا من النموذج السريع، وبعد ظهوره في القائمة تستطيع إنشاء الطلب.
      </div>
    ) : (
    <form ref={formRef} action={formAction} className={className}>
      <div>
        <label htmlFor="customer_id" className="block text-sm font-medium text-slate-700 mb-1">
          العميل
        </label>
        <select id="customer_id" name="customer_id" className="input-field" required>
          <option value="">اختر العميل</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label htmlFor="track" className="block text-sm font-medium text-slate-700 mb-1">
            المسار
          </label>
          <select id="track" name="track" className="input-field">
            <option value="production">إنتاج</option>
            <option value="sample">عينة</option>
            <option value="modification">تعديل</option>
          </select>
        </div>
        <div>
          <label htmlFor="due_date" className="block text-sm font-medium text-slate-700 mb-1">
            تاريخ التسليم
          </label>
          <input id="due_date" name="due_date" type="date" className="input-field" />
        </div>
        <div>
          <label htmlFor="quantity" className="block text-sm font-medium text-slate-700 mb-1">
            الكمية
          </label>
          <input id="quantity" name="quantity" type="number" min="1" className="input-field" required />
        </div>
      </div>

      <div>
        <label htmlFor="product_type" className="block text-sm font-medium text-slate-700 mb-1">
          نوع القطعة
        </label>
        <input id="product_type" name="product_type" className="input-field" placeholder="قميص / بنطال / جاكيت" required />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label htmlFor="inventory_variant_id" className="block text-sm font-medium text-slate-700 mb-1">
            القماش واللون من المخزون
          </label>
          <select id="inventory_variant_id" name="inventory_variant_id" className="input-field" required>
            {fabricVariants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.name} · {variant.color_name} · المتاح {variant.balance.toLocaleString("ar")} {variant.unit}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="fabric_consumption" className="block text-sm font-medium text-slate-700 mb-1">
            كمية القماش المحجوزة
          </label>
          <input id="fabric_consumption" name="fabric_consumption" type="number" min="0.01" step="0.01" className="input-field" required />
        </div>
        <div>
          <label htmlFor="embroidery_spec" className="block text-sm font-medium text-slate-700 mb-1">
            التطريز
          </label>
          <input id="embroidery_spec" name="embroidery_spec" className="input-field" />
        </div>
      </div>

      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">تفاصيل المقاسات</h3>
        <div className="grid gap-3 md:grid-cols-4">
          {[
            ["size_s", "S"],
            ["size_m", "M"],
            ["size_l", "L"],
            ["size_xl", "XL"],
          ].map(([name, label]) => (
            <div key={name}>
              <label htmlFor={name} className="block text-sm font-medium text-slate-700 mb-1">
                {label}
              </label>
              <input id={name} name={name} type="number" min="0" className="input-field" defaultValue={0} />
            </div>
          ))}
        </div>
        <div>
          <label htmlFor="size_custom" className="block text-sm font-medium text-slate-700 mb-1">
            مقاسات خاصة / تفصيل
          </label>
          <textarea id="size_custom" name="size_custom" className="input-field" rows={2} />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">توابع القطعة</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="accessory_buttons" className="block text-sm font-medium text-slate-700 mb-1">
              الأزرار
            </label>
            <input id="accessory_buttons" name="accessory_buttons" className="input-field" />
          </div>
          <div>
            <label htmlFor="accessory_zipper" className="block text-sm font-medium text-slate-700 mb-1">
              السحاب/السستة
            </label>
            <input id="accessory_zipper" name="accessory_zipper" className="input-field" />
          </div>
          <div>
            <label htmlFor="accessory_badge" className="block text-sm font-medium text-slate-700 mb-1">
              الشعار/البادج
            </label>
            <input id="accessory_badge" name="accessory_badge" className="input-field" />
          </div>
        </div>
        <div>
          <label htmlFor="accessory_notes" className="block text-sm font-medium text-slate-700 mb-1">
            ملاحظات التوابع
          </label>
          <textarea id="accessory_notes" name="accessory_notes" className="input-field" rows={2} />
        </div>
      </section>

      <div>
        <label htmlFor="measurements_notes" className="block text-sm font-medium text-slate-700 mb-1">
          ملاحظات القياسات
        </label>
        <textarea id="measurements_notes" name="measurements_notes" className="input-field" rows={2} />
      </div>

      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">صور التصميم والتطريز</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div>
              <label htmlFor="design_file" className="block text-sm font-medium text-slate-700 mb-1">
                صورة تصميم الزي
              </label>
              <input id="design_file" name="design_file" type="file" accept="image/*" className="input-field" onChange={(event) => handlePreviewChange(event, setDesignPreview)} />
              <p className="mt-1 text-xs text-slate-500">الحد الأقصى للصورة الواحدة 10MB.</p>
            </div>
            <ImagePreviewBox preview={designPreview} label="معاينة تصميم الزي" />
            <div>
              <label htmlFor="design_description" className="block text-sm font-medium text-slate-700 mb-1">
                تفاصيل التصميم
              </label>
              <textarea id="design_description" name="design_description" className="input-field" rows={3} placeholder="الألوان، أماكن الجيوب، القصّة، أو أي اعتماد خاص" />
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label htmlFor="embroidery_logo_file" className="block text-sm font-medium text-slate-700 mb-1">
                صورة شعار التطريز
              </label>
              <input id="embroidery_logo_file" name="embroidery_logo_file" type="file" accept="image/*" className="input-field" onChange={(event) => handlePreviewChange(event, setLogoPreview)} />
              <p className="mt-1 text-xs text-slate-500">الحد الأقصى للصورة الواحدة 10MB.</p>
            </div>
            <ImagePreviewBox preview={logoPreview} label="معاينة شعار التطريز" />
            <div>
              <label htmlFor="embroidery_logo_description" className="block text-sm font-medium text-slate-700 mb-1">
                تفاصيل الشعار والتطريز
              </label>
              <textarea id="embroidery_logo_description" name="embroidery_logo_description" className="input-field" rows={3} placeholder="الموضع، المقاس، ألوان الخيط، أو طريقة التنفيذ" />
            </div>
          </div>
        </div>
      </section>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1">
          ملاحظات الطلب
        </label>
        <textarea id="notes" name="notes" className="input-field" rows={3} />
      </div>

      <div>
        <label htmlFor="item_notes" className="block text-sm font-medium text-slate-700 mb-1">
          ملاحظات البند
        </label>
        <textarea id="item_notes" name="item_notes" className="input-field" rows={3} />
      </div>

      {state?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {state?.success && !state.error && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          تم إنشاء الطلب بنجاح.
        </div>
      )}

      {state?.warning && !state.error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {state.warning}
        </div>
      )}

      <SubmitButton />
    </form>
    )}
    </>
  );
}

function QuickCustomerButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50" disabled={pending}>
      {pending ? "جارٍ الحفظ..." : "حفظ العميل"}
    </button>
  );
}

function ImagePreviewBox({ preview, label }: { preview: ImagePreview | null; label: string }) {
  if (!preview) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
        ستظهر معاينة الصورة هنا بعد اختيارها.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs text-slate-500">
        <span>{label}</span>
        <span dir="ltr">{preview.size}</span>
      </div>
      <a href={preview.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        <img src={preview.url} alt={preview.name} className="h-64 w-full object-contain p-2" />
      </a>
      <div className="mt-2 truncate text-xs text-slate-500" dir="ltr">{preview.name}</div>
    </div>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
