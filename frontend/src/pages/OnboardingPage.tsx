import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, ChevronRight, ChevronLeft, Loader2, Check } from 'lucide-react'
import { LearningProfileChart } from '../components/LearningProfileChart'
import { authApi } from '../services/api'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import type { LearningProfile } from '../types'
import clsx from 'clsx'

const BOARDS = ['Maharashtra SSC', 'CBSE', 'ICSE', 'Karnataka SSLC', 'Tamil Nadu SAMACHEER', 'UP Board', 'Rajasthan Board']
const SUBJECTS = ['Science', 'Mathematics', 'Social Science', 'History', 'Geography', 'English', 'Hindi', 'Marathi', 'Physics', 'Chemistry', 'Biology']

// Assessment questions — each tests a different learning modality using the same concept (Water Cycle)
const ASSESSMENT_QUESTIONS = [
  {
    id: 'q1',
    modality: 'read_write' as const,
    prompt: 'Read the following and answer:',
    content: '"The water cycle describes how water evaporates from the surface of the Earth, rises into the atmosphere, cools and condenses into rain or snow, and falls again to the surface as precipitation."',
    contentType: 'text' as const,
    question: 'What happens to water when it rises into the atmosphere?',
    options: ['It freezes immediately', 'It condenses into clouds', 'It disappears', 'It becomes steam forever'],
    correct: 'B',
  },
  {
    id: 'q2',
    modality: 'visual' as const,
    prompt: 'Look at this diagram and answer:',
    content: '☀️ → 💧 (Evaporation) → ☁️ (Condensation) → 🌧️ (Precipitation) → 🏔️ (Runoff) → 🌊 → ☀️',
    contentType: 'diagram' as const,
    question: 'According to the diagram, what comes after condensation?',
    options: ['Evaporation', 'Runoff', 'Precipitation', 'Solar radiation'],
    correct: 'C',
  },
  {
    id: 'q3',
    modality: 'kinesthetic' as const,
    prompt: 'Follow these steps to understand the water cycle:',
    content: 'Step 1: Heat a pan of water → steam rises (evaporation). Step 2: Hold a cold plate above → water drops form (condensation). Step 3: Drops fall back into pan (precipitation). Step 4: Process repeats.',
    contentType: 'steps' as const,
    question: 'If you remove the cold plate in Step 2, what would happen?',
    options: ['Water would still condense', 'Condensation would stop', 'Evaporation would stop', 'Steam would become rain'],
    correct: 'B',
  },
  {
    id: 'q4',
    modality: 'auditory' as const,
    prompt: 'Imagine your teacher is explaining:',
    content: '"Think of it like this — the sun is the engine. It heats ocean water, which rises as invisible vapor. High up, where it\'s cold, the vapor meets cooler air and forms clouds. Those clouds get heavy and... SPLASH! Rain falls back down. Simple, right?"',
    contentType: 'text' as const,
    question: 'In this explanation, what acts as the "engine" of the water cycle?',
    options: ['Cold air', 'Clouds', 'The Sun', 'The Ocean'],
    correct: 'C',
  },
  {
    id: 'q5',
    modality: 'visual' as const,
    prompt: 'Study this comparison chart:',
    content: `
| Stage       | Energy Required | Result        |
|-------------|----------------|---------------|
| Evaporation | High (heat)    | Water vapor   |
| Condensation| Low (cooling)  | Water droplets|
| Precipitation| None          | Rain/snow     |`,
    contentType: 'diagram' as const,
    question: 'Which stage requires the most energy?',
    options: ['Condensation', 'Precipitation', 'Evaporation', 'Runoff'],
    correct: 'C',
  },
  {
    id: 'q6',
    modality: 'kinesthetic' as const,
    prompt: 'Try this thought experiment:',
    content: 'You have a glass of ice water on a hot day. Notice the water drops on the outside of the glass. This is the same process that forms clouds! The warm air around the glass loses heat when it touches the cold glass.',
    contentType: 'text' as const,
    question: 'The water drops on the outside of an ice glass demonstrate which process?',
    options: ['Evaporation', 'Runoff', 'Condensation', 'Precipitation'],
    correct: 'C',
  },
  {
    id: 'q7',
    modality: 'read_write' as const,
    prompt: 'Fill in the blank after reading:',
    content: 'The continuous movement of water through the Earth\'s systems is called the hydrological cycle or water cycle. It has no beginning and no end — it is a closed system that recycles water.',
    contentType: 'text' as const,
    question: 'The water cycle is described as a "closed system" because:',
    options: ['It only happens in closed containers', 'Water is continuously recycled with no start/end', 'It occurs only underground', 'It needs human intervention'],
    correct: 'B',
  },
  {
    id: 'q8',
    modality: 'auditory' as const,
    prompt: 'Your study partner explains:',
    content: '"Ok so basically — ocean gets hot, water evaporates upward, gets cold, becomes clouds, clouds get too full, it rains, water runs into rivers, rivers go back to ocean, and it starts all over. It\'s like the Earth is breathing water!"',
    contentType: 'text' as const,
    question: 'After it rains in this explanation, where does the water go next?',
    options: ['Back to clouds immediately', 'Underground forever', 'Into rivers and back to ocean', 'It evaporates again instantly'],
    correct: 'C',
  },
]

interface AssessmentResponse {
  question_id: string
  answer: string
  time_taken_ms: number
  correct: boolean
}

function computeProfile(responses: AssessmentResponse[]): LearningProfile {
  const scores: Record<string, number[]> = { visual: [], auditory: [], read_write: [], kinesthetic: [] }
  responses.forEach((resp, i) => {
    const q = ASSESSMENT_QUESTIONS[i]
    if (!q) return
    // Score = correct (1) * speed bonus (faster = higher, max 2.0x multiplier)
    const speed = Math.max(0.5, Math.min(2.0, 10000 / (resp.time_taken_ms + 1000)))
    const score = (resp.correct ? 1 : 0.3) * speed
    scores[q.modality].push(score)
  })
  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0.25
  const raw = { visual: avg(scores.visual), auditory: avg(scores.auditory), read_write: avg(scores.read_write), kinesthetic: avg(scores.kinesthetic) }
  const total = Object.values(raw).reduce((a, b) => a + b, 0) || 1
  return { visual: raw.visual / total, auditory: raw.auditory / total, read_write: raw.read_write / total, kinesthetic: raw.kinesthetic / total }
}

export const OnboardingPage: React.FC = () => {
  const navigate = useNavigate()
  const { setToken, setStudent } = useAuthStore()

  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)

  // Step 0: Basic info
  const [name, setName] = useState('')
  const [grade, setGrade] = useState(10)
  const [board, setBoard] = useState('Maharashtra SSC')
  const [school, setSchool] = useState('')
  const [password, setPassword] = useState('')

  // Step 1: Assessment
  const [currentQ, setCurrentQ] = useState(0)
  const [responses, setResponses] = useState<AssessmentResponse[]>([])
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [questionStart, setQuestionStart] = useState(Date.now())

  // Step 2: Subject selection
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(['Science', 'Mathematics'])

  // Step 3: Profile result
  const [profile, setProfile] = useState<LearningProfile | null>(null)

  const handleAnswerSubmit = () => {
    if (!selectedOption) return
    const q = ASSESSMENT_QUESTIONS[currentQ]
    const timeTaken = Date.now() - questionStart
    const resp: AssessmentResponse = {
      question_id: q.id,
      answer: selectedOption,
      time_taken_ms: timeTaken,
      correct: selectedOption === q.correct,
    }
    const updated = [...responses, resp]
    setResponses(updated)
    setSelectedOption(null)

    if (currentQ < ASSESSMENT_QUESTIONS.length - 1) {
      setCurrentQ(currentQ + 1)
      setQuestionStart(Date.now())
    } else {
      // Done with assessment — compute profile
      const computed = computeProfile(updated)
      setProfile(computed)
      setStep(2)
    }
  }

  const handleRegister = async () => {
    if (!name.trim() || !password) return
    setLoading(true)
    try {
      const res = await authApi.register({ name, grade, board, school, password })
      setToken(res.access_token)
      // Update student profile with learning profile
      const student = { ...res.student, learning_profile: profile! }
      setStudent(student)
      setStep(3)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Registration failed'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const q = ASSESSMENT_QUESTIONS[currentQ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-saffron-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-saffron-500 rounded-xl flex items-center justify-center shadow">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <span className="font-extrabold text-2xl text-transparent bg-clip-text bg-gradient-to-r from-primary-700 to-saffron-600">VidyaSathi</span>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {['Your Info', 'Style Quiz', 'Subjects', 'Ready!'].map((label, i) => (
            <React.Fragment key={i}>
              <div className={clsx('flex flex-col items-center', i > 0 && 'ml-1')}>
                <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all',
                  i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-primary-600 text-white ring-4 ring-primary-100' : 'bg-gray-200 text-gray-500'
                )}>
                  {i < step ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                <span className={clsx('text-xs mt-1 hidden sm:block', i === step ? 'text-primary-600 font-medium' : 'text-gray-400')}>{label}</span>
              </div>
              {i < 3 && <div className={clsx('flex-1 h-0.5 mx-1 max-w-8', i < step ? 'bg-emerald-500' : 'bg-gray-200')} />}
            </React.Fragment>
          ))}
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Step 0: Basic Info */}
          {step === 0 && (
            <div className="p-8 space-y-5">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Welcome to VidyaSathi!</h2>
                <p className="text-gray-500 mt-1">Tell us about yourself to get started.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Your Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Priya Sharma"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Grade</label>
                    <select
                      value={grade}
                      onChange={(e) => setGrade(Number(e.target.value))}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white"
                    >
                      {[6,7,8,9,10,11,12].map((g) => (
                        <option key={g} value={g}>Grade {g}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Board</label>
                    <select
                      value={board}
                      onChange={(e) => setBoard(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white"
                    >
                      {BOARDS.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">School (optional)</label>
                  <input
                    type="text"
                    value={school}
                    onChange={(e) => setSchool(e.target.value)}
                    placeholder="Your school name"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a password"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  />
                </div>
              </div>
              <button
                onClick={() => setStep(1)}
                disabled={!name.trim() || !password}
                className="w-full py-3.5 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                Continue <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Step 1: Assessment */}
          {step === 1 && (
            <div className="p-8 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Learning Style Quiz</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Question {currentQ + 1} of {ASSESSMENT_QUESTIONS.length}</p>
                </div>
                <div className="text-2xl">{['📖', '🖼️', '🔬', '🗣️', '📊', '🧊', '📝', '💬'][currentQ]}</div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="h-2 bg-gradient-to-r from-primary-500 to-saffron-500 rounded-full transition-all"
                  style={{ width: `${((currentQ) / ASSESSMENT_QUESTIONS.length) * 100}%` }}
                />
              </div>

              <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{q.prompt}</p>
                <div className={clsx('text-sm text-gray-700 leading-relaxed', q.contentType === 'diagram' && 'font-mono whitespace-pre-wrap')}>
                  {q.content}
                </div>
              </div>

              <p className="font-semibold text-gray-800">{q.question}</p>

              <div className="space-y-2">
                {q.options.map((opt, i) => {
                  const letter = ['A', 'B', 'C', 'D'][i]
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedOption(letter)}
                      className={clsx(
                        'w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all',
                        selectedOption === letter
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                      )}
                    >
                      <span className={clsx('inline-flex w-6 h-6 rounded-full text-xs items-center justify-center mr-2 shrink-0', selectedOption === letter ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-600')}>
                        {letter}
                      </span>
                      {opt}
                    </button>
                  )
                })}
              </div>

              <button
                onClick={handleAnswerSubmit}
                disabled={!selectedOption}
                className="w-full py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {currentQ < ASSESSMENT_QUESTIONS.length - 1 ? 'Next Question' : 'See My Profile'}
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Step 2: Subject selection + register */}
          {step === 2 && (
            <div className="p-8 space-y-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Choose your subjects</h2>
                <p className="text-sm text-gray-500 mt-1">Select subjects you want to study. You can change these later.</p>
              </div>

              {profile && (
                <div className="bg-primary-50 rounded-2xl p-4 border border-primary-100">
                  <p className="text-xs font-semibold text-primary-600 uppercase tracking-wide mb-3">Your Learning Profile</p>
                  <LearningProfileChart profile={profile} size={180} />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                {SUBJECTS.map((subject) => (
                  <button
                    key={subject}
                    onClick={() => setSelectedSubjects((prev) =>
                      prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject]
                    )}
                    className={clsx(
                      'px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all text-left',
                      selectedSubjects.includes(subject)
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    )}
                  >
                    {selectedSubjects.includes(subject) && <Check className="w-3 h-3 inline mr-1 text-primary-500" />}
                    {subject}
                  </button>
                ))}
              </div>

              <button
                onClick={handleRegister}
                disabled={selectedSubjects.length === 0 || loading}
                className="w-full py-3.5 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Creating account...</> : <>Create My Account <ChevronRight className="w-5 h-5" /></>}
              </button>

              <button onClick={() => setStep(0)} className="w-full text-sm text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            </div>
          )}

          {/* Step 3: Ready */}
          {step === 3 && (
            <div className="p-8 text-center space-y-5">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-10 h-10 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">You're all set, {name.split(' ')[0]}!</h2>
                <p className="text-gray-500 mt-2">Your personalized tutor is ready. Let's start learning!</p>
              </div>
              {profile && (
                <div className="bg-gray-50 rounded-2xl p-4 text-left border border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Your Learning Profile</p>
                  <LearningProfileChart profile={profile} size={200} />
                </div>
              )}
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full py-4 bg-gradient-to-r from-primary-600 to-saffron-500 text-white rounded-2xl font-bold text-lg hover:opacity-90 transition-opacity shadow-lg"
              >
                Go to Dashboard 🚀
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
