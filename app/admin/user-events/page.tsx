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
  const [loading, setLoading] = useState(true)
  const [slugFilter, setSlugFilter] = useState(searchParams.get('slug') || '')
  const [deviceFilter, setDeviceFilter] = useState(searchParams.get('deviceId') || '')
  const [expandedSession, setExpandedSession] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchEvents = async () => {
    try {
      const params = new URLSearchParams()
      if (slugFilter) params.set('slug', slugFilter)
      if (deviceFilter) params.set('deviceId', deviceFilter)
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

  useEffect(() => {
    fetchEvents()
  }, [slugFilter, deviceFilter])

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchEvents, 5000)
      return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [autoRefresh, slugFilter, deviceFilter])

  const activeSessions = sessions.filter(s => {
    const diff = Date.now() - new Date(s.lastActivity).getTime()
    return diff < 10 * 60 * 1000
  })

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
      </div>
    </div>
  )
}
