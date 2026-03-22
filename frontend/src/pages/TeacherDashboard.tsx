import React, { useState } from 'react'
import { Users, BarChart2, Plus, Copy, Check } from 'lucide-react'
import { Navbar } from '../components/Navbar'

export const TeacherDashboard: React.FC = () => {
  const [classCode] = useState(() => Math.random().toString(36).slice(2, 8).toUpperCase())
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(classCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teacher Dashboard</h1>
          <p className="text-gray-500 mt-1">Monitor student progress and manage your class</p>
        </div>

        {/* Class code */}
        <div className="bg-gradient-to-r from-primary-600 to-saffron-500 rounded-3xl p-6 text-white">
          <p className="text-white/70 text-sm font-medium mb-2">Your Class Code</p>
          <div className="flex items-center gap-4">
            <span className="text-4xl font-extrabold tracking-widest">{classCode}</span>
            <button
              onClick={handleCopy}
              className="p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-colors"
            >
              {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
          <p className="text-white/70 text-sm mt-2">Share this code with your students to track their progress</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: Users, label: 'Students', value: '0', desc: 'No students joined yet' },
            { icon: BarChart2, label: 'Avg Mastery', value: 'N/A', desc: 'Across all chapters' },
            { icon: Plus, label: 'Quizzes Created', value: '0', desc: 'Custom quizzes' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
              <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                <s.icon className="w-6 h-6 text-primary-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="font-medium text-gray-700 mt-0.5">{s.label}</p>
              <p className="text-xs text-gray-400 mt-1">{s.desc}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-10 text-center">
          <p className="text-4xl mb-4">🏫</p>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Share your class code with students</h3>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            Once students join using your class code, you'll see their progress, quiz results, and weak topics here.
            You can also upload custom study materials and create class-specific quizzes.
          </p>
        </div>
      </main>
    </div>
  )
}
