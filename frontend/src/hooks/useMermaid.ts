import { useState, useEffect, useRef } from 'react'
import mermaid from 'mermaid'

let mermaidInitialized = false

function initMermaid() {
  if (!mermaidInitialized) {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      fontFamily: 'Inter, system-ui, sans-serif',
      flowchart: { useMaxWidth: true, htmlLabels: true },
      mindmap: { useMaxWidth: true },
    })
    mermaidInitialized = true
  }
}

let renderCounter = 0

export function useMermaid(code: string) {
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const idRef = useRef(`mermaid-${++renderCounter}`)

  useEffect(() => {
    if (!code?.trim()) {
      setIsLoading(false)
      return
    }

    initMermaid()
    setIsLoading(true)
    setError(null)

    // Extract code block if wrapped in ```mermaid ... ```
    const clean = code
      .replace(/^```mermaid\s*/i, '')
      .replace(/```\s*$/, '')
      .trim()

    let cancelled = false

    mermaid
      .render(idRef.current, clean)
      .then(({ svg: rendered }) => {
        if (!cancelled) {
          setSvg(rendered)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message || 'Failed to render diagram')
          setIsLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [code])

  return { svg, error, isLoading }
}
