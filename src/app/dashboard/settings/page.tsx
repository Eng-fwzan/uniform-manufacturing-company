import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/require-permission";
import SettingsForm from "./settings-form";

export default async function SettingsPage() {
  await requirePermission("settings.manage");
  const supabase = await createSupabaseServerClient();

  const { data: settings } = await supabase
    .from("system_settings")
    .select("key, value")
    .in("key", [
      "departments",
      "min_order_quantity_policy",
      "purchasing_schedule",
      "overdue_customer_policy",
      "tablet_session_timeout_min",
    ]);

  const map = new Map((settings ?? []).map((row) => [row.key, row.value]));
  const departments = (map.get("departments") as string[]) ?? [];
  const minPolicy = (map.get("min_order_quantity_policy") as { enabled?: boolean; min_quantity?: number }) ?? {};
  const purchasingSchedule = (map.get("purchasing_schedule") as { days_per_week?: number; default_days?: string[] }) ?? {};
  const overduePolicy = (map.get("overdue_customer_policy") as { block_new_orders?: boolean; require_approval?: boolean }) ?? {};
  const tabletTimeout = (map.get("tablet_session_timeout_min") as number) ?? 30;

  return (
    <div className="mx-auto max-w-6xl p-8 space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">الإعدادات</h1>
        <p className="mt-2 text-slate-600">إدارة السياسات التشغيلية الأساسية.</p>
      </header>

      <SettingsForm
        initial={{
          departments,
          minOrderEnabled: Boolean(minPolicy.enabled),
          minOrderQuantity: minPolicy.min_quantity ?? 14,
          purchasingDaysPerWeek: purchasingSchedule.days_per_week ?? 2,
          purchasingDefaultDays: purchasingSchedule.default_days ?? ["sunday", "wednesday"],
          overdueBlock: Boolean(overduePolicy.block_new_orders),
          overdueRequireApproval: Boolean(overduePolicy.require_approval),
          tabletSessionTimeoutMin: tabletTimeout,
        }}
      />
    </div>
  );
}