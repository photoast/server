'use client'

import { useState, useEffect, Suspense } from 'react'
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
  firstActivity: string
  lastActivity: string
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
  page_exit: { label: '페이지 이탈', color: 'bg-gray-100 text-gray-500' },
  camera_open: { label: '카메라 열기', color: 'bg-teal-100 text-teal-700' },
  camera_capture: { label: '카메라 촬영', color: 'bg-teal-100 text-teal-700' },
  locale_change: { label: '언어 변경', color: 'bg-gray-100 text-gray-600' },
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

export default function DeviceLogPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-gray-50 flex items-center justify-center text-gray-400">로딩 중...</div>}>
      <DeviceLogContent />
    </Suspense>
  )
}

function DeviceLogContent() {
  const searchParams = useSearchParams()
  const deviceId = searchParams.get('id') || ''
  const [sessions, setSessions] = useState<Session[]>([])
  const [slugNames, setSlugNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/events').then(r => r.ok ? r.json() : []).then((events: { slug: string; name: string }[]) => {
      const map: Record<string, string> = {}
      for (const e of events) map[e.slug] = e.name
      setSlugNames(map)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!deviceId) return
    fetch(`/api/user-events?deviceId=${deviceId}&limit=10000`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setSessions(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [deviceId])

  if (!deviceId) {
    return <div className="min-h-dvh bg-gray-50 flex items-center justify-center text-gray-400">디바이스 ID가 필요합니다</div>
  }

  const ua = sessions[0]?.userAgent || ''
  const totalEvents = sessions.reduce((sum, s) => sum + s.events.length, 0)
  const hasPurchase = sessions.some(s => s.events.some(e => e.action === 'purchase'))
  const totalRevenue = sessions.reduce((sum, s) => sum + s.events.filter(e => e.action === 'purchase').reduce((a, e) => a + (e.params?.value || 0), 0), 0)

  return (
    <div className="min-h-dvh bg-gray-50 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">디바이스 로그</h1>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{deviceId}</p>
          </div>
          <a href="/admin/user-events" className="text-sm text-blue-500 hover:text-blue-600">← 전체 통계</a>
        </div>

        {/* Device info */}
        {!loading && sessions.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg">{parseUA(ua) || '알 수 없음'}</span>
              <span className="bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg">{sessions.length}개 세션</span>
              <span className="bg-gray-50 text-gray-600 px-2.5 py-1 rounded-lg">{totalEvents}건 이벤트</span>
              {hasPurchase && (
                <span className="bg-green-50 text-green-700 px-2.5 py-1 rounded-lg font-bold">결제 ₩{totalRevenue.toLocaleString()}</span>
              )}
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-400">로딩 중...</div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12 text-gray-400">이벤트 데이터가 없습니다</div>
        ) : (
          <div className="space-y-4">
            {sessions.map(session => {
              const isActive = (() => {
                const lastEvent = session.events[0]
                if (lastEvent?.action === 'page_exit') return false
                return Date.now() - new Date(session.lastActivity).getTime() < 3 * 60 * 1000
              })()
              const slugLabel = slugNames[session.slug] ? `${slugNames[session.slug]}` : `/${session.slug}`
              const purchaseEvent = session.events.find(e => e.action === 'purchase')

              return (
                <div key={session.sessionId} className={`bg-white rounded-xl border ${isActive ? 'border-green-200' : 'border-gray-100'} overflow-hidden`}>
                  {/* Session header */}
                  <div className="px-4 py-3 border-b border-gray-50">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                      <span className="text-sm font-semibold text-gray-900">{slugLabel}</span>
                      {purchaseEvent && (
                        <span className="text-[10px] bg-green-100 text-green-800 font-bold px-1.5 py-0.5 rounded">결제 ₩{(purchaseEvent.params?.value || 0).toLocaleString()}</span>
                      )}
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full ml-auto">{session.events.length}건</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
                      <span className="font-mono">세션: {session.sessionId.slice(0, 12)}...</span>
                      <span>·</span>
                      <span>{new Date(session.firstActivity).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      {session.firstActivity !== session.lastActivity && (
                        <>
                          <span>→</span>
                          <span>{new Date(session.lastActivity).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Events timeline */}
                  <div className="px-4 py-2 space-y-1">
                    {session.events.map((ev, i) => {
                      const info = ACTION_LABELS[ev.action] || { label: ev.action, color: 'bg-gray-100 text-gray-600' }
                      const paramStr = Object.entries(ev.params || {})
                        .filter(([k]) => k !== 'event_slug' && k !== 'device_id' && k !== 'session_id')
                        .map(([k, v]) => `${k}=${v}`)
                        .join(', ')

                      return (
                        <div key={i} className="flex items-center gap-2 py-0.5">
                          <span className="text-[11px] text-gray-400 font-mono w-16 shrink-0">
                            {new Date(ev.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
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
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
