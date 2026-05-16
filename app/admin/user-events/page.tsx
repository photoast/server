'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import html2canvas from 'html2canvas'

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

interface BucketEntry { key: string; value: number }

interface StatsData {
  buckets: { sessions: BucketEntry[]; photoSlots: BucketEntry[]; purchases: BucketEntry[]; downloads: BucketEntry[]; revenue: BucketEntry[] }
  totals: { sessions: number; photoSlots: number; purchases: number; downloads: number; revenue: number }
  granularity: number
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

const CHART_W = 600
const CHART_H = 160
const PAD = { top: 20, right: 12, bottom: 28, left: 44 }

function LineChart({ lines, label }: {
  lines: { data: BucketEntry[]; color: string; name: string }[]
  label: string
}) {
  const allKeys = Array.from(new Set(lines.flatMap(l => l.data.map(d => d.key)))).sort()
  if (allKeys.length === 0) return <div className="text-xs text-gray-400 py-4 text-center">데이터 없음</div>

  const maps = lines.map(l => new Map(l.data.map(d => [d.key, d.value])))
  const maxVal = Math.max(...maps.flatMap(m => Array.from(m.values())), 1)

  const w = CHART_W - PAD.left - PAD.right
  const h = CHART_H - PAD.top - PAD.bottom
  const xStep = allKeys.length > 1 ? w / (allKeys.length - 1) : 0

  const toPath = (m: Map<string, number>) => {
    const pts = allKeys.map((k, i) => {
      const x = PAD.left + i * xStep
      const y = PAD.top + h - ((m.get(k) || 0) / maxVal) * h
      return `${i === 0 ? 'M' : 'L'}${x},${y}`
    })
    return pts.join(' ')
  }

  const toArea = (m: Map<string, number>) => {
    const pts = allKeys.map((k, i) => {
      const x = PAD.left + i * xStep
      const y = PAD.top + h - ((m.get(k) || 0) / maxVal) * h
      return { x, y }
    })
    const baseline = PAD.top + h
    return `M${pts[0].x},${baseline} ${pts.map(p => `L${p.x},${p.y}`).join(' ')} L${pts[pts.length - 1].x},${baseline} Z`
  }

  const yTicks = [0, Math.round(maxVal / 2), maxVal]
  const labelInterval = Math.max(1, Math.floor(allKeys.length / 6))

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        <div className="flex items-center gap-3">
          {lines.map(l => (
            <span key={l.name} className="flex items-center gap-1 text-[10px] text-gray-500">
              <span className="w-3 h-[2px] inline-block rounded" style={{ background: l.color }} />
              {l.name}
            </span>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {yTicks.map(t => {
          const y = PAD.top + h - (t / maxVal) * h
          return (
            <g key={t}>
              <line x1={PAD.left} x2={CHART_W - PAD.right} y1={y} y2={y} stroke="#e5e7eb" strokeWidth={0.5} />
              <text x={PAD.left - 6} y={y + 3} textAnchor="end" className="fill-gray-400" style={{ fontSize: 9 }}>
                {t.toLocaleString()}
              </text>
            </g>
          )
        })}
        {allKeys.map((k, i) => {
          if (i % labelInterval !== 0 && i !== allKeys.length - 1) return null
          const x = PAD.left + i * xStep
          const displayKey = k.length > 10 ? k.slice(5) : k
          return (
            <text key={k} x={x} y={CHART_H - 4} textAnchor="middle" className="fill-gray-400" style={{ fontSize: 8 }}>
              {displayKey}
            </text>
          )
        })}
        {maps.map((m, idx) => (
          <g key={idx}>
            <path d={toArea(m)} fill={lines[idx].color} opacity={0.08} />
            <path d={toPath(m)} fill="none" stroke={lines[idx].color} strokeWidth={1.5} strokeLinejoin="round" />
          </g>
        ))}
        {allKeys.map((k, i) => {
          const x = PAD.left + i * xStep
          return (
            <g key={k}>
              {maps.map((m, idx) => {
                const val = m.get(k) || 0
                if (val === 0) return null
                const y = PAD.top + h - (val / maxVal) * h
                return <circle key={idx} cx={x} cy={y} r={2} fill={lines[idx].color} />
              })}
              <rect x={x - (xStep || 10) / 2} y={PAD.top} width={xStep || 10} height={h} fill="transparent" className="cursor-crosshair">
                <title>{k.slice(5)}{'\n'}{lines.map(l => `${l.name}: ${maps[lines.indexOf(l)].get(k)?.toLocaleString() || 0}`).join('\n')}</title>
              </rect>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

const GRANULARITY_OPTIONS = [
  { value: 1, label: '1분' },
  { value: 5, label: '5분' },
  { value: 10, label: '10분' },
  { value: 15, label: '15분' },
  { value: 30, label: '30분' },
  { value: 60, label: '1시간' },
  { value: 180, label: '3시간' },
  { value: 1440, label: '1일' },
]

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
  const [slugNames, setSlugNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [slugFilter, setSlugFilter] = useState(searchParams.get('slug') || '')
  const [deviceFilter, setDeviceFilter] = useState(searchParams.get('deviceId') || '')
  const [expandedSession, setExpandedSession] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [days, setDays] = useState(7)
  const [granularity, setGranularity] = useState(60)
  const [excludeSessions, _setExcludeSessions] = useState<string | null>(null)
  const [excludeDevices, _setExcludeDevices] = useState<string | null>(null)
  const excludeReady = excludeSessions !== null && excludeDevices !== null
  const setExcludeSessions = useCallback((v: string) => { _setExcludeSessions(v); localStorage.setItem('pt_exclude_sessions', v) }, [])
  const setExcludeDevices = useCallback((v: string) => { _setExcludeDevices(v); localStorage.setItem('pt_exclude_devices', v) }, [])
  const [showExclude, setShowExclude] = useState(false)
  const [tab, setTab] = useState<'stats' | 'sessions'>('stats')
  const [page, setPage] = useState(0)
  const perPage = 30
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const captureAsPng = useCallback(async () => {
    if (!contentRef.current) return
    const canvas = await html2canvas(contentRef.current, { backgroundColor: '#f9fafb', scale: 2 })
    const link = document.createElement('a')
    link.download = `user-stats-${new Date().toISOString().slice(0, 10)}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }, [])

  const excludeParam = (excludeSessions || '').split(',').map(s => s.trim()).filter(Boolean).join(',')
  const excludeDeviceParam = (excludeDevices || '').split(',').map(s => s.trim()).filter(Boolean).join(',')

  const fetchEvents = async () => {
    try {
      const params = new URLSearchParams()
      if (slugFilter) params.set('slug', slugFilter)
      if (deviceFilter) params.set('deviceId', deviceFilter)
      params.set('limit', '5000')
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
      const params = new URLSearchParams({ mode: 'stats', days: String(days), granularity: String(granularity) })
      if (slugFilter) params.set('slug', slugFilter)
      if (excludeParam) params.set('excludeSessions', excludeParam)
      if (excludeDeviceParam) params.set('excludeDevices', excludeDeviceParam)
      const res = await fetch(`/api/user-events?${params}`)
      if (res.ok) setStats(await res.json())
    } catch {}
  }

  useEffect(() => {
    fetch('/api/events').then(r => r.ok ? r.json() : []).then((events: { slug: string; name: string }[]) => {
      const map: Record<string, string> = {}
      for (const e of events) map[e.slug] = e.name
      setSlugNames(map)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    _setExcludeSessions(localStorage.getItem('pt_exclude_sessions') || '')
    _setExcludeDevices(localStorage.getItem('pt_exclude_devices') || '')
  }, [])

  useEffect(() => {
    if (!excludeReady) return
    fetchEvents()
    fetchStats()
  }, [excludeReady, slugFilter, deviceFilter, days, granularity, excludeParam, excludeDeviceParam])

  useEffect(() => {
    if (!excludeReady) return
    if (autoRefresh) {
      intervalRef.current = setInterval(() => { fetchEvents(); fetchStats() }, 5000)
      return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [excludeReady, autoRefresh, slugFilter, deviceFilter, days, granularity, excludeParam, excludeDeviceParam])


  const activeSessions = sessions.filter(s => {
    const diff = Date.now() - new Date(s.lastActivity).getTime()
    return diff < 10 * 60 * 1000
  })

  const conversionRate = stats && stats.totals.sessions > 0
    ? ((stats.totals.purchases / stats.totals.sessions) * 100).toFixed(1)
    : '0'

  return (
    <div className="min-h-dvh bg-gray-50 p-6">
      <div ref={contentRef} className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">사용자 통계</h1>
            {slugFilter && (
              <p className="text-sm text-gray-700 mt-0.5 font-medium">
                {slugNames[slugFilter] ? `${slugNames[slugFilter]}(${slugFilter})` : slugFilter}
              </p>
            )}
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
            <button onClick={captureAsPng} className="text-sm text-gray-500 hover:text-gray-700">PNG</button>
            <button onClick={() => window.print()} className="text-sm text-gray-500 hover:text-gray-700">PDF</button>
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
            {(() => {
              const sessionCount = excludeParam ? excludeParam.split(',').length : 0
              const deviceCount = excludeDeviceParam ? excludeDeviceParam.split(',').length : 0
              const total = sessionCount + deviceCount
              return (
                <button
                  onClick={() => setShowExclude(v => !v)}
                  className={`flex-1 px-4 py-2 border border-gray-300 rounded-xl text-sm text-left hover:bg-gray-50 truncate ${total > 0 ? 'text-gray-500' : 'text-gray-400'}`}
                >
                  {showExclude ? '제외 목록 숨기기 ▲' : total > 0 ? `제외 ${total}건 (세션 ${sessionCount} · 디바이스 ${deviceCount}) ▼` : '제외 설정 ▼'}
                </button>
              )
            })()}
            <select
              value={granularity}
              onChange={e => setGranularity(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-xl text-sm bg-white"
            >
              {GRANULARITY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <select
              value={days}
              onChange={e => setDays(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-xl text-sm bg-white"
            >
              <option value={1}>1일</option>
              <option value={3}>3일</option>
              <option value={7}>7일</option>
              <option value={14}>14일</option>
              <option value={15}>15일</option>
              <option value={30}>30일</option>
            </select>
          </div>
          {showExclude && (
            <div className="space-y-2">
              <input
                type="text"
                value={excludeSessions || ''}
                onChange={e => setExcludeSessions(e.target.value)}
                placeholder="제외할 세션 ID (쉼표 구분)..."
                className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="text"
                value={excludeDevices || ''}
                onChange={e => setExcludeDevices(e.target.value)}
                placeholder="제외할 디바이스 ID (쉼표 구분)..."
                className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}
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
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="text-xs text-gray-500">세션</div>
                <div className="text-2xl font-bold text-blue-600 mt-1">{stats.totals.sessions.toLocaleString()}</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="text-xs text-gray-500">포토슬롯</div>
                <div className="text-2xl font-bold text-purple-600 mt-1">{stats.totals.photoSlots.toLocaleString()}</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="text-xs text-gray-500">결제</div>
                <div className="text-2xl font-bold text-green-600 mt-1">{stats.totals.purchases.toLocaleString()}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="text-xs text-gray-500">다운로드</div>
                <div className="text-2xl font-bold text-cyan-600 mt-1">{stats.totals.downloads.toLocaleString()}</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="text-xs text-gray-500">매출</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">₩{stats.totals.revenue.toLocaleString()}</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="text-xs text-gray-500">결제 전환율</div>
                <div className="text-2xl font-bold text-orange-600 mt-1">{conversionRate}%</div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <LineChart
                label="세션 → 포토슬롯 → 결제 → 다운로드"
                lines={[
                  { data: stats.buckets.sessions, color: '#60a5fa', name: '세션' },
                  { data: stats.buckets.photoSlots, color: '#a855f7', name: '포토슬롯' },
                  { data: stats.buckets.purchases, color: '#22c55e', name: '결제' },
                  { data: stats.buckets.downloads, color: '#06b6d4', name: '다운로드' },
                ]}
              />
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <LineChart
                label="누적 매출 (₩)"
                lines={[
                  { data: stats.buckets.revenue.reduce<BucketEntry[]>((acc, d) => {
                    const prev = acc.length > 0 ? acc[acc.length - 1].value : 0
                    acc.push({ key: d.key, value: prev + d.value })
                    return acc
                  }, []), color: '#fb923c', name: '매출' },
                ]}
              />
            </div>
          </div>
        )}

        {tab === 'sessions' && (() => {
          const totalPages = Math.ceil(sessions.length / perPage)
          const paged = sessions.slice(page * perPage, (page + 1) * perPage)
          return (
            <>
              {loading ? (
                <div className="text-center py-12 text-gray-400">로딩 중...</div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-12 text-gray-400">이벤트 데이터가 없습니다</div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>전체 {sessions.length}개 세션</span>
                    <span>{page + 1} / {totalPages} 페이지</span>
                  </div>
                  <div className="space-y-3">
                    {paged.map(session => {
                      const isActive = Date.now() - new Date(session.lastActivity).getTime() < 10 * 60 * 1000
                      const isExpanded = expandedSession === session.sessionId
                      const purchaseEvent = session.events.find(e => e.action === 'purchase')
                      const purchaseAmount = purchaseEvent?.params?.value || 0
                      const sessionExcludeList = (excludeSessions || '').split(',').map(s => s.trim()).filter(Boolean)
                      const deviceExcludeList = (excludeDevices || '').split(',').map(s => s.trim()).filter(Boolean)
                      const isSessionExcluded = sessionExcludeList.includes(session.sessionId)
                      const isDeviceExcluded = deviceExcludeList.includes(session.deviceId)
                      const isExcluded = isSessionExcluded || isDeviceExcluded

                      const toggleExcludeSession = (e: React.MouseEvent) => {
                        e.stopPropagation()
                        if (isSessionExcluded) {
                          setExcludeSessions(sessionExcludeList.filter(s => s !== session.sessionId).join(','))
                        } else {
                          setExcludeSessions([...sessionExcludeList, session.sessionId].join(','))
                        }
                      }
                      const toggleExcludeDevice = (e: React.MouseEvent) => {
                        e.stopPropagation()
                        if (isDeviceExcluded) {
                          setExcludeDevices(deviceExcludeList.filter(s => s !== session.deviceId).join(','))
                        } else {
                          setExcludeDevices([...deviceExcludeList, session.deviceId].join(','))
                        }
                      }

                      return (
                        <div
                          key={session.sessionId}
                          className={`bg-white rounded-xl border ${isExcluded ? 'border-red-200' : isActive ? 'border-green-200' : 'border-gray-100'} overflow-hidden`}
                        >
                          <button
                            onClick={() => setExpandedSession(isExpanded ? null : session.sessionId)}
                            className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors"
                          >
                            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isExcluded ? 'bg-red-300' : isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                            <div className={`flex-1 min-w-0 ${isExcluded ? 'opacity-40 blur-[1px]' : ''}`}>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-gray-900 truncate">{slugNames[session.slug] ? `${slugNames[session.slug]}(${session.slug})` : `/${session.slug}`}</span>
                                <span className="text-xs text-gray-400 font-mono">{session.deviceId.slice(0, 8)}</span>
                                {purchaseEvent && (
                                  <span className="text-[10px] bg-green-100 text-green-800 font-bold px-1.5 py-0.5 rounded">결제 ₩{purchaseAmount.toLocaleString()}</span>
                                )}
                                {session.userAgent && (
                                  <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{parseUA(session.userAgent)}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-gray-700 font-medium">{new Date(session.firstActivity).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                {session.firstActivity !== session.lastActivity && (
                                  <span className="text-[10px] text-gray-400">→ 마지막 {timeAgo(session.lastActivity)}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {isExcluded && (
                                <span className="text-[10px] text-red-500 font-medium">
                                  {isSessionExcluded && isDeviceExcluded ? '세션+디바이스 제외' : isDeviceExcluded ? '디바이스 제외' : '세션 제외'}
                                </span>
                              )}
                              <span
                                onClick={toggleExcludeSession}
                                className={`text-[10px] px-2 py-0.5 rounded-full cursor-pointer transition-colors ${isSessionExcluded ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500'}`}
                              >
                                {isSessionExcluded ? '세션해제' : '세션제외'}
                              </span>
                              <span
                                onClick={toggleExcludeDevice}
                                className={`text-[10px] px-2 py-0.5 rounded-full cursor-pointer transition-colors ${isDeviceExcluded ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500'}`}
                              >
                                {isDeviceExcluded ? '디바이스해제' : '디바이스제외'}
                              </span>
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                {session.events.length}건
                              </span>
                              <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </button>

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
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-2">
                      <button
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 disabled:opacity-30 hover:bg-gray-100"
                      >
                        ← 이전
                      </button>
                      <span className="text-sm text-gray-500">{page + 1} / {totalPages}</span>
                      <button
                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={page >= totalPages - 1}
                        className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 disabled:opacity-30 hover:bg-gray-100"
                      >
                        다음 →
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )
        })()}
      </div>
    </div>
  )
}
