import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getTabletSession } from "@/lib/tablet/session";
import type { DepartmentCode } from "@/lib/types/database";

type DownloadableOrderFile = {
  id: string;
  order_id: string;
  file_path: string;
  file_name: string;
  file_type: string;
};

type BatchAccessRow = {
  id: string;
  current_department: DepartmentCode | null;
  status: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const session = await getTabletSession();
  if (!session) {
    return NextResponse.json({ error: "انتهت جلسة التابلت." }, { status: 401 });
  }

  const { fileId } = await params;
  if (!UUID_PATTERN.test(fileId)) {
    return NextResponse.json({ error: "معرف الملف غير صالح." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: file, error: fileError } = await supabase
    .from("order_files")
    .select("id, order_id, file_path, file_name, file_type")
    .eq("id", fileId)
    .maybeSingle<DownloadableOrderFile>();

  if (fileError) {
    return NextResponse.json({ error: "تعذر قراءة بيانات الملف." }, { status: 500 });
  }

  if (!file) {
    return NextResponse.json({ error: "الملف غير موجود." }, { status: 404 });
  }

  const hasAccess = await tabletCanAccessOrderFile({
    department: session.department,
    orderId: file.order_id,
  });

  if (!hasAccess) {
    return NextResponse.json({ error: "لا تملك صلاحية تنزيل هذا الملف." }, { status: 403 });
  }

  const { data: blob, error: downloadError } = await supabase.storage
    .from("order-files")
    .download(file.file_path);

  if (downloadError || !blob) {
    return NextResponse.json({ error: "تعذر تنزيل الملف من التخزين." }, { status: 404 });
  }

  return new Response(await blob.arrayBuffer(), {
    headers: {
      "Content-Type": blob.type || contentTypeFromName(file.file_name),
      "Content-Disposition": contentDisposition(file.file_name),
      "Cache-Control": "private, no-store",
    },
  });
}

async function tabletCanAccessOrderFile({
  department,
  orderId,
}: {
  department: DepartmentCode;
  orderId: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { data: batches, error: batchesError } = await supabase
    .from("batches")
    .select("id, current_department, status")
    .eq("order_id", orderId)
    .returns<BatchAccessRow[]>();

  if (batchesError || !batches || batches.length === 0) return false;

  const batchIds = batches.map((batch) => batch.id);
  const hasCurrentDepartmentAccess = batches.some(
    (batch) => batch.current_department === department && batch.status !== "closed",
  );

  if (hasCurrentDepartmentAccess) return true;

  const { data: pendingTransfers, error: transferError } = await supabase
    .from("batch_transfers")
    .select("id")
    .in("batch_id", batchIds)
    .eq("to_department", department)
    .eq("status", "sent")
    .limit(1);

  return !transferError && Boolean(pendingTransfers?.length);
}

function contentDisposition(fileName: string) {
  const fallbackName = fileName
    .replace(/[^\x20-\x7E]+/g, "_")
    .replace(/["\\]/g, "_")
    .trim() || "order-file";
  return `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

function contentTypeFromName(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "png") return "image/png";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "webp") return "image/webp";
  if (extension === "gif") return "image/gif";
  if (extension === "pdf") return "application/pdf";
  return "application/octet-stream";
}