export interface StudentProfile {
  id: string
  name: string
  grade: number
  board: string
  school?: string
  learning_profile: LearningProfile
  xp: number
  streak: number
  last_active: string
  created_at: string
}

export interface LearningProfile {
  visual: number
  auditory: number
  read_write: number
  kinesthetic: number
}

export interface TextbookInfo {
  id: string
  title: string
  subject: string
  grade: number
  board: string
  status: 'pending' | 'processing' | 'ready' | 'error'
  total_chunks: number
  created_at: string
}

export type MessageRole = 'student' | 'assistant' | 'system'
export type CostTier = 0 | 1 | 2 | 3
export type QueryMode = 'explain' | 'doubt' | 'solve' | 'quiz' | 'revision' | 'ask'

export interface MessageSource {
  chapter: string
  chapter_title: string
  topic: string
  page_no: number
  textbook: string
}

export interface Message {
  id: string
  role: MessageRole
  content: string
  timestamp: string
  cost_tier?: CostTier
  cached?: boolean
  tokens_used?: number
  cost_usd?: number
  sources?: MessageSource[]
  mermaid_diagram?: string
  image_data?: ImageData
  is_queued?: boolean
  audio_url?: string
}

export interface ImageData {
  type: 'mermaid' | 'svg' | 'description'
  content: string
  alt_text: string
}

export interface QuizQuestion {
  id: string
  type: 'mcq' | 'fill_blank' | 'true_false'
  question: string
  options?: string[]
  correct_answer: string
  explanation: string
  difficulty: 'easy' | 'medium' | 'hard'
  topic: string
}

export interface QuizResult {
  score: number
  total: number
  percentage: number
  xp_earned: number
  mastery_delta: number
  weak_topics: string[]
  per_question: PerQuestionResult[]
}

export interface PerQuestionResult {
  question_id: string
  correct: boolean
  student_answer: string
  correct_answer: string
  explanation: string
}

export interface Flashcard {
  id: string
  front: string
  back: string
  topic: string
  difficulty: 'easy' | 'medium' | 'hard'
  due_date?: string
}

export interface ContentPackInfo {
  id: string
  textbook_id: string
  subject: string
  chapter: number
  chapter_title: string
  grade: number
  board: string
  version: string
  size_bytes: number
  created_at: string
}

export interface CostMetrics {
  total_queries: number
  cached_queries: number
  flash_queries: number
  pro_queries: number
  total_cost_usd: number
  baseline_cost_usd: number
  savings_pct: number
  cache_hit_rate: number
}

export interface ChapterMastery {
  chapter_id: number
  chapter_title: string
  subject: string
  mastery_pct: number
  weak_topics: string[]
  last_activity: string
}

export interface AssessmentQuestion {
  id: string
  concept: string
  modality: 'visual' | 'auditory' | 'read_write' | 'kinesthetic'
  content: string
  type: 'text' | 'diagram' | 'steps'
  options: string[]
  correct: string
}

export interface DiagramRequest {
  concept: string
  subject: string
  diagram_type: 'flowchart' | 'mindmap' | 'sequence' | 'timeline' | 'graph'
}

export interface DiagramResponse {
  type: 'mermaid' | 'svg' | 'description'
  content: string
  alt_text: string
  diagram_type: string
}

export interface OfflineQueueItem {
  id: string
  question: string
  subject: string
  chapter?: number
  mode: QueryMode
  timestamp: string
}

export interface SyncStatus {
  last_synced: string | null
  queued_count: number
  is_syncing: boolean
}

export interface TeacherClass {
  code: string
  name: string
  grade: number
  board: string
  student_count: number
  avg_mastery: number
  created_at: string
}
