import { create } from "zustand";
import type { DesignTemplate, TemplateElement, ImageAsset } from "@/types";

interface SynologyConnection {
  url: string;
  sid: string;
  currentPath: string;
  account: string;
}

const MAX_HISTORY = 50;

interface DesignState {
  connection: SynologyConnection | null;
  setConnection: (conn: SynologyConnection | null) => void;
  setCurrentPath: (path: string) => void;

  images: ImageAsset[];
  setImages: (images: ImageAsset[]) => void;
  appendImages: (images: ImageAsset[]) => void;
  selectedImages: ImageAsset[];
  toggleImageSelection: (image: ImageAsset) => void;
  clearImageSelection: () => void;

  currentTemplate: DesignTemplate | null;
  setCurrentTemplate: (template: DesignTemplate | null) => void;

  elements: TemplateElement[];
  setElements: (elements: TemplateElement[]) => void;
  updateElement: (id: string, updates: Partial<TemplateElement>) => void;
  addElement: (element: TemplateElement) => void;
  removeElement: (id: string) => void;
  selectedElementId: string | null;
  setSelectedElementId: (id: string | null) => void;

  // Undo/Redo
  _history: TemplateElement[][];
  _historyIndex: number;
  undo: () => void;
  redo: () => void;

  isAdmin: boolean;

  isGenerating: boolean;
  setIsGenerating: (v: boolean) => void;

  sidebarTab: "images" | "templates" | "ai" | "copy" | "elements";
  setSidebarTab: (tab: "images" | "templates" | "ai" | "copy" | "elements") => void;
}

function pushHistory(state: DesignState, newElements: TemplateElement[]) {
  const history = state._history.slice(0, state._historyIndex + 1);
  history.push(newElements);
  if (history.length > MAX_HISTORY) history.shift();
  return { elements: newElements, _history: history, _historyIndex: history.length - 1 };
}

export const useDesignStore = create<DesignState>((set) => ({
  connection: null,
  setConnection: (conn) => set({ connection: conn }),
  isAdmin: false,
  setCurrentPath: (path) =>
    set((state) => ({
      connection: state.connection ? { ...state.connection, currentPath: path } : null,
    })),

  images: [],
  setImages: (images) => set({ images }),
  appendImages: (images) => set((state) => ({ images: [...state.images, ...images] })),
  selectedImages: [],
  toggleImageSelection: (image) =>
    set((state) => {
      const exists = state.selectedImages.find((i) => i.id === image.id);
      return {
        selectedImages: exists
          ? state.selectedImages.filter((i) => i.id !== image.id)
          : [...state.selectedImages, image],
      };
    }),
  clearImageSelection: () => set({ selectedImages: [] }),

  currentTemplate: null,
  setCurrentTemplate: (template) =>
    set({
      currentTemplate: template,
      elements: template?.elements ?? [],
      selectedElementId: null,
      _history: [template?.elements ?? []],
      _historyIndex: 0,
    }),

  elements: [],
  _history: [[]],
  _historyIndex: 0,

  setElements: (elements) => set((state) => pushHistory(state, elements)),
  updateElement: (id, updates) =>
    set((state) => {
      const newElements = state.elements.map((el) =>
        el.id === id ? { ...el, ...updates } : el
      );
      return pushHistory(state, newElements);
    }),
  addElement: (element) =>
    set((state) => {
      const newElements = [...state.elements, element];
      return pushHistory(state, newElements);
    }),
  removeElement: (id) =>
    set((state) => {
      const newElements = state.elements.filter((el) => el.id !== id);
      return {
        ...pushHistory(state, newElements),
        selectedElementId: state.selectedElementId === id ? null : state.selectedElementId,
      };
    }),
  selectedElementId: null,
  setSelectedElementId: (id) => set({ selectedElementId: id }),

  undo: () =>
    set((state) => {
      if (state._historyIndex <= 0) return state;
      const newIndex = state._historyIndex - 1;
      return { elements: state._history[newIndex], _historyIndex: newIndex };
    }),
  redo: () =>
    set((state) => {
      if (state._historyIndex >= state._history.length - 1) return state;
      const newIndex = state._historyIndex + 1;
      return { elements: state._history[newIndex], _historyIndex: newIndex };
    }),

  isGenerating: false,
  setIsGenerating: (v) => set({ isGenerating: v }),

  sidebarTab: "images",
  setSidebarTab: (tab) => set({ sidebarTab: tab }),
}));
