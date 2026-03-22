import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'
import { useOnlineStatus } from './hooks/useOnlineStatus'

import { LandingPage } from './pages/LandingPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { DashboardPage } from './pages/DashboardPage'
import { ChatPage } from './pages/ChatPage'
import { QuizPage } from './pages/QuizPage'
import { RevisionPage } from './pages/RevisionPage'
import { AdminPage } from './pages/AdminPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { TeacherDashboard } from './pages/TeacherDashboard'
import { NotebookPage } from './pages/NotebookPage'
import { HistoryPage } from './pages/HistoryPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  if (!token) return <Navigate to="/onboarding" replace />
  return <>{children}</>
}

export default function App() {
  // Initialize online status listener at top level
  useOnlineStatus()

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: { borderRadius: '12px', fontSize: '14px', fontWeight: '500' },
          success: { style: { background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' } },
          error: { style: { background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' } },
        }}
      />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
        <Route path="/chat/:subject" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
        <Route path="/quiz" element={<ProtectedRoute><QuizPage /></ProtectedRoute>} />
        <Route path="/revision" element={<ProtectedRoute><RevisionPage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
        <Route path="/notebook" element={<ProtectedRoute><NotebookPage /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
        <Route path="/teacher" element={<TeacherDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
