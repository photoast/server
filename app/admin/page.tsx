'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import QRCode from 'qrcode'
import { logClientError } from '@/lib/errorLogger'

interface LogoSettings {
  position: 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right' | 'custom'
  size: number
  x?: number
  y?: number
}

interface Event {
  _id: string
  name: string
  slug: string
  printerUrl: string
  logoUrl?: string
  logoBase64?: string
  photoAreaRatio?: number
  logoSettings?: LogoSettings
  availableLayouts?: string[]
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

  // Preview states
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})
  const [loadingPreviews, setLoadingPreviews] = useState<Record<string, boolean>>({})

  // Debounce timers
  const [debounceTimers, setDebounceTimers] = useState<Record<string, NodeJS.Timeout>>({})

  useEffect(() => {
    checkAuth()
  }, [])

  // Auto-generate previews when events are loaded
  useEffect(() => {
    events.forEach(event => {
      if (event.logoUrl && !previewUrls[event._id] && !loadingPreviews[event._id]) {
        generatePreview(event)
      }
    })
  }, [events])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/events')
      if (res.ok) {
        setAuthenticated(true)
        fetchEvents()
      }
    } catch (err) {
      // Not authenticated
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
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch events'
      setError(errorMessage)
      logClientError('Failed to fetch events', err)
    }
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

  const handleUploadLogo = async (eventId: string, file: File) => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'logo')

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!uploadRes.ok) throw new Error('Failed to upload logo')

      const { url, base64 } = await uploadRes.json()

      // Save both logoUrl and logoBase64 (for Vercel environment)
      const updatePayload: any = { logoUrl: url }
      if (base64) {
        updatePayload.logoBase64 = base64
      }

      const updateRes = await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      })

      if (!updateRes.ok) throw new Error('Failed to update event')

      await fetchEvents()

      // Auto-generate preview after logo upload
      const updatedEvent = events.find(e => e._id === eventId)
      if (updatedEvent) {
        await generatePreview({ ...updatedEvent, logoUrl: url })
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to upload logo'
      setError(errorMessage)
      logClientError('Failed to upload logo', err, undefined, {
        eventId,
        fileName: file.name,
      })
    }
  }

  const handleUpdatePhotoRatio = async (eventId: string, ratio: number) => {
    try {
      const updateRes = await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoAreaRatio: ratio }),
      })

      if (!updateRes.ok) throw new Error('Failed to update photo ratio')

      await fetchEvents()
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update photo ratio'
      setError(errorMessage)
      logClientError('Failed to update photo ratio', err, undefined, {
        eventId,
        ratio,
      })
    }
  }

  const handleUpdateEvent = async (eventId: string, updates: { name?: string; printerUrl?: string; availableLayouts?: string[] }) => {
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

  const handleUpdateLogoSettings = async (eventId: string, logoSettings: LogoSettings, autoRefreshPreview = true) => {
    try {
      const updateRes = await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logoSettings }),
      })

      if (!updateRes.ok) throw new Error('Failed to update logo settings')

      await fetchEvents()

      // Auto-refresh preview
      if (autoRefreshPreview) {
        const updatedEvent = events.find(e => e._id === eventId)
        if (updatedEvent) {
          setTimeout(() => generatePreview({ ...updatedEvent, logoSettings }), 300)
        }
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update logo settings'
      setError(errorMessage)
      logClientError('Failed to update logo settings', err, undefined, {
        eventId,
        logoSettings,
      })
    }
  }

  const debouncedUpdateLogoSettings = (eventId: string, logoSettings: LogoSettings, autoRefreshPreview = true) => {
    // Clear existing timer for this event
    if (debounceTimers[eventId]) {
      clearTimeout(debounceTimers[eventId])
    }

    // Find the event before state update
    const currentEvent = events.find(e => e._id === eventId)

    // Optimistically update local state
    setEvents(prevEvents =>
      prevEvents.map(e =>
        e._id === eventId ? { ...e, logoSettings } : e
      )
    )

    // Immediately update preview with optimistic state
    if (autoRefreshPreview && currentEvent) {
      generatePreview({ ...currentEvent, logoSettings })
    }

    // Set new timer to save to server
    const timer = setTimeout(() => {
      handleUpdateLogoSettings(eventId, logoSettings, false) // Don't refresh preview again
    }, 500)

    setDebounceTimers(prev => ({ ...prev, [eventId]: timer }))
  }

  const debouncedUpdatePhotoRatio = (eventId: string, ratio: number) => {
    const timerKey = `ratio-${eventId}`

    // Clear existing timer
    if (debounceTimers[timerKey]) {
      clearTimeout(debounceTimers[timerKey])
    }

    // Find the event before state update
    const currentEvent = events.find(e => e._id === eventId)

    // Optimistically update local state
    setEvents(prevEvents =>
      prevEvents.map(e =>
        e._id === eventId ? { ...e, photoAreaRatio: ratio } : e
      )
    )

    // Immediately update preview with optimistic state
    if (currentEvent) {
      generatePreview({ ...currentEvent, photoAreaRatio: ratio })
    }

    // Set new timer to save to server
    const timer = setTimeout(() => {
      handleUpdatePhotoRatio(eventId, ratio)
    }, 500)

    setDebounceTimers(prev => ({ ...prev, [timerKey]: timer }))
  }

  const generatePreview = async (event: Event) => {
    const eventId = event._id
    if (!event.logoUrl) return

    setLoadingPreviews(prev => ({ ...prev, [eventId]: true }))

    try {
      // Add timestamp to prevent caching
      const res = await fetch('/api/preview-logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logoUrl: event.logoUrl,
          photoAreaRatio: event.photoAreaRatio ?? 85,
          logoSettings: event.logoSettings,
          timestamp: Date.now(), // Force new request
        }),
      })

      if (!res.ok) throw new Error('Failed to generate preview')

      const blob = await res.blob()

      // Revoke old URL if exists
      if (previewUrls[eventId]) {
        URL.revokeObjectURL(previewUrls[eventId])
      }

      const url = URL.createObjectURL(blob)
      setPreviewUrls(prev => ({ ...prev, [eventId]: url }))

      console.log('Preview updated for event:', eventId, 'logoSettings:', event.logoSettings)
    } catch (err: any) {
      console.error('Preview error:', err)
      logClientError('Failed to generate logo preview', err, undefined, {
        eventId,
        logoUrl: event.logoUrl,
        photoAreaRatio: event.photoAreaRatio,
      })
    } finally {
      setLoadingPreviews(prev => ({ ...prev, [eventId]: false }))
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
      ctx.fillText('포토카드 무료 즉석인화 이벤트', 600, 210)

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
        { num: '3', text: '사진 선택 후 다운로드!' }
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
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-lg w-96">
          <h1 className="text-2xl font-bold mb-6 text-center">Admin Login</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold">Phost Admin</h1>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              Logout
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Events</h2>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {showCreateForm ? 'Cancel' : 'Create Event'}
            </button>
          </div>

          {showCreateForm && (
            <form onSubmit={handleCreateEvent} className="mb-6 p-4 bg-gray-50 rounded-lg space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Event Name</label>
                <input
                  type="text"
                  value={newEventName}
                  onChange={(e) => setNewEventName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Birthday Party 2024"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Printer IPP URL</label>
                <input
                  type="text"
                  value={newEventPrinter}
                  onChange={(e) => setNewEventPrinter(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="ipp://192.168.1.100:631/printers/printer1"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Event'}
              </button>
            </form>
          )}

          <div className="space-y-4">
            {events.map((event) => {
              const photoRatio = event.photoAreaRatio ?? 85
              const logoSettings = event.logoSettings || { position: 'bottom-center' as const, size: 80 }
              const isEditingName = editingEventId === event._id && editingField === 'name'
              const isEditingPrinter = editingEventId === event._id && editingField === 'printer'

              return (
                <div key={event._id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 space-y-4">
                      {/* Event Name - Editable */}
                      <div>
                        {isEditingName ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={tempValue}
                              onChange={(e) => setTempValue(e.target.value)}
                              className="flex-1 px-3 py-1 border rounded-lg text-lg font-bold"
                            />
                            <button
                              onClick={() => {
                                handleUpdateEvent(event._id, { name: tempValue })
                                setEditingEventId(null)
                                setEditingField(null)
                              }}
                              className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingEventId(null)
                                setEditingField(null)
                              }}
                              className="px-3 py-1 bg-gray-300 rounded-lg text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <h3
                            className="text-lg font-bold cursor-pointer hover:text-blue-600"
                            onClick={() => {
                              setEditingEventId(event._id)
                              setEditingField('name')
                              setTempValue(event.name)
                            }}
                          >
                            {event.name} ✏️
                          </h3>
                        )}
                      </div>

                      <p className="text-sm text-gray-600">Slug: {event.slug}</p>

                      {/* Printer URL - Editable */}
                      <div>
                        {isEditingPrinter ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={tempValue}
                              onChange={(e) => setTempValue(e.target.value)}
                              className="flex-1 px-3 py-1 border rounded-lg text-sm"
                            />
                            <button
                              onClick={() => {
                                handleUpdateEvent(event._id, { printerUrl: tempValue })
                                setEditingEventId(null)
                                setEditingField(null)
                              }}
                              className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingEventId(null)
                                setEditingField(null)
                              }}
                              className="px-3 py-1 bg-gray-300 rounded-lg text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <p
                            className="text-sm text-gray-600 cursor-pointer hover:text-blue-600"
                            onClick={() => {
                              setEditingEventId(event._id)
                              setEditingField('printer')
                              setTempValue(event.printerUrl)
                            }}
                          >
                            Printer: {event.printerUrl} ✏️
                          </p>
                        )}
                      </div>

                      {/* Photo/Logo Ratio Control */}
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Photo Area Ratio: {photoRatio}%
                          <span className="text-gray-500 ml-2">(Logo: {100 - photoRatio}%)</span>
                        </label>
                        <input
                          type="range"
                          min="50"
                          max="100"
                          value={photoRatio}
                          onChange={(e) => debouncedUpdatePhotoRatio(event._id, Number(e.target.value))}
                          className="w-full"
                        />
                      </div>

                      {/* Logo Settings */}
                      {event.logoUrl && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium mb-2">
                              Logo Position:
                            </label>
                            <select
                              value={logoSettings.position}
                              onChange={(e) => {
                                const newPosition = e.target.value as LogoSettings['position']
                                if (newPosition === 'custom') {
                                  handleUpdateLogoSettings(event._id, {
                                    ...logoSettings,
                                    position: 'custom',
                                    x: 50,
                                    y: 50
                                  })
                                } else {
                                  handleUpdateLogoSettings(event._id, {
                                    ...logoSettings,
                                    position: newPosition
                                  })
                                }
                              }}
                              className="w-full px-3 py-2 border rounded-lg text-sm"
                            >
                              <option value="top-left">Top Left</option>
                              <option value="top-center">Top Center</option>
                              <option value="top-right">Top Right</option>
                              <option value="center-left">Center Left</option>
                              <option value="center">Center</option>
                              <option value="center-right">Center Right</option>
                              <option value="bottom-left">Bottom Left</option>
                              <option value="bottom-center">Bottom Center</option>
                              <option value="bottom-right">Bottom Right</option>
                              <option value="custom">Custom (Drag to position)</option>
                            </select>
                          </div>

                          {logoSettings.position === 'custom' && (
                            <div className="space-y-3">
                              <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
                                💡 Drag the logo in the preview or enter values below
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium mb-1">
                                    X Position (%):
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={Math.round(logoSettings.x ?? 50)}
                                    onChange={(e) => debouncedUpdateLogoSettings(event._id, {
                                      ...logoSettings,
                                      x: Number(e.target.value)
                                    })}
                                    className="w-full px-2 py-1 border rounded text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium mb-1">
                                    Y Position (%):
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={Math.round(logoSettings.y ?? 50)}
                                    onChange={(e) => debouncedUpdateLogoSettings(event._id, {
                                      ...logoSettings,
                                      y: Number(e.target.value)
                                    })}
                                    className="w-full px-2 py-1 border rounded text-sm"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          <div>
                            <label className="block text-sm font-medium mb-2">
                              Logo Size: {logoSettings.size}%
                              <span className="text-xs text-gray-500 ml-2">(of image width)</span>
                            </label>
                            <input
                              type="range"
                              min="5"
                              max="300"
                              step="1"
                              value={logoSettings.size}
                              onChange={(e) => debouncedUpdateLogoSettings(event._id, {
                                ...logoSettings,
                                size: Number(e.target.value)
                              })}
                              className="w-full"
                            />
                            <div className="flex justify-between text-xs text-gray-400 mt-1">
                              <span>5%</span>
                              <span>100%</span>
                              <span>200%</span>
                              <span>300%</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Available Layouts Selection */}
                      <div className="border-t pt-4">
                        <label className="block text-sm font-medium mb-2">
                          노출할 레이아웃 선택:
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {(() => {
                            const allLayoutTypes = [
                              { type: 'single', name: '일반 1장' },
                              { type: 'single-with-logo', name: '로고 포함 1장' },
                              { type: 'vertical-two', name: '세로 2장' },
                              { type: 'one-plus-two', name: '1+2 레이아웃' },
                              { type: 'four-cut', name: '1*4 네컷' },
                              { type: 'two-by-two', name: '2×2 그리드' },
                            ]

                            return allLayoutTypes.map((layout) => {
                              const availableLayouts = event.availableLayouts || []
                              const isChecked = availableLayouts.length === 0 || availableLayouts.includes(layout.type)

                              return (
                                <label
                                  key={layout.type}
                                  className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      const currentLayouts = event.availableLayouts || []
                                      let newLayouts: string[]

                                      if (e.target.checked) {
                                        // Add layout
                                        if (currentLayouts.length === 0) {
                                          // If currently showing all (empty array), just add this one
                                          newLayouts = [layout.type]
                                        } else {
                                          // Add to existing array
                                          newLayouts = [...currentLayouts.filter(l => l !== layout.type), layout.type]
                                        }
                                      } else {
                                        // Remove layout
                                        if (currentLayouts.length === 0) {
                                          // If currently showing all, create array with all except this one
                                          newLayouts = allLayoutTypes
                                            .map(l => l.type)
                                            .filter(t => t !== layout.type)
                                        } else {
                                          // Remove from existing array
                                          newLayouts = currentLayouts.filter(l => l !== layout.type)
                                        }
                                      }

                                      handleUpdateEvent(event._id, { availableLayouts: newLayouts })
                                    }}
                                    className="rounded"
                                  />
                                  <span className="text-sm">{layout.name}</span>
                                </label>
                              )
                            })
                          })()}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          {event.availableLayouts && event.availableLayouts.length > 0
                            ? `${event.availableLayouts.length}개 레이아웃 선택됨`
                            : '모든 레이아웃 활성화됨'}
                        </p>
                      </div>

                      {/* Preview with exact 102x152mm ratio */}
                      {event.logoUrl && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium">Preview (102×152mm):</p>
                            <button
                              onClick={() => generatePreview(event)}
                              disabled={loadingPreviews[event._id]}
                              className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                              {loadingPreviews[event._id] ? 'Loading...' : 'Refresh Preview'}
                            </button>
                          </div>
                          <div className="relative w-48 aspect-[1000/1500] bg-gray-100 border-2 border-gray-300 rounded shadow-lg overflow-hidden">
                            {previewUrls[event._id] ? (
                              <Image
                                key={previewUrls[event._id]} // Force re-render when URL changes
                                src={previewUrls[event._id]}
                                alt="Preview"
                                fill
                                className="object-cover"
                                unoptimized
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm px-4 text-center">
                                Click &quot;Refresh Preview&quot; to see actual result
                              </div>
                            )}
                            {loadingPreviews[event._id] && (
                              <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                              </div>
                            )}

                            {/* Draggable overlay for custom position mode */}
                            {logoSettings.position === 'custom' && previewUrls[event._id] && !loadingPreviews[event._id] && (
                              <div
                                className="absolute inset-0 cursor-move"
                                onMouseDown={(e) => {
                                  e.preventDefault()
                                  const container = e.currentTarget
                                  const rect = container.getBoundingClientRect()

                                  // Calculate logo area (bottom portion)
                                  const logoAreaHeight = rect.height * ((100 - photoRatio) / 100)
                                  const logoAreaTop = rect.height * (photoRatio / 100)

                                  const handleMouseMove = (moveEvent: MouseEvent) => {
                                    // Get position relative to logo area
                                    const relativeY = moveEvent.clientY - rect.top - logoAreaTop
                                    const relativeX = moveEvent.clientX - rect.left

                                    // Convert to percentage
                                    const percentX = Math.max(0, Math.min(100, (relativeX / rect.width) * 100))
                                    const percentY = Math.max(0, Math.min(100, (relativeY / logoAreaHeight) * 100))

                                    // Update settings without auto-refresh
                                    handleUpdateLogoSettings(event._id, {
                                      ...logoSettings,
                                      x: Math.round(percentX * 10) / 10,
                                      y: Math.round(percentY * 10) / 10
                                    }, false)
                                  }

                                  const handleMouseUp = () => {
                                    document.removeEventListener('mousemove', handleMouseMove)
                                    document.removeEventListener('mouseup', handleMouseUp)

                                    // Refresh preview after drag ends
                                    setTimeout(() => generatePreview(event), 100)
                                  }

                                  document.addEventListener('mousemove', handleMouseMove)
                                  document.addEventListener('mouseup', handleMouseUp)
                                }}
                              >
                                <div className="absolute inset-0 bg-blue-400 bg-opacity-0 hover:bg-opacity-10 transition-all">
                                  <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded pointer-events-none">
                                    Drag to position logo
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {logoSettings.position === 'custom' ? 'Drag on preview to position logo, or use inputs above' : 'Actual preview using your logo settings'}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => generateQR(event)}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                      >
                        Show QR
                      </button>
                      <button
                        onClick={() => {
                          const url = `${window.location.origin}/${event.slug}`
                          window.open(url, '_blank')
                        }}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
                      >
                        Link
                      </button>
                      <button
                        onClick={() => viewPrintHistory(event)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                      >
                        Print History
                      </button>
                      <label className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm text-center cursor-pointer">
                        Upload Logo
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleUploadLogo(event._id, file)
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )
            })}
            {events.length === 0 && (
              <p className="text-center text-gray-500 py-8">No events yet. Create one to get started!</p>
            )}
          </div>
        </div>

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
                <button
                  onClick={downloadPromotionalImage}
                  disabled={!promotionalImageUrl || generatingPromo}
                  className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center gap-2"
                >
                  <span>💾</span>
                  다운로드
                </button>
                <button
                  onClick={printPromotionalImage}
                  disabled={!promotionalImageUrl || generatingPromo || loading}
                  className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center gap-2"
                >
                  <span>🖨️</span>
                  {loading ? '인쇄 중...' : '프린터로 인쇄'}
                </button>
                <button
                  onClick={() => {
                    setQrCodeUrl(null)
                    setPromotionalImageUrl(null)
                  }}
                  className="px-4 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold"
                >
                  닫기
                </button>
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
                        <div
                          className="relative w-24 aspect-[1000/1500] bg-gray-200 rounded flex-shrink-0 cursor-pointer hover:opacity-75 transition"
                          onClick={() => setSelectedImageForPreview(job.imageUrl)}
                        >
                          <Image
                            src={job.imageUrl}
                            alt="Printed photo"
                            fill
                            className="object-cover rounded"
                          />
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              job.status === 'DONE'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {job.status}
                            </span>
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

              <button
                onClick={() => setShowPrintHistory(false)}
                className="w-full mt-6 px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {selectedImageForPreview && (
          <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 z-50" onClick={() => setSelectedImageForPreview(null)}>
            <div className="relative max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setSelectedImageForPreview(null)}
                className="absolute -top-12 right-0 text-white hover:text-gray-300 text-xl font-bold"
              >
                ✕ Close
              </button>
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
