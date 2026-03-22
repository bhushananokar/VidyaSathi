import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageSquare, Brain, BookMarked, Flame, Zap, TrendingUp, Clock, ChevronRight, Award } from 'lucide-react'
import { Navbar } from '../components/Navbar'
import { OfflineBanner } from '../components/OfflineBanner'
import { useAuthStore } from '../store/authStore'
import { useProgressStore } from '../store/progressStore'
import { analyticsApi } from '../services/api'
import clsx from 'clsx'

const QUICK_ACTIONS = [
  { icon: MessageSquare, label: 'Continue Learning', desc: 'Ask a question', to: '/chat', color: 'from-primary-500 to-primary-600' },
  { icon: Brain, label: 'Take a Quiz', desc: 'Test your knowledge', to: '/quiz', color: 'from-saffron-500 to-saffron-600' },
  { icon: BookMarked, label: 'Revision Mode', desc: 'Review key concepts', to: '/revision', color: 'from-emerald-500 to-emerald-600' },
]

const BADGE_EMOJIS: Record<string, string> = {
  'Curiosity Cat': '🐱',
  'Quiz Master': '🏆',
  'Night Owl': '🦉',
  'Speed Learner': '⚡',
  'Streak Keeper': '🔥',
}

function masteryColor(pct: number) {
  if (pct >= 70) return 'bg-emerald-500'
  if (pct >= 40) return 'bg-amber-400'
  return 'bg-red-400'
}

function masteryBg(pct: number) {
  if (pct >= 70) return 'bg-emerald-50 border-emerald-100'
  if (pct >= 40) return 'bg-amber-50 border-amber-100'
  return 'bg-red-50 border-red-100'
}

export const DashboardPage: React.FC = () => {
  const { student, refreshStudent } = useAuthStore()
  const { chapterMastery, totalXP, streak, badges, setCostMetrics, setChapterMastery } = useProgressStore()
  const [loading, setLoading] = useState(true)
  const [recentActivity, setRecentActivity] = useState<{ date: string; queries: number }[]>([])

  const xp = student?.xp ?? totalXP
  const currentStreak = student?.streak ?? streak
  const level = Math.floor(xp / 500) + 1
  const xpInLevel = xp % 500
  const xpToNext = 500

  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Suprabhat'
    if (hour < 17) return 'Namaste'
    return 'Shubh Sandhya'
  }

  useEffect(() => {
    const load = async () => {
      try {
        const [data] = await Promise.all([
          analyticsApi.getStudentDashboard(),
          refreshStudent(),
        ])
        if (data.mastery) setChapterMastery(data.mastery)
        if (data.recent_activity) setRecentActivity(data.recent_activity)
      } catch { /* offline OK */ }
      finally { setLoading(false) }
    }
    load()
  }, [setChapterMastery, setCostMetrics, refreshStudent])

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <OfflineBanner />

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Greeting */}
        <div className="bg-gradient-to-r from-primary-600 to-saffron-500 rounded-3xl p-6 text-white shadow-lg">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-white/70 text-sm font-medium">{greeting()},</p>
              <h1 className="text-2xl font-extrabold mt-0.5">{student?.name?.split(' ')[0] || 'Student'}! 🌅</h1>
              <p className="text-white/80 text-sm mt-2">
                {currentStreak > 0 ? `You're on a ${currentStreak}-day streak. Keep it up!` : "Start your learning journey today!"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-white/70 text-xs">Level {level}</p>
              <p className="text-2xl font-bold">⚡{xp.toLocaleString()}</p>
              <p className="text-white/70 text-xs">XP</p>
            </div>
          </div>

          {/* XP bar */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-white/70 mb-1">
              <span>Level {level}</span>
              <span>{xpInLevel}/{xpToNext} XP to Level {level + 1}</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-2">
              <div
                className="h-2 bg-white rounded-full transition-all"
                style={{ width: `${(xpInLevel / xpToNext) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Flame, label: 'Streak', value: `${currentStreak} days`, color: 'text-orange-500 bg-orange-50' },
            { icon: Zap, label: 'Total XP', value: xp.toLocaleString(), color: 'text-primary-600 bg-primary-50' },
            { icon: TrendingUp, label: 'Avg Mastery', value: chapterMastery.length ? `${Math.round(chapterMastery.reduce((a, b) => a + b.mastery_pct, 0) / chapterMastery.length)}%` : 'N/A', color: 'text-emerald-600 bg-emerald-50' },
            { icon: Clock, label: 'Active Days', value: recentActivity.filter((a) => a.queries > 0).length.toString(), color: 'text-violet-600 bg-violet-50' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center mb-3', stat.color)}>
                <stat.icon className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.to}
                to={action.to}
                className="group bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5"
              >
                <div className={clsx('w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center mb-3 shadow', action.color)}>
                  <action.icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-gray-900">{action.label}</p>
                    <p className="text-sm text-gray-500">{action.desc}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Chapter mastery */}
        {chapterMastery.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">Chapter Progress</h2>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[1,2,3,4].map((i) => (
                  <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
                    <div className="h-2 bg-gray-100 rounded" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {chapterMastery.slice(0, 8).map((m) => (
                  <div key={m.chapter_id} className={clsx('bg-white rounded-2xl p-4 border shadow-sm', masteryBg(m.mastery_pct))}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold text-gray-800 text-sm leading-tight">{m.chapter_title}</p>
                        <p className="text-xs text-gray-500">{m.subject}</p>
                      </div>
                      <span className="text-lg font-bold text-gray-700">{m.mastery_pct}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className={clsx('h-2 rounded-full transition-all', masteryColor(m.mastery_pct))} style={{ width: `${m.mastery_pct}%` }} />
                    </div>
                    {m.weak_topics?.length > 0 && (
                      <p className="text-xs text-gray-400 mt-1.5">Weak: {m.weak_topics.slice(0, 2).join(', ')}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Badges */}
        {badges.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Award className="w-5 h-5 text-saffron-500" /> Badges Earned
            </h2>
            <div className="flex flex-wrap gap-3">
              {badges.map((badge) => (
                <div key={badge} className="flex items-center gap-2 bg-white border border-gray-100 rounded-2xl px-4 py-2 shadow-sm">
                  <span className="text-xl">{BADGE_EMOJIS[badge] || '🏅'}</span>
                  <span className="text-sm font-medium text-gray-700">{badge}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No content yet CTA */}
        {chapterMastery.length === 0 && !loading && (
          <div className="bg-white rounded-3xl border border-gray-100 p-10 text-center shadow-sm">
            <div className="text-5xl mb-4">📚</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Start your learning journey!</h3>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto">Ask your first question or take a quiz to start tracking your progress.</p>
            <Link to="/chat" className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors">
              Ask a Question <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
