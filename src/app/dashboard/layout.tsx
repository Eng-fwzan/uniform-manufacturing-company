import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { logoutAction } from "@/app/login/actions";
import { USER_ROLE_LABELS, DEPARTMENT_LABELS } from "@/lib/types/database";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <h2 className="font-bold text-lg">مصنع الزي الموحد</h2>
          <p className="text-xs text-slate-400 mt-1">لوحة التحكم</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <NavItem href="/dashboard" label="الرئيسية" icon="🏠" />
          <NavItem href="/dashboard/orders" label="الطلبات" icon="📋" />
          <NavItem href="/dashboard/batches" label="الدفعات" icon="📦" />
          <NavItem href="/dashboard/customers" label="العملاء" icon="👥" />
          <NavItem href="/dashboard/inventory" label="المخزون" icon="🏭" />
          <NavItem href="/dashboard/reports" label="التقارير" icon="📊" />
          {user.role === "admin" && (
            <>
              <div className="pt-4 mt-4 border-t border-slate-800 text-xs text-slate-500 px-3">
                الإدارة
              </div>
              <NavItem href="/dashboard/users" label="المستخدمون" icon="🔐" />
              <NavItem href="/dashboard/settings" label="الإعدادات" icon="⚙️" />
              <NavItem href="/dashboard/audit" label="سجل التدقيق" icon="📜" />
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="text-sm">
            <div className="font-medium">{user.full_name}</div>
            <div className="text-xs text-slate-400">
              {USER_ROLE_LABELS[user.role]}
              {user.department && ` · ${DEPARTMENT_LABELS[user.department]}`}
            </div>
          </div>
          <form action={logoutAction} className="mt-3">
            <button type="submit" className="text-xs text-slate-400 hover:text-white">
              تسجيل الخروج
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

function NavItem({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors text-sm"
    >
      <span>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
