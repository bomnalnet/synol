"use client";

import { useState, useEffect, useCallback } from "react";
import { useDesignStore } from "@/store/useDesignStore";
import { DESIGN_TEMPLATES } from "@/lib/templates";
import type { DesignTemplate } from "@/types";
import { LayoutGrid, Save, Trash2, Loader2, ScanText } from "lucide-react";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

function TemplateThumbnail({ template }: { template: DesignTemplate }) {
  const aspect = template.width / template.height;
  const bgEl = template.elements.find((e) => e.type === "background");
  const bgFill = (bgEl?.props?.fill as string) || "#f3f4f6";

  return (
    <div
      className="w-full rounded-lg overflow-hidden border border-gray-200"
      style={{ aspectRatio: aspect, background: bgFill }}
    >
      <div className="w-full h-full relative p-[8%]">
        {template.elements
          .filter((e) => e.type !== "background")
          .map((el) => {
            const left = `${(el.x / template.width) * 100}%`;
            const top = `${(el.y / template.height) * 100}%`;
            const width = `${(el.width / template.width) * 100}%`;
            const height = `${(el.height / template.height) * 100}%`;

            if (el.type === "image") {
              return (
                <div
                  key={el.id}
                  className="absolute bg-gray-300/50 rounded flex items-center justify-center"
                  style={{ left, top, width, height }}
                >
                  <LayoutGrid className="w-1/4 h-1/4 text-gray-400" />
                </div>
              );
            }
            if (el.type === "text") {
              return (
                <div
                  key={el.id}
                  className="absolute rounded"
                  style={{
                    left,
                    top,
                    width,
                    height,
                    backgroundColor: "rgba(0,0,0,0.08)",
                  }}
                />
              );
            }
            if (el.type === "shape") {
              return (
                <div
                  key={el.id}
                  className="absolute rounded"
                  style={{
                    left,
                    top,
                    width,
                    height,
                    backgroundColor: (el.props?.fill as string) || "#ccc",
                    borderRadius: el.props?.borderRadius
                      ? `${el.props.borderRadius}px`
                      : undefined,
                  }}
                />
              );
            }
            return null;
          })}
      </div>
    </div>
  );
}

export default function TemplateGallery() {
  const { setCurrentTemplate, currentTemplate, elements, isAdmin, setElements, addElement } = useDesignStore();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [customTemplates, setCustomTemplates] = useState<DesignTemplate[]>([]);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [hiddenBuiltins, setHiddenBuiltins] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem("hidden-templates") || "[]");
    } catch {
      return [];
    }
  });

  const fetchCustomTemplates = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/templates`);
      const data = await res.json();
      if (data.success) {
        setCustomTemplates(data.templates);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchCustomTemplates();
  }, [fetchCustomTemplates]);

  const visibleBuiltins = DESIGN_TEMPLATES.filter((t) => !hiddenBuiltins.includes(t.id));
  const allTemplates = [...visibleBuiltins, ...customTemplates];
  const categories = [...new Set(allTemplates.map((t) => t.category))];

  const filtered = selectedCategory
    ? allTemplates.filter((t) => t.category === selectedCategory)
    : allTemplates;

  const handleSave = async () => {
    if (!currentTemplate || elements.length === 0) return;
    const name = window.prompt("템플릿 이름을 입력하세요");
    if (!name?.trim()) return;

    setSaving(true);
    try {
      const res = await fetch(`${BASE}/api/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          width: currentTemplate.width,
          height: currentTemplate.height,
          elements,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchCustomTemplates();
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const hasImageElement = currentTemplate && elements.some(
    (el) => el.type === "image"
  );

  const handleExtract = async () => {
    if (!currentTemplate || !hasImageElement) return;
    const imageEl = elements.find((el) => el.type === "image" && el.props.src);
    if (!imageEl) return;

    setExtracting(true);
    try {
      const res = await fetch(`${BASE}/api/design/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: imageEl.props.src,
          canvasWidth: currentTemplate.width,
          canvasHeight: currentTemplate.height,
        }),
      });
      const data = await res.json();
      if (data.success && data.elements?.length > 0) {
        for (const el of data.elements) {
          addElement(el);
        }
      } else {
        alert(data.error || "텍스트를 감지할 수 없습니다.");
      }
    } catch {
      alert("요소 변환에 실패했습니다.");
    } finally {
      setExtracting(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, template: DesignTemplate) => {
    e.stopPropagation();
    if (!confirm(`"${template.name}" 템플릿을 삭제하시겠습니까?`)) return;

    if (template.id.startsWith("custom-")) {
      try {
        const res = await fetch(`${BASE}/api/templates/${template.id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
          setCustomTemplates((prev) => prev.filter((t) => t.id !== template.id));
        }
      } catch {
        // ignore
      }
    } else {
      setHiddenBuiltins((prev) => [...prev, template.id]);
      localStorage.setItem(
        "hidden-templates",
        JSON.stringify([...hiddenBuiltins, template.id])
      );
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 space-y-2">
        {hasImageElement && (
          <button
            onClick={handleExtract}
            disabled={extracting}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanText className="w-4 h-4" />}
            {extracting ? "텍스트 감지 중..." : "이미지에서 텍스트 요소 추출"}
          </button>
        )}
        {isAdmin && elements.length > 0 && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            현재 디자인을 템플릿으로 저장
          </button>
        )}

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              !selectedCategory
                ? "bg-purple-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            전체
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                selectedCategory === cat
                  ? "bg-purple-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((template) => (
            <button
              key={template.id}
              onClick={() => setCurrentTemplate(template)}
              className="text-left group relative"
            >
              <div className="transition-transform group-hover:scale-[1.02]">
                <TemplateThumbnail template={template} />
              </div>
              <p className="text-xs font-medium text-gray-700 mt-1.5">
                {template.name}
              </p>
              <p className="text-xs text-gray-400">
                {template.width}x{template.height}
              </p>
              {isAdmin && (
                <button
                  onClick={(e) => handleDelete(e, template)}
                  className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
