"use client";

import { useDesignStore } from "@/store/useDesignStore";
import ImageBrowser from "./ImageBrowser";
import TemplateGallery from "./TemplateGallery";
import AIGenerator from "./AIGenerator";
import ElementsPanel from "./ElementsPanel";
import { ImageIcon, LayoutTemplate, Sparkles, Layers, LogOut } from "lucide-react";

const TABS = [
  { id: "images" as const, label: "이미지", icon: ImageIcon },
  { id: "templates" as const, label: "템플릿", icon: LayoutTemplate },
  { id: "ai" as const, label: "AI 생성", icon: Sparkles },
  { id: "elements" as const, label: "요소", icon: Layers },
];

export default function Sidebar() {
  const { sidebarTab, setSidebarTab, setConnection } = useDesignStore();

  return (
    <div className="w-80 bg-white border-r flex flex-col h-full">
      <div className="flex border-b">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSidebarTab(tab.id)}
            className={`flex-1 py-3 flex flex-col items-center gap-1 text-xs transition-colors ${
              sidebarTab === tab.id
                ? "text-purple-600 border-b-2 border-purple-600 bg-purple-50"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {sidebarTab === "images" && <ImageBrowser />}
        {sidebarTab === "templates" && <TemplateGallery />}
        {sidebarTab === "ai" && <AIGenerator />}
        {sidebarTab === "elements" && <ElementsPanel />}
      </div>

      <div className="border-t p-2">
        <button
          onClick={() => setConnection(null)}
          className="w-full flex items-center justify-center gap-2 py-2 text-xs text-gray-400 hover:text-red-500 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          연결 해제
        </button>
      </div>
    </div>
  );
}
