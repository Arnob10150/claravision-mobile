/**
 * On-device storage for scan records.
 * Uses SQLite on native (iOS/Android) and localStorage on web.
 * Replaces the Supabase 'scans' table for offline/local development.
 */
import { Platform } from 'react-native'
import * as SQLite from 'expo-sqlite'

export interface ScanRecord {
  id: string
  predicted_class: string
  confidence: number
  uncertainty_score: number
  uncertainty_level: 'low' | 'medium' | 'high'
  all_probabilities: Record<string, number>
  referral_flag: boolean
  eye_side: string
  status: string
  analysis_metadata: Record<string, unknown>
  created_at: string
}

const WEB_STORAGE_KEY = 'claravision_scans'

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('claravision.db').then(async db => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS scans (
          id TEXT PRIMARY KEY NOT NULL,
          predicted_class TEXT NOT NULL,
          confidence REAL NOT NULL,
          uncertainty_score REAL NOT NULL,
          uncertainty_level TEXT NOT NULL,
          all_probabilities TEXT NOT NULL,
          referral_flag INTEGER NOT NULL,
          eye_side TEXT NOT NULL,
          status TEXT NOT NULL,
          analysis_metadata TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `)
      return db
    })
  }
  return dbPromise
}

function readWebScans(): ScanRecord[] {
  try {
    const raw = globalThis.localStorage?.getItem(WEB_STORAGE_KEY)
    return raw ? JSON.parse(raw) as ScanRecord[] : []
  } catch {
    return []
  }
}

function writeWebScans(scans: ScanRecord[]) {
  globalThis.localStorage?.setItem(WEB_STORAGE_KEY, JSON.stringify(scans))
}

export async function insertScan(scan: ScanRecord) {
  if (Platform.OS === 'web') {
    const scans = readWebScans().filter(s => s.id !== scan.id)
    scans.unshift(scan)
    writeWebScans(scans)
    return
  }
  const db = await getDb()
  await db.runAsync(
    `INSERT OR REPLACE INTO scans (id, predicted_class, confidence, uncertainty_score, uncertainty_level, all_probabilities, referral_flag, eye_side, status, analysis_metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      scan.id, scan.predicted_class, scan.confidence, scan.uncertainty_score, scan.uncertainty_level,
      JSON.stringify(scan.all_probabilities), scan.referral_flag ? 1 : 0, scan.eye_side, scan.status,
      JSON.stringify(scan.analysis_metadata), scan.created_at,
    ]
  )
}

export async function getAllScans(): Promise<ScanRecord[]> {
  if (Platform.OS === 'web') return readWebScans()
  const db = await getDb()
  const rows = await db.getAllAsync<Record<string, any>>(`SELECT * FROM scans ORDER BY created_at DESC`)
  return rows.map(r => ({
    id: r.id,
    predicted_class: r.predicted_class,
    confidence: r.confidence,
    uncertainty_score: r.uncertainty_score,
    uncertainty_level: r.uncertainty_level,
    all_probabilities: JSON.parse(r.all_probabilities),
    referral_flag: !!r.referral_flag,
    eye_side: r.eye_side,
    status: r.status,
    analysis_metadata: JSON.parse(r.analysis_metadata),
    created_at: r.created_at,
  }))
}

export interface DashboardStats {
  total: number
  pending: number
  highUnc: number
  today: number
  lastWTotal: number
  lastWPend: number
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const scans = await getAllScans()
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
  const twoWk = new Date(); twoWk.setDate(twoWk.getDate() - 14)

  const inRange = (iso: string, from: Date, to?: Date) => {
    const t = new Date(iso).getTime()
    return t >= from.getTime() && (!to || t < to.getTime())
  }

  return {
    total: scans.length,
    pending: scans.filter(s => s.status === 'pending').length,
    highUnc: scans.filter(s => s.uncertainty_level === 'high').length,
    today: scans.filter(s => inRange(s.created_at, today)).length,
    lastWTotal: scans.filter(s => inRange(s.created_at, twoWk, weekAgo)).length,
    lastWPend: scans.filter(s => s.status === 'pending' && inRange(s.created_at, twoWk, weekAgo)).length,
  }
}

export interface RecentScan {
  id: string
  code: string
  predicted_class: string
  uncertainty_level: string
  status: string
  created_at: string
}

export async function getRecentScans(limit = 6): Promise<RecentScan[]> {
  const scans = await getAllScans()
  return scans.slice(0, limit).map(s => ({
    id: s.id,
    code: `SC-${s.id.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase()}`,
    predicted_class: s.predicted_class,
    uncertainty_level: s.uncertainty_level,
    status: s.status,
    created_at: s.created_at,
  }))
}

export async function getDiseaseDistribution(): Promise<{ name: string; count: number }[]> {
  const scans = await getAllScans()
  const counts: Record<string, number> = {}
  scans.forEach(s => { counts[s.predicted_class] = (counts[s.predicted_class] ?? 0) + 1 })
  return Object.entries(counts).sort(([, a], [, b]) => b - a).map(([name, count]) => ({ name, count }))
}

export async function getPendingReviewQueue(): Promise<ScanRecord[]> {
  const scans = await getAllScans()
  return scans
    .filter(s => s.status === 'pending' && (s.uncertainty_level === 'high' || s.uncertainty_level === 'medium'))
    .sort((a, b) => b.uncertainty_score - a.uncertainty_score)
    .slice(0, 80)
}
