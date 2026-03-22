import React from 'react'
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts'
import type { LearningProfile } from '../types'

interface Props {
  profile: LearningProfile
  size?: number
}

const LABELS: Record<keyof LearningProfile, string> = {
  visual: 'Visual',
  auditory: 'Auditory',
  read_write: 'Read/Write',
  kinesthetic: 'Kinesthetic',
}

const DESCRIPTIONS: Record<keyof LearningProfile, string> = {
  visual: 'Learns best through diagrams, charts, and visual representations',
  auditory: 'Learns best through listening, discussion, and verbal explanations',
  read_write: 'Learns best through text, notes, and written summaries',
  kinesthetic: 'Learns best through practice, examples, and hands-on tasks',
}

export const LearningProfileChart: React.FC<Props> = ({ profile, size = 250 }) => {
  const data = (Object.keys(profile) as (keyof LearningProfile)[]).map((key) => ({
    subject: LABELS[key],
    score: Math.round(profile[key] * 100),
    fullMark: 100,
  }))

  const dominant = (Object.keys(profile) as (keyof LearningProfile)[]).reduce(
    (max, key) => (profile[key] > profile[max] ? key : max),
    'visual' as keyof LearningProfile
  )

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={size}>
        <RadarChart data={data}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: '#6b7280' }} />
          <Radar
            name="Learning Style"
            dataKey="score"
            stroke="#4f46e5"
            fill="#4f46e5"
            fillOpacity={0.25}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-2 gap-3">
        {(Object.keys(profile) as (keyof LearningProfile)[]).map((key) => (
          <div
            key={key}
            className={`p-3 rounded-xl border ${key === dominant ? 'border-primary-200 bg-primary-50' : 'border-gray-100 bg-gray-50'}`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className={`text-sm font-medium ${key === dominant ? 'text-primary-700' : 'text-gray-700'}`}>
                {LABELS[key]}
                {key === dominant && <span className="ml-1 text-xs">✨</span>}
              </span>
              <span className={`text-sm font-bold ${key === dominant ? 'text-primary-600' : 'text-gray-600'}`}>
                {Math.round(profile[key] * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full ${key === dominant ? 'bg-primary-500' : 'bg-gray-400'}`}
                style={{ width: `${profile[key] * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{DESCRIPTIONS[key]}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
