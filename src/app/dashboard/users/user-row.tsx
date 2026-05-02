"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateUserAction, type UserFormState } from "./actions";
import { DEPARTMENT_LABELS, USER_ROLE_LABELS } from "@/lib/types/database";

const ROLE_OPTIONS = Object.entries(USER_ROLE_LABELS);
const DEPARTMENT_OPTIONS = Object.entries(DEPARTMENT_LABELS);

type UserRowProps = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  department: string | null;
  is_active: boolean;
};

const initialState: UserFormState = {};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-tablet btn-secondary" disabled={pending}>
      {pending ? "جارٍ الحفظ..." : "حفظ"}
    </button>
  );
}

export default function UserRow({
  id,
  full_name,
  email,
  role,
  department,
  is_active,
}: UserRowProps) {
  const [state, formAction] = useActionState(updateUserAction, initialState);

  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-[1.5fr_1.3fr_1fr_1fr_auto] items-center">
      <input type="hidden" name="user_id" value={id} />
      <div>
        <div className="font-medium text-slate-900">{full_name}</div>
        <div className="text-xs text-slate-500" dir="ltr">{email}</div>
      </div>
      <select name="role" defaultValue={role} className="input-field">
        {ROLE_OPTIONS.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <select name="department" defaultValue={department ?? ""} className="input-field">
        <option value="">بدون قسم</option>
        {DEPARTMENT_OPTIONS.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="is_active" defaultChecked={is_active} />
        نشط
      </label>
      <div className="flex items-center gap-3">
        <SaveButton />
        {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
        {state?.success && !state.error && (
          <span className="text-xs text-emerald-600">تم</span>
        )}
      </div>
    </form>
  );
}
