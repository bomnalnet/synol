import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "ocr-metadata.db");

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS ocr_metadata (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT UNIQUE NOT NULL,
        file_name TEXT NOT NULL,
        ocr_text TEXT NOT NULL DEFAULT '',
        processed_at TEXT NOT NULL DEFAULT (datetime('now')),
        nas_url TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_ocr_text ON ocr_metadata(ocr_text);
      CREATE INDEX IF NOT EXISTS idx_file_path ON ocr_metadata(file_path);

      CREATE TABLE IF NOT EXISTS file_index (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT UNIQUE NOT NULL,
        file_name TEXT NOT NULL,
        nas_url TEXT NOT NULL,
        file_size INTEGER NOT NULL DEFAULT 0,
        mtime INTEGER NOT NULL DEFAULT 0,
        indexed_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_fi_name ON file_index(file_name);
      CREATE INDEX IF NOT EXISTS idx_fi_path ON file_index(file_path);
      CREATE INDEX IF NOT EXISTS idx_fi_nas ON file_index(nas_url);
    `);
  }
  return db;
}

export function saveOcrResult(nasUrl: string, filePath: string, fileName: string, ocrText: string): void {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO ocr_metadata (file_path, file_name, ocr_text, nas_url, processed_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).run(filePath, fileName, ocrText, nasUrl);
}

export function getOcrResult(filePath: string): string | null {
  const db = getDb();
  const row = db.prepare("SELECT ocr_text FROM ocr_metadata WHERE file_path = ?").get(filePath) as { ocr_text: string } | undefined;
  return row?.ocr_text ?? null;
}

export function isProcessed(filePath: string): boolean {
  const db = getDb();
  const row = db.prepare("SELECT 1 FROM ocr_metadata WHERE file_path = ?").get(filePath);
  return !!row;
}

export function searchByText(query: string, limit = 50): Array<{ file_path: string; file_name: string; ocr_text: string }> {
  const db = getDb();
  return db.prepare(`
    SELECT file_path, file_name, ocr_text
    FROM ocr_metadata
    WHERE ocr_text LIKE ? OR file_name LIKE ?
    ORDER BY processed_at DESC
    LIMIT ?
  `).all(`%${query}%`, `%${query}%`, limit) as Array<{ file_path: string; file_name: string; ocr_text: string }>;
}

export function getProcessedCount(folderPath: string): { processed: number; total: number } {
  const db = getDb();
  const row = db.prepare(`
    SELECT COUNT(*) as processed FROM ocr_metadata WHERE file_path LIKE ?
  `).get(`${folderPath}%`) as { processed: number };
  return { processed: row.processed, total: 0 };
}

export function getUnprocessedPaths(filePaths: string[]): string[] {
  if (filePaths.length === 0) return [];
  const db = getDb();
  const placeholders = filePaths.map(() => "?").join(",");
  const processed = db.prepare(`
    SELECT file_path FROM ocr_metadata WHERE file_path IN (${placeholders})
  `).all(...filePaths) as Array<{ file_path: string }>;
  const processedSet = new Set(processed.map((r) => r.file_path));
  return filePaths.filter((p) => !processedSet.has(p));
}

// ── File Index ──────────────────────────────────────────────────────────────

export function upsertFileIndex(
  nasUrl: string,
  filePath: string,
  fileName: string,
  fileSize: number,
  mtime: number
): void {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO file_index (file_path, file_name, nas_url, file_size, mtime, indexed_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).run(filePath, fileName, nasUrl, fileSize, mtime);
}

export function clearFileIndex(nasUrl: string): void {
  const db = getDb();
  db.prepare("DELETE FROM file_index WHERE nas_url = ?").run(nasUrl);
}

export function getFileIndexCount(nasUrl: string): number {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) as cnt FROM file_index WHERE nas_url = ?").get(nasUrl) as { cnt: number };
  return row.cnt;
}

export function getFileIndexLastUpdated(nasUrl: string): string | null {
  const db = getDb();
  const row = db.prepare("SELECT MAX(indexed_at) as last FROM file_index WHERE nas_url = ?").get(nasUrl) as { last: string | null };
  return row.last;
}

export function searchFileIndex(
  nasUrl: string,
  query: string,
  limit = 200
): Array<{ file_path: string; file_name: string; file_size: number; mtime: number }> {
  const db = getDb();
  const like = `%${query}%`;
  return db.prepare(`
    SELECT file_path, file_name, file_size, mtime
    FROM file_index
    WHERE nas_url = ? AND (file_name LIKE ? OR file_path LIKE ?)
    ORDER BY mtime DESC
    LIMIT ?
  `).all(nasUrl, like, like, limit) as Array<{ file_path: string; file_name: string; file_size: number; mtime: number }>;
}

export function bulkUpsertFileIndex(
  nasUrl: string,
  files: Array<{ filePath: string; fileName: string; fileSize: number; mtime: number }>
): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO file_index (file_path, file_name, nas_url, file_size, mtime, indexed_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `);
  const insertMany = db.transaction((items: typeof files) => {
    for (const f of items) {
      stmt.run(f.filePath, f.fileName, nasUrl, f.fileSize, f.mtime);
    }
  });
  insertMany(files);
}
