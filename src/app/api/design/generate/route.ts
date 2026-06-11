import { NextRequest, NextResponse } from "next/server";
import { generateText } from "@/lib/llm";
import { getTemplateById } from "@/lib/templates";
import { SynologyClient, isImageFile } from "@/lib/synology";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

async function searchReferenceImages(
  nasUrl: string,
  sid: string,
  prompt: string,
  origin: string
): Promise<{ thumbnails: string[]; names: string[] }> {
  const client = new SynologyClient(nasUrl);
  client.setSid(sid);

  // 프롬프트에서 검색 키워드 추출 (한글 단어 2자 이상)
  const keywords = prompt
    .replace(/[^가-힣a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  const foundFiles = new Map<string, { path: string; name: string }>();

  for (const keyword of keywords.slice(0, 5)) {
    try {
      const files = await client.searchFiles("/photo", keyword);
      for (const f of files) {
        if (!f.isdir && isImageFile(f.name) && !foundFiles.has(f.path)) {
          foundFiles.set(f.path, { path: f.path, name: f.name });
          if (foundFiles.size >= 6) break;
        }
      }
      if (foundFiles.size >= 6) break;
    } catch {
      // 검색 실패 무시
    }
  }

  if (foundFiles.size === 0) return { thumbnails: [], names: [] };

  // 참고 이미지의 썸네일을 base64로 다운로드
  const thumbnails: string[] = [];
  const names: string[] = [];

  for (const { path, name } of foundFiles.values()) {
    try {
      const thumbUrl = `${origin}${BASE}/api/synology/download?url=${encodeURIComponent(nasUrl)}&sid=${encodeURIComponent(sid)}&path=${encodeURIComponent(path)}&thumb=true`;
      const res = await fetch(thumbUrl);
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");
        thumbnails.push(base64);
        names.push(name);
      }
    } catch {
      // 다운로드 실패 무시
    }
    if (thumbnails.length >= 4) break;
  }

  return { thumbnails, names };
}

export async function POST(request: NextRequest) {
  const { prompt, templateId, images, style, width, height, nasUrl, sid } =
    await request.json();

  if (!prompt) {
    return NextResponse.json(
      { success: false, error: "Prompt is required" },
      { status: 400 }
    );
  }

  const template = templateId ? getTemplateById(templateId) : null;
  const canvasWidth = width || template?.width || 1080;
  const canvasHeight = height || template?.height || 1080;

  // NAS에서 관련 이미지 검색 및 스타일 분석
  let referenceInfo = "";
  let referenceImageData: Array<{ data: string; mediaType: "image/png" }> = [];

  if (nasUrl && sid) {
    try {
      const origin = `http://localhost:${process.env.PORT || 1235}`;
      const { thumbnails, names } = await searchReferenceImages(
        nasUrl,
        sid,
        prompt,
        origin
      );

      if (thumbnails.length > 0) {
        referenceInfo = `\n\n[참고 이미지 ${thumbnails.length}개를 NAS에서 찾았습니다: ${names.join(", ")}]\n이 이미지들의 색상, 레이아웃, 폰트 스타일, 분위기를 분석하여 유사한 디자인을 만들어주세요.`;
        referenceImageData = thumbnails.map((d) => ({
          data: d,
          mediaType: "image/png" as const,
        }));
      }
    } catch {
      // 검색 실패 시 무시하고 진행
    }
  }

  const fullPrompt = `당신은 광고 디자인 전문 AI입니다. 사용자의 요청에 따라 디자인 요소들을 JSON 형식으로 생성합니다.

캔버스 크기: ${canvasWidth}x${canvasHeight}px
${template ? `기반 템플릿: ${template.name} (${template.category})` : ""}
${images.length > 0 ? `사용 가능한 이미지 ${images.length}개가 있습니다.` : ""}
${style ? `요청 스타일: ${style}` : ""}

사용자 요청: ${prompt}
${images.length > 0 ? `사용할 이미지 경로:\n${images.map((img: string, i: number) => `${i + 1}. ${img}`).join("\n")}` : "이미지는 사용자가 나중에 추가합니다. placeholder로 표시해주세요."}
${referenceInfo}

반드시 아래 JSON 형식으로만 응답하세요. JSON 외에 다른 텍스트는 절대 포함하지 마세요:
{"elements":[{"id":"bg","type":"background","x":0,"y":0,"width":${canvasWidth},"height":${canvasHeight},"rotation":0,"props":{"fill":"#색상"}},{"id":"text1","type":"text","x":숫자,"y":숫자,"width":숫자,"height":숫자,"rotation":0,"props":{"text":"내용","fontSize":숫자,"fontWeight":"normal|bold","fill":"#색상","textAlign":"left|center|right"}},{"id":"shape1","type":"shape","x":숫자,"y":숫자,"width":숫자,"height":숫자,"rotation":0,"props":{"fill":"#색상","borderRadius":숫자,"text":"버튼텍스트","textFill":"#색상"}}],"suggestions":["디자인 개선 제안1","제안2","제안3"]}`;

  try {
    let text: string;

    if (referenceImageData.length > 0) {
      // 참고 이미지가 있으면 첫 번째 이미지를 비전으로 전달
      text = await generateText({
        prompt: fullPrompt,
        image: referenceImageData[0],
        maxTokens: 4096,
      });
    } else {
      text = await generateText({
        prompt: fullPrompt,
        maxTokens: 4096,
      });
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { success: false, error: "AI 응답을 파싱할 수 없습니다." },
        { status: 500 }
      );
    }

    const design = JSON.parse(jsonMatch[0]);

    return NextResponse.json({ success: true, design });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
