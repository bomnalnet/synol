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

  const mode = searchParams.get("mode") || "and";
  const keywords = query.trim().split(/\s+/).filter((w) => w.length > 0);

  let results: ReturnType<typeof searchByText>;

  if (keywords.length <= 1 || mode === "or") {
    results = searchByText(query);
  } else {
    // AND 모드: 각 키워드 검색 후 교집합
    const allSets = keywords.map((kw) => {
      const r = searchByText(kw);
      return new Map(r.map((item) => [item.file_path, item]));
    });
    const intersection = [...allSets[0].entries()].filter(([path]) =>
      allSets.every((s) => s.has(path))
    );
    results = intersection.map(([, item]) => item);
  }

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
