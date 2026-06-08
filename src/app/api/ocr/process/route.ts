import { NextRequest, NextResponse } from "next/server";
import { extractText } from "@/lib/ocr-engine";
import { saveOcrResult, isProcessed } from "@/lib/ocr-db";

const processingStatus = new Map<string, { total: number; done: number; current: string; errors: string[] }>();

export async function POST(request: NextRequest) {
  const { nasUrl, sid, files, baseUrl } = await request.json();

  if (!nasUrl || !sid || !files?.length) {
    return NextResponse.json({ success: false, error: "Missing params" }, { status: 400 });
  }

  const unprocessed = files.filter((f: { path: string }) => !isProcessed(f.path));

  if (unprocessed.length === 0) {
    return NextResponse.json({ success: true, message: "All files already processed", processed: 0 });
  }

  const jobId = Date.now().toString();
  processingStatus.set(jobId, { total: unprocessed.length, done: 0, current: "시작 중...", errors: [] });

  const origin = baseUrl || "http://localhost:1235";
  processInBackground(jobId, nasUrl, sid, unprocessed, origin);

  return NextResponse.json({ success: true, jobId, total: unprocessed.length });
}

async function processInBackground(
  jobId: string,
  nasUrl: string,
  sid: string,
  files: Array<{ path: string; name: string }>,
  origin: string
) {
  const status = processingStatus.get(jobId)!;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    status.current = file.name;
    status.done = i;

    try {
      const downloadUrl = `${origin}/api/synology/download?url=${encodeURIComponent(nasUrl)}&sid=${encodeURIComponent(sid)}&path=${encodeURIComponent(file.path)}`;

      console.log(`[OCR] Processing ${i + 1}/${files.length}: ${file.name}`);

      const res = await fetch(downloadUrl);

      if (!res.ok) {
        console.log(`[OCR] Download failed for ${file.name}: ${res.status}`);
        status.errors.push(`${file.name}: 다운로드 실패 (${res.status})`);
        saveOcrResult(nasUrl, file.path, file.name, "");
        continue;
      }

      const buffer = await res.arrayBuffer();
      console.log(`[OCR] Downloaded ${file.name}, size: ${buffer.byteLength} bytes`);

      const text = await extractText(buffer);
      console.log(`[OCR] Extracted from ${file.name}: "${text.substring(0, 50)}..."`);

      saveOcrResult(nasUrl, file.path, file.name, text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[OCR] Error processing ${file.name}:`, msg);
      status.errors.push(`${file.name}: ${msg}`);
      saveOcrResult(nasUrl, file.path, file.name, "");
    }
  }

  status.done = files.length;
  status.current = "완료";
  console.log(`[OCR] Job ${jobId} finished. ${files.length} files processed, ${status.errors.length} errors.`);

  setTimeout(() => processingStatus.delete(jobId), 300000);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json({ success: false, error: "Missing jobId" }, { status: 400 });
  }

  const status = processingStatus.get(jobId);

  if (!status) {
    return NextResponse.json({ success: true, done: true, finished: true });
  }

  return NextResponse.json({
    success: true,
    total: status.total,
    done: status.done,
    current: status.current,
    finished: status.done >= status.total,
    errors: status.errors.slice(-5),
  });
}
