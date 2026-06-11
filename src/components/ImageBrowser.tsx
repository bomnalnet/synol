"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  ScanText,
  FileText,
} from "lucide-react";
import type { ImageAsset } from "@/types";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

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
    isAdmin,
  } = useDesignStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [folderPath, setFolderPath] = useState("/photo");
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [error, setError] = useState("");

  const [ocrJobId, setOcrJobId] = useState<string | null>(null);
  const [ocrProgress, setOcrProgress] = useState({ total: 0, done: 0, current: "" });
  const [ocrMode, setOcrMode] = useState(false);
  const [searchAnd, setSearchAnd] = useState(true);
  const [hoveredOcr, setHoveredOcr] = useState<string | null>(null);
  const [ocrStatusMap, setOcrStatusMap] = useState<Record<string, string>>({});
  const [unprocessedCount, setUnprocessedCount] = useState(0);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // File index state
  const [indexCount, setIndexCount] = useState(0);
  const [indexJobId, setIndexJobId] = useState<string | null>(null);
  const [indexBuilding, setIndexBuilding] = useState(false);
  const indexPollRef = useRef<NodeJS.Timeout | null>(null);

  // AbortController for cancellable search
  const searchAbortRef = useRef<AbortController | null>(null);

  const [openingCanvas, setOpeningCanvas] = useState(false);

  const checkOcrStatus = useCallback(async (assets: ImageAsset[]) => {
    if (assets.length === 0) return;
    try {
      const res = await fetch(`${BASE}/api/ocr/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePaths: assets.map((a) => a.path) }),
      });
      const data = await res.json();
      if (data.success) {
        const map: Record<string, string> = {};
        for (const item of data.processed) {
          map[item.path] = item.ocrText;
        }
        setOcrStatusMap(map);
        setUnprocessedCount(data.unprocessedCount);
      }
    } catch {
      // ignore
    }
  }, []);

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
      const res = await fetch(`${BASE}/api/synology/list?${params}`);
      const data = await res.json();
      if (data.success) {
        setFolders(data.folders || []);
        setImages(data.assets || []);
        checkOcrStatus(data.assets || []);
      } else {
        setError(data.error || "파일 목록을 불러올 수 없습니다.");
      }
    } catch {
      setError("서버 연결 오류");
    } finally {
      setLoading(false);
    }
  }, [connection, setImages, checkOcrStatus]);

  useEffect(() => {
    loadContents(folderPath);
  }, [folderPath, loadContents]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (indexPollRef.current) clearInterval(indexPollRef.current);
    };
  }, []);

  // Load index count on connect
  useEffect(() => {
    if (!connection) return;
    fetch(`${BASE}/api/index/build?url=${encodeURIComponent(connection.url)}`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setIndexCount(d.count); })
      .catch(() => {});
  }, [connection]);

  const openImageOnCanvas = async (imgs: ImageAsset[]) => {
    if (imgs.length === 0) return;
    const { setCurrentTemplate, setElements } = useDesignStore.getState();
    const CANVAS_W = 1080;
    const CANVAS_H = 1080;

    if (imgs.length === 1) {
      // 단일 이미지: AI 텍스트 추출
      const img = imgs[0];
      const baseElements = [
        { id: "bg", type: "background" as const, x: 0, y: 0, width: CANVAS_W, height: CANVAS_H, props: { fill: "#ffffff" } },
        { id: "img-0", type: "image" as const, x: 0, y: 0, width: CANVAS_W, height: CANVAS_H, props: { src: img.fullUrl, objectFit: "cover" } },
      ];
      setCurrentTemplate({ id: "from-image", name: img.name, category: "이미지", width: CANVAS_W, height: CANVAS_H, thumbnail: "", elements: baseElements });

      setOpeningCanvas(true);
      try {
        const res = await fetch(`${BASE}/api/design/extract`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: img.fullUrl, canvasWidth: CANVAS_W, canvasHeight: CANVAS_H }),
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.elements) && data.elements.length > 0) {
          setElements([...baseElements, ...data.elements]);
        }
      } catch { /* 이미지는 이미 열려있음 */ }
      finally { setOpeningCanvas(false); }

    } else {
      // 다중 이미지: 그리드 레이아웃 (최대 9개)
      const count = Math.min(imgs.length, 9);
      const cols = count <= 2 ? count : count <= 4 ? 2 : 3;
      const rows = Math.ceil(count / cols);
      const cellW = Math.floor(CANVAS_W / cols);
      const cellH = Math.floor(CANVAS_H / rows);

      const baseElements = [
        { id: "bg", type: "background" as const, x: 0, y: 0, width: CANVAS_W, height: CANVAS_H, props: { fill: "#000000" } },
        ...imgs.slice(0, count).map((img, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          return {
            id: `img-${i}`,
            type: "image" as const,
            x: col * cellW + 2,
            y: row * cellH + 2,
            width: cellW - 4,
            height: cellH - 4,
            props: { src: img.fullUrl, objectFit: "cover" },
          };
        }),
      ];

      setCurrentTemplate({
        id: "from-images",
        name: `이미지 ${count}개`,
        category: "이미지",
        width: CANVAS_W,
        height: CANVAS_H,
        thumbnail: "",
        elements: baseElements,
      });
    }
  };

  const cancelIndexBuild = () => {
    if (indexPollRef.current) clearInterval(indexPollRef.current);
    indexPollRef.current = null;
    setIndexJobId(null);
    setIndexBuilding(false);
  };

  const startIndexBuild = async () => {
    if (!connection) return;
    if (indexBuilding) {
      cancelIndexBuild();
      return;
    }
    setIndexBuilding(true);
    try {
      const res = await fetch(`${BASE}/api/index/build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nasUrl: connection.url, sid: connection.sid }),
      });
      const data = await res.json();
      if (data.success && data.jobId) {
        setIndexJobId(data.jobId);
        indexPollRef.current = setInterval(async () => {
          const s = await fetch(`${BASE}/api/index/build?jobId=${data.jobId}`).then((r) => r.json());
          if (s.done) {
            if (indexPollRef.current) clearInterval(indexPollRef.current);
            indexPollRef.current = null;
            setIndexJobId(null);
            setIndexBuilding(false);
            const c = await fetch(`${BASE}/api/index/build?url=${encodeURIComponent(connection.url)}`).then((r) => r.json());
            if (c.success) setIndexCount(c.count);
          }
        }, 2000);
      }
    } catch {
      setIndexBuilding(false);
    }
  };

  const cancelSearch = () => {
    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
      searchAbortRef.current = null;
    }
    setSearching(false);
  };

  const handleSearch = async () => {
    if (!connection || !searchQuery.trim()) return;

    if (searching) {
      cancelSearch();
      return;
    }

    searchAbortRef.current = new AbortController();
    const signal = searchAbortRef.current.signal;
    setSearching(true);

    try {
      if (ocrMode) {
        const params = new URLSearchParams({
          url: connection.url,
          sid: connection.sid,
          q: searchQuery,
          mode: searchAnd ? "and" : "or",
        });
        const res = await fetch(`${BASE}/api/ocr/search?${params}`, { signal });
        const data = await res.json();
        if (data.success) {
          setFolders([]);
          setImages(data.assets);
          const map: Record<string, string> = {};
          for (const a of data.assets) {
            if (a.ocrText) map[a.path] = a.ocrText;
          }
          setOcrStatusMap(map);
        }
      } else if (indexCount > 0) {
        // Index search: single API call handles AND/OR + multi-keyword
        const params = new URLSearchParams({
          url: connection.url,
          sid: connection.sid,
          q: searchQuery,
          mode: searchAnd ? "and" : "or",
        });
        const res = await fetch(`${BASE}/api/index/search?${params}`, { signal });
        const data = await res.json();
        if (data.success) {
          setFolders([]);
          setImages(data.assets);
          checkOcrStatus(data.assets);
        }
      } else {
        // Fallback: Synology search (per keyword)
        const keywords = searchQuery.trim().split(/\s+/).filter(Boolean);
        const allResults = new Map<string, typeof images[0]>();
        const hitCount = new Map<string, number>();

        for (const kw of keywords) {
          const params = new URLSearchParams({ url: connection.url, sid: connection.sid, path: folderPath, q: kw });
          const res = await fetch(`${BASE}/api/synology/search?${params}`, { signal });
          const data = await res.json();
          if (data.success) {
            for (const asset of data.assets) {
              allResults.set(asset.path, asset);
              hitCount.set(asset.path, (hitCount.get(asset.path) || 0) + 1);
            }
          }
        }

        const filtered = searchAnd
          ? [...allResults.values()].filter((a) => (hitCount.get(a.path) || 0) >= keywords.length)
          : [...allResults.values()];
        setFolders([]);
        setImages(filtered);
        checkOcrStatus(filtered);
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        // silently fail non-abort errors
      }
    } finally {
      setSearching(false);
      searchAbortRef.current = null;
    }
  };

  const startOcrProcessing = async () => {
    if (!connection) return;

    const includeSubfolders =
      folders.length === 0 ||
      confirm(`하위 폴더의 이미지도 모두 OCR 처리하시겠습니까?\n(취소 시 현재 폴더만 처리)`);

    try {
      const res = await fetch(`${BASE}/api/ocr/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nasUrl: connection.url,
          sid: connection.sid,
          ...(includeSubfolders
            ? { folderPath, recursive: true }
            : { files: images.map((img) => ({ path: img.path, name: img.name })) }),
          baseUrl: window.location.origin,
        }),
      });

      const data = await res.json();

      if (data.success && data.jobId) {
        setOcrJobId(data.jobId);
        setOcrProgress({ total: data.total, done: 0, current: "시작 중..." });

        pollRef.current = setInterval(async () => {
          const statusRes = await fetch(`${BASE}/api/ocr/process?jobId=${data.jobId}`);
          const statusData = await statusRes.json();

          if (statusData.success) {
            setOcrProgress({
              total: statusData.total || data.total,
              done: statusData.done || 0,
              current: statusData.current || "",
            });

            if (statusData.finished) {
              if (pollRef.current) clearInterval(pollRef.current);
              pollRef.current = null;
              setOcrJobId(null);
              checkOcrStatus(images);
            }
          }
        }, 2000);
      } else if (data.processed === 0) {
        setOcrProgress({ total: 0, done: 0, current: "이미 모든 이미지가 처리됨" });
        setTimeout(() => setOcrProgress({ total: 0, done: 0, current: "" }), 3000);
      }
    } catch {
      setError("OCR 처리 시작 실패");
    }
  };

  const cancelOcr = async () => {
    if (!ocrJobId) return;
    try {
      await fetch(`${BASE}/api/ocr/process?jobId=${ocrJobId}`, { method: "DELETE" });
    } catch {
      // ignore
    }
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    setOcrJobId(null);
    setOcrProgress({ total: 0, done: 0, current: "" });
  };

  const navigateTo = (path: string) => {
    setFolderPath(path);
    setOcrStatusMap({});
  };

  const goUp = () => {
    if (folderPath === "/photo") return;
    const parts = folderPath.split("/").filter(Boolean);
    parts.pop();
    navigateTo("/" + parts.join("/"));
  };

  const isSelected = (image: ImageAsset) =>
    selectedImages.some((i) => i.id === image.id);

  const breadcrumbs = folderPath.split("/").filter(Boolean);
  const processedCount = Object.keys(ocrStatusMap).length;

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
              placeholder={ocrMode ? "이미지 속 텍스트 검색..." : "파일명 검색..."}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-gray-100 border-none focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <button
            onClick={handleSearch}
            className={`px-3 py-2 text-sm rounded-lg ${
              searching
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-purple-600 text-white hover:bg-purple-700"
            }`}
          >
            {searching ? <><Loader2 className="w-4 h-4 animate-spin inline mr-1" />취소</> : "검색"}
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setOcrMode(false)}
            className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
              !ocrMode ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            파일명
          </button>
          <button
            onClick={() => setOcrMode(true)}
            className={`px-2.5 py-1 text-xs rounded-full transition-colors flex items-center gap-1 ${
              ocrMode ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <ScanText className="w-3 h-3" />
            텍스트(OCR)
          </button>
          <button
            onClick={() => setSearchAnd(!searchAnd)}
            className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
              searchAnd ? "bg-blue-600 text-white" : "bg-orange-500 text-white"
            }`}
            title={searchAnd ? "모든 키워드 포함 (AND)" : "키워드 중 하나라도 포함 (OR)"}
          >
            {searchAnd ? "AND" : "OR"}
          </button>
          {isAdmin && (
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={startIndexBuild}
                className={`px-2.5 py-1 text-xs rounded-full flex items-center gap-1 ${
                  indexBuilding
                    ? "bg-red-100 text-red-700 hover:bg-red-200"
                    : "bg-green-100 text-green-700 hover:bg-green-200"
                }`}
                title={indexBuilding ? "인덱싱 취소" : indexCount > 0 ? `인덱스 재생성 (현재 ${indexCount.toLocaleString()}개)` : "전체 파일 인덱싱 (빠른 검색용)"}
              >
                {indexBuilding ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                {indexBuilding ? "취소" : indexCount > 0 ? `인덱스(${indexCount.toLocaleString()})` : "인덱싱"}
              </button>
              <button
                onClick={startOcrProcessing}
                disabled={!!ocrJobId || (images.length === 0 && folders.length === 0)}
                className="px-2.5 py-1 text-xs rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:opacity-50 flex items-center gap-1"
                title="현재 폴더(하위 폴더 포함)의 미처리 이미지에서 텍스트 추출"
              >
                <ScanText className="w-3 h-3" />
                {unprocessedCount > 0 ? `OCR(${unprocessedCount})` : "OCR"}
              </button>
            </div>
          )}
        </div>

        {isAdmin && processedCount > 0 && !ocrJobId && (
          <div className="text-[10px] text-amber-600">
            OCR 처리됨: {processedCount}/{images.length}
          </div>
        )}

        {isAdmin && (ocrJobId || ocrProgress.current) && (
          <div className="bg-amber-50 rounded-lg px-3 py-2 space-y-1">
            <div className="flex items-center justify-between text-xs text-amber-700">
              <span>OCR 처리 중... {ocrProgress.done}/{ocrProgress.total}</span>
              <div className="flex items-center gap-2">
                <span className="truncate max-w-[100px]">{ocrProgress.current}</span>
                {ocrJobId && (
                  <button
                    onClick={cancelOcr}
                    className="px-2 py-0.5 bg-red-100 text-red-600 rounded text-[10px] hover:bg-red-200"
                  >
                    취소
                  </button>
                )}
              </div>
            </div>
            {ocrProgress.total > 0 && (
              <div className="w-full bg-amber-200 rounded-full h-1.5">
                <div
                  className="bg-amber-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${(ocrProgress.done / ocrProgress.total) * 100}%` }}
                />
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-1 text-xs text-gray-500 overflow-x-auto">
          {folderPath !== "/photo" && (
            <button onClick={goUp} className="hover:text-purple-600 shrink-0 p-0.5">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={() => navigateTo("/photo")} className="hover:text-purple-600 shrink-0">
            <FolderOpen className="w-3.5 h-3.5" />
          </button>
          {breadcrumbs.map((part, i) => (
            <span key={i} className="flex items-center gap-1 shrink-0">
              <ChevronRight className="w-3 h-3" />
              <button
                onClick={() => navigateTo("/" + breadcrumbs.slice(0, i + 1).join("/"))}
                className="hover:text-purple-600"
              >
                {part}
              </button>
            </span>
          ))}
          <button onClick={() => loadContents(folderPath)} className="ml-auto shrink-0 hover:text-purple-600">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {selectedImages.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-purple-600 font-medium">
              {selectedImages.length}개 선택됨
            </span>
            <button
              onClick={() => openImageOnCanvas(selectedImages)}
              disabled={openingCanvas}
              className="px-2 py-0.5 text-[10px] bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-60 flex items-center gap-1"
            >
              {openingCanvas ? (
                <><Loader2 className="w-3 h-3 animate-spin" />분석 중...</>
              ) : (
                "캔버스에 열기"
              )}
            </button>
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
                {images.map((image) => {
                  const ocrText = ocrStatusMap[image.path];
                  const isOcrDone = ocrText !== undefined;
                  return (
                    <div key={image.id} className="relative">
                      <button
                        onClick={() => toggleImageSelection(image)}
                        onMouseEnter={() => ocrText ? setHoveredOcr(image.id) : null}
                        onMouseLeave={() => setHoveredOcr(null)}
                        className={`relative group aspect-square rounded-lg overflow-hidden border-2 transition-all w-full ${
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
                        {isOcrDone && (
                          <div className={`absolute top-2 left-2 w-5 h-5 rounded-full flex items-center justify-center ${ocrText ? "bg-amber-500" : "bg-gray-400"}`}>
                            <FileText className="w-3 h-3 text-white" />
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                          <p className="text-white text-xs truncate">{image.name}</p>
                        </div>
                      </button>
                      {hoveredOcr === image.id && ocrText && (
                        <div className="absolute z-10 left-0 right-0 -bottom-1 translate-y-full bg-gray-900 text-white text-xs p-2 rounded-lg shadow-lg max-h-24 overflow-y-auto">
                          <p className="text-amber-400 text-[10px] font-medium mb-0.5">추출된 텍스트:</p>
                          <p className="whitespace-pre-wrap leading-relaxed">{ocrText}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
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
