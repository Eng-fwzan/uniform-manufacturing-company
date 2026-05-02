"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/auth/require-permission";
import { summarizeInventoryMovements } from "@/lib/inventory/balances";

export type OrderFormState = { error?: string; success?: boolean; warning?: string };
export type OrderItemFormState = { error?: string; success?: boolean };
export type OrderStatusFormState = { error?: string; success?: string };
export type OrderAssetFormState = { error?: string; success?: boolean };

const ORDER_ASSET_FILE_TYPES = ["design", "embroidery_logo"] as const;
const MAX_ORDER_ASSET_BYTES = 10 * 1024 * 1024;

type OrderAssetFileType = (typeof ORDER_ASSET_FILE_TYPES)[number];

const ORDER_ASSET_LABELS: Record<OrderAssetFileType, string> = {
  design: "صورة التصميم",
  embroidery_logo: "شعار التطريز",
};

const OrderSchema = z.object({
  customer_id: z.string().uuid("العميل مطلوب"),
  track: z.enum(["production", "sample", "modification"]),
  due_date: z.string().optional(),
  notes: z.string().optional(),
  design_description: z.string().optional(),
  embroidery_logo_description: z.string().optional(),
  product_type: z.string().min(2, "نوع المنتج مطلوب"),
  quantity: z.coerce.number().int().positive("الكمية يجب أن تكون أكبر من صفر"),
  inventory_variant_id: z.string().uuid("اختر القماش واللون من المخزون"),
  fabric_consumption: z.coerce.number().positive("كمية القماش المحجوزة يجب أن تكون أكبر من صفر"),
  embroidery_spec: z.string().optional(),
  item_notes: z.string().optional(),
  size_s: z.coerce.number().int().min(0).optional(),
  size_m: z.coerce.number().int().min(0).optional(),
  size_l: z.coerce.number().int().min(0).optional(),
  size_xl: z.coerce.number().int().min(0).optional(),
  size_custom: z.string().optional(),
  accessory_buttons: z.string().optional(),
  accessory_zipper: z.string().optional(),
  accessory_badge: z.string().optional(),
  accessory_notes: z.string().optional(),
  measurements_notes: z.string().optional(),
});

const CancelOrderSchema = z.object({
  order_id: z.string().uuid("الطلب غير صالح"),
});

const OrderAssetUploadSchema = z.object({
  order_id: z.string().uuid("الطلب غير صالح"),
  file_type: z.enum(ORDER_ASSET_FILE_TYPES),
  file_name: z.string().optional(),
  description: z.string().optional(),
});

const OrderItemSchema = OrderSchema.pick({
  product_type: true,
  quantity: true,
  inventory_variant_id: true,
  fabric_consumption: true,
  embroidery_spec: true,
  item_notes: true,
  size_s: true,
  size_m: true,
  size_l: true,
  size_xl: true,
  size_custom: true,
  accessory_buttons: true,
  accessory_zipper: true,
  accessory_badge: true,
  accessory_notes: true,
  measurements_notes: true,
}).extend({
  order_id: z.string().uuid("الطلب غير صالح"),
});

type InventoryMovementRow = { movement_type: string; quantity: number };

type InventoryVariantForOrder = {
  id: string;
  inventory_item_id: string;
  color_name: string;
  item: { id: string; name: string; category: string; unit: string } | Array<{ id: string; name: string; category: string; unit: string }> | null;
  inventory_movements: InventoryMovementRow[] | null;
};

type OrderForCancellation = {
  id: string;
  order_number: string;
  status: string;
};

type OrderForNewItem = {
  id: string;
  order_number: string;
  status: string;
};

type OrderItemForCancellation = {
  id: string;
  product_type: string;
  inventory_item_id: string | null;
  inventory_variant_id: string | null;
};

export async function createOrderAction(
  _prevState: OrderFormState,
  formData: FormData,
): Promise<OrderFormState> {
  const user = await requirePermission("orders.create");

  const parsed = OrderSchema.safeParse({
    customer_id: formData.get("customer_id"),
    track: formData.get("track") ?? "production",
    due_date: formData.get("due_date") ?? "",
    notes: formData.get("notes") ?? "",
    design_description: formData.get("design_description") ?? "",
    embroidery_logo_description: formData.get("embroidery_logo_description") ?? "",
    product_type: formData.get("product_type"),
    quantity: formData.get("quantity"),
    inventory_variant_id: formData.get("inventory_variant_id"),
    fabric_consumption: formData.get("fabric_consumption"),
    embroidery_spec: formData.get("embroidery_spec") ?? "",
    item_notes: formData.get("item_notes") ?? "",
    size_s: formData.get("size_s") ?? "0",
    size_m: formData.get("size_m") ?? "0",
    size_l: formData.get("size_l") ?? "0",
    size_xl: formData.get("size_xl") ?? "0",
    size_custom: formData.get("size_custom") ?? "",
    accessory_buttons: formData.get("accessory_buttons") ?? "",
    accessory_zipper: formData.get("accessory_zipper") ?? "",
    accessory_badge: formData.get("accessory_badge") ?? "",
    accessory_notes: formData.get("accessory_notes") ?? "",
    measurements_notes: formData.get("measurements_notes") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const initialAssetInputs = getInitialOrderAssetInputs(formData, parsed.data);
  const invalidAsset = initialAssetInputs.find((asset) => asset.file && validateOrderAssetFile(asset.file));
  if (invalidAsset?.file) {
    return { error: validateOrderAssetFile(invalidAsset.file) ?? "ملف غير صالح" };
  }

  const supabase = await createSupabaseServerClient();
  const { data: variant, error: variantError } = await supabase
    .from("inventory_item_variants")
    .select("id, inventory_item_id, color_name, item:inventory_items(id, name, category, unit), inventory_movements(movement_type, quantity)")
    .eq("id", parsed.data.inventory_variant_id)
    .maybeSingle<InventoryVariantForOrder>();

  const inventoryItem = Array.isArray(variant?.item) ? variant?.item[0] : variant?.item;
  if (variantError || !variant || !inventoryItem || inventoryItem.category !== "fabric") {
    return { error: "اختر قماشًا صالحًا من المخزون." };
  }

  const fabricBalance = summarizeInventoryMovements(variant.inventory_movements ?? []);
  if (parsed.data.fabric_consumption > fabricBalance.availableBalance) {
    return { error: "كمية القماش المطلوبة أكبر من رصيد اللون المختار." };
  }

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      order_number: "",
      customer_id: parsed.data.customer_id,
      track: parsed.data.track,
      due_date: parsed.data.due_date ? parsed.data.due_date : null,
      notes: parsed.data.notes ? parsed.data.notes : null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !order) {
    return { error: "تعذر إنشاء الطلب. تحقق من الصلاحيات أو البيانات." };
  }

  const sizeBreakdown = {
    S: parsed.data.size_s ?? 0,
    M: parsed.data.size_m ?? 0,
    L: parsed.data.size_l ?? 0,
    XL: parsed.data.size_xl ?? 0,
    custom: parsed.data.size_custom?.trim() || null,
  };

  const accessories = {
    buttons: parsed.data.accessory_buttons?.trim() || null,
    zipper: parsed.data.accessory_zipper?.trim() || null,
    badge: parsed.data.accessory_badge?.trim() || null,
    notes: parsed.data.accessory_notes?.trim() || null,
  };

  const measurements = {
    notes: parsed.data.measurements_notes?.trim() || null,
  };

  const { data: orderItem, error: itemError } = await supabase
    .from("order_items")
    .insert({
      order_id: order.id,
      product_type: parsed.data.product_type,
      quantity: parsed.data.quantity,
      fabric: inventoryItem.name,
      color: variant.color_name,
      inventory_item_id: inventoryItem.id,
      inventory_variant_id: variant.id,
      fabric_consumption: parsed.data.fabric_consumption,
      embroidery_spec: parsed.data.embroidery_spec ? parsed.data.embroidery_spec : null,
      size_breakdown: sizeBreakdown,
      accessories,
      measurements,
      notes: parsed.data.item_notes ? parsed.data.item_notes : null,
    })
    .select("id")
    .single();

  if (itemError) {
    await supabase.from("orders").delete().eq("id", order.id);
    return { error: "تم إنشاء الطلب لكن تعذر إضافة البند. حاول مرة أخرى." };
  }

  const { error: movementError } = await supabase.from("inventory_movements").insert({
    inventory_item_id: inventoryItem.id,
    inventory_variant_id: variant.id,
    movement_type: "reservation",
    quantity: parsed.data.fabric_consumption,
    reference_type: "order_item",
    reference_id: orderItem.id,
    notes: `حجز قماش للطلب ${parsed.data.product_type}`,
    recorded_by: user.id,
  });

  if (movementError) {
    await supabase.from("orders").delete().eq("id", order.id);
    return { error: "تعذر حجز كمية القماش من المخزون." };
  }

  const assetUploadErrors = await uploadInitialOrderAssets({
    userId: user.id,
    orderId: order.id,
    assets: initialAssetInputs,
  });

  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${encodeURIComponent(order.id)}`);
  revalidatePath("/dashboard/archive");
  revalidatePath("/dashboard/inventory");
  return assetUploadErrors.length > 0
    ? { success: true, warning: `تم إنشاء الطلب، لكن تعذر رفع: ${assetUploadErrors.join("، ")}.` }
    : { success: true };
}

export async function uploadOrderAssetAction(
  _prevState: OrderAssetFormState,
  formData: FormData,
): Promise<OrderAssetFormState> {
  const user = await requirePermission("orders.update");
  const parsed = OrderAssetUploadSchema.safeParse({
    order_id: formData.get("order_id"),
    file_type: formData.get("file_type"),
    file_name: formData.get("file_name") ?? "",
    description: formData.get("description") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const file = getFormFile(formData, "file");
  if (!file) {
    return { error: "الصورة مطلوبة" };
  }

  const fileError = validateOrderAssetFile(file);
  if (fileError) {
    return { error: fileError };
  }

  const supabase = await createSupabaseServerClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, order_number, status")
    .eq("id", parsed.data.order_id)
    .maybeSingle<OrderForNewItem>();

  if (orderError || !order) {
    return { error: "تعذر العثور على الطلب." };
  }

  if (["archived", "cancelled"].includes(order.status)) {
    return { error: "لا يمكن رفع ملفات تشغيلية لطلب مؤرشف أو ملغي." };
  }

  const uploadError = await uploadOrderFile({
    userId: user.id,
    orderId: order.id,
    file,
    fileType: parsed.data.file_type,
    fileName: parsed.data.file_name,
    description: parsed.data.description,
  });

  if (uploadError) {
    return { error: uploadError };
  }

  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${encodeURIComponent(order.order_number)}`);
  revalidatePath("/dashboard/batches");
  revalidatePath("/dashboard/archive");
  revalidateTabletDepartments();
  return { success: true };
}

export async function addOrderItemAction(
  _prevState: OrderItemFormState,
  formData: FormData,
): Promise<OrderItemFormState> {
  const user = await requirePermission("orders.update");

  const parsed = OrderItemSchema.safeParse({
    order_id: formData.get("order_id"),
    product_type: formData.get("product_type"),
    quantity: formData.get("quantity"),
    inventory_variant_id: formData.get("inventory_variant_id"),
    fabric_consumption: formData.get("fabric_consumption"),
    embroidery_spec: formData.get("embroidery_spec") ?? "",
    item_notes: formData.get("item_notes") ?? "",
    size_s: formData.get("size_s") ?? "0",
    size_m: formData.get("size_m") ?? "0",
    size_l: formData.get("size_l") ?? "0",
    size_xl: formData.get("size_xl") ?? "0",
    size_custom: formData.get("size_custom") ?? "",
    accessory_buttons: formData.get("accessory_buttons") ?? "",
    accessory_zipper: formData.get("accessory_zipper") ?? "",
    accessory_badge: formData.get("accessory_badge") ?? "",
    accessory_notes: formData.get("accessory_notes") ?? "",
    measurements_notes: formData.get("measurements_notes") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const supabase = await createSupabaseServerClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, order_number, status")
    .eq("id", parsed.data.order_id)
    .maybeSingle<OrderForNewItem>();

  if (orderError || !order) {
    return { error: "تعذر العثور على الطلب." };
  }

  if (["completed", "archived", "cancelled"].includes(order.status)) {
    return { error: "لا يمكن إضافة بند إلى طلب مكتمل أو مؤرشف أو ملغي." };
  }

  const { data: variant, error: variantError } = await supabase
    .from("inventory_item_variants")
    .select("id, inventory_item_id, color_name, item:inventory_items(id, name, category, unit), inventory_movements(movement_type, quantity)")
    .eq("id", parsed.data.inventory_variant_id)
    .maybeSingle<InventoryVariantForOrder>();

  const inventoryItem = Array.isArray(variant?.item) ? variant?.item[0] : variant?.item;
  if (variantError || !variant || !inventoryItem || inventoryItem.category !== "fabric") {
    return { error: "اختر قماشًا صالحًا من المخزون." };
  }

  const fabricBalance = summarizeInventoryMovements(variant.inventory_movements ?? []);
  if (parsed.data.fabric_consumption > fabricBalance.availableBalance) {
    return { error: "كمية القماش المطلوبة أكبر من رصيد اللون المختار." };
  }

  const sizeBreakdown = {
    S: parsed.data.size_s ?? 0,
    M: parsed.data.size_m ?? 0,
    L: parsed.data.size_l ?? 0,
    XL: parsed.data.size_xl ?? 0,
    custom: parsed.data.size_custom?.trim() || null,
  };

  const accessories = {
    buttons: parsed.data.accessory_buttons?.trim() || null,
    zipper: parsed.data.accessory_zipper?.trim() || null,
    badge: parsed.data.accessory_badge?.trim() || null,
    notes: parsed.data.accessory_notes?.trim() || null,
  };

  const measurements = {
    notes: parsed.data.measurements_notes?.trim() || null,
  };

  const { data: orderItem, error: itemError } = await supabase
    .from("order_items")
    .insert({
      order_id: order.id,
      product_type: parsed.data.product_type,
      quantity: parsed.data.quantity,
      fabric: inventoryItem.name,
      color: variant.color_name,
      inventory_item_id: inventoryItem.id,
      inventory_variant_id: variant.id,
      fabric_consumption: parsed.data.fabric_consumption,
      embroidery_spec: parsed.data.embroidery_spec ? parsed.data.embroidery_spec : null,
      size_breakdown: sizeBreakdown,
      accessories,
      measurements,
      notes: parsed.data.item_notes ? parsed.data.item_notes : null,
    })
    .select("id")
    .single();

  if (itemError || !orderItem) {
    return { error: "تعذر إضافة بند الطلب. تحقق من الصلاحيات أو البيانات." };
  }

  const { error: movementError } = await supabase.from("inventory_movements").insert({
    inventory_item_id: inventoryItem.id,
    inventory_variant_id: variant.id,
    movement_type: "reservation",
    quantity: parsed.data.fabric_consumption,
    reference_type: "order_item",
    reference_id: orderItem.id,
    notes: `حجز قماش لبند إضافي: ${parsed.data.product_type}`,
    recorded_by: user.id,
  });

  if (movementError) {
    await supabase.from("order_items").delete().eq("id", orderItem.id);
    return { error: "تمت إضافة البند لكن تعذر حجز كمية القماش." };
  }

  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${encodeURIComponent(order.order_number)}`);
  revalidatePath("/dashboard/inventory");
  return { success: true };
}

export async function cancelOrderAction(
  _prevState: OrderStatusFormState,
  formData: FormData,
): Promise<OrderStatusFormState> {
  const user = await requirePermission("orders.update");
  const parsed = CancelOrderSchema.safeParse({
    order_id: formData.get("order_id"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const supabase = await createSupabaseServerClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, order_number, status")
    .eq("id", parsed.data.order_id)
    .maybeSingle<OrderForCancellation>();

  if (orderError || !order) {
    return { error: "تعذر العثور على الطلب." };
  }

  if (["completed", "archived", "cancelled"].includes(order.status)) {
    return { error: "لا يمكن إلغاء طلب مكتمل أو مؤرشف أو ملغي مسبقًا." };
  }

  const { count: batchCount, error: batchError } = await supabase
    .from("batches")
    .select("id", { count: "exact", head: true })
    .eq("order_id", order.id);

  if (batchError) {
    return { error: "تعذر التحقق من دفعات الطلب." };
  }

  if ((batchCount ?? 0) > 0) {
    return { error: "لا يمكن إلغاء طلب بدأ إنتاجه. أغلق الدفعات أو عالجه من الإدارة قبل الإلغاء." };
  }

  const { count: invoiceCount, error: invoiceError } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("order_id", order.id);

  if (invoiceError) {
    return { error: "تعذر التحقق من فواتير الطلب." };
  }

  if ((invoiceCount ?? 0) > 0) {
    return { error: "لا يمكن إلغاء طلب له فاتورة. عالج الفاتورة أولًا من شاشة الفواتير." };
  }

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("id, product_type, inventory_item_id, inventory_variant_id")
    .eq("order_id", order.id);

  if (itemsError) {
    return { error: "تعذر قراءة بنود الطلب." };
  }

  for (const item of (items ?? []) as OrderItemForCancellation[]) {
    if (!item.inventory_item_id || !item.inventory_variant_id) continue;

    const { data: movements, error: movementsError } = await supabase
      .from("inventory_movements")
      .select("movement_type, quantity")
      .eq("reference_type", "order_item")
      .eq("reference_id", item.id)
      .eq("inventory_variant_id", item.inventory_variant_id);

    if (movementsError) {
      return { error: "تعذر حساب حجز القماش لهذا الطلب." };
    }

    const balance = summarizeInventoryMovements((movements ?? []) as InventoryMovementRow[]);
    if (balance.reservedQuantity <= 0) continue;

    const { error: releaseError } = await supabase.from("inventory_movements").insert({
      inventory_item_id: item.inventory_item_id,
      inventory_variant_id: item.inventory_variant_id,
      movement_type: "reservation_release",
      quantity: balance.reservedQuantity,
      reference_type: "order_item",
      reference_id: item.id,
      notes: `فك حجز بسبب إلغاء الطلب ${order.order_number}`,
      recorded_by: user.id,
    });

    if (releaseError) {
      return { error: "تعذر فك حجز القماش للطلب." };
    }
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", order.id);

  if (updateError) {
    return { error: "تم فك الحجز لكن تعذر تحديث حالة الطلب." };
  }

  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${encodeURIComponent(order.order_number)}`);
  revalidatePath("/dashboard/inventory");
  return { success: "تم إلغاء الطلب وفك حجز القماش." };
}

type InitialOrderAssetInput = {
  fileType: OrderAssetFileType;
  file: File | null;
  fileName?: string;
  description?: string;
};

function getInitialOrderAssetInputs(
  formData: FormData,
  parsedOrder: Pick<z.infer<typeof OrderSchema>, "design_description" | "embroidery_logo_description">,
): InitialOrderAssetInput[] {
  return [
    {
      fileType: "design",
      file: getFormFile(formData, "design_file"),
      fileName: "تصميم الزي",
      description: parsedOrder.design_description,
    },
    {
      fileType: "embroidery_logo",
      file: getFormFile(formData, "embroidery_logo_file"),
      fileName: "شعار التطريز",
      description: parsedOrder.embroidery_logo_description,
    },
  ];
}

function getFormFile(formData: FormData, fieldName: string) {
  const value = formData.get(fieldName);
  if (!(value instanceof File) || value.size === 0) return null;
  return value;
}

function validateOrderAssetFile(file: File) {
  if (!file.type.startsWith("image/")) {
    return "يجب أن يكون ملف التصميم أو الشعار صورة.";
  }

  if (file.size > MAX_ORDER_ASSET_BYTES) {
    return "حجم الصورة يجب ألا يتجاوز 10MB.";
  }

  return null;
}

function sanitizeStorageFileName(fileName: string) {
  const trimmed = fileName.trim();
  const cleaned = trimmed
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

async function uploadInitialOrderAssets({
  userId,
  orderId,
  assets,
}: {
  userId: string;
  orderId: string;
  assets: InitialOrderAssetInput[];
}) {
  const uploadErrors: string[] = [];

  for (const asset of assets) {
    if (!asset.file) continue;

    const uploadError = await uploadOrderFile({
      userId,
      orderId,
      file: asset.file,
      fileType: asset.fileType,
      fileName: asset.fileName,
      description: asset.description,
    });

    if (uploadError) {
      uploadErrors.push(ORDER_ASSET_LABELS[asset.fileType]);
    }
  }

  return uploadErrors;
}

async function uploadOrderFile({
  userId,
  orderId,
  file,
  fileType,
  fileName,
  description,
}: {
  userId: string;
  orderId: string;
  file: File;
  fileType: OrderAssetFileType;
  fileName?: string;
  description?: string;
}) {
  const supabase = createSupabaseAdminClient();
  const safeName = sanitizeStorageFileName(fileName?.trim() || file.name || ORDER_ASSET_LABELS[fileType]);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = `orders/${orderId}/${fileType}/${timestamp}-${storageSafeSegment(fileType)}${fileExtension(file)}`;

  const { error: uploadError } = await supabase.storage
    .from("order-files")
    .upload(path, file, { contentType: file.type || "application/octet-stream" });

  if (uploadError) {
    return "تعذر رفع الصورة. تحقق من الاتصال أو صلاحيات التخزين.";
  }

  const { error: insertError } = await supabase.from("order_files").insert({
    order_id: orderId,
    file_path: path,
    file_type: fileType,
    file_name: safeName,
    description: description?.trim() || null,
    uploaded_by: userId,
  });

  if (insertError) {
    await supabase.storage.from("order-files").remove([path]);
    return "تم رفع الصورة لكن تعذر حفظ بياناتها.";
  }

  return null;
}

function revalidateTabletDepartments() {
  for (const department of ["cutting", "sewing", "embroidery", "quality", "packing", "delivery"]) {
    revalidatePath(`/tablet/${department}`);
  }
}
