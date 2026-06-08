"use client";

import { useDesignStore } from "@/store/useDesignStore";
import { Type, Image, Square, Plus, GripVertical, Trash2 } from "lucide-react";

export default function ElementsPanel() {
  const {
    elements,
    addElement,
    removeElement,
    selectedElementId,
    setSelectedElementId,
    currentTemplate,
  } = useDesignStore();

  const addText = () => {
    addElement({
      id: `text-${Date.now()}`,
      type: "text",
      x: 100,
      y: 100,
      width: 400,
      height: 60,
      props: {
        text: "새 텍스트",
        fontSize: 32,
        fontWeight: "normal",
        fill: "#1a1a1a",
      },
    });
  };

  const addImage = () => {
    addElement({
      id: `image-${Date.now()}`,
      type: "image",
      x: 100,
      y: 100,
      width: 300,
      height: 300,
      props: { placeholder: true },
    });
  };

  const addShape = () => {
    addElement({
      id: `shape-${Date.now()}`,
      type: "shape",
      x: 100,
      y: 100,
      width: 200,
      height: 50,
      props: {
        shapeType: "rect",
        fill: "#7c3aed",
        borderRadius: 8,
        text: "버튼",
        textFill: "#ffffff",
        fontSize: 16,
      },
    });
  };

  const typeIcon = {
    image: <Image className="w-3.5 h-3.5" />,
    text: <Type className="w-3.5 h-3.5" />,
    shape: <Square className="w-3.5 h-3.5" />,
    background: <Square className="w-3.5 h-3.5" />,
  };

  const typeLabel = {
    image: "이미지",
    text: "텍스트",
    shape: "도형",
    background: "배경",
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b">
        <p className="text-xs font-medium text-gray-500 mb-2">요소 추가</p>
        <div className="flex gap-2">
          <button
            onClick={addText}
            disabled={!currentTemplate}
            className="flex-1 flex flex-col items-center gap-1 py-2 rounded-lg bg-gray-50 hover:bg-purple-50 hover:text-purple-600 text-gray-600 text-xs transition-colors disabled:opacity-50"
          >
            <Type className="w-5 h-5" />
            텍스트
          </button>
          <button
            onClick={addImage}
            disabled={!currentTemplate}
            className="flex-1 flex flex-col items-center gap-1 py-2 rounded-lg bg-gray-50 hover:bg-purple-50 hover:text-purple-600 text-gray-600 text-xs transition-colors disabled:opacity-50"
          >
            <Image className="w-5 h-5" />
            이미지
          </button>
          <button
            onClick={addShape}
            disabled={!currentTemplate}
            className="flex-1 flex flex-col items-center gap-1 py-2 rounded-lg bg-gray-50 hover:bg-purple-50 hover:text-purple-600 text-gray-600 text-xs transition-colors disabled:opacity-50"
          >
            <Square className="w-5 h-5" />
            도형
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <p className="text-xs font-medium text-gray-500 mb-2">레이어</p>
        {elements.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">
            템플릿을 선택하면 요소가 표시됩니다
          </p>
        ) : (
          <div className="space-y-1">
            {[...elements].reverse().map((el) => (
              <div
                key={el.id}
                onClick={() => setSelectedElementId(el.id)}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                  selectedElementId === el.id
                    ? "bg-purple-100 text-purple-700"
                    : "hover:bg-gray-50 text-gray-600"
                }`}
              >
                <GripVertical className="w-3 h-3 text-gray-300" />
                {typeIcon[el.type]}
                <span className="flex-1 truncate">
                  {el.type === "text"
                    ? (el.props.text as string) || "텍스트"
                    : typeLabel[el.type]}
                </span>
                {el.type !== "background" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeElement(el.id);
                    }}
                    className="p-0.5 text-gray-300 hover:text-red-500"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-3 border-t">
        <button
          onClick={addText}
          disabled={!currentTemplate}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-purple-50 text-purple-600 text-xs hover:bg-purple-100 transition-colors disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" />
          요소 추가
        </button>
      </div>
    </div>
  );
}
