import { NextRequest, NextResponse } from "next/server";
import { extractText } from "@/lib/ocr-engine";
import { saveOcrResult, isProcessed } from "@/lib/ocr-db";

interface JobStatus {
  total: number;
  done: number;
  current: string;
  errors: string[];
  cancelled: boolean;
}

const processingStatus = new Map<string, JobStatus>();

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
  processingStatus.set(jobId, { total: unprocessed.length, done: 0, current: "시작 중...", errors: [], cancelled: false });

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
    if (status.cancelled) {
      console.log(`[OCR] Job ${jobId} cancelled at ${i}/${files.length}`);
      status.current = "취소됨";
      break;
    }

    const file = files[i];
    status.current = file.name;
    status.done = i;

    try {
      const downloadUrl = `${origin}/api/synology/download?url=${encodeURIComponent(nasUrl)}&sid=${encodeURIComponent(sid)}&path=${encodeURIComponent(file.path)}`;

      console.log(`[OCR] Processing ${i + 1}/${files.length}: ${file.name}`);

      const controller = new AbortController();
      const fetchTimeout = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(downloadUrl, { signal: controller.signal });
      clearTimeout(fetchTimeout);

      if (!res.ok) {
        console.log(`[OCR] Download failed for ${file.name}: ${res.status}`);
        status.errors.push(`${file.name}: 다운로드 실패`);
        saveOcrResult(nasUrl, file.path, file.name, "");
        continue;
      }

      const buffer = await res.arrayBuffer();
      console.log(`[OCR] Downloaded ${file.name}, size: ${buffer.byteLength} bytes`);

      const text = await extractText(buffer);
      console.log(`[OCR] Extracted from ${file.name}: "${text.substring(0, 80)}"`);

      saveOcrResult(nasUrl, file.path, file.name, text);
      status.done = i + 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[OCR] Error processing ${file.name}:`, msg);
      status.errors.push(`${file.name}: ${msg}`);
      saveOcrResult(nasUrl, file.path, file.name, "");
      status.done = i + 1;
    }
  }

  if (!status.cancelled) {
    status.done = files.length;
    status.current = "NAS에 동기화 중...";

    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
      const syncRes = await fetch(`${origin}${basePath}/api/ocr/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nasUrl, sid, action: "upload" }),
      });
      const syncData = await syncRes.json();
      if (syncData.success) {
        console.log(`[OCR] Synced ${syncData.count} entries to NAS`);
      }
    } catch (err) {
      console.error("[OCR] NAS sync failed:", err);
    }

    status.current = "완료";
  }

  console.log(`[OCR] Job ${jobId} finished. ${status.done} processed, ${status.errors.length} errors.`);
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
    finished: status.done >= status.total || status.cancelled,
    cancelled: status.cancelled,
    errors: status.errors.slice(-5),
  });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json({ success: false, error: "Missing jobId" }, { status: 400 });
  }

  const status = processingStatus.get(jobId);
  if (status) {
    status.cancelled = true;
  }

  return NextResponse.json({ success: true });
}
