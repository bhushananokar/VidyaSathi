import React, { useState } from 'react'
import { X, GitBranch, Network, Clock, BarChart2, Loader2 } from 'lucide-react'
import { MermaidDiagram } from './MermaidDiagram'
import { visualApi } from '../services/api'
import toast from 'react-hot-toast'

interface Props {
  isOpen: boolean
  onClose: () => void
  onInsert: (mermaidCode: string) => void
  defaultConcept?: string
  subject?: string
}

const DIAGRAM_TYPES = [
  { id: 'flowchart', label: 'Flowchart', icon: GitBranch, desc: 'Processes, steps, decisions' },
  { id: 'mindmap', label: 'Mind Map', icon: Network, desc: 'Central concept with branches' },
  { id: 'sequence', label: 'Sequence', icon: Clock, desc: 'Events in order / timeline' },
  { id: 'graph', label: 'Comparison', icon: BarChart2, desc: 'Compare concepts or items' },
] as const

type DiagramType = typeof DIAGRAM_TYPES[number]['id']

export const DiagramModal: React.FC<Props> = ({ isOpen, onClose, onInsert, defaultConcept = '', subject = 'Science' }) => {
  const [concept, setConcept] = useState(defaultConcept)
  const [diagramType, setDiagramType] = useState<DiagramType>('flowchart')
  const [generatedCode, setGeneratedCode] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  if (!isOpen) return null

  const handleGenerate = async () => {
    if (!concept.trim()) return
    setIsLoading(true)
    setGeneratedCode(null)
    try {
      const res = await visualApi.generateDiagram({ concept, subject, diagram_type: diagramType })
      if (res.type === 'mermaid') {
        setGeneratedCode(res.content)
      } else {
        toast.error('Could not generate diagram for this concept.')
      }
    } catch {
      toast.error('Diagram generation failed.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleInsert = () => {
    if (generatedCode) {
      onInsert(generatedCode)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-bold text-gray-900">Generate Visual Diagram</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Concept input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Concept or Topic</label>
            <input
              type="text"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="e.g. Photosynthesis, Water Cycle, Newton's Laws..."
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            />
          </div>

          {/* Diagram type selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Diagram Type</label>
            <div className="grid grid-cols-2 gap-2">
              {DIAGRAM_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setDiagramType(type.id)}
                  className={`flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                    diagramType === type.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <type.icon className={`w-5 h-5 mt-0.5 shrink-0 ${diagramType === type.id ? 'text-primary-600' : 'text-gray-400'}`} />
                  <div>
                    <p className={`text-sm font-medium ${diagramType === type.id ? 'text-primary-700' : 'text-gray-700'}`}>{type.label}</p>
                    <p className="text-xs text-gray-400">{type.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={!concept.trim() || isLoading}
            className="w-full py-2.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : 'Generate Diagram'}
          </button>

          {/* Preview */}
          {generatedCode && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">Preview</p>
              <MermaidDiagram code={generatedCode} />
              <details className="text-xs">
                <summary className="cursor-pointer text-gray-400 hover:text-gray-600">View Mermaid code</summary>
                <pre className="mt-2 p-3 bg-gray-50 rounded-lg border text-gray-600 overflow-x-auto">{generatedCode}</pre>
              </details>
            </div>
          )}
        </div>

        {/* Footer */}
        {generatedCode && (
          <div className="p-5 border-t flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={handleInsert} className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700">
              Insert into Chat
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
