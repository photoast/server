'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import QRCode from 'qrcode'
import { logClientError } from '@/lib/errorLogger'
import { UIButton, UICard, UIFormField, UITextInput, UIStatusBanner, UIBadge, UISectionHeading } from '@/app/components/ui'

type PrintMethod = 'email' | 'polling' | 'epson_api'

interface EpsonApiAuth {
  apiKey: string
  accessToken: string
  refreshToken?: string
  clientId?: string
  clientSecret?: string
  tokenExpiresAt?: number
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
  lastSeen?: string
  statusInfo?: {
    online: boolean
    paperStatus?: 'ok' | 'low' | 'empty' | 'unknown'
    inkStatus?: 'ok' | 'low' | 'empty' | 'unknown'
    errorMessage?: string
    version?: string
  }
}

interface Event {
  _id: string
  name: string
  slug: string
  printerId?: string
  availableLayouts?: string[]
  price?: number
  authCodeRequired?: boolean
  paymentMethods?: ('card' | 'kakaopay' | 'naverpay')[]
  backgroundColors?: string[]
  logoUrl?: string
  contactPhone?: string
  donation?: {
    enabled: boolean
    bank: string
    account: string
    holder?: string
    message?: string
    link?: string
  }
  endedAt?: string | null
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
  orderNumber?: number
  eventId: string
  printerId?: string
  printerName?: string | null
  imageUrl: string
  printedImageUrl?: string
  createdAt: string
  status: 'PENDING' | 'PRINTING' | 'DONE' | 'FAILED'
  deviceInfo?: DeviceInfo
  errorMessage?: string
  authCode?: string
  layoutId?: string
  layoutName?: string
  paymentTid?: string
  paymentAmount?: number
  customerEmail?: string
  refunded?: boolean
}

function AdminPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
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
  const [detailJob, setDetailJob] = useState<PrintJob | null>(null)
  const [pageViewStats, setPageViewStats] = useState<{ total: number; today: number; daily: { date: string; count: number }[] } | null>(null)
  const [pageViewLogs, setPageViewLogs] = useState<{ _id: string; viewedAt: string; deviceId: string | null; userAgent: string | null; referrer: string | null }[]>([])
  const [pageViewLogsPage, setPageViewLogsPage] = useState(1)
  const [pageViewLogsTotalPages, setPageViewLogsTotalPages] = useState(1)
  const [showPageViewLogs, setShowPageViewLogs] = useState(false)

  // DB stats
  const [dbStats, setDbStats] = useState<{
    totalSizeMB: number
    dataSizeMB: number
    indexSizeMB: number
    maxSizeMB: number
    usagePercent: number
    collectionCount: number
    objectCount: number
    collections: { name: string; sizeMB: number; count: number; storageSizeMB: number; indexSizeMB: number }[]
  } | null>(null)
  const [showDbDetail, setShowDbDetail] = useState(false)
  const [dbStatsLoading, setDbStatsLoading] = useState(false)

  // Vercel Blob storage stats
  const [blobStats, setBlobStats] = useState<{
    totalSizeMB: number
    blobCount: number
    maxSizeMB: number
    usagePercent: number
    byExtension: Record<string, { count: number; sizeMB: number }>
    configured: boolean
    error?: string
  } | null>(null)
  const [blobStatsLoading, setBlobStatsLoading] = useState(false)

  // Event editing states
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<'name' | 'slug' | null>(null)
  const [tempValue, setTempValue] = useState('')

  // Sticker management
  const [stickers, setStickers] = useState<{ _id: string; url: string; filename: string }[]>([])
  const [stickerUploading, setStickerUploading] = useState(false)

  // Auth codes
  const [authCodes, setAuthCodes] = useState<{ _id: string; code: string; used: boolean; usedAt?: string; printJobId?: string; createdAt: string }[]>([])
  const [authCodeCount, setAuthCodeCount] = useState(10)
  const [authCodeGenerating, setAuthCodeGenerating] = useState(false)

  // Event layouts (FrameLayout-based)
  const [eventLayouts, setEventLayouts] = useState<Record<string, { _id: string; name: string; printSize: string; slots: any[]; isPreset?: boolean; order?: number; visible?: boolean; price?: number }[]>>({})
  const [dragLayoutId, setDragLayoutId] = useState<string | null>(null)
  const [dragOverLayoutId, setDragOverLayoutId] = useState<string | null>(null)
  const [showLayoutCreate, setShowLayoutCreate] = useState(false)
  const [newLayoutName, setNewLayoutName] = useState('')
  const [newLayoutSize, setNewLayoutSize] = useState<'4x6' | '2x6' | '6x4'>('4x6')

  useEffect(() => {
    checkAuth()
  }, [])

  // Keep detailEvent in sync with events list & restore from URL
  useEffect(() => {
    if (detailEvent) {
      const updated = events.find(e => e._id === detailEvent._id)
      if (updated) setDetailEvent(updated)
    } else if (events.length > 0) {
      const eventId = searchParams.get('event')
      if (eventId) {
        const found = events.find(e => e._id === eventId)
        if (found) setDetailEvent(found)
      }
    }
  }, [events])

  const selectEvent = useCallback((event: Event | null) => {
    setDetailEvent(event)
    if (event) {
      router.replace(`/admin?event=${event._id}`, { scroll: false })
    } else {
      router.replace('/admin', { scroll: false })
    }
  }, [router])

  // Fetch recent print jobs + page views for detail event
  useEffect(() => {
    if (!detailEvent) { setRecentPrintJobs([]); setPageViewStats(null); return }
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
    const fetchPageViews = async () => {
      try {
        const res = await fetch(`/api/page-views?slug=${detailEvent.slug}`)
        if (res.ok) setPageViewStats(await res.json())
      } catch {}
    }
    fetchRecent()
    fetchPageViews()
    setShowPageViewLogs(false)
    setPageViewLogs([])
    setPageViewLogsPage(1)
    if (detailEvent?.authCodeRequired) fetchAuthCodes(detailEvent._id)
  }, [detailEvent?._id])

  const fetchPageViewLogs = async (page = 1) => {
    if (!detailEvent) return
    try {
      const res = await fetch(`/api/page-views?slug=${detailEvent.slug}&mode=logs&page=${page}`)
      if (res.ok) {
        const data = await res.json()
        setPageViewLogs(data.logs)
        setPageViewLogsPage(data.page)
        setPageViewLogsTotalPages(data.totalPages)
      }
    } catch {}
  }

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/events')
      if (res.ok) {
        setAuthenticated(true)
        fetchEvents()
        fetchPrinters()
        fetchDbStats()
        fetchStorageStats()
      }
    } catch (err) {
      // Not authenticated
    }
  }

  const fetchDbStats = async () => {
    setDbStatsLoading(true)
    try {
      const res = await fetch('/api/system/db-stats')
      if (res.ok) setDbStats(await res.json())
    } catch {}
    setDbStatsLoading(false)
  }

  const fetchStorageStats = async () => {
    setBlobStatsLoading(true)
    try {
      const res = await fetch('/api/system/storage-stats')
      if (res.ok) setBlobStats(await res.json())
    } catch {}
    setBlobStatsLoading(false)
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

  const fetchAuthCodes = async (eventId: string) => {
    try {
      const res = await fetch(`/api/auth-codes?eventId=${eventId}`)
      if (res.ok) setAuthCodes(await res.json())
    } catch {}
  }

  const handleGenerateAuthCodes = async (eventId: string, count: number) => {
    setAuthCodeGenerating(true)
    try {
      const res = await fetch('/api/auth-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, count }),
      })
      if (res.ok) fetchAuthCodes(eventId)
    } catch (err) {
      console.error('Failed to generate auth codes:', err)
    } finally {
      setAuthCodeGenerating(false)
    }
  }

  const handleDeleteAllAuthCodes = async (eventId: string) => {
    if (!confirm('미사용 코드를 포함한 모든 인증코드를 삭제합니다. 계속하시겠습니까?')) return
    try {
      await fetch(`/api/auth-codes?eventId=${eventId}`, { method: 'DELETE' })
      setAuthCodes([])
    } catch {}
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
      const res = await fetch(`/api/layouts?eventId=${eventId}`)
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

  const handleUpdateEvent = async (eventId: string, updates: { name?: string; slug?: string; printerId?: string; availableLayouts?: string[]; price?: number; paymentMethods?: ('card' | 'kakaopay' | 'naverpay')[]; backgroundColors?: string[]; donation?: Event['donation']; logoUrl?: string; contactPhone?: string }) => {
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

      const loadImg = (src: string): Promise<HTMLImageElement | null> =>
        new Promise(resolve => {
          const img = document.createElement('img')
          img.crossOrigin = 'anonymous'
          img.onload = () => resolve(img)
          img.onerror = () => resolve(null)
          img.src = src
        })

      const [qrImage, logoImage] = await Promise.all([
        loadImg(qrDataUrl),
        loadImg(event.logoUrl || '/logo-without-bg.png'),
      ])
      if (!qrImage) throw new Error('QR 이미지 로드 실패')

      const font = '"Pretendard Variable", Pretendard, -apple-system, "Noto Sans KR", sans-serif'

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
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, W, H)

      // ── Subtle top line accent
      ctx.fillStyle = '#111111'
      ctx.fillRect(0, 0, W, 6)

      const hasDonation = showDonation && event.donation?.enabled && event.donation.account

      // ── Event name (top area)
      let y = 160
      ctx.fillStyle = '#111111'
      ctx.font = `700 88px ${font}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(event.name, W / 2, y)

      // ── Subtitle
      y += 80
      ctx.fillStyle = '#666666'
      ctx.font = `500 42px ${font}`
      ctx.fillText('특별한 순간을 사진으로 남기세요', W / 2, y)

      // ── Badge
      y += 72
      const badgeH = 64
      const badgeText = '즉석 포토 프린트'
      ctx.font = `700 34px ${font}`
      const badgeW = ctx.measureText(badgeText).width + 64
      const badgeX = (W - badgeW) / 2
      roundRect(badgeX, y - badgeH / 2, badgeW, badgeH, badgeH / 2)
      ctx.fillStyle = '#111111'
      ctx.fill()
      ctx.fillStyle = '#FFFFFF'
      ctx.fillText(badgeText, W / 2, y)

      // ── "한정판 프레임" tag
      y += 60
      ctx.fillStyle = '#999999'
      ctx.font = `500 32px ${font}`
      ctx.fillText('한정판 프레임으로 특별하게', W / 2, y)

      // ── QR code area
      const qrSize = 620
      const qrPad = 36
      y += 56
      const qrX = (W - qrSize) / 2
      const qrY = y

      // QR card with subtle shadow
      ctx.save()
      ctx.shadowColor = 'rgba(0, 0, 0, 0.06)'
      ctx.shadowBlur = 40
      ctx.shadowOffsetY = 8
      roundRect(qrX - qrPad, qrY - qrPad, qrSize + qrPad * 2, qrSize + qrPad * 2, 24)
      ctx.fillStyle = '#FFFFFF'
      ctx.fill()
      ctx.strokeStyle = '#E5E5E5'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.restore()

      // QR code
      ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize)

      // Logo in center of QR (circular, clipped)
      if (logoImage) {
        const logoSize = 110
        const logoPad = 14
        const cx = qrX + qrSize / 2
        const cy = qrY + qrSize / 2
        const radius = logoSize / 2
        // White circle background
        ctx.fillStyle = '#FFFFFF'
        ctx.beginPath()
        ctx.arc(cx, cy, radius + logoPad, 0, Math.PI * 2)
        ctx.fill()
        // Clip logo to circle
        ctx.save()
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        ctx.clip()
        ctx.drawImage(logoImage, cx - radius, cy - radius, logoSize, logoSize)
        ctx.restore()
      }

      // ── Scan instruction
      y = qrY + qrSize + qrPad + 56
      ctx.fillStyle = '#111111'
      ctx.font = `600 44px ${font}`
      ctx.textAlign = 'center'
      ctx.fillText('QR 코드를 스캔하세요', W / 2, y)

      // ── URL display
      if (showUrl) {
        y += 54
        const eventUrl = `${window.location.host}/${event.slug}`
        ctx.fillStyle = '#AAAAAA'
        ctx.font = `400 36px ${font}`
        ctx.fillText(eventUrl, W / 2, y)
      }

      // ── Steps
      y += 80
      const steps = ['QR 스캔 후 프레임 선택', '사진을 올리고 편집', '결제 후 인쇄']
      const stepGap = 72

      steps.forEach((text, i) => {
        const sy = y + i * stepGap
        const numX = 160

        ctx.fillStyle = '#111111'
        ctx.font = `700 28px ${font}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(i + 1), numX, sy)

        // Circle outline
        ctx.beginPath()
        ctx.arc(numX, sy, 22, 0, Math.PI * 2)
        ctx.strokeStyle = '#DDDDDD'
        ctx.lineWidth = 1.5
        ctx.stroke()

        ctx.fillStyle = '#333333'
        ctx.font = `500 38px ${font}`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(text, numX + 40, sy)
      })

      // ── Donation info
      if (hasDonation) {
        const don = event.donation!
        const donText = `후원계좌  ${don.bank || ''} ${don.account}${don.holder ? ` (${don.holder})` : ''}`
        const boxW = W - 160
        const boxX = 80
        const boxH = 72
        const boxY = H - 110 - boxH
        roundRect(boxX, boxY, boxW, boxH, 12)
        ctx.fillStyle = '#F9F9F9'
        ctx.fill()
        ctx.strokeStyle = '#E5E5E5'
        ctx.lineWidth = 1
        ctx.stroke()

        ctx.fillStyle = '#666666'
        ctx.font = `500 28px ${font}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(donText, W / 2, boxY + boxH / 2)
      }

      // ── Contact phone
      if (event.contactPhone) {
        const contactY = hasDonation ? H - 110 - 72 - 60 : H - 110
        ctx.fillStyle = '#888888'
        ctx.font = `500 30px ${font}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(`문의 ${event.contactPhone}`, W / 2, contactY)
      }

      // ── Bottom
      ctx.fillStyle = '#CCCCCC'
      ctx.font = `400 22px ${font}`
      ctx.textAlign = 'center'
      ctx.fillText('Photo Toast', W / 2, H - 40)
      ctx.fillStyle = '#111111'
      ctx.fillRect(0, H - 6, W, 6)

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
              onClick={() => { selectEvent(null); setEditingEventId(null); setEditingField(null) }}
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
            <UIButton size="sm" variant="secondary" onClick={() => window.open(`/admin/user-events?slug=${event.slug}`, '_blank')}>사용자 통계</UIButton>
            <UIButton size="sm" variant="secondary" onClick={async () => {
              const isEnded = !!event.endedAt
              if (!isEnded && !confirm(`"${event.name}" 이벤트를 종료하시겠어요?\n유저가 접속하면 종료 안내가 표시됩니다.`)) return
              try {
                const res = await fetch(`/api/events/${event._id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ endedAt: isEnded ? null : new Date().toISOString() }),
                })
                if (!res.ok) throw new Error('변경 실패')
                fetchEvents()
              } catch (err: any) {
                setError(err.message)
              }
            }} className={event.endedAt ? '!text-green-600' : '!text-orange-500'}>{event.endedAt ? '재개' : '종료'}</UIButton>
            <UIButton size="sm" variant="secondary" onClick={async () => {
              if (!confirm(`"${event.name}" 이벤트를 삭제하시겠어요?\n연관된 인쇄 기록과 레이아웃도 모두 삭제됩니다.`)) return
              try {
                const res = await fetch(`/api/events/${event._id}`, { method: 'DELETE' })
                if (!res.ok) throw new Error('삭제 실패')
                selectEvent(null)
                fetchEvents()
              } catch (err: any) {
                setError(err.message || '이벤트 삭제 실패')
              }
            }} className="!text-red-500 !hover:bg-red-50">삭제</UIButton>
          </div>

          {/* Page View Stats */}
          {pageViewStats && (
            <UICard>
              <UIFormField label="페이지 접속 통계">
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="flex-1 bg-blue-50 rounded-xl p-3 text-center">
                      <div className="text-2xl font-bold text-blue-700">{pageViewStats.today}</div>
                      <div className="text-xs text-blue-500 mt-0.5">오늘</div>
                    </div>
                    <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
                      <div className="text-2xl font-bold text-gray-700">{pageViewStats.total.toLocaleString()}</div>
                      <div className="text-xs text-gray-500 mt-0.5">전체</div>
                    </div>
                  </div>
                  {pageViewStats.daily.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs text-gray-400 font-medium">최근 7일</p>
                      <div className="flex items-end gap-1 h-16">
                        {pageViewStats.daily.map(d => {
                          const max = Math.max(...pageViewStats.daily.map(x => x.count), 1)
                          const pct = (d.count / max) * 100
                          return (
                            <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5">
                              <span className="text-[10px] text-gray-500 font-medium">{d.count}</span>
                              <div
                                className="w-full bg-blue-400 rounded-t"
                                style={{ height: `${Math.max(pct, 4)}%` }}
                              />
                              <span className="text-[9px] text-gray-400">{d.date.slice(5)}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </UIFormField>
              <button
                className="text-xs text-blue-500 underline mt-1"
                onClick={() => {
                  if (!showPageViewLogs) fetchPageViewLogs(1)
                  setShowPageViewLogs(!showPageViewLogs)
                }}
              >
                {showPageViewLogs ? '접속 로그 닫기' : '상세 접속 로그 보기'}
              </button>
              {showPageViewLogs && (
                <div className="mt-3 space-y-2">
                  {pageViewLogs.length === 0 ? (
                    <p className="text-xs text-gray-400">로그가 없습니다</p>
                  ) : (
                    <>
                      <div className="max-h-80 overflow-y-auto space-y-1.5">
                        {pageViewLogs.map(log => {
                          const ua = log.userAgent || ''
                          let device = 'Unknown'
                          if (/iPhone/i.test(ua)) device = 'iPhone'
                          else if (/Android/i.test(ua)) device = 'Android'
                          else if (/iPad/i.test(ua)) device = 'iPad'
                          else if (/Mac/i.test(ua)) device = 'Mac'
                          else if (/Windows/i.test(ua)) device = 'Windows'
                          else if (ua) device = 'Other'
                          return (
                            <div key={log._id} className="bg-gray-50 rounded-lg p-2 text-xs space-y-0.5">
                              <div className="flex justify-between items-center">
                                <span className="font-medium text-gray-700">{device}</span>
                                <span className="text-gray-400">{new Date(log.viewedAt).toLocaleString('ko-KR')}</span>
                              </div>
                              {log.deviceId && (
                                <a
                                  href={`/admin/user-events?deviceId=${log.deviceId}`}
                                  target="_blank"
                                  className="text-blue-500 hover:text-blue-600 truncate block"
                                >ID: {log.deviceId.slice(0, 8)}... →</a>
                              )}
                              {log.referrer && (
                                <div className="text-gray-400 truncate">출처: {log.referrer}</div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      {pageViewLogsTotalPages > 1 && (
                        <div className="flex justify-center gap-2 pt-1">
                          <button
                            className="text-xs px-2 py-1 rounded bg-gray-200 disabled:opacity-40"
                            disabled={pageViewLogsPage <= 1}
                            onClick={() => fetchPageViewLogs(pageViewLogsPage - 1)}
                          >이전</button>
                          <span className="text-xs text-gray-500">{pageViewLogsPage} / {pageViewLogsTotalPages}</span>
                          <button
                            className="text-xs px-2 py-1 rounded bg-gray-200 disabled:opacity-40"
                            disabled={pageViewLogsPage >= pageViewLogsTotalPages}
                            onClick={() => fetchPageViewLogs(pageViewLogsPage + 1)}
                          >다음</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </UICard>
          )}

          {/* Logo */}
          <UICard>
            <UIFormField label="이벤트 로고" hint="사용자 페이지 상단에 표시됩니다. 미등록 시 기본 로고 사용">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl border border-gray-200 overflow-hidden flex-shrink-0 bg-gray-50 flex items-center justify-center">
                  {event.logoUrl ? (
                    <img src={event.logoUrl} alt="로고" className="w-full h-full object-contain" />
                  ) : (
                    <img src="/logo-without-bg.png" alt="기본 로고" className="w-8 h-8 opacity-40" />
                  )}
                </div>
                <div className="flex gap-2">
                  <label className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
                    {event.logoUrl ? '변경' : '업로드'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        try {
                          const formData = new FormData()
                          formData.append('file', file)
                          formData.append('type', 'logo')
                          const res = await fetch('/api/upload', { method: 'POST', body: formData })
                          if (!res.ok) throw new Error('업로드 실패')
                          const { url } = await res.json()
                          await handleUpdateEvent(event._id, { logoUrl: url })
                        } catch (err: any) {
                          setError(err.message || '로고 업로드 실패')
                        }
                        e.target.value = ''
                      }}
                    />
                  </label>
                  {event.logoUrl && (
                    <button
                      onClick={() => handleUpdateEvent(event._id, { logoUrl: '' })}
                      className="px-3 py-1.5 text-xs font-semibold text-red-500 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      제거
                    </button>
                  )}
                </div>
              </div>
            </UIFormField>

            <UIFormField label="문의 연락처" hint="QR 홍보 이미지 하단에 표시됩니다">
              <input
                type="tel"
                value={event.contactPhone || ''}
                onChange={e => handleUpdateEvent(event._id, { contactPhone: e.target.value })}
                placeholder="010-0000-0000"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </UIFormField>
          </UICard>

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
                    {printer.printMethod === 'polling' && (() => {
                      const isOnline = printer.lastSeen && (Date.now() - new Date(printer.lastSeen).getTime()) < 60000
                      return <UIBadge variant={isOnline ? 'success' : 'error'}>{isOnline ? '온라인' : '오프라인'}</UIBadge>
                    })()}
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

          {/* Payment Methods */}
          <UICard>
            <UIFormField label="결제 방식" hint="선택한 방식만 결제창에 표시됩니다">
              <div className="space-y-3">
                {([
                  { key: 'card' as const, label: '카드결제' },
                  { key: 'kakaopay' as const, label: '카카오페이머니' },
                  { key: 'naverpay' as const, label: '네이버페이머니' },
                ]).map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(event.paymentMethods ?? []).includes(key)}
                      onChange={e => {
                        const methods = new Set(event.paymentMethods ?? [])
                        e.target.checked ? methods.add(key) : methods.delete(key)
                        handleUpdateEvent(event._id, { paymentMethods: Array.from(methods) })
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{label}</span>
                  </label>
                ))}
                {(event.paymentMethods ?? []).length === 0 && <UIBadge variant="success">전체 허용</UIBadge>}

                {event.authCodeRequired && (
                  <div className="space-y-3 pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <UITextInput
                        type="number"
                        min={1}
                        max={500}
                        value={authCodeCount}
                        onChange={e => setAuthCodeCount(parseInt(e.target.value) || 10)}
                        className="w-20"
                      />
                      <span className="text-sm text-gray-600">개</span>
                      <UIButton
                        size="sm"
                        onClick={() => handleGenerateAuthCodes(event._id, authCodeCount)}
                        disabled={authCodeGenerating}
                      >
                        {authCodeGenerating ? '생성 중...' : '인증코드 발급'}
                      </UIButton>
                      {authCodes.length > 0 && (
                        <UIButton variant="danger" size="sm" onClick={() => handleDeleteAllAuthCodes(event._id)}>
                          전체 삭제
                        </UIButton>
                      )}
                    </div>

                    {authCodes.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span>총 {authCodes.length}개</span>
                          <span>|</span>
                          <span className="text-green-600">사용가능 {authCodes.filter(c => !c.used).length}개</span>
                          <span>|</span>
                          <span className="text-red-500">사용됨 {authCodes.filter(c => c.used).length}개</span>
                        </div>
                        <div className="max-h-48 overflow-y-auto border rounded-lg">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50 sticky top-0">
                              <tr>
                                <th className="px-3 py-1.5 text-left font-medium text-gray-600">코드</th>
                                <th className="px-3 py-1.5 text-left font-medium text-gray-600">상태</th>
                                <th className="px-3 py-1.5 text-left font-medium text-gray-600">사용일시</th>
                                <th className="px-3 py-1.5 text-left font-medium text-gray-600">인쇄</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {authCodes.map(ac => (
                                <tr key={ac._id} className={ac.used ? 'bg-red-50' : ''}>
                                  <td className="px-3 py-1.5 font-mono font-bold tracking-wider">{ac.code}</td>
                                  <td className="px-3 py-1.5">
                                    {ac.used
                                      ? <UIBadge variant="error">사용됨</UIBadge>
                                      : <UIBadge variant="success">사용가능</UIBadge>}
                                  </td>
                                  <td className="px-3 py-1.5 text-gray-500">
                                    {ac.usedAt ? new Date(ac.usedAt).toLocaleString('ko-KR') : '-'}
                                  </td>
                                  <td className="px-3 py-1.5 text-gray-500">
                                    {ac.printJobId
                                      ? <button onClick={() => { setSelectedEventForHistory(event); setShowPrintHistory(true) }} className="text-blue-500 hover:underline text-xs">보기</button>
                                      : '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
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
                await fetch('/api/layouts', {
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
                    await fetch('/api/layouts/reorder', {
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
                      <span
                        className="text-sm font-semibold text-gray-800 hover:text-blue-600 transition-colors cursor-pointer"
                        onClick={e => {
                          e.stopPropagation()
                          e.preventDefault()
                          const newName = prompt('레이아웃 이름 변경', layout.name)
                          if (!newName || !newName.trim() || newName.trim() === layout.name) return
                          fetch(`/api/layouts/${layout._id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name: newName.trim() }),
                          }).then(() => fetchEventLayouts(event._id))
                        }}
                        title="클릭하여 이름 변경"
                      >{layout.name}</span>
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
                    <span className="text-[11px] text-gray-400">
                      {layout.printSize} · {layout.slots.length}칸 · <span
                        className="cursor-pointer hover:text-blue-500"
                        onClick={e => {
                          e.stopPropagation()
                          e.preventDefault()
                          const newPrice = prompt('레이아웃 가격 (원)\n비워두면 이벤트 기본 가격 사용', layout.price != null ? String(layout.price) : '')
                          if (newPrice === null) return
                          const price = newPrice.trim() === '' ? null : Number(newPrice)
                          if (price !== null && isNaN(price)) return
                          fetch(`/api/layouts/${layout._id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ price: price ?? undefined }),
                          }).then(() => fetchEventLayouts(event._id))
                        }}
                      >{layout.price != null ? `${layout.price.toLocaleString()}원` : '가격 미설정'}</span>
                    </span>
                  </a>

                  {/* Actions */}
                  <div className="flex gap-1 shrink-0">
                    <a href={`/admin/layouts/${layout._id}/edit`} onClick={e => e.stopPropagation()}
                      className="px-2 py-1 text-[11px] rounded-lg font-semibold bg-blue-500 text-white hover:bg-blue-600">편집</a>
                    <button onClick={async (e) => {
                      e.stopPropagation(); e.preventDefault()
                      const newVisible = layout.visible === false ? true : false
                      await fetch(`/api/layouts/${layout._id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visible: newVisible }) })
                      fetchEventLayouts(event._id)
                    }} className={`px-2 py-1 text-[11px] rounded-lg font-semibold transition-colors ${
                      layout.visible === false ? 'bg-gray-200 text-gray-500 hover:bg-gray-300' : 'bg-green-50 text-green-600 hover:bg-green-100'
                    }`}>{layout.visible === false ? '미노출' : '노출'}</button>
                    <button onClick={async (e) => { e.stopPropagation(); e.preventDefault(); await fetch(`/api/layouts/${layout._id}/duplicate`, { method: 'POST' }); fetchEventLayouts(event._id) }}
                      className="px-2 py-1 text-[11px] rounded-lg font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200">복제</button>
                    <button onClick={async (e) => {
                      e.stopPropagation(); e.preventDefault()
                      if (!confirm(`"${layout.name}" 삭제?`)) return
                      await fetch(`/api/layouts/${layout._id}`, { method: 'DELETE' })
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
                            job.status === 'PRINTING' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}
                        >
                          <option value="PENDING">대기</option>
                          <option value="PRINTING">인쇄중</option>
                          <option value="DONE">완료</option>
                          <option value="FAILED">실패</option>
                        </select>
                        {job.orderNumber != null && (
                          <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1 rounded">#{job.orderNumber}</span>
                        )}
                        {job.printerName && (
                          <span className="text-[10px] text-gray-400">{job.printerName}</span>
                        )}
                        {(job.layoutName || job.layoutId) && (
                          <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1 rounded">{job.layoutName || job.layoutId?.slice(-6)}</span>
                        )}
                        {job.authCode && (
                          <span className="text-[10px] font-mono bg-purple-100 text-purple-700 px-1 rounded">{job.authCode}</span>
                        )}
                        {job.customerEmail && (
                          <span className="text-[10px] text-gray-400">{job.customerEmail}</span>
                        )}
                        {job.refunded && (
                          <span className="text-[10px] font-semibold bg-red-100 text-red-600 px-1 rounded">취소됨</span>
                        )}
                        <button
                          onClick={() => setDetailJob(job)}
                          className="text-[10px] text-blue-500 hover:text-blue-700 underline"
                        >
                          상세
                        </button>
                        {job.paymentTid && !job.refunded && (
                          <button
                            onClick={async () => {
                              if (!confirm('결제를 취소하시겠습니까?')) return
                              const res = await fetch('/api/payment/cancel', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ printJobId: job._id }),
                              })
                              if (res.ok) {
                                setRecentPrintJobs(prev => prev.map(j =>
                                  j._id === job._id ? { ...j, refunded: true } : j
                                ))
                              } else {
                                const data = await res.json()
                                alert(data.error || '취소 실패')
                              }
                            }}
                            className="text-[10px] text-red-500 hover:text-red-700 underline"
                          >
                            결제취소
                          </button>
                        )}
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

        {/* ===== Modals (QR, Print History, Image Preview, Job Detail) ===== */}
        {renderQRModal()}
        {renderPrintHistoryModal()}
        {renderImagePreviewModal()}
        {renderJobDetailModal()}
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
                            job.status === 'PRINTING' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}
                        >
                          <option value="PENDING">대기</option>
                          <option value="PRINTING">인쇄중</option>
                          <option value="DONE">완료</option>
                          <option value="FAILED">실패</option>
                        </select>
                        {job.orderNumber != null && (
                          <span className="text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">#{job.orderNumber}</span>
                        )}
                        {job.printerName && (
                          <span className="text-xs text-gray-400">{job.printerName}</span>
                        )}
                        {(job.layoutName || job.layoutId) && (
                          <span className="text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded">레이아웃: {job.layoutName || job.layoutId?.slice(-6)}</span>
                        )}
                        {job.authCode && (
                          <span className="text-xs font-mono bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">인증코드: {job.authCode}</span>
                        )}
                        {job.customerEmail && (
                          <span className="text-xs text-gray-400">{job.customerEmail}</span>
                        )}
                        {job.refunded && (
                          <span className="text-xs font-semibold bg-red-100 text-red-600 px-1.5 py-0.5 rounded">취소됨</span>
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
                        {job.paymentTid && !job.refunded && (
                          <button
                            onClick={async () => {
                              if (!confirm('결제를 취소하시겠습니까?')) return
                              const res = await fetch('/api/payment/cancel', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ printJobId: job._id }),
                              })
                              if (res.ok) {
                                setPrintJobs(prev => prev.map(j =>
                                  j._id === job._id ? { ...j, refunded: true } : j
                                ))
                              } else {
                                const data = await res.json()
                                alert(data.error || '취소 실패')
                              }
                            }}
                            className="text-[11px] text-red-500 hover:text-red-700 underline"
                          >
                            결제취소
                          </button>
                        )}
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

  function renderJobDetailModal() {
    if (!detailJob) return null
    const job = detailJob
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setDetailJob(null)}>
        <div className="bg-white rounded-2xl max-w-md w-full max-h-[85vh] overflow-y-auto p-5 space-y-4" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-lg">인쇄 상세</h3>
            <button onClick={() => setDetailJob(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
          </div>

          {/* Image */}
          {job.imageUrl && (
            <div className="rounded-xl overflow-hidden border border-gray-100">
              <img src={job.imageUrl} alt="인쇄 이미지" className="w-full" />
            </div>
          )}

          {/* Info table */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-gray-400">인쇄번호</div>
            <div className="font-mono font-semibold">#{job.orderNumber || '-'}</div>

            <div className="text-gray-400">상태</div>
            <div>
              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                job.status === 'DONE' ? 'bg-green-100 text-green-700' :
                job.status === 'PENDING' ? 'bg-blue-100 text-blue-700' :
                job.status === 'PRINTING' ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }`}>{job.status === 'PRINTING' ? '인쇄중' : job.status}</span>
              {job.refunded && <span className="ml-1 px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-700">환불</span>}
            </div>

            <div className="text-gray-400">생성일</div>
            <div>{new Date(job.createdAt).toLocaleString('ko-KR')}</div>

            {job.layoutName && <>
              <div className="text-gray-400">레이아웃</div>
              <div>{job.layoutName}</div>
            </>}

            {job.printerName && <>
              <div className="text-gray-400">프린터</div>
              <div>{job.printerName}</div>
            </>}

            {job.customerEmail && <>
              <div className="text-gray-400">고객 이메일</div>
              <div>{job.customerEmail}</div>
            </>}

            {job.authCode && <>
              <div className="text-gray-400">인증코드</div>
              <div className="font-mono">{job.authCode}</div>
            </>}

            {job.paymentTid && <>
              <div className="text-gray-400">결제 TID</div>
              <div className="font-mono text-xs break-all">{job.paymentTid}</div>
            </>}

            {job.paymentAmount != null && <>
              <div className="text-gray-400">결제 금액</div>
              <div>{job.paymentAmount.toLocaleString()}원</div>
            </>}

            {job.errorMessage && <>
              <div className="text-gray-400">에러</div>
              <div className="text-red-600 text-xs">{job.errorMessage}</div>
            </>}

            {job.deviceInfo && <>
              <div className="text-gray-400">디바이스</div>
              <div className="text-xs text-gray-500">{job.deviceInfo.os} · {job.deviceInfo.browser}</div>
            </>}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => window.open(`/result/${job._id}`, '_blank')}
              className="flex-1 py-2 text-sm rounded-xl bg-blue-500 text-white font-semibold hover:bg-blue-600"
            >
              결과 페이지
            </button>
            {job.paymentTid && !job.refunded && (
              <button
                onClick={async () => {
                  if (!confirm('결제를 취소하시겠습니까?')) return
                  const res = await fetch('/api/payment/cancel', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-admin': '1' },
                    body: JSON.stringify({ printJobId: job._id }),
                  })
                  if (res.ok) { alert('취소 완료'); setDetailJob(null) }
                  else { const d = await res.json(); alert(d.error || '취소 실패') }
                }}
                className="flex-1 py-2 text-sm rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600"
              >
                결제 취소
              </button>
            )}
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

        {/* Quick links */}
        <div className="mb-6 flex flex-wrap gap-2">
          <a
            href="/admin/customers"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            고객 관리
          </a>
          <a
            href="/admin/storage"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            스토리지 관리
          </a>
        </div>

        {error && <div className="mb-6"><UIStatusBanner type="error" message={error} /></div>}

        {/* DB Storage Usage */}
        <UICard className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900">🗄️ DB 사용량</h2>
            {dbStatsLoading && (
              <div className="w-4 h-4 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
            )}
          </div>
          {dbStats ? (
            <div className="space-y-3">
              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">
                    {(dbStats.totalSizeMB ?? 0).toFixed(1)}MB
                    <span className="text-gray-400"> / {dbStats.maxSizeMB}MB</span>
                  </span>
                  <span className={`font-semibold ${
                    (dbStats.usagePercent ?? 0) > 90 ? 'text-red-600' :
                    (dbStats.usagePercent ?? 0) > 70 ? 'text-amber-600' :
                    'text-green-600'
                  }`}>
                    {(dbStats.usagePercent ?? 0).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      (dbStats.usagePercent ?? 0) > 90 ? 'bg-red-500' :
                      (dbStats.usagePercent ?? 0) > 70 ? 'bg-amber-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(dbStats.usagePercent ?? 0, 100)}%` }}
                  />
                </div>
              </div>

              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-gray-50 rounded-lg py-2">
                  <div className="text-xs text-gray-500">컬렉션</div>
                  <div className="text-sm font-bold text-gray-800">{dbStats.collectionCount}개</div>
                </div>
                <div className="bg-gray-50 rounded-lg py-2">
                  <div className="text-xs text-gray-500">문서</div>
                  <div className="text-sm font-bold text-gray-800">{(dbStats.objectCount ?? 0).toLocaleString()}개</div>
                </div>
                <div className="bg-gray-50 rounded-lg py-2">
                  <div className="text-xs text-gray-500">인덱스</div>
                  <div className="text-sm font-bold text-gray-800">{(dbStats.indexSizeMB ?? 0).toFixed(1)}MB</div>
                </div>
              </div>

              {/* Collection detail toggle */}
              <button
                onClick={() => setShowDbDetail(!showDbDetail)}
                className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 transition-colors"
              >
                <svg className={`w-3 h-3 transition-transform ${showDbDetail ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                컬렉션별 상세 {showDbDetail ? '접기' : '펼치기'}
              </button>

              {showDbDetail && (
                <div className="max-h-48 overflow-y-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">컬렉션</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">크기</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">문서수</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">인덱스</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {dbStats.collections.map(col => (
                        <tr key={col.name} className="hover:bg-gray-50">
                          <td className="px-3 py-1.5 font-mono text-xs text-gray-700">{col.name}</td>
                          <td className="px-3 py-1.5 text-xs text-right text-gray-600">{(col.storageSizeMB + col.indexSizeMB).toFixed(2)}MB</td>
                          <td className="px-3 py-1.5 text-xs text-right text-gray-500">{col.count.toLocaleString()}</td>
                          <td className="px-3 py-1.5 text-xs text-right text-gray-400">{col.indexSizeMB.toFixed(2)}MB</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-2">
              {dbStatsLoading ? '불러오는 중...' : 'DB 통계를 불러올 수 없습니다'}
            </p>
          )}
        </UICard>

        {/* Vercel Blob Storage Usage */}
        <UICard className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900">📦 Blob 스토리지</h2>
            {blobStatsLoading && (
              <div className="w-4 h-4 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
            )}
          </div>
          {blobStats ? (
            <div className="space-y-3">
              {blobStats.configured ? (
                <>
                  {/* Progress bar */}
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">
                        {blobStats.totalSizeMB.toFixed(1)}MB
                        <span className="text-gray-400"> / {blobStats.maxSizeMB}MB</span>
                      </span>
                      <span className={`font-semibold ${
                        blobStats.usagePercent > 90 ? 'text-red-600' :
                        blobStats.usagePercent > 70 ? 'text-amber-600' :
                        'text-green-600'
                      }`}>
                        {blobStats.usagePercent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          blobStats.usagePercent > 90 ? 'bg-red-500' :
                          blobStats.usagePercent > 70 ? 'bg-amber-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(blobStats.usagePercent, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Summary stats */}
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="bg-gray-50 rounded-lg py-2">
                      <div className="text-xs text-gray-500">파일</div>
                      <div className="text-sm font-bold text-gray-800">{blobStats.blobCount.toLocaleString()}개</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg py-2">
                      <div className="text-xs text-gray-500">사용량</div>
                      <div className="text-sm font-bold text-gray-800">{blobStats.totalSizeMB.toFixed(1)}MB</div>
                    </div>
                  </div>

                  {/* Extension detail */}
                  {Object.keys(blobStats.byExtension).length > 0 && (
                    <div className="border rounded-lg divide-y">
                      {Object.entries(blobStats.byExtension)
                        .sort(([, a], [, b]) => b.sizeMB - a.sizeMB)
                        .map(([ext, info]) => (
                          <div key={ext} className="flex justify-between items-center px-3 py-1.5 text-xs">
                            <span className="font-mono text-gray-700">.{ext}</span>
                            <span className="text-gray-500">
                              {info.count.toLocaleString()}개 / {info.sizeMB.toFixed(2)}MB
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-amber-600 font-medium">⚠️ Blob 스토리지가 설정되지 않았습니다</p>
                  <p className="text-xs text-gray-500">
                    Vercel 대시보드에서 Blob 저장소를 생성하고 <code className="bg-gray-100 px-1 rounded">BLOB_READ_WRITE_TOKEN</code> 환경 변수를 설정하세요.
                    (로컬 개발에서는 파일 시스템을 사용합니다)
                  </p>
                </div>
              )}
              {blobStats.error && !blobStats.configured && (
                <p className="text-xs text-red-500">{blobStats.error}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-2">
              {blobStatsLoading ? '불러오는 중...' : '스토리지 통계를 불러올 수 없습니다'}
            </p>
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
                  <UIFormField label="API Key" hint="x-api-key 헤더">
                    <UITextInput
                      value={newPrinterEpsonAuth.apiKey || ''}
                      onChange={e => setNewPrinterEpsonAuth(prev => ({ ...prev, apiKey: e.target.value }))}
                      placeholder="API Key"
                      required
                    />
                  </UIFormField>
                  <UIFormField label="Access Token" hint="Bearer 인증 토큰">
                    <UITextInput
                      value={newPrinterEpsonAuth.accessToken || ''}
                      onChange={e => setNewPrinterEpsonAuth(prev => ({ ...prev, accessToken: e.target.value }))}
                      placeholder="Access Token"
                      required
                    />
                  </UIFormField>
                  <p className="text-xs text-gray-400">토큰 자동 갱신이 필요하면 아래도 입력</p>
                  <UIFormField label="Refresh Token" hint="선택 · 30일 유효">
                    <UITextInput
                      value={newPrinterEpsonAuth.refreshToken || ''}
                      onChange={e => setNewPrinterEpsonAuth(prev => ({ ...prev, refreshToken: e.target.value || undefined }))}
                      placeholder="Refresh Token"
                    />
                  </UIFormField>
                  <div className="flex gap-2">
                    <UIFormField label="Client ID" hint="선택">
                      <UITextInput
                        value={newPrinterEpsonAuth.clientId || ''}
                        onChange={e => setNewPrinterEpsonAuth(prev => ({ ...prev, clientId: e.target.value || undefined }))}
                        placeholder="Client ID"
                      />
                    </UIFormField>
                    <UIFormField label="Client Secret" hint="선택">
                      <UITextInput
                        type="password"
                        value={newPrinterEpsonAuth.clientSecret || ''}
                        onChange={e => setNewPrinterEpsonAuth(prev => ({ ...prev, clientSecret: e.target.value || undefined }))}
                        placeholder="Client Secret"
                      />
                    </UIFormField>
                  </div>
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
                  <UIFormField label="API Key" hint="x-api-key 헤더">
                    <UITextInput
                      defaultValue={editingPrinter.epsonAuth?.apiKey || ''}
                      onBlur={e => {
                        const auth = editingPrinter.epsonAuth || { apiKey: '', accessToken: '' }
                        handleUpdatePrinter(editingPrinter._id, { epsonAuth: { ...auth, apiKey: e.target.value } } as any)
                      }}
                      placeholder="API Key"
                    />
                  </UIFormField>
                  <UIFormField label="Access Token" hint="Bearer 인증 토큰">
                    <UITextInput
                      defaultValue={editingPrinter.epsonAuth?.accessToken || ''}
                      onBlur={e => {
                        const auth = editingPrinter.epsonAuth || { apiKey: '', accessToken: '' }
                        handleUpdatePrinter(editingPrinter._id, { epsonAuth: { ...auth, accessToken: e.target.value } } as any)
                      }}
                      placeholder="Access Token"
                    />
                  </UIFormField>
                  <p className="text-xs text-gray-400">토큰 자동 갱신 (선택)</p>
                  <UIFormField label="Refresh Token" hint="30일 유효">
                    <UITextInput
                      defaultValue={editingPrinter.epsonAuth?.refreshToken || ''}
                      onBlur={e => {
                        const auth = editingPrinter.epsonAuth || { apiKey: '', accessToken: '' }
                        handleUpdatePrinter(editingPrinter._id, { epsonAuth: { ...auth, refreshToken: e.target.value || undefined } } as any)
                      }}
                      placeholder="Refresh Token"
                    />
                  </UIFormField>
                  <div className="flex gap-2">
                    <UIFormField label="Client ID">
                      <UITextInput
                        defaultValue={editingPrinter.epsonAuth?.clientId || ''}
                        onBlur={e => {
                          const auth = editingPrinter.epsonAuth || { apiKey: '', accessToken: '' }
                          handleUpdatePrinter(editingPrinter._id, { epsonAuth: { ...auth, clientId: e.target.value || undefined } } as any)
                        }}
                        placeholder="Client ID"
                      />
                    </UIFormField>
                    <UIFormField label="Client Secret">
                      <UITextInput
                        type="password"
                        defaultValue={editingPrinter.epsonAuth?.clientSecret || ''}
                        onBlur={e => {
                          const auth = editingPrinter.epsonAuth || { apiKey: '', accessToken: '' }
                          handleUpdatePrinter(editingPrinter._id, { epsonAuth: { ...auth, clientSecret: e.target.value || undefined } } as any)
                        }}
                        placeholder="Client Secret"
                      />
                    </UIFormField>
                  </div>
                  {editingPrinter.epsonAuth?.tokenExpiresAt && (
                    <div className="text-xs text-green-600 bg-green-50 px-3 py-2 rounded-lg">
                      토큰 자동 갱신됨 (만료: {new Date(editingPrinter.epsonAuth.tokenExpiresAt).toLocaleString()})
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
                    {printer.printMethod === 'polling' && (() => {
                      const isOnline = printer.lastSeen && (Date.now() - new Date(printer.lastSeen).getTime()) < 60000
                      return <UIBadge variant={isOnline ? 'success' : 'error'}>{isOnline ? '온라인' : '오프라인'}</UIBadge>
                    })()}
                  </div>
                  {printer.email && <p className="text-xs text-gray-400 mt-0.5">{printer.email}</p>}
                  {printer.supportedSizes && <p className="text-xs text-gray-400 mt-0.5">지원: {printer.supportedSizes.join(', ')}</p>}
                  {printer.printMethod === 'polling' && printer.lastSeen && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      마지막 응답: {new Date(printer.lastSeen).toLocaleString('ko-KR')}
                      {printer.statusInfo?.paperStatus && printer.statusInfo.paperStatus !== 'unknown' && ` · 용지: ${printer.statusInfo.paperStatus === 'ok' ? '정상' : printer.statusInfo.paperStatus === 'low' ? '부족' : '없음'}`}
                      {printer.statusInfo?.inkStatus && printer.statusInfo.inkStatus !== 'unknown' && ` · 잉크: ${printer.statusInfo.inkStatus === 'ok' ? '정상' : printer.statusInfo.inkStatus === 'low' ? '부족' : '없음'}`}
                      {printer.statusInfo?.errorMessage && ` · ${printer.statusInfo.errorMessage}`}
                    </p>
                  )}
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
                  onClick={() => selectEvent(event)}
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
                      {event.authCodeRequired && (
                        <UIBadge variant="info">인증코드</UIBadge>
                      )}
                      {event.endedAt && (
                        <UIBadge variant="error">종료됨</UIBadge>
                      )}
                      {(event.paymentMethods ?? []).includes('card') && (
                        <UIBadge variant="info">카드결제</UIBadge>
                      )}
                      {(event.paymentMethods ?? []).length === 0 && (
                        <UIBadge variant="success">무료</UIBadge>
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
      {renderJobDetailModal()}
    </div>
  )
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-blue-500" /></div>}>
      <AdminPageInner />
    </Suspense>
  )
}
