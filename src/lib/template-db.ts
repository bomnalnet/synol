import Database from "better-sqlite3";
import path from "path";
import type { DesignTemplate } from "@/types";

const DB_PATH = path.join(process.cwd(), "templates.db");

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS custom_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT '내 템플릿',
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        elements TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }
  return db;
}

export function getAllCustomTemplates(): DesignTemplate[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM custom_templates ORDER BY created_at DESC").all() as Array<{
    id: string;
    name: string;
    category: string;
    width: number;
    height: number;
    elements: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    width: row.width,
    height: row.height,
    thumbnail: "",
    elements: JSON.parse(row.elements),
  }));
}

export function saveCustomTemplate(template: DesignTemplate): void {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO custom_templates (id, name, category, width, height, elements)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(template.id, template.name, template.category, template.width, template.height, JSON.stringify(template.elements));
}

export function deleteCustomTemplate(id: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM custom_templates WHERE id = ?").run(id);
  return result.changes > 0;
}
