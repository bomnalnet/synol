import { NextRequest, NextResponse } from "next/server";
import { SynologyClient } from "@/lib/synology";
import { isImageFile } from "@/lib/synology";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nasUrl = searchParams.get("url");
  const sid = searchParams.get("sid");
  const folderPath = searchParams.get("path") || "/photo";
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
    let files = await client.searchFiles("/photo", query);
    let images = files.filter((f) => isImageFile(f.name));

    // Synology search API often fails with Korean/CJK characters.
    // Fall back to recursive listing + filename/path filter.
    if (images.length === 0) {
      const allImages = await client.listImagesRecursive("/photo", 5);
      const lowerQuery = query.toLowerCase();
      images = allImages.filter((f) => {
        const name = f.name.toLowerCase();
        const dir = f.path.toLowerCase();
        return name.includes(lowerQuery) || dir.includes(lowerQuery);
      });
    }

    const assets = images.map((f) => ({
      id: Buffer.from(f.path).toString("base64url"),
      path: f.path,
      name: f.name,
      thumbnailUrl: `${BASE}/api/synology/download?url=${encodeURIComponent(nasUrl)}&sid=${encodeURIComponent(sid)}&path=${encodeURIComponent(f.path)}&thumb=true`,
      fullUrl: `${BASE}/api/synology/download?url=${encodeURIComponent(nasUrl)}&sid=${encodeURIComponent(sid)}&path=${encodeURIComponent(f.path)}`,
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
