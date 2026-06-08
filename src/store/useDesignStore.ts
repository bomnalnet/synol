import { create } from "zustand";
import type { DesignTemplate, TemplateElement, ImageAsset } from "@/types";

interface SynologyConnection {
  url: string;
  sid: string;
  currentPath: string;
}

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

  isGenerating: boolean;
  setIsGenerating: (v: boolean) => void;

  sidebarTab: "images" | "templates" | "ai" | "elements";
  setSidebarTab: (tab: "images" | "templates" | "ai" | "elements") => void;
}

export const useDesignStore = create<DesignState>((set) => ({
  connection: null,
  setConnection: (conn) => set({ connection: conn }),
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
    }),

  elements: [],
  setElements: (elements) => set({ elements }),
  updateElement: (id, updates) =>
    set((state) => ({
      elements: state.elements.map((el) =>
        el.id === id ? { ...el, ...updates } : el
      ),
    })),
  addElement: (element) =>
    set((state) => ({ elements: [...state.elements, element] })),
  removeElement: (id) =>
    set((state) => ({
      elements: state.elements.filter((el) => el.id !== id),
      selectedElementId: state.selectedElementId === id ? null : state.selectedElementId,
    })),
  selectedElementId: null,
  setSelectedElementId: (id) => set({ selectedElementId: id }),

  isGenerating: false,
  setIsGenerating: (v) => set({ isGenerating: v }),

  sidebarTab: "images",
  setSidebarTab: (tab) => set({ sidebarTab: tab }),
}));
