import { NextRequest, NextResponse } from "next/server";
import { SynologyClient } from "@/lib/synology";
import { bulkUpsertFileIndex, clearFileIndex, getFileIndexCount } from "@/lib/ocr-db";

interface BuildJob {
  total: number;
  done: boolean;
  error?: string;
  startedAt: number;
}

const jobs = new Map<string, BuildJob>();

// GET — check index status or job progress
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nasUrl = searchParams.get("url");
  const jobId = searchParams.get("jobId");

  if (jobId) {
    const job = jobs.get(jobId);
    if (!job) return NextResponse.json({ success: false, error: "Job not found" }, { status: 404 });
    return NextResponse.json({ success: true, done: job.done, total: job.total, error: job.error });
  }

  if (!nasUrl) return NextResponse.json({ success: false, error: "Missing url" }, { status: 400 });

  const count = getFileIndexCount(nasUrl);
  return NextResponse.json({ success: true, count });
}

// POST — start index build in background
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { nasUrl, sid } = body as { nasUrl: string; sid: string };

  if (!nasUrl || !sid) {
    return NextResponse.json({ success: false, error: "Missing params" }, { status: 400 });
  }

  const jobId = `idx-${Date.now()}`;
  const job: BuildJob = { total: 0, done: false, startedAt: Date.now() };
  jobs.set(jobId, job);

  // Run in background (non-blocking)
  (async () => {
    try {
      const client = new SynologyClient(nasUrl);
      client.setSid(sid);

      const allImages = await client.listImagesRecursive("/photo", 10);
      job.total = allImages.length;

      clearFileIndex(nasUrl);

      const BATCH = 500;
      for (let i = 0; i < allImages.length; i += BATCH) {
        const chunk = allImages.slice(i, i + BATCH);
        bulkUpsertFileIndex(
          nasUrl,
          chunk.map((f) => ({
            filePath: f.path,
            fileName: f.name,
            fileSize: f.additional?.size ?? 0,
            mtime: f.additional?.time?.mtime ?? 0,
          }))
        );
      }

      job.done = true;
    } catch (err) {
      job.error = (err as Error).message;
      job.done = true;
    }

    // Clean up after 10 min
    setTimeout(() => jobs.delete(jobId), 600_000);
  })();

  return NextResponse.json({ success: true, jobId });
}
