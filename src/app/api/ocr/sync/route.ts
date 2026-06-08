import { NextRequest, NextResponse } from "next/server";
import { SynologyClient } from "@/lib/synology";
import { saveOcrResult, searchByText } from "@/lib/ocr-db";
import Database from "better-sqlite3";
import path from "path";

const METADATA_PATH = "/photo";
const METADATA_FILE = "_ocr_metadata.json";

interface OcrEntry {
  file_path: string;
  file_name: string;
  ocr_text: string;
  processed_at: string;
}

export async function POST(request: NextRequest) {
  const { nasUrl, sid, action } = await request.json();

  if (!nasUrl || !sid) {
    return NextResponse.json({ success: false, error: "Missing params" }, { status: 400 });
  }

  const client = new SynologyClient(nasUrl);
  client.setSid(sid);

  if (action === "upload") {
    return handleUpload(client);
  } else if (action === "download") {
    return handleDownload(client, nasUrl);
  }

  return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
}

async function handleUpload(client: SynologyClient) {
  try {
    const db = new Database(path.join(process.cwd(), "ocr-metadata.db"));
    const rows = db.prepare("SELECT file_path, file_name, ocr_text, processed_at FROM ocr_metadata").all() as OcrEntry[];
    db.close();

    if (rows.length === 0) {
      return NextResponse.json({ success: true, message: "No data to upload", count: 0 });
    }

    const json = JSON.stringify(rows, null, 2);
    const success = await client.uploadFile(METADATA_PATH, METADATA_FILE, json);

    if (success) {
      console.log(`[OCR Sync] Uploaded ${rows.length} entries to NAS`);
      return NextResponse.json({ success: true, count: rows.length });
    } else {
      return NextResponse.json({ success: false, error: "NAS 업로드 실패" }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

async function handleDownload(client: SynologyClient, nasUrl: string) {
  try {
    const filePath = `${METADATA_PATH}/${METADATA_FILE}`;
    const content = await client.downloadFile(filePath);

    if (!content) {
      return NextResponse.json({ success: true, message: "NAS에 메타데이터 없음", count: 0 });
    }

    const entries: OcrEntry[] = JSON.parse(content);
    let imported = 0;

    for (const entry of entries) {
      saveOcrResult(nasUrl, entry.file_path, entry.file_name, entry.ocr_text);
      imported++;
    }

    console.log(`[OCR Sync] Downloaded ${imported} entries from NAS`);
    return NextResponse.json({ success: true, count: imported });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
