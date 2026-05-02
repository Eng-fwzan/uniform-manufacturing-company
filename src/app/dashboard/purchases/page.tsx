import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { INVENTORY_CATEGORY_LABELS, PURCHASE_STATUS_LABELS, formatDepartmentLabel, formatLabel } from "@/lib/display-labels";
import { approvePurchaseRequestAction, receivePurchaseRequestAction } from "./actions";
import PurchaseForm from "./purchase-form";

export default async function PurchasesPage() {
  const user = await requirePermission("purchases.view");
  const supabase = await createSupabaseServerClient();

  const { data: requests } = await supabase
    .from("purchase_requests")
    .select("id, request_number, status, department, needed_by, created_at, requester:app_users!purchase_requests_requested_by_fkey(full_name), items:purchase_request_items(item_name, category, quantity, unit)")
    .order("created_at", { ascending: false });

  const canCreate = hasPermission(user.role, "purchases.create");
  const canApprove = hasPermission(user.role, "purchases.approve");

  return (
    <div className="mx-auto max-w-6xl p-8 space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">المشتريات</h1>
        <p className="mt-2 text-slate-600">طلبات شراء داخلية مرتبطة بالأقسام والمخزون.</p>
      </header>

      <PurchaseForm canCreate={canCreate} />

      <section className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">طلبات الشراء</h2>
        {!requests || requests.length === 0 ? (
          <div className="text-sm text-slate-600">لا توجد طلبات شراء بعد.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-slate-500">
                <tr className="text-right">
                  <th className="py-2 px-3">رقم الطلب</th>
                  <th className="py-2 px-3">الحالة</th>
                  <th className="py-2 px-3">القسم</th>
                  <th className="py-2 px-3">الصنف</th>
                  <th className="py-2 px-3">الكمية</th>
                  <th className="py-2 px-3">مطلوب قبل</th>
                  <th className="py-2 px-3">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {requests.map((request) => {
                  const item = request.items?.[0];
                  return (
                    <tr key={request.id}>
                      <td className="py-2 px-3 font-medium text-slate-900">{request.request_number}</td>
                      <td className="py-2 px-3">{formatLabel(PURCHASE_STATUS_LABELS, request.status)}</td>
                      <td className="py-2 px-3">{formatDepartmentLabel(request.department)}</td>
                      <td className="py-2 px-3">
                        {item ? `${item.item_name} · ${formatLabel(INVENTORY_CATEGORY_LABELS, item.category)}` : "—"}
                      </td>
                      <td className="py-2 px-3">
                        {item ? `${item.quantity} ${item.unit}` : "—"}
                      </td>
                      <td className="py-2 px-3">{request.needed_by ?? "—"}</td>
                      <td className="py-2 px-3">
                        {canApprove && request.status === "submitted" ? (
                          <form action={approvePurchaseRequestAction}>
                            <input type="hidden" name="request_id" value={request.id} />
                            <button type="submit" className="text-brand-600 hover:underline">
                              اعتماد
                            </button>
                          </form>
                        ) : canApprove && ["approved", "ordered"].includes(request.status) ? (
                          <form action={receivePurchaseRequestAction}>
                            <input type="hidden" name="request_id" value={request.id} />
                            <button type="submit" className="text-emerald-700 hover:underline">
                              استلام للمخزون
                            </button>
                          </form>
                        ) : (
                          <span className="text-slate-400">
                            {request.status === "received" ? "تم الاستلام" : "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
