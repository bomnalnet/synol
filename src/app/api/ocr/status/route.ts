import { NextRequest, NextResponse } from "next/server";
import { getUnprocessedPaths, getOcrResult } from "@/lib/ocr-db";

export async function POST(request: NextRequest) {
  const { filePaths } = await request.json();

  if (!filePaths?.length) {
    return NextResponse.json({ success: true, processed: [], unprocessed: [] });
  }

  const unprocessed = getUnprocessedPaths(filePaths);
  const unprocessedSet = new Set(unprocessed);

  const processed = filePaths
    .filter((p: string) => !unprocessedSet.has(p))
    .map((p: string) => ({ path: p, ocrText: getOcrResult(p) || "" }));

  return NextResponse.json({
    success: true,
    processed,
    unprocessed,
    processedCount: processed.length,
    unprocessedCount: unprocessed.length,
  });
}
