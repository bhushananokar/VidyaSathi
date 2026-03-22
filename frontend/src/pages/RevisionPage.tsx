import React, { useState } from 'react'
import { BookMarked, RotateCcw, Check, X, Download, ChevronLeft, ChevronRight, Loader2, NotebookPen, BookOpen } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Navbar } from '../components/Navbar'
import { OfflineBanner } from '../components/OfflineBanner'
import { quizApi, adminApi, offlineApi, notebookApi } from '../services/api'
import { offlineCache } from '../services/offlineCache'
import type { Flashcard, TextbookInfo } from '../types'
import type { NotebookInfo } from '../services/api'
import toast from 'react-hot-toast'
import clsx from 'clsx'

type RevisionMode = 'setup' | 'summary' | 'flashcards'
type SourceType = 'textbook' | 'notebook'

export const RevisionPage: React.FC = () => {
  const [mode, setMode] = useState<RevisionMode>('setup')
  const [sourceType, setSourceType] = useState<SourceType>('textbook')
  const [textbooks, setTextbooks] = useState<TextbookInfo[]>([])
  const [notebooks, setNotebooks] = useState<NotebookInfo[]>([])
  const [selectedTextbook, setSelectedTextbook] = useState('')
  const [selectedChapter, setSelectedChapter] = useState(1)
  const [selectedNotebook, setSelectedNotebook] = useState('')
  const [loading, setLoading] = useState(false)

  const [summary, setSummary] = useState('')
  const [keyPoints, setKeyPoints] = useState<string[]>([])
  const [chapterTitle, setChapterTitle] = useState('')

  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [cardIndex, setCardIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [known, setKnown] = useState<string[]>([])
  const [unknown, setUnknown] = useState<string[]>([])

  React.useEffect(() => {
    adminApi.listTextbooks().then(setTextbooks).catch(() => {})
    notebookApi.list().then(setNotebooks).catch(() => {})
  }, [])

  const handleSummary = async () => {
    setLoading(true)
    try {
      if (sourceType === 'notebook') {
        if (!selectedNotebook) { toast.error('Select a notebook'); setLoading(false); return }
        const res = await notebookApi.getSummary(selectedNotebook)
        setSummary(res.summary)
        setKeyPoints(res.key_points)
        setChapterTitle(res.chapter_title)
      } else {
        if (!selectedTextbook) { toast.error('Select a textbook'); setLoading(false); return }
        const res = await quizApi.getRevisionSummary(selectedTextbook, selectedChapter)
        setSummary(res.summary)
        setKeyPoints(res.key_points)
        setChapterTitle(res.chapter_title)
      }
      setMode('summary')
    } catch {
      toast.error('Failed to load summary')
    } finally {
      setLoading(false)
    }
  }

  const handleFlashcards = async () => {
    setLoading(true)
    try {
      let cards: Flashcard[]
      if (sourceType === 'notebook') {
        if (!selectedNotebook) { toast.error('Select a notebook'); setLoading(false); return }
        cards = await notebookApi.getFlashcards(selectedNotebook)
      } else {
        if (!selectedTextbook) { toast.error('Select a textbook'); setLoading(false); return }
        cards = await quizApi.getFlashcards(selectedTextbook, selectedChapter)
      }
      setFlashcards(cards)
      setCardIndex(0)
      setFlipped(false)
      setKnown([])
      setUnknown([])
      setMode('flashcards')
    } catch {
      toast.error('Failed to load flashcards')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    // Find available content pack and download
    try {
      const packs = await offlineApi.listContentPacks()
      const pack = packs.find((p) => p.textbook_id === selectedTextbook && p.chapter === selectedChapter)
      if (!pack) { toast.error('No offline pack available for this chapter. Ask admin to generate one.'); return }
      toast.loading('Downloading...')
      const data = await offlineApi.downloadPack(pack.id)
      await offlineCache.saveContentPack(pack.id, data, { subject: pack.subject, chapter: pack.chapter, chapter_title: pack.chapter_title })
      toast.dismiss()
      toast.success('Downloaded for offline use!')
    } catch {
      toast.dismiss()
      toast.error('Download failed')
    }
  }

  const currentCard = flashcards[cardIndex]
  const progressPct = flashcards.length ? ((known.length + unknown.length) / flashcards.length) * 100 : 0

  const handleKnow = () => {
    if (!currentCard) return
    setKnown((prev) => [...prev, currentCard.id])
    setFlipped(false)
    if (cardIndex < flashcards.length - 1) setCardIndex(cardIndex + 1)
  }

  const handleDontKnow = () => {
    if (!currentCard) return
    setUnknown((prev) => [...prev, currentCard.id])
    setFlipped(false)
    if (cardIndex < flashcards.length - 1) setCardIndex(cardIndex + 1)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <OfflineBanner />
      <main className="max-w-2xl mx-auto px-4 py-8">

        {/* Setup */}
        {mode === 'setup' && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <BookMarked className="w-8 h-8 text-emerald-500" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Revision Mode</h1>
              <p className="text-gray-500 mt-1">Summaries and flashcards for quick review</p>
            </div>

            {/* Source toggle */}
            <div className="flex rounded-xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => setSourceType('textbook')}
                className={clsx('flex-1 py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors',
                  sourceType === 'textbook' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                )}
              >
                <BookOpen className="w-4 h-4" /> Textbook
              </button>
              <button
                onClick={() => setSourceType('notebook')}
                className={clsx('flex-1 py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors',
                  sourceType === 'notebook' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                )}
              >
                <NotebookPen className="w-4 h-4" /> My Notebook
              </button>
            </div>

            <div className="space-y-4">
              {sourceType === 'notebook' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Notebook</label>
                  <select
                    value={selectedNotebook}
                    onChange={(e) => setSelectedNotebook(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Select a notebook...</option>
                    {notebooks.filter((n) => n.status === 'ready').map((n) => (
                      <option key={n.id} value={n.id}>{n.title}</option>
                    ))}
                  </select>
                  {notebooks.filter((n) => n.status === 'ready').length === 0 && (
                    <p className="text-xs text-gray-400 mt-1.5">No ready notebooks. Add one in the Notebook section.</p>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Textbook</label>
                    <select
                      value={selectedTextbook}
                      onChange={(e) => setSelectedTextbook(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Select a textbook...</option>
                      {textbooks.filter((t) => t.status === 'ready').map((t) => (
                        <option key={t.id} value={t.id}>{t.title} — Grade {t.grade}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Chapter</label>
                    <select
                      value={selectedChapter}
                      onChange={(e) => setSelectedChapter(Number(e.target.value))}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      {Array.from({ length: 15 }, (_, i) => i + 1).map((c) => (
                        <option key={c} value={c}>Chapter {c}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleSummary}
                disabled={loading || (sourceType === 'notebook' ? !selectedNotebook : !selectedTextbook)}
                className="py-4 border-2 border-emerald-200 rounded-2xl text-emerald-700 font-semibold hover:bg-emerald-50 disabled:opacity-50 flex flex-col items-center gap-1.5 transition-colors"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <span className="text-2xl">📄</span>}
                <span>Chapter Summary</span>
                <span className="text-xs text-emerald-500 font-normal">Key points + explanation</span>
              </button>
              <button
                onClick={handleFlashcards}
                disabled={loading || (sourceType === 'notebook' ? !selectedNotebook : !selectedTextbook)}
                className="py-4 border-2 border-primary-200 rounded-2xl text-primary-700 font-semibold hover:bg-primary-50 disabled:opacity-50 flex flex-col items-center gap-1.5 transition-colors"
              >
                <span className="text-2xl">🃏</span>
                <span>Flashcards</span>
                <span className="text-xs text-primary-400 font-normal">Spaced repetition style</span>
              </button>
            </div>

            {sourceType === 'textbook' && (
              <button
                onClick={handleDownload}
                disabled={!selectedTextbook}
                className="w-full py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" /> Download for Offline Use
              </button>
            )}
          </div>
        )}

        {/* Summary */}
        {mode === 'summary' && (
          <div className="space-y-4">
            <button onClick={() => setMode('setup')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-5">
                <p className="text-emerald-100 text-xs font-semibold uppercase tracking-wide">Chapter Summary</p>
                <h2 className="text-white text-xl font-bold mt-1">{chapterTitle}</h2>
              </div>

              <div className="p-6 space-y-5">
                {keyPoints.length > 0 && (
                  <div>
                    <p className="text-sm font-bold text-gray-700 mb-3">🔑 Key Points</p>
                    <div className="space-y-2">
                      {keyPoints.map((point, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                          <p className="text-sm text-gray-700 leading-relaxed">{point}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-sm font-bold text-gray-700 mb-3">📖 Full Summary</p>
                  <div className="prose prose-sm max-w-none text-gray-600 leading-relaxed">
                    <ReactMarkdown>{summary}</ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleFlashcards}
              disabled={loading}
              className="w-full py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Practice with Flashcards <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Flashcards */}
        {mode === 'flashcards' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <button onClick={() => setMode('setup')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <span className="text-sm text-gray-500">{cardIndex + 1} / {flashcards.length}</span>
            </div>

            {/* Progress */}
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div className="h-2 bg-emerald-400 rounded-full transition-all" style={{ width: `${(known.length / flashcards.length) * 100}%` }} />
              </div>
              <span className="text-xs text-emerald-600 font-medium">✓ {known.length}</span>
              <span className="text-xs text-red-400 font-medium">✗ {unknown.length}</span>
            </div>

            {/* Card */}
            {currentCard && known.length + unknown.length < flashcards.length ? (
              <>
                <div
                  onClick={() => setFlipped(!flipped)}
                  className="bg-white rounded-3xl shadow-md border border-gray-100 p-8 min-h-48 flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-lg transition-shadow"
                >
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">{flipped ? 'Answer' : 'Question'}</p>
                  <p className="text-lg font-semibold text-gray-900 leading-relaxed">
                    {flipped ? currentCard.back : currentCard.front}
                  </p>
                  {!flipped && (
                    <p className="text-xs text-primary-400 mt-6">Tap to reveal answer</p>
                  )}
                  <span className={clsx('mt-4 text-xs px-2.5 py-1 rounded-full font-medium',
                    currentCard.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700' :
                    currentCard.difficulty === 'medium' ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  )}>{currentCard.topic}</span>
                </div>

                {flipped && (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleDontKnow}
                      className="py-4 bg-red-50 border-2 border-red-200 rounded-2xl text-red-600 font-semibold hover:bg-red-100 flex items-center justify-center gap-2"
                    >
                      <X className="w-5 h-5" /> Don't Know
                    </button>
                    <button
                      onClick={handleKnow}
                      className="py-4 bg-emerald-50 border-2 border-emerald-200 rounded-2xl text-emerald-600 font-semibold hover:bg-emerald-100 flex items-center justify-center gap-2"
                    >
                      <Check className="w-5 h-5" /> Know It!
                    </button>
                  </div>
                )}
              </>
            ) : (
              // Done
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 text-center space-y-4">
                <div className="text-5xl">🎉</div>
                <h3 className="text-xl font-bold text-gray-900">Flashcards Complete!</h3>
                <div className="flex justify-center gap-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-emerald-600">{known.length}</p>
                    <p className="text-sm text-gray-500">Knew</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-400">{unknown.length}</p>
                    <p className="text-sm text-gray-500">To Review</p>
                  </div>
                </div>
                <button
                  onClick={() => { setCardIndex(0); setFlipped(false); setKnown([]); setUnknown([]) }}
                  className="w-full py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> Practice Again
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
