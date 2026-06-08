"use client";

import { useDesignStore } from "@/store/useDesignStore";
import { Trash2, Move, Type, Image, Square } from "lucide-react";

export default function PropertyPanel() {
  const {
    elements,
    selectedElementId,
    updateElement,
    removeElement,
    selectedImages,
  } = useDesignStore();

  const element = elements.find((el) => el.id === selectedElementId);

  if (!element) {
    return (
      <div className="w-64 bg-white border-l p-4 text-center text-gray-400 text-sm">
        <p className="mt-8">요소를 선택하여 편집하세요</p>
      </div>
    );
  }

  const updateProp = (key: string, value: unknown) => {
    updateElement(element.id, {
      props: { ...element.props, [key]: value },
    });
  };

  const typeIcon = {
    image: <Image className="w-4 h-4" />,
    text: <Type className="w-4 h-4" />,
    shape: <Square className="w-4 h-4" />,
    background: <Square className="w-4 h-4" />,
  };

  return (
    <div className="w-64 bg-white border-l overflow-y-auto">
      <div className="p-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          {typeIcon[element.type]}
          <span className="capitalize">{element.type}</span>
        </div>
        {element.type !== "background" && (
          <button
            onClick={() => removeElement(element.id)}
            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="p-3 space-y-3 text-sm">
        {element.type !== "background" && (
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-1">
              <Move className="w-3 h-3" /> 위치 & 크기
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-xs text-gray-400">X</span>
                <input
                  type="number"
                  value={element.x}
                  onChange={(e) =>
                    updateElement(element.id, { x: Number(e.target.value) })
                  }
                  className="w-full px-2 py-1 text-xs rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
              <div>
                <span className="text-xs text-gray-400">Y</span>
                <input
                  type="number"
                  value={element.y}
                  onChange={(e) =>
                    updateElement(element.id, { y: Number(e.target.value) })
                  }
                  className="w-full px-2 py-1 text-xs rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
              <div>
                <span className="text-xs text-gray-400">W</span>
                <input
                  type="number"
                  value={element.width}
                  onChange={(e) =>
                    updateElement(element.id, { width: Number(e.target.value) })
                  }
                  className="w-full px-2 py-1 text-xs rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
              <div>
                <span className="text-xs text-gray-400">H</span>
                <input
                  type="number"
                  value={element.height}
                  onChange={(e) =>
                    updateElement(element.id, {
                      height: Number(e.target.value),
                    })
                  }
                  className="w-full px-2 py-1 text-xs rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>
        )}

        {element.type === "background" && (
          <div>
            <label className="text-xs font-medium text-gray-500">배경색</label>
            <input
              type="color"
              value={(element.props.fill as string)?.startsWith("#") ? (element.props.fill as string) : "#ffffff"}
              onChange={(e) => updateProp("fill", e.target.value)}
              className="w-full h-8 rounded border border-gray-200 cursor-pointer"
            />
          </div>
        )}

        {element.type === "text" && (
          <>
            <div>
              <label className="text-xs font-medium text-gray-500">텍스트</label>
              <textarea
                value={(element.props.text as string) || ""}
                onChange={(e) => updateProp("text", e.target.value)}
                rows={3}
                className="w-full px-2 py-1 text-xs rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-400">크기</label>
                <input
                  type="number"
                  value={(element.props.fontSize as number) || 16}
                  onChange={(e) => updateProp("fontSize", Number(e.target.value))}
                  className="w-full px-2 py-1 text-xs rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">굵기</label>
                <select
                  value={(element.props.fontWeight as string) || "normal"}
                  onChange={(e) => updateProp("fontWeight", e.target.value)}
                  className="w-full px-2 py-1 text-xs rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="normal">일반</option>
                  <option value="bold">굵게</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400">텍스트 색상</label>
              <input
                type="color"
                value={(element.props.fill as string) || "#000000"}
                onChange={(e) => updateProp("fill", e.target.value)}
                className="w-full h-8 rounded border border-gray-200 cursor-pointer"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">정렬</label>
              <div className="flex gap-1">
                {(["left", "center", "right"] as const).map((align) => (
                  <button
                    key={align}
                    onClick={() => updateProp("textAlign", align)}
                    className={`flex-1 py-1 text-xs rounded ${
                      (element.props.textAlign || "left") === align
                        ? "bg-purple-100 text-purple-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {align === "left" ? "왼쪽" : align === "center" ? "가운데" : "오른쪽"}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {element.type === "image" && (
          <>
            {selectedImages.length > 0 && (
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">
                  선택된 이미지 적용
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {selectedImages.map((img) => (
                    <button
                      key={img.id}
                      onClick={() => updateProp("src", img.fullUrl)}
                      className="aspect-square rounded overflow-hidden border-2 border-transparent hover:border-purple-500"
                    >
                      <img
                        src={img.thumbnailUrl}
                        alt={img.name}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="text-xs text-gray-400">이미지 URL</label>
              <input
                type="text"
                value={(element.props.src as string) || ""}
                onChange={(e) => updateProp("src", e.target.value)}
                placeholder="이미지 URL을 입력하세요"
                className="w-full px-2 py-1 text-xs rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">맞춤</label>
              <select
                value={(element.props.objectFit as string) || "cover"}
                onChange={(e) => updateProp("objectFit", e.target.value)}
                className="w-full px-2 py-1 text-xs rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="cover">채우기</option>
                <option value="contain">맞추기</option>
              </select>
            </div>
          </>
        )}

        {element.type === "shape" && (
          <>
            <div>
              <label className="text-xs text-gray-400">배경색</label>
              <input
                type="color"
                value={(element.props.fill as string) || "#cccccc"}
                onChange={(e) => updateProp("fill", e.target.value)}
                className="w-full h-8 rounded border border-gray-200 cursor-pointer"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">텍스트</label>
              <input
                type="text"
                value={(element.props.text as string) || ""}
                onChange={(e) => updateProp("text", e.target.value)}
                className="w-full px-2 py-1 text-xs rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">모서리 둥글기</label>
              <input
                type="number"
                value={(element.props.borderRadius as number) || 0}
                onChange={(e) =>
                  updateProp("borderRadius", Number(e.target.value))
                }
                className="w-full px-2 py-1 text-xs rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
