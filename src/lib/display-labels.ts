import { DEPARTMENT_LABELS, type DepartmentCode } from "@/lib/types/database";

export const ORDER_TRACK_LABELS: Record<string, string> = {
  production: "إنتاج",
  sample: "عينة",
  modification: "تعديل",
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  in_progress: "قيد التنفيذ",
  completed: "مكتمل",
  archived: "مؤرشف",
  cancelled: "ملغي",
};

export const BATCH_STATUS_LABELS: Record<string, string> = {
  open: "مفتوحة",
  in_transit: "قيد النقل",
  received: "مستلمة",
  closed: "مغلقة",
};

export const TRANSFER_STATUS_LABELS: Record<string, string> = {
  sent: "مرسلة",
  received: "مستلمة",
  rejected: "مرفوضة",
};

export const QUANTITY_MOVEMENT_LABELS: Record<string, string> = {
  extra_cut: "زيادة قص",
  shortage: "نقص",
  damaged: "تالف",
  waste: "هدر",
  free_giveaway: "تسليم مجاني",
  rework: "إعادة عمل",
};

export const QUALITY_RESULT_LABELS: Record<string, string> = {
  passed: "ناجح",
  failed: "مرفوض",
  rework: "إعادة عمل",
};

export const INVENTORY_CATEGORY_LABELS: Record<string, string> = {
  fabric: "قماش",
  thread: "خيوط",
  accessory: "إكسسوارات",
  finished_good: "منتج جاهز",
  other: "أخرى",
};

export const INVENTORY_MOVEMENT_LABELS: Record<string, string> = {
  in: "وارد",
  out: "صرف",
  adjustment: "تسوية",
  reservation: "حجز",
  reservation_release: "فك حجز",
};

export const PURCHASE_STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  submitted: "بانتظار الاعتماد",
  approved: "معتمد",
  ordered: "تم الطلب",
  received: "مستلم",
  cancelled: "ملغي",
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  issued: "مصدر",
  partially_paid: "مدفوع جزئيًا",
  paid: "مدفوع",
  cancelled: "ملغي",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "نقدًا",
  bank_transfer: "تحويل بنكي",
  card: "بطاقة",
  cheque: "شيك",
  other: "أخرى",
};

export function formatDepartmentLabel(department: string | null | undefined) {
  if (!department) return "—";
  return DEPARTMENT_LABELS[department as DepartmentCode] ?? department;
}

export function formatLabel(labels: Record<string, string>, value: string | null | undefined) {
  if (!value) return "—";
  return labels[value] ?? value;
}