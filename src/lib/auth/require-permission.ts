import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission, type Permission } from "@/lib/auth/permissions";

export async function requirePermission(permission: Permission) {
  const user = await getCurrentUser();

  if (!user) redirect("/login");
  if (!hasPermission(user.role, permission)) notFound();

  return user;
}