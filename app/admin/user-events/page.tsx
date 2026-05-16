'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

interface UserEvent {
  action: string
  params: Record<string, any>
  timestamp: string
}

interface Session {
  sessionId: string
  deviceId: string
  slug: string
  userAgent: string
  events: UserEvent[]
  lastActivity: string
}

interface StatsData {
  hourly: { visits: { key: string; value: number }[]; purchases: { key: string; value: number }[]; revenue: { key: string; value: number }[] }
  daily: { visits: { key: string; value: number }[]; purchases: { key: string; value: number }[]; revenue: { key: string; value: number }[] }
  totals: { visits: number; purchases: number; revenue: number }
}

function parseUA(ua: string): string {
  if (!ua) return ''
  let device = ''
  if (/iPhone/i.test(ua)) device = 'iPhone'
  else if (/iPad/i.test(ua)) device = 'iPad'
  else if (/Android/i.test(ua)) device = 'Android'
  else if (/Mac/i.test(ua)) device = 'Mac'
  else if (/Windows/i.test(ua)) device = 'Windows'
  else device = 'Other'

  let browser = ''
  if (/KAKAOTALK/i.test(ua)) browser = 'KakaoTalk'
  else if (/NAVER/i.test(ua)) browser = 'Naver'
  else if (/Instagram/i.test(ua)) browser = 'Instagram'
  else if (/CriOS/i.test(ua)) browser = 'Chrome'
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari'
  else if (/Chrome/i.test(ua)) browser = 'Chrome'
  else if (/Firefox/i.test(ua)) browser = 'Firefox'

  return [device, browser].filter(Boolean).join(' · ')
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  page_enter: { label: '페이지 접속', color: 'bg-blue-100 text-blue-800 font-bold' },
  step_view: { label: '페이지 이동', color: 'bg-blue-100 text-blue-700' },
  layout_select: { label: '레이아웃 선택', color: 'bg-purple-100 text-purple-700' },
  color_select: { label: '배경색 선택', color: 'bg-pink-100 text-pink-700' },
  photo_upload: { label: '사진 업로드', color: 'bg-green-100 text-green-700' },
  photo_crop_complete: { label: '크롭 완료', color: 'bg-green-100 text-green-700' },
  crop_open: { label: '크롭 진입', color: 'bg-yellow-100 text-yellow-700' },
  crop_cancel: { label: '크롭 취소', color: 'bg-red-100 text-red-700' },
  all_photos_ready: { label: '사진 완료', color: 'bg-emerald-100 text-emerald-700' },
  preview_ready: { label: '미리보기', color: 'bg-indigo-100 text-indigo-700' },
  payment_start: { label: '결제 시작', color: 'bg-orange-100 text-orange-700' },
  purchase: { label: '결제 완료', color: 'bg-green-100 text-green-800 font-bold' },
  payment_fail: { label: '결제 실패', color: 'bg-red-100 text-red-700' },
  print_request: { label: '프린트 요청', color: 'bg-cyan-100 text-cyan-700' },
  print_success: { label: '프린트 성공', color: 'bg-green-100 text-green-800 font-bold' },
  download: { label: '다운로드', color: 'bg-gray-100 text-gray-700' },
  reset: { label: '초기화', color: 'bg-gray-100 text-gray-500' },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}초 전`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  return `${Math.floor(hr / 24)}일 전`
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function BarChart({ data, maxValue, color, label }: { data: { key: string; value: number }[]; maxValue: number; color: string; label: string }) {
  if (data.length === 0) return <div className="text-xs text-gray-400 py-4 text-center">데이터 없음</div>
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-gray-600 mb-2">{label}</div>
      <div className="flex items-end gap-[2px]" style={{ height: 120 }}>
        {data.map((d) => {
          const h = maxValue > 0 ? (d.value / maxValue) * 100 : 0
          return (
            <div key={d.key} className="flex-1 flex flex-col items-center justify-end h-full group relative">
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-800 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                {d.key.slice(5)}: {d.value.toLocaleString()}
              </div>
              <div className={`w-full rounded-t ${color} min-h-[2px]`} style={{ height: `${Math.max(h, 2)}%` }} />
            </div>
          )
        })}
      </div>
      <div className="flex justify-between text-[10px] text-gray-400">
        <span>{data[0]?.key.slice(5)}</span>
        <span>{data[data.length - 1]?.key.slice(5)}</span>
      </div>
    </div>
  )
}

function DualBarChart({ visits, purchases, label }: { visits: { key: string; value: number }[]; purchases: { key: string; value: number }[]; label: string }) {
  const allKeys = Array.from(new Set([...visits.map(v => v.key), ...purchases.map(p => p.key)])).sort()
  const visitMap = new Map(visits.map(v => [v.key, v.value]))
  const purchaseMap = new Map(purchases.map(p => [p.key, p.value]))
  const merged = allKeys.map(k => ({ key: k, visits: visitMap.get(k) || 0, purchases: purchaseMap.get(k) || 0 }))
  const maxVal = Math.max(...merged.map(m => Math.max(m.visits, m.purchases)), 1)

  if (merged.length === 0) return <div className="text-xs text-gray-400 py-4 text-center">데이터 없음</div>

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[10px] text-gray-500"><span className="w-2 h-2 rounded-sm bg-blue-400 inline-block" /> 접속</span>
          <span className="flex items-center gap-1 text-[10px] text-gray-500"><span className="w-2 h-2 rounded-sm bg-green-500 inline-block" /> 결제</span>
        </div>
      </div>
      <div className="flex items-end gap-[2px]" style={{ height: 120 }}>
        {merged.map((d) => {
          const hV = (d.visits / maxVal) * 100
          const hP = (d.purchases / maxVal) * 100
          return (
            <div key={d.key} className="flex-1 flex items-end justify-center gap-[1px] h-full group relative">
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-800 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                {d.key.slice(5)} | 접속 {d.visits} · 결제 {d.purchases}
              </div>
              <div className="w-1/2 bg-blue-400 rounded-t min-h-[2px]" style={{ height: `${Math.max(hV, 2)}%` }} />
              <div className="w-1/2 bg-green-500 rounded-t min-h-[2px]" style={{ height: `${Math.max(hP, 2)}%` }} />
            </div>
          )
        })}
      </div>
      <div className="flex justify-between text-[10px] text-gray-400">
        <span>{merged[0]?.key.slice(5)}</span>
        <span>{merged[merged.length - 1]?.key.slice(5)}</span>
      </div>
    </div>
  )
}

export default function UserEventsPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-gray-50 flex items-center justify-center text-gray-400">로딩 중...</div>}>
      <UserEventsContent />
    </Suspense>
  )
}

function UserEventsContent() {
  const searchParams = useSearchParams()
  const [sessions, setSessions] = useState<Session[]>([])
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [slugFilter, setSlugFilter] = useState(searchParams.get('slug') || '')
  const [deviceFilter, setDeviceFilter] = useState(searchParams.get('deviceId') || '')
  const [expandedSession, setExpandedSession] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [days, setDays] = useState(7)
  const [excludeSessions, setExcludeSessions] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('pt_exclude_sessions') || ''
    return ''
  })
  const [tab, setTab] = useState<'stats' | 'sessions'>('stats')
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const excludeParam = excludeSessions.split(',').map(s => s.trim()).filter(Boolean).join(',')

  const fetchEvents = async () => {
    try {
      const params = new URLSearchParams()
      if (slugFilter) params.set('slug', slugFilter)
      if (deviceFilter) params.set('deviceId', deviceFilter)
      if (excludeParam) params.set('excludeSessions', excludeParam)
      params.set('limit', '300')
      const res = await fetch(`/api/user-events?${params}`)
      if (res.ok) {
        const data = await res.json()
        setSessions(data)
      }
    } catch {} finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const params = new URLSearchParams({ mode: 'stats', days: String(days) })
      if (slugFilter) params.set('slug', slugFilter)
      if (excludeParam) params.set('excludeSessions', excludeParam)
      const res = await fetch(`/api/user-events?${params}`)
      if (res.ok) setStats(await res.json())
    } catch {}
  }

  useEffect(() => {
    fetchEvents()
    fetchStats()
  }, [slugFilter, deviceFilter, days, excludeParam])

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => { fetchEvents(); fetchStats() }, 5000)
      return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [autoRefresh, slugFilter, deviceFilter, days, excludeParam])

  useEffect(() => {
    localStorage.setItem('pt_exclude_sessions', excludeSessions)
  }, [excludeSessions])

  const activeSessions = sessions.filter(s => {
    const diff = Date.now() - new Date(s.lastActivity).getTime()
    return diff < 10 * 60 * 1000
  })

  const conversionRate = stats && stats.totals.visits > 0
    ? ((stats.totals.purchases / stats.totals.visits) * 100).toFixed(1)
    : '0'

  return (
    <div className="min-h-dvh bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">사용자 이벤트 로그</h1>
            <p className="text-sm text-gray-500 mt-1">
              실시간 접속 <span className="font-bold text-green-600">{activeSessions.length}</span>명
              {' · '}전체 세션 {sessions.length}개
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={e => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              자동 새로고침
            </label>
            <a href="/admin" className="text-sm text-blue-500 hover:text-blue-600">← 어드민</a>
          </div>
        </div>

        {/* Filter */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={slugFilter}
              onChange={e => setSlugFilter(e.target.value)}
              placeholder="이벤트 slug로 필터..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="text"
              value={deviceFilter}
              onChange={e => setDeviceFilter(e.target.value)}
              placeholder="디바이스 ID..."
              className="w-48 px-4 py-2 border border-gray-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {(slugFilter || deviceFilter) && (
              <button onClick={() => { setSlugFilter(''); setDeviceFilter('') }} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700">
                초기화
              </button>
            )}
          </div>
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={excludeSessions}
              onChange={e => setExcludeSessions(e.target.value)}
              placeholder="제외할 세션 ID (쉼표 구분)..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <select
              value={days}
              onChange={e => setDays(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-xl text-sm bg-white"
            >
              <option value={1}>1일</option>
              <option value={3}>3일</option>
              <option value={7}>7일</option>
              <option value={14}>14일</option>
              <option value={30}>30일</option>
            </select>
          </div>
        </div>

        {/* Tab */}
        <div className="flex gap-1 bg-gray-200 rounded-xl p-1">
          <button
            onClick={() => setTab('stats')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'stats' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
          >
            통계
          </button>
          <button
            onClick={() => setTab('sessions')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'sessions' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
          >
            세션 목록
          </button>
        </div>

        {tab === 'stats' && stats && (
          <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="text-xs text-gray-500">접속</div>
                <div className="text-2xl font-bold text-blue-600 mt-1">{stats.totals.visits.toLocaleString()}</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="text-xs text-gray-500">결제</div>
                <div className="text-2xl font-bold text-green-600 mt-1">{stats.totals.purchases.toLocaleString()}</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="text-xs text-gray-500">매출</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">₩{stats.totals.revenue.toLocaleString()}</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="text-xs text-gray-500">전환율</div>
                <div className="text-2xl font-bold text-orange-600 mt-1">{conversionRate}%</div>
              </div>
            </div>

            {/* Daily chart */}
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <DualBarChart visits={stats.daily.visits} purchases={stats.daily.purchases} label="일별 접속 vs 결제" />
            </div>

            {/* Daily revenue */}
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <BarChart data={stats.daily.revenue} maxValue={Math.max(...stats.daily.revenue.map(d => d.value), 1)} color="bg-orange-400" label="일별 매출 (₩)" />
            </div>

            {/* Hourly chart */}
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <DualBarChart visits={stats.hourly.visits} purchases={stats.hourly.purchases} label="시간별 접속 vs 결제" />
            </div>

            {/* Hourly revenue */}
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <BarChart data={stats.hourly.revenue} maxValue={Math.max(...stats.hourly.revenue.map(d => d.value), 1)} color="bg-orange-400" label="시간별 매출 (₩)" />
            </div>
          </div>
        )}

        {tab === 'sessions' && (
          <>
            {loading ? (
              <div className="text-center py-12 text-gray-400">로딩 중...</div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-12 text-gray-400">이벤트 데이터가 없습니다</div>
            ) : (
              <div className="space-y-3">
                {sessions.map(session => {
                  const isActive = Date.now() - new Date(session.lastActivity).getTime() < 10 * 60 * 1000
                  const isExpanded = expandedSession === session.sessionId
                  const lastEvent = session.events[0]
                  const lastAction = lastEvent ? (ACTION_LABELS[lastEvent.action]?.label || lastEvent.action) : ''

                  return (
                    <div
                      key={session.sessionId}
                      className={`bg-white rounded-xl border ${isActive ? 'border-green-200' : 'border-gray-100'} overflow-hidden`}
                    >
                      {/* Session header */}
                      <button
                        onClick={() => setExpandedSession(isExpanded ? null : session.sessionId)}
                        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors"
                      >
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900 truncate">/{session.slug}</span>
                            <span className="text-xs text-gray-400 font-mono">{session.deviceId.slice(0, 8)}</span>
                            {session.userAgent && (
                              <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{parseUA(session.userAgent)}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-500">{lastAction}</span>
                            <span className="text-xs text-gray-400">· {timeAgo(session.lastActivity)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            {session.events.length}건
                          </span>
                          <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {/* Event timeline */}
                      {isExpanded && (
                        <div className="border-t border-gray-100 px-4 py-3 space-y-1.5 max-h-80 overflow-y-auto">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] text-gray-400 font-mono">세션: {session.sessionId.slice(0, 12)}...</span>
                            <span className="text-[10px] text-gray-400 font-mono">디바이스: {session.deviceId.slice(0, 12)}...</span>
                          </div>
                          {session.events.map((ev, i) => {
                            const info = ACTION_LABELS[ev.action] || { label: ev.action, color: 'bg-gray-100 text-gray-600' }
                            const paramStr = Object.entries(ev.params || {})
                              .filter(([k]) => k !== 'event_slug' && k !== 'device_id' && k !== 'session_id')
                              .map(([k, v]) => `${k}=${v}`)
                              .join(', ')

                            return (
                              <div key={i} className="flex items-center gap-2">
                                <span className="text-[11px] text-gray-400 font-mono w-16 shrink-0">{formatTime(ev.timestamp)}</span>
                                <span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${info.color}`}>
                                  {info.label}
                                </span>
                                {paramStr && (
                                  <span className="text-[11px] text-gray-400 truncate">{paramStr}</span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
