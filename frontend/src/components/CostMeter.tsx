import React from 'react'
import { TrendingDown, Zap, Database, Cpu } from 'lucide-react'
import { useChatStore } from '../store/chatStore'
import clsx from 'clsx'

interface Props {
  compact?: boolean
}

const INR_RATE = 84 // approximate USD to INR

export const CostMeter: React.FC<Props> = ({ compact = false }) => {
  const { sessionCostUsd, sessionTokens, sessionQueries, sessionCachedQueries } = useChatStore()

  const baselineCostUsd = sessionQueries * 0.015 // GPT-4 baseline ~$0.015/query
  const savings = baselineCostUsd > 0 ? ((baselineCostUsd - sessionCostUsd) / baselineCostUsd) * 100 : 0
  const cacheHitRate = sessionQueries > 0 ? (sessionCachedQueries / sessionQueries) * 100 : 0

  const costInr = (sessionCostUsd * INR_RATE).toFixed(4)
  const baselineInr = (baselineCostUsd * INR_RATE).toFixed(2)

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <TrendingDown className="w-3 h-3 text-emerald-500" />
        <span>₹{costInr} spent</span>
        {savings > 0 && <span className="text-emerald-600 font-medium">{savings.toFixed(0)}% saved</span>}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
          <TrendingDown className="w-4 h-4 text-emerald-500" />
          Cost Meter
        </h3>
        <span className="text-xs text-gray-400">{sessionQueries} queries</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-emerald-50 rounded-lg p-2.5">
          <p className="text-xs text-emerald-600 font-medium">VidyaSathi</p>
          <p className="text-lg font-bold text-emerald-700">₹{costInr}</p>
          <p className="text-xs text-emerald-500">${sessionCostUsd.toFixed(5)}</p>
        </div>
        <div className="bg-red-50 rounded-lg p-2.5">
          <p className="text-xs text-red-500 font-medium">GPT-4 Baseline</p>
          <p className="text-lg font-bold text-red-600">₹{baselineInr}</p>
          <p className="text-xs text-red-400">${baselineCostUsd.toFixed(3)}</p>
        </div>
      </div>

      {savings > 0 && (
        <div className="bg-gradient-to-r from-emerald-500 to-green-500 rounded-lg p-2.5 text-white text-center">
          <p className="text-xs opacity-80">You saved</p>
          <p className="text-xl font-bold">{savings.toFixed(1)}%</p>
        </div>
      )}

      <div className="space-y-1.5">
        <TierBar icon={<Database className="w-3 h-3" />} label="Cached (₹0)" value={cacheHitRate} color="bg-emerald-400" />
        <TierBar icon={<Zap className="w-3 h-3" />} label="Flash" value={Math.max(0, 100 - cacheHitRate - 10)} color="bg-blue-400" />
        <TierBar icon={<Cpu className="w-3 h-3" />} label="Pro" value={10} color="bg-violet-400" />
      </div>

      <p className="text-xs text-gray-400 text-center">{sessionTokens.toLocaleString()} tokens used</p>
    </div>
  )
}

function TierBar({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={clsx('text-gray-500', 'shrink-0')}>{icon}</span>
      <span className="text-xs text-gray-500 w-16 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
        <div className={clsx('h-1.5 rounded-full transition-all', color)} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className="text-xs text-gray-400 w-8 text-right">{value.toFixed(0)}%</span>
    </div>
  )
}
