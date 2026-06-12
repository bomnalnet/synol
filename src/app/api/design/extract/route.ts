import { NextRequest, NextResponse } from "next/server";
import { generateText } from "@/lib/llm";
import sharp from "sharp";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export async function POST(request: NextRequest) {
  const { imageUrl, canvasWidth, canvasHeight } = await request.json();

  if (!imageUrl) {
    return NextResponse.json({ success: false, error: "이미지 URL이 필요합니다." }, { status: 400 });
  }

  const w = canvasWidth || 1080;
  const h = canvasHeight || 1080;

  try {
    const fullUrl = imageUrl.startsWith("http")
      ? imageUrl
      : `http://localhost:${process.env.PORT || 3000}${imageUrl.startsWith(BASE) ? imageUrl : BASE + imageUrl}`;

    const res = await fetch(fullUrl);
    if (!res.ok) {
      return NextResponse.json({ success: false, error: "이미지 다운로드 실패" }, { status: 500 });
    }

    const rawBuffer = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(rawBuffer).metadata();
    const imgW = meta.width || w;
    const imgH = meta.height || h;

    const contentType = res.headers.get("content-type") || "image/png";
    const mediaType = (
      contentType.includes("jpeg") || contentType.includes("jpg") ? "image/jpeg"
      : contentType.includes("webp") ? "image/webp"
      : "image/png"
    ) as "image/png" | "image/jpeg" | "image/webp";

    const base64 = rawBuffer.toString("base64");

    const responseText = await generateText({
      maxTokens: 4096,
      image: { data: base64, mediaType },
      prompt: `이 이미지(${w}x${h}px)에서 모든 텍스트 영역을 감지하세요.

텍스트 영역의 좌표는 반드시 텍스트가 차지하는 정확한 바운딩 박스로 잡으세요.
여백 없이 텍스트에 딱 맞게 잡아야 합니다.

각 텍스트 영역에 대해 다음 정보를 JSON 배열로 반환하세요:
- text: 텍스트 내용
- x: 왼쪽 위 X 좌표 (0~${w}, 픽셀)
- y: 왼쪽 위 Y 좌표 (0~${h}, 픽셀)
- width: 텍스트 영역 너비 (픽셀)
- height: 텍스트 영역 높이 (픽셀)
- fontSize: 추정 폰트 크기 (px)
- fontWeight: "normal" 또는 "bold"
- fill: 텍스트 색상 (hex)
- textAlign: "left", "center", 또는 "right"

배경, 도형, 로고 등은 무시하고 텍스트만 추출하세요.
반드시 아래 형식의 JSON만 출력하세요:
{ "texts": [ { "text": "...", "x": 0, "y": 0, "width": 0, "height": 0, "fontSize": 0, "fontWeight": "normal", "fill": "#000000", "textAlign": "center" } ] }`,
    });

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ success: false, error: "텍스트 영역을 감지할 수 없습니다." }, { status: 500 });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const texts = (parsed.texts || []) as Array<{
      text: string; x: number; y: number; width: number; height: number;
      fontSize: number; fontWeight: string; fill: string; textAlign: string;
    }>;

    const scaleX = imgW / w;
    const scaleY = imgH / h;
    const ts = Date.now();

    const elements = await Promise.all(
      texts.map(async (t, i) => {
        const x = Math.round(t.x);
        const y = Math.round(t.y);
        const width = Math.round(t.width);
        const height = Math.round(t.height);

        // Crop this region from original image → base64 data URL
        const left = Math.max(0, Math.round(x * scaleX));
        const top = Math.max(0, Math.round(y * scaleY));
        const rw = Math.max(1, Math.min(Math.round(width * scaleX), imgW - left));
        const rh = Math.max(1, Math.min(Math.round(height * scaleY), imgH - top));

        let bgImage = "";
        try {
          const crop = await sharp(rawBuffer)
            .extract({ left, top, width: rw, height: rh })
            .png()
            .toBuffer();
          bgImage = `data:image/png;base64,${crop.toString("base64")}`;
        } catch { /* fallback: no bg image */ }

        return {
          id: `text-${ts}-${i}`,
          type: "text" as const,
          x, y, width, height,
          props: {
            text: t.text,
            fontSize: t.fontSize || 24,
            fontWeight: t.fontWeight || "normal",
            fill: t.fill || "#000000",
            textAlign: t.textAlign || "left",
            bgImage,
          },
        };
      })
    );

    return NextResponse.json({ success: true, elements });
  } catch (error) {
    console.error("[Extract] Error:", error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
