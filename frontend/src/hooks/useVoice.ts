import { useState, useRef, useCallback } from 'react'

interface UseVoiceReturn {
  isRecording: boolean
  audioLevel: number
  startRecording: () => Promise<void>
  stopRecording: () => Promise<Blob | null>
  cancelRecording: () => void
  error: string | null
}

export function useVoice(): UseVoiceReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const resolveRef = useRef<((blob: Blob | null) => void) | null>(null)

  const stopAnalyser = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    setAudioLevel(0)
  }, [])

  const startRecording = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      })
      streamRef.current = stream

      // Set up analyser for audio level visualization
      const ctx = new AudioContext()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser

      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray)
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        setAudioLevel(Math.round((avg / 255) * 100))
        animFrameRef.current = requestAnimationFrame(updateLevel)
      }
      updateLevel()

      // Prefer webm/opus, fallback to whatever is supported
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4'

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        stopAnalyser()
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: mimeType })
        resolveRef.current?.(blob)
        resolveRef.current = null
      }

      recorder.start(100) // collect data every 100ms
      setIsRecording(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Microphone access denied'
      setError(msg)
    }
  }, [stopAnalyser])

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || !isRecording) {
        resolve(null)
        return
      }
      resolveRef.current = resolve
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    })
  }, [isRecording])

  const cancelRecording = useCallback(() => {
    stopAnalyser()
    if (mediaRecorderRef.current && isRecording) {
      resolveRef.current = () => {}
      mediaRecorderRef.current.stop()
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    setIsRecording(false)
  }, [isRecording, stopAnalyser])

  return { isRecording, audioLevel, startRecording, stopRecording, cancelRecording, error }
}
