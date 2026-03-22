import axios, { AxiosError } from 'axios'
import { useAuthStore } from '../store/authStore'
import type {
  StudentProfile, TextbookInfo, QuizQuestion, QuizResult,
  Flashcard, ContentPackInfo, CostMetrics, ChapterMastery,
  DiagramRequest, DiagramResponse, AssessmentQuestion, LearningProfile,
  Message, QueryMode
} from '../types'

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

const client = axios.create({ baseURL: BASE_URL, timeout: 30000 })

client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

client.interceptors.response.use(
  (r) => r,
  (err: AxiosError) => {
    if (!navigator.onLine) {
      throw new OfflineError('You are offline')
    }
    throw err
  }
)

export class OfflineError extends Error {
  constructor(msg: string) { super(msg); this.name = 'OfflineError' }
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  register: async (data: { name: string; grade: number; board: string; school?: string; password: string }) => {
    const r = await client.post<{ access_token: string; student: StudentProfile }>('/auth/register', data)
    return r.data
  },
  login: async (name: string, password: string) => {
    const r = await client.post<{ access_token: string; student: StudentProfile }>('/auth/login', { name, password })
    return r.data
  },
  getMe: async () => {
    const r = await client.get<StudentProfile>('/auth/me')
    return r.data
  },
  updateProfile: async (data: Partial<StudentProfile>) => {
    const r = await client.put<StudentProfile>('/auth/profile', data)
    return r.data
  },
}

// ── Onboarding ────────────────────────────────────────────────────────────────

export const onboardingApi = {
  getAssessmentQuestions: async () => {
    const r = await client.get<AssessmentQuestion[]>('/auth/onboarding/assessment-questions')
    return r.data
  },
  submitAssessment: async (responses: { question_id: string; answer: string; time_taken_ms: number }[]) => {
    const r = await client.post<LearningProfile>('/auth/onboarding/assessment', { responses })
    return r.data
  },
  getProfile: async () => {
    const r = await client.get<LearningProfile>('/auth/onboarding/profile')
    return r.data
  },
}

// ── Query ─────────────────────────────────────────────────────────────────────

export interface AskRequest {
  question: string
  subject: string
  chapter?: number
  mode: QueryMode
  conversation_id?: string
}

export interface AskResponse {
  answer: string
  sources: Message['sources']
  cost_tier: 0 | 1 | 2 | 3
  cached: boolean
  tokens_used: number
  cost_usd: number
  mermaid_diagram?: string
  image_data?: { type: string; content: string; alt_text: string }
  conversation_id: string
}

export const queryApi = {
  ask: async (req: AskRequest) => {
    const r = await client.post<AskResponse>('/query/ask', req)
    return r.data
  },
  voice: async (audioBlob: Blob, subject: string, chapter?: number) => {
    const fd = new FormData()
    fd.append('audio', audioBlob, 'recording.webm')
    fd.append('subject', subject)
    if (chapter) fd.append('chapter', String(chapter))
    const r = await client.post<{ answer_text: string; answer_audio_url: string; transcript: string; cost_tier: number; cost_usd: number }>('/query/voice', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    })
    return r.data
  },
  history: async (limit = 20, offset = 0) => {
    const r = await client.get<Message[]>('/query/history', { params: { limit, offset } })
    return r.data
  },
  feedback: async (queryId: string, positive: boolean) => {
    await client.post('/query/feedback', { query_id: queryId, positive })
  },
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export const adminApi = {
  uploadTextbook: async (file: File, title: string, subject: string, grade: number, board: string, onProgress?: (pct: number) => void) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('title', title)
    fd.append('subject', subject)
    fd.append('grade', String(grade))
    fd.append('board', board)
    const r = await client.post<{ textbook_id: string; message: string }>('/admin/textbook/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
      onUploadProgress: (e) => { if (e.total && onProgress) onProgress(Math.round((e.loaded / e.total) * 100)) },
    })
    return r.data
  },
  listTextbooks: async () => {
    const r = await client.get<TextbookInfo[]>('/admin/textbook/list')
    return r.data
  },
  getStatus: async (id: string) => {
    const r = await client.get<TextbookInfo>(`/admin/textbook/status/${id}`)
    return r.data
  },
  generateQA: async (textbookId: string, chapter: number) => {
    const r = await client.post<{ count: number }>(`/admin/textbook/generate-qa/${textbookId}/${chapter}`)
    return r.data
  },
  generatePack: async (textbookId: string, chapter: number) => {
    const r = await client.post<{ pack_id: string }>(`/admin/textbook/generate-pack/${textbookId}/${chapter}`)
    return r.data
  },
  deleteTextbook: async (id: string) => {
    await client.delete(`/admin/textbook/${id}`)
  },
}

// ── Quiz ──────────────────────────────────────────────────────────────────────

export const quizApi = {
  generate: async (textbookId: string, chapter: number, difficulty: 'easy' | 'medium' | 'hard' | 'adaptive', count = 10) => {
    const r = await client.post<QuizQuestion[]>('/quiz/generate', { textbook_id: textbookId, chapter, difficulty, count })
    return r.data
  },
  submit: async (textbookId: string, chapter: number, answers: { question_id: string; answer: string }[]) => {
    const r = await client.post<QuizResult>('/quiz/submit', { textbook_id: textbookId, chapter, answers })
    return r.data
  },
  awardXp: async (xpEarned: number) => {
    const r = await client.post<{ xp: number; streak: number }>('/quiz/award-xp', { xp_earned: xpEarned })
    return r.data
  },
  getFlashcards: async (textbookId: string, chapter: number) => {
    const r = await client.get<Flashcard[]>(`/quiz/flashcards/${textbookId}/${chapter}`)
    return r.data
  },
  getRevisionSummary: async (textbookId: string, chapter: number) => {
    const r = await client.get<{ summary: string; key_points: string[]; chapter_title: string }>(`/revision/summary/${textbookId}/${chapter}`)
    return r.data
  },
  getHint: async (problem: string, subject: string, hintLevel: number) => {
    const r = await client.post<{ hint: string }>('/practice/hint', { problem, subject, hint_level: hintLevel })
    return r.data
  },
}

// ── Offline / Sync ────────────────────────────────────────────────────────────

export const offlineApi = {
  listContentPacks: async () => {
    const r = await client.get<ContentPackInfo[]>('/content-pack/list')
    return r.data
  },
  downloadPack: async (packId: string) => {
    const r = await client.get(`/content-pack/download/${packId}`, { responseType: 'arraybuffer' })
    return r.data as ArrayBuffer
  },
  batchSync: async (queries: { question: string; subject: string; chapter?: number; mode: string }[]) => {
    const r = await client.post<{ answers: { question: string; answer: string }[] }>('/sync/batch-queries', { queries })
    return r.data
  },
  pushProgress: async (progress: Partial<ChapterMastery>[]) => {
    await client.post('/sync/push-progress', { progress })
  },
  pullUpdates: async (since?: string) => {
    const r = await client.get<{ qa_pairs: { question: string; answer: string }[]; progress: ChapterMastery[] }>('/sync/pull', { params: { since } })
    return r.data
  },
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export const analyticsApi = {
  getStudentDashboard: async () => {
    const r = await client.get<{ xp: number; streak: number; mastery: ChapterMastery[]; weak_topics: string[]; recent_activity: { date: string; queries: number }[] }>('/analytics/student/dashboard')
    return r.data
  },
  getCostReport: async () => {
    const r = await client.get<CostMetrics>('/analytics/cost-report')
    return r.data
  },
  getTeacherClass: async (classCode: string) => {
    const r = await client.get(`/analytics/teacher/class/${classCode}`)
    return r.data
  },
}

// ── Notebook ──────────────────────────────────────────────────────────────────

export interface NotebookInfo {
  id: string
  title: string
  description?: string
  status: 'empty' | 'processing' | 'ready' | 'error'
  total_chunks: number
  source_count: number
  created_at: string
}

export interface NotebookSource {
  id: string
  title: string
  source_type: 'pdf' | 'text'
  status: 'processing' | 'ready' | 'error'
  total_chunks: number
  created_at: string
}

export interface NotebookAskResponse {
  answer: string
  sources: { content: string; page?: number; score: number }[]
  tokens_used: number
  notebook_title: string
}

export const notebookApi = {
  // Notebook (collection) CRUD
  create: async (title: string, description = '') => {
    const r = await client.post<{ id: string; title: string; status: string }>('/notebook', { title, description })
    return r.data
  },
  list: async () => {
    const r = await client.get<NotebookInfo[]>('/notebook/list')
    return r.data
  },
  status: async (id: string) => {
    const r = await client.get<{ id: string; status: string; total_chunks: number }>(`/notebook/${id}/status`)
    return r.data
  },
  delete: async (id: string) => {
    await client.delete(`/notebook/${id}`)
  },

  // Sources within a notebook
  listSources: async (notebookId: string) => {
    const r = await client.get<NotebookSource[]>(`/notebook/${notebookId}/sources`)
    return r.data
  },
  addPdf: async (notebookId: string, file: File, title = '') => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('title', title || file.name)
    const r = await client.post<NotebookSource>(`/notebook/${notebookId}/source/upload`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    })
    return r.data
  },
  addText: async (notebookId: string, title: string, content: string) => {
    const r = await client.post<NotebookSource>(`/notebook/${notebookId}/source/text`, { title, content })
    return r.data
  },
  deleteSource: async (notebookId: string, sourceId: string) => {
    await client.delete(`/notebook/${notebookId}/source/${sourceId}`)
  },

  // Chat / RAG
  ask: async (id: string, question: string) => {
    const r = await client.post<NotebookAskResponse>(`/notebook/${id}/ask`, { question })
    return r.data
  },

  // Study tools
  generateQuiz: async (id: string, count = 10, difficulty = 'mixed') => {
    const r = await client.post<import('../types').QuizQuestion[]>(`/notebook/${id}/quiz`, { count, difficulty }, { timeout: 60000 })
    return r.data
  },
  getFlashcards: async (id: string) => {
    const r = await client.get<import('../types').Flashcard[]>(`/notebook/${id}/flashcards`, { timeout: 60000 })
    return r.data
  },
  getSummary: async (id: string) => {
    const r = await client.get<{ summary: string; key_points: string[]; chapter_title: string }>(`/notebook/${id}/summary`, { timeout: 60000 })
    return r.data
  },
}

// ── History ────────────────────────────────────────────────────────────────────

export interface HistoryItem {
  id: string
  question: string
  answer: string
  cost_tier: number
  cost_usd: number
  cached: boolean
  subject?: string
  chapter?: number
  mode?: string
  created_at: string
}

export const historyApi = {
  list: async (limit = 50, offset = 0) => {
    const r = await client.get<HistoryItem[]>('/query/history', { params: { limit, offset } })
    return r.data
  },
}

// ── Visual / Diagram ──────────────────────────────────────────────────────────

export const visualApi = {
  generateDiagram: async (req: DiagramRequest) => {
    const r = await client.post<DiagramResponse>('/visual/diagram', req)
    return r.data
  },
  generateConceptMap: async (centralConcept: string, relatedConcepts: string[], subject: string) => {
    const r = await client.post<DiagramResponse>('/visual/concept-map', { central_concept: centralConcept, related_concepts: relatedConcepts, subject })
    return r.data
  },
  generateImage: async (concept: string, subject: string, style = 'educational') => {
    const r = await client.post<DiagramResponse>('/visual/image', { concept, subject, style })
    return r.data
  },
  generateFlowchart: async (processName: string, steps: string[], subject: string) => {
    const r = await client.post<DiagramResponse>('/visual/flowchart', { process_name: processName, steps, subject })
    return r.data
  },
  getTemplates: async () => {
    const r = await client.get<{ id: string; name: string; description: string; example: string }[]>('/visual/templates')
    return r.data
  },
}
