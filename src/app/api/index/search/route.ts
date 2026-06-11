import { NextRequest, NextResponse } from "next/server";
import { searchFileIndex } from "@/lib/ocr-db";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nasUrl = searchParams.get("url");
  const sid = searchParams.get("sid");
  const query = searchParams.get("q");
  const mode = searchParams.get("mode") || "and";

  if (!nasUrl || !sid || !query) {
    return NextResponse.json({ success: false, error: "Missing params" }, { status: 400 });
  }

  const keywords = query.trim().split(/\s+/).filter((k) => k.length > 0);

  let finalResults: Array<{ file_path: string; file_name: string; file_size: number; mtime: number }>;

  if (keywords.length <= 1) {
    finalResults = searchFileIndex(nasUrl, keywords[0] || query);
  } else if (mode === "and") {
    const sets = keywords.map((kw) => {
      const r = searchFileIndex(nasUrl, kw, 1000);
      return new Set(r.map((f) => f.file_path));
    });
    const first = searchFileIndex(nasUrl, keywords[0], 1000);
    finalResults = first.filter((f) => sets.every((s) => s.has(f.file_path)));
  } else {
    const seen = new Set<string>();
    finalResults = [];
    for (const kw of keywords) {
      for (const r of searchFileIndex(nasUrl, kw, 500)) {
        if (!seen.has(r.file_path)) {
          seen.add(r.file_path);
          finalResults.push(r);
        }
      }
    }
    finalResults.sort((a, b) => b.mtime - a.mtime);
    finalResults = finalResults.slice(0, 200);
  }

  const assets = finalResults.map((r) => ({
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
