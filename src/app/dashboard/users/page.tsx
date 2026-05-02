import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/require-permission";
import UserRow from "./user-row";

export default async function UsersPage() {
  await requirePermission("users.manage");
  const supabase = await createSupabaseServerClient();

  const { data: users } = await supabase
    .from("app_users")
    .select("id, full_name, email, role, department, is_active, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-6xl p-8 space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">المستخدمون</h1>
        <p className="mt-2 text-slate-600">
          لإضافة مستخدم جديد: أنشئه من Supabase Auth ثم سيظهر هنا لإدارة الدور والقسم.
        </p>
      </header>

      <section className="card space-y-4">
        {!users || users.length === 0 ? (
          <div className="text-sm text-slate-600">لا يوجد مستخدمون بعد.</div>
        ) : (
          <div className="space-y-4">
            {users.map((user) => (
              <UserRow
                key={user.id}
                id={user.id}
                full_name={user.full_name}
                email={user.email}
                role={user.role}
                department={user.department}
                is_active={user.is_active}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}