import Anthropic from "@anthropic-ai/sdk";

// 로컬 AI 서버 (Ollama 등 OpenAI 호환 API) 설정
// LOCAL_AI_URL이 설정되면 Anthropic API 대신 로컬 서버를 사용합니다.
// 예: LOCAL_AI_URL=http://localhost:11434  (Ollama)
//     LOCAL_AI_MODEL=llama3.1              (텍스트 생성용)
//     LOCAL_AI_VISION_MODEL=llava          (이미지 인식용)
const LOCAL_AI_URL = process.env.LOCAL_AI_URL?.replace(/\/$/, "");
const LOCAL_AI_MODEL = process.env.LOCAL_AI_MODEL || "llama3.1";
const LOCAL_AI_VISION_MODEL = process.env.LOCAL_AI_VISION_MODEL || "llava";

const anthropic = new Anthropic();

export interface LlmImage {
  data: string; // base64
  mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
}

export interface LlmOptions {
  system?: string;
  prompt: string;
  image?: LlmImage;
  maxTokens?: number;
  // Anthropic 사용 시 모델 (기본: claude-sonnet-4-6, OCR 등 가벼운 작업엔 claude-haiku-4-5)
  anthropicModel?: string;
}

export function isLocalAi(): boolean {
  return !!LOCAL_AI_URL;
}

export async function generateText(opts: LlmOptions): Promise<string> {
  if (LOCAL_AI_URL) {
    return generateLocal(opts);
  }
  return generateAnthropic(opts);
}

async function generateLocal(opts: LlmOptions): Promise<string> {
  const model = opts.image ? LOCAL_AI_VISION_MODEL : LOCAL_AI_MODEL;

  const userContent: unknown = opts.image
    ? [
        {
          type: "image_url",
          image_url: { url: `data:${opts.image.mediaType};base64,${opts.image.data}` },
        },
        { type: "text", text: opts.prompt },
      ]
    : opts.prompt;

  const messages: Array<{ role: string; content: unknown }> = [];
  if (opts.system) {
    messages.push({ role: "system", content: opts.system });
  }
  messages.push({ role: "user", content: userContent });

  const res = await fetch(`${LOCAL_AI_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: opts.maxTokens || 4096,
      stream: false,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`로컬 AI 서버 오류 (${res.status}): ${body.substring(0, 200)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

async function generateAnthropic(opts: LlmOptions): Promise<string> {
  const content: Anthropic.ContentBlockParam[] = [];

  if (opts.image) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: opts.image.mediaType,
        data: opts.image.data,
      },
    });
  }
  content.push({ type: "text", text: opts.prompt });

  const message = await anthropic.messages.create({
    model: opts.anthropicModel || "claude-sonnet-4-6",
    max_tokens: opts.maxTokens || 4096,
    system: opts.system,
    messages: [{ role: "user", content }],
  });

  return message.content[0].type === "text" ? message.content[0].text : "";
}
