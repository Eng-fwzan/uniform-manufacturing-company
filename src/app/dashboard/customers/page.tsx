import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import CustomerForm from "./customer-form";

export default async function CustomersPage() {
  const user = await requirePermission("customers.view");
  const supabase = await createSupabaseServerClient();

  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, phone, classification, credit_limit, payment_terms_days, is_active")
    .order("created_at", { ascending: false });

  const canManage = hasPermission(user.role, "customers.manage");

  return (
    <div className="mx-auto max-w-6xl p-8 space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">العملاء</h1>
        <p className="mt-2 text-slate-600">
          إدارة ملف العميل والتصنيف الائتماني وربطه بالطلبات والفواتير لاحقًا.
        </p>
      </header>

      {canManage && <CustomerForm />}

      <section className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">قائمة العملاء</h2>
        {!customers || customers.length === 0 ? (
          <div className="text-sm text-slate-600">لا يوجد عملاء بعد.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-slate-500">
                <tr className="text-right">
                  <th className="py-2 px-3">الاسم</th>
                  <th className="py-2 px-3">التصنيف</th>
                  <th className="py-2 px-3">الهاتف</th>
                  <th className="py-2 px-3">حد ائتماني</th>
                  <th className="py-2 px-3">مدة السداد</th>
                  <th className="py-2 px-3">نشط</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td className="py-2 px-3 font-medium text-slate-900">{customer.name}</td>
                    <td className="py-2 px-3">
                      {customer.classification === "cash" && "نقدي"}
                      {customer.classification === "credit_approved" && "آجل معتمد"}
                      {customer.classification === "overdue" && "متعثر"}
                    </td>
                    <td className="py-2 px-3" dir="ltr">
                      {customer.phone ?? "—"}
                    </td>
                    <td className="py-2 px-3">{customer.credit_limit ?? 0}</td>
                    <td className="py-2 px-3">{customer.payment_terms_days ?? 0} يوم</td>
                    <td className="py-2 px-3">{customer.is_active ? "نعم" : "لا"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}