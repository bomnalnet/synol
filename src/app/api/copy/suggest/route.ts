import { NextRequest, NextResponse } from "next/server";
import { generateText } from "@/lib/llm";

export async function POST(request: NextRequest) {
  const { purpose, tone, keywords, existingCopy, platform, maxLength } = await request.json();

  if (!purpose) {
    return NextResponse.json({ success: false, error: "목적을 입력해주세요." }, { status: 400 });
  }

  const systemPrompt = `당신은 대한민국 최고의 광고 카피라이터입니다.
광고 카피를 작성할 때 다음 원칙을 따릅니다:
- 짧고 강렬하게
- 타겟 고객의 감정에 호소
- 행동을 유도하는 CTA 포함
- 플랫폼에 맞는 톤앤매너 유지

반드시 아래 JSON 형식으로만 응답하세요:
{
  "copies": [
    {
      "headline": "메인 헤드라인",
      "subheadline": "서브 헤드라인",
      "body": "본문 카피",
      "cta": "CTA 문구",
      "hashtags": ["해시태그1", "해시태그2"]
    }
  ],
  "tips": ["카피 활용 팁1", "팁2"]
}`;

  const userPrompt = `다음 조건에 맞는 광고 카피를 5개 제안해주세요:

목적: ${purpose}
${tone ? `톤앤매너: ${tone}` : ""}
${keywords ? `키워드: ${keywords}` : ""}
${platform ? `플랫폼: ${platform}` : ""}
${maxLength ? `글자 수 제한: ${maxLength}자 이내` : ""}
${existingCopy ? `기존 카피 참고:\n${existingCopy}` : ""}`;

  try {
    const text = await generateText({
      system: systemPrompt,
      prompt: userPrompt,
      maxTokens: 4096,
    });
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return NextResponse.json({ success: false, error: "응답 파싱 실패" }, { status: 500 });
    }

    const result = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
