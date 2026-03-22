import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { Copy, Check, GitBranch, ChevronDown, ChevronUp, Zap, Database, Cpu, Clock } from 'lucide-react'
import { MermaidDiagram } from './MermaidDiagram'
import type { Message, CostTier } from '../types'
import clsx from 'clsx'

const TIER_LABELS: Record<CostTier, { label: string; icon: React.ReactNode; color: string }> = {
  0: { label: 'Cached', icon: <Database className="w-3 h-3" />, color: 'bg-emerald-100 text-emerald-700' },
  1: { label: 'Semantic', icon: <Database className="w-3 h-3" />, color: 'bg-teal-100 text-teal-700' },
  2: { label: 'Flash', icon: <Zap className="w-3 h-3" />, color: 'bg-blue-100 text-blue-700' },
  3: { label: 'Pro', icon: <Cpu className="w-3 h-3" />, color: 'bg-violet-100 text-violet-700' },
}

interface Props {
  message: Message
  onGenerateDiagram?: (concept: string) => void
}

export const MessageBubble: React.FC<Props> = ({ message, onGenerateDiagram }) => {
  const [copied, setCopied] = useState(false)
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const isStudent = message.role === 'student'

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isStudent) {
    return (
      <div className="flex justify-end mb-4 animate-fade-in">
        <div className="max-w-[80%] md:max-w-[70%]">
          {message.is_queued && (
            <div className="flex items-center gap-1 text-xs text-amber-500 mb-1 justify-end">
              <Clock className="w-3 h-3" /> Queued (offline)
            </div>
          )}
          <div className="bg-primary-600 text-white px-4 py-3 rounded-2xl rounded-tr-sm shadow-sm">
            <p className="text-sm leading-relaxed">{message.content}</p>
          </div>
          <p className="text-xs text-gray-400 mt-1 text-right">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    )
  }

  // Assistant message
  const tier = message.cost_tier !== undefined ? TIER_LABELS[message.cost_tier] : null

  return (
    <div className="flex gap-3 mb-6 animate-slide-up">
      {/* Avatar */}
      <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-saffron-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
        VS
      </div>

      <div className="flex-1 min-w-0">
        {/* Main content card */}
        <div className="bg-white rounded-2xl rounded-tl-sm border border-gray-100 shadow-sm px-4 py-3">
          <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed">
            <ReactMarkdown
              remarkPlugins={[remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '')
                  const lang = match?.[1]
                  if (lang === 'mermaid') {
                    return <MermaidDiagram code={String(children).trim()} className="my-3" />
                  }
                  return (
                    <code className={clsx('bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono', className)} {...props}>
                      {children}
                    </code>
                  )
                },
                pre({ children }) {
                  return <pre className="bg-gray-900 text-gray-100 rounded-xl p-4 overflow-x-auto text-sm">{children}</pre>
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>

          {/* Mermaid diagram if not already rendered inside content */}
          {message.mermaid_diagram && !message.content.includes('```mermaid') && (
            <MermaidDiagram code={message.mermaid_diagram} className="mt-3" />
          )}
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="text-xs text-gray-400">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>

          {tier && (
            <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', tier.color)}>
              {tier.icon} {tier.label}
            </span>
          )}

          {message.cost_usd !== undefined && message.cost_usd > 0 && (
            <span className="text-xs text-gray-400">₹{(message.cost_usd * 84).toFixed(4)}</span>
          )}

          {message.cost_usd === 0 && (
            <span className="text-xs text-emerald-500 font-medium">Free ✓</span>
          )}

          <div className="flex items-center gap-1 ml-auto">
            {onGenerateDiagram && (
              <button
                onClick={() => onGenerateDiagram(message.content.slice(0, 100))}
                className="p-1 rounded-md text-gray-400 hover:text-primary-500 hover:bg-primary-50 transition-colors"
                title="Generate diagram for this answer"
              >
                <GitBranch className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={handleCopy}
              className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title="Copy answer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-2">
            <button
              onClick={() => setSourcesOpen(!sourcesOpen)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              {sourcesOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {message.sources.length} source{message.sources.length !== 1 ? 's' : ''}
            </button>
            {sourcesOpen && (
              <div className="mt-2 space-y-1">
                {message.sources.map((src, i) => (
                  <div key={i} className="text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                    <span className="font-medium">{src.chapter_title}</span>
                    {src.topic && <span className="text-gray-400"> › {src.topic}</span>}
                    {src.page_no && <span className="text-gray-400 ml-2">p.{src.page_no}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Audio playback */}
        {message.audio_url && (
          <audio controls src={message.audio_url} className="mt-2 w-full h-8 rounded-lg" />
        )}
      </div>
    </div>
  )
}
