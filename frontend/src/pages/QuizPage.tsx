import React, { useState } from 'react'
import { Brain, CheckCircle, XCircle, Trophy, ChevronRight, RotateCcw, Loader2, NotebookPen, BookOpen } from 'lucide-react'
import { Navbar } from '../components/Navbar'
import { OfflineBanner } from '../components/OfflineBanner'
import { quizApi, adminApi, notebookApi } from '../services/api'
import { useProgressStore } from '../store/progressStore'
import { useAuthStore } from '../store/authStore'
import type { QuizQuestion, QuizResult, TextbookInfo } from '../types'
import type { NotebookInfo } from '../services/api'
import toast from 'react-hot-toast'
import clsx from 'clsx'

type QuizState = 'setup' | 'loading' | 'quiz' | 'result'
type SourceType = 'textbook' | 'notebook'

export const QuizPage: React.FC = () => {
  const { addXP, addQuizHistory } = useProgressStore()
  const { refreshStudent } = useAuthStore()

  const [state, setState] = useState<QuizState>('setup')
  const [source, setSource] = useState<SourceType>('notebook')

  // Textbook source
  const [textbooks, setTextbooks] = useState<TextbookInfo[]>([])
  const [selectedTextbook, setSelectedTextbook] = useState('')
  const [selectedChapter, setSelectedChapter] = useState(1)

  // Notebook source
  const [notebooks, setNotebooks] = useState<NotebookInfo[]>([])
  const [selectedNotebook, setSelectedNotebook] = useState('')

  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'adaptive'>('adaptive')
  const [questionCount, setQuestionCount] = useState(10)

  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<QuizResult | null>(null)

  React.useEffect(() => {
    adminApi.listTextbooks().then(setTextbooks).catch(() => {})
    notebookApi.list().then(nbs => setNotebooks(nbs.filter(n => n.status === 'ready'))).catch(() => {})
  }, [])

  const handleStart = async () => {
    if (source === 'textbook' && !selectedTextbook) { toast.error('Select a textbook first'); return }
    if (source === 'notebook' && !selectedNotebook) { toast.error('Select a notebook first'); return }
    setState('loading')
    try {
      let qs: QuizQuestion[]
      if (source === 'notebook') {
        qs = await notebookApi.generateQuiz(selectedNotebook, questionCount, difficulty)
      } else {
        qs = await quizApi.generate(selectedTextbook, selectedChapter, difficulty, questionCount)
      }
      setQuestions(qs)
      setCurrentIndex(0)
      setAnswers({})
      setState('quiz')
    } catch {
      toast.error('Failed to generate quiz')
      setState('setup')
    }
  }

  const handleAnswer = (answer: string) => {
    const q = questions[currentIndex]
    setAnswers(prev => ({ ...prev, [q.id]: answer }))
  }

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1)
    } else {
      handleSubmit()
    }
  }

  const handleSubmit = async () => {
    setState('loading')
    try {
      let res: QuizResult
      if (source === 'notebook') {
        // Grade client-side for notebook quizzes
        const perQuestion = questions.map(q => {
          const studentAns = answers[q.id] || ''
          const correct = studentAns.trim().toLowerCase() === q.correct_answer.trim().toLowerCase()
          return { question_id: q.id, correct, student_answer: studentAns, correct_answer: q.correct_answer, explanation: q.explanation }
        })
        const score = perQuestion.filter(p => p.correct).length
        const pct = Math.round((score / questions.length) * 100)
        const xp = Math.round(pct * 0.5)
        res = { score, total: questions.length, percentage: pct, xp_earned: xp, mastery_delta: 0, weak_topics: [], per_question: perQuestion }
        // Persist XP to backend for notebook quizzes
        const awarded = await quizApi.awardXp(xp)
        useAuthStore.getState().updateXP(awarded.xp)
        useAuthStore.getState().updateStreak(awarded.streak)
      } else {
        const answerList = questions.map(q => ({ question_id: q.id, answer: answers[q.id] || '' }))
        res = await quizApi.submit(selectedTextbook, selectedChapter, answerList)
        // Refresh student from backend to get updated XP/streak
        await refreshStudent()
      }
      setResult(res)
      addXP(res.xp_earned)
      const nb = notebooks.find(n => n.id === selectedNotebook)
      const tb = textbooks.find(t => t.id === selectedTextbook)
      addQuizHistory({
        id: Date.now().toString(),
        subject: nb?.title || tb?.subject || '',
        chapter_title: source === 'notebook' ? (nb?.title || 'Notebook Quiz') : `Chapter ${selectedChapter}`,
        score: res.score, total: res.total, percentage: res.percentage,
        xp_earned: res.xp_earned, date: new Date().toISOString(),
      })
      setState('result')
    } catch {
      toast.error('Failed to submit quiz')
      setState('quiz')
    }
  }

  const q = questions[currentIndex]
  const selectedAnswer = q ? answers[q.id] : undefined
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <OfflineBanner />
      <main className="max-w-2xl mx-auto px-4 py-8">

        {/* Setup */}
        {state === 'setup' && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-saffron-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Brain className="w-8 h-8 text-saffron-500" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Quiz Mode</h1>
              <p className="text-gray-500 mt-1">Test your knowledge with adaptive questions</p>
            </div>

            {/* Source selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Quiz From</label>
              <div className="flex gap-2 bg-gray-100 rounded-xl p-1">
                {([['notebook', 'My Notebook', NotebookPen], ['textbook', 'Textbook', BookOpen]] as const).map(([id, label, Icon]) => (
                  <button key={id} onClick={() => setSource(id)}
                    className={clsx('flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      source === id ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                    <Icon className="w-4 h-4" />{label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {source === 'notebook' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Notebook</label>
                  <select value={selectedNotebook} onChange={e => setSelectedNotebook(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white text-sm">
                    <option value="">Select a notebook...</option>
                    {notebooks.map(n => <option key={n.id} value={n.id}>{n.source_type === 'pdf' ? '📄' : '📝'} {n.title}</option>)}
                  </select>
                  {notebooks.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">No ready notebooks. Add content in the Notebook tab first.</p>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Textbook</label>
                    <select value={selectedTextbook} onChange={e => setSelectedTextbook(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white text-sm">
                      <option value="">Select a textbook...</option>
                      {textbooks.filter(t => t.status === 'ready').map(t => (
                        <option key={t.id} value={t.id}>{t.title} — {t.subject} (Grade {t.grade})</option>
                      ))}
                    </select>
                    {textbooks.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">No textbooks available. Upload one in the Admin panel.</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Chapter</label>
                    <select value={selectedChapter} onChange={e => setSelectedChapter(Number(e.target.value))}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white text-sm">
                      {Array.from({ length: 15 }, (_, i) => i + 1).map(c => (
                        <option key={c} value={c}>Chapter {c}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Questions</label>
                  <select value={questionCount} onChange={e => setQuestionCount(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white text-sm">
                    {[5, 10, 15, 20].map(n => <option key={n} value={n}>{n} questions</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Difficulty</label>
                  <select value={difficulty} onChange={e => setDifficulty(e.target.value as any)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white text-sm">
                    <option value="adaptive">🎯 Adaptive</option>
                    <option value="easy">🟢 Easy</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="hard">🔴 Hard</option>
                  </select>
                </div>
              </div>
            </div>

            <button onClick={handleStart}
              className="w-full py-4 bg-gradient-to-r from-saffron-500 to-saffron-600 text-white rounded-2xl font-bold text-lg hover:opacity-90 transition-opacity shadow-md">
              Start Quiz 🚀
            </button>
          </div>
        )}

        {/* Loading */}
        {state === 'loading' && (
          <div className="text-center py-24">
            <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-500 font-medium">
              {source === 'notebook' ? 'Generating quiz from your notebook...' : 'Generating your quiz...'}
            </p>
          </div>
        )}

        {/* Quiz */}
        {state === 'quiz' && q && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">Question {currentIndex + 1} of {questions.length}</span>
              <span className={clsx('text-xs px-2.5 py-1 rounded-full font-medium',
                q.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700' :
                q.difficulty === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700')}>
                {q.difficulty}
              </span>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="h-2 bg-gradient-to-r from-primary-500 to-saffron-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 space-y-5">
              <p className="text-gray-500 text-xs uppercase font-semibold tracking-wide">{q.topic}</p>
              <p className="text-lg font-semibold text-gray-900 leading-relaxed">{q.question}</p>

              {q.type === 'mcq' && q.options && (
                <div className="space-y-2">
                  {q.options.map((opt, i) => (
                    <button key={i} onClick={() => handleAnswer(opt)}
                      className={clsx('w-full text-left px-4 py-3.5 rounded-xl border-2 text-sm font-medium transition-all flex items-center gap-3',
                        selectedAnswer === opt
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50')}>
                      <span className={clsx('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                        selectedAnswer === opt ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-600')}>
                        {['A', 'B', 'C', 'D'][i]}
                      </span>
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {q.type === 'true_false' && (
                <div className="grid grid-cols-2 gap-3">
                  {['True', 'False'].map(opt => (
                    <button key={opt} onClick={() => handleAnswer(opt)}
                      className={clsx('py-4 rounded-xl border-2 text-sm font-semibold transition-all',
                        selectedAnswer === opt ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-700 hover:border-gray-300')}>
                      {opt === 'True' ? '✅ True' : '❌ False'}
                    </button>
                  ))}
                </div>
              )}

              {q.type === 'fill_blank' && (
                <input type="text" placeholder="Type your answer..."
                  value={answers[q.id] || ''} onChange={e => handleAnswer(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-primary-500 text-sm" />
              )}

              <button onClick={handleNext} disabled={!selectedAnswer && !answers[q.id]}
                className="w-full py-3.5 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {currentIndex < questions.length - 1 ? 'Next Question' : 'Submit Quiz'}
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Result */}
        {state === 'result' && result && (
          <div className="space-y-4">
            <div className={clsx('rounded-3xl p-8 text-center shadow-lg',
              result.percentage >= 70 ? 'bg-gradient-to-br from-emerald-500 to-green-600' :
              result.percentage >= 40 ? 'bg-gradient-to-br from-amber-400 to-orange-500' :
              'bg-gradient-to-br from-red-500 to-rose-600')}>
              <div className="text-6xl font-extrabold text-white mb-2">{result.percentage}%</div>
              <p className="text-white/80 text-lg">{result.score} / {result.total} correct</p>
              <div className="flex items-center justify-center gap-2 mt-4">
                <Trophy className="w-5 h-5 text-yellow-300" />
                <span className="text-white font-bold">+{result.xp_earned} XP earned!</span>
              </div>
              <p className="text-white/70 text-sm mt-2">
                {result.percentage >= 70 ? "🎉 Excellent! You've mastered this content!" :
                 result.percentage >= 40 ? '👍 Good effort! Keep practicing.' :
                 '📚 Review the content and try again!'}
              </p>
            </div>

            {result.weak_topics?.length > 0 && (
              <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200">
                <p className="font-semibold text-amber-800 mb-2">Topics to review:</p>
                <div className="flex flex-wrap gap-2">
                  {result.weak_topics.map(t => <span key={t} className="text-xs px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full">{t}</span>)}
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <p className="font-semibold text-gray-800">Question Breakdown</p>
              </div>
              <div className="divide-y divide-gray-50">
                {result.per_question?.map((pq, i) => (
                  <div key={i} className="px-5 py-3 flex items-start gap-3">
                    {pq.correct ? <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" /> : <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />}
                    <div className="min-w-0">
                      <p className="text-sm text-gray-700 font-medium">Q{i + 1}</p>
                      {!pq.correct && (
                        <>
                          <p className="text-xs text-red-500 mt-0.5">Your answer: {pq.student_answer || '(no answer)'}</p>
                          <p className="text-xs text-emerald-600">Correct: {pq.correct_answer}</p>
                        </>
                      )}
                      {pq.explanation && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{pq.explanation}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setState('setup'); setResult(null) }}
                className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2">
                <RotateCcw className="w-4 h-4" /> Try Again
              </button>
              <button onClick={handleStart}
                className="flex-1 py-3 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 flex items-center justify-center gap-2">
                New Quiz <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
