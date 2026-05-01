"use client";

import { useState } from "react";
import type { DepartmentCode } from "@/lib/types/database";

const PIN_MIN = 4;
const PIN_MAX = 6;

export default function PinPad({ department }: { department: DepartmentCode }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const press = (digit: string) => {
    setError(null);
    if (pin.length < PIN_MAX) setPin(pin + digit);
  };
  const clear = () => { setPin(""); setError(null); };
  const back = () => { setPin(pin.slice(0, -1)); setError(null); };

  const submit = async () => {
    if (pin.length < PIN_MIN) {
      setError(`PIN يجب أن يكون ${PIN_MIN} أرقام على الأقل`);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tablet/pin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, department }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "فشل تسجيل الدخول");
        setPin("");
        return;
      }
      window.location.href = `/tablet/${department}`;
    } catch {
      setError("خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-center gap-3 py-2" dir="ltr">
        {Array.from({ length: PIN_MAX }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 ${
              i < pin.length ? "bg-brand-600 border-brand-600" : "border-slate-300"
            }`}
          />
        ))}
      </div>

      {error && <div className="text-center text-sm text-red-600">{error}</div>}

      <div className="grid grid-cols-3 gap-3" dir="ltr">
        {["1","2","3","4","5","6","7","8","9"].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => press(d)}
            disabled={loading}
            className="btn-tablet btn-secondary text-2xl"
          >
            {d}
          </button>
        ))}
        <button type="button" onClick={clear} disabled={loading} className="btn-tablet btn-secondary text-sm">مسح</button>
        <button type="button" onClick={() => press("0")} disabled={loading} className="btn-tablet btn-secondary text-2xl">0</button>
        <button type="button" onClick={back} disabled={loading} className="btn-tablet btn-secondary text-sm">←</button>
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={loading || pin.length < PIN_MIN}
        className="btn-tablet btn-primary w-full"
      >
        {loading ? "جارٍ التحقق..." : "دخول"}
      </button>
    </div>
  );
}
