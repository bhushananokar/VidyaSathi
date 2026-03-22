import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Send, GitBranch, BookOpen } from 'lucide-react'
import { Navbar } from '../components/Navbar'
import { OfflineBanner } from '../components/OfflineBanner'
import { MessageBubble } from '../components/MessageBubble'
import { VoiceRecorder } from '../components/VoiceRecorder'
import { DiagramModal } from '../components/DiagramModal'
import { CostMeter } from '../components/CostMeter'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { queryApi, OfflineError } from '../services/api'
import { offlineCache } from '../services/offlineCache'
import type { Message, QueryMode } from '../types'
import toast from 'react-hot-toast'
import clsx from 'clsx'

function uuid(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)
}

const SUBJECTS = ['Science', 'Mathematics', 'Social Science', 'History', 'Geography', 'English', 'Hindi', 'Marathi', 'Physics', 'Chemistry', 'Biology']

const MODES: { id: QueryMode; label: string; desc: string }[] = [
  { id: 'ask', label: '💬 Ask', desc: 'Ask any question' },
  { id: 'explain', label: '📖 Explain', desc: 'Detailed explanation' },
  { id: 'doubt', label: '🤔 Doubt', desc: 'I don\'t understand' },
  { id: 'solve', label: '🔢 Solve', desc: 'Step-by-step solution' },
  { id: 'revision', label: '📝 Revision', desc: 'Quick revision' },
]

const DEMO_MESSAGES: Message[] = [
  {
    id: '1',
    role: 'assistant',
    content: '👋 **Namaste!** I\'m VidyaSathi, your personal AI tutor.\n\nI can help you with:\n- 📖 Explaining concepts from your textbook\n- 🔢 Solving math and science problems step-by-step\n- 🧠 Testing your knowledge with quizzes\n- 🗣️ Answering questions in Hindi, Marathi, or English\n\nSelect a subject, type your question, or press the 🎤 mic button to speak. I\'m here to help!',
    timestamp: new Date().toISOString(),
    cost_tier: 0,
    cached: true,
    cost_usd: 0,
  },
]

export const ChatPage: React.FC = () => {
  const { student, isOnline } = useAuthStore()
  const {
    currentSubject, currentChapter, currentMode,
    setCurrentSubject, setCurrentChapter, setCurrentMode,
    conversations, currentConversationId, startConversation, addMessage, updateMessage,
    addToOfflineQueue, addCost, isLoading, setLoading,
  } = useChatStore()

  const [input, setInput] = useState('')
  const [diagramModalOpen, setDiagramModalOpen] = useState(false)
  const [diagramConcept, setDiagramConcept] = useState('')
  const [conversationId] = useState(() => {
    const id = uuid()
    return id
  })
  const [transcript, setTranscript] = useState<string | null>(null)

  const inputRef = useRef<HTMLTextAreaElement>(null)

  const messages = conversations[conversationId] ?? DEMO_MESSAGES

  useEffect(() => {
    startConversation(conversationId)
    // Read live store state to avoid stale closure (React StrictMode runs effects twice)
    const existing = useChatStore.getState().conversations[conversationId]
    if (!existing || existing.length === 0) {
      DEMO_MESSAGES.forEach((m) => addMessage(conversationId, m))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps


  const sendQuestion = useCallback(async (question: string) => {
    if (!question.trim() || isLoading) return

    const studentMsg: Message = {
      id: uuid(),
      role: 'student',
      content: question.trim(),
      timestamp: new Date().toISOString(),
    }

    const thinkingMsg: Message = {
      id: uuid(),
      role: 'assistant',
      content: '...',
      timestamp: new Date().toISOString(),
    }

    setInput('')
    setTranscript(null)
    addMessage(conversationId, studentMsg)

    if (!isOnline) {
      // Queue it
      const queuedMsg: Message = { ...studentMsg, is_queued: true }
      updateMessage(conversationId, studentMsg.id, { is_queued: true })
      addToOfflineQueue({ id: uuid(), question: question.trim(), subject: currentSubject, chapter: currentChapter ?? undefined, mode: currentMode, timestamp: new Date().toISOString() })

      // Try local cache
      const cached = await offlineCache.getCachedAnswer(question, currentSubject)
      if (cached) {
        addMessage(conversationId, { ...thinkingMsg, content: cached, cost_tier: 0, cached: true, cost_usd: 0 })
      } else {
        addMessage(conversationId, {
          ...thinkingMsg,
          content: "I've saved your question and will answer it when you're back online. Meanwhile, check your downloaded content packs for related material.",
          cost_tier: 0,
          cost_usd: 0,
        })
      }
      return
    }

    setLoading(true)
    addMessage(conversationId, thinkingMsg)

    try {
      const res = await queryApi.ask({
        question: question.trim(),
        subject: currentSubject,
        chapter: currentChapter ?? undefined,
        mode: currentMode,
        conversation_id: conversationId,
      })

      updateMessage(conversationId, thinkingMsg.id, {
        content: res.answer,
        cost_tier: res.cost_tier,
        cached: res.cached,
        tokens_used: res.tokens_used,
        cost_usd: res.cost_usd,
        sources: res.sources,
        mermaid_diagram: res.mermaid_diagram,
      })

      addCost(res.cost_usd, res.tokens_used, res.cached)
      await offlineCache.cacheAnswer(question.trim(), res.answer, currentSubject)
    } catch (err) {
      if (err instanceof OfflineError) {
        updateMessage(conversationId, thinkingMsg.id, {
          content: "You're offline. Your question has been queued.",
          cost_tier: 0,
          cost_usd: 0,
        })
        addToOfflineQueue({ id: uuid(), question: question.trim(), subject: currentSubject, chapter: currentChapter ?? undefined, mode: currentMode, timestamp: new Date().toISOString() })
      } else {
        updateMessage(conversationId, thinkingMsg.id, {
          content: "Sorry, I couldn't answer that. Please try again.",
          cost_tier: 0,
          cost_usd: 0,
        })
        toast.error('Failed to get answer')
      }
    } finally {
      setLoading(false)
    }
  }, [isLoading, isOnline, currentSubject, currentChapter, currentMode, conversationId, addMessage, updateMessage, addToOfflineQueue, addCost, setLoading])

  const handleVoice = async (blob: Blob) => {
    setLoading(true)
    try {
      const res = await queryApi.voice(blob, currentSubject, currentChapter ?? undefined)
      setTranscript(res.transcript)
      toast.success(`Transcribed: "${res.transcript.slice(0, 50)}..."`)

      const studentMsg: Message = {
        id: uuid(),
        role: 'student',
        content: `🎤 ${res.transcript}`,
        timestamp: new Date().toISOString(),
      }
      addMessage(conversationId, studentMsg)

      const aiMsg: Message = {
        id: uuid(),
        role: 'assistant',
        content: res.answer_text,
        timestamp: new Date().toISOString(),
        cost_tier: res.cost_tier as 0 | 1 | 2 | 3,
        cost_usd: res.cost_usd,
        audio_url: res.answer_audio_url,
      }
      addMessage(conversationId, aiMsg)
      addCost(res.cost_usd, 0, false)
    } catch {
      toast.error('Voice query failed')
    } finally {
      setLoading(false)
    }
  }

  const handleDiagramInsert = (mermaidCode: string) => {
    const msg: Message = {
      id: uuid(),
      role: 'assistant',
      content: `Here's the diagram you requested:`,
      timestamp: new Date().toISOString(),
      cost_tier: 2,
      cost_usd: 0.0001,
      mermaid_diagram: mermaidCode,
    }
    addMessage(conversationId, msg)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendQuestion(input)
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <Navbar />
      <OfflineBanner />

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-100 p-4 gap-4 overflow-y-auto shrink-0">
          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Subject</label>
            <select
              value={currentSubject}
              onChange={(e) => setCurrentSubject(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Chapter */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Chapter</label>
            <select
              value={currentChapter ?? ''}
              onChange={(e) => setCurrentChapter(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All chapters</option>
              {Array.from({ length: 15 }, (_, i) => i + 1).map((c) => (
                <option key={c} value={c}>Chapter {c}</option>
              ))}
            </select>
          </div>

          {/* Mode */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Mode</label>
            <div className="space-y-1">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setCurrentMode(m.id)}
                  className={clsx(
                    'w-full text-left px-3 py-2 rounded-xl text-sm transition-colors',
                    currentMode === m.id ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                  )}
                >
                  <span>{m.label}</span>
                  <span className="block text-xs text-gray-400">{m.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-auto">
            <CostMeter />
          </div>
        </aside>

        {/* Main chat */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4 space-y-2">
            {/* Mobile controls */}
            <div className="md:hidden flex gap-2 mb-4">
              <select
                value={currentSubject}
                onChange={(e) => setCurrentSubject(e.target.value)}
                className="flex-1 px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white"
              >
                {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
              </select>
              <select
                value={currentMode}
                onChange={(e) => setCurrentMode(e.target.value as QueryMode)}
                className="flex-1 px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white"
              >
                {MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>

            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onGenerateDiagram={(concept) => {
                  setDiagramConcept(concept)
                  setDiagramModalOpen(true)
                }}
              />
            ))}

            {isLoading && (
              <div className="flex gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-saffron-500 flex items-center justify-center text-white text-xs font-bold">VS</div>
                <div className="bg-white rounded-2xl rounded-tl-sm border border-gray-100 shadow-sm px-4 py-3">
                  <div className="flex gap-1 items-center">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Input area */}
          <div className="bg-white border-t border-gray-100 px-4 py-3">
            {transcript && (
              <div className="flex items-center gap-2 mb-2 text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded-xl">
                <BookOpen className="w-4 h-4 shrink-0" />
                <span className="truncate">Transcript: {transcript}</span>
              </div>
            )}
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Ask about ${currentSubject}... (Enter to send)`}
                  rows={1}
                  disabled={isLoading}
                  className="w-full px-4 py-3 pr-12 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none text-sm leading-relaxed disabled:opacity-50 max-h-32 overflow-y-auto"
                  style={{ minHeight: '48px' }}
                  onInput={(e) => {
                    const el = e.currentTarget
                    el.style.height = 'auto'
                    el.style.height = Math.min(el.scrollHeight, 128) + 'px'
                  }}
                />
              </div>

              {/* Diagram button */}
              <button
                onClick={() => setDiagramModalOpen(true)}
                className="p-3 rounded-2xl text-gray-400 hover:text-primary-500 hover:bg-primary-50 transition-colors shrink-0"
                title="Generate diagram"
              >
                <GitBranch className="w-5 h-5" />
              </button>

              {/* Voice */}
              <VoiceRecorder onAudioReady={handleVoice} disabled={isLoading} />

              {/* Send */}
              <button
                onClick={() => sendQuestion(input)}
                disabled={!input.trim() || isLoading}
                className="p-3 bg-primary-600 text-white rounded-2xl hover:bg-primary-700 disabled:opacity-50 transition-colors shrink-0 shadow-sm"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>

            {/* Quick suggestions */}
            <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
              {[
                'What is photosynthesis?',
                'Explain Newton\'s laws',
                'Solve: 2x + 5 = 15',
                'What causes earthquakes?',
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => sendQuestion(s)}
                  className="shrink-0 text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full hover:bg-primary-50 hover:text-primary-600 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <DiagramModal
        isOpen={diagramModalOpen}
        onClose={() => setDiagramModalOpen(false)}
        onInsert={handleDiagramInsert}
        defaultConcept={diagramConcept}
        subject={currentSubject}
      />
    </div>
  )
}
