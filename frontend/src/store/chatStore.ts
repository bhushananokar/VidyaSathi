import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Message, QueryMode, OfflineQueueItem, SyncStatus } from '../types'

interface ConversationMap {
  [conversationId: string]: Message[]
}

interface ChatState {
  conversations: ConversationMap
  currentConversationId: string | null
  currentSubject: string
  currentChapter: number | null
  currentMode: QueryMode
  sessionCostUsd: number
  sessionTokens: number
  sessionQueries: number
  sessionCachedQueries: number
  offlineQueue: OfflineQueueItem[]
  syncStatus: SyncStatus
  isLoading: boolean

  setCurrentSubject: (subject: string) => void
  setCurrentChapter: (chapter: number | null) => void
  setCurrentMode: (mode: QueryMode) => void
  startConversation: (id: string) => void
  addMessage: (conversationId: string, message: Message) => void
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void
  clearConversation: (conversationId: string) => void
  addToOfflineQueue: (item: OfflineQueueItem) => void
  removeFromOfflineQueue: (id: string) => void
  clearOfflineQueue: () => void
  updateSyncStatus: (status: Partial<SyncStatus>) => void
  addCost: (costUsd: number, tokens: number, cached: boolean) => void
  setLoading: (loading: boolean) => void
  resetSession: () => void
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      conversations: {},
      currentConversationId: null,
      currentSubject: 'Science',
      currentChapter: null,
      currentMode: 'ask',
      sessionCostUsd: 0,
      sessionTokens: 0,
      sessionQueries: 0,
      sessionCachedQueries: 0,
      offlineQueue: [],
      syncStatus: { last_synced: null, queued_count: 0, is_syncing: false },
      isLoading: false,

      setCurrentSubject: (subject) => set({ currentSubject: subject }),
      setCurrentChapter: (chapter) => set({ currentChapter: chapter }),
      setCurrentMode: (mode) => set({ currentMode: mode }),

      startConversation: (id) =>
        set((state) => ({
          currentConversationId: id,
          conversations: state.conversations[id]
            ? state.conversations
            : { ...state.conversations, [id]: [] },
        })),

      addMessage: (conversationId, message) =>
        set((state) => ({
          conversations: {
            ...state.conversations,
            [conversationId]: [...(state.conversations[conversationId] || []), message],
          },
        })),

      updateMessage: (conversationId, messageId, updates) =>
        set((state) => ({
          conversations: {
            ...state.conversations,
            [conversationId]: (state.conversations[conversationId] || []).map((m) =>
              m.id === messageId ? { ...m, ...updates } : m
            ),
          },
        })),

      clearConversation: (conversationId) =>
        set((state) => {
          const next = { ...state.conversations }
          delete next[conversationId]
          return { conversations: next }
        }),

      addToOfflineQueue: (item) =>
        set((state) => ({
          offlineQueue: [...state.offlineQueue, item],
          syncStatus: { ...state.syncStatus, queued_count: state.offlineQueue.length + 1 },
        })),

      removeFromOfflineQueue: (id) =>
        set((state) => {
          const updated = state.offlineQueue.filter((i) => i.id !== id)
          return { offlineQueue: updated, syncStatus: { ...state.syncStatus, queued_count: updated.length } }
        }),

      clearOfflineQueue: () =>
        set({ offlineQueue: [], syncStatus: { last_synced: new Date().toISOString(), queued_count: 0, is_syncing: false } }),

      updateSyncStatus: (status) =>
        set((state) => ({ syncStatus: { ...state.syncStatus, ...status } })),

      addCost: (costUsd, tokens, cached) =>
        set((state) => ({
          sessionCostUsd: state.sessionCostUsd + costUsd,
          sessionTokens: state.sessionTokens + tokens,
          sessionQueries: state.sessionQueries + 1,
          sessionCachedQueries: cached ? state.sessionCachedQueries + 1 : state.sessionCachedQueries,
        })),

      setLoading: (loading) => set({ isLoading: loading }),

      resetSession: () =>
        set({ sessionCostUsd: 0, sessionTokens: 0, sessionQueries: 0, sessionCachedQueries: 0 }),
    }),
    {
      name: 'vidyasathi-chat',
      partialize: (state) => ({
        offlineQueue: state.offlineQueue,
        syncStatus: state.syncStatus,
        currentSubject: state.currentSubject,
      }),
    }
  )
)
