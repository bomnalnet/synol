"use client";

import { useState } from "react";
import { useDesignStore } from "@/store/useDesignStore";
import { Sparkles, Loader2, Lightbulb } from "lucide-react";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

const STYLE_OPTIONS = [
  { value: "modern", label: "모던" },
  { value: "minimal", label: "미니멀" },
  { value: "bold", label: "임팩트" },
  { value: "elegant", label: "엘레강스" },
  { value: "playful", label: "플레이풀" },
  { value: "corporate", label: "비즈니스" },
];

const PROMPT_EXAMPLES = [
  "여름 세일 배너를 만들어주세요. 빨간색과 노란색 톤으로",
  "카페 신메뉴 홍보 인스타그램 포스트를 만들어주세요",
  "기업 PR용 깔끔한 배너 디자인을 만들어주세요",
  "크리스마스 이벤트 포스터를 만들어주세요",
];

export default function AIGenerator() {
  const {
    selectedImages,
    currentTemplate,
    setCurrentTemplate,
    setElements,
    isGenerating,
    setIsGenerating,
  } = useDesignStore();

  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("modern");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setError("");
    setSuggestions([]);

    try {
      const res = await fetch(`${BASE}/api/design/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          templateId: currentTemplate?.id,
          images: selectedImages.map((img) => img.fullUrl),
          style,
          width: currentTemplate?.width || 1080,
          height: currentTemplate?.height || 1080,
        }),
      });

      const data = await res.json();

      if (data.success && data.design) {
        if (!currentTemplate) {
          setCurrentTemplate({
            id: "ai-generated",
            name: "AI 생성 디자인",
            category: "AI",
            width: 1080,
            height: 1080,
            thumbnail: "",
            elements: [],
          });
        }
        setElements(data.design.elements || []);
        setSuggestions(data.design.suggestions || []);
      } else {
        setError(data.error || "디자인 생성에 실패했습니다.");
      }
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 space-y-3 flex-1 overflow-y-auto">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            디자인 설명
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="어떤 디자인을 만들고 싶은지 설명해주세요..."
            rows={4}
            className="w-full px-3 py-2 text-sm rounded-lg bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            스타일
          </label>
          <div className="flex flex-wrap gap-1.5">
            {STYLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStyle(opt.value)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  style === opt.value
                    ? "bg-purple-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs text-gray-500 space-y-1">
          {currentTemplate && (
            <p>
              템플릿: <span className="font-medium">{currentTemplate.name}</span>
            </p>
          )}
          {selectedImages.length > 0 && (
            <p>
              선택된 이미지: <span className="font-medium">{selectedImages.length}개</span>
            </p>
          )}
        </div>

        <button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className="w-full py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              AI 디자인 생성 중...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              디자인 생성
            </>
          )}
        </button>

        {error && (
          <div className="bg-red-50 text-red-600 px-3 py-2 rounded-lg text-xs">
            {error}
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="bg-purple-50 rounded-lg p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-purple-700 text-xs font-medium">
              <Lightbulb className="w-3.5 h-3.5" />
              AI 제안
            </div>
            {suggestions.map((s, i) => (
              <p key={i} className="text-xs text-purple-600">
                {s}
              </p>
            ))}
          </div>
        )}

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-gray-500">예시 프롬프트</p>
          {PROMPT_EXAMPLES.map((example, i) => (
            <button
              key={i}
              onClick={() => setPrompt(example)}
              className="block w-full text-left text-xs text-gray-500 hover:text-purple-600 bg-gray-50 hover:bg-purple-50 rounded-lg px-3 py-2 transition-colors"
            >
              &ldquo;{example}&rdquo;
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
