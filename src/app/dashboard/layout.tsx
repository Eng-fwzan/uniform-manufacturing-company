import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission, type Permission } from "@/lib/auth/permissions";
import { logoutAction } from "@/app/login/actions";
import { COMPANY_LOGO_PATH, COMPANY_NAME, COMPANY_SHORT_NAME } from "@/lib/brand";
import { USER_ROLE_LABELS, DEPARTMENT_LABELS } from "@/lib/types/database";

const mainNavItems: Array<{ href: string; label: string; icon: string; permission?: Permission }> = [
  { href: "/dashboard", label: "الرئيسية", icon: "🏠" },
  { href: "/dashboard/orders", label: "الطلبات", icon: "📋", permission: "orders.view" },
  { href: "/dashboard/batches", label: "الدفعات", icon: "📦", permission: "batches.view" },
  { href: "/dashboard/movements", label: "الحركات", icon: "↔️", permission: "movements.view" },
  { href: "/dashboard/departments", label: "الأقسام", icon: "🎯", permission: "batches.view" },
  { href: "/dashboard/quality", label: "الجودة", icon: "✅", permission: "quality.view" },
  { href: "/dashboard/delivery", label: "التسليم", icon: "🚚", permission: "delivery.view" },
  { href: "/dashboard/archive", label: "الأرشفة", icon: "🗂️", permission: "archive.complete" },
  { href: "/dashboard/customers", label: "العملاء", icon: "👥", permission: "customers.view" },
  { href: "/dashboard/purchases", label: "المشتريات", icon: "🛒", permission: "purchases.view" },
  { href: "/dashboard/inventory", label: "المخزون", icon: "🏭", permission: "inventory.view" },
  { href: "/dashboard/finance", label: "الفواتير والمدفوعات", icon: "💳", permission: "finance.view" },
  { href: "/dashboard/reports", label: "التقارير", icon: "📊", permission: "reports.view" },
];

const adminNavItems: Array<{ href: string; label: string; icon: string; permission: Permission }> = [
  { href: "/dashboard/users", label: "المستخدمون", icon: "🔐", permission: "users.manage" },
  { href: "/dashboard/settings", label: "الإعدادات", icon: "⚙️", permission: "settings.manage" },
  { href: "/dashboard/audit", label: "سجل التدقيق", icon: "📜", permission: "audit.view" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const visibleMainNavItems = mainNavItems.filter(
    (item) => !item.permission || hasPermission(user.role, item.permission),
  );
  const visibleAdminNavItems = adminNavItems.filter((item) =>
    hasPermission(user.role, item.permission),
  );

  return (
    <div className="min-h-screen flex overflow-x-hidden">
      <aside className="sticky top-0 h-screen w-12 shrink-0 bg-slate-900 text-slate-100 flex flex-col md:w-64">
        <div className="border-b border-slate-800 p-2 md:p-5">
          <Link href="/dashboard" className="flex items-center justify-center gap-3 md:justify-start">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white md:h-12 md:w-12">
              <img src={COMPANY_LOGO_PATH} alt={COMPANY_NAME} className="h-full w-full object-cover" />
            </span>
            <span className="hidden min-w-0 md:block">
              <span className="block truncate text-lg font-bold">{COMPANY_SHORT_NAME}</span>
              <span className="mt-1 block text-xs text-slate-400">لوحة التحكم</span>
            </span>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-1 md:p-4">
          {visibleMainNavItems.map((item) => (
            <NavItem key={item.href} href={item.href} label={item.label} icon={item.icon} />
          ))}
          {visibleAdminNavItems.length > 0 && (
            <>
              <div className="mt-4 border-t border-slate-800 px-3 pt-4 text-xs text-slate-500">
                <span className="hidden md:inline">
                الإدارة
                </span>
              </div>
              {visibleAdminNavItems.map((item) => (
                <NavItem key={item.href} href={item.href} label={item.label} icon={item.icon} />
              ))}
            </>
          )}
        </nav>

        <div className="border-t border-slate-800 p-1 md:p-4">
          <div className="hidden text-sm md:block">
            <div className="font-medium">{user.full_name}</div>
            <div className="text-xs text-slate-400">
              {USER_ROLE_LABELS[user.role]}
              {user.department && ` · ${DEPARTMENT_LABELS[user.department]}`}
            </div>
          </div>
          <form action={logoutAction} className="mt-2 md:mt-3">
            <button type="submit" className="w-full text-center text-[10px] text-slate-400 hover:text-white md:text-right md:text-xs">
              <span className="hidden md:inline">تسجيل الخروج</span>
              <span className="md:hidden">خروج</span>
            </button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-auto">{children}</main>
    </div>
  );
}

function NavItem({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-center gap-3 rounded-lg px-1 py-2 text-sm transition-colors hover:bg-slate-800 md:justify-start md:px-3"
      title={label}
    >
      <span>{icon}</span>
      <span className="hidden md:inline">{label}</span>
    </Link>
  );
}
