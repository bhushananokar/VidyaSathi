import React, { useState, useEffect, useCallback } from 'react'
import { Search, Clock, ChevronDown, ChevronUp, RotateCcw, Loader2, BookOpen, Zap, Database } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Navbar } from '../components/Navbar'
import { historyApi, type HistoryItem } from '../services/api'
import { useChatStore } from '../store/chatStore'
import ReactMarkdown from 'react-markdown'
import toast from 'react-hot-toast'
import clsx from 'clsx'

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupByDate(items: HistoryItem[]): Record<string, HistoryItem[]> {
  const now = new Date()
  const todayStr = now.toDateString()
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  const yesterdayStr = yesterday.toDateString()
  const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7)

  const groups: Record<string, HistoryItem[]> = {
    'Today': [],
    'Yesterday': [],
    'This Week': [],
    'Older': [],
  }

  for (const item of items) {
    const d = new Date(item.created_at)
    if (d.toDateString() === todayStr) groups['Today'].push(item)
    else if (d.toDateString() === yesterdayStr) groups['Yesterday'].push(item)
    else if (d >= weekAgo) groups['This Week'].push(item)
    else groups['Older'].push(item)
  }

  // Remove empty groups
  return Object.fromEntries(Object.entries(groups).filter(([, v]) => v.length > 0))
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function CostBadge({ tier, cached }: { tier: number; cached: boolean }) {
  if (cached) return (
    <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
      <Database className="w-3 h-3" />Cached
    </span>
  )
  if (tier <= 1) return (
    <span className="flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
      <Zap className="w-3 h-3" />Flash
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
      <BookOpen className="w-3 h-3" />Pro
    </span>
  )
}

// ── Item card ─────────────────────────────────────────────────────────────────
function HistoryCard({ item, onReask }: { item: HistoryItem; onReask: (q: string, subject?: string) => void }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 line-clamp-2">{item.question}</p>
            <div className="flex items-center flex-wrap gap-2 mt-2">
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />{formatTime(item.created_at)}
              </span>
              {item.subject && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{item.subject}</span>
              )}
              {item.mode && item.mode !== 'ask' && (
                <span className="text-xs text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full capitalize">{item.mode}</span>
              )}
              <CostBadge tier={item.cost_tier} cached={item.cached} />
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => onReask(item.question, item.subject)}
              className="p-2 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
              title="Ask again">
              <RotateCcw className="w-4 h-4" />
            </button>
            <button onClick={() => setExpanded(!expanded)}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t border-gray-50">
            <div className="bg-gray-50 rounded-xl p-3 text-sm">
              <ReactMarkdown className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 text-gray-700">
                {item.answer}
              </ReactMarkdown>
            </div>
            {item.cost_usd > 0 && (
              <p className="text-xs text-gray-400 mt-2 text-right">Cost: ${item.cost_usd.toFixed(5)}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export const HistoryPage: React.FC = () => {
  const navigate = useNavigate()
  const { setCurrentSubject } = useChatStore()
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const LIMIT = 50

  const load = useCallback(async (reset = false) => {
    if (reset) { setLoading(true); setOffset(0) }
    else setLoadingMore(true)
    try {
      const newOffset = reset ? 0 : offset
      const data = await historyApi.list(LIMIT, newOffset)
      setItems(prev => reset ? data : [...prev, ...data])
      setHasMore(data.length === LIMIT)
      if (!reset) setOffset(newOffset + data.length)
    } catch {
      toast.error('Failed to load history')
    } finally {
      setLoading(false); setLoadingMore(false)
    }
  }, [offset])

  useEffect(() => { load(true) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleReask = (question: string, subject?: string) => {
    if (subject) setCurrentSubject(subject)
    navigate('/chat', { state: { prefill: question } })
  }

  const filtered = search.trim()
    ? items.filter(i =>
        i.question.toLowerCase().includes(search.toLowerCase()) ||
        i.answer.toLowerCase().includes(search.toLowerCase())
      )
    : items

  const grouped = groupByDate(filtered)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <div className="max-w-3xl mx-auto w-full px-4 py-6 flex-1">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Learning History</h1>
          <p className="text-sm text-gray-400 mt-1">All your past questions and answers</p>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search questions and answers..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <Clock className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">No history yet</p>
            <p className="text-gray-300 text-sm mt-1">Your questions will appear here</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Search className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400">No results for "{search}"</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([group, groupItems]) => (
              <div key={group}>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{group}</h2>
                <div className="space-y-3">
                  {groupItems.map(item => (
                    <HistoryCard key={item.id} item={item} onReask={handleReask} />
                  ))}
                </div>
              </div>
            ))}

            {hasMore && !search && (
              <div className="text-center pt-2">
                <button onClick={() => load(false)} disabled={loadingMore}
                  className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50 flex items-center gap-2 mx-auto">
                  {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loadingMore ? 'Loading...' : 'Load more'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
