"use client";

import { useState } from "react";
import { useDesignStore } from "@/store/useDesignStore";
import { DESIGN_TEMPLATES, getCategories } from "@/lib/templates";
import type { DesignTemplate } from "@/types";
import { LayoutGrid } from "lucide-react";

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
  const { setCurrentTemplate } = useDesignStore();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const categories = getCategories();

  const filtered = selectedCategory
    ? DESIGN_TEMPLATES.filter((t) => t.category === selectedCategory)
    : DESIGN_TEMPLATES;

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 space-y-2">
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
              className="text-left group"
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
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
