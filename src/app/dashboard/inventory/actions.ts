"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/require-permission";
import { summarizeInventoryMovements } from "@/lib/inventory/balances";

export type InventoryItemFormState = { error?: string; success?: boolean };
export type InventoryMovementFormState = { error?: string; success?: boolean };

const InventoryItemSchema = z.object({
  name: z.string().min(2, "اسم الصنف مطلوب"),
  category: z.enum(["fabric", "thread", "accessory", "finished_good", "other"]),
  unit: z.string().min(1, "الوحدة مطلوبة"),
  color_name: z.string().optional(),
  color_code: z.string().optional(),
  min_quantity: z.coerce.number().min(0, "الحد الأدنى لا يمكن أن يكون سالبًا"),
});

const InventoryMovementSchema = z.object({
  inventory_variant_id: z.string().uuid("اختر صنفًا ولونًا صحيحًا"),
  movement_type: z.enum(["in", "out", "adjustment", "reservation", "reservation_release"]),
  quantity: z.coerce.number().positive("الكمية يجب أن تكون أكبر من صفر"),
  notes: z.string().optional(),
});

type InventoryItemRow = { id: string };
type InventoryVariantRow = { id: string; inventory_item_id: string };
type InventoryMovementRow = { movement_type: string; quantity: number };

export async function createInventoryItemAction(
  _prevState: InventoryItemFormState,
  formData: FormData,
): Promise<InventoryItemFormState> {
  await requirePermission("inventory.adjust");

  const parsed = InventoryItemSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category") ?? "other",
    unit: formData.get("unit") ?? "قطعة",
    color_name: formData.get("color_name") ?? "",
    color_code: formData.get("color_code") ?? "",
    min_quantity: formData.get("min_quantity") ?? "0",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const supabase = await createSupabaseServerClient();
  const name = parsed.data.name.trim();
  const unit = parsed.data.unit.trim();
  const colorName = normalizeColorName(parsed.data.color_name);
  const colorCode = normalizeColorCode(parsed.data.color_code);

  const { data: existingItems, error: lookupError } = await supabase
    .from("inventory_items")
    .select("id")
    .eq("name", name)
    .eq("category", parsed.data.category)
    .eq("unit", unit)
    .eq("is_active", true)
    .limit(1);

  if (lookupError) {
    return { error: "تعذر التحقق من الصنف في المخزون." };
  }

  const existingItem = (existingItems?.[0] ?? null) as InventoryItemRow | null;
  let inventoryItemId = existingItem?.id;

  if (!inventoryItemId) {
    const { data: createdItem, error: createError } = await supabase
      .from("inventory_items")
      .insert({
        name,
        category: parsed.data.category,
        unit,
        min_quantity: parsed.data.min_quantity,
      })
      .select("id")
      .single<InventoryItemRow>();

    if (createError || !createdItem) {
      return { error: "تعذر إنشاء صنف المخزون." };
    }

    inventoryItemId = createdItem.id;
  } else {
    await supabase
      .from("inventory_items")
      .update({ min_quantity: parsed.data.min_quantity, updated_at: new Date().toISOString() })
      .eq("id", inventoryItemId);
  }

  const { data: existingVariants, error: variantLookupError } = await supabase
    .from("inventory_item_variants")
    .select("id, inventory_item_id")
    .eq("inventory_item_id", inventoryItemId)
    .ilike("color_name", colorName)
    .limit(1);

  if (variantLookupError) {
    return { error: "تعذر التحقق من لون الصنف." };
  }

  const existingVariant = (existingVariants?.[0] ?? null) as InventoryVariantRow | null;

  if (existingVariant) {
    const { error } = await supabase
      .from("inventory_item_variants")
      .update({
        color_code: colorCode,
        min_quantity: parsed.data.min_quantity,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingVariant.id);

    if (error) {
      return { error: "تعذر تحديث لون الصنف." };
    }
  } else {
    const { error } = await supabase.from("inventory_item_variants").insert({
      inventory_item_id: inventoryItemId,
      color_name: colorName,
      color_code: colorCode,
      min_quantity: parsed.data.min_quantity,
    });

    if (error) {
      return { error: "تعذر إنشاء لون الصنف." };
    }
  }

  revalidatePath("/dashboard/inventory");
  return { success: true };
}

export async function createInventoryMovementAction(
  _prevState: InventoryMovementFormState,
  formData: FormData,
): Promise<InventoryMovementFormState> {
  const user = await requirePermission("inventory.adjust");

  const parsed = InventoryMovementSchema.safeParse({
    inventory_variant_id: formData.get("inventory_variant_id"),
    movement_type: formData.get("movement_type") ?? "in",
    quantity: formData.get("quantity"),
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const supabase = await createSupabaseServerClient();
  const { data: variant, error: variantError } = await supabase
    .from("inventory_item_variants")
    .select("id, inventory_item_id")
    .eq("id", parsed.data.inventory_variant_id)
    .maybeSingle<InventoryVariantRow>();

  if (variantError || !variant) {
    return { error: "تعذر العثور على الصنف واللون المختار." };
  }

  if (["out", "reservation", "reservation_release"].includes(parsed.data.movement_type)) {
    const { data: movements, error: movementLookupError } = await supabase
      .from("inventory_movements")
      .select("movement_type, quantity")
      .eq("inventory_variant_id", variant.id);

    if (movementLookupError) {
      return { error: "تعذر حساب رصيد اللون المختار." };
    }

    const balance = summarizeInventoryMovements((movements ?? []) as InventoryMovementRow[]);
    if (["out", "reservation"].includes(parsed.data.movement_type) && parsed.data.quantity > balance.availableBalance) {
      return { error: "الكمية أكبر من الرصيد المتاح للصنف واللون المختار." };
    }

    if (parsed.data.movement_type === "reservation_release" && parsed.data.quantity > balance.reservedQuantity) {
      return { error: "كمية فك الحجز أكبر من الكمية المحجوزة لهذا اللون." };
    }
  }

  const { error } = await supabase.from("inventory_movements").insert({
    inventory_item_id: variant.inventory_item_id,
    inventory_variant_id: variant.id,
    movement_type: parsed.data.movement_type,
    quantity: parsed.data.quantity,
    notes: parsed.data.notes?.trim() || null,
    recorded_by: user.id,
  });

  if (error) {
    return { error: "تعذر تسجيل حركة المخزون." };
  }

  revalidatePath("/dashboard/inventory");
  return { success: true };
}

function normalizeColorName(value: string | undefined) {
  const colorName = value?.trim();
  return colorName && colorName.length > 0 ? colorName : "عام";
}

function normalizeColorCode(value: string | undefined) {
  const colorCode = value?.trim();
  return colorCode && /^#[0-9a-fA-F]{6}$/.test(colorCode) ? colorCode : null;
}
