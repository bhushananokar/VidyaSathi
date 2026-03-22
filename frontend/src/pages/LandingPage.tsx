import React from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Wifi, Mic, Brain, TrendingDown, Shield, Star, ArrowRight, CheckCircle } from 'lucide-react'

const STATS = [
  { value: '₹0.02', label: 'per question' },
  { value: '50x', label: 'cheaper than GPT-4' },
  { value: '11+', label: 'Indian languages' },
  { value: '100%', label: 'offline capable' },
]

const FEATURES = [
  {
    icon: Wifi,
    title: 'Offline First',
    desc: 'Download content packs at school/library. Study anywhere — no internet needed.',
    color: 'text-emerald-600 bg-emerald-50',
  },
  {
    icon: Mic,
    title: 'Voice in Hindi & Marathi',
    desc: 'Speak your question in any Indian language. Get answers spoken back to you.',
    color: 'text-saffron-600 bg-saffron-50',
  },
  {
    icon: Brain,
    title: 'Adapts to You',
    desc: 'VidyaSathi learns whether you\'re a visual, auditory, or hands-on learner.',
    color: 'text-primary-600 bg-primary-50',
  },
  {
    icon: TrendingDown,
    title: 'Ultra Low Cost',
    desc: 'Multi-tier AI routing means 70% of answers are free from cache.',
    color: 'text-violet-600 bg-violet-50',
  },
  {
    icon: BookOpen,
    title: 'State Board Textbooks',
    desc: 'Built on Maharashtra SSC, CBSE, ICSE — exactly what\'s in your exam.',
    color: 'text-blue-600 bg-blue-50',
  },
  {
    icon: Shield,
    title: 'Privacy First',
    desc: 'No PII sold. Student data stays on-device or encrypted on our servers.',
    color: 'text-pink-600 bg-pink-50',
  },
]

const COST_COMPARISON = [
  { label: 'GPT-4 (every query)', cost: 15, color: 'bg-red-500' },
  { label: 'GPT-4 with RAG', cost: 8, color: 'bg-orange-400' },
  { label: 'VidyaSathi', cost: 0.3, color: 'bg-emerald-500' },
]

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-primary-600 to-saffron-500 rounded-xl flex items-center justify-center shadow">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-transparent bg-clip-text bg-gradient-to-r from-primary-700 to-saffron-600">VidyaSathi</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/onboarding" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              Login
            </Link>
            <Link
              to="/onboarding"
              className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 transition-colors shadow-sm"
            >
              Start Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-900 via-primary-800 to-saffron-700 text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-64 h-64 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-saffron-400 blur-3xl" />
        </div>
        <div className="relative max-w-5xl mx-auto px-4 py-20 md:py-32 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-sm font-medium mb-6">
            <Star className="w-4 h-4 text-saffron-300" />
            Built for 500 million Indian students
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-6">
            Every Student Deserves<br />
            <span className="text-white">
              a Personal Tutor
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto mb-10 leading-relaxed">
            VidyaSathi is an offline-first AI tutor built for rural India. It ingests your state-board textbooks,
            adapts to your learning style, and works on ₹8,000 Android phones with spotty 2G.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/onboarding"
              className="flex items-center gap-2 px-8 py-4 bg-saffron-500 hover:bg-saffron-400 text-white font-bold rounded-2xl text-lg shadow-xl transition-all hover:scale-105"
            >
              Start Learning Free <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/teacher"
              className="px-8 py-4 border border-white/30 text-white font-medium rounded-2xl text-lg hover:bg-white/10 transition-colors"
            >
              Teacher Portal
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 max-w-2xl mx-auto">
            {STATS.map((s) => (
              <div key={s.label} className="bg-white/10 rounded-2xl p-4 border border-white/20">
                <p className="text-2xl font-extrabold text-saffron-300">{s.value}</p>
                <p className="text-sm text-white/70">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Built for Bharat, not Silicon Valley
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              Every decision in VidyaSathi is made with rural India in mind — connectivity, cost, language, and curriculum.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${f.color}`}>
                  <f.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cost comparison */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">The Cost Story</h2>
            <p className="text-gray-500">Cost per 1,000 queries (USD)</p>
          </div>
          <div className="space-y-4">
            {COST_COMPARISON.map((item) => (
              <div key={item.label} className="flex items-center gap-4">
                <span className="text-sm text-gray-600 w-48 shrink-0">{item.label}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-8 overflow-hidden">
                  <div
                    className={`h-8 rounded-full flex items-center justify-end pr-3 transition-all ${item.color}`}
                    style={{ width: `${(item.cost / 15) * 100}%`, minWidth: '60px' }}
                  >
                    <span className="text-white text-sm font-bold">${item.cost}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 bg-emerald-50 rounded-2xl p-6 border border-emerald-200">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-emerald-800">50× cheaper than GPT-4 per question</p>
                <p className="text-sm text-emerald-700 mt-1">
                  Our multi-tier system uses local cache (free), semantic cache (free), Gemini Flash (₹0.006/query), and Gemini Pro (₹0.08/query) — routing each question to the cheapest capable model.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-gradient-to-br from-primary-50 to-saffron-50">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">How it works</h2>
          <p className="text-gray-500 mb-12">From textbook to tutor in 3 steps</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { step: '01', title: 'Upload Textbook', desc: 'Teachers upload state-board PDFs. VidyaSathi parses, chunks, and indexes every page.' },
              { step: '02', title: 'Onboard in 5 min', desc: 'Students take a quick learning style quiz. VidyaSathi creates a personalized profile.' },
              { step: '03', title: 'Ask Anything', desc: 'Type or speak your question in any Indian language. Get a tailored, cost-optimized answer.' },
            ].map((s) => (
              <div key={s.step} className="bg-white rounded-2xl p-6 shadow-sm border border-white">
                <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center mb-4 mx-auto">
                  <span className="text-primary-700 font-extrabold text-lg">{s.step}</span>
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary-900 text-white text-center">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-4">
            Start learning today. It's free.
          </h2>
          <p className="text-white/70 text-lg mb-8">
            VidyaSathi — every student deserves a tutor that never runs out of patience.
          </p>
          <Link
            to="/onboarding"
            className="inline-flex items-center gap-2 px-8 py-4 bg-saffron-500 hover:bg-saffron-400 text-white font-bold rounded-2xl text-lg shadow-xl transition-all hover:scale-105"
          >
            Get Started Free <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 text-center text-sm">
        <div className="flex items-center justify-center gap-2 mb-2">
          <BookOpen className="w-4 h-4 text-primary-400" />
          <span className="text-white font-semibold">VidyaSathi</span>
        </div>
        <p>Built with ❤️ for rural India · Powered by Gemini + Groq</p>
      </footer>
    </div>
  )
}
