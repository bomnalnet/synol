"use client";

import { useState, useEffect, useCallback } from "react";
import { useDesignStore } from "@/store/useDesignStore";
import {
  Search,
  FolderOpen,
  Folder,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  ImageIcon,
  RefreshCw,
} from "lucide-react";
import type { ImageAsset } from "@/types";

interface FolderItem {
  id: string;
  path: string;
  name: string;
  isFolder: true;
}

export default function ImageBrowser() {
  const {
    connection,
    images,
    setImages,
    selectedImages,
    toggleImageSelection,
  } = useDesignStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [folderPath, setFolderPath] = useState("/photo");
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [error, setError] = useState("");

  const loadContents = useCallback(async (path: string) => {
    if (!connection) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        url: connection.url,
        sid: connection.sid,
        path,
      });
      const res = await fetch(`/api/synology/list?${params}`);
      const data = await res.json();
      if (data.success) {
        setFolders(data.folders || []);
        setImages(data.assets || []);
      } else {
        setError(data.error || "파일 목록을 불러올 수 없습니다.");
      }
    } catch {
      setError("서버 연결 오류");
    } finally {
      setLoading(false);
    }
  }, [connection, setImages]);

  useEffect(() => {
    loadContents(folderPath);
  }, [folderPath, loadContents]);

  const handleSearch = async () => {
    if (!connection || !searchQuery.trim()) return;
    setSearching(true);
    try {
      const params = new URLSearchParams({
        url: connection.url,
        sid: connection.sid,
        path: folderPath,
        q: searchQuery,
      });
      const res = await fetch(`/api/synology/search?${params}`);
      const data = await res.json();
      if (data.success) {
        setFolders([]);
        setImages(data.assets);
      }
    } catch {
      // silently fail
    } finally {
      setSearching(false);
    }
  };

  const navigateTo = (path: string) => {
    setFolderPath(path);
  };

  const goUp = () => {
    if (folderPath === "/") return;
    const parts = folderPath.split("/").filter(Boolean);
    parts.pop();
    navigateTo(parts.length === 0 ? "/" : "/" + parts.join("/"));
  };

  const isSelected = (image: ImageAsset) =>
    selectedImages.some((i) => i.id === image.id);

  const breadcrumbs = folderPath.split("/").filter(Boolean);

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="이미지 검색..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-gray-100 border-none focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching}
            className="px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : "검색"}
          </button>
        </div>

        <div className="flex items-center gap-1 text-xs text-gray-500 overflow-x-auto">
          {folderPath !== "/" && (
            <button
              onClick={goUp}
              className="hover:text-purple-600 shrink-0 p-0.5"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => navigateTo("/")}
            className="hover:text-purple-600 shrink-0"
          >
            <FolderOpen className="w-3.5 h-3.5" />
          </button>
          {breadcrumbs.map((part, i) => (
            <span key={i} className="flex items-center gap-1 shrink-0">
              <ChevronRight className="w-3 h-3" />
              <button
                onClick={() =>
                  navigateTo("/" + breadcrumbs.slice(0, i + 1).join("/"))
                }
                className="hover:text-purple-600"
              >
                {part}
              </button>
            </span>
          ))}
          <button
            onClick={() => loadContents(folderPath)}
            className="ml-auto shrink-0 hover:text-purple-600"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {selectedImages.length > 0 && (
          <div className="text-xs text-purple-600 font-medium">
            {selectedImages.length}개 이미지 선택됨
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-sm text-red-500">{error}</p>
            <button
              onClick={() => loadContents(folderPath)}
              className="mt-2 text-xs text-purple-600 hover:underline"
            >
              다시 시도
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {folders.length > 0 && (
              <div className="space-y-1">
                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => navigateTo(folder.path)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-purple-50 text-left transition-colors"
                  >
                    <Folder className="w-5 h-5 text-yellow-500 shrink-0" />
                    <span className="text-sm text-gray-700 truncate">{folder.name}</span>
                  </button>
                ))}
              </div>
            )}

            {images.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {images.map((image) => (
                  <button
                    key={image.id}
                    onClick={() => toggleImageSelection(image)}
                    className={`relative group aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                      isSelected(image)
                        ? "border-purple-600 ring-2 ring-purple-200"
                        : "border-transparent hover:border-gray-300"
                    }`}
                  >
                    <img
                      src={image.thumbnailUrl}
                      alt={image.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                    {isSelected(image) && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                      <p className="text-white text-xs truncate">{image.name}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : folders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <ImageIcon className="w-12 h-12 mb-2" />
                <p className="text-sm">이미지가 없습니다</p>
                <p className="text-xs mt-1">다른 폴더를 탐색해보세요</p>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
