import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type { ScanResult, ScanRow, ScanStatus } from "@/types/scan";

const DB_PATH = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "scans.db");

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS scans (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      completed_at INTEGER,
      result_json TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);
  `);
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export function createScan(id: string, url: string): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO scans (id, url, status, created_at)
    VALUES (?, ?, 'pending', ?)
  `).run(id, url, Date.now());
}

export function updateScanStatus(id: string, status: ScanStatus): void {
  const db = getDb();
  db.prepare("UPDATE scans SET status = ? WHERE id = ?").run(status, id);
}

export function completeScan(id: string, result: ScanResult): void {
  const db = getDb();
  db.prepare(`
    UPDATE scans
    SET status = 'complete', completed_at = ?, result_json = ?
    WHERE id = ?
  `).run(Date.now(), JSON.stringify(result), id);
}

export function failScan(id: string, errorMessage: string): void {
  const db = getDb();
  db.prepare(`
    UPDATE scans
    SET status = 'error', completed_at = ?, result_json = ?
    WHERE id = ?
  `).run(
    Date.now(),
    JSON.stringify({ errorMessage }),
    id,
  );
}

export function getScan(id: string): ScanRow | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM scans WHERE id = ?").get(id) as ScanRow | undefined;
  return row ?? null;
}

export function getRecentScans(limit = 10): ScanRow[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM scans ORDER BY created_at DESC LIMIT ?")
    .all(limit) as ScanRow[];
}

export function getScanResult(id: string): ScanResult | null {
  const row = getScan(id);
  if (!row || !row.result_json) return null;
  try {
    return JSON.parse(row.result_json) as ScanResult;
  } catch {
    return null;
  }
}
