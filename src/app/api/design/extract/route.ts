import { NextRequest, NextResponse } from "next/server";
import { generateText } from "@/lib/llm";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export async function POST(request: NextRequest) {
  const { imageUrl, canvasWidth, canvasHeight } = await request.json();

  if (!imageUrl) {
    return NextResponse.json(
      { success: false, error: "이미지 URL이 필요합니다." },
      { status: 400 }
    );
  }

  const w = canvasWidth || 1080;
  const h = canvasHeight || 1080;

  try {
    const fullUrl = imageUrl.startsWith("http")
      ? imageUrl
      : `http://localhost:${process.env.PORT || 3000}${imageUrl.startsWith(BASE) ? imageUrl : BASE + imageUrl}`;

    const res = await fetch(fullUrl);
    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: "이미지 다운로드 실패" },
        { status: 500 }
      );
    }

    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    const contentType = res.headers.get("content-type") || "image/png";
    const mediaType = contentType.includes("jpeg") || contentType.includes("jpg")
      ? "image/jpeg"
      : contentType.includes("webp")
        ? "image/webp"
        : "image/png";

    const responseText = await generateText({
      maxTokens: 4096,
      image: {
        data: base64,
        mediaType: mediaType as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
      },
      prompt: `이 이미지(${w}x${h}px)에서 모든 텍스트 영역을 감지하세요.

각 텍스트 영역에 대해 다음 정보를 JSON 배열로 반환하세요:
- text: 텍스트 내용
- x: 왼쪽 위 X 좌표 (0~${w})
- y: 왼쪽 위 Y 좌표 (0~${h})
- width: 텍스트 영역 너비
- height: 텍스트 영역 높이
- fontSize: 추정 폰트 크기 (px)
- fontWeight: "normal" 또는 "bold"
- fill: 텍스트 색상 (hex, 예: "#ffffff")
- textAlign: "left", "center", 또는 "right"

배경, 도형, 로고 등은 무시하고 텍스트만 추출하세요.
좌표는 이미지 전체 크기(${w}x${h}) 기준 비율로 추정하세요.

반드시 아래 형식의 JSON만 출력하세요:
{ "texts": [ { "text": "...", "x": 0, "y": 0, "width": 0, "height": 0, "fontSize": 0, "fontWeight": "normal", "fill": "#000000", "textAlign": "center" } ] }`,
    });

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { success: false, error: "텍스트 영역을 감지할 수 없습니다." },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const elements = (parsed.texts || []).map(
      (t: {
        text: string;
        x: number;
        y: number;
        width: number;
        height: number;
        fontSize: number;
        fontWeight: string;
        fill: string;
        textAlign: string;
      }, i: number) => ({
        id: `extracted-text-${Date.now()}-${i}`,
        type: "text" as const,
        x: Math.round(t.x),
        y: Math.round(t.y),
        width: Math.round(t.width),
        height: Math.round(t.height),
        props: {
          text: t.text,
          fontSize: t.fontSize || 24,
          fontWeight: t.fontWeight || "normal",
          fill: t.fill || "#000000",
          textAlign: t.textAlign || "left",
        },
      })
    );

    return NextResponse.json({ success: true, elements });
  } catch (error) {
    console.error("[Extract] Error:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
