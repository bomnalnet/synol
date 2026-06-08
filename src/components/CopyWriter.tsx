"use client";

import { useState } from "react";
import { PenLine, Loader2, Copy, Check } from "lucide-react";

interface CopyItem {
  headline: string;
  subheadline: string;
  body: string;
  cta: string;
  hashtags: string[];
}

const TONE_OPTIONS = [
  { value: "친근한", label: "친근한" },
  { value: "전문적인", label: "전문적" },
  { value: "유머러스한", label: "유머" },
  { value: "감성적인", label: "감성적" },
  { value: "긴급한", label: "긴급한" },
  { value: "고급스러운", label: "프리미엄" },
];

const PLATFORM_OPTIONS = [
  { value: "인스타그램", label: "인스타그램" },
  { value: "페이스북", label: "페이스북" },
  { value: "유튜브", label: "유튜브" },
  { value: "네이버 블로그", label: "블로그" },
  { value: "배너 광고", label: "배너" },
  { value: "포스터", label: "포스터" },
];

export default function CopyWriter() {
  const [purpose, setPurpose] = useState("");
  const [tone, setTone] = useState("친근한");
  const [keywords, setKeywords] = useState("");
  const [platform, setPlatform] = useState("인스타그램");
  const [existingCopy, setExistingCopy] = useState("");
  const [loading, setLoading] = useState(false);
  const [copies, setCopies] = useState<CopyItem[]>([]);
  const [tips, setTips] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const handleGenerate = async () => {
    if (!purpose.trim()) return;
    setLoading(true);
    setError("");
    setCopies([]);
    setTips([]);

    try {
      const res = await fetch("/api/copy/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose, tone, keywords, platform, existingCopy }),
      });

      const data = await res.json();

      if (data.success) {
        setCopies(data.copies || []);
        setTips(data.tips || []);
      } else {
        setError(data.error || "카피 생성에 실패했습니다.");
      }
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const formatCopy = (copy: CopyItem) =>
    `${copy.headline}\n${copy.subheadline}\n\n${copy.body}\n\n${copy.cta}\n\n${copy.hashtags.map((h) => `#${h}`).join(" ")}`;

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 space-y-3 flex-1 overflow-y-auto">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">광고 목적</label>
          <textarea
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="예: 여름 시즌 카페 신메뉴 프로모션"
            rows={2}
            className="w-full px-3 py-2 text-sm rounded-lg bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">톤앤매너</label>
          <div className="flex flex-wrap gap-1.5">
            {TONE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTone(opt.value)}
                className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                  tone === opt.value
                    ? "bg-purple-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">플랫폼</label>
          <div className="flex flex-wrap gap-1.5">
            {PLATFORM_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPlatform(opt.value)}
                className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                  platform === opt.value
                    ? "bg-purple-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">키워드 (선택)</label>
          <input
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="예: 할인, 여름, 시원한, 한정판"
            className="w-full px-3 py-2 text-sm rounded-lg bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">기존 카피 참고 (선택)</label>
          <textarea
            value={existingCopy}
            onChange={(e) => setExistingCopy(e.target.value)}
            placeholder="OCR로 추출한 기존 카피를 붙여넣으면 비슷한 스타일로 생성합니다"
            rows={2}
            className="w-full px-3 py-2 text-sm rounded-lg bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || !purpose.trim()}
          className="w-full py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              카피 생성 중...
            </>
          ) : (
            <>
              <PenLine className="w-4 h-4" />
              카피 생성
            </>
          )}
        </button>

        {error && (
          <div className="bg-red-50 text-red-600 px-3 py-2 rounded-lg text-xs">{error}</div>
        )}

        {copies.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500">생성된 카피 ({copies.length}개)</p>
            {copies.map((copy, i) => (
              <div
                key={i}
                className="bg-gray-50 rounded-lg p-3 space-y-1.5 border border-gray-100 hover:border-purple-200 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800">{copy.headline}</p>
                    <p className="text-xs text-gray-600">{copy.subheadline}</p>
                    <p className="text-xs text-gray-500 leading-relaxed">{copy.body}</p>
                    <p className="text-xs font-medium text-purple-600">{copy.cta}</p>
                    <div className="flex flex-wrap gap-1">
                      {copy.hashtags.map((tag, j) => (
                        <span key={j} className="text-[10px] text-blue-500">#{tag}</span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => copyToClipboard(formatCopy(copy), i)}
                    className="shrink-0 p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                    title="복사"
                  >
                    {copiedIdx === i ? (
                      <Check className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tips.length > 0 && (
          <div className="bg-purple-50 rounded-lg p-3 space-y-1">
            <p className="text-xs font-medium text-purple-700">활용 팁</p>
            {tips.map((tip, i) => (
              <p key={i} className="text-xs text-purple-600">- {tip}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
