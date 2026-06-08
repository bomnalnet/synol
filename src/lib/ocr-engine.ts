import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function extractText(imageBuffer: ArrayBuffer): Promise<string> {
  const base64 = Buffer.from(imageBuffer).toString("base64");

  const sizeKB = imageBuffer.byteLength / 1024;
  if (sizeKB > 20000) {
    console.log(`[OCR] Image too large (${Math.round(sizeKB)}KB), skipping`);
    return "";
  }

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: base64,
            },
          },
          {
            type: "text",
            text: "이 이미지에 포함된 모든 텍스트를 추출해주세요. 텍스트만 출력하고, 설명은 하지 마세요. 텍스트가 없으면 빈 문자열만 출력하세요.",
          },
        ],
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text.trim() : "";
  return text;
}
