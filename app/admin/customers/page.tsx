'use client'

import { useState, useEffect } from 'react'
import { UIButton, UICard, UIFormField, UITextInput, UIStatusBanner, UISectionHeading, UIBadge } from '@/app/components/ui'

interface User {
  _id: string
  provider: 'google' | 'kakao'
  email?: string
  name?: string
  profileImage?: string
  createdAt: string
}

interface PrintJob {
  _id: string
  eventId: string
  imageUrl: string
  status: string
  paymentAmount?: number
  refunded?: boolean
  createdAt: string
}

export default function CustomersPage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [printJobs, setPrintJobs] = useState<PrintJob[]>([])

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleLogin = async () => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (res.ok) {
        setAuthenticated(true)
        setLoginError('')
      } else {
        setLoginError('로그인 실패')
      }
    } catch {
      setLoginError('로그인 오류')
    }
  }

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/users')
      if (res.status === 401) { setAuthenticated(false); return }
      if (res.ok) setUsers(await res.json())
    } catch {} finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authenticated) fetchUsers()
  }, [authenticated])

  // Check existing session
  useEffect(() => {
    fetch('/api/users').then(r => {
      if (r.ok) setAuthenticated(true)
    }).catch(() => {})
  }, [])

  const selectUser = async (user: User) => {
    setSelectedUser(user)
    setMessage('')
    setError('')

    const jobsRes = await fetch(`/api/users/${user._id}/print-jobs`)
    if (jobsRes.ok) setPrintJobs(await jobsRes.json())
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm space-y-4">
          <h1 className="text-xl font-bold text-center">관리자 로그인</h1>
          {loginError && <UIStatusBanner type="error" message={loginError} />}
          <UIFormField label="아이디">
            <UITextInput value={username} onChange={e => setUsername(e.target.value)} placeholder="admin" />
          </UIFormField>
          <UIFormField label="비밀번호">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="비밀번호"
            />
          </UIFormField>
          <UIButton fullWidth onClick={handleLogin}>로그인</UIButton>
        </div>
      </div>
    )
  }

  // User detail view
  if (selectedUser) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-2xl mx-auto space-y-6">
          <button
            onClick={() => setSelectedUser(null)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            고객 목록
          </button>

          {/* User info */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex items-center gap-4">
              {selectedUser.profileImage && (
                <img src={selectedUser.profileImage} alt="" className="w-14 h-14 rounded-full" />
              )}
              <div className="flex-1">
                <h2 className="text-lg font-bold">{selectedUser.name || '이름 없음'}</h2>
                <p className="text-sm text-gray-500">{selectedUser.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <UIBadge variant={selectedUser.provider === 'google' ? 'info' : 'warning'}>
                    {selectedUser.provider === 'google' ? 'Google' : 'Kakao'}
                  </UIBadge>
                  <span className="text-xs text-gray-400">
                    가입 {new Date(selectedUser.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {message && <UIStatusBanner type="success" message={message} />}
          {error && <UIStatusBanner type="error" message={error} />}

          {/* Print jobs */}
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <UISectionHeading title="인쇄 기록" subtitle={`총 ${printJobs.length}건`} />
            {printJobs.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">인쇄 기록이 없습니다</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {printJobs.map(job => (
                  <div key={job._id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <img src={job.imageUrl} alt="" className="w-10 h-14 object-cover rounded" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500">
                        {new Date(job.createdAt).toLocaleString()}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <UIBadge variant={job.status === 'DONE' ? 'success' : job.status === 'FAILED' ? 'error' : 'default'}>
                          {job.status}
                        </UIBadge>
                        {job.paymentAmount != null && (
                          <span className="text-xs text-gray-600">{job.paymentAmount.toLocaleString()}원</span>
                        )}
                        {job.refunded && (
                          <UIBadge variant="warning">환불됨</UIBadge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // User list view
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">고객 관리</h1>
            <p className="text-sm text-gray-500 mt-1">총 {users.length}명</p>
          </div>
          <a href="/admin" className="text-sm text-blue-600 hover:text-blue-800">
            관리자 홈
          </a>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-blue-500" />
          </div>
        ) : users.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <p className="text-gray-400">아직 가입한 고객이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-2">
            {users.map(user => (
              <button
                key={user._id}
                onClick={() => selectUser(user)}
                className="w-full flex items-center gap-3 p-4 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow text-left"
              >
                {user.profileImage ? (
                  <img src={user.profileImage} alt="" className="w-10 h-10 rounded-full" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-sm font-bold">
                    {(user.name || '?')[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{user.name || '이름 없음'}</p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
                <UIBadge variant={user.provider === 'google' ? 'info' : 'warning'}>
                  {user.provider === 'google' ? 'Google' : 'Kakao'}
                </UIBadge>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
