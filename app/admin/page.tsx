'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import QRCode from 'qrcode'
import { logClientError } from '@/lib/errorLogger'
import { UIButton, UICard, UIFormField, UITextInput, UIStatusBanner, UIBadge, UISectionHeading } from '@/app/components/ui'

interface Event {
  _id: string
  name: string
  slug: string
  printerUrl: string
  availableLayouts?: string[]
  puzzleEnabled?: boolean
  price?: number
  backgroundColors?: string[]
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
  const [newEventPrinter, setNewEventPrinter] = useState('')
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
  const [editingField, setEditingField] = useState<'name' | 'printer' | null>(null)
  const [tempValue, setTempValue] = useState('')

  // Sticker management
  const [stickers, setStickers] = useState<{ _id: string; url: string; filename: string }[]>([])
  const [stickerUploading, setStickerUploading] = useState(false)

  // Event layouts (SwitLayout-based)
  const [eventLayouts, setEventLayouts] = useState<Record<string, { _id: string; name: string; printSize: string; slots: any[]; isPreset?: boolean; order?: number }[]>>({})

  useEffect(() => {
    checkAuth()
  }, [])

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
          printerUrl: newEventPrinter,
        }),
      })

      if (!res.ok) throw new Error('Failed to create event')

      setNewEventName('')
      setNewEventPrinter('')
      setShowCreateForm(false)
      fetchEvents()
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to create event'
      setError(errorMessage)
      logClientError('Failed to create event', err, undefined, {
        eventName: newEventName,
        printerUrl: newEventPrinter,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateEvent = async (eventId: string, updates: { name?: string; printerUrl?: string; availableLayouts?: string[]; price?: number; puzzleEnabled?: boolean; backgroundColors?: string[] }) => {
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
    console.log('🎨 Starting promotional image generation...')

    try {
      const canvas = document.createElement('canvas')
      canvas.width = 1200
      canvas.height = 1800
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Failed to get canvas context')

      console.log('✅ Canvas created: 1200x1800')

      // Fill gradient background (entire canvas)
      const bgGradient = ctx.createLinearGradient(0, 0, 0, 1800)
      bgGradient.addColorStop(0, '#faf5ff') // purple-50
      bgGradient.addColorStop(1, '#fce7f3') // pink-50
      ctx.fillStyle = bgGradient
      ctx.fillRect(0, 0, 1200, 1800)

      // Load QR code image (use native browser Image, not Next.js Image)
      console.log('⏳ Loading QR image...')
      const qrImage = document.createElement('img')
      await new Promise((resolve, reject) => {
        qrImage.onload = () => {
          console.log('✅ QR image loaded')
          resolve(true)
        }
        qrImage.onerror = (e) => {
          console.error('❌ QR image load failed:', e)
          reject(e)
        }
        qrImage.src = qrDataUrl
      })

      // Helper function for rounded rectangle
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

      // Draw header card with shadow
      ctx.save()
      ctx.shadowColor = 'rgba(0, 0, 0, 0.1)'
      ctx.shadowBlur = 20
      ctx.shadowOffsetY = 10
      roundRect(80, 60, 1040, 200, 30)
      const headerGradient = ctx.createLinearGradient(0, 60, 0, 260)
      headerGradient.addColorStop(0, '#a855f7') // purple-500
      headerGradient.addColorStop(1, '#ec4899') // pink-500
      ctx.fillStyle = headerGradient
      ctx.fill()
      ctx.restore()

      // Draw event name with shadow
      ctx.save()
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'
      ctx.shadowBlur = 8
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 80px Arial, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(event.name, 600, 130)
      ctx.restore()

      // Draw subtitle
      ctx.fillStyle = '#ffffff'
      ctx.font = '48px Arial, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('포토카드 무료 즉석인화 이벤트 🎉', 600, 210)

      // Draw instructions card with shadow
      ctx.save()
      ctx.shadowColor = 'rgba(0, 0, 0, 0.1)'
      ctx.shadowBlur = 20
      ctx.shadowOffsetY = 10
      roundRect(80, 320, 1040, 330, 30)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.restore()

      // Draw instructions title
      ctx.fillStyle = '#7c3aed' // purple-600
      ctx.font = 'bold 56px Arial, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('사용 방법', 600, 370)

      // Draw step numbers and instructions
      const instructions = [
        { num: '1', text: '스마트폰 카메라로 QR 코드 스캔' },
        { num: '2', text: '원하는 레이아웃 선택' },
        { num: '3', text: '사진 선택 후 "프린트 하기" 클릭!' }
      ]

      instructions.forEach((item, i) => {
        const y = 460 + i * 70

        // Draw circle for number
        ctx.beginPath()
        ctx.arc(140, y, 24, 0, Math.PI * 2)
        const circleGradient = ctx.createLinearGradient(116, y - 24, 164, y + 24)
        circleGradient.addColorStop(0, '#a855f7') // purple-500
        circleGradient.addColorStop(1, '#ec4899') // pink-500
        ctx.fillStyle = circleGradient
        ctx.fill()

        // Draw number
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 30px Arial, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(item.num, 140, y)

        // Draw instruction text
        ctx.fillStyle = '#1f2937' // gray-800
        ctx.font = '38px Arial, sans-serif'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(item.text, 190, y)
      })

      console.log('✅ Text drawn')

      // Draw QR code card with shadow
      const qrSize = 700
      const qrX = (1200 - qrSize) / 2
      const qrY = 860

      ctx.save()
      ctx.shadowColor = 'rgba(0, 0, 0, 0.15)'
      ctx.shadowBlur = 30
      ctx.shadowOffsetY = 15
      roundRect(qrX - 40, qrY - 40, qrSize + 80, qrSize + 80, 30)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.restore()

      // Draw QR code
      ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize)
      console.log('✅ QR code drawn')

      console.log('⏳ Converting canvas to blob...')
      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) {
            console.log('✅ Blob created, size:', b.size)
            resolve(b)
          } else {
            console.error('❌ Failed to create blob')
            reject(new Error('Failed to create blob'))
          }
        }, 'image/jpeg', 0.95)
      })

      const url = URL.createObjectURL(blob)
      console.log('✅ Promotional image URL created:', url.substring(0, 50))
      setPromotionalImageUrl(url)
    } catch (err: any) {
      console.error('❌ Failed to generate promotional image:', err)
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

      // Convert blob URL to data URL (base64)
      const response = await fetch(promotionalImageUrl)
      const blob = await response.blob()
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })

      // Send to print API
      const printRes = await fetch('/api/print', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          slug: selectedEvent.slug,
          imageUrl: dataUrl,
        }),
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
        printerUrl: selectedEvent.printerUrl
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

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
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

        <UICard className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-900">Events</h2>
            <UIButton
              variant={showCreateForm ? 'secondary' : 'primary'}
              size="sm"
              onClick={() => setShowCreateForm(!showCreateForm)}
            >
              {showCreateForm ? 'Cancel' : 'Create Event'}
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
              <UIFormField label="Printer IPP URL">
                <UITextInput
                  type="text"
                  value={newEventPrinter}
                  onChange={(e) => setNewEventPrinter(e.target.value)}
                  placeholder="ipp://192.168.1.100:631/printers/printer1"
                  required
                />
              </UIFormField>
              <UIButton type="submit" disabled={loading} loading={loading}>
                {loading ? 'Creating...' : 'Create Event'}
              </UIButton>
            </form>
          )}

          <div className="space-y-4">
            {events.map((event) => {
              const isEditingName = editingEventId === event._id && editingField === 'name'
              const isEditingPrinter = editingEventId === event._id && editingField === 'printer'

              return (
                <UICard key={event._id}>
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 space-y-4">
                      {/* Event Name - Editable */}
                      <div>
                        {isEditingName ? (
                          <div className="flex gap-2">
                            <UITextInput
                              value={tempValue}
                              onChange={(e) => setTempValue(e.target.value)}
                              className="flex-1 text-lg font-bold"
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
                          <h3
                            className="text-lg font-bold cursor-pointer hover:text-blue-500 transition-colors"
                            onClick={() => {
                              setEditingEventId(event._id)
                              setEditingField('name')
                              setTempValue(event.name)
                            }}
                          >
                            {event.name}
                            <span className="ml-1 text-gray-300 text-sm">편집</span>
                          </h3>
                        )}
                      </div>

                      <p className="text-sm text-gray-600">Slug: {event.slug}</p>

                      {/* Printer URL - Editable */}
                      <div>
                        {isEditingPrinter ? (
                          <div className="flex gap-2">
                            <UITextInput
                              value={tempValue}
                              onChange={(e) => setTempValue(e.target.value)}
                              className="flex-1"
                            />
                            <UIButton size="sm" onClick={() => {
                              handleUpdateEvent(event._id, { printerUrl: tempValue })
                              setEditingEventId(null)
                              setEditingField(null)
                            }}>저장</UIButton>
                            <UIButton variant="secondary" size="sm" onClick={() => {
                              setEditingEventId(null)
                              setEditingField(null)
                            }}>취소</UIButton>
                          </div>
                        ) : (
                          <p
                            className="text-sm text-gray-500 cursor-pointer hover:text-blue-500 transition-colors"
                            onClick={() => {
                              setEditingEventId(event._id)
                              setEditingField('printer')
                              setTempValue(event.printerUrl)
                            }}
                          >
                            프린터: {event.printerUrl} <span className="text-gray-300">편집</span>
                          </p>
                        )}
                      </div>

                      {/* Payment Price Control */}
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
                              if (newPrice >= 0) {
                                handleUpdateEvent(event._id, { price: newPrice })
                              }
                            }}
                            className="w-32"
                          />
                          <UIButton variant="secondary" size="sm" onClick={() => handleUpdateEvent(event._id, { price: 0 })}>
                            무료로 설정
                          </UIButton>
                          {(event.price ?? 0) === 0 && <UIBadge variant="success">무료</UIBadge>}
                        </div>
                      </UIFormField>

                      {/* Puzzle Mode */}
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

                      {/* Background Colors */}
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

                      {/* Layout Management (SwitLayout-based) */}
                      <div className="border-t border-gray-100 pt-4">
                        <div className="flex items-center justify-between mb-3">
                          <UISectionHeading title="레이아웃 관리" subtitle="레이아웃을 편집, 삭제, 복제할 수 있습니다" />
                          <a href={`/admin/layouts?eventId=${event._id}&eventName=${encodeURIComponent(event.name)}`}>
                            <UIButton variant="secondary" size="sm">편집기 열기</UIButton>
                          </a>
                        </div>
                        <div className="space-y-1.5">
                          {(eventLayouts[event._id] || [])
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
                                title="복제"
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
                                title="삭제"
                              >
                                삭제
                              </button>
                            </div>
                          ))}
                          {(!eventLayouts[event._id] || eventLayouts[event._id].length === 0) && (
                            <p className="text-xs text-gray-400 py-2">레이아웃이 없습니다</p>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          {(eventLayouts[event._id] || []).length}개 레이아웃
                        </p>
                      </div>

                    </div>

                    <div className="flex flex-col gap-2 min-w-[120px]">
                      <UIButton size="sm" onClick={() => generateQR(event)}>QR 코드</UIButton>
                      <UIButton size="sm" variant="secondary" onClick={() => {
                        const url = `${window.location.origin}/${event.slug}`
                        window.open(url, '_blank')
                      }}>링크 열기</UIButton>
                      <UIButton size="sm" onClick={() => {
                        const url = `/admin/layouts?eventId=${event._id}&eventName=${encodeURIComponent(event.name)}`
                        window.open(url, '_blank')
                      }}>레이아웃 편집</UIButton>
                      <UIButton size="sm" variant="secondary" onClick={() => viewPrintHistory(event)}>인쇄 기록</UIButton>
                    </div>
                  </div>
                </UICard>
              )
            })}
            {events.length === 0 && (
              <p className="text-center text-gray-500 py-8">No events yet. Create one to get started!</p>
            )}
          </div>
        </UICard>

        {qrCodeUrl && selectedEvent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto" onClick={() => {
            setQrCodeUrl(null)
            setPromotionalImageUrl(null)
          }}>
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full my-8" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-2xl font-bold mb-4 text-center">📸 {selectedEvent.name} - QR 홍보 이미지</h3>

              {/* 4x6 Promotional Image Preview */}
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
                      <Image
                        src={promotionalImageUrl}
                        alt="Promotional Image"
                        fill
                        className="object-contain"
                        unoptimized
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Action buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <UIButton
                  variant="download"
                  onClick={downloadPromotionalImage}
                  disabled={!promotionalImageUrl || generatingPromo}
                >
                  다운로드
                </UIButton>
                <UIButton
                  onClick={printPromotionalImage}
                  disabled={!promotionalImageUrl || generatingPromo || loading}
                  loading={loading}
                >
                  {loading ? '인쇄 중...' : '프린터로 인쇄'}
                </UIButton>
                <UIButton
                  variant="secondary"
                  onClick={() => {
                    setQrCodeUrl(null)
                    setPromotionalImageUrl(null)
                  }}
                >
                  닫기
                </UIButton>
              </div>
            </div>
          </div>
        )}

        {showPrintHistory && selectedEventForHistory && (
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
                        {/* Original Image */}
                        <div className="flex-shrink-0">
                          <p className="text-xs text-gray-500 mb-1 text-center">원본</p>
                          <div
                            className="relative w-20 aspect-[1000/1500] bg-gray-200 rounded cursor-pointer hover:opacity-75 transition"
                            onClick={() => setSelectedImageForPreview(job.imageUrl)}
                          >
                            <Image
                              src={job.imageUrl}
                              alt="Original photo"
                              fill
                              className="object-cover rounded"
                            />
                          </div>
                        </div>
                        {/* Printed Image (if available) */}
                        {job.printedImageUrl && (
                          <div className="flex-shrink-0">
                            <p className="text-xs text-gray-500 mb-1 text-center">인쇄됨</p>
                            <div
                              className="relative w-20 aspect-[1000/1500] bg-gray-200 rounded cursor-pointer hover:opacity-75 transition ring-2 ring-green-500"
                              onClick={() => setSelectedImageForPreview(job.printedImageUrl!)}
                            >
                              <Image
                                src={job.printedImageUrl}
                                alt="Printed photo"
                                fill
                                className="object-cover rounded"
                              />
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

                          {job.errorMessage && (
                            <p className="text-sm text-red-600">Error: {job.errorMessage}</p>
                          )}

                          {job.deviceInfo && (
                            <div className="text-xs space-y-1 bg-white p-3 rounded border">
                              <h4 className="font-semibold text-gray-700 mb-2">Device Information</h4>
                              {job.deviceInfo.deviceId && (
                                <p><span className="font-medium">Device ID:</span> {job.deviceInfo.deviceId.substring(0, 12)}...</p>
                              )}
                              {job.deviceInfo.ipAddress && (
                                <p><span className="font-medium">IP Address:</span> {job.deviceInfo.ipAddress}</p>
                              )}
                              {job.deviceInfo.deviceType && (
                                <p><span className="font-medium">Device Type:</span> {job.deviceInfo.deviceType}</p>
                              )}
                              {job.deviceInfo.os && (
                                <p><span className="font-medium">OS:</span> {job.deviceInfo.os}</p>
                              )}
                              {job.deviceInfo.browser && (
                                <p><span className="font-medium">Browser:</span> {job.deviceInfo.browser}</p>
                              )}
                              {job.deviceInfo.screenResolution && (
                                <p><span className="font-medium">Screen:</span> {job.deviceInfo.screenResolution}</p>
                              )}
                              {job.deviceInfo.timezone && (
                                <p><span className="font-medium">Timezone:</span> {job.deviceInfo.timezone}</p>
                              )}
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

              <UIButton
                variant="secondary"
                fullWidth
                onClick={() => setShowPrintHistory(false)}
                className="mt-6"
              >
                닫기
              </UIButton>
            </div>
          </div>
        )}

        {selectedImageForPreview && (
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
                  <Image
                    src={selectedImageForPreview}
                    alt="Full size preview"
                    fill
                    className="object-contain"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
