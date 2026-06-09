import { NextResponse } from "next/server";
import { deleteCustomTemplate } from "@/lib/template-db";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!id.startsWith("custom-")) {
    return NextResponse.json({ success: false, error: "기본 템플릿은 삭제할 수 없습니다." }, { status: 400 });
  }

  const deleted = deleteCustomTemplate(id);
  if (!deleted) {
    return NextResponse.json({ success: false, error: "템플릿을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
