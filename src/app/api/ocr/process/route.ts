import { NextRequest, NextResponse } from "next/server";
import { SynologyClient } from "@/lib/synology";
import { extractText } from "@/lib/ocr-engine";
import { saveOcrResult, isProcessed } from "@/lib/ocr-db";

const processingStatus = new Map<string, { total: number; done: number; current: string }>();

export async function POST(request: NextRequest) {
  const { nasUrl, sid, files } = await request.json();

  if (!nasUrl || !sid || !files?.length) {
    return NextResponse.json({ success: false, error: "Missing params" }, { status: 400 });
  }

  const unprocessed = files.filter((f: { path: string }) => !isProcessed(f.path));

  if (unprocessed.length === 0) {
    return NextResponse.json({ success: true, message: "All files already processed", processed: 0 });
  }

  const jobId = Date.now().toString();
  processingStatus.set(jobId, { total: unprocessed.length, done: 0, current: "" });

  processInBackground(jobId, nasUrl, sid, unprocessed);

  return NextResponse.json({ success: true, jobId, total: unprocessed.length });
}

async function processInBackground(
  jobId: string,
  nasUrl: string,
  sid: string,
  files: Array<{ path: string; name: string }>
) {
  const client = new SynologyClient(nasUrl);
  client.setSid(sid);

  const status = processingStatus.get(jobId)!;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    status.current = file.name;
    status.done = i;

    try {
      const downloadUrl = client.getDownloadUrl(file.path);
      const res = await fetch(downloadUrl);

      if (!res.ok) continue;

      const buffer = await res.arrayBuffer();
      const text = await extractText(buffer);
      saveOcrResult(nasUrl, file.path, file.name, text);
    } catch {
      saveOcrResult(nasUrl, file.path, file.name, "");
    }
  }

  status.done = files.length;
  status.current = "완료";

  setTimeout(() => processingStatus.delete(jobId), 60000);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json({ success: false, error: "Missing jobId" }, { status: 400 });
  }

  const status = processingStatus.get(jobId);

  if (!status) {
    return NextResponse.json({ success: true, done: true });
  }

  return NextResponse.json({
    success: true,
    total: status.total,
    done: status.done,
    current: status.current,
    finished: status.done >= status.total,
  });
}
