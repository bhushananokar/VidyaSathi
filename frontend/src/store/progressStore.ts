import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ChapterMastery, CostMetrics } from '../types'

interface ProgressState {
  chapterMastery: ChapterMastery[]
  totalXP: number
  streak: number
  badges: string[]
  costMetrics: CostMetrics
  quizHistory: QuizHistoryItem[]

  setChapterMastery: (mastery: ChapterMastery[]) => void
  updateChapterMastery: (chapterId: number, updates: Partial<ChapterMastery>) => void
  setTotalXP: (xp: number) => void
  addXP: (amount: number) => void
  setStreak: (streak: number) => void
  addBadge: (badge: string) => void
  setCostMetrics: (metrics: CostMetrics) => void
  addQuizHistory: (item: QuizHistoryItem) => void
}

export interface QuizHistoryItem {
  id: string
  subject: string
  chapter_title: string
  score: number
  total: number
  percentage: number
  xp_earned: number
  date: string
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set) => ({
      chapterMastery: [],
      totalXP: 0,
      streak: 0,
      badges: [],
      costMetrics: {
        total_queries: 0,
        cached_queries: 0,
        flash_queries: 0,
        pro_queries: 0,
        total_cost_usd: 0,
        baseline_cost_usd: 0,
        savings_pct: 0,
        cache_hit_rate: 0,
      },
      quizHistory: [],

      setChapterMastery: (mastery) => set({ chapterMastery: mastery }),

      updateChapterMastery: (chapterId, updates) =>
        set((state) => ({
          chapterMastery: state.chapterMastery.map((m) =>
            m.chapter_id === chapterId ? { ...m, ...updates } : m
          ),
        })),

      setTotalXP: (xp) => set({ totalXP: xp }),

      addXP: (amount) => set((state) => ({ totalXP: state.totalXP + amount })),

      setStreak: (streak) => set({ streak }),

      addBadge: (badge) =>
        set((state) => ({
          badges: state.badges.includes(badge) ? state.badges : [...state.badges, badge],
        })),

      setCostMetrics: (metrics) => set({ costMetrics: metrics }),

      addQuizHistory: (item) =>
        set((state) => ({ quizHistory: [item, ...state.quizHistory].slice(0, 50) })),
    }),
    { name: 'vidyasathi-progress' }
  )
)
