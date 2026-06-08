import { createWorker, Worker } from "tesseract.js";

let worker: Worker | null = null;
let initializing = false;

async function getWorker(): Promise<Worker> {
  if (worker) return worker;
  if (initializing) {
    while (initializing) {
      await new Promise((r) => setTimeout(r, 500));
    }
    if (worker) return worker;
  }

  initializing = true;
  try {
    console.log("[OCR] Tesseract worker 초기화 중 (한국어+영어)...");
    worker = await createWorker("kor+eng");
    console.log("[OCR] Tesseract worker 준비 완료");
    return worker;
  } finally {
    initializing = false;
  }
}

export async function extractText(imageBuffer: ArrayBuffer, timeoutMs = 30000): Promise<string> {
  const w = await getWorker();
  const buffer = Buffer.from(imageBuffer);

  const result = await Promise.race([
    w.recognize(buffer),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("OCR timeout")), timeoutMs)
    ),
  ]);

  return result.data.text.trim();
}

export async function terminateWorker(): Promise<void> {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}
