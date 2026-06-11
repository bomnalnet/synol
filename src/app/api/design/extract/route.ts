import { NextRequest, NextResponse } from "next/server";
import { generateText } from "@/lib/llm";
import sharp from "sharp";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

// Sample border color of a region (edges only, avoids text in center)
async function sampleEdgeColor(
  sharpImg: sharp.Sharp,
  imgW: number,
  imgH: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): Promise<{ r: number; g: number; b: number }> {
  const EDGE = 4;
  const regions: Array<{ left: number; top: number; width: number; height: number }> = [];

  const left = Math.max(0, Math.round(rx));
  const top = Math.max(0, Math.round(ry));
  const right = Math.min(imgW, Math.round(rx + rw));
  const bottom = Math.min(imgH, Math.round(ry + rh));
  const w = right - left;
  const h = bottom - top;
  if (w < 1 || h < 1) return { r: 128, g: 128, b: 128 };

  // top edge
  if (top > 0) regions.push({ left, top: Math.max(0, top - EDGE), width: w, height: Math.min(EDGE, top) });
  // bottom edge
  if (bottom < imgH) regions.push({ left, top: bottom, width: w, height: Math.min(EDGE, imgH - bottom) });
  // left edge
  if (left > 0) regions.push({ left: Math.max(0, left - EDGE), top, width: Math.min(EDGE, left), height: h });
  // right edge
  if (right < imgW) regions.push({ left: right, top, width: Math.min(EDGE, imgW - right), height: h });

  if (regions.length === 0) {
    // fallback: sample center
    regions.push({ left, top, width: w, height: h });
  }

  let totalR = 0, totalG = 0, totalB = 0, count = 0;
  for (const reg of regions) {
    if (reg.width < 1 || reg.height < 1) continue;
    try {
      const pixel = await sharpImg.clone()
        .extract(reg)
        .resize(1, 1, { kernel: "lanczos3" })
        .raw()
        .toBuffer();
      totalR += pixel[0]; totalG += pixel[1]; totalB += pixel[2];
      count++;
    } catch { /* skip */ }
  }

  if (count === 0) return { r: 128, g: 128, b: 128 };
  return {
    r: Math.round(totalR / count),
    g: Math.round(totalG / count),
    b: Math.round(totalB / count),
  };
}

function toHex(c: { r: number; g: number; b: number }): string {
  return `#${c.r.toString(16).padStart(2, "0")}${c.g.toString(16).padStart(2, "0")}${c.b.toString(16).padStart(2, "0")}`;
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

    if (texts.length === 0) {
      return NextResponse.json({ success: true, elements: [], cleanBg: null });
    }

    const scaleX = imgW / w;
    const scaleY = imgH / h;
    const sharpImg = sharp(rawBuffer);

    // Build colored rectangles to erase text from background
    const overlays: sharp.OverlayOptions[] = [];

    for (const t of texts) {
      const left = Math.max(0, Math.round(t.x * scaleX));
      const top = Math.max(0, Math.round(t.y * scaleY));
      const rw = Math.max(1, Math.min(Math.round(t.width * scaleX), imgW - left));
      const rh = Math.max(1, Math.min(Math.round(t.height * scaleY), imgH - top));

      const edgeColor = await sampleEdgeColor(sharp(rawBuffer), imgW, imgH, left, top, rw, rh);

      // Create a filled rectangle SVG at this region's color
      const svg = Buffer.from(
        `<svg width="${rw}" height="${rh}"><rect width="${rw}" height="${rh}" fill="rgb(${edgeColor.r},${edgeColor.g},${edgeColor.b})"/></svg>`
      );
      overlays.push({ input: svg, left, top });
    }

    // Composite all rectangles onto the original image → cleaned background
    const cleanedBuffer = await sharp(rawBuffer)
      .composite(overlays)
      .png()
      .toBuffer();

    const cleanBgBase64 = `data:image/png;base64,${cleanedBuffer.toString("base64")}`;

    // Build text elements (no mask shapes needed — background is already clean)
    const ts = Date.now();
    const elements = texts.map((t, i) => ({
      id: `text-${ts}-${i}`,
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
    }));

    return NextResponse.json({ success: true, elements, cleanBg: cleanBgBase64 });
  } catch (error) {
    console.error("[Extract] Error:", error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
