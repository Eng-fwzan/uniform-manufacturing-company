export function ModulePlaceholder({
  title,
  description,
  phase,
  items,
}: {
  title: string;
  description: string;
  phase: string;
  items: string[];
}) {
  return (
    <div className="mx-auto max-w-6xl p-8">
      <header className="mb-8">
        <div className="text-sm font-medium text-brand-600">{phase}</div>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">{title}</h1>
        <p className="mt-2 max-w-3xl text-slate-600">{description}</p>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">المخرجات القادمة</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {items.map((item) => (
            <div key={item} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {item}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}