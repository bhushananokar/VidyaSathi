import React from 'react'
import { Mic, MicOff, X } from 'lucide-react'
import { useVoice } from '../hooks/useVoice'
import clsx from 'clsx'

interface Props {
  onAudioReady: (blob: Blob) => void
  disabled?: boolean
}

export const VoiceRecorder: React.FC<Props> = ({ onAudioReady, disabled }) => {
  const { isRecording, audioLevel, startRecording, stopRecording, cancelRecording, error } = useVoice()

  const handleClick = async () => {
    if (disabled) return
    if (isRecording) {
      const blob = await stopRecording()
      if (blob && blob.size > 1000) onAudioReady(blob)
    } else {
      await startRecording()
    }
  }

  return (
    <div className="flex items-center gap-2">
      {isRecording && (
        <button
          onClick={cancelRecording}
          className="p-2 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          title="Cancel recording"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      <button
        onClick={handleClick}
        disabled={disabled}
        title={isRecording ? 'Stop recording' : 'Start voice input'}
        className={clsx(
          'relative p-2.5 rounded-full transition-all duration-200 disabled:opacity-50',
          isRecording
            ? 'bg-red-500 text-white shadow-lg shadow-red-200'
            : 'bg-gray-100 text-gray-600 hover:bg-primary-100 hover:text-primary-600'
        )}
      >
        {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}

        {/* Pulse rings when recording */}
        {isRecording && (
          <>
            <span
              className="absolute inset-0 rounded-full bg-red-400 opacity-40 animate-ping"
              style={{ animationDuration: `${Math.max(0.5, 1.5 - audioLevel / 100)}s` }}
            />
            <span className="absolute -inset-1 rounded-full border-2 border-red-400 opacity-60 animate-pulse" />
          </>
        )}
      </button>

      {isRecording && (
        <div className="flex items-center gap-0.5 h-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="w-1 bg-red-400 rounded-full transition-all duration-75"
              style={{
                height: `${Math.max(4, (audioLevel * (0.4 + Math.sin(Date.now() / 100 + i) * 0.3)))}px`,
              }}
            />
          ))}
          <span className="ml-2 text-xs text-red-500 font-medium">Recording...</span>
        </div>
      )}

      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}
