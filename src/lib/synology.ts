import type { SynologyAuthResponse, SynologyListResponse, SynologyFile } from "@/types";

export class SynologyClient {
  private baseUrl: string;
  private sid: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private buildUrl(api: string, method: string, version: number, params: Record<string, string> = {}): string {
    const searchParams = new URLSearchParams({
      api,
      method,
      version: String(version),
      ...params,
    });
    if (this.sid) {
      searchParams.set("_sid", this.sid);
    }
    return `${this.baseUrl}/webapi/entry.cgi?${searchParams.toString()}`;
  }

  async login(account: string, password: string, otpCode?: string): Promise<string> {
    const params: Record<string, string> = { account, passwd: password };
    if (otpCode) {
      params.otp_code = otpCode;
    }

    const url = this.buildUrl("SYNO.API.Auth", "login", 6, params);
    const res = await fetch(url);
    const data: SynologyAuthResponse = await res.json();

    if (!data.success || !data.data?.sid) {
      throw new Error(`Synology login failed: error code ${data.error?.code}`);
    }

    this.sid = data.data.sid;
    return this.sid;
  }

  async logout(): Promise<void> {
    if (!this.sid) return;
    const url = this.buildUrl("SYNO.API.Auth", "logout", 6);
    await fetch(url);
    this.sid = null;
  }

  setSid(sid: string) {
    this.sid = sid;
  }

  async listFiles(folderPath: string, offset = 0, limit = 50, filetype = "all"): Promise<SynologyListResponse> {
    const url = this.buildUrl("SYNO.FileStation.List", "list", 2, {
      folder_path: folderPath,
      offset: String(offset),
      limit: String(limit),
      sort_by: "mtime",
      sort_direction: "desc",
      filetype,
      additional: '["size","time","thumbnail"]',
    });

    const res = await fetch(url);
    return res.json();
  }

  async listShares(): Promise<SynologyListResponse> {
    const url = this.buildUrl("SYNO.FileStation.List", "list_share", 2, {
      additional: '["size","time"]',
    });

    const res = await fetch(url);
    return res.json();
  }

  async searchFiles(folderPath: string, pattern: string): Promise<SynologyFile[]> {
    const startUrl = this.buildUrl("SYNO.FileStation.Search", "start", 2, {
      folder_path: folderPath,
      pattern,
      filetype: "file",
    });

    const startRes = await fetch(startUrl);
    const startData = await startRes.json();

    if (!startData.success || !startData.data?.taskid) {
      throw new Error("Search start failed");
    }

    const taskId = startData.data.taskid;

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const listUrl = this.buildUrl("SYNO.FileStation.Search", "list", 2, {
      taskid: taskId,
      limit: "100",
      additional: '["size","time","thumbnail"]',
    });

    const listRes = await fetch(listUrl);
    const listData = await listRes.json();

    const stopUrl = this.buildUrl("SYNO.FileStation.Search", "stop", 2, {
      taskid: taskId,
    });
    await fetch(stopUrl);

    return listData.data?.files ?? [];
  }

  getThumbnailUrl(path: string, size: "small" | "medium" | "large" = "medium"): string {
    return this.buildUrl("SYNO.FileStation.Thumb", "get", 2, {
      path,
      size,
    });
  }

  getDownloadUrl(path: string): string {
    return this.buildUrl("SYNO.FileStation.Download", "download", 2, {
      path,
      mode: "open",
    });
  }
}

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".tiff"]);

export function isImageFile(filename: string): boolean {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf("."));
  return IMAGE_EXTENSIONS.has(ext);
}
