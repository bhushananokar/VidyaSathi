import React, { useCallback } from 'react'
import { useMermaid } from '../hooks/useMermaid'
import { Download, RefreshCw, AlertTriangle } from 'lucide-react'

interface Props {
  code: string
  className?: string
}

export const MermaidDiagram: React.FC<Props> = ({ code, className = '' }) => {
  const { svg, error, isLoading } = useMermaid(code)

  const downloadSVG = useCallback(() => {
    if (!svg) return
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'diagram.svg'
    a.click()
    URL.revokeObjectURL(url)
  }, [svg])

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center p-8 bg-gray-50 rounded-xl border border-gray-200 ${className}`}>
        <RefreshCw className="w-5 h-5 text-primary-500 animate-spin mr-2" />
        <span className="text-sm text-gray-500">Rendering diagram...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`flex items-start gap-2 p-4 bg-amber-50 rounded-xl border border-amber-200 ${className}`}>
        <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-800">Diagram render error</p>
          <p className="text-xs text-amber-600 mt-1">{error}</p>
          <pre className="text-xs text-gray-500 mt-2 bg-white p-2 rounded border overflow-x-auto">{code}</pre>
        </div>
      </div>
    )
  }

  if (!svg) return null

  return (
    <div className={`relative group rounded-xl border border-gray-200 bg-white overflow-hidden ${className}`}>
      <div
        className="p-4 overflow-x-auto"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <button
        onClick={downloadSVG}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-white rounded-lg border border-gray-200 shadow-sm hover:bg-gray-50"
        title="Download SVG"
      >
        <Download className="w-4 h-4 text-gray-500" />
      </button>
    </div>
  )
}
