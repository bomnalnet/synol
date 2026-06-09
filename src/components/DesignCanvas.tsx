"use client";

import { useRef, useState, useEffect } from "react";
import { useDesignStore } from "@/store/useDesignStore";
import type { TemplateElement } from "@/types";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

function CanvasElement({
  element,
  scale,
  isSelected,
  onSelect,
  onDragEnd,
}: {
  element: TemplateElement;
  scale: number;
  isSelected: boolean;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, elX: 0, elY: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (element.type === "background") return;
    e.stopPropagation();
    onSelect();
    setDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      elX: element.x,
      elY: element.y,
    };
  };

  const handleClick = (e: React.MouseEvent) => {
    if (element.type === "background") return;
    e.stopPropagation();
  };

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = (e.clientX - dragStart.current.x) / scale;
      const dy = (e.clientY - dragStart.current.y) / scale;
      onDragEnd(dragStart.current.elX + dx, dragStart.current.elY + dy);
    };

    const handleMouseUp = () => setDragging(false);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, scale, onDragEnd]);

  const style: React.CSSProperties = {
    position: element.type === "background" ? "relative" : "absolute",
    left: element.type === "background" ? 0 : element.x * scale,
    top: element.type === "background" ? 0 : element.y * scale,
    width: element.width * scale,
    height: element.height * scale,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    cursor: element.type === "background" ? "default" : "move",
    outline: isSelected ? "2px solid #7c3aed" : "none",
    outlineOffset: "1px",
  };

  if (element.type === "background") {
    const fill = element.props.fill as string;
    return (
      <div
        style={{
          ...style,
          background: fill,
        }}
      />
    );
  }

  if (element.type === "image") {
    const src = element.props.src as string | undefined;
    const borderRadius = element.props.borderRadius as number | undefined;

    return (
      <div
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        style={{
          ...style,
          borderRadius: borderRadius ? borderRadius * scale : undefined,
          overflow: "hidden",
        }}
      >
        {src ? (
          <img
            src={src}
            alt=""
            className="w-full h-full"
            style={{
              objectFit: (element.props.objectFit as string) === "contain" ? "contain" : "cover",
            }}
            draggable={false}
          />
        ) : (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <div className="text-2xl mb-1">+</div>
              <span style={{ fontSize: 10 * scale }}>이미지를 드래그하세요</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (element.type === "text") {
    return (
      <div
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        style={{
          ...style,
          color: (element.props.fill as string) || "#000",
          fontSize: ((element.props.fontSize as number) || 16) * scale,
          fontWeight: (element.props.fontWeight as string) || "normal",
          textAlign: (element.props.textAlign as React.CSSProperties["textAlign"]) || "left",
          lineHeight: (element.props.lineHeight as number) || 1.4,
          WebkitTextStroke: element.props.stroke
            ? `${((element.props.strokeWidth as number) || 1) * scale}px ${element.props.stroke}`
            : undefined,
          display: "flex",
          alignItems: "flex-start",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          overflow: "hidden",
        }}
      >
        {(element.props.text as string) || "텍스트"}
      </div>
    );
  }

  if (element.type === "shape") {
    const borderRadius = element.props.borderRadius as number | undefined;

    return (
      <div
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        style={{
          ...style,
          backgroundColor: (element.props.fill as string) || "#ccc",
          borderRadius: borderRadius ? borderRadius * scale : undefined,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: (element.props.textFill as string) || "#fff",
          fontSize: ((element.props.fontSize as number) || 16) * scale,
          fontWeight: (element.props.fontWeight as string) || "normal",
        }}
      >
        {element.props.text as string}
      </div>
    );
  }

  return null;
}

export default function DesignCanvas() {
  const {
    currentTemplate,
    elements,
    selectedElementId,
    setSelectedElementId,
    updateElement,
  } = useDesignStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);

  const canvasWidth = currentTemplate?.width || 1080;
  const canvasHeight = currentTemplate?.height || 1080;

  const fitToView = () => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    const padding = 80;
    const scaleX = (clientWidth - padding) / canvasWidth;
    const scaleY = (clientHeight - padding) / canvasHeight;
    setScale(Math.min(scaleX, scaleY, 1));
  };

  useEffect(() => {
    fitToView();
  }, [currentTemplate]);

  if (!currentTemplate) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-100">
        <div className="text-center text-gray-400">
          <div className="text-6xl mb-4">🎨</div>
          <h2 className="text-xl font-medium mb-2">디자인을 시작하세요</h2>
          <p className="text-sm">
            왼쪽에서 템플릿을 선택하거나 AI에게 디자인을 요청하세요
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-100">
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b">
        <span className="text-sm text-gray-600">
          {currentTemplate.name} ({canvasWidth}x{canvasHeight})
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setScale((s) => Math.max(0.1, s - 0.1))}
            className="p-1.5 rounded hover:bg-gray-100"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-gray-500 w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(2, s + 0.1))}
            className="p-1.5 rounded hover:bg-gray-100"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={fitToView}
            className="p-1.5 rounded hover:bg-gray-100"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex items-center justify-center p-10"
        onClick={() => setSelectedElementId(null)}
      >
        <div
          className="relative bg-white shadow-2xl"
          style={{
            width: canvasWidth * scale,
            height: canvasHeight * scale,
          }}
        >
          {elements.map((element) => (
            <CanvasElement
              key={element.id}
              element={element}
              scale={scale}
              isSelected={selectedElementId === element.id}
              onSelect={() => setSelectedElementId(element.id)}
              onDragEnd={(x, y) =>
                updateElement(element.id, { x: Math.round(x), y: Math.round(y) })
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
