"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { cancelOrderAction, type OrderStatusFormState } from "../actions";

function CancelButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="btn-tablet btn-secondary" disabled={pending}>
      {pending ? "جارٍ الإلغاء..." : "إلغاء الطلب وفك الحجز"}
    </button>
  );
}

export default function OrderStatusActions({ orderId }: { orderId: string }) {
  const [state, formAction] = useActionState<OrderStatusFormState, FormData>(cancelOrderAction, {});

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="order_id" value={orderId} />
      <CancelButton />
      {state?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}
      {state?.success && !state.error && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {state.success}
        </div>
      )}
    </form>
  );
}