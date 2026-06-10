import { generateText } from "@/lib/llm";

export async function extractText(imageBuffer: ArrayBuffer): Promise<string> {
  const base64 = Buffer.from(imageBuffer).toString("base64");

  const sizeKB = imageBuffer.byteLength / 1024;
  if (sizeKB > 20000) {
    console.log(`[OCR] Image too large (${Math.round(sizeKB)}KB), skipping`);
    return "";
  }

  const text = await generateText({
    prompt:
      "이 이미지에 포함된 모든 텍스트를 추출해주세요. 텍스트만 출력하고, 설명은 하지 마세요. 텍스트가 없으면 빈 문자열만 출력하세요.",
    image: { data: base64, mediaType: "image/png" },
    maxTokens: 1024,
    anthropicModel: "claude-haiku-4-5",
  });

  return text.trim();
}
