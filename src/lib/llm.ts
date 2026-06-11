import Anthropic from "@anthropic-ai/sdk";
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const execFileAsync = promisify(execFile);

// AI 백엔드 선택:
//   USE_CLAUDE_CODE=true  → 로컬 claude CLI 사용 (API 비용 없음, 로컬 실행 시)
//   LOCAL_AI_URL=http://... → Ollama 등 OpenAI 호환 로컬 서버
//   (둘 다 없으면) → Anthropic API 직접 호출
const USE_CLAUDE_CODE = process.env.USE_CLAUDE_CODE === "true";
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
  anthropicModel?: string;
}

export async function generateText(opts: LlmOptions): Promise<string> {
  if (USE_CLAUDE_CODE) {
    return generateClaudeCode(opts);
  }
  if (LOCAL_AI_URL) {
    return generateLocalServer(opts);
  }
  return generateAnthropic(opts);
}

// Claude Code CLI를 서브프로세스로 호출
async function generateClaudeCode(opts: LlmOptions): Promise<string> {
  const args = ["-p", "--dangerously-skip-permissions"];

  if (opts.system) {
    args.push("--system-prompt", opts.system);
  }

  let prompt = opts.prompt;

  // 이미지가 있으면 임시 파일로 저장 후 경로를 프롬프트에 포함
  let tmpImagePath: string | null = null;
  if (opts.image) {
    const ext = opts.image.mediaType.split("/")[1];
    tmpImagePath = join(tmpdir(), `llm-img-${Date.now()}.${ext}`);
    await writeFile(tmpImagePath, Buffer.from(opts.image.data, "base64"));
    prompt = `이미지 파일 경로: ${tmpImagePath}\n\n${opts.prompt}`;
  }

  try {
    const { stdout } = await execFileAsync("claude", [...args, prompt], {
      timeout: 120000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout.trim();
  } finally {
    if (tmpImagePath) {
      await unlink(tmpImagePath).catch(() => {});
    }
  }
}

// Ollama 등 OpenAI 호환 로컬 서버
async function generateLocalServer(opts: LlmOptions): Promise<string> {
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
    body: JSON.stringify({ model, messages, max_tokens: opts.maxTokens || 4096, stream: false }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`로컬 AI 서버 오류 (${res.status}): ${body.substring(0, 200)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

// Anthropic API 직접 호출
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
