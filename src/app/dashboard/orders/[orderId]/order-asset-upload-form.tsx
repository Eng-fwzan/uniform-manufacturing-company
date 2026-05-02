"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { uploadOrderAssetAction, type OrderAssetFormState } from "../actions";

const initialState: OrderAssetFormState = {};

function UploadButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="btn-tablet btn-secondary w-full" disabled={pending}>
      {pending ? "جارٍ الرفع..." : "رفع الصورة"}
    </button>
  );
}

export default function OrderAssetUploadForm({
  orderId,
  canUpload,
}: {
  orderId: string;
  canUpload: boolean;
}) {
  const [state, formAction] = useActionState(uploadOrderAssetAction, initialState);

  if (!canUpload) {
    return <div className="text-sm text-slate-600">لا يمكن رفع ملفات تشغيلية لهذا الطلب في حالته الحالية.</div>;
  }

  return (
    <form action={formAction} className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4">
      <input type="hidden" name="order_id" value={orderId} />

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="asset_file_type" className="block text-sm font-medium text-slate-700 mb-1">
            نوع الصورة
          </label>
          <select id="asset_file_type" name="file_type" className="input-field" required>
            <option value="design">صورة تصميم الزي</option>
            <option value="embroidery_logo">صورة شعار التطريز</option>
          </select>
        </div>
        <div>
          <label htmlFor="asset_file_name" className="block text-sm font-medium text-slate-700 mb-1">
            اسم الصورة (اختياري)
          </label>
          <input id="asset_file_name" name="file_name" className="input-field" placeholder="مثال: اعتماد التصميم النهائي" />
        </div>
      </div>

      <div>
        <label htmlFor="asset_file" className="block text-sm font-medium text-slate-700 mb-1">
          الصورة
        </label>
        <input id="asset_file" name="file" type="file" accept="image/*" className="input-field" required />
      </div>

      <div>
        <label htmlFor="asset_description" className="block text-sm font-medium text-slate-700 mb-1">
          التفاصيل
        </label>
        <textarea id="asset_description" name="description" className="input-field" rows={3} placeholder="المقاسات، الموضع، لون الخيط، أو أي ملاحظة يحتاجها القسم" />
      </div>

      {state?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {state?.success && !state.error && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          تم رفع الصورة وربطها بالطلب.
        </div>
      )}

      <UploadButton />
    </form>
  );
}