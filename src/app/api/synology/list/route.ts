import { NextRequest, NextResponse } from "next/server";
import { SynologyClient } from "@/lib/synology";
import { isImageFile } from "@/lib/synology";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nasUrl = searchParams.get("url");
  const sid = searchParams.get("sid");
  const folderPath = searchParams.get("path") || "/photo";
  const offset = parseInt(searchParams.get("offset") || "0");
  const limit = parseInt(searchParams.get("limit") || "200");

  if (!nasUrl || !sid) {
    return NextResponse.json(
      { success: false, error: "Missing url or sid" },
      { status: 400 }
    );
  }

  const client = new SynologyClient(nasUrl);
  client.setSid(sid);

  try {
    const result = await client.listFiles(folderPath, offset, limit, "all");

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: `Synology error: ${result.error?.code}` },
        { status: 500 }
      );
    }

    const allFiles = result.data?.files ?? [];

    const folders = allFiles
      .filter((f) => f.isdir)
      .map((f) => ({
        id: Buffer.from(f.path).toString("base64url"),
        path: f.path,
        name: f.name,
        isFolder: true,
      }));

    const images = allFiles.filter((f) => !f.isdir && isImageFile(f.name));

    const assets = images.map((f) => ({
      id: Buffer.from(f.path).toString("base64url"),
      path: f.path,
      name: f.name,
      thumbnailUrl: `/api/synology/download?url=${encodeURIComponent(nasUrl)}&sid=${encodeURIComponent(sid)}&path=${encodeURIComponent(f.path)}&thumb=true`,
      fullUrl: `/api/synology/download?url=${encodeURIComponent(nasUrl)}&sid=${encodeURIComponent(sid)}&path=${encodeURIComponent(f.path)}`,
      size: f.additional?.size ?? 0,
      modifiedAt: f.additional?.time?.mtime ?? 0,
    }));

    return NextResponse.json({
      success: true,
      folders,
      assets,
      total: result.data?.total ?? 0,
      offset,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
