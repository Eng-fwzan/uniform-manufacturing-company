/**
 * أنواع قاعدة البيانات (مولّدة يدويًا — تُحدَّث عند تغيير الـ schema)
 * تطابق ملف SQL في supabase/migrations/0001_initial.sql
 */

export type UUID = string;

export type UserRole =
  | "admin"
  | "production_manager"
  | "purchasing"
  | "warehouse"
  | "cutting"
  | "sewing"
  | "embroidery"
  | "quality"
  | "packing"
  | "delivery"
  | "accountant";

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: "إدارة",
  production_manager: "مدير إنتاج",
  purchasing: "مشتريات",
  warehouse: "مستودع",
  cutting: "قص",
  sewing: "خياطة",
  embroidery: "تطريز",
  quality: "جودة",
  packing: "تغليف وكي",
  delivery: "تسليم",
  accountant: "محاسب تشغيلي",
};

export type DepartmentCode =
  | "cutting"
  | "sewing"
  | "embroidery"
  | "quality"
  | "packing"
  | "delivery";

export const DEPARTMENT_LABELS: Record<DepartmentCode, string> = {
  cutting: "القص",
  sewing: "الخياطة",
  embroidery: "التطريز",
  quality: "الجودة",
  packing: "التغليف والكي",
  delivery: "التسليم",
};

export interface AppUser {
  id: UUID;
  full_name: string;
  email: string;
  role: UserRole;
  department: DepartmentCode | null;
  is_active: boolean;
  created_at: string;
}

export interface AuditLogEntry {
  id: number;
  user_id: UUID | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

export interface SystemSetting {
  key: string;
  value: unknown;
  description: string | null;
  updated_at: string;
}
