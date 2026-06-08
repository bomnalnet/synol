import { NextRequest, NextResponse } from "next/server";
import { SynologyClient } from "@/lib/synology";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nasUrl = searchParams.get("url");
  const sid = searchParams.get("sid");
  const filePath = searchParams.get("path");
  const isThumb = searchParams.get("thumb") === "true";

  if (!nasUrl || !sid || !filePath) {
    return NextResponse.json(
      { success: false, error: "Missing required params" },
      { status: 400 }
    );
  }

  const client = new SynologyClient(nasUrl);
  client.setSid(sid);

  try {
    const targetUrl = isThumb
      ? client.getThumbnailUrl(filePath, "medium")
      : client.getDownloadUrl(filePath);

    const res = await fetch(targetUrl);

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: "Failed to fetch file" },
        { status: 502 }
      );
    }

    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
