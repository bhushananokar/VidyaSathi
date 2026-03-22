import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { BookOpen, Home, MessageSquare, Brain, BookMarked, BarChart2, Menu, X, Wifi, WifiOff, LogOut, Settings, NotebookPen, Clock } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useProgressStore } from '../store/progressStore'
import clsx from 'clsx'

const NAV_ITEMS = [
  { to: '/dashboard', icon: Home, label: 'Dashboard' },
  { to: '/chat', icon: MessageSquare, label: 'Learn' },
  { to: '/notebook', icon: NotebookPen, label: 'Notebook' },
  { to: '/history', icon: Clock, label: 'History' },
  { to: '/quiz', icon: Brain, label: 'Quiz' },
  { to: '/revision', icon: BookMarked, label: 'Revision' },
  { to: '/analytics', icon: BarChart2, label: 'Analytics' },
]

export const Navbar: React.FC = () => {
  const { student, isOnline, logout } = useAuthStore()
  const { totalXP } = useProgressStore()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const xpLevel = Math.floor((student?.xp ?? totalXP) / 500) + 1
  const xpProgress = ((student?.xp ?? totalXP) % 500) / 500 * 100

  return (
    <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <NavLink to="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-600 to-saffron-500 rounded-lg flex items-center justify-center shadow-sm">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-700 to-saffron-600 text-lg hidden sm:block">
              VidyaSathi
            </span>
          </NavLink>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  )
                }
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Online indicator */}
            <div className="flex items-center gap-1.5">
              {isOnline
                ? <Wifi className="w-4 h-4 text-emerald-500" />
                : <WifiOff className="w-4 h-4 text-amber-500 animate-pulse" />}
              <span className={clsx('text-xs font-medium hidden sm:block', isOnline ? 'text-emerald-600' : 'text-amber-600')}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>

            {/* Student XP */}
            {student && (
              <div className="hidden sm:flex items-center gap-2">
                <div className="text-right">
                  <p className="text-xs font-semibold text-gray-700">{student.name.split(' ')[0]}</p>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-primary-600 font-medium">Lv.{xpLevel}</span>
                    <div className="w-16 h-1 bg-gray-200 rounded-full">
                      <div className="h-1 bg-gradient-to-r from-primary-500 to-saffron-500 rounded-full" style={{ width: `${xpProgress}%` }} />
                    </div>
                  </div>
                </div>
                {student.streak > 0 && (
                  <span className="text-sm" title={`${student.streak} day streak`}>🔥{student.streak}</span>
                )}
              </div>
            )}

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="hidden sm:flex p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>

            {/* Admin */}
            <NavLink to="/admin" className="hidden sm:flex p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors" title="Admin">
              <Settings className="w-4 h-4" />
            </NavLink>

            {/* Mobile menu */}
            <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100">
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100'
                )
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
          <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 w-full">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      )}
    </nav>
  )
}
