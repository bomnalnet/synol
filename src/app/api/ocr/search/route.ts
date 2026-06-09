import { NextRequest, NextResponse } from "next/server";
import { searchByText } from "@/lib/ocr-db";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const nasUrl = searchParams.get("url");
  const sid = searchParams.get("sid");

  if (!query || !nasUrl || !sid) {
    return NextResponse.json({ success: false, error: "Missing params" }, { status: 400 });
  }

  const results = searchByText(query);

  const assets = results.map((r) => ({
    id: Buffer.from(r.file_path).toString("base64url"),
    path: r.file_path,
    name: r.file_name,
    ocrText: r.ocr_text,
    thumbnailUrl: `${BASE}/api/synology/download?url=${encodeURIComponent(nasUrl)}&sid=${encodeURIComponent(sid)}&path=${encodeURIComponent(r.file_path)}&thumb=true`,
    fullUrl: `${BASE}/api/synology/download?url=${encodeURIComponent(nasUrl)}&sid=${encodeURIComponent(sid)}&path=${encodeURIComponent(r.file_path)}`,
    size: 0,
    modifiedAt: 0,
  }));

  return NextResponse.json({ success: true, assets });
}
