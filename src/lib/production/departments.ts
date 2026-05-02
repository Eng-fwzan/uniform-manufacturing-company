import { type DepartmentCode } from "@/lib/types/database";

export const DEPARTMENT_FLOW: DepartmentCode[] = [
  "cutting",
  "sewing",
  "embroidery",
  "quality",
  "packing",
  "delivery",
];

export function nextDepartment(department: DepartmentCode): DepartmentCode | null {
  const currentIndex = DEPARTMENT_FLOW.indexOf(department);
  if (currentIndex < 0) return null;

  return DEPARTMENT_FLOW[currentIndex + 1] ?? null;
}

export function previousDepartment(department: DepartmentCode): DepartmentCode | null {
  const currentIndex = DEPARTMENT_FLOW.indexOf(department);
  if (currentIndex <= 0) return null;

  return DEPARTMENT_FLOW[currentIndex - 1] ?? null;
}
