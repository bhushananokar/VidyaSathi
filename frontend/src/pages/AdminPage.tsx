import React, { useState, useRef, useEffect } from 'react'
import { Upload, Trash2, RefreshCw, Package, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react'
import { Navbar } from '../components/Navbar'
import { adminApi } from '../services/api'
import type { TextbookInfo } from '../types'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const SUBJECTS = ['Science', 'Mathematics', 'Social Science', 'History', 'Geography', 'English', 'Hindi', 'Marathi', 'Physics', 'Chemistry', 'Biology']
const BOARDS = ['Maharashtra SSC', 'CBSE', 'ICSE', 'Karnataka SSLC', 'Tamil Nadu SAMACHEER', 'UP Board']

export const AdminPage: React.FC = () => {
  const [textbooks, setTextbooks] = useState<TextbookInfo[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [loading, setLoading] = useState(true)

  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('Science')
  const [grade, setGrade] = useState(10)
  const [board, setBoard] = useState('Maharashtra SSC')
  const [file, setFile] = useState<File | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadTextbooks = async () => {
    try {
      const data = await adminApi.listTextbooks()
      setTextbooks(data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => {
    loadTextbooks()
    // Poll every 3s for processing textbooks
    pollRef.current = setInterval(() => {
      setTextbooks((prev) => {
        if (prev.some((t) => t.status === 'processing')) {
          loadTextbooks()
        }
        return prev
      })
    }, 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const handleUpload = async () => {
    if (!file || !title.trim()) { toast.error('Please select a PDF and enter a title'); return }
    setUploading(true)
    setUploadProgress(0)
    try {
      const res = await adminApi.uploadTextbook(file, title, subject, grade, board, setUploadProgress)
      toast.success(`Textbook uploaded! Processing started.`)
      setFile(null)
      setTitle('')
      if (fileRef.current) fileRef.current.value = ''
      loadTextbooks()
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This will remove all chunks and Q&A pairs.`)) return
    try {
      await adminApi.deleteTextbook(id)
      toast.success('Textbook deleted')
      setTextbooks((prev) => prev.filter((t) => t.id !== id))
    } catch {
      toast.error('Delete failed')
    }
  }

  const handleGenerateQA = async (id: string, chapter: number) => {
    try {
      const res = await adminApi.generateQA(id, chapter)
      toast.success(`Generated ${res.count} Q&A pairs for Chapter ${chapter}`)
    } catch {
      toast.error('Q&A generation failed')
    }
  }

  const handleGeneratePack = async (id: string, chapter: number) => {
    try {
      await adminApi.generatePack(id, chapter)
      toast.success(`Content pack generated for Chapter ${chapter}`)
    } catch {
      toast.error('Pack generation failed')
    }
  }

  const StatusBadge = ({ status }: { status: TextbookInfo['status'] }) => {
    const config = {
      ready: { icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50', label: 'Ready' },
      processing: { icon: Loader2, color: 'text-blue-600 bg-blue-50', label: 'Processing' },
      pending: { icon: Clock, color: 'text-amber-600 bg-amber-50', label: 'Pending' },
      error: { icon: XCircle, color: 'text-red-600 bg-red-50', label: 'Error' },
    }[status]
    return (
      <span className={clsx('inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium', config.color)}>
        <config.icon className={clsx('w-3 h-3', status === 'processing' && 'animate-spin')} />
        {config.label}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-gray-500 mt-1">Manage textbooks and content packs</p>
        </div>

        {/* Upload form */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 space-y-5">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary-500" /> Upload Textbook
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Science Part II"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Grade</label>
              <select
                value={grade}
                onChange={(e) => setGrade(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {[6,7,8,9,10,11,12].map((g) => <option key={g} value={g}>Grade {g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Board</label>
              <select
                value={board}
                onChange={(e) => setBoard(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {BOARDS.map((b) => <option key={b}>{b}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">PDF File *</label>
            <div
              onClick={() => fileRef.current?.click()}
              className={clsx(
                'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
                file ? 'border-primary-300 bg-primary-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
              )}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              {file ? (
                <div>
                  <p className="font-medium text-primary-700">{file.name}</p>
                  <p className="text-sm text-primary-500">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
              ) : (
                <div>
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Click to select PDF textbook</p>
                  <p className="text-xs text-gray-400 mt-1">Max 100MB</p>
                </div>
              )}
            </div>
          </div>

          {uploading && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="h-2 bg-primary-500 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!file || !title.trim() || uploading}
            className="w-full py-3.5 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {uploading ? <><Loader2 className="w-5 h-5 animate-spin" /> Uploading...</> : <><Upload className="w-5 h-5" /> Upload & Process</>}
          </button>
        </div>

        {/* Textbook list */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">Textbooks ({textbooks.length})</h2>
            <button onClick={loadTextbooks} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
              <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 text-gray-300 animate-spin mx-auto" />
            </div>
          ) : textbooks.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <p>No textbooks uploaded yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {textbooks.map((t) => (
                <div key={t.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900">{t.title}</p>
                        <StatusBadge status={t.status} />
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {t.subject} · Grade {t.grade} · {t.board}
                        {t.total_chunks > 0 && <span className="ml-2 text-gray-400">{t.total_chunks} chunks</span>}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Added {new Date(t.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {t.status === 'ready' && (
                        <>
                          <button
                            onClick={() => handleGenerateQA(t.id, 1)}
                            className="text-xs px-2.5 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 font-medium"
                            title="Generate Q&A pairs for Chapter 1"
                          >
                            + Q&A
                          </button>
                          <button
                            onClick={() => handleGeneratePack(t.id, 1)}
                            className="text-xs px-2.5 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium flex items-center gap-1"
                            title="Generate offline pack for Chapter 1"
                          >
                            <Package className="w-3 h-3" /> Pack
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDelete(t.id, t.title)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
