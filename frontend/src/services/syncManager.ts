import { offlineApi } from './api'
import { offlineCache } from './offlineCache'
import { useChatStore } from '../store/chatStore'

export const syncManager = {
  async syncOfflineQueue(): Promise<number> {
    const queue = await offlineCache.getQueuedQuestions()
    if (queue.length === 0) return 0

    const chatStore = useChatStore.getState()
    chatStore.updateSyncStatus({ is_syncing: true })

    try {
      const queries = queue.map((item) => ({
        question: item.question,
        subject: item.subject,
        chapter: item.chapter,
        mode: item.mode,
      }))

      const response = await offlineApi.batchSync(queries)
      const answers = response.answers

      // Cache answers locally
      await offlineCache.cacheAnswersBatch(
        answers.map((a, i) => ({
          question: a.question,
          answer: a.answer,
          subject: queue[i]?.subject || 'general',
        }))
      )

      // Remove synced items from queue
      for (const item of queue) {
        await offlineCache.removeQueuedQuestion(item.id)
        chatStore.removeFromOfflineQueue(item.id)
      }

      chatStore.updateSyncStatus({
        last_synced: new Date().toISOString(),
        queued_count: 0,
        is_syncing: false,
      })

      return answers.length
    } catch (err) {
      chatStore.updateSyncStatus({ is_syncing: false })
      throw err
    }
  },

  async downloadContentPack(packId: string, metadata: Record<string, unknown>): Promise<void> {
    const data = await offlineApi.downloadPack(packId)
    await offlineCache.saveContentPack(packId, data, metadata)
  },

  async pullAndCacheUpdates(since?: string): Promise<void> {
    try {
      const updates = await offlineApi.pullUpdates(since)
      if (updates.qa_pairs?.length) {
        await offlineCache.cacheAnswersBatch(
          updates.qa_pairs.map((p) => ({ question: p.question, answer: p.answer }))
        )
      }
    } catch { /* ignore when offline */ }
  },
}
