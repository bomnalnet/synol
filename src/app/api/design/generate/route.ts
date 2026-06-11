import { NextRequest, NextResponse } from "next/server";
import { generateText } from "@/lib/llm";
import { getTemplateById } from "@/lib/templates";

export async function POST(request: NextRequest) {
  const { prompt, templateId, images, style, width, height } = await request.json();

  if (!prompt) {
    return NextResponse.json(
      { success: false, error: "Prompt is required" },
      { status: 400 }
    );
  }

  const template = templateId ? getTemplateById(templateId) : null;
  const canvasWidth = width || template?.width || 1080;
  const canvasHeight = height || template?.height || 1080;

  try {
    const fullPrompt = `당신은 광고 디자인 전문 AI입니다. 사용자의 요청에 따라 디자인 요소들을 JSON 형식으로 생성합니다.

캔버스 크기: ${canvasWidth}x${canvasHeight}px
${template ? `기반 템플릿: ${template.name} (${template.category})` : ""}
${images.length > 0 ? `사용 가능한 이미지 ${images.length}개가 있습니다.` : ""}
${style ? `요청 스타일: ${style}` : ""}

사용자 요청: ${prompt}
${images.length > 0 ? `사용할 이미지 경로:\n${images.map((img: string, i: number) => `${i + 1}. ${img}`).join("\n")}` : "이미지는 사용자가 나중에 추가합니다. placeholder로 표시해주세요."}

반드시 아래 JSON 형식으로만 응답하세요. JSON 외에 다른 텍스트는 절대 포함하지 마세요:
{"elements":[{"id":"bg","type":"background","x":0,"y":0,"width":${canvasWidth},"height":${canvasHeight},"rotation":0,"props":{"fill":"#색상"}},{"id":"text1","type":"text","x":숫자,"y":숫자,"width":숫자,"height":숫자,"rotation":0,"props":{"text":"내용","fontSize":숫자,"fontWeight":"normal|bold","fill":"#색상","textAlign":"left|center|right"}},{"id":"shape1","type":"shape","x":숫자,"y":숫자,"width":숫자,"height":숫자,"rotation":0,"props":{"fill":"#색상","borderRadius":숫자,"text":"버튼텍스트","textFill":"#색상"}}],"suggestions":["디자인 개선 제안1","제안2","제안3"]}`;

    const text = await generateText({
      prompt: fullPrompt,
      maxTokens: 4096,
    });

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
