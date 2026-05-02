import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { INVENTORY_CATEGORY_LABELS, INVENTORY_MOVEMENT_LABELS, formatLabel } from "@/lib/display-labels";
import { summarizeInventoryMovements } from "@/lib/inventory/balances";
import { singleRelation } from "@/lib/supabase/relations";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { InventoryItemForm, InventoryMovementForm } from "./inventory-forms";

type InventoryMovementSummary = {
  movement_type: string;
  quantity: number;
};

type InventoryItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  min_quantity: number;
  variants?: Array<{
    id: string;
    color_name: string;
    color_code: string | null;
    min_quantity: number;
    is_active: boolean;
    inventory_movements?: InventoryMovementSummary[];
  }>;
};

type InventoryVariantRow = {
  id: string;
  name: string;
  category: string;
  color_name: string;
  color_code: string | null;
  unit: string;
  min_quantity: number;
  physical_balance: number;
  reserved_quantity: number;
  available_balance: number;
};

function ColorSwatch({ color }: { color: string | null }) {
  return (
    <span
      className="inline-block h-4 w-4 rounded border border-slate-300 align-middle"
      style={{ backgroundColor: color ?? "#f8fafc" }}
    />
  );
}

export default async function InventoryPage() {
  const user = await requirePermission("inventory.view");
  const supabase = await createSupabaseServerClient();

  const [{ data: items }, { data: recentMovements }] = await Promise.all([
    supabase
      .from("inventory_items")
      .select("id, name, category, unit, min_quantity, variants:inventory_item_variants(id, color_name, color_code, min_quantity, is_active, inventory_movements(movement_type, quantity))")
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("inventory_movements")
      .select("id, movement_type, quantity, notes, created_at, item:inventory_items(name, unit), variant:inventory_item_variants(color_name, color_code)")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const inventoryItems = (items ?? []) as InventoryItem[];
  const variantRows = inventoryItems.flatMap<InventoryVariantRow>((item) =>
    (item.variants ?? [])
      .filter((variant) => variant.is_active)
      .map((variant) => {
        const balance = summarizeInventoryMovements(variant.inventory_movements ?? []);

        return {
          id: variant.id,
          name: item.name,
          category: item.category,
          color_name: variant.color_name,
          color_code: variant.color_code,
          unit: item.unit,
          min_quantity: Number(variant.min_quantity ?? item.min_quantity),
          physical_balance: balance.physicalBalance,
          reserved_quantity: balance.reservedQuantity,
          available_balance: balance.availableBalance,
        };
      }),
  );
  const canAdjust = hasPermission(user.role, "inventory.adjust");

  return (
    <div className="mx-auto max-w-6xl p-8 space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">المخزون</h1>
        <p className="mt-2 text-slate-600">إدارة الأصناف والألوان والكميات وحركات الوارد والصرف.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <InventoryItemForm canAdjust={canAdjust} />
        <InventoryMovementForm
          canAdjust={canAdjust}
          items={variantRows.map((item) => ({
            id: item.id,
            name: item.name,
            color_name: item.color_name,
            color_code: item.color_code,
            unit: item.unit,
            physical_balance: item.physical_balance,
            reserved_quantity: item.reserved_quantity,
            available_balance: item.available_balance,
          }))}
        />
      </div>

      <section className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">أرصدة الأصناف والألوان</h2>
        {variantRows.length === 0 ? (
          <div className="text-sm text-slate-600">لا توجد أصناف مخزون بعد.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-slate-500">
                <tr className="text-right">
                  <th className="py-2 px-3">الصنف</th>
                  <th className="py-2 px-3">اللون</th>
                  <th className="py-2 px-3">التصنيف</th>
                  <th className="py-2 px-3">الرصيد الفعلي</th>
                  <th className="py-2 px-3">المحجوز</th>
                  <th className="py-2 px-3">المتاح</th>
                  <th className="py-2 px-3">حد التنبيه</th>
                  <th className="py-2 px-3">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {variantRows.map((item) => {
                  const isLow = item.available_balance <= Number(item.min_quantity);
                  return (
                    <tr key={item.id}>
                      <td className="py-2 px-3 font-medium text-slate-900">{item.name}</td>
                      <td className="py-2 px-3">
                        <span className="inline-flex items-center gap-2">
                          <ColorSwatch color={item.color_code} />
                          {item.color_name}
                        </span>
                      </td>
                      <td className="py-2 px-3">{formatLabel(INVENTORY_CATEGORY_LABELS, item.category)}</td>
                      <td className="py-2 px-3">{item.physical_balance} {item.unit}</td>
                      <td className="py-2 px-3">{item.reserved_quantity} {item.unit}</td>
                      <td className="py-2 px-3">{item.available_balance} {item.unit}</td>
                      <td className="py-2 px-3">{item.min_quantity} {item.unit}</td>
                      <td className="py-2 px-3">
                        <span className={isLow ? "text-amber-700" : "text-emerald-700"}>
                          {isLow ? "منخفض" : "جيد"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">آخر الحركات</h2>
        {!recentMovements || recentMovements.length === 0 ? (
          <div className="text-sm text-slate-600">لم تسجل حركات مخزون بعد.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-slate-500">
                <tr className="text-right">
                  <th className="py-2 px-3">الصنف</th>
                  <th className="py-2 px-3">اللون</th>
                  <th className="py-2 px-3">النوع</th>
                  <th className="py-2 px-3">الكمية</th>
                  <th className="py-2 px-3">الملاحظات</th>
                  <th className="py-2 px-3">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {recentMovements.map((movement) => {
                  const item = singleRelation(movement.item);
                  const variant = singleRelation(movement.variant);
                  return (
                    <tr key={movement.id}>
                      <td className="py-2 px-3 font-medium text-slate-900">{item?.name ?? "—"}</td>
                      <td className="py-2 px-3">
                        <span className="inline-flex items-center gap-2">
                          <ColorSwatch color={variant?.color_code ?? null} />
                          {variant?.color_name ?? "—"}
                        </span>
                      </td>
                      <td className="py-2 px-3">{formatLabel(INVENTORY_MOVEMENT_LABELS, movement.movement_type)}</td>
                      <td className="py-2 px-3">{movement.quantity} {item?.unit ?? ""}</td>
                      <td className="py-2 px-3">{movement.notes ?? "—"}</td>
                      <td className="py-2 px-3">{new Date(movement.created_at).toLocaleString("ar")}</td>
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
