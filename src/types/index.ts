export interface SynologyAuthResponse {
  success: boolean;
  data?: {
    sid: string;
  };
  error?: {
    code: number;
  };
}

export interface SynologyFile {
  path: string;
  name: string;
  isdir: boolean;
  additional?: {
    size: number;
    time: {
      crtime: number;
      mtime: number;
    };
    thumbnail?: {
      status: string;
    };
  };
}

export interface SynologyListResponse {
  success: boolean;
  data?: {
    files: SynologyFile[];
    total: number;
    offset: number;
  };
  error?: {
    code: number;
  };
}

export interface DesignTemplate {
  id: string;
  name: string;
  category: string;
  width: number;
  height: number;
  thumbnail: string;
  elements: TemplateElement[];
}

export interface TemplateElement {
  id: string;
  type: "image" | "text" | "shape" | "background";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  props: Record<string, unknown>;
}

export interface DesignProject {
  id: string;
  name: string;
  template: DesignTemplate;
  elements: TemplateElement[];
  createdAt: string;
  updatedAt: string;
}

export interface ImageAsset {
  id: string;
  path: string;
  name: string;
  thumbnailUrl: string;
  fullUrl: string;
  size: number;
  modifiedAt: number;
}

export interface AIDesignRequest {
  prompt: string;
  templateId?: string;
  images: string[];
  style?: string;
  width: number;
  height: number;
}

export interface AIDesignResponse {
  success: boolean;
  design?: {
    elements: TemplateElement[];
    suggestions: string[];
  };
  error?: string;
}
