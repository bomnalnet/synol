import { NextRequest, NextResponse } from "next/server";
import { searchFileIndex } from "@/lib/ocr-db";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nasUrl = searchParams.get("url");
  const sid = searchParams.get("sid");
  const query = searchParams.get("q");

  if (!nasUrl || !sid || !query) {
    return NextResponse.json({ success: false, error: "Missing params" }, { status: 400 });
  }

  const results = searchFileIndex(nasUrl, query);

  const assets = results.map((r) => ({
    id: Buffer.from(r.file_path).toString("base64url"),
    path: r.file_path,
    name: r.file_name,
    thumbnailUrl: `${BASE}/api/synology/download?url=${encodeURIComponent(nasUrl)}&sid=${encodeURIComponent(sid)}&path=${encodeURIComponent(r.file_path)}&thumb=true`,
    fullUrl: `${BASE}/api/synology/download?url=${encodeURIComponent(nasUrl)}&sid=${encodeURIComponent(sid)}&path=${encodeURIComponent(r.file_path)}`,
    size: r.file_size,
    modifiedAt: r.mtime,
  }));

  return NextResponse.json({ success: true, assets, total: assets.length });
}
