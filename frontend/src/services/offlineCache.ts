import { openDB, type IDBPDatabase } from 'idb'

const DB_NAME = 'vidyasathi-offline'
const DB_VERSION = 1

interface VidyaSathiDB {
  questions: { key: string; value: { question: string; answer: string; timestamp: string; subject: string } }
  content_packs: { key: string; value: { packId: string; data: ArrayBuffer; metadata: Record<string, unknown>; downloaded_at: string } }
  offline_queue: { key: string; value: { id: string; question: string; subject: string; chapter?: number; mode: string; timestamp: string } }
  progress: { key: string; value: Record<string, unknown> }
}

let dbPromise: Promise<IDBPDatabase> | null = null

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('questions')) {
          const qs = db.createObjectStore('questions', { keyPath: 'question' })
          qs.createIndex('subject', 'subject')
          qs.createIndex('timestamp', 'timestamp')
        }
        if (!db.objectStoreNames.contains('content_packs')) {
          db.createObjectStore('content_packs', { keyPath: 'packId' })
        }
        if (!db.objectStoreNames.contains('offline_queue')) {
          db.createObjectStore('offline_queue', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('progress')) {
          db.createObjectStore('progress', { keyPath: 'key' })
        }
      },
    })
  }
  return dbPromise
}

// Normalize question for fuzzy matching
function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

// Simple keyword overlap score
function similarity(a: string, b: string): number {
  const wordsA = new Set(normalize(a).split(' '))
  const wordsB = new Set(normalize(b).split(' '))
  let overlap = 0
  wordsA.forEach((w) => { if (wordsB.has(w) && w.length > 3) overlap++ })
  return overlap / Math.max(wordsA.size, wordsB.size)
}

export const offlineCache = {
  async getCachedAnswer(question: string, subject?: string): Promise<string | null> {
    try {
      const db = await getDB()
      // Try exact match first
      const exact = await db.get('questions', question)
      if (exact) return exact.answer

      // Fuzzy match against all cached questions in the subject
      const all = subject
        ? await db.getAllFromIndex('questions', 'subject', subject)
        : await db.getAll('questions')

      let bestScore = 0
      let bestAnswer: string | null = null
      for (const item of all) {
        const score = similarity(question, item.question)
        if (score > bestScore && score > 0.6) {
          bestScore = score
          bestAnswer = item.answer
        }
      }
      return bestAnswer
    } catch {
      return null
    }
  },

  async cacheAnswer(question: string, answer: string, subject = 'general'): Promise<void> {
    try {
      const db = await getDB()
      await db.put('questions', { question, answer, subject, timestamp: new Date().toISOString() })
    } catch { /* ignore */ }
  },

  async cacheAnswersBatch(pairs: { question: string; answer: string; subject?: string }[]): Promise<void> {
    try {
      const db = await getDB()
      const tx = db.transaction('questions', 'readwrite')
      await Promise.all([
        ...pairs.map((p) => tx.store.put({ question: p.question, answer: p.answer, subject: p.subject || 'general', timestamp: new Date().toISOString() })),
        tx.done,
      ])
    } catch { /* ignore */ }
  },

  async queueQuestion(item: { id: string; question: string; subject: string; chapter?: number; mode: string }): Promise<void> {
    try {
      const db = await getDB()
      await db.put('offline_queue', { ...item, timestamp: new Date().toISOString() })
    } catch { /* ignore */ }
  },

  async getQueuedQuestions(): Promise<VidyaSathiDB['offline_queue']['value'][]> {
    try {
      const db = await getDB()
      return await db.getAll('offline_queue')
    } catch {
      return []
    }
  },

  async removeQueuedQuestion(id: string): Promise<void> {
    try {
      const db = await getDB()
      await db.delete('offline_queue', id)
    } catch { /* ignore */ }
  },

  async clearQueue(): Promise<void> {
    try {
      const db = await getDB()
      await db.clear('offline_queue')
    } catch { /* ignore */ }
  },

  async saveContentPack(packId: string, data: ArrayBuffer, metadata: Record<string, unknown>): Promise<void> {
    try {
      const db = await getDB()
      await db.put('content_packs', { packId, data, metadata, downloaded_at: new Date().toISOString() })
    } catch { /* ignore */ }
  },

  async getContentPack(packId: string): Promise<{ data: ArrayBuffer; metadata: Record<string, unknown> } | null> {
    try {
      const db = await getDB()
      const pack = await db.get('content_packs', packId)
      return pack ? { data: pack.data, metadata: pack.metadata } : null
    } catch {
      return null
    }
  },

  async listDownloadedPacks(): Promise<string[]> {
    try {
      const db = await getDB()
      return await db.getAllKeys('content_packs') as string[]
    } catch {
      return []
    }
  },

  async deleteContentPack(packId: string): Promise<void> {
    try {
      const db = await getDB()
      await db.delete('content_packs', packId)
    } catch { /* ignore */ }
  },

  async saveProgress(key: string, value: Record<string, unknown>): Promise<void> {
    try {
      const db = await getDB()
      await db.put('progress', { key, ...value })
    } catch { /* ignore */ }
  },

  async getProgress(key: string): Promise<Record<string, unknown> | null> {
    try {
      const db = await getDB()
      return await db.get('progress', key)
    } catch {
      return null
    }
  },

  async getCacheSize(): Promise<{ questions: number; packs: number; queue: number }> {
    try {
      const db = await getDB()
      const [q, p, oq] = await Promise.all([
        db.count('questions'),
        db.count('content_packs'),
        db.count('offline_queue'),
      ])
      return { questions: q, packs: p, queue: oq }
    } catch {
      return { questions: 0, packs: 0, queue: 0 }
    }
  },
}
