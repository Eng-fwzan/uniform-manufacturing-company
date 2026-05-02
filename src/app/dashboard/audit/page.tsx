import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/require-permission";
import { singleRelation } from "@/lib/supabase/relations";

export default async function AuditPage() {
  await requirePermission("audit.view");
  const supabase = await createSupabaseServerClient();

  const { data: logs } = await supabase
    .from("audit_log")
    .select("id, action, entity_type, entity_id, created_at, user:app_users(full_name, role)")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="mx-auto max-w-6xl p-8 space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">سجل التدقيق</h1>
        <p className="mt-2 text-slate-600">تتبع التغييرات على الجداول الحساسة.</p>
      </header>

      <section className="card">
        {!logs || logs.length === 0 ? (
          <div className="text-sm text-slate-600">لا توجد سجلات بعد.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-slate-500">
                <tr className="text-right">
                  <th className="py-2 px-3">الوقت</th>
                  <th className="py-2 px-3">العملية</th>
                  <th className="py-2 px-3">الكيان</th>
                  <th className="py-2 px-3">المعرف</th>
                  <th className="py-2 px-3">المستخدم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {logs.map((log) => {
                  const logUser = singleRelation(log.user);
                  return (
                    <tr key={log.id}>
                      <td className="py-2 px-3" dir="ltr">
                        {log.created_at?.slice(0, 19).replace("T", " ")}
                      </td>
                      <td className="py-2 px-3">{log.action}</td>
                      <td className="py-2 px-3">{log.entity_type}</td>
                      <td className="py-2 px-3">{log.entity_id ?? "—"}</td>
                      <td className="py-2 px-3">
                        {logUser?.full_name ?? "—"}
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