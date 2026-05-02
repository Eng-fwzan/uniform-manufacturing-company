"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { APP_NAME, COMPANY_LOGO_PATH, COMPANY_NAME } from "@/lib/brand";
import { loginAction } from "./actions";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await loginAction(formData);
      if (result?.error) setError(result.error);
    });
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md">
        <div className="card">
          <div className="text-center mb-6">
            <img
              src={COMPANY_LOGO_PATH}
              alt={COMPANY_NAME}
              className="mx-auto mb-4 h-20 w-20 rounded-full border border-slate-200 bg-white object-cover shadow-sm"
            />
            <h1 className="text-2xl font-bold text-slate-900">تسجيل الدخول</h1>
            <p className="text-sm text-slate-600 mt-1">{APP_NAME}</p>
          </div>

          <form action={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                البريد الإلكتروني
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="input-field"
                dir="ltr"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                كلمة المرور
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="input-field"
                dir="ltr"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="btn-tablet btn-primary w-full"
            >
              {isPending ? "جارٍ الدخول..." : "دخول"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-200 text-center">
            <Link href="/" className="text-sm text-brand-600 hover:underline">
              الرجوع إلى بوابة الدخول
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
