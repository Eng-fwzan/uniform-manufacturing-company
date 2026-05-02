"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/require-permission";
import { summarizeInventoryMovements } from "@/lib/inventory/balances";
import type { DepartmentCode } from "@/lib/types/database";

export type BatchFormState = { error?: string; success?: boolean };
export type TransferFormState = { error?: string; success?: boolean };

const BatchSchema = z.object({
  order_item_id: z.string().uuid("بند الطلب مطلوب"),
  quantity: z.coerce.number().int().positive("الكمية يجب أن تكون أكبر من صفر"),
  current_department: z
    .enum(["cutting", "sewing", "embroidery", "quality", "packing", "delivery"])
    .optional(),
});

const TransferSchema = z.object({
  batch_id: z.string().uuid("الدفعة مطلوبة"),
  from_department: z.string().optional(),
  to_department: z.enum(["cutting", "sewing", "embroidery", "quality", "packing", "delivery"]),
  quantity_sent: z.coerce.number().int().positive("الكمية يجب أن تكون أكبر من صفر"),
  notes: z.string().optional(),
});

type OrderItemForBatch = {
  id: string;
  order_id: string;
  product_type: string;
  quantity: number;
  inventory_item_id: string | null;
  inventory_variant_id: string | null;
  fabric_consumption: number;
};

type OrderForBatch = {
  status: string;
};

type BatchQuantityRow = {
  quantity: number;
};

type BatchForTransfer = {
  id: string;
  quantity: number;
  current_department: DepartmentCode | null;
  status: string;
};

type InventoryMovementRow = {
  movement_type: string;
  quantity: number;
};

export async function createBatchAction(
  _prevState: BatchFormState,
  formData: FormData,
): Promise<BatchFormState> {
  const user = await requirePermission("batches.create");

  const parsed = BatchSchema.safeParse({
    order_item_id: formData.get("order_item_id"),
    quantity: formData.get("quantity"),
    current_department: formData.get("current_department") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const supabase = await createSupabaseServerClient();
  const { data: item, error: itemError } = await supabase
    .from("order_items")
    .select("id, order_id, product_type, quantity, inventory_item_id, inventory_variant_id, fabric_consumption")
    .eq("id", parsed.data.order_item_id)
    .single<OrderItemForBatch>();

  if (itemError || !item) {
    return { error: "تعذر العثور على بند الطلب المختار." };
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("status")
    .eq("id", item.order_id)
    .maybeSingle<OrderForBatch>();

  if (orderError || !order) {
    return { error: "تعذر التحقق من حالة الطلب." };
  }

  if (["cancelled", "completed", "archived"].includes(order.status)) {
    return { error: "لا يمكن إنشاء دفعة لطلب ملغي أو مكتمل أو مؤرشف." };
  }

  const { data: existingBatches, error: existingBatchesError } = await supabase
    .from("batches")
    .select("quantity")
    .eq("order_item_id", item.id);

  if (existingBatchesError) {
    return { error: "تعذر حساب الكمية المتبقية لهذا البند." };
  }

  const batchedQuantity = ((existingBatches ?? []) as BatchQuantityRow[]).reduce(
    (sum, batchRow) => sum + Number(batchRow.quantity),
    0,
  );
  const remainingQuantity = Math.max(Number(item.quantity) - batchedQuantity, 0);

  if (remainingQuantity <= 0) {
    return { error: "تم تحويل كامل كمية هذا البند إلى دفعات بالفعل." };
  }

  if (parsed.data.quantity > remainingQuantity) {
    return { error: `كمية الدفعة أكبر من المتبقي للبند. المتبقي: ${remainingQuantity}` };
  }

  const { data: batch, error } = await supabase
    .from("batches")
    .insert({
      batch_code: "",
      order_id: item.order_id,
      order_item_id: item.id,
      quantity: parsed.data.quantity,
      current_department: (parsed.data.current_department as DepartmentCode | undefined) ?? null,
      status: "open",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !batch) {
    return { error: "تعذر إنشاء الدفعة. تحقق من الصلاحيات أو البيانات." };
  }

  const reservationError = await convertReservationToStockOut({
    batchQuantity: parsed.data.quantity,
    item,
    remainingItemQuantityBeforeBatch: remainingQuantity,
    supabase,
    userId: user.id,
  });

  if (reservationError) {
    await supabase.from("batches").delete().eq("id", batch.id);
    return { error: reservationError };
  }

  await supabase
    .from("orders")
    .update({ status: "in_progress", updated_at: new Date().toISOString() })
    .eq("id", item.order_id)
    .neq("status", "cancelled");

  revalidatePath("/dashboard/batches");
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/inventory");
  return { success: true };
}

export async function createTransferAction(
  _prevState: TransferFormState,
  formData: FormData,
): Promise<TransferFormState> {
  const user = await requirePermission("batches.transfer");

  const parsed = TransferSchema.safeParse({
    batch_id: formData.get("batch_id"),
    from_department: formData.get("from_department") || undefined,
    to_department: formData.get("to_department"),
    quantity_sent: formData.get("quantity_sent"),
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const fromDepartment = parsed.data.from_department?.length
    ? (parsed.data.from_department as DepartmentCode)
    : null;

  const supabase = await createSupabaseServerClient();
  const { data: batch, error: batchError } = await supabase
    .from("batches")
    .select("id, quantity, current_department, status")
    .eq("id", parsed.data.batch_id)
    .maybeSingle<BatchForTransfer>();

  if (batchError || !batch) {
    return { error: "تعذر العثور على الدفعة." };
  }

  if (["closed", "in_transit"].includes(batch.status)) {
    return { error: "لا يمكن تحويل دفعة مغلقة أو قيد النقل." };
  }

  if (parsed.data.quantity_sent > Number(batch.quantity)) {
    return { error: "الكمية المرسلة أكبر من كمية الدفعة." };
  }

  if (batch.current_department && fromDepartment && batch.current_department !== fromDepartment) {
    return { error: "قسم الإرسال لا يطابق القسم الحالي للدفعة." };
  }

  if (batch.current_department === parsed.data.to_department) {
    return { error: "لا يمكن إرسال الدفعة إلى نفس قسمها الحالي." };
  }

  const actualFromDepartment = batch.current_department ?? fromDepartment;

  const { error } = await supabase.from("batch_transfers").insert({
    batch_id: parsed.data.batch_id,
    from_department: actualFromDepartment,
    to_department: parsed.data.to_department,
    quantity_sent: parsed.data.quantity_sent,
    status: "sent",
    sent_by: user.id,
    notes: parsed.data.notes ?? null,
  });

  if (error) {
    return { error: "تعذر إنشاء تحويل الدفعة. تحقق من الصلاحيات أو البيانات." };
  }

  const { error: updateError } = await supabase
    .from("batches")
    .update({
      current_department: parsed.data.to_department,
      status: "in_transit",
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.batch_id);

  if (updateError) {
    return { error: "تم إنشاء التحويل لكن تعذر تحديث القسم الحالي." };
  }

  revalidatePath("/dashboard/batches");
  if (actualFromDepartment) revalidatePath(`/tablet/${actualFromDepartment}`);
  revalidatePath(`/tablet/${parsed.data.to_department}`);
  return { success: true };
}

async function convertReservationToStockOut({
  batchQuantity,
  item,
  remainingItemQuantityBeforeBatch,
  supabase,
  userId,
}: {
  batchQuantity: number;
  item: OrderItemForBatch;
  remainingItemQuantityBeforeBatch: number;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
}) {
  if (!item.inventory_item_id || !item.inventory_variant_id || Number(item.fabric_consumption) <= 0) {
    return null;
  }

  const { data: movements, error: movementError } = await supabase
    .from("inventory_movements")
    .select("movement_type, quantity")
    .eq("reference_type", "order_item")
    .eq("reference_id", item.id)
    .eq("inventory_variant_id", item.inventory_variant_id);

  if (movementError) {
    return "تم إنشاء الدفعة لكن تعذر قراءة حجز القماش.";
  }

  const balance = summarizeInventoryMovements((movements ?? []) as InventoryMovementRow[]);
  if (balance.reservedQuantity <= 0) {
    return null;
  }

  const quantity = calculateFabricReleaseQuantity({
    batchQuantity,
    item,
    remainingItemQuantityBeforeBatch,
    reservedQuantity: balance.reservedQuantity,
  });

  if (quantity <= 0) {
    return null;
  }

  const { error: insertError } = await supabase.from("inventory_movements").insert([
    {
      inventory_item_id: item.inventory_item_id,
      inventory_variant_id: item.inventory_variant_id,
      movement_type: "reservation_release",
      quantity,
      reference_type: "order_item",
      reference_id: item.id,
      notes: `فك حجز وتحويله إلى صرف للدفعة: ${item.product_type}`,
      recorded_by: userId,
    },
    {
      inventory_item_id: item.inventory_item_id,
      inventory_variant_id: item.inventory_variant_id,
      movement_type: "out",
      quantity,
      reference_type: "order_item",
      reference_id: item.id,
      notes: `صرف قماش فعلي عند إنشاء دفعة: ${item.product_type}`,
      recorded_by: userId,
    },
  ]);

  return insertError ? "تعذر تحويل حجز القماش إلى صرف فعلي." : null;
}

function calculateFabricReleaseQuantity({
  batchQuantity,
  item,
  remainingItemQuantityBeforeBatch,
  reservedQuantity,
}: {
  batchQuantity: number;
  item: OrderItemForBatch;
  remainingItemQuantityBeforeBatch: number;
  reservedQuantity: number;
}) {
  if (batchQuantity >= remainingItemQuantityBeforeBatch) {
    return roundQuantity(reservedQuantity);
  }

  const itemQuantity = Number(item.quantity);
  if (itemQuantity <= 0) {
    return roundQuantity(reservedQuantity);
  }

  const proportionalQuantity = roundQuantity(
    (Number(item.fabric_consumption) * batchQuantity) / itemQuantity,
  );

  return Math.min(proportionalQuantity, roundQuantity(reservedQuantity));
}

function roundQuantity(value: number) {
  return Math.round(Number(value) * 100) / 100;
}
