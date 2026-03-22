import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, FileText, Upload, Trash2, Send, BookOpen, CheckCircle, AlertCircle, Loader2, X, ChevronDown, ChevronUp, FolderOpen } from 'lucide-react'
import { Navbar } from '../components/Navbar'
import { notebookApi, type NotebookInfo, type NotebookSource, type NotebookAskResponse } from '../services/api'
import ReactMarkdown from 'react-markdown'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: NotebookAskResponse['sources']
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  if (status === 'ready') return <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle className="w-3 h-3" />Ready</span>
  if (status === 'error') return <span className="flex items-center gap-1 text-xs text-red-500"><AlertCircle className="w-3 h-3" />Error</span>
  if (status === 'empty') return <span className="text-xs text-gray-400">No sources</span>
  return <span className="flex items-center gap-1 text-xs text-amber-500"><Loader2 className="w-3 h-3 animate-spin" />Processing</span>
}

// ── Create Notebook Modal ─────────────────────────────────────────────────────
function CreateNotebookModal({ onClose, onCreated }: { onClose: () => void; onCreated: (nb: NotebookInfo) => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!title.trim()) { toast.error('Title is required'); return }
    setLoading(true)
    try {
      const res = await notebookApi.create(title.trim(), description.trim())
      onCreated({ ...res, description: description.trim(), status: 'empty', total_chunks: 0, source_count: 0, created_at: new Date().toISOString() })
      onClose()
      toast.success('Notebook created!')
    } catch {
      toast.error('Failed to create notebook')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">New Notebook</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Notebook name *</label>
            <input
              value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Physics Unit 3, Biology Notes..."
              autoFocus
              onKeyDown={e => e.key === 'Enter' && submit()}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Description (optional)</label>
            <input
              value={description} onChange={e => setDescription(e.target.value)}
              placeholder="What's this notebook about?"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <p className="text-xs text-gray-400">You can add PDFs and text notes to this notebook after creating it.</p>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Notebook
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Add Source Modal ──────────────────────────────────────────────────────────
function AddSourceModal({ notebookId, onClose, onAdded }: { notebookId: string; onClose: () => void; onAdded: (src: NotebookSource) => void }) {
  const [tab, setTab] = useState<'text' | 'pdf'>('text')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const submit = async () => {
    setLoading(true)
    try {
      let res: NotebookSource
      if (tab === 'pdf') {
        if (!file) { toast.error('Select a PDF file'); setLoading(false); return }
        res = await notebookApi.addPdf(notebookId, file, title.trim())
      } else {
        if (!content.trim()) { toast.error('Content is required'); setLoading(false); return }
        res = await notebookApi.addText(notebookId, title.trim() || 'Untitled Note', content.trim())
      }
      toast.success('Document added! Processing...')
      onAdded(res)
      onClose()
    } catch {
      toast.error('Failed to add document')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Add Document</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {([['text', 'Paste Text', FileText], ['pdf', 'Upload PDF', Upload]] as const).map(([id, label, Icon]) => (
              <button key={id} onClick={() => setTab(id)}
                className={clsx('flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors',
                  tab === id ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                <Icon className="w-4 h-4" />{label}
              </button>
            ))}
          </div>
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder={tab === 'pdf' ? 'Document title (optional, defaults to filename)' : 'Document title (optional)'}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          {tab === 'text' ? (
            <textarea value={content} onChange={e => setContent(e.target.value)}
              placeholder="Paste your notes, textbook content, articles, research papers..."
              rows={8}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
          ) : (
            <div onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors">
              <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              {file ? (
                <p className="text-sm font-medium text-primary-700">{file.name}</p>
              ) : (
                <>
                  <p className="text-sm text-gray-500">Click to select a PDF</p>
                  <p className="text-xs text-gray-400 mt-1">Textbooks, notes, articles</p>
                </>
              )}
              <input ref={fileRef} type="file" accept=".pdf" className="hidden"
                onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </div>
          )}
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Adding...' : 'Add Document'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export const NotebookPage: React.FC = () => {
  const [notebooks, setNotebooks] = useState<NotebookInfo[]>([])
  const [selected, setSelected] = useState<NotebookInfo | null>(null)
  const [sources, setSources] = useState<NotebookSource[]>([])
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingList, setLoadingList] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showAddSource, setShowAddSource] = useState(false)

  const loadNotebooks = useCallback(async () => {
    try {
      const data = await notebookApi.list()
      setNotebooks(data)
    } catch {
      toast.error('Failed to load notebooks')
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => { loadNotebooks() }, [loadNotebooks])

  // Poll processing notebooks
  useEffect(() => {
    const processing = notebooks.filter(n => n.status === 'processing')
    if (processing.length === 0) return
    const interval = setInterval(async () => {
      const updates = await Promise.all(processing.map(n => notebookApi.status(n.id).catch(() => null)))
      setNotebooks(prev => prev.map(nb => {
        const u = updates.find(u => u?.id === nb.id)
        return u ? { ...nb, status: u.status as NotebookInfo['status'], total_chunks: u.total_chunks } : nb
      }))
      if (selected) {
        const u = updates.find(u => u?.id === selected.id)
        if (u) setSelected(prev => prev ? { ...prev, status: u.status as NotebookInfo['status'], total_chunks: u.total_chunks } : prev)
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [notebooks, selected])

  // Poll processing sources
  useEffect(() => {
    const processing = sources.filter(s => s.status === 'processing')
    if (processing.length === 0) return
    const interval = setInterval(async () => {
      if (!selected) return
      try {
        const updated = await notebookApi.listSources(selected.id)
        setSources(updated)
        // Also refresh notebook status
        const nbStatus = await notebookApi.status(selected.id)
        setSelected(prev => prev ? { ...prev, status: nbStatus.status as NotebookInfo['status'], total_chunks: nbStatus.total_chunks } : prev)
        setNotebooks(prev => prev.map(nb => nb.id === selected.id ? { ...nb, status: nbStatus.status as NotebookInfo['status'], total_chunks: nbStatus.total_chunks } : nb))
      } catch {}
    }, 3000)
    return () => clearInterval(interval)
  }, [sources, selected])

  const selectNotebook = async (nb: NotebookInfo) => {
    setSelected(nb)
    setSourcesOpen(false)
    setMessages([{
      id: uid(), role: 'assistant',
      content: `📖 **${nb.title}** is ready.\n\nAsk me anything about the documents in this notebook!`
    }])
    try {
      const srcs = await notebookApi.listSources(nb.id)
      setSources(srcs)
    } catch {
      setSources([])
    }
  }

  const handleSourceAdded = (src: NotebookSource) => {
    setSources(prev => [...prev, src])
    setSelected(prev => prev ? { ...prev, status: 'processing', source_count: (prev.source_count || 0) + 1 } : prev)
    setNotebooks(prev => prev.map(nb => nb.id === selected?.id ? { ...nb, status: 'processing', source_count: (nb.source_count || 0) + 1 } : nb))
  }

  const deleteSource = async (src: NotebookSource) => {
    if (!selected || !confirm(`Remove "${src.title}" from this notebook?`)) return
    try {
      await notebookApi.deleteSource(selected.id, src.id)
      setSources(prev => prev.filter(s => s.id !== src.id))
      toast.success('Document removed')
      // Refresh notebook status
      const nbStatus = await notebookApi.status(selected.id)
      setSelected(prev => prev ? { ...prev, status: nbStatus.status as NotebookInfo['status'], total_chunks: nbStatus.total_chunks } : prev)
      setNotebooks(prev => prev.map(nb => nb.id === selected.id ? { ...nb, status: nbStatus.status as NotebookInfo['status'], source_count: Math.max(0, nb.source_count - 1) } : nb))
    } catch {
      toast.error('Failed to remove document')
    }
  }

  const deleteNotebook = async (nb: NotebookInfo, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Delete notebook "${nb.title}" and all its documents?`)) return
    try {
      await notebookApi.delete(nb.id)
      setNotebooks(prev => prev.filter(n => n.id !== nb.id))
      if (selected?.id === nb.id) { setSelected(null); setMessages([]); setSources([]) }
      toast.success('Notebook deleted')
    } catch {
      toast.error('Failed to delete notebook')
    }
  }

  const sendQuestion = async () => {
    if (!input.trim() || !selected || loading) return
    if (selected.status !== 'ready') { toast.error('Add some documents first and wait for processing'); return }
    const q = input.trim()
    setInput('')
    setMessages(prev => [...prev, { id: uid(), role: 'user', content: q }])
    setLoading(true)
    try {
      const res = await notebookApi.ask(selected.id, q)
      setMessages(prev => [...prev, { id: uid(), role: 'assistant', content: res.answer, sources: res.sources }])
    } catch {
      setMessages(prev => [...prev, { id: uid(), role: 'assistant', content: "Sorry, I couldn't answer that. Please try again." }])
    } finally {
      setLoading(false)
    }
  }

  const canChat = selected?.status === 'ready'

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Navbar />

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-100 flex flex-col shrink-0">
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-semibold text-gray-900 text-sm">My Notebooks</h2>
              <button onClick={() => setShowCreate(true)}
                className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-2.5 py-1.5 rounded-lg transition-colors">
                <Plus className="w-3.5 h-3.5" />New
              </button>
            </div>
            <p className="text-xs text-gray-400">Collections of documents you can chat with</p>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loadingList ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
              </div>
            ) : notebooks.length === 0 ? (
              <div className="text-center py-8 px-3">
                <FolderOpen className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-xs text-gray-400">No notebooks yet</p>
              </div>
            ) : notebooks.map(nb => (
              <button key={nb.id} onClick={() => selectNotebook(nb)}
                className={clsx('w-full text-left px-3 py-2.5 rounded-xl transition-all group relative',
                  selected?.id === nb.id
                    ? 'bg-primary-50 border border-primary-200'
                    : 'hover:bg-gray-50 border border-transparent')}>
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate">{nb.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <StatusBadge status={nb.status} />
                      {nb.source_count > 0 && (
                        <span className="text-xs text-gray-400">{nb.source_count} doc{nb.source_count !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>
                  <button onClick={e => deleteNotebook(nb, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-all shrink-0 mt-0.5">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Right panel */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          {selected ? (
            <>
              {/* Header */}
              <div className="bg-white border-b border-gray-100 px-5 py-3 shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">{selected.title}</h3>
                    {selected.description && <p className="text-xs text-gray-400 mt-0.5">{selected.description}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={selected.status} />
                    <button onClick={() => setShowAddSource(true)}
                      className="flex items-center gap-1.5 text-xs font-medium bg-primary-600 text-white px-3 py-1.5 rounded-lg hover:bg-primary-700 transition-colors">
                      <Plus className="w-3.5 h-3.5" /> Add Document
                    </button>
                  </div>
                </div>
              </div>

              {/* Sources strip (collapsible) */}
              {sources.length > 0 && (
                <div className="bg-gray-50 border-b border-gray-100 shrink-0">
                  <button
                    onClick={() => setSourcesOpen(v => !v)}
                    className="w-full flex items-center justify-between px-5 py-2 text-xs text-gray-500 hover:text-gray-700 transition-colors">
                    <span className="font-medium">{sources.length} document{sources.length !== 1 ? 's' : ''} in this notebook</span>
                    {sourcesOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  {sourcesOpen && (
                    <div className="px-5 pb-3 space-y-1.5 max-h-48 overflow-y-auto">
                      {sources.map(src => (
                        <div key={src.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm shrink-0">{src.source_type === 'pdf' ? '📄' : '📝'}</span>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-gray-700 truncate">{src.title}</p>
                              <StatusBadge status={src.status} />
                            </div>
                          </div>
                          <button onClick={() => deleteSource(src)}
                            className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors shrink-0 ml-2">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4 space-y-4">
                {selected.status === 'empty' && (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center mb-3">
                      <BookOpen className="w-7 h-7 text-primary-400" />
                    </div>
                    <p className="text-sm font-medium text-gray-700 mb-1">No documents yet</p>
                    <p className="text-xs text-gray-400 mb-4">Add PDFs or paste text to start chatting with your content</p>
                    <button onClick={() => setShowAddSource(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700">
                      <Plus className="w-4 h-4" /> Add your first document
                    </button>
                  </div>
                )}

                {selected.status !== 'empty' && messages.map(msg => (
                  <div key={msg.id} className={clsx('flex gap-3', msg.role === 'user' && 'flex-row-reverse')}>
                    <div className={clsx('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                      msg.role === 'user' ? 'bg-primary-600 text-white' : 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white')}>
                      {msg.role === 'user' ? 'U' : '📖'}
                    </div>
                    <div className={clsx('max-w-[75%] rounded-2xl px-4 py-3 text-sm',
                      msg.role === 'user'
                        ? 'bg-primary-600 text-white rounded-tr-sm'
                        : 'bg-white border border-gray-100 shadow-sm text-gray-800 rounded-tl-sm')}>
                      <ReactMarkdown className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2">
                        {msg.content}
                      </ReactMarkdown>
                      {msg.sources && msg.sources.length > 0 && (
                        <details className="mt-3 text-xs">
                          <summary className="cursor-pointer text-gray-400 hover:text-gray-600">
                            {msg.sources.length} source{msg.sources.length > 1 ? 's' : ''}
                          </summary>
                          <div className="mt-2 space-y-1.5">
                            {msg.sources.map((s, i) => (
                              <div key={i} className="bg-gray-50 rounded-lg p-2 border border-gray-100">
                                <p className="text-gray-600">{s.content}...</p>
                                <p className="text-gray-400 mt-0.5">{s.page ? `Page ${s.page} · ` : ''}Match: {(s.score * 100).toFixed(0)}%</p>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-xs">📖</div>
                    <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-tl-sm px-4 py-3">
                      <div className="flex gap-1">{[0, 1, 2].map(i => <span key={i} className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />)}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              {selected.status !== 'empty' && (
                <div className="bg-white border-t border-gray-100 px-4 py-3 shrink-0">
                  {!canChat && selected.status === 'processing' && (
                    <p className="text-xs text-amber-500 text-center mb-2 flex items-center justify-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Processing documents, please wait...
                    </p>
                  )}
                  <div className="flex items-end gap-2">
                    <textarea value={input} onChange={e => setInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuestion() } }}
                      placeholder={canChat ? `Ask anything about "${selected.title}"...` : 'Waiting for documents to be processed...'}
                      disabled={loading || !canChat}
                      rows={1} className="flex-1 px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none text-sm disabled:opacity-50 max-h-32"
                      style={{ minHeight: '48px' }}
                      onInput={e => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 128) + 'px' }} />
                    <button onClick={sendQuestion} disabled={!input.trim() || loading || !canChat}
                      className="p-3 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 disabled:opacity-50 transition-colors shrink-0 shadow-sm">
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* No notebook selected */
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              {notebooks.length > 0 ? (
                <>
                  <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                    <FolderOpen className="w-8 h-8 text-gray-300" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-700 mb-1">Select a notebook</h3>
                  <p className="text-sm text-gray-400">Choose a notebook from the sidebar to start chatting</p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4">
                    <BookOpen className="w-8 h-8 text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Your Personal AI Notebook</h3>
                  <p className="text-gray-400 text-sm max-w-sm mb-6">
                    Create notebooks to organize your study material. Each notebook can hold multiple PDFs and text notes — then chat with all of them at once.
                  </p>
                  <button onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors">
                    <Plus className="w-4 h-4" /> Create your first notebook
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateNotebookModal
          onClose={() => setShowCreate(false)}
          onCreated={nb => { setNotebooks(prev => [nb, ...prev]); selectNotebook(nb) }}
        />
      )}
      {showAddSource && selected && (
        <AddSourceModal
          notebookId={selected.id}
          onClose={() => setShowAddSource(false)}
          onAdded={handleSourceAdded}
        />
      )}
    </div>
  )
}
