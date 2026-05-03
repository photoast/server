'use client'

import { useState, useEffect } from 'react'
import { UIButton, UICard, UIFormField, UITextInput, UIStatusBanner, UISectionHeading, UIBadge } from '@/app/components/ui'

interface User {
  _id: string
  provider: 'google' | 'kakao'
  email?: string
  name?: string
  profileImage?: string
  credits: number
  createdAt: string
}

interface CreditTransaction {
  _id: string
  amount: number
  type: 'charge' | 'use' | 'refund'
  description: string
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
  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [printJobs, setPrintJobs] = useState<PrintJob[]>([])

  const [chargeAmount, setChargeAmount] = useState('')
  const [chargeDesc, setChargeDesc] = useState('')
  const [refundAmount, setRefundAmount] = useState('')
  const [refundDesc, setRefundDesc] = useState('')
  const [refundJobId, setRefundJobId] = useState('')
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
    setChargeAmount('')
    setChargeDesc('')
    setRefundAmount('')
    setRefundDesc('')
    setRefundJobId('')

    const [txRes, jobsRes] = await Promise.all([
      fetch(`/api/users/${user._id}/credits`),
      fetch(`/api/users/${user._id}/print-jobs`),
    ])
    if (txRes.ok) setTransactions(await txRes.json())
    if (jobsRes.ok) setPrintJobs(await jobsRes.json())
  }

  const handleCharge = async () => {
    if (!selectedUser || !chargeAmount) return
    setError('')
    setMessage('')

    const res = await fetch(`/api/users/${selectedUser._id}/credits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Number(chargeAmount), description: chargeDesc }),
    })

    if (res.ok) {
      const data = await res.json()
      setMessage(`충전 완료. 현재 잔액: ${data.credits.toLocaleString()}원`)
      setSelectedUser({ ...selectedUser, credits: data.credits })
      setChargeAmount('')
      setChargeDesc('')
      // Refresh transactions
      const txRes = await fetch(`/api/users/${selectedUser._id}/credits`)
      if (txRes.ok) setTransactions(await txRes.json())
      fetchUsers()
    } else {
      const data = await res.json()
      setError(data.error || '충전 실패')
    }
  }

  const handleRefund = async () => {
    if (!selectedUser || !refundAmount) return
    setError('')
    setMessage('')

    const res = await fetch(`/api/users/${selectedUser._id}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Number(refundAmount),
        description: refundDesc,
        printJobId: refundJobId || undefined,
      }),
    })

    if (res.ok) {
      const data = await res.json()
      setMessage(`환불 완료. 현재 잔액: ${data.credits.toLocaleString()}원`)
      setSelectedUser({ ...selectedUser, credits: data.credits })
      setRefundAmount('')
      setRefundDesc('')
      setRefundJobId('')
      const [txRes, jobsRes] = await Promise.all([
        fetch(`/api/users/${selectedUser._id}/credits`),
        fetch(`/api/users/${selectedUser._id}/print-jobs`),
      ])
      if (txRes.ok) setTransactions(await txRes.json())
      if (jobsRes.ok) setPrintJobs(await jobsRes.json())
      fetchUsers()
    } else {
      const data = await res.json()
      setError(data.error || '환불 실패')
    }
  }

  const quickRefundJob = (job: PrintJob) => {
    setRefundJobId(job._id)
    setRefundAmount(String(job.paymentAmount || 0))
    setRefundDesc(`프린트 작업 환불 (${new Date(job.createdAt).toLocaleDateString()})`)
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
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">{selectedUser.credits.toLocaleString()}원</p>
                <p className="text-xs text-gray-500">보유 크레딧</p>
              </div>
            </div>
          </div>

          {message && <UIStatusBanner type="success" message={message} />}
          {error && <UIStatusBanner type="error" message={error} />}

          {/* Charge credits */}
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <UISectionHeading title="크레딧 충전" subtitle="고객에게 크레딧을 충전합니다" />
            <div className="flex gap-2">
              <UITextInput
                value={chargeAmount}
                onChange={e => setChargeAmount(e.target.value)}
                placeholder="금액 (원)"
                className="flex-1"
              />
              <UITextInput
                value={chargeDesc}
                onChange={e => setChargeDesc(e.target.value)}
                placeholder="메모 (선택)"
                className="flex-1"
              />
            </div>
            <div className="flex gap-2">
              {[1000, 3000, 5000, 10000].map(amt => (
                <button
                  key={amt}
                  onClick={() => setChargeAmount(String(amt))}
                  className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700"
                >
                  {amt.toLocaleString()}원
                </button>
              ))}
            </div>
            <UIButton onClick={handleCharge} disabled={!chargeAmount}>
              충전하기
            </UIButton>
          </div>

          {/* Refund */}
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <UISectionHeading title="환불" subtitle="크레딧을 환불합니다" />
            <div className="flex gap-2">
              <UITextInput
                value={refundAmount}
                onChange={e => setRefundAmount(e.target.value)}
                placeholder="환불 금액 (원)"
                className="flex-1"
              />
              <UITextInput
                value={refundDesc}
                onChange={e => setRefundDesc(e.target.value)}
                placeholder="메모 (선택)"
                className="flex-1"
              />
            </div>
            <UIButton variant="secondary" onClick={handleRefund} disabled={!refundAmount}>
              환불하기
            </UIButton>
          </div>

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
                    {!job.refunded && job.paymentAmount != null && job.paymentAmount > 0 && (
                      <button
                        onClick={() => quickRefundJob(job)}
                        className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded border border-red-200 hover:bg-red-50"
                      >
                        환불
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Credit transactions */}
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <UISectionHeading title="크레딧 내역" subtitle="충전/사용/환불 이력" />
            {transactions.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">내역이 없습니다</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {transactions.map(tx => (
                  <div key={tx._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{tx.description}</p>
                      <p className="text-xs text-gray-400">{new Date(tx.createdAt).toLocaleString()}</p>
                    </div>
                    <span className={`text-sm font-bold ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}원
                    </span>
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
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-gray-900">{user.credits.toLocaleString()}원</p>
                  <UIBadge variant={user.provider === 'google' ? 'info' : 'warning'}>
                    {user.provider === 'google' ? 'Google' : 'Kakao'}
                  </UIBadge>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
