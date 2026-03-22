import React, { useState } from 'react'
import { WifiOff, RefreshCw, CheckCircle } from 'lucide-react'
import { useChatStore } from '../store/chatStore'
import { syncManager } from '../services/syncManager'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'

export const OfflineBanner: React.FC = () => {
  const isOnline = useAuthStore((s) => s.isOnline)
  const { syncStatus, offlineQueue } = useChatStore()
  const [syncing, setSyncing] = useState(false)

  const handleSync = async () => {
    if (!isOnline || syncing) return
    setSyncing(true)
    try {
      const count = await syncManager.syncOfflineQueue()
      toast.success(`Synced ${count} queued question${count !== 1 ? 's' : ''}!`)
    } catch {
      toast.error('Sync failed. Try again.')
    } finally {
      setSyncing(false)
    }
  }

  if (isOnline && offlineQueue.length === 0) return null

  return (
    <div className={`w-full px-4 py-2 flex items-center gap-3 text-sm font-medium transition-colors ${
      isOnline ? 'bg-emerald-50 border-b border-emerald-200 text-emerald-800' : 'bg-amber-50 border-b border-amber-200 text-amber-800'
    }`}>
      {isOnline ? (
        <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
      ) : (
        <WifiOff className="w-4 h-4 text-amber-500 shrink-0" />
      )}

      <span className="flex-1">
        {!isOnline
          ? `Offline mode — ${offlineQueue.length} question${offlineQueue.length !== 1 ? 's' : ''} queued`
          : `Back online — ${offlineQueue.length} question${offlineQueue.length !== 1 ? 's' : ''} waiting to sync`}
      </span>

      {syncStatus.last_synced && (
        <span className="text-xs opacity-70 hidden sm:block">
          Last synced: {new Date(syncStatus.last_synced).toLocaleTimeString()}
        </span>
      )}

      {isOnline && offlineQueue.length > 0 && (
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-1 px-2 py-1 bg-emerald-600 text-white rounded-md text-xs hover:bg-emerald-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync now'}
        </button>
      )}
    </div>
  )
}
