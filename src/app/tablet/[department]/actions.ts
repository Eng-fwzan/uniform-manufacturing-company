"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { nextDepartment } from "@/lib/production/departments";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { singleRelation } from "@/lib/supabase/relations";
import { getTabletSession } from "@/lib/tablet/session";
import { type DepartmentCode } from "@/lib/types/database";

export type TabletActionState = { error?: string; success?: string };

const DepartmentSchema = z.enum([
  "cutting",
  "sewing",
  "embroidery",
  "quality",
  "packing",
  "delivery",
]);

const ReceiveTransferSchema = z.object({
  department: DepartmentSchema,
  transfer_id: z.string().uuid("التحويل غير صالح"),
  quantity_received: z.coerce.number().int().positive("الكمية المستلمة يجب أن تكون أكبر من صفر"),
});

const SendBatchSchema = z.object({
  department: DepartmentSchema,
  batch_id: z.string().uuid("الدفعة غير صالحة"),
  quantity_sent: z.coerce.number().int().positive("الكمية المرسلة يجب أن تكون أكبر من صفر"),
  notes: z.string().optional(),
});

const MovementSchema = z.object({
  department: DepartmentSchema,
  batch_id: z.string().uuid("الدفعة غير صالحة"),
  movement_type: z.enum([
    "extra_cut",
    "shortage",
    "damaged",
    "waste",
    "free_giveaway",
    "rework",
  ]),
  quantity: z.coerce.number().int().positive("الكمية يجب أن تكون أكبر من صفر"),
  reason: z.string().min(3, "سبب الحركة مطلوب"),
});

const TabletQualitySchema = z.object({
  department: z.literal("quality"),
  batch_id: z.string().uuid("الدفعة غير صالحة"),
  result: z.enum(["passed", "failed", "rework"]),
  checked_quantity: z.coerce.number().int().positive("كمية الفحص يجب أن تكون أكبر من صفر"),
  failed_quantity: z.coerce.number().int().min(0, "كمية الرفض لا يمكن أن تكون سالبة"),
  notes: z.string().optional(),
});

const TabletDeliverySchema = z.object({
  department: z.literal("delivery"),
  batch_id: z.string().uuid("الدفعة غير صالحة"),
  delivered_quantity: z.coerce.number().int().positive("كمية التسليم يجب أن تكون أكبر من صفر"),
  recipient_name: z.string().min(2, "اسم المستلم مطلوب"),
  recipient_phone: z.string().optional(),
  notes: z.string().optional(),
});

type BatchRow = {
  id: string;
  order_id: string;
  quantity: number;
  current_department: DepartmentCode | null;
  status: string;
};

type TransferRow = {
  id: string;
  batch_id: string;
  to_department: DepartmentCode;
  quantity_sent: number;
  status: string;
  batch: BatchRow | BatchRow[] | null;
};

async function requireTabletDepartment(department: DepartmentCode) {
  const session = await getTabletSession();

  if (!session || session.department !== department) {
    redirect(`/tablet/pin?dept=${department}`);
  }

  return session;
}

export async function receiveTransferAction(
  _prevState: TabletActionState,
  formData: FormData,
): Promise<TabletActionState> {
  const parsed = ReceiveTransferSchema.safeParse({
    department: formData.get("department"),
    transfer_id: formData.get("transfer_id"),
    quantity_received: formData.get("quantity_received"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const department = parsed.data.department;
  const session = await requireTabletDepartment(department);
  const supabase = createSupabaseAdminClient();

  const { data: transfer, error } = await supabase
    .from("batch_transfers")
    .select("id, batch_id, to_department, quantity_sent, status, batch:batches(id, order_id, quantity, current_department, status)")
    .eq("id", parsed.data.transfer_id)
    .maybeSingle<TransferRow>();

  if (error || !transfer) {
    return { error: "تعذر العثور على التحويل." };
  }

  const batch = singleRelation(transfer.batch);
  if (!batch) {
    return { error: "الدفعة المرتبطة بالتحويل غير موجودة." };
  }

  if (transfer.to_department !== department || transfer.status !== "sent") {
    return { error: "هذا التحويل غير متاح للاستلام في هذا القسم." };
  }

  const receivedQuantity = parsed.data.quantity_received;
  const now = new Date().toISOString();

  const { error: transferError } = await supabase
    .from("batch_transfers")
    .update({
      quantity_received: receivedQuantity,
      received_by: session.userId,
      received_at: now,
      status: "received",
    })
    .eq("id", transfer.id);

  if (transferError) {
    return { error: "تعذر تحديث حالة التحويل." };
  }

  const { error: batchError } = await supabase
    .from("batches")
    .update({ current_department: department, status: "received", updated_at: now })
    .eq("id", batch.id);

  if (batchError) {
    return { error: "تم استلام التحويل لكن تعذر تحديث الدفعة." };
  }

  const difference = receivedQuantity - Number(transfer.quantity_sent);
  if (difference !== 0) {
    const { error: movementError } = await supabase.from("quantity_movements").insert({
      order_id: batch.order_id,
      batch_id: batch.id,
      department,
      movement_type: difference > 0 ? "extra_cut" : "shortage",
      quantity: Math.abs(difference),
      reason: `فرق استلام من التابلت: المرسل ${transfer.quantity_sent} والمستلم ${receivedQuantity}`,
      recorded_by: session.userId,
    });

    if (movementError) {
      return { error: "تم الاستلام لكن تعذر تسجيل فرق الكمية." };
    }
  }

  revalidatePath(`/tablet/${department}`);
  revalidatePath("/dashboard/batches");
  revalidatePath("/dashboard/movements");

  return { success: "تم استلام الدفعة." };
}

export async function sendBatchAction(
  _prevState: TabletActionState,
  formData: FormData,
): Promise<TabletActionState> {
  const parsed = SendBatchSchema.safeParse({
    department: formData.get("department"),
    batch_id: formData.get("batch_id"),
    quantity_sent: formData.get("quantity_sent"),
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const department = parsed.data.department;
  const session = await requireTabletDepartment(department);
  const supabase = createSupabaseAdminClient();

  const { data: batch, error } = await supabase
    .from("batches")
    .select("id, order_id, quantity, current_department, status")
    .eq("id", parsed.data.batch_id)
    .maybeSingle<BatchRow>();

  if (error || !batch) {
    return { error: "تعذر العثور على الدفعة." };
  }

  if (batch.current_department !== department) {
    return { error: "هذه الدفعة ليست في هذا القسم حاليًا." };
  }

  if (batch.status === "closed") {
    return { error: "هذه الدفعة مغلقة بالفعل." };
  }

  if (parsed.data.quantity_sent > Number(batch.quantity)) {
    return { error: "الكمية المرسلة أكبر من كمية الدفعة." };
  }

  const targetDepartment = nextDepartment(department);
  const now = new Date().toISOString();

  if (department === "quality") {
    const { data: latestQuality } = await supabase
      .from("quality_records")
      .select("result")
      .eq("batch_id", batch.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestQuality?.result !== "passed") {
      return { error: "سجل نتيجة جودة ناجحة قبل إرسال الدفعة إلى التغليف." };
    }
  }

  if (!targetDepartment) {
    return { error: "سجل التسليم النهائي من نموذج التسليم لإغلاق الدفعة." };
  }

  const { error: transferError } = await supabase.from("batch_transfers").insert({
    batch_id: batch.id,
    from_department: department,
    to_department: targetDepartment,
    quantity_sent: parsed.data.quantity_sent,
    status: "sent",
    sent_by: session.userId,
    notes: parsed.data.notes?.trim() || null,
  });

  if (transferError) {
    return { error: "تعذر إرسال الدفعة للقسم التالي." };
  }

  const { error: updateError } = await supabase
    .from("batches")
    .update({ current_department: targetDepartment, status: "in_transit", updated_at: now })
    .eq("id", batch.id);

  if (updateError) {
    return { error: "تم إنشاء التحويل لكن تعذر تحديث القسم الحالي." };
  }

  revalidatePath(`/tablet/${department}`);
  revalidatePath(`/tablet/${targetDepartment}`);
  revalidatePath("/dashboard/batches");

  return { success: "تم إرسال الدفعة للقسم التالي." };
}

export async function recordTabletMovementAction(
  _prevState: TabletActionState,
  formData: FormData,
): Promise<TabletActionState> {
  const parsed = MovementSchema.safeParse({
    department: formData.get("department"),
    batch_id: formData.get("batch_id"),
    movement_type: formData.get("movement_type"),
    quantity: formData.get("quantity"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const department = parsed.data.department;
  const session = await requireTabletDepartment(department);
  const supabase = createSupabaseAdminClient();

  const { data: batch, error } = await supabase
    .from("batches")
    .select("id, order_id, current_department, status")
    .eq("id", parsed.data.batch_id)
    .maybeSingle<BatchRow>();

  if (error || !batch) {
    return { error: "تعذر العثور على الدفعة." };
  }

  if (batch.current_department !== department || batch.status === "closed") {
    return { error: "لا يمكن تسجيل حركة على دفعة ليست في هذا القسم." };
  }

  const { error: insertError } = await supabase.from("quantity_movements").insert({
    order_id: batch.order_id,
    batch_id: batch.id,
    department,
    movement_type: parsed.data.movement_type,
    quantity: parsed.data.quantity,
    reason: parsed.data.reason.trim(),
    recorded_by: session.userId,
  });

  if (insertError) {
    return { error: "تعذر تسجيل حركة الكمية." };
  }

  revalidatePath(`/tablet/${department}`);
  revalidatePath("/dashboard/movements");

  return { success: "تم تسجيل حركة الكمية." };
}

export async function recordTabletQualityAction(
  _prevState: TabletActionState,
  formData: FormData,
): Promise<TabletActionState> {
  const parsed = TabletQualitySchema.safeParse({
    department: formData.get("department"),
    batch_id: formData.get("batch_id"),
    result: formData.get("result"),
    checked_quantity: formData.get("checked_quantity"),
    failed_quantity: formData.get("failed_quantity") ?? "0",
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  if (parsed.data.failed_quantity > parsed.data.checked_quantity) {
    return { error: "كمية الرفض لا يمكن أن تكون أكبر من كمية الفحص." };
  }

  if (parsed.data.result === "passed" && parsed.data.failed_quantity > 0) {
    return { error: "لا يمكن اعتماد الدفعة كناجحة مع وجود كمية مرفوضة." };
  }

  if (parsed.data.result !== "passed" && parsed.data.failed_quantity === 0) {
    return { error: "حدد كمية الرفض أو إعادة العمل." };
  }

  const session = await requireTabletDepartment("quality");
  const supabase = createSupabaseAdminClient();
  const { data: batch, error } = await supabase
    .from("batches")
    .select("id, order_id, quantity, current_department, status")
    .eq("id", parsed.data.batch_id)
    .maybeSingle<BatchRow>();

  if (error || !batch) {
    return { error: "تعذر العثور على الدفعة." };
  }

  if (batch.current_department !== "quality" || batch.status === "closed") {
    return { error: "هذه الدفعة ليست جاهزة لفحص الجودة." };
  }

  if (parsed.data.checked_quantity > Number(batch.quantity)) {
    return { error: "كمية الفحص أكبر من كمية الدفعة." };
  }

  const notes = parsed.data.notes?.trim() || null;
  const { error: recordError } = await supabase.from("quality_records").insert({
    batch_id: batch.id,
    order_id: batch.order_id,
    result: parsed.data.result,
    checked_quantity: parsed.data.checked_quantity,
    failed_quantity: parsed.data.failed_quantity,
    notes,
    checked_by: session.userId,
  });

  if (recordError) {
    return { error: "تعذر حفظ نتيجة الجودة." };
  }

  if (parsed.data.result !== "passed") {
    const { error: movementError } = await supabase.from("quantity_movements").insert({
      order_id: batch.order_id,
      batch_id: batch.id,
      department: "quality",
      movement_type: parsed.data.result === "failed" ? "damaged" : "rework",
      quantity: parsed.data.failed_quantity,
      reason: notes ?? (parsed.data.result === "failed" ? "رفض جودة" : "إعادة عمل من الجودة"),
      recorded_by: session.userId,
    });

    if (movementError) {
      return { error: "تم حفظ الجودة لكن تعذر تسجيل حركة الكمية." };
    }
  }

  revalidatePath("/tablet/quality");
  revalidatePath("/dashboard/quality");
  revalidatePath("/dashboard/movements");

  return { success: "تم تسجيل نتيجة الجودة." };
}

export async function recordTabletDeliveryAction(
  _prevState: TabletActionState,
  formData: FormData,
): Promise<TabletActionState> {
  const parsed = TabletDeliverySchema.safeParse({
    department: formData.get("department"),
    batch_id: formData.get("batch_id"),
    delivered_quantity: formData.get("delivered_quantity"),
    recipient_name: formData.get("recipient_name"),
    recipient_phone: formData.get("recipient_phone") ?? "",
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const session = await requireTabletDepartment("delivery");
  const supabase = createSupabaseAdminClient();
  const { data: batch, error } = await supabase
    .from("batches")
    .select("id, order_id, quantity, current_department, status")
    .eq("id", parsed.data.batch_id)
    .maybeSingle<BatchRow>();

  if (error || !batch) {
    return { error: "تعذر العثور على الدفعة." };
  }

  if (batch.current_department !== "delivery" || batch.status === "closed") {
    return { error: "هذه الدفعة ليست جاهزة للتسليم." };
  }

  if (parsed.data.delivered_quantity > Number(batch.quantity)) {
    return { error: "كمية التسليم أكبر من كمية الدفعة." };
  }

  const { data: existingDelivery } = await supabase
    .from("delivery_records")
    .select("id")
    .eq("batch_id", batch.id)
    .maybeSingle();

  if (existingDelivery) {
    return { error: "هذه الدفعة لديها سجل تسليم سابق." };
  }

  const { error: deliveryError } = await supabase.from("delivery_records").insert({
    batch_id: batch.id,
    order_id: batch.order_id,
    delivered_quantity: parsed.data.delivered_quantity,
    recipient_name: parsed.data.recipient_name.trim(),
    recipient_phone: parsed.data.recipient_phone?.trim() || null,
    notes: parsed.data.notes?.trim() || null,
    delivered_by: session.userId,
  });

  if (deliveryError) {
    return { error: "تعذر حفظ سجل التسليم." };
  }

  const { error: closeError } = await supabase
    .from("batches")
    .update({ status: "closed", updated_at: new Date().toISOString() })
    .eq("id", batch.id);

  if (closeError) {
    return { error: "تم حفظ التسليم لكن تعذر إغلاق الدفعة." };
  }

  await completeOrderIfAllBatchesClosed(supabase, batch.order_id);
  revalidatePath("/tablet/delivery");
  revalidatePath("/dashboard/delivery");
  revalidatePath("/dashboard/batches");
  revalidatePath("/dashboard/orders");

  return { success: "تم تسجيل التسليم وإغلاق الدفعة." };
}

async function completeOrderIfAllBatchesClosed(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  orderId: string,
) {
  const { count, error } = await supabase
    .from("batches")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId)
    .neq("status", "closed");

  if (!error && count === 0) {
    await supabase
      .from("orders")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", orderId);
  }
}
