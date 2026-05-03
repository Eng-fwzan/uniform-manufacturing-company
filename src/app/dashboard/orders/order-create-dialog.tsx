"use client";

import { useEffect, useState } from "react";
import OrderForm from "./order-form";

type CustomerOption = { id: string; name: string };

type FabricVariantOption = {
  id: string;
  name: string;
  color_name: string;
  unit: string;
  balance: number;
};

export default function OrderCreateDialog({
  canCreate,
  canManageCustomers,
  customers,
  fabricVariants,
}: {
  canCreate: boolean;
  canManageCustomers: boolean;
  customers: CustomerOption[];
  fabricVariants: FabricVariantOption[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [formVersion, setFormVersion] = useState(0);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (!canCreate) return null;

  function openDialog() {
    setFormVersion((version) => version + 1);
    setIsOpen(true);
  }

  return (
    <>
      <button type="button" onClick={openDialog} className="rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700">
        طلب جديد
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-3 sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false);
          }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="new-order-title" className="my-6 w-full max-w-5xl rounded-lg bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 rounded-t-lg border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
              <div>
                <div className="text-sm font-medium text-brand-600">نافذة طلب جديد</div>
                <h2 id="new-order-title" className="mt-1 text-xl font-bold text-slate-900">
                  إنشاء طلب بخانات فارغة
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  أضف العميل سريعًا عند الحاجة، ثم أدخل بيانات الطلب والصور من نفس النافذة.
                </p>
              </div>
              <button type="button" onClick={() => setIsOpen(false)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                إغلاق
              </button>
            </div>
            <div className="p-4 sm:p-6">
              <OrderForm
                key={formVersion}
                canCreate={canCreate}
                canManageCustomers={canManageCustomers}
                customers={customers}
                fabricVariants={fabricVariants}
                className="space-y-4"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
