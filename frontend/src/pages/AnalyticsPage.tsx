import React, { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis
} from 'recharts'
import { Navbar } from '../components/Navbar'
import { OfflineBanner } from '../components/OfflineBanner'
import { analyticsApi } from '../services/api'
import { useChatStore } from '../store/chatStore'
import type { CostMetrics } from '../types'
import { TrendingDown, Database, Zap, Cpu, DollarSign } from 'lucide-react'

const INR = 84

export const AnalyticsPage: React.FC = () => {
  const [tab, setTab] = useState<'student' | 'cost'>('student')
  const [metrics, setMetrics] = useState<CostMetrics | null>(null)
  const { sessionCostUsd, sessionCachedQueries, sessionQueries, sessionTokens } = useChatStore()

  useEffect(() => {
    analyticsApi.getCostReport().then(setMetrics).catch(() => {})
  }, [])

  const displayMetrics = metrics || {
    total_queries: sessionQueries,
    cached_queries: sessionCachedQueries,
    flash_queries: Math.round(sessionQueries * 0.25),
    pro_queries: Math.round(sessionQueries * 0.1),
    total_cost_usd: sessionCostUsd,
    baseline_cost_usd: sessionQueries * 0.015,
    savings_pct: sessionQueries > 0 ? ((sessionQueries * 0.015 - sessionCostUsd) / (sessionQueries * 0.015)) * 100 : 0,
    cache_hit_rate: sessionQueries > 0 ? (sessionCachedQueries / sessionQueries) * 100 : 0,
  }

  const tierData = [
    { name: 'Local Cache (₹0)', queries: displayMetrics.cached_queries, cost: 0, fill: '#10b981' },
    { name: 'Gemini Flash', queries: displayMetrics.flash_queries, cost: displayMetrics.flash_queries * 0.0001, fill: '#3b82f6' },
    { name: 'Gemini Pro', queries: displayMetrics.pro_queries, cost: displayMetrics.pro_queries * 0.001, fill: '#8b5cf6' },
  ]

  const comparisonData = [
    { name: 'GPT-4\nBaseline', cost: displayMetrics.baseline_cost_usd * INR, fill: '#ef4444' },
    { name: 'GPT-4\n+ RAG', cost: displayMetrics.baseline_cost_usd * 0.55 * INR, fill: '#f97316' },
    { name: 'VidyaSathi', cost: displayMetrics.total_cost_usd * INR, fill: '#10b981' },
  ]

  const pieData = [
    { name: 'Cached (Free)', value: displayMetrics.cached_queries || 1, color: '#10b981' },
    { name: 'Flash', value: displayMetrics.flash_queries || 0, color: '#3b82f6' },
    { name: 'Pro', value: displayMetrics.pro_queries || 0, color: '#8b5cf6' },
  ].filter((d) => d.value > 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <OfflineBanner />
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 mt-1">Cost metrics, learning progress, and usage insights</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 bg-white rounded-2xl p-1 border border-gray-100 shadow-sm w-fit">
          {(['student', 'cost'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-xl text-sm font-medium transition-colors capitalize ${
                tab === t ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t === 'student' ? '📊 My Progress' : '💰 Cost Dashboard'}
            </button>
          ))}
        </div>

        {/* Cost Dashboard */}
        {tab === 'cost' && (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: Database, label: 'Total Queries', value: displayMetrics.total_queries.toString(), color: 'text-gray-600 bg-gray-50' },
                { icon: TrendingDown, label: 'Cache Hit Rate', value: `${displayMetrics.cache_hit_rate.toFixed(1)}%`, color: 'text-emerald-600 bg-emerald-50' },
                { icon: DollarSign, label: 'Total Cost', value: `₹${(displayMetrics.total_cost_usd * INR).toFixed(3)}`, color: 'text-blue-600 bg-blue-50' },
                { icon: Zap, label: 'Savings vs GPT-4', value: `${displayMetrics.savings_pct.toFixed(1)}%`, color: 'text-violet-600 bg-violet-50' },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${s.color}`}>
                    <s.icon className="w-5 h-5" />
                  </div>
                  <p className="text-xl font-bold text-gray-900">{s.value}</p>
                  <p className="text-sm text-gray-500">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Cost comparison bar chart */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold text-gray-900 mb-4">Cost Comparison (₹)</h3>
              <p className="text-sm text-gray-400 mb-4">Based on {displayMetrics.total_queries} queries</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={comparisonData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => `₹${v.toFixed(2)}`} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip formatter={(v: number) => [`₹${v.toFixed(4)}`, 'Cost']} />
                  <Bar dataKey="cost" radius={[0, 6, 6, 0]}>
                    {comparisonData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                <p className="text-sm text-emerald-800 font-semibold">
                  💰 VidyaSathi is <span className="text-emerald-600">{displayMetrics.savings_pct.toFixed(0)}% cheaper</span> than GPT-4 baseline
                </p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  Saved ₹{((displayMetrics.baseline_cost_usd - displayMetrics.total_cost_usd) * INR).toFixed(3)} on {displayMetrics.total_queries} queries
                </p>
              </div>
            </div>

            {/* Tier distribution pie */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h3 className="font-bold text-gray-900 mb-4">Query Distribution by Tier</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h3 className="font-bold text-gray-900 mb-4">Cost per Tier (₹)</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={tierData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${v.toFixed(3)}`} />
                    <Tooltip formatter={(v: number) => [`₹${(v * INR).toFixed(5)}`, 'Cost']} />
                    <Bar dataKey="cost" radius={[6, 6, 0, 0]}>
                      {tierData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Session stats */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold text-gray-900 mb-4">Current Session</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Queries', value: sessionQueries },
                  { label: 'Cached (free)', value: sessionCachedQueries },
                  { label: 'Tokens used', value: sessionTokens.toLocaleString() },
                  { label: 'Cost (₹)', value: (sessionCostUsd * INR).toFixed(5) },
                ].map((s) => (
                  <div key={s.label} className="text-center bg-gray-50 rounded-xl p-3">
                    <p className="text-xl font-bold text-gray-900">{s.value}</p>
                    <p className="text-xs text-gray-500">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Student Progress */}
        {tab === 'student' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
              <p className="text-4xl mb-3">📊</p>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Progress tracking coming soon!</h3>
              <p className="text-gray-500 text-sm max-w-sm mx-auto">
                As you complete quizzes and ask questions, your chapter mastery and topic analytics will appear here.
                Check the Cost Dashboard tab to see how much VidyaSathi is saving!
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
