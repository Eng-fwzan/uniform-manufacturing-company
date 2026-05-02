"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/require-permission";

export type PurchaseFormState = { error?: string; success?: boolean };

type PurchaseRequestForReceiving = {
  id: string;
  request_number: string;
  status: string;
  items: Array<{
    id: string;
    item_name: string;
    category: "fabric" | "thread" | "accessory" | "finished_good" | "other";
    quantity: number;
    unit: string;
  }> | null;
};

type InventoryStockTarget = {
  itemId: string;
  variantId: string;
};

const PurchaseSchema = z.object({
  department: z.enum(["cutting", "sewing", "embroidery", "quality", "packing", "delivery"]).optional(),
  needed_by: z.string().optional(),
  notes: z.string().optional(),
  item_name: z.string().min(2, "اسم الصنف مطلوب"),
  category: z.enum(["fabric", "thread", "accessory", "finished_good", "other"]),
  quantity: z.coerce.number().positive("الكمية يجب أن تكون أكبر من صفر"),
  unit: z.string().min(1, "الوحدة مطلوبة"),
  item_notes: z.string().optional(),
});

export async function createPurchaseRequestAction(
  _prevState: PurchaseFormState,
  formData: FormData,
): Promise<PurchaseFormState> {
  const user = await requirePermission("purchases.create");

  const parsed = PurchaseSchema.safeParse({
    department: formData.get("department") || undefined,
    needed_by: formData.get("needed_by") ?? "",
    notes: formData.get("notes") ?? "",
    item_name: formData.get("item_name"),
    category: formData.get("category") ?? "other",
    quantity: formData.get("quantity"),
    unit: formData.get("unit") ?? "قطعة",
    item_notes: formData.get("item_notes") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const supabase = await createSupabaseServerClient();
  const { data: request, error } = await supabase
    .from("purchase_requests")
    .insert({
      request_number: "",
      status: "submitted",
      department: parsed.data.department ?? null,
      requested_by: user.id,
      needed_by: parsed.data.needed_by ? parsed.data.needed_by : null,
      notes: parsed.data.notes ? parsed.data.notes : null,
    })
    .select("id")
    .single();

  if (error || !request) {
    return { error: "تعذر إنشاء طلب الشراء." };
  }

  const { error: itemError } = await supabase.from("purchase_request_items").insert({
    request_id: request.id,
    item_name: parsed.data.item_name.trim(),
    category: parsed.data.category,
    quantity: parsed.data.quantity,
    unit: parsed.data.unit.trim(),
    notes: parsed.data.item_notes?.trim() || null,
  });

  if (itemError) {
    return { error: "تم إنشاء الطلب لكن تعذر إضافة الصنف." };
  }

  revalidatePath("/dashboard/purchases");
  return { success: true };
}

export async function approvePurchaseRequestAction(formData: FormData) {
  const user = await requirePermission("purchases.approve");
  const requestId = String(formData.get("request_id") ?? "").trim();

  if (!requestId) return;

  const supabase = await createSupabaseServerClient();
  await supabase
    .from("purchase_requests")
    .update({
      status: "approved",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  revalidatePath("/dashboard/purchases");
}

export async function receivePurchaseRequestAction(formData: FormData) {
  const user = await requirePermission("purchases.approve");
  const requestId = String(formData.get("request_id") ?? "").trim();

  if (!requestId) return;

  const supabase = await createSupabaseServerClient();
  const { data: request, error: requestError } = await supabase
    .from("purchase_requests")
    .select("id, request_number, status, items:purchase_request_items(id, item_name, category, quantity, unit)")
    .eq("id", requestId)
    .maybeSingle<PurchaseRequestForReceiving>();

  if (requestError || !request || !request.items || request.items.length === 0) {
    return;
  }

  if (!["approved", "ordered"].includes(request.status)) {
    return;
  }

  for (const item of request.items) {
    const stockTarget = await findOrCreateInventoryItem({
      category: item.category,
      itemName: item.item_name,
      supabase,
      unit: item.unit,
    });

    if (!stockTarget) return;

    const { data: existingMovement, error: existingMovementError } = await supabase
      .from("inventory_movements")
      .select("id")
      .eq("reference_type", "purchase_request_item")
      .eq("reference_id", item.id)
      .limit(1);

    if (existingMovementError) return;
    if (existingMovement?.[0]) continue;

    const { error: movementError } = await supabase.from("inventory_movements").insert({
      inventory_item_id: stockTarget.itemId,
      inventory_variant_id: stockTarget.variantId,
      movement_type: "in",
      quantity: item.quantity,
      reference_type: "purchase_request_item",
      reference_id: item.id,
      notes: `استلام طلب شراء ${request.request_number}`,
      recorded_by: user.id,
    });

    if (movementError) return;
  }

  await supabase
    .from("purchase_requests")
    .update({
      status: "received",
      updated_at: new Date().toISOString(),
    })
    .eq("id", request.id)
    .in("status", ["approved", "ordered"]);

  revalidatePath("/dashboard/purchases");
  revalidatePath("/dashboard/inventory");
}

async function findOrCreateInventoryItem({
  category,
  itemName,
  supabase,
  unit,
}: {
  category: "fabric" | "thread" | "accessory" | "finished_good" | "other";
  itemName: string;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  unit: string;
}): Promise<InventoryStockTarget | null> {
  const normalizedName = itemName.trim();
  const normalizedUnit = unit.trim() || "قطعة";

  const { data: existingItems, error: existingError } = await supabase
    .from("inventory_items")
    .select("id")
    .eq("name", normalizedName)
    .eq("category", category)
    .eq("unit", normalizedUnit)
    .eq("is_active", true)
    .limit(1);

  if (existingError) return null;

  const existingItem = existingItems?.[0];
  let inventoryItemId = existingItem?.id as string | undefined;

  if (!inventoryItemId) {
    const { data: createdItem, error: createError } = await supabase
      .from("inventory_items")
      .insert({
        name: normalizedName,
        category,
        unit: normalizedUnit,
        min_quantity: 0,
      })
      .select("id")
      .single();

    if (createError || !createdItem) return null;
    inventoryItemId = createdItem.id as string;
  }

  const { data: existingVariants, error: variantLookupError } = await supabase
    .from("inventory_item_variants")
    .select("id")
    .eq("inventory_item_id", inventoryItemId)
    .ilike("color_name", "عام")
    .limit(1);

  if (variantLookupError) return null;

  const existingVariant = existingVariants?.[0];
  if (existingVariant?.id) {
    return { itemId: inventoryItemId, variantId: existingVariant.id as string };
  }

  const { data: createdVariant, error: createVariantError } = await supabase
    .from("inventory_item_variants")
    .insert({
      inventory_item_id: inventoryItemId,
      color_name: "عام",
      min_quantity: 0,
    })
    .select("id")
    .single();

  if (createVariantError || !createdVariant) return null;

  return { itemId: inventoryItemId, variantId: createdVariant.id as string };
}
