import type { UserRole } from "@/lib/types/database";

/**
 * مصفوفة الصلاحيات المركزية.
 * مرجع: docs/requirements/modules-and-features-ar.md §3.1
 */
export type Permission =
  | "orders.create"
  | "orders.update"
  | "orders.close"
  | "orders.view"
  | "customers.view"
  | "customers.manage"
  | "batches.create"
  | "batches.transfer"
  | "batches.receive"
  | "batches.view"
  | "movements.create"
  | "movements.view"
  | "purchases.create"
  | "purchases.approve"
  | "purchases.view"
  | "inventory.adjust"
  | "inventory.view"
  | "quality.record"
  | "quality.view"
  | "delivery.view"
  | "delivery.create"
  | "finance.view"
  | "invoice.create"
  | "payments.record"
  | "reports.view"
  | "archive.complete"
  | "archive.reopen"
  | "users.manage"
  | "settings.manage"
  | "audit.view";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    "orders.create", "orders.update", "orders.close", "orders.view",
    "customers.view", "customers.manage",
    "batches.create", "batches.transfer", "batches.receive", "batches.view",
    "movements.create", "movements.view",
    "purchases.create", "purchases.approve", "purchases.view",
    "inventory.adjust", "inventory.view",
    "quality.record", "quality.view",
    "delivery.view", "delivery.create", "finance.view", "invoice.create", "payments.record",
    "reports.view", "archive.complete", "archive.reopen",
    "users.manage", "settings.manage", "audit.view",
  ],
  production_manager: [
    "orders.create", "orders.update", "orders.close", "orders.view",
    "customers.view", "customers.manage",
    "batches.create", "batches.transfer", "batches.receive", "batches.view",
    "movements.create", "movements.view",
    "purchases.create", "purchases.view",
    "inventory.view",
    "quality.record", "quality.view",
    "delivery.view", "delivery.create",
    "reports.view",
    "archive.complete", "audit.view",
  ],
  purchasing: [
    "orders.view",
    "customers.view",
    "purchases.create", "purchases.approve", "purchases.view",
    "inventory.adjust", "inventory.view",
  ],
  warehouse: [
    "orders.view",
    "batches.view",
    "inventory.adjust", "inventory.view",
    "movements.create", "movements.view",
  ],
  cutting: [
    "orders.view",
    "batches.transfer", "batches.receive", "batches.view",
    "movements.create",
  ],
  sewing: [
    "orders.view",
    "batches.transfer", "batches.receive", "batches.view",
    "movements.create",
  ],
  embroidery: [
    "orders.view",
    "batches.transfer", "batches.receive", "batches.view",
    "movements.create",
  ],
  quality: [
    "orders.view",
    "batches.transfer", "batches.receive", "batches.view",
    "quality.record", "quality.view",
    "movements.create",
  ],
  packing: [
    "orders.view",
    "batches.transfer", "batches.receive", "batches.view",
  ],
  delivery: [
    "orders.view",
    "batches.receive", "batches.view",
    "delivery.view", "delivery.create",
  ],
  accountant: [
    "orders.view",
    "customers.view", "customers.manage",
    "finance.view", "invoice.create", "payments.record",
    "purchases.view", "reports.view",
  ],
};

export function hasPermission(role: UserRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  if (role === "admin") return true;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function permissionsFor(role: UserRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}
