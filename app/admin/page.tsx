'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import QRCode from 'qrcode'
import { logClientError } from '@/lib/errorLogger'
import { UIButton, UICard, UIFormField, UITextInput, UIStatusBanner, UIBadge, UISectionHeading } from '@/app/components/ui'

type PrintMethod = 'email' | 'polling' | 'epson_api'

interface EpsonApiAuth {
  clientId: string
  clientSecret: string
  printerEmail: string
  accessToken?: string
  refreshToken?: string
  tokenExpiresAt?: number
  subjectId?: string
}

interface Printer {
  _id: string
  name: string
  printMethod: PrintMethod
  email?: string
  apiKey?: string
  epsonAuth?: EpsonApiAuth
  supportedSizes: string[]
  borderCorrectionEnabled: boolean
  shrinkPercent: number
  verticalOffsetPx: number
  createdAt: string
}

interface Event {
  _id: string
  name: string
  slug: string
  printerId?: string
  availableLayouts?: string[]
  puzzleEnabled?: boolean
  price?: number
  backgroundColors?: string[]
  donation?: {
    enabled: boolean
    bank: string
    account: string
    holder?: string
    message?: string
    link?: string
  }
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
  printerId?: string
  printerName?: string | null
  imageUrl: string
  printedImageUrl?: string
  createdAt: string
  status: 'PENDING' | 'DONE' | 'FAILED'
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

  // Printers
  const [printers, setPrinters] = useState<Printer[]>([])
  const [showPrinterForm, setShowPrinterForm] = useState(false)
  const [newPrinterName, setNewPrinterName] = useState('')
  const [newPrinterMethod, setNewPrinterMethod] = useState<PrintMethod>('email')
  const [newPrinterEmail, setNewPrinterEmail] = useState('')
  const [newPrinterEpsonAuth, setNewPrinterEpsonAuth] = useState<Partial<EpsonApiAuth>>({})
  const [newPrinterSupportedSizes, setNewPrinterSupportedSizes] = useState<string[]>(['4x6', '6x4'])
  const [editingPrinter, setEditingPrinter] = useState<Printer | null>(null)

  // Create event form
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newEventName, setNewEventName] = useState('')
  const [newEventPrinterId, setNewEventPrinterId] = useState('')
  // Detail view
  const [detailEvent, setDetailEvent] = useState<Event | null>(null)

  // QR modal
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const [promotionalImageUrl, setPromotionalImageUrl] = useState<string | null>(null)
  const [generatingPromo, setGeneratingPromo] = useState(false)
  const [qrPromoShowUrl, setQrPromoShowUrl] = useState(true)
  const [qrPromoShowDonation, setQrPromoShowDonation] = useState(false)

  // Print history
  const [showPrintHistory, setShowPrintHistory] = useState(false)
  const [printJobs, setPrintJobs] = useState<PrintJob[]>([])
  const [printJobsTotal, setPrintJobsTotal] = useState(0)
  const [printJobsPage, setPrintJobsPage] = useState(1)
  const [printJobsTotalPages, setPrintJobsTotalPages] = useState(1)
  const [selectedEventForHistory, setSelectedEventForHistory] = useState<Event | null>(null)
  const [recentPrintJobs, setRecentPrintJobs] = useState<PrintJob[]>([])
  const [recentPrintJobsTotal, setRecentPrintJobsTotal] = useState(0)
  const [selectedImageForPreview, setSelectedImageForPreview] = useState<string | null>(null)

  // Event editing states
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<'name' | 'slug' | null>(null)
  const [tempValue, setTempValue] = useState('')

  // Sticker management
  const [stickers, setStickers] = useState<{ _id: string; url: string; filename: string }[]>([])
  const [stickerUploading, setStickerUploading] = useState(false)

  // Event layouts (SwitLayout-based)
  const [eventLayouts, setEventLayouts] = useState<Record<string, { _id: string; name: string; printSize: string; slots: any[]; isPreset?: boolean; order?: number; visible?: boolean }[]>>({})
  const [dragLayoutId, setDragLayoutId] = useState<string | null>(null)
  const [dragOverLayoutId, setDragOverLayoutId] = useState<string | null>(null)
  const [showLayoutCreate, setShowLayoutCreate] = useState(false)
  const [newLayoutName, setNewLayoutName] = useState('')
  const [newLayoutSize, setNewLayoutSize] = useState<'4x6' | '2x6' | '6x4'>('4x6')

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

  // Fetch recent print jobs for detail event
  useEffect(() => {
    if (!detailEvent) { setRecentPrintJobs([]); return }
    const fetchRecent = async () => {
      try {
        const res = await fetch(`/api/print-jobs/${detailEvent._id}?limit=5`)
        if (res.ok) {
          const data = await res.json()
          setRecentPrintJobs(data.jobs ?? data)
          setRecentPrintJobsTotal(data.total ?? 0)
        }
      } catch {}
    }
    fetchRecent()
  }, [detailEvent?._id])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/events')
      if (res.ok) {
        setAuthenticated(true)
        fetchEvents()
        fetchStickers()
        fetchPrinters()
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

  const fetchPrinters = async () => {
    try {
      const res = await fetch('/api/printers')
      if (res.ok) setPrinters(await res.json())
    } catch (err) {}
  }

  const handleCreatePrinter = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/printers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPrinterName,
          printMethod: newPrinterMethod,
          email: newPrinterMethod === 'email' ? newPrinterEmail : undefined,
          epsonAuth: newPrinterMethod === 'epson_api' ? newPrinterEpsonAuth : undefined,
          supportedSizes: newPrinterSupportedSizes,
          borderCorrectionEnabled: true,
          shrinkPercent: 97.5,
          verticalOffsetPx: 0,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create printer')
      }
      setNewPrinterName('')
      setNewPrinterEmail('')
      setNewPrinterEpsonAuth({})
      setNewPrinterMethod('email')
      setNewPrinterSupportedSizes(['4x6', '6x4'])
      setShowPrinterForm(false)
      fetchPrinters()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleUpdatePrinter = async (printerId: string, updates: Partial<Printer>) => {
    try {
      const res = await fetch(`/api/printers/${printerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error('Failed to update printer')
      fetchPrinters()
      if (editingPrinter && editingPrinter._id === printerId) {
        const updated = await res.json()
        setEditingPrinter(updated)
      }
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleDeletePrinter = async (printerId: string) => {
    if (!confirm('이 프린터를 삭제하시겠어요?')) return
    try {
      const res = await fetch(`/api/printers/${printerId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete printer')
      fetchPrinters()
      if (editingPrinter?._id === printerId) setEditingPrinter(null)
    } catch (err: any) {
      setError(err.message)
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
      fetchPrinters()
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
          printerId: newEventPrinterId || undefined,
        }),
      })

      if (!res.ok) throw new Error('Failed to create event')

      setNewEventName('')
      setNewEventPrinterId('')
      setShowCreateForm(false)
      fetchEvents()
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to create event'
      setError(errorMessage)
      logClientError('Failed to create event', err, undefined, {
        eventName: newEventName,
        printerId: newEventPrinterId,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateEvent = async (eventId: string, updates: { name?: string; slug?: string; printerId?: string; availableLayouts?: string[]; price?: number; puzzleEnabled?: boolean; backgroundColors?: string[]; donation?: Event['donation'] }) => {
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

  const generateQR = async (event: Event, showUrl = qrPromoShowUrl, showDonation = qrPromoShowDonation) => {
    const url = `${window.location.origin}/${event.slug}`
    const qr = await QRCode.toDataURL(url, { width: 800, margin: 1, errorCorrectionLevel: 'H' })
    setQrCodeUrl(qr)
    setSelectedEvent(event)

    // Generate 4x6 promotional image (1200x1800px)
    await generate4x6PromotionalImage(qr, event, showUrl, showDonation)
  }

  const generate4x6PromotionalImage = async (qrDataUrl: string, event: Event, showUrl: boolean, showDonation: boolean) => {
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

      // Load logo image
      const logoImage = document.createElement('img')
      await new Promise((resolve, reject) => {
        logoImage.onload = () => resolve(true)
        logoImage.onerror = () => resolve(false) // logo is optional
        logoImage.src = '/logo-without-bg.png'
      })

      const font = '-apple-system, "Helvetica Neue", Arial, sans-serif'

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

      // ── Background: soft gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H)
      bgGrad.addColorStop(0, '#F8F0FF')
      bgGrad.addColorStop(0.5, '#FFFFFF')
      bgGrad.addColorStop(1, '#FFF5F0')
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, W, H)

      // ── Decorative top accent bar
      const accentGrad = ctx.createLinearGradient(0, 0, W, 0)
      accentGrad.addColorStop(0, '#8B5CF6')
      accentGrad.addColorStop(0.5, '#EC4899')
      accentGrad.addColorStop(1, '#F97316')
      ctx.fillStyle = accentGrad
      ctx.fillRect(0, 0, W, 14)

      const hasDonation = showDonation && event.donation?.enabled && event.donation.account
      const qrSize = 700
      const cardPad = 44
      const stepGap = 86

      // ── Event name
      let y = 120
      ctx.fillStyle = '#1A1A2E'
      ctx.font = `bold 110px ${font}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(event.name, W / 2, y)

      // ── Subtitle
      y += 110
      ctx.fillStyle = '#6B7280'
      ctx.font = `600 54px ${font}`
      ctx.fillText('📸 무료 핸드폰 사진 이벤트 🎉', W / 2, y)

      // ── "무료" badge (bigger, bolder)
      y += 90
      const freeW = 900
      const freeH = 84
      const freeX = (W - freeW) / 2
      const freeGrad = ctx.createLinearGradient(freeX, y, freeX + freeW, y)
      freeGrad.addColorStop(0, '#7C3AED')
      freeGrad.addColorStop(0.5, '#DB2777')
      freeGrad.addColorStop(1, '#EA580C')
      roundRect(freeX, y - freeH / 2, freeW, freeH, freeH / 2)
      ctx.fillStyle = freeGrad
      ctx.fill()
      ctx.fillStyle = '#FFFFFF'
      ctx.font = `bold 44px ${font}`
      ctx.fillText('🎊  참여비 무료 · 인쇄 무료 · 몇 장이든 무료  🎊', W / 2, y)

      // ── QR code area
      y += freeH / 2 + 50
      const qrX = (W - qrSize) / 2
      const qrY = y

      // Card behind QR
      ctx.save()
      ctx.shadowColor = 'rgba(139, 92, 246, 0.15)'
      ctx.shadowBlur = 60
      ctx.shadowOffsetY = 12
      roundRect(qrX - cardPad, qrY - cardPad, qrSize + cardPad * 2, qrSize + cardPad * 2, 28)
      ctx.fillStyle = '#FFFFFF'
      ctx.fill()
      ctx.strokeStyle = '#F3E8FF'
      ctx.lineWidth = 3
      ctx.stroke()
      ctx.restore()

      // QR code
      ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize)

      // ── Logo in center of QR
      const hasLogo = logoImage.complete && logoImage.naturalWidth > 0
      if (hasLogo) {
        const logoSize = 140
        const logoPad = 14
        const logoX = qrX + (qrSize - logoSize) / 2
        const logoY2 = qrY + (qrSize - logoSize) / 2
        ctx.fillStyle = '#FFFFFF'
        ctx.beginPath()
        ctx.arc(logoX + logoSize / 2, logoY2 + logoSize / 2, logoSize / 2 + logoPad, 0, Math.PI * 2)
        ctx.fill()
        ctx.drawImage(logoImage, logoX, logoY2, logoSize, logoSize)
      }

      // ── Scan instruction
      y = qrY + qrSize + cardPad + 66
      ctx.fillStyle = '#374151'
      ctx.font = `bold 54px ${font}`
      ctx.textAlign = 'center'
      ctx.fillText('📱 QR 코드를 스캔하세요!', W / 2, y)

      // ── URL display
      if (showUrl) {
        y += 68
        const eventUrl = `${window.location.host}/${event.slug}`
        ctx.fillStyle = '#7C3AED'
        ctx.font = `600 48px ${font}`
        ctx.fillText(eventUrl, W / 2, y)
      }

      // ── Steps
      y += 90
      const steps = [
        'QR 스캔 후 레이아웃 선택',
        '사진을 선택하고 꾸미기',
        '프린트! 여러 장도 자유롭게 🎉',
      ]

      steps.forEach((text, i) => {
        const sy = y + i * stepGap

        const pillW = 52, pillH = 52
        const pillX = 120
        roundRect(pillX - pillW / 2, sy - pillH / 2, pillW, pillH, pillH / 2)
        const pillGrad = ctx.createLinearGradient(pillX - pillW / 2, sy, pillX + pillW / 2, sy)
        pillGrad.addColorStop(0, '#8B5CF6')
        pillGrad.addColorStop(1, '#EC4899')
        ctx.fillStyle = pillGrad
        ctx.fill()

        ctx.fillStyle = '#FFFFFF'
        ctx.font = `bold 30px ${font}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(i + 1), pillX, sy)

        ctx.fillStyle = '#374151'
        ctx.font = `600 52px ${font}`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(text, pillX + 42, sy)
      })

      // ── Donation info (pinned to bottom)
      if (hasDonation) {
        const boxW = W - 160
        const boxX = 80
        const boxH = 86
        const boxY = H - 70 - boxH // above the Photo Toast text
        roundRect(boxX, boxY, boxW, boxH, 16)
        ctx.fillStyle = '#FEF3C7'
        ctx.fill()
        ctx.strokeStyle = '#FCD34D'
        ctx.lineWidth = 2
        ctx.stroke()

        const don = event.donation!
        const donText = `💛 후원계좌: ${don.bank || ''} ${don.account} ${don.holder ? `(${don.holder})` : ''}`
        ctx.fillStyle = '#92400E'
        ctx.font = `600 28px ${font}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(donText, W / 2, boxY + boxH / 2)
      }

      // ── Bottom: Photo Toast + accent bar
      ctx.fillStyle = '#D1D5DB'
      ctx.font = `500 24px ${font}`
      ctx.textAlign = 'center'
      ctx.fillText('Photo Toast', W / 2, H - 34)
      ctx.fillStyle = accentGrad
      ctx.fillRect(0, H - 14, W, 14)

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
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchPrintHistory = async (event: Event, page = 1) => {
    try {
      const res = await fetch(`/api/print-jobs/${event._id}?page=${page}&limit=20`)
      if (!res.ok) throw new Error('Failed to fetch print history')

      const data = await res.json()
      setPrintJobs(data.jobs ?? data)
      setPrintJobsTotal(data.total ?? 0)
      setPrintJobsPage(data.page ?? 1)
      setPrintJobsTotalPages(data.totalPages ?? 1)
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch print history'
      setError(errorMessage)
      logClientError('Failed to fetch print history', err, undefined, {
        eventId: event._id,
        eventName: event.name,
      })
    }
  }

  const viewPrintHistory = async (event: Event) => {
    setSelectedEventForHistory(event)
    setShowPrintHistory(true)
    await fetchPrintHistory(event, 1)
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
    const eventPrinter = printers.find(p => p._id === event.printerId)
    const printerSupportedSizes = eventPrinter?.supportedSizes

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
              {editingEventId === event._id && editingField === 'slug' ? (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm text-gray-400">/</span>
                  <UITextInput
                    value={tempValue}
                    onChange={e => setTempValue(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    className="text-sm flex-1"
                    autoFocus
                  />
                  <UIButton size="sm" onClick={async () => {
                    await handleUpdateEvent(event._id, { slug: tempValue })
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
                  className="text-sm text-gray-400 mt-0.5 cursor-pointer hover:text-blue-400 transition-colors"
                  onClick={() => {
                    setEditingEventId(event._id)
                    setEditingField('slug')
                    setTempValue(event.slug)
                  }}
                >
                  /{event.slug} <span className="text-gray-300 text-xs">편집</span>
                </p>
              )}
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
            <UIButton size="sm" variant="secondary" onClick={async () => {
              if (!confirm(`"${event.name}" 이벤트를 삭제하시겠어요?\n연관된 인쇄 기록과 레이아웃도 모두 삭제됩니다.`)) return
              try {
                const res = await fetch(`/api/events/${event._id}`, { method: 'DELETE' })
                if (!res.ok) throw new Error('삭제 실패')
                setDetailEvent(null)
                fetchEvents()
              } catch (err: any) {
                setError(err.message || '이벤트 삭제 실패')
              }
            }} className="!text-red-500 !hover:bg-red-50">삭제</UIButton>
          </div>

          {/* Printer Selection */}
          <UICard>
            <UIFormField label="프린터" hint="이벤트에서 사용할 프린터를 선택하세요">
              <select
                value={event.printerId || ''}
                onChange={e => handleUpdateEvent(event._id, { printerId: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">프린터 선택...</option>
                {printers.map(p => (
                  <option key={p._id} value={p._id}>
                    {p.name} ({p.printMethod === 'email' ? '이메일' : p.printMethod === 'epson_api' ? 'API' : '폴링'})
                  </option>
                ))}
              </select>
            </UIFormField>
            {event.printerId && (() => {
              const printer = printers.find(p => p._id === event.printerId)
              if (!printer) return <p className="text-xs text-gray-400 mt-2">프린터를 찾을 수 없습니다</p>
              return (
                <div className="mt-3 p-3 bg-gray-50 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800">{printer.name}</span>
                    <UIBadge variant={printer.printMethod === 'email' ? 'default' : 'info'}>
                      {printer.printMethod === 'email' ? '이메일' : printer.printMethod === 'epson_api' ? 'API' : '폴링'}
                    </UIBadge>
                  </div>
                  {printer.email && <p className="text-xs text-gray-500">{printer.email}</p>}
                  <p className="text-xs text-gray-400">
                    보정: {printer.borderCorrectionEnabled ? `축소 ${printer.shrinkPercent}% / 오프셋 ${printer.verticalOffsetPx}px` : '비활성'}
                  </p>
                </div>
              )
            })()}
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

          {/* Donation Settings */}
          <UICard>
            <UIFormField label="후원 계좌 안내">
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={event.donation?.enabled ?? false}
                    onChange={e => {
                      const prev = event.donation || { enabled: false, bank: '', account: '' }
                      handleUpdateEvent(event._id, { donation: { ...prev, enabled: e.target.checked } })
                    }}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">결과 화면에 후원 계좌 표시</span>
                </label>
                {event.donation?.enabled && (
                  <div className="space-y-2 pl-6">
                    <div className="flex gap-2">
                      <UITextInput
                        placeholder="은행명"
                        defaultValue={event.donation?.bank || ''}
                        onBlur={e => {
                          const prev = event.donation || { enabled: true, bank: '', account: '' }
                          handleUpdateEvent(event._id, { donation: { ...prev, bank: e.target.value } })
                        }}
                        className="w-28"
                      />
                      <UITextInput
                        placeholder="계좌번호"
                        defaultValue={event.donation?.account || ''}
                        onBlur={e => {
                          const prev = event.donation || { enabled: true, bank: '', account: '' }
                          handleUpdateEvent(event._id, { donation: { ...prev, account: e.target.value } })
                        }}
                        className="flex-1"
                      />
                    </div>
                    <div className="flex gap-2">
                      <UITextInput
                        placeholder="예금주 (선택)"
                        defaultValue={event.donation?.holder || ''}
                        onBlur={e => {
                          const prev = event.donation || { enabled: true, bank: '', account: '' }
                          handleUpdateEvent(event._id, { donation: { ...prev, holder: e.target.value || undefined } })
                        }}
                        className="w-28"
                      />
                      <UITextInput
                        placeholder="안내 문구 (선택)"
                        defaultValue={event.donation?.message || ''}
                        onBlur={e => {
                          const prev = event.donation || { enabled: true, bank: '', account: '' }
                          handleUpdateEvent(event._id, { donation: { ...prev, message: e.target.value || undefined } })
                        }}
                        className="flex-1"
                      />
                      <div className="flex gap-1 flex-1 items-center">
                        <UITextInput
                          placeholder="송금 링크 (토스, 카카오페이 등)"
                          defaultValue={event.donation?.link || ''}
                          onBlur={e => {
                            const prev = event.donation || { enabled: true, bank: '', account: '' }
                            handleUpdateEvent(event._id, { donation: { ...prev, link: e.target.value || undefined } })
                          }}
                          className="flex-1"
                        />
                        <button
                          type="button"
                          title="토스 딥링크 자동 생성"
                          onClick={() => {
                            const don = event.donation
                            if (!don?.bank || !don?.account) {
                              alert('은행명과 계좌번호를 먼저 입력해주세요')
                              return
                            }
                            const bankMap: Record<string, string> = {
                              '카카오뱅크': '카카오', '카카오': '카카오',
                              'KB': 'KB', 'KB국민': 'KB', '국민': 'KB', '국민은행': 'KB',
                              '신한': '신한', '신한은행': '신한',
                              '우리': '우리', '우리은행': '우리',
                              '하나': '하나', '하나은행': '하나', 'KEB하나': '하나',
                              '농협': 'NH', 'NH': 'NH', 'NH농협': 'NH',
                              '기업': 'IBK', 'IBK': 'IBK', '기업은행': 'IBK',
                              '토스': '토스', '토스뱅크': '토스',
                              'SC': 'SC', 'SC제일': 'SC', '제일': 'SC',
                              '씨티': '씨티', '한국씨티': '씨티',
                              '케이뱅크': '케이', 'K뱅크': '케이',
                              '새마을': '새마을', '새마을금고': '새마을',
                              '신협': '신협', '우체국': '우체국',
                            }
                            const bankKey = bankMap[don.bank.trim()] || don.bank.trim()
                            const accountNo = don.account.replace(/-/g, '')
                            const link = `supertoss://send?bank=${encodeURIComponent(bankKey)}&accountNo=${accountNo}&origin=photobooth`
                            const prev = { ...don, link }
                            handleUpdateEvent(event._id, { donation: prev })
                          }}
                          className="shrink-0 px-2 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors whitespace-nowrap"
                        >
                          토스 생성
                        </button>
                      </div>
                    </div>
                  </div>
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
              <UISectionHeading title="레이아웃 관리" subtitle="드래그로 순서 변경 · 클릭하여 편집" />
              <UIButton size="sm" onClick={() => setShowLayoutCreate(prev => !prev)}>
                {showLayoutCreate ? '취소' : '+ 새 레이아웃'}
              </UIButton>
            </div>

            {showLayoutCreate && (
              <form onSubmit={async (e) => {
                e.preventDefault()
                if (!newLayoutName.trim()) return
                await fetch('/api/swit-layouts', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ eventId: event._id, name: newLayoutName.trim(), printSize: newLayoutSize }),
                })
                setNewLayoutName('')
                setShowLayoutCreate(false)
                fetchEventLayouts(event._id)
              }} className="mb-3 p-3 bg-gray-50 rounded-xl space-y-2">
                <input
                  value={newLayoutName} onChange={e => setNewLayoutName(e.target.value)}
                  placeholder="레이아웃 이름" required
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <div className="flex gap-2">
                  {(['4x6', '2x6', '6x4'] as const).map(s => (
                    <button key={s} type="button" onClick={() => setNewLayoutSize(s)}
                      className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition-colors ${newLayoutSize === s ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-500'}`}>
                      {s}
                    </button>
                  ))}
                </div>
                <UIButton type="submit" size="sm">생성</UIButton>
              </form>
            )}

            <div className="space-y-1">
              {layouts
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                .map((layout, idx, arr) => (
                <div
                  key={layout._id}
                  draggable
                  onDragStart={e => { setDragLayoutId(layout._id); e.dataTransfer.effectAllowed = 'move' }}
                  onDragOver={e => { e.preventDefault(); setDragOverLayoutId(layout._id) }}
                  onDragLeave={() => setDragOverLayoutId(null)}
                  onDrop={async (e) => {
                    e.preventDefault()
                    setDragOverLayoutId(null)
                    if (!dragLayoutId || dragLayoutId === layout._id) { setDragLayoutId(null); return }
                    const sorted = [...arr]
                    const fromIdx = sorted.findIndex(l => l._id === dragLayoutId)
                    const toIdx = sorted.findIndex(l => l._id === layout._id)
                    if (fromIdx < 0 || toIdx < 0) return
                    const [moved] = sorted.splice(fromIdx, 1)
                    sorted.splice(toIdx, 0, moved)
                    const reordered = sorted.map((l, i) => ({ ...l, order: i }))
                    setEventLayouts(prev => ({ ...prev, [event._id]: reordered }))
                    setDragLayoutId(null)
                    await fetch('/api/swit-layouts/reorder', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ orderedIds: reordered.map(l => l._id) }),
                    })
                  }}
                  onDragEnd={() => { setDragLayoutId(null); setDragOverLayoutId(null) }}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all ${
                    dragLayoutId === layout._id ? 'opacity-40 border-gray-200'
                    : dragOverLayoutId === layout._id ? 'border-blue-400 bg-blue-50/60'
                    : layout.visible === false ? 'border-transparent hover:border-gray-200 bg-gray-50 opacity-50'
                    : 'border-transparent hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {/* Drag handle */}
                  <div className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 shrink-0">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <circle cx="5" cy="3" r="1.5"/><circle cx="11" cy="3" r="1.5"/>
                      <circle cx="5" cy="8" r="1.5"/><circle cx="11" cy="8" r="1.5"/>
                      <circle cx="5" cy="13" r="1.5"/><circle cx="11" cy="13" r="1.5"/>
                    </svg>
                  </div>

                  {/* Click to edit */}
                  <a href={`/admin/layouts/${layout._id}/edit`} className="flex-1 min-w-0 cursor-pointer">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-gray-800 hover:text-blue-600 transition-colors">{layout.name}</span>
                      {layout.visible === false && (
                        <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">미노출</span>
                      )}
                      {layout.isPreset && (
                        <span className="text-[10px] font-semibold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">프리셋</span>
                      )}
                      {printerSupportedSizes && !printerSupportedSizes.includes(layout.printSize) && (
                        <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">프린터 미지원</span>
                      )}
                    </div>
                    <span className="text-[11px] text-gray-400">{layout.printSize} · {layout.slots.length}칸</span>
                  </a>

                  {/* Actions */}
                  <div className="flex gap-1 shrink-0">
                    <a href={`/admin/layouts/${layout._id}/edit`} onClick={e => e.stopPropagation()}
                      className="px-2 py-1 text-[11px] rounded-lg font-semibold bg-blue-500 text-white hover:bg-blue-600">편집</a>
                    <button onClick={async (e) => {
                      e.stopPropagation(); e.preventDefault()
                      const newVisible = layout.visible === false ? true : false
                      await fetch(`/api/swit-layouts/${layout._id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visible: newVisible }) })
                      fetchEventLayouts(event._id)
                    }} className={`px-2 py-1 text-[11px] rounded-lg font-semibold transition-colors ${
                      layout.visible === false ? 'bg-gray-200 text-gray-500 hover:bg-gray-300' : 'bg-green-50 text-green-600 hover:bg-green-100'
                    }`}>{layout.visible === false ? '미노출' : '노출'}</button>
                    <button onClick={async (e) => { e.stopPropagation(); e.preventDefault(); await fetch(`/api/swit-layouts/${layout._id}/duplicate`, { method: 'POST' }); fetchEventLayouts(event._id) }}
                      className="px-2 py-1 text-[11px] rounded-lg font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200">복제</button>
                    <button onClick={async (e) => {
                      e.stopPropagation(); e.preventDefault()
                      if (!confirm(`"${layout.name}" 삭제?`)) return
                      await fetch(`/api/swit-layouts/${layout._id}`, { method: 'DELETE' })
                      fetchEventLayouts(event._id)
                    }} className="px-2 py-1 text-[11px] rounded-lg font-semibold bg-red-50 text-red-500 hover:bg-red-100">삭제</button>
                  </div>
                </div>
              ))}
              {layouts.length === 0 && (
                <p className="text-xs text-gray-400 py-2">레이아웃이 없습니다</p>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-2">{layouts.length}개 레이아웃</p>
          </UICard>

          {/* Recent Print Jobs */}
          <UICard>
            <div className="flex items-center justify-between mb-3">
              <UISectionHeading title="최근 인쇄" subtitle={`총 ${recentPrintJobsTotal}건`} />
              {recentPrintJobs.length > 0 && (
                <UIButton variant="secondary" size="sm" onClick={() => viewPrintHistory(event)}>
                  전체 보기
                </UIButton>
              )}
            </div>
            {recentPrintJobs.length === 0 ? (
              <p className="text-xs text-gray-400 py-2">인쇄 기록이 없습니다</p>
            ) : (
              <div className="space-y-2">
                {recentPrintJobs.map(job => (
                  <div key={job._id} className="flex items-center gap-3 p-2 border rounded-lg">
                    <div
                      className="relative w-10 h-14 bg-gray-100 rounded flex-shrink-0 cursor-pointer overflow-hidden"
                      onClick={() => setSelectedImageForPreview(job.imageUrl)}
                    >
                      <Image src={job.imageUrl} alt="" fill className="object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <select
                          value={job.status}
                          onChange={async (e) => {
                            const newStatus = e.target.value
                            const res = await fetch(`/api/print-jobs/job/${job._id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ status: newStatus }),
                            })
                            if (res.ok) {
                              setRecentPrintJobs(prev => prev.map(j =>
                                j._id === job._id ? { ...j, status: newStatus as any } : j
                              ))
                            }
                          }}
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border-0 cursor-pointer ${
                            job.status === 'DONE' ? 'bg-green-100 text-green-700' :
                            job.status === 'PENDING' ? 'bg-blue-100 text-blue-700' :
                            'bg-red-100 text-red-700'
                          }`}
                        >
                          <option value="PENDING">대기</option>
                          <option value="DONE">완료</option>
                          <option value="FAILED">실패</option>
                        </select>
                        {job.printerName && (
                          <span className="text-[10px] text-gray-400">{job.printerName}</span>
                        )}
                        <button
                          onClick={() => {
                            window.open(`/result/${job._id}`, '_blank')
                          }}
                          className="text-[10px] text-blue-500 hover:text-blue-700 underline"
                        >
                          링크
                        </button>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {new Date(job.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
          {/* Options */}
          <div className="flex flex-wrap gap-4 mb-4 justify-center">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={qrPromoShowUrl}
                onChange={e => {
                  setQrPromoShowUrl(e.target.checked)
                  if (qrCodeUrl && selectedEvent) generateQR(selectedEvent, e.target.checked, qrPromoShowDonation)
                }}
                className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              URL 표시
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={qrPromoShowDonation}
                onChange={e => {
                  setQrPromoShowDonation(e.target.checked)
                  if (qrCodeUrl && selectedEvent) generateQR(selectedEvent, qrPromoShowUrl, e.target.checked)
                }}
                disabled={!selectedEvent?.donation?.enabled}
                className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 disabled:opacity-40"
              />
              <span className={!selectedEvent?.donation?.enabled ? 'text-gray-400' : ''}>
                후원계좌 표시{!selectedEvent?.donation?.enabled && ' (후원 미설정)'}
              </span>
            </label>
          </div>

          {generatingPromo ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
              <span className="ml-4 text-gray-600">홍보 이미지 생성 중...</span>
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
          <h3 className="text-2xl font-bold mb-4">Print History - {selectedEventForHistory.name} <span className="text-base font-normal text-gray-400">({printJobsTotal}건)</span></h3>
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <select
                          value={job.status}
                          onChange={async (e) => {
                            const newStatus = e.target.value
                            const res = await fetch(`/api/print-jobs/job/${job._id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ status: newStatus }),
                            })
                            if (res.ok) {
                              setPrintJobs(prev => prev.map(j =>
                                j._id === job._id ? { ...j, status: newStatus as any } : j
                              ))
                            }
                          }}
                          className={`text-xs font-semibold px-2 py-1 rounded-lg border-0 cursor-pointer ${
                            job.status === 'DONE' ? 'bg-green-100 text-green-700' :
                            job.status === 'PENDING' ? 'bg-blue-100 text-blue-700' :
                            'bg-red-100 text-red-700'
                          }`}
                        >
                          <option value="PENDING">대기</option>
                          <option value="DONE">완료</option>
                          <option value="FAILED">실패</option>
                        </select>
                        {job.printerName && (
                          <span className="text-xs text-gray-400">{job.printerName}</span>
                        )}
                        <span className="text-sm text-gray-600">
                          {new Date(job.createdAt).toLocaleString()}
                        </span>
                        <button
                          onClick={() => {
                            window.open(`/result/${job._id}`, '_blank')
                          }}
                          className="text-[11px] text-blue-500 hover:text-blue-700 underline"
                        >
                          결과 링크
                        </button>
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
          {printJobsTotalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                onClick={() => fetchPrintHistory(selectedEventForHistory, printJobsPage - 1)}
                disabled={printJobsPage <= 1}
                className="px-3 py-1 text-sm rounded border disabled:opacity-30 hover:bg-gray-100"
              >
                이전
              </button>
              <span className="text-sm text-gray-600">
                {printJobsPage} / {printJobsTotalPages}
              </span>
              <button
                onClick={() => fetchPrintHistory(selectedEventForHistory, printJobsPage + 1)}
                disabled={printJobsPage >= printJobsTotalPages}
                className="px-3 py-1 text-sm rounded border disabled:opacity-30 hover:bg-gray-100"
              >
                다음
              </button>
            </div>
          )}
          <UIButton variant="secondary" fullWidth onClick={() => setShowPrintHistory(false)} className="mt-4">
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
            <div className="flex items-center gap-3">
              <Image src="/logo-without-bg.png" alt="Photo Toast" width={40} height={40} />
              <h1 className="text-2xl font-bold text-gray-900">Photo Toast Admin</h1>
            </div>
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

        {/* Printer Management */}
        <UICard className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-900">프린터 관리</h2>
            <UIButton
              variant={showPrinterForm ? 'secondary' : 'primary'}
              size="sm"
              onClick={() => { setShowPrinterForm(!showPrinterForm); setEditingPrinter(null) }}
            >
              {showPrinterForm ? '취소' : '프린터 추가'}
            </UIButton>
          </div>

          {showPrinterForm && (
            <form onSubmit={handleCreatePrinter} className="mb-4 p-4 bg-gray-50 rounded-xl space-y-3">
              <UIFormField label="프린터 이름">
                <UITextInput
                  value={newPrinterName}
                  onChange={e => setNewPrinterName(e.target.value)}
                  placeholder="사무실 Epson L3150"
                  required
                />
              </UIFormField>
              <UIFormField label="인쇄 방식">
                <div className="flex gap-2">
                  {(['email', 'polling', 'epson_api'] as const).map(method => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setNewPrinterMethod(method)}
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
                        newPrinterMethod === method
                          ? 'bg-blue-500 text-white'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {method === 'email' ? '이메일' : method === 'polling' ? 'DB 폴링' : 'Epson API'}
                    </button>
                  ))}
                </div>
              </UIFormField>
              {newPrinterMethod === 'email' && (
                <UIFormField label="프린터 이메일" hint="Epson Connect 이메일 주소">
                  <UITextInput
                    type="email"
                    value={newPrinterEmail}
                    onChange={e => setNewPrinterEmail(e.target.value)}
                    placeholder="abc123@print.epsonconnect.com"
                    required
                  />
                </UIFormField>
              )}
              {newPrinterMethod === 'epson_api' && (
                <div className="space-y-3">
                  <UIFormField label="Client ID" hint="Epson Developer Portal에서 발급">
                    <UITextInput
                      value={newPrinterEpsonAuth.clientId || ''}
                      onChange={e => setNewPrinterEpsonAuth(prev => ({ ...prev, clientId: e.target.value }))}
                      placeholder="Client ID"
                      required
                    />
                  </UIFormField>
                  <UIFormField label="Client Secret">
                    <UITextInput
                      type="password"
                      value={newPrinterEpsonAuth.clientSecret || ''}
                      onChange={e => setNewPrinterEpsonAuth(prev => ({ ...prev, clientSecret: e.target.value }))}
                      placeholder="Client Secret"
                      required
                    />
                  </UIFormField>
                  <UIFormField label="프린터 이메일" hint="Epson Connect에 등록된 프린터 이메일">
                    <UITextInput
                      type="email"
                      value={newPrinterEpsonAuth.printerEmail || ''}
                      onChange={e => setNewPrinterEpsonAuth(prev => ({ ...prev, printerEmail: e.target.value }))}
                      placeholder="abc123@print.epsonconnect.com"
                      required
                    />
                  </UIFormField>
                </div>
              )}
              <UIFormField label="지원 규격">
                <div className="flex gap-2">
                  {['4x6', '2x6', '6x4'].map(size => (
                    <label key={size} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newPrinterSupportedSizes.includes(size)}
                        onChange={e => {
                          if (e.target.checked) setNewPrinterSupportedSizes(prev => [...prev, size])
                          else setNewPrinterSupportedSizes(prev => prev.filter(s => s !== size))
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{size}</span>
                    </label>
                  ))}
                </div>
              </UIFormField>
              <UIButton type="submit" size="sm">프린터 등록</UIButton>
            </form>
          )}

          {/* Printer Editing View */}
          {editingPrinter && (
            <div className="mb-4 p-4 bg-blue-50 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-800">{editingPrinter.name} 설정</h3>
                <button onClick={() => setEditingPrinter(null)} className="text-xs text-gray-400 hover:text-gray-600">닫기</button>
              </div>

              <UIFormField label="인쇄 방식">
                <div className="flex gap-2">
                  {(['email', 'polling', 'epson_api'] as const).map(method => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => handleUpdatePrinter(editingPrinter._id, { printMethod: method })}
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
                        editingPrinter.printMethod === method
                          ? 'bg-blue-500 text-white'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {method === 'email' ? '이메일' : method === 'polling' ? 'DB 폴링' : 'Epson API'}
                    </button>
                  ))}
                </div>
              </UIFormField>

              {editingPrinter.printMethod === 'email' && (
                <UIFormField label="프린터 이메일">
                  <UITextInput
                    type="email"
                    value={editingPrinter.email || ''}
                    onChange={e => handleUpdatePrinter(editingPrinter._id, { email: e.target.value })}
                    placeholder="abc123@print.epsonconnect.com"
                  />
                </UIFormField>
              )}

              {editingPrinter.printMethod === 'epson_api' && (
                <div className="space-y-3">
                  <UIFormField label="Client ID" hint="Epson Developer Portal에서 발급">
                    <UITextInput
                      defaultValue={editingPrinter.epsonAuth?.clientId || ''}
                      onBlur={e => {
                        const auth = editingPrinter.epsonAuth || { clientId: '', clientSecret: '', printerEmail: '' }
                        handleUpdatePrinter(editingPrinter._id, { epsonAuth: { ...auth, clientId: e.target.value } } as any)
                      }}
                      placeholder="Client ID"
                    />
                  </UIFormField>
                  <UIFormField label="Client Secret">
                    <UITextInput
                      type="password"
                      defaultValue={editingPrinter.epsonAuth?.clientSecret || ''}
                      onBlur={e => {
                        const auth = editingPrinter.epsonAuth || { clientId: '', clientSecret: '', printerEmail: '' }
                        handleUpdatePrinter(editingPrinter._id, { epsonAuth: { ...auth, clientSecret: e.target.value } } as any)
                      }}
                      placeholder="Client Secret"
                    />
                  </UIFormField>
                  <UIFormField label="프린터 이메일" hint="Epson Connect에 등록된 프린터 이메일">
                    <UITextInput
                      type="email"
                      defaultValue={editingPrinter.epsonAuth?.printerEmail || ''}
                      onBlur={e => {
                        const auth = editingPrinter.epsonAuth || { clientId: '', clientSecret: '', printerEmail: '' }
                        handleUpdatePrinter(editingPrinter._id, { epsonAuth: { ...auth, printerEmail: e.target.value } } as any)
                      }}
                      placeholder="abc123@print.epsonconnect.com"
                    />
                  </UIFormField>
                  {editingPrinter.epsonAuth?.accessToken && (
                    <div className="text-xs text-green-600 bg-green-50 px-3 py-2 rounded-lg">
                      인증됨 {editingPrinter.epsonAuth.tokenExpiresAt
                        ? `(만료: ${new Date(editingPrinter.epsonAuth.tokenExpiresAt).toLocaleString()})`
                        : ''}
                    </div>
                  )}
                </div>
              )}

              <UIFormField label="지원 규격">
                <div className="flex gap-2">
                  {['4x6', '2x6', '6x4'].map(size => (
                    <label key={size} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(editingPrinter.supportedSizes || []).includes(size)}
                        onChange={e => {
                          const current = editingPrinter.supportedSizes || []
                          const updated = e.target.checked
                            ? [...current, size]
                            : current.filter(s => s !== size)
                          handleUpdatePrinter(editingPrinter._id, { supportedSizes: updated } as any)
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{size}</span>
                    </label>
                  ))}
                </div>
              </UIFormField>

              {editingPrinter.printMethod === 'polling' && (
                <UIFormField label="API Key" hint="프린터 클라이언트 인증에 사용됩니다">
                  <div className="flex gap-2 items-center">
                    <code className="flex-1 bg-gray-100 px-3 py-2 rounded-lg text-xs font-mono text-gray-700 truncate select-all">
                      {editingPrinter.apiKey || '(미생성)'}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        if (editingPrinter.apiKey) {
                          navigator.clipboard.writeText(editingPrinter.apiKey)
                          alert('API Key가 복사되었습니다')
                        }
                      }}
                      className="text-xs bg-blue-100 text-blue-600 px-3 py-2 rounded-lg hover:bg-blue-200 whitespace-nowrap"
                    >
                      복사
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm('새 API Key를 생성하면 기존 키는 무효화됩니다. 계속할까요?')) {
                          await handleUpdatePrinter(editingPrinter._id, { regenerateApiKey: true } as any)
                        }
                      }}
                      className="text-xs bg-gray-100 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-200 whitespace-nowrap"
                    >
                      재생성
                    </button>
                  </div>
                </UIFormField>
              )}

              <UIFormField label="테두리 보정">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingPrinter.borderCorrectionEnabled}
                    onChange={e => handleUpdatePrinter(editingPrinter._id, { borderCorrectionEnabled: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">테두리 보정 적용</span>
                </label>
              </UIFormField>

              {editingPrinter.borderCorrectionEnabled && (
                <div className="space-y-4 pt-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm font-medium text-gray-700">축소 비율</label>
                      <span className="text-sm font-mono text-blue-600">{editingPrinter.shrinkPercent}%</span>
                    </div>
                    <input
                      type="range" min={85} max={100} step={0.25}
                      value={editingPrinter.shrinkPercent}
                      onChange={e => handleUpdatePrinter(editingPrinter._id, { shrinkPercent: parseFloat(e.target.value) })}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                      <span>85%</span><span>100% (보정 없음)</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm font-medium text-gray-700">세로 오프셋</label>
                      <span className="text-sm font-mono text-blue-600">{editingPrinter.verticalOffsetPx}px</span>
                    </div>
                    <input
                      type="range" min={-30} max={30} step={1}
                      value={editingPrinter.verticalOffsetPx}
                      onChange={e => handleUpdatePrinter(editingPrinter._id, { verticalOffsetPx: parseInt(e.target.value) })}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                      <span>-30px (위로)</span><span>+30px (아래로)</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <UIButton variant="secondary" size="sm"
                      onClick={() => handleUpdatePrinter(editingPrinter._id, { shrinkPercent: 97.5, verticalOffsetPx: 0 })}
                    >기본값 복원</UIButton>
                    <UIButton variant="primary" size="sm"
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/printers/${editingPrinter._id}/test-print`, { method: 'POST' })
                          const data = await res.json()
                          if (data.success) {
                            alert(`테스트 패턴 인쇄 완료!\n\nshrink: ${data.settings.shrinkPercent}%\noffset: ${data.settings.verticalOffsetPx}px`)
                          } else {
                            alert(`인쇄 실패: ${data.error || data.message}`)
                          }
                        } catch (err: any) {
                          alert(`오류: ${err.message}`)
                        }
                      }}
                    >테스트 패턴 인쇄</UIButton>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Printer List */}
          <div className="divide-y divide-gray-100">
            {printers.map(printer => (
              <div key={printer._id} className="flex items-center gap-3 py-3 px-1">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{printer.name}</span>
                    <UIBadge variant={printer.printMethod === 'polling' ? 'info' : 'default'}>
                      {printer.printMethod === 'email' ? '이메일' : printer.printMethod === 'epson_api' ? 'API' : '폴링'}
                    </UIBadge>
                  </div>
                  {printer.email && <p className="text-xs text-gray-400 mt-0.5">{printer.email}</p>}
                  {printer.supportedSizes && <p className="text-xs text-gray-400 mt-0.5">지원: {printer.supportedSizes.join(', ')}</p>}
                </div>
                <button
                  onClick={() => setEditingPrinter(editingPrinter?._id === printer._id ? null : printer)}
                  className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1"
                >
                  {editingPrinter?._id === printer._id ? '접기' : '설정'}
                </button>
                <button
                  onClick={() => handleDeletePrinter(printer._id)}
                  className="text-xs text-red-400 hover:text-red-600 px-2 py-1"
                >
                  삭제
                </button>
              </div>
            ))}
            {printers.length === 0 && (
              <p className="text-sm text-gray-400 py-4 text-center">등록된 프린터가 없습니다</p>
            )}
          </div>
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
              <UIFormField label="프린터">
                <select
                  value={newEventPrinterId}
                  onChange={e => setNewEventPrinterId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">나중에 설정</option>
                  {printers.map(p => (
                    <option key={p._id} value={p._id}>
                      {p.name} ({p.printMethod === 'email' ? '이메일' : p.printMethod === 'epson_api' ? 'API' : '폴링'})
                    </option>
                  ))}
                </select>
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
                      {(() => {
                        const printer = printers.find(p => p._id === event.printerId)
                        return printer
                          ? <UIBadge variant={printer.printMethod === 'polling' ? 'info' : 'default'}>{printer.name}</UIBadge>
                          : <UIBadge variant="error">프린터 없음</UIBadge>
                      })()}
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
