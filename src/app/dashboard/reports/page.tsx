import Link from "next/link";
import { requirePermission } from "@/lib/auth/require-permission";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { reportCards } from "./report-config";

export default async function ReportsIndexPage() {
  await requirePermission("reports.view");
  const supabase = await createSupabaseServerClient();

  const [
    { count: activeOrderCount },
    { count: openBatchCount },
    { count: pendingTransferCount },
    { count: fileCount },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .in("status", ["draft", "in_progress"]),
    supabase
      .from("batches")
      .select("id", { count: "exact", head: true })
      .neq("status", "closed"),
    supabase
      .from("batch_transfers")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent"),
    supabase.from("order_files").select("id", { count: "exact", head: true }),
  ]);

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8 space-y-6">
      <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-sm font-medium text-brand-600">التقارير</div>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">مركز التقارير</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          اختر نوع التقرير لفتح صفحة مستقلة تعرض بياناته فقط، مع زر رجوع لمركز التقارير.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="طلبات نشطة" value={`${activeOrderCount ?? 0}`} />
        <MetricCard label="دفعات مفتوحة" value={`${openBatchCount ?? 0}`} />
        <MetricCard label="تحويلات معلقة" value={`${pendingTransferCount ?? 0}`} />
        <MetricCard label="ملفات محفوظة" value={`${fileCount ?? 0}`} />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reportCards.map((report) => (
          <Link
            key={report.slug}
            href={`/dashboard/reports/${report.slug}`}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow-md"
          >
            <div className="text-xs font-medium text-brand-600">{report.shortTitle}</div>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">{report.title}</h2>
            <p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">{report.description}</p>
            <div className="mt-4 text-sm font-medium text-brand-600">فتح التقرير</div>
          </Link>
        ))}
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
    </div>
  );
}