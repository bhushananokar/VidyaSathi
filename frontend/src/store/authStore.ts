import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { StudentProfile } from '../types'

interface AuthState {
  token: string | null
  student: StudentProfile | null
  isOnline: boolean
  setToken: (token: string) => void
  setStudent: (student: StudentProfile) => void
  logout: () => void
  setOnline: (online: boolean) => void
  updateXP: (xp: number) => void
  updateStreak: (streak: number) => void
  refreshStudent: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      student: null,
      isOnline: navigator.onLine,

      setToken: (token) => set({ token }),

      setStudent: (student) => set({ student }),

      logout: () => set({ token: null, student: null }),

      setOnline: (online) => set({ isOnline: online }),

      updateXP: (xp) =>
        set((state) => ({
          student: state.student ? { ...state.student, xp } : null,
        })),

      updateStreak: (streak) =>
        set((state) => ({
          student: state.student ? { ...state.student, streak } : null,
        })),

      refreshStudent: async () => {
        try {
          const { authApi } = await import('../services/api')
          const updated = await authApi.getMe()
          set({ student: updated })
        } catch { /* ignore if offline */ }
      },
    }),
    {
      name: 'vidyasathi-auth',
      partialize: (state) => ({ token: state.token, student: state.student }),
    }
  )
)
