import { NextRequest, NextResponse } from "next/server";
import { getAllCustomTemplates, saveCustomTemplate } from "@/lib/template-db";

export async function GET() {
  try {
    const templates = getAllCustomTemplates();
    return NextResponse.json({ success: true, templates });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, category, width, height, elements } = await request.json();

    if (!name || !width || !height || !elements) {
      return NextResponse.json({ success: false, error: "필수 항목이 누락되었습니다." }, { status: 400 });
    }

    const template = {
      id: `custom-${Date.now()}`,
      name,
      category: category || "내 템플릿",
      width,
      height,
      thumbnail: "",
      elements,
    };

    saveCustomTemplate(template);
    return NextResponse.json({ success: true, template }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
