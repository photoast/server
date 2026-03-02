'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import QRCode from 'qrcode'
import { logClientError } from '@/lib/errorLogger'
import { UIButton, UICard, UIFormField, UITextInput, UIStatusBanner, UIBadge, UISectionHeading } from '@/app/components/ui'

type PrintMethod = 'email' | 'polling'

interface Event {
  _id: string
  name: string
  slug: string
  printMethod: PrintMethod
  availableLayouts?: string[]
  puzzleEnabled?: boolean
  price?: number
  backgroundColors?: string[]
  borderCorrectionEnabled?: boolean
  shrinkPercent?: number
  verticalOffsetPx?: number
  createdAt: string
}

interface DeviceInfo {
  userAgent: string
  deviceId?: string
  ipAddress?: string
  deviceType?: string
  os?: string
  browser?: string
  screenResolution?: string
  timezone?: string
}

interface PrintJob {
  _id: string
  eventId: string
  imageUrl: string
  printedImageUrl?: string
  createdAt: string
  status: 'DONE' | 'FAILED'
  deviceInfo?: DeviceInfo
  errorMessage?: string
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Create event form
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newEventName, setNewEventName] = useState('')
  const [newEventPrintMethod, setNewEventPrintMethod] = useState<PrintMethod>('email')
  // Detail view
  const [detailEvent, setDetailEvent] = useState<Event | null>(null)

  // QR modal
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const [promotionalImageUrl, setPromotionalImageUrl] = useState<string | null>(null)
  const [generatingPromo, setGeneratingPromo] = useState(false)

  // Print history
  const [showPrintHistory, setShowPrintHistory] = useState(false)
  const [printJobs, setPrintJobs] = useState<PrintJob[]>([])
  const [selectedEventForHistory, setSelectedEventForHistory] = useState<Event | null>(null)
  const [selectedImageForPreview, setSelectedImageForPreview] = useState<string | null>(null)

  // Event editing states
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<'name' | null>(null)
  const [tempValue, setTempValue] = useState('')

  // Sticker management
  const [stickers, setStickers] = useState<{ _id: string; url: string; filename: string }[]>([])
  const [stickerUploading, setStickerUploading] = useState(false)

  // Event layouts (SwitLayout-based)
  const [eventLayouts, setEventLayouts] = useState<Record<string, { _id: string; name: string; printSize: string; slots: any[]; isPreset?: boolean; order?: number }[]>>({})

  useEffect(() => {
    checkAuth()
  }, [])

  // Keep detailEvent in sync with events list
  useEffect(() => {
    if (detailEvent) {
      const updated = events.find(e => e._id === detailEvent._id)
      if (updated) setDetailEvent(updated)
    }
  }, [events])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/events')
      if (res.ok) {
        setAuthenticated(true)
        fetchEvents()
        fetchStickers()
      }
    } catch (err) {
      // Not authenticated
    }
  }

  const fetchStickers = async () => {
    try {
      const res = await fetch('/api/stickers')
      if (res.ok) setStickers(await res.json())
    } catch (err) {}
  }

  const handleUploadSticker = async (file: File) => {
    setStickerUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/stickers', { method: 'POST', body: formData })
      if (res.ok) {
        const sticker = await res.json()
        setStickers(prev => [sticker, ...prev])
      }
    } catch (err) {
      console.error('Failed to upload sticker:', err)
    } finally {
      setStickerUploading(false)
    }
  }

  const handleDeleteSticker = async (id: string) => {
    try {
      const res = await fetch(`/api/stickers/${id}`, { method: 'DELETE' })
      if (res.ok) setStickers(prev => prev.filter(s => s._id !== id))
    } catch (err) {
      console.error('Failed to delete sticker:', err)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      if (!res.ok) {
        throw new Error('Invalid credentials')
      }

      setAuthenticated(true)
      fetchEvents()
    } catch (err: any) {
      const errorMessage = err.message || 'Invalid credentials'
      setError(errorMessage)
      logClientError('Login failed', err, undefined, { username })
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setAuthenticated(false)
    setEvents([])
    setUsername('')
    setPassword('')
  }

  const fetchEvents = async () => {
    try {
      const res = await fetch('/api/events')
      if (!res.ok) throw new Error('Failed to fetch events')
      const data = await res.json()
      setEvents(data)

      // Fetch layouts for each event
      for (const ev of data) {
        fetchEventLayouts(ev._id)
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch events'
      setError(errorMessage)
      logClientError('Failed to fetch events', err)
    }
  }

  const fetchEventLayouts = async (eventId: string) => {
    try {
      const res = await fetch(`/api/swit-layouts?eventId=${eventId}`)
      if (res.ok) {
        const layouts = await res.json()
        setEventLayouts(prev => ({ ...prev, [eventId]: Array.isArray(layouts) ? layouts : [] }))
      }
    } catch {}
  }

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newEventName,
          printMethod: newEventPrintMethod,
        }),
      })

      if (!res.ok) throw new Error('Failed to create event')

      setNewEventName('')
      setNewEventPrintMethod('email')
      setShowCreateForm(false)
      fetchEvents()
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to create event'
      setError(errorMessage)
      logClientError('Failed to create event', err, undefined, {
        eventName: newEventName,
        printMethod: newEventPrintMethod,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateEvent = async (eventId: string, updates: { name?: string; printMethod?: PrintMethod; availableLayouts?: string[]; price?: number; puzzleEnabled?: boolean; backgroundColors?: string[]; borderCorrectionEnabled?: boolean; shrinkPercent?: number; verticalOffsetPx?: number }) => {
    try {
      const updateRes = await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!updateRes.ok) throw new Error('Failed to update event')

      fetchEvents()
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update event'
      setError(errorMessage)
      logClientError('Failed to update event', err, undefined, {
        eventId,
        updates,
      })
    }
  }

  const generateQR = async (event: Event) => {
    const url = `${window.location.origin}/${event.slug}`
    const qr = await QRCode.toDataURL(url, { width: 600, margin: 2 })
    setQrCodeUrl(qr)
    setSelectedEvent(event)

    // Generate 4x6 promotional image (1200x1800px)
    await generate4x6PromotionalImage(qr, event)
  }

  const generate4x6PromotionalImage = async (qrDataUrl: string, event: Event) => {
    setGeneratingPromo(true)

    try {
      const W = 1200, H = 1800
      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Failed to get canvas context')

      // Load QR code image
      const qrImage = document.createElement('img')
      await new Promise((resolve, reject) => {
        qrImage.onload = () => resolve(true)
        qrImage.onerror = (e) => reject(e)
        qrImage.src = qrDataUrl
      })

      // Helper: rounded rect path
      const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
        ctx.beginPath()
        ctx.moveTo(x + r, y)
        ctx.lineTo(x + w - r, y)
        ctx.quadraticCurveTo(x + w, y, x + w, y + r)
        ctx.lineTo(x + w, y + h - r)
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
        ctx.lineTo(x + r, y + h)
        ctx.quadraticCurveTo(x, y + h, x, y + h - r)
        ctx.lineTo(x, y + r)
        ctx.quadraticCurveTo(x, y, x + r, y)
        ctx.closePath()
      }

      // ── Background: clean white
      ctx.fillStyle = '#FAFAFA'
      ctx.fillRect(0, 0, W, H)

      // ── Top area: event name (large, bold, centered)
      const topY = 200
      ctx.fillStyle = '#191F28'
      ctx.font = 'bold 72px -apple-system, "Helvetica Neue", Arial, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(event.name, W / 2, topY)

      // Subtitle
      ctx.fillStyle = '#8B95A1'
      ctx.font = '36px -apple-system, "Helvetica Neue", Arial, sans-serif'
      ctx.fillText('무료 즉석 포토 프린트', W / 2, topY + 70)

      // ── Divider line
      ctx.strokeStyle = '#E5E8EB'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(200, topY + 140)
      ctx.lineTo(W - 200, topY + 140)
      ctx.stroke()

      // ── QR code area (centered, generous size)
      const qrSize = 560
      const qrX = (W - qrSize) / 2
      const qrY = topY + 200

      // Subtle card behind QR
      ctx.save()
      ctx.shadowColor = 'rgba(0, 0, 0, 0.06)'
      ctx.shadowBlur = 40
      ctx.shadowOffsetY = 8
      const cardPad = 50
      roundRect(qrX - cardPad, qrY - cardPad, qrSize + cardPad * 2, qrSize + cardPad * 2, 24)
      ctx.fillStyle = '#FFFFFF'
      ctx.fill()
      ctx.restore()

      // QR code
      ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize)

      // "QR 스캔" label below QR
      const belowQrY = qrY + qrSize + cardPad + 50
      ctx.fillStyle = '#4E5968'
      ctx.font = 'bold 32px -apple-system, "Helvetica Neue", Arial, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('QR 코드를 스캔하세요', W / 2, belowQrY)

      // ── Steps: minimal numbered list
      const stepsStartY = belowQrY + 80
      const steps = [
        'QR 코드 스캔 또는 링크 접속',
        '레이아웃 선택 후 사진 추가',
        '완성 후 프린트 버튼 클릭',
      ]
      const stepGap = 64

      steps.forEach((text, i) => {
        const y = stepsStartY + i * stepGap

        // Number circle
        const circleR = 20
        const circleX = 180
        roundRect(circleX - circleR, y - circleR, circleR * 2, circleR * 2, circleR)
        ctx.fillStyle = '#191F28'
        ctx.fill()

        ctx.fillStyle = '#FFFFFF'
        ctx.font = 'bold 24px -apple-system, "Helvetica Neue", Arial, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(i + 1), circleX, y)

        // Step text
        ctx.fillStyle = '#4E5968'
        ctx.font = '32px -apple-system, "Helvetica Neue", Arial, sans-serif'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(text, circleX + 40, y)
      })

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b)
          else reject(new Error('Failed to create blob'))
        }, 'image/jpeg', 0.95)
      })

      const url = URL.createObjectURL(blob)
      setPromotionalImageUrl(url)
    } catch (err: any) {
      alert(`홍보 이미지 생성 실패: ${err.message}`)
      logClientError('Failed to generate promotional image', err, undefined, {
        eventId: event._id,
        eventName: event.name
      })
    } finally {
      setGeneratingPromo(false)
    }
  }

  const downloadPromotionalImage = () => {
    if (!promotionalImageUrl || !selectedEvent) return
    const link = document.createElement('a')
    link.href = promotionalImageUrl
    link.download = `${selectedEvent.slug}-promotional-4x6.jpg`
    link.click()
  }

  const printPromotionalImage = async () => {
    if (!promotionalImageUrl || !selectedEvent) return

    try {
      setLoading(true)
      const response = await fetch(promotionalImageUrl)
      const blob = await response.blob()
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })

      const printRes = await fetch('/api/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: selectedEvent.slug, imageUrl: dataUrl }),
      })

      if (!printRes.ok) {
        const errorData = await printRes.json()
        throw new Error(errorData.error || 'Print failed')
      }

      alert('프린터로 전송되었습니다!')
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to print'
      alert(`인쇄 실패: ${errorMessage}`)
      logClientError('Failed to print promotional image', err, selectedEvent.slug, {
        eventId: selectedEvent._id,
        printMethod: selectedEvent.printMethod,
      })
    } finally {
      setLoading(false)
    }
  }

  const viewPrintHistory = async (event: Event) => {
    try {
      const res = await fetch(`/api/print-jobs/${event._id}`)
      if (!res.ok) throw new Error('Failed to fetch print history')

      const jobs = await res.json()
      setPrintJobs(jobs)
      setSelectedEventForHistory(event)
      setShowPrintHistory(true)
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch print history'
      setError(errorMessage)
      logClientError('Failed to fetch print history', err, undefined, {
        eventId: event._id,
        eventName: event.name,
      })
    }
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <UICard className="w-full max-w-sm" padding="lg">
          <h1 className="text-2xl font-bold mb-6 text-gray-900">Admin Login</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <UIFormField label="Username">
              <UITextInput
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                required
              />
            </UIFormField>
            <UIFormField label="Password">
              <UITextInput
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </UIFormField>
            {error && <UIStatusBanner type="error" message={error} />}
            <UIButton type="submit" fullWidth loading={loading} disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </UIButton>
          </form>
        </UICard>
      </div>
    )
  }

  // ===== Event Detail View =====
  if (detailEvent) {
    const event = detailEvent
    const isEditingName = editingEventId === event._id && editingField === 'name'
    const layouts = eventLayouts[event._id] || []

    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-2xl mx-auto space-y-5">
          {/* Back + Header */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setDetailEvent(null); setEditingEventId(null); setEditingField(null) }}
              className="p-2 -ml-2 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1">
              {isEditingName ? (
                <div className="flex gap-2 items-center">
                  <UITextInput
                    value={tempValue}
                    onChange={(e) => setTempValue(e.target.value)}
                    className="text-lg font-bold flex-1"
                  />
                  <UIButton size="sm" onClick={() => {
                    handleUpdateEvent(event._id, { name: tempValue })
                    setEditingEventId(null)
                    setEditingField(null)
                  }}>저장</UIButton>
                  <UIButton variant="secondary" size="sm" onClick={() => {
                    setEditingEventId(null)
                    setEditingField(null)
                  }}>취소</UIButton>
                </div>
              ) : (
                <h1
                  className="text-xl font-bold text-gray-900 cursor-pointer hover:text-blue-500 transition-colors"
                  onClick={() => {
                    setEditingEventId(event._id)
                    setEditingField('name')
                    setTempValue(event.name)
                  }}
                >
                  {event.name}
                  <span className="ml-1.5 text-gray-300 text-sm font-normal">편집</span>
                </h1>
              )}
              <p className="text-sm text-gray-400 mt-0.5">{event.slug}</p>
            </div>
          </div>

          {error && <UIStatusBanner type="error" message={error} />}

          {/* Quick Actions */}
          <div className="flex gap-2">
            <UIButton size="sm" onClick={() => generateQR(event)}>QR 코드</UIButton>
            <UIButton size="sm" variant="secondary" onClick={() => {
              window.open(`${window.location.origin}/${event.slug}`, '_blank')
            }}>링크 열기</UIButton>
            <UIButton size="sm" variant="secondary" onClick={() => viewPrintHistory(event)}>인쇄 기록</UIButton>
          </div>

          {/* Print Method */}
          <UICard>
            <UIFormField label="인쇄 방식">
              <div className="flex gap-2">
                {(['email', 'polling'] as const).map(method => (
                  <button
                    key={method}
                    onClick={() => handleUpdateEvent(event._id, { printMethod: method })}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                      (event.printMethod || 'email') === method
                        ? 'bg-blue-500 text-white'
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {method === 'email' ? '이메일 프린트' : 'DB 폴링'}
                  </button>
                ))}
              </div>
            </UIFormField>
          </UICard>

          {/* Border Correction */}
          <UICard>
            <UIFormField label="테두리 보정" hint="인쇄 시 잘림 방지를 위해 이미지를 축소·오프셋 보정합니다">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={event.borderCorrectionEnabled ?? true}
                  onChange={e => handleUpdateEvent(event._id, { borderCorrectionEnabled: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">테두리 보정 적용</span>
              </label>
            </UIFormField>

            {(event.borderCorrectionEnabled ?? true) && (
              <div className="mt-4 space-y-4 pt-4 border-t border-gray-100">
                {/* Shrink Percent */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-gray-700">축소 비율</label>
                    <span className="text-sm font-mono text-blue-600">{event.shrinkPercent ?? 97.5}%</span>
                  </div>
                  <input
                    type="range"
                    min={85}
                    max={100}
                    step={0.25}
                    value={event.shrinkPercent ?? 97.5}
                    onChange={e => handleUpdateEvent(event._id, { shrinkPercent: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                    <span>85%</span>
                    <span>100% (보정 없음)</span>
                  </div>
                </div>

                {/* Vertical Offset */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-gray-700">세로 오프셋</label>
                    <span className="text-sm font-mono text-blue-600">{event.verticalOffsetPx ?? 0}px</span>
                  </div>
                  <input
                    type="range"
                    min={-30}
                    max={30}
                    step={1}
                    value={event.verticalOffsetPx ?? 0}
                    onChange={e => handleUpdateEvent(event._id, { verticalOffsetPx: parseInt(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                    <span>-30px (위로)</span>
                    <span>+30px (아래로)</span>
                  </div>
                </div>

                {/* Reset + Test Print */}
                <div className="flex gap-2">
                  <UIButton
                    variant="secondary"
                    size="sm"
                    onClick={() => handleUpdateEvent(event._id, { shrinkPercent: 97.5, verticalOffsetPx: 0 })}
                  >
                    기본값 복원
                  </UIButton>
                  <UIButton
                    variant="primary"
                    size="sm"
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/events/${event._id}/test-print`, { method: 'POST' })
                        const data = await res.json()
                        if (data.success) {
                          alert(`테스트 패턴 인쇄 완료!\n\nshrink: ${data.settings.shrinkPercent}%\noffset: ${data.settings.verticalOffsetPx}px\n\n인쇄 결과를 확인하고 보정값을 조정하세요.`)
                        } else {
                          alert(`인쇄 실패: ${data.error || data.message}`)
                        }
                      } catch (err: any) {
                        alert(`오류: ${err.message}`)
                      }
                    }}
                  >
                    테스트 패턴 인쇄
                  </UIButton>
                </div>
              </div>
            )}
          </UICard>

          {/* Payment */}
          <UICard>
            <UIFormField
              label={`결제 금액: ${event.price ?? 0}원`}
              hint="0원 = 결제 없이 바로 인쇄, 그 외 = 결제 후 인쇄"
            >
              <div className="flex gap-2 items-center">
                <UITextInput
                  type="number"
                  min={0}
                  max={10000}
                  step={1}
                  value={event.price ?? 0}
                  onChange={(e) => {
                    const newPrice = Number(e.target.value)
                    if (newPrice >= 0) handleUpdateEvent(event._id, { price: newPrice })
                  }}
                  className="w-32"
                />
                <UIButton variant="secondary" size="sm" onClick={() => handleUpdateEvent(event._id, { price: 0 })}>
                  무료로 설정
                </UIButton>
                {(event.price ?? 0) === 0 && <UIBadge variant="success">무료</UIBadge>}
              </div>
            </UIFormField>
          </UICard>

          {/* Puzzle Mode */}
          <UICard>
            <UIFormField label="퍼즐 모드">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={event.puzzleEnabled ?? false}
                    onChange={e => handleUpdateEvent(event._id, { puzzleEnabled: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">퍼즐 인쇄 활성화</span>
                </label>
                {event.puzzleEnabled && (
                  <span className="text-xs text-gray-400">사용자가 조각 수를 선택합니다</span>
                )}
              </div>
            </UIFormField>
          </UICard>

          {/* Background Colors */}
          <UICard>
            <UIFormField label="배경색 설정" hint="사용자가 선택할 수 있는 배경 색상 (기본: 흰색)">
              <div className="flex flex-wrap gap-2 items-center">
                {(event.backgroundColors || ['#FFFFFF']).map((color, idx) => (
                  <div key={`${color}-${idx}`} className="relative group">
                    <div
                      className="w-8 h-8 rounded-full border-2 border-gray-200 shadow-sm"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                    {(event.backgroundColors || ['#FFFFFF']).length > 1 && (
                      <button
                        onClick={() => {
                          const colors = (event.backgroundColors || ['#FFFFFF']).filter((_, i) => i !== idx)
                          handleUpdateEvent(event._id, { backgroundColors: colors })
                        }}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <label className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-blue-400 transition-colors" title="색상 추가">
                  <span className="text-gray-400 text-sm">+</span>
                  <input
                    type="color"
                    className="sr-only"
                    onChange={e => {
                      const newColor = e.target.value.toUpperCase()
                      const colors = event.backgroundColors || ['#FFFFFF']
                      if (!colors.includes(newColor)) {
                        handleUpdateEvent(event._id, { backgroundColors: [...colors, newColor] })
                      }
                    }}
                  />
                </label>
              </div>
              {/* Preset colors */}
              <div className="mt-2">
                <p className="text-xs text-gray-400 mb-1.5">프리셋:</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { color: '#FFFFFF', name: '화이트' },
                    { color: '#000000', name: '블랙' },
                    { color: '#F5F5DC', name: '베이지' },
                    { color: '#FFF0F5', name: '라벤더블러시' },
                    { color: '#F0F8FF', name: '앨리스블루' },
                    { color: '#FFFAF0', name: '플로럴화이트' },
                    { color: '#F5F0EB', name: '웜그레이' },
                    { color: '#E8D5B7', name: '샌드' },
                    { color: '#D4C5A9', name: '카키' },
                    { color: '#C9B1FF', name: '라벤더' },
                    { color: '#FFD1DC', name: '베이비핑크' },
                    { color: '#B5E8D5', name: '민트' },
                    { color: '#FFE4B5', name: '모카신' },
                    { color: '#87CEEB', name: '스카이블루' },
                    { color: '#2C2C2C', name: '차콜' },
                    { color: '#1A1A2E', name: '네이비' },
                  ].map(preset => {
                    const currentColors = event.backgroundColors || ['#FFFFFF']
                    const isAdded = currentColors.includes(preset.color)
                    return (
                      <button
                        key={preset.color}
                        onClick={() => {
                          if (!isAdded) {
                            handleUpdateEvent(event._id, { backgroundColors: [...currentColors, preset.color] })
                          }
                        }}
                        disabled={isAdded}
                        className={`w-6 h-6 rounded-full border transition-all ${
                          isAdded
                            ? 'border-blue-400 ring-1 ring-blue-200 opacity-50 cursor-default'
                            : 'border-gray-300 hover:scale-110 hover:border-gray-400 cursor-pointer'
                        }`}
                        style={{ backgroundColor: preset.color }}
                        title={`${preset.name} (${preset.color})${isAdded ? ' - 추가됨' : ''}`}
                      />
                    )
                  })}
                </div>
              </div>
            </UIFormField>
          </UICard>

          {/* Layout Management */}
          <UICard>
            <div className="flex items-center justify-between mb-3">
              <UISectionHeading title="레이아웃 관리" subtitle="레이아웃을 편집, 삭제, 복제할 수 있습니다" />
              <a href={`/admin/layouts?eventId=${event._id}&eventName=${encodeURIComponent(event.name)}`}>
                <UIButton variant="secondary" size="sm">편집기 열기</UIButton>
              </a>
            </div>
            <div className="space-y-1.5">
              {layouts
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                .map((layout) => (
                <div key={layout._id} className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-800">{layout.name}</span>
                    {layout.isPreset && (
                      <span className="ml-1.5 text-[10px] font-semibold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">프리셋</span>
                    )}
                    <span className="text-xs text-gray-400 ml-2">{layout.printSize} · {layout.slots.length}칸</span>
                  </div>
                  <button
                    onClick={async () => {
                      await fetch(`/api/swit-layouts/${layout._id}/duplicate`, { method: 'POST' })
                      fetchEventLayouts(event._id)
                    }}
                    className="text-xs text-gray-500 hover:text-blue-600 px-2 py-1"
                  >
                    복제
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`"${layout.name}" 레이아웃을 삭제하시겠어요?`)) return
                      await fetch(`/api/swit-layouts/${layout._id}`, { method: 'DELETE' })
                      fetchEventLayouts(event._id)
                    }}
                    className="text-xs text-red-400 hover:text-red-600 px-2 py-1"
                  >
                    삭제
                  </button>
                </div>
              ))}
              {layouts.length === 0 && (
                <p className="text-xs text-gray-400 py-2">레이아웃이 없습니다</p>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">{layouts.length}개 레이아웃</p>
          </UICard>
        </div>

        {/* ===== Modals (QR, Print History, Image Preview) ===== */}
        {renderQRModal()}
        {renderPrintHistoryModal()}
        {renderImagePreviewModal()}
      </div>
    )
  }

  // ===== Helper: render modals =====
  function renderQRModal() {
    if (!qrCodeUrl || !selectedEvent) return null
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto" onClick={() => {
        setQrCodeUrl(null)
        setPromotionalImageUrl(null)
      }}>
        <div className="bg-white rounded-lg p-6 max-w-2xl w-full my-8" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-2xl font-bold mb-4 text-center">{selectedEvent.name} - QR 홍보 이미지</h3>
          {generatingPromo ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
              <span className="ml-4 text-gray-600">4×6 홍보 이미지 생성 중...</span>
            </div>
          ) : promotionalImageUrl ? (
            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-3 text-center">
                4×6 (1200×1800px) 홍보 이미지 - 다운로드 또는 프린터로 인쇄하세요
              </p>
              <div className="bg-gray-100 p-4 rounded-lg">
                <div className="relative w-full max-w-md mx-auto aspect-[1000/1500] bg-white shadow-lg">
                  <Image src={promotionalImageUrl} alt="Promotional Image" fill className="object-contain" unoptimized />
                </div>
              </div>
            </div>
          ) : null}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <UIButton variant="download" onClick={downloadPromotionalImage} disabled={!promotionalImageUrl || generatingPromo}>
              다운로드
            </UIButton>
            <UIButton onClick={printPromotionalImage} disabled={!promotionalImageUrl || generatingPromo || loading} loading={loading}>
              {loading ? '인쇄 중...' : '프린터로 인쇄'}
            </UIButton>
            <UIButton variant="secondary" onClick={() => { setQrCodeUrl(null); setPromotionalImageUrl(null) }}>
              닫기
            </UIButton>
          </div>
        </div>
      </div>
    )
  }

  function renderPrintHistoryModal() {
    if (!showPrintHistory || !selectedEventForHistory) return null
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 overflow-y-auto z-40" onClick={() => setShowPrintHistory(false)}>
        <div className="bg-white rounded-lg p-8 max-w-4xl w-full my-8" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-2xl font-bold mb-4">Print History - {selectedEventForHistory.name}</h3>
          {printJobs.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No print jobs yet</p>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {printJobs.map((job) => (
                <div key={job._id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0">
                      <p className="text-xs text-gray-500 mb-1 text-center">원본</p>
                      <div
                        className="relative w-20 aspect-[1000/1500] bg-gray-200 rounded cursor-pointer hover:opacity-75 transition"
                        onClick={() => setSelectedImageForPreview(job.imageUrl)}
                      >
                        <Image src={job.imageUrl} alt="Original photo" fill className="object-cover rounded" />
                      </div>
                    </div>
                    {job.printedImageUrl && (
                      <div className="flex-shrink-0">
                        <p className="text-xs text-gray-500 mb-1 text-center">인쇄됨</p>
                        <div
                          className="relative w-20 aspect-[1000/1500] bg-gray-200 rounded cursor-pointer hover:opacity-75 transition ring-2 ring-green-500"
                          onClick={() => setSelectedImageForPreview(job.printedImageUrl!)}
                        >
                          <Image src={job.printedImageUrl} alt="Printed photo" fill className="object-cover rounded" />
                        </div>
                      </div>
                    )}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <UIBadge variant={job.status === 'DONE' ? 'success' : 'error'}>
                          {job.status === 'DONE' ? '완료' : '실패'}
                        </UIBadge>
                        <span className="text-sm text-gray-600">
                          {new Date(job.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {job.errorMessage && <p className="text-sm text-red-600">Error: {job.errorMessage}</p>}
                      {job.deviceInfo && (
                        <div className="text-xs space-y-1 bg-white p-3 rounded border">
                          <h4 className="font-semibold text-gray-700 mb-2">Device Information</h4>
                          {job.deviceInfo.deviceId && <p><span className="font-medium">Device ID:</span> {job.deviceInfo.deviceId.substring(0, 12)}...</p>}
                          {job.deviceInfo.ipAddress && <p><span className="font-medium">IP Address:</span> {job.deviceInfo.ipAddress}</p>}
                          {job.deviceInfo.deviceType && <p><span className="font-medium">Device Type:</span> {job.deviceInfo.deviceType}</p>}
                          {job.deviceInfo.os && <p><span className="font-medium">OS:</span> {job.deviceInfo.os}</p>}
                          {job.deviceInfo.browser && <p><span className="font-medium">Browser:</span> {job.deviceInfo.browser}</p>}
                          {job.deviceInfo.screenResolution && <p><span className="font-medium">Screen:</span> {job.deviceInfo.screenResolution}</p>}
                          {job.deviceInfo.timezone && <p><span className="font-medium">Timezone:</span> {job.deviceInfo.timezone}</p>}
                          {job.deviceInfo.userAgent && (
                            <details className="mt-2">
                              <summary className="cursor-pointer font-medium text-gray-700">User Agent</summary>
                              <p className="text-xs text-gray-600 mt-1 break-all">{job.deviceInfo.userAgent}</p>
                            </details>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <UIButton variant="secondary" fullWidth onClick={() => setShowPrintHistory(false)} className="mt-6">
            닫기
          </UIButton>
        </div>
      </div>
    )
  }

  function renderImagePreviewModal() {
    if (!selectedImageForPreview) return null
    return (
      <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 z-50" onClick={() => setSelectedImageForPreview(null)}>
        <div className="relative max-w-md w-full" onClick={(e) => e.stopPropagation()}>
          <UIButton
            variant="ghost"
            size="sm"
            onClick={() => setSelectedImageForPreview(null)}
            className="absolute -top-12 right-0 text-white hover:text-gray-300"
          >
            닫기
          </UIButton>
          <div className="bg-white rounded-lg overflow-hidden">
            <div className="relative w-full aspect-[1000/1500]">
              <Image src={selectedImageForPreview} alt="Full size preview" fill className="object-contain" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ===== Main List View =====
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <UICard className="mb-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Photo Toast Admin</h1>
            <UIButton variant="secondary" size="sm" onClick={handleLogout}>Logout</UIButton>
          </div>
        </UICard>

        {error && <div className="mb-6"><UIStatusBanner type="error" message={error} /></div>}

        {/* Sticker Management */}
        <UICard className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-900">스티커 관리</h2>
            <label className={`inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-colors ${stickerUploading ? 'bg-blue-100 text-blue-300 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600'}`}>
              {stickerUploading ? '업로드 중...' : '스티커 추가'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={stickerUploading}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleUploadSticker(file)
                  e.target.value = ''
                }}
              />
            </label>
          </div>
          {stickers.length === 0 ? (
            <p className="text-gray-400 text-sm">업로드된 스티커가 없습니다.</p>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
              {stickers.map((s) => (
                <div key={s._id} className="relative group aspect-square">
                  <img
                    src={s.url}
                    alt={s.filename}
                    className="w-full h-full object-contain rounded-xl border border-gray-100 bg-gray-50"
                  />
                  <button
                    onClick={() => handleDeleteSticker(s._id)}
                    className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </UICard>

        {/* Events Section */}
        <UICard>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-900">Events</h2>
            <UIButton
              variant={showCreateForm ? 'secondary' : 'primary'}
              size="sm"
              onClick={() => setShowCreateForm(!showCreateForm)}
            >
              {showCreateForm ? '취소' : '이벤트 생성'}
            </UIButton>
          </div>

          {showCreateForm && (
            <form onSubmit={handleCreateEvent} className="mb-6 p-4 bg-gray-50 rounded-xl space-y-4">
              <UIFormField label="Event Name">
                <UITextInput
                  type="text"
                  value={newEventName}
                  onChange={(e) => setNewEventName(e.target.value)}
                  placeholder="Birthday Party 2024"
                  required
                />
              </UIFormField>
              <UIFormField label="인쇄 방식">
                <div className="flex gap-2">
                  {(['email', 'polling'] as const).map(method => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setNewEventPrintMethod(method)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                        newEventPrintMethod === method
                          ? 'bg-blue-500 text-white'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {method === 'email' ? '이메일 프린트' : 'DB 폴링'}
                    </button>
                  ))}
                </div>
              </UIFormField>
              <UIButton type="submit" disabled={loading} loading={loading}>
                {loading ? 'Creating...' : 'Create Event'}
              </UIButton>
            </form>
          )}

          {/* Event List */}
          <div className="divide-y divide-gray-100">
            {events.map((event) => {
              const layoutCount = (eventLayouts[event._id] || []).length
              return (
                <div
                  key={event._id}
                  className="flex items-center gap-3 py-3 px-1 cursor-pointer hover:bg-gray-50 rounded-lg transition-colors -mx-1"
                  onClick={() => setDetailEvent(event)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">{event.name}</h3>
                      <UIBadge variant={event.printMethod === 'polling' ? 'info' : 'default'}>
                        {event.printMethod === 'polling' ? '폴링' : '이메일'}
                      </UIBadge>
                      {(event.price ?? 0) > 0 && (
                        <UIBadge variant="warning">{event.price!.toLocaleString()}원</UIBadge>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {event.slug} · {layoutCount}개 레이아웃 · {new Date(event.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )
            })}
            {events.length === 0 && (
              <p className="text-center text-gray-500 py-8">No events yet. Create one to get started!</p>
            )}
          </div>
        </UICard>
      </div>

      {/* Modals */}
      {renderQRModal()}
      {renderPrintHistoryModal()}
      {renderImagePreviewModal()}
    </div>
  )
}
