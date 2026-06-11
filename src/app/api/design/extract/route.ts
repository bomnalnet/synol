import { NextRequest, NextResponse } from "next/server";
import { generateText } from "@/lib/llm";
import sharp from "sharp";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

// Sample median color from a region of the image buffer
async function sampleRegionColor(
  imgBuffer: Buffer,
  imgW: number,
  imgH: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): Promise<string> {
  try {
    const left = Math.max(0, Math.round(rx));
    const top = Math.max(0, Math.round(ry));
    const width = Math.max(1, Math.min(Math.round(rw), imgW - left));
    const height = Math.max(1, Math.min(Math.round(rh), imgH - top));

    const region = await sharp(imgBuffer)
      .extract({ left, top, width, height })
      .resize(1, 1, { kernel: "lanczos3" }) // downsample to single pixel = average color
      .raw()
      .toBuffer();

    const r = region[0];
    const g = region[1];
    const b = region[2];
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  } catch {
    return "transparent";
  }
}

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

    // Get actual image dimensions for accurate pixel sampling
    const meta = await sharp(rawBuffer).metadata();
    const imgW = meta.width || w;
    const imgH = meta.height || h;

    // Normalize to raw RGBA for color sampling
    const rgbaBuffer = await sharp(rawBuffer).ensureAlpha().raw().toBuffer();

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
    const ts = Date.now();

    const elements: Array<{
      id: string;
      type: "shape" | "text";
      x: number; y: number; width: number; height: number;
      props: Record<string, unknown>;
    }> = [];

    // Scale factor: AI coordinates are in canvas space (w x h), image is imgW x imgH
    const scaleX = imgW / w;
    const scaleY = imgH / h;

    for (let i = 0; i < (parsed.texts || []).length; i++) {
      const t = parsed.texts[i] as {
        text: string; x: number; y: number; width: number; height: number;
        fontSize: number; fontWeight: string; fill: string; textAlign: string;
      };

      const x = Math.round(t.x);
      const y = Math.round(t.y);
      const width = Math.round(t.width);
      const height = Math.round(t.height);

      // Sample actual pixel color from image at this region
      const bgColor = await sampleRegionColor(
        rgbaBuffer,
        imgW, imgH,
        x * scaleX, y * scaleY,
        width * scaleX, height * scaleY
      );

      if (bgColor !== "transparent") {
        elements.push({
          id: `mask-${ts}-${i}`,
          type: "shape",
          x, y, width, height,
          props: { fill: bgColor, borderRadius: 0 },
        });
      }

      elements.push({
        id: `text-${ts}-${i}`,
        type: "text",
        x, y, width, height,
        props: {
          text: t.text,
          fontSize: t.fontSize || 24,
          fontWeight: t.fontWeight || "normal",
          fill: t.fill || "#000000",
          textAlign: t.textAlign || "left",
        },
      });
    }

    return NextResponse.json({ success: true, elements });
  } catch (error) {
    console.error("[Extract] Error:", error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
