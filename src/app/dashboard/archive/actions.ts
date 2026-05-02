"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/require-permission";
import { summarizeInventoryMovements } from "@/lib/inventory/balances";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ArchiveActionState = { error?: string; success?: string };

const OrderIdSchema = z.object({
  order_id: z.string().uuid("الطلب مطلوب"),
});

const FileSchema = OrderIdSchema.extend({
  file_type: z.string().min(2, "نوع الملف مطلوب"),
  file_name: z.string().optional(),
  description: z.string().optional(),
});

const DeleteFileSchema = z.object({
  file_id: z.string().uuid("الملف غير صالح"),
});

type OrderForDuplicate = {
  id: string;
  order_number: string;
  customer_id: string;
  track: string;
  due_date: string | null;
  notes: string | null;
  status: string;
};

type OrderItemForDuplicate = {
  id: string;
  product_type: string;
  quantity: number;
  fabric: string | null;
  color: string | null;
  embroidery_spec: string | null;
  size_breakdown: Record<string, unknown> | null;
  accessories: Record<string, unknown> | null;
  measurements: Record<string, unknown> | null;
  notes: string | null;
  inventory_item_id: string | null;
  inventory_variant_id: string | null;
  fabric_consumption: number;
};

type InventoryMovementRow = { movement_type: string; quantity: number };

export async function saveChecklistAction(
  _prevState: ArchiveActionState,
  formData: FormData,
): Promise<ArchiveActionState> {
  const user = await requirePermission("archive.complete");
  const parsed = OrderIdSchema.safeParse({ order_id: formData.get("order_id") });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const supabase = await createSupabaseServerClient();
  const { data: templates, error: templateError } = await supabase
    .from("archive_checklist_templates")
    .select("key");

  if (templateError || !templates) {
    return { error: "تعذر تحميل عناصر الأرشفة." };
  }

  const updates = templates.map((template) =>
    supabase
      .from("order_archive_checklist")
      .update({
        is_done: formData.get(`item_${template.key}`) === "on",
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("order_id", parsed.data.order_id)
      .eq("item_key", template.key),
  );

  const results = await Promise.all(updates);
  if (results.some((result) => result.error)) {
    return { error: "تعذر تحديث عناصر الأرشفة." };
  }

  revalidateArchivePaths(parsed.data.order_id);
  return { success: "تم حفظ قائمة الأرشفة." };
}

export async function uploadOrderFileAction(
  _prevState: ArchiveActionState,
  formData: FormData,
): Promise<ArchiveActionState> {
  const user = await requirePermission("archive.complete");
  const parsed = FileSchema.safeParse({
    order_id: formData.get("order_id"),
    file_type: formData.get("file_type"),
    file_name: formData.get("file_name"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return { error: "الملف مطلوب." };
  }

  const supabase = createSupabaseAdminClient();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = `orders/${parsed.data.order_id}/archive/${timestamp}-${storageSafeSegment(parsed.data.file_type)}${fileExtension(file)}`;
  const fileName = sanitizeStorageFileName(parsed.data.file_name?.trim() || file.name || "ملف طلب");

  const { error: uploadError } = await supabase.storage
    .from("order-files")
    .upload(path, file, { contentType: file.type || "application/octet-stream" });

  if (uploadError) {
    return { error: "تعذر رفع الملف. تحقق من الاتصال أو الصلاحيات." };
  }

  const { error: insertError } = await supabase.from("order_files").insert({
    order_id: parsed.data.order_id,
    file_path: path,
    file_type: parsed.data.file_type.trim(),
    file_name: fileName,
    description: parsed.data.description?.trim() || null,
    uploaded_by: user.id,
  });

  if (insertError) {
    await supabase.storage.from("order-files").remove([path]);
    return { error: "تم رفع الملف لكن تعذر حفظ بياناته." };
  }

  revalidateArchivePaths(parsed.data.order_id);
  return { success: "تم رفع الملف وربطه بالطلب." };
}

export async function deleteOrderFileAction(formData: FormData) {
  await requirePermission("archive.complete");
  const parsed = DeleteFileSchema.safeParse({ file_id: formData.get("file_id") });
  if (!parsed.success) return;

  const supabase = createSupabaseAdminClient();
  const { data: file } = await supabase
    .from("order_files")
    .select("id, order_id, file_path")
    .eq("id", parsed.data.file_id)
    .maybeSingle<{ id: string; order_id: string; file_path: string }>();

  if (!file) return;

  await supabase.from("order_files").delete().eq("id", file.id);

  const { count } = await supabase
    .from("order_files")
    .select("id", { count: "exact", head: true })
    .eq("file_path", file.file_path);

  if ((count ?? 0) === 0) {
    await supabase.storage.from("order-files").remove([file.file_path]);
  }

  revalidateArchivePaths(file.order_id);
}

export async function archiveOrderAction(
  _prevState: ArchiveActionState,
  formData: FormData,
): Promise<ArchiveActionState> {
  await requirePermission("archive.complete");
  const parsed = OrderIdSchema.safeParse({ order_id: formData.get("order_id") });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const supabase = await createSupabaseServerClient();
  const { data: checklist, error: checklistError } = await supabase
    .from("order_archive_checklist")
    .select("item_key, is_done")
    .eq("order_id", parsed.data.order_id);

  if (checklistError || !checklist || checklist.length === 0) {
    return { error: "تعذر قراءة قائمة الأرشفة لهذا الطلب." };
  }

  if (checklist.some((item) => !item.is_done)) {
    return { error: "أكمل جميع عناصر الأرشفة قبل إغلاق الطلب في الأرشيف." };
  }

  const { error } = await supabase
    .from("orders")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", parsed.data.order_id)
    .neq("status", "cancelled");

  if (error) {
    return { error: "تعذر أرشفة الطلب." };
  }

  revalidateArchivePaths(parsed.data.order_id);
  return { success: "تم نقل الطلب إلى الأرشيف." };
}

export async function duplicateArchivedOrderAction(
  _prevState: ArchiveActionState,
  formData: FormData,
): Promise<ArchiveActionState> {
  const user = await requirePermission("archive.reopen");
  const parsed = OrderIdSchema.safeParse({ order_id: formData.get("order_id") });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const supabase = await createSupabaseServerClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, order_number, customer_id, track, due_date, notes, status")
    .eq("id", parsed.data.order_id)
    .maybeSingle<OrderForDuplicate>();

  if (orderError || !order) {
    return { error: "تعذر العثور على الطلب المراد ترحيله." };
  }

  const { data: items, error: itemError } = await supabase
    .from("order_items")
    .select("id, product_type, quantity, fabric, color, embroidery_spec, size_breakdown, accessories, measurements, notes, inventory_item_id, inventory_variant_id, fabric_consumption")
    .eq("order_id", order.id)
    .order("created_at", { ascending: true });

  if (itemError || !items || items.length === 0) {
    return { error: "لا توجد بنود يمكن ترحيلها من هذا الطلب." };
  }

  for (const item of items as OrderItemForDuplicate[]) {
    const availabilityError = await ensureFabricAvailability(supabase, item);
    if (availabilityError) return { error: availabilityError };
  }

  const { data: newOrder, error: createOrderError } = await supabase
    .from("orders")
    .insert({
      order_number: "",
      customer_id: order.customer_id,
      track: order.track,
      due_date: order.due_date,
      notes: buildDuplicatedNotes(order),
      created_by: user.id,
    })
    .select("id, order_number")
    .single<{ id: string; order_number: string }>();

  if (createOrderError || !newOrder) {
    return { error: "تعذر إنشاء نسخة جديدة من الطلب." };
  }

  const { data: newItems, error: createItemsError } = await supabase
    .from("order_items")
    .insert((items as OrderItemForDuplicate[]).map((item) => ({
      order_id: newOrder.id,
      product_type: item.product_type,
      quantity: item.quantity,
      fabric: item.fabric,
      color: item.color,
      embroidery_spec: item.embroidery_spec,
      size_breakdown: item.size_breakdown,
      accessories: item.accessories ?? {},
      measurements: item.measurements ?? {},
      notes: item.notes,
      inventory_item_id: item.inventory_item_id,
      inventory_variant_id: item.inventory_variant_id,
      fabric_consumption: item.fabric_consumption,
    })))
    .select("id, product_type, inventory_item_id, inventory_variant_id, fabric_consumption");

  if (createItemsError || !newItems) {
    await supabase.from("orders").delete().eq("id", newOrder.id);
    return { error: "تم إنشاء الطلب لكن تعذر نسخ بنوده." };
  }

  const reservationRows = newItems
    .filter((item) => item.inventory_item_id && item.inventory_variant_id && Number(item.fabric_consumption) > 0)
    .map((item) => ({
      inventory_item_id: item.inventory_item_id,
      inventory_variant_id: item.inventory_variant_id,
      movement_type: "reservation",
      quantity: Number(item.fabric_consumption),
      reference_type: "order_item",
      reference_id: item.id,
      notes: `حجز قماش لنسخة من الأرشيف: ${item.product_type}`,
      recorded_by: user.id,
    }));

  if (reservationRows.length > 0) {
    const { error: reservationError } = await supabase.from("inventory_movements").insert(reservationRows);
    if (reservationError) {
      await supabase.from("orders").delete().eq("id", newOrder.id);
      return { error: "تعذر حجز القماش للنسخة الجديدة." };
    }
  }

  const fileCopyWarning = await copyOrderFilesToNewOrder({
    sourceOrderId: order.id,
    targetOrderId: newOrder.id,
    userId: user.id,
  });

  revalidateArchivePaths(order.id);
  revalidatePath(`/dashboard/orders/${encodeURIComponent(newOrder.order_number)}`);

  return {
    success: fileCopyWarning
      ? `تم ترحيل الطلب إلى قائمة الطلبات برقم ${newOrder.order_number}، لكن تعذر نسخ بعض الملفات.`
      : `تم ترحيل الطلب إلى قائمة الطلبات برقم ${newOrder.order_number}.`,
  };
}

async function ensureFabricAvailability(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  item: OrderItemForDuplicate,
) {
  if (!item.inventory_variant_id || Number(item.fabric_consumption) <= 0) return null;

  const { data: movements, error } = await supabase
    .from("inventory_movements")
    .select("movement_type, quantity")
    .eq("inventory_variant_id", item.inventory_variant_id);

  if (error) return "تعذر التحقق من رصيد القماش قبل ترحيل الطلب.";

  const balance = summarizeInventoryMovements((movements ?? []) as InventoryMovementRow[]);
  if (Number(item.fabric_consumption) > balance.availableBalance) {
    return `الرصيد المتاح لا يكفي لترحيل البند: ${item.product_type}.`;
  }

  return null;
}

async function copyOrderFilesToNewOrder({
  sourceOrderId,
  targetOrderId,
  userId,
}: {
  sourceOrderId: string;
  targetOrderId: string;
  userId: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: files, error } = await supabase
    .from("order_files")
    .select("file_path, file_type, file_name, description")
    .eq("order_id", sourceOrderId);

  if (error || !files || files.length === 0) return Boolean(error);

  const { error: insertError } = await supabase.from("order_files").insert(
    files.map((file) => ({
      order_id: targetOrderId,
      file_path: file.file_path,
      file_type: file.file_type,
      file_name: file.file_name,
      description: file.description,
      uploaded_by: userId,
    })),
  );

  return Boolean(insertError);
}

function buildDuplicatedNotes(order: OrderForDuplicate) {
  const original = order.notes?.trim();
  const prefix = `نسخة مرحّلة من الأرشيف للطلب ${order.order_number}`;
  return original ? `${prefix}\n${original}` : prefix;
}

function sanitizeStorageFileName(fileName: string) {
  const cleaned = fileName
    .trim()
    .replace(/[\\/:*?"<>|#%{}]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 160);

  return cleaned || "order-file";
}

function storageSafeSegment(value: string) {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return cleaned || "file";
}

function fileExtension(file: File) {
  const extension = file.name.match(/\.[a-zA-Z0-9]{1,12}$/)?.[0]?.toLowerCase();
  if (extension) return extension;
  if (file.type === "image/png") return ".png";
  if (file.type === "image/jpeg") return ".jpg";
  if (file.type === "image/webp") return ".webp";
  return "";
}

function revalidateArchivePaths(orderId: string) {
  revalidatePath("/dashboard/archive");
  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${encodeURIComponent(orderId)}`);
}