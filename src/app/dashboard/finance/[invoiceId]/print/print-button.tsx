"use client";

export default function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-tablet btn-primary print:hidden">
      طباعة الفاتورة
    </button>
  );
}