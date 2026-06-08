import { createWorker, Worker } from "tesseract.js";

let worker: Worker | null = null;

async function getWorker(): Promise<Worker> {
  if (!worker) {
    worker = await createWorker("kor+eng");
  }
  return worker;
}

export async function extractText(imageBuffer: ArrayBuffer): Promise<string> {
  const w = await getWorker();
  const buffer = Buffer.from(imageBuffer);
  const result = await w.recognize(buffer);
  const text = result.data.text.trim();
  return text;
}

export async function terminateWorker(): Promise<void> {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}
