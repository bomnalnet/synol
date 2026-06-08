import { NextRequest, NextResponse } from "next/server";
import { SynologyClient } from "@/lib/synology";
import { isImageFile } from "@/lib/synology";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nasUrl = searchParams.get("url");
  const sid = searchParams.get("sid");
  const folderPath = searchParams.get("path") || "/";
  const query = searchParams.get("q") || "";

  if (!nasUrl || !sid || !query) {
    return NextResponse.json(
      { success: false, error: "Missing required params" },
      { status: 400 }
    );
  }

  const client = new SynologyClient(nasUrl);
  client.setSid(sid);

  try {
    const files = await client.searchFiles(folderPath, query);
    const images = files.filter((f) => isImageFile(f.name));

    const assets = images.map((f) => ({
      id: Buffer.from(f.path).toString("base64url"),
      path: f.path,
      name: f.name,
      thumbnailUrl: `/api/synology/download?url=${encodeURIComponent(nasUrl)}&sid=${encodeURIComponent(sid)}&path=${encodeURIComponent(f.path)}&thumb=true`,
      fullUrl: `/api/synology/download?url=${encodeURIComponent(nasUrl)}&sid=${encodeURIComponent(sid)}&path=${encodeURIComponent(f.path)}`,
      size: f.additional?.size ?? 0,
      modifiedAt: f.additional?.time?.mtime ?? 0,
    }));

    return NextResponse.json({ success: true, assets });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
