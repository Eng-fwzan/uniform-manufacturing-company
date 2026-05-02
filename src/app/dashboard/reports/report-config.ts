export const reportCards = [
  {
    slug: "overview",
    shortTitle: "الملخص",
    title: "الملخص التشغيلي",
    description: "مؤشرات الطلبات والدفعات والتحويلات والمالية في شاشة واحدة.",
  },
  {
    slug: "orders",
    shortTitle: "الطلبات",
    title: "تقارير الطلبات",
    description: "حالات الطلبات، العملاء، البنود، المسارات، ومواعيد التسليم.",
  },
  {
    slug: "batches",
    shortTitle: "الدفعات",
    title: "تقارير الدفعات",
    description: "الدفعات المفتوحة والمغلقة ومواقعها الحالية داخل الأقسام.",
  },
  {
    slug: "transfers",
    shortTitle: "التحويلات",
    title: "تقارير التحويلات والحركات",
    description: "تحويلات الدفعات بين الأقسام وفروقات الكميات المسجلة.",
  },
  {
    slug: "inventory",
    shortTitle: "المخزون",
    title: "تقارير المخزون",
    description: "الأقمشة والألوان والأرصدة الفعلية والمحجوزة والمتاحة.",
  },
  {
    slug: "purchases",
    shortTitle: "المشتريات",
    title: "تقارير المشتريات",
    description: "طلبات الشراء وحالاتها والأقسام الطالبة والأصناف المطلوبة.",
  },
  {
    slug: "quality",
    shortTitle: "الجودة",
    title: "تقارير الجودة",
    description: "نتائج الفحص والكميات المرفوضة وإعادة العمل حسب الدفعة.",
  },
  {
    slug: "delivery",
    shortTitle: "التسليم",
    title: "تقارير التسليم",
    description: "سجلات التسليم النهائي والمستلمين والكميات المسلمة.",
  },
  {
    slug: "finance",
    shortTitle: "المالية",
    title: "تقارير الفواتير والمدفوعات",
    description: "الفواتير والمبالغ المدفوعة والمتبقية وطرق السداد.",
  },
  {
    slug: "archive",
    shortTitle: "الأرشيف",
    title: "تقارير الأرشيف والرقابة",
    description: "ملفات الطلبات وسجل التدقيق والأنشطة المحفوظة.",
  },
] as const;

export type ReportSlug = (typeof reportCards)[number]["slug"];

export function findReport(slug: string) {
  return reportCards.find((report) => report.slug === slug) ?? null;
}