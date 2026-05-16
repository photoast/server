'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import type { FrameLayout } from '@/lib/types'
import type { CompletedSlotData } from '@/app/components/FrameUserEditor'
import { UIPageSpinner, UIStatusBanner, UIButton, UIStepBar, UICounterControl, UISectionHeading, UIBottomSheet, UISelectItem } from '@/app/components/ui'
import Script from 'next/script'
import { logClientError, logClientInfo } from '@/lib/errorLogger'
import { trackStepView, trackLayoutSelect, trackColorSelect, trackAllPhotosReady, trackPreviewReady, trackPaymentStart, trackPaymentSuccess, trackPaymentFail, trackPrintRequest, trackPrintSuccess, trackDownload, trackReset } from '@/lib/gtag'
import { useI18n, LanguageToggle } from '../../i18n'

const FrameUserEditor = dynamic(() => import('@/app/components/FrameUserEditor'), { ssr: false })

const NICEPAY_CLIENT_ID = process.env.NEXT_PUBLIC_NICEPAY_CLIENT_ID || 'S2_af4543a0be4d49a98122e01ec2059a56'

declare global {
  interface Window {
    AUTHNICE?: {
      requestPay: (options: {
        clientId: string
        method: string
        orderId: string
        amount: number
        goodsName: string
        returnUrl: string
        mallReserved?: string
        fnError?: (result: { errorMsg: string }) => void
      }) => void
    }
  }
}

type Step = 'fill-photos' | 'select-bg-color' | 'payment' | 'payment-failed' | 'success'

interface Event {
  _id: string
  name: string
  slug: string
  printerUrl: string
  supportedSizes?: string[]
  price?: number
  puzzleEnabled?: boolean
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
}

function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 128
}

// Split an image URL into NxN puzzle pieces using canvas
async function splitImageIntoPieces(imageUrl: string, gridSize: number): Promise<{ blobs: Blob[]; urls: string[] }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const pieceW = Math.floor(img.width / gridSize)
      const pieceH = Math.floor(img.height / gridSize)
      const blobs: Blob[] = []
      const urls: string[] = []
      let done = 0
      const total = gridSize * gridSize

      for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
          const canvas = document.createElement('canvas')
          canvas.width = pieceW
          canvas.height = pieceH
          const ctx = canvas.getContext('2d')!
          ctx.drawImage(img, col * pieceW, row * pieceH, pieceW, pieceH, 0, 0, pieceW, pieceH)
          canvas.toBlob(blob => {
            if (!blob) { reject(new Error('Failed to create puzzle piece')); return }
            const idx = row * gridSize + col
            blobs[idx] = blob
            urls[idx] = URL.createObjectURL(blob)
            done++
            if (done === total) resolve({ blobs, urls })
          }, 'image/jpeg', 0.95)
        }
      }
    }
    img.onerror = () => reject(new Error('Failed to load image for puzzle'))
    img.src = imageUrl
  })
}

export default function FrameLayoutPage({
  params,
}: {
  params: { slug: string; layoutId: string }
}) {
  const router = useRouter()
  const { t } = useI18n()
  const [customerEmail, setCustomerEmail] = useState('')
  const [emailSuggestions, setEmailSuggestions] = useState<string[]>([])
  const [showEmailSuggestions, setShowEmailSuggestions] = useState(false)

  const EMAIL_DOMAINS = ['gmail.com', 'naver.com', 'kakao.com', 'daum.net', 'hanmail.net', 'nate.com', 'icloud.com', 'outlook.com']

  useEffect(() => {
    const saved = localStorage.getItem('lastCustomerEmail')
    if (saved) setCustomerEmail(saved)
  }, [])

  const handleEmailChange = (value: string) => {
    setCustomerEmail(value)
    const atIndex = value.indexOf('@')
    if (atIndex > 0) {
      const domain = value.slice(atIndex + 1)
      if (domain && !domain.includes('.')) {
        setEmailSuggestions(
          EMAIL_DOMAINS.filter(d => d.startsWith(domain)).map(d => value.slice(0, atIndex + 1) + d)
        )
        setShowEmailSuggestions(true)
      } else if (!domain) {
        setEmailSuggestions(EMAIL_DOMAINS.map(d => value + d))
        setShowEmailSuggestions(true)
      } else {
        setShowEmailSuggestions(false)
      }
    } else {
      setShowEmailSuggestions(false)
    }
  }

  const selectEmailSuggestion = (email: string) => {
    setCustomerEmail(email)
    setShowEmailSuggestions(false)
  }
  const [event, setEvent] = useState<Event | null>(null)
  const [layout, setLayout] = useState<FrameLayout | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Step flow
  const [step, setStep] = useState<Step>('fill-photos')
  const [selectedColor, setSelectedColor] = useState('#FFFFFF')
  const [mergedUrl, setMergedUrl] = useState<string | null>(null)
  const [completedSlotData, setCompletedSlotData] = useState<CompletedSlotData[] | null>(null)
  const [merging, setMerging] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [printQuantity, setPrintQuantity] = useState(1)
  const [printJobIds, setPrintJobIds] = useState<string[]>([])
  const [printJobStatuses, setPrintJobStatuses] = useState<{ jobId: string; status: string; queuePosition?: number; errorMessage?: string }[]>([])

  // Auth code
  const [authCode, setAuthCode] = useState('')
  const [authCodeVerified, setAuthCodeVerified] = useState(false)
  const [authCodeError, setAuthCodeError] = useState('')

  // Puzzle state
  const [puzzleMode, setPuzzleMode] = useState(false)
  const [puzzleGrid, setPuzzleGrid] = useState<'2x2' | '3x3' | '4x4'>('2x2')
  const [puzzlePieces, setPuzzlePieces] = useState<Blob[]>([])
  const [puzzlePieceUrls, setPuzzlePieceUrls] = useState<string[]>([])
  const [puzzleSplit, setPuzzleSplit] = useState(false)

  // Layout picker
  const [allLayouts, setAllLayouts] = useState<FrameLayout[]>([])
  const [showLayoutPicker, setShowLayoutPicker] = useState(false)
  const filteredLayouts = event?.supportedSizes
    ? allLayouts.filter(sl => event.supportedSizes!.includes(sl.printSize))
    : allLayouts

  // Payment state
  const [paymentProcessing, setPaymentProcessing] = useState(false)
  const [paymentConfirming, setPaymentConfirming] = useState(false)

  const gridSize = puzzleGrid === '4x4' ? 4 : puzzleGrid === '3x3' ? 3 : 2
  const totalPieces = gridSize * gridSize

  const isPaymentReturn = useRef(false)

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('payment')) isPaymentReturn.current = true
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const [evRes, layoutRes] = await Promise.all([
          fetch(`/api/events/slug/${params.slug}`),
          fetch(`/api/layouts/${params.layoutId}`),
        ])
        if (!evRes.ok) throw new Error(t('error.event'))
        if (!layoutRes.ok) throw new Error(t('error.layout'))
        const [ev, lay] = await Promise.all([evRes.json(), layoutRes.json()])
        setEvent(ev)
        setLayout(lay)
        if (lay.backgroundColor) setSelectedColor(lay.backgroundColor)

        let deviceId = localStorage.getItem('pt_device_id')
        if (!deviceId) {
          deviceId = crypto.randomUUID()
          localStorage.setItem('pt_device_id', deviceId)
        }
        fetch('/api/page-views', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: params.slug, deviceId }),
        }).catch(() => {})

        if (ev._id) {
          fetch(`/api/layouts?eventId=${ev._id}&visibleOnly=true`)
            .then(r => r.ok ? r.json() : [])
            .then(layouts => setAllLayouts(Array.isArray(layouts) ? layouts : []))
            .catch(() => {})
        }
      } catch (err: any) {
        if (!isPaymentReturn.current) {
          setError(err.message || t('error.pageLoad'))
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params.slug, params.layoutId])

  // Payment result handling on page load (나이스페이 returnUrl 리다이렉트 후)
  const paymentProcessedRef = useRef(false)

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const paymentStatus = urlParams.get('payment')
    const tid = urlParams.get('tid')
    const orderId = urlParams.get('orderId')
    const amount = urlParams.get('amount')

    if (paymentStatus === 'success' && tid && orderId && amount) {
      if (paymentProcessedRef.current) return
      paymentProcessedRef.current = true
      setPaymentConfirming(true)

      const confirmPayment = async () => {
        setError('')
        try {
          const paymentRes = await fetch('/api/payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tid, orderId, amount: Number(amount), eventSlug: params.slug }),
          })
          if (!paymentRes.ok) {
            const data = await paymentRes.json()
            throw new Error(data.error || t('error.paymentConfirm'))
          }

          const savedPreviewUrl = localStorage.getItem('pendingPrintUrl')
          if (!savedPreviewUrl) throw new Error(t('error.print'))

          const savedAuthCode = localStorage.getItem('pendingAuthCode')
          const savedEmail = localStorage.getItem('pendingCustomerEmail')
          const savedLayoutId = params.layoutId || localStorage.getItem('pendingLayoutId')
          const printRes = await fetch('/api/print', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              slug: params.slug,
              layoutId: savedLayoutId,
              imageUrl: savedPreviewUrl,
              paymentTid: tid,
              ...(savedAuthCode ? { authCode: savedAuthCode } : {}),
              ...(savedEmail ? { customerEmail: savedEmail } : {}),
            }),
          })
          if (!printRes.ok) {
            const data = await printRes.json()
            throw new Error(data.error || t('error.print'))
          }
          const printData = await printRes.json()
          if (printData.jobIds) setPrintJobIds(printData.jobIds)

          setMergedUrl(savedPreviewUrl)
          localStorage.removeItem('pendingPrintUrl')
          localStorage.removeItem('pendingAuthCode')
          localStorage.removeItem('pendingCustomerEmail')
          localStorage.removeItem('pendingLayoutId')
          localStorage.removeItem('pendingPaymentReturn')
          window.history.replaceState({}, '', window.location.pathname)
          trackPaymentSuccess(Number(amount), params.slug)
          trackPrintSuccess(params.slug)
          setStep('success')
        } catch (err: any) {
          setError(err.message || t('error.paymentConfirm'))
          trackPaymentFail(err.message || 'confirmation_failed', params.slug)
          logClientError('Payment confirmation failed', err, params.slug)
          setStep('payment-failed')
          window.history.replaceState({}, '', window.location.pathname)
        } finally {
          setPaymentConfirming(false)
        }
      }
      confirmPayment()
    } else if (paymentStatus === 'fail') {
      const errorMsg = urlParams.get('errorMsg')
      setError(errorMsg || t('error.payment'))
      trackPaymentFail(errorMsg || 'unknown', params.slug)
      setStep('payment-failed')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [params.slug])

  // Save previewUrl before payment redirect
  useEffect(() => {
    if (step === 'payment' && mergedUrl) {
      localStorage.setItem('pendingPrintUrl', mergedUrl)
      if (authCode) localStorage.setItem('pendingAuthCode', authCode)
      if (customerEmail) {
        localStorage.setItem('pendingCustomerEmail', customerEmail)
        localStorage.setItem('lastCustomerEmail', customerEmail)
      }
    }
  }, [step, mergedUrl, customerEmail, authCode])

  // Auto-animate puzzle pieces (split/combine)
  useEffect(() => {
    if (puzzlePieceUrls.length === 0) return
    const interval = setInterval(() => setPuzzleSplit(v => !v), 2000)
    return () => clearInterval(interval)
  }, [puzzlePieceUrls.length])

  // Generate puzzle pieces when puzzle mode is toggled on
  useEffect(() => {
    if (!puzzleMode || !mergedUrl) {
      // Clean up URLs when puzzle mode is off
      puzzlePieceUrls.forEach(url => URL.revokeObjectURL(url))
      setPuzzlePieces([])
      setPuzzlePieceUrls([])
      return
    }
    splitImageIntoPieces(mergedUrl, gridSize)
      .then(({ blobs, urls }) => {
        setPuzzlePieces(blobs)
        setPuzzlePieceUrls(urls)
      })
      .catch(err => {
        setError(t('error.imageProcess'))
        setPuzzleMode(false)
      })
  }, [puzzleMode, mergedUrl, gridSize])

  const handleLayoutSwitch = (newLayout: FrameLayout) => {
    trackLayoutSelect(newLayout.name, newLayout._id, params.slug)
    setLayout(newLayout)
    setShowLayoutPicker(false)
    window.history.replaceState({}, '', `/${params.slug}/layout/${newLayout._id}`)
    setMergedUrl(null)
    setCompletedSlotData(null)
    setSelectedColor(newLayout.backgroundColor || '#FFFFFF')
    setStep('fill-photos')
  }

  const handleComplete = (url: string) => {
    setMergedUrl(url)
    setStep('fill-photos')
  }

  const handlePhotosReady = (slotData: CompletedSlotData[]) => {
    trackAllPhotosReady(slotData.length, params.slug)
    setCompletedSlotData(slotData)
    const layoutBgColor = layout?.backgroundColor || '#FFFFFF'
    const canCustomize = layout?.backgroundColorCustomizable ?? true
    const defColors = ['#FFFFFF', '#000000', '#FFB6C1', '#87CEEB', '#90EE90', '#DDA0DD']
    const colors = event?.backgroundColors?.length ? event.backgroundColors : defColors
    if (canCustomize && colors.length > 1) {
      setSelectedColor(layoutBgColor)
      trackStepView('select-bg-color', params.slug)
      setStep('select-bg-color')
    } else {
      setSelectedColor(layoutBgColor)
      performMerge(slotData, layoutBgColor)
    }
  }

  const performMerge = async (slotData: CompletedSlotData[], bgColor: string) => {
    if (!layout) return
    setMerging(true)
    setError('')
    try {
      const { canvasWidth, canvasHeight, slots, frameLayers } = layout

      // Build unified items sorted by zIndex
      type Item =
        | { type: 'slot'; slotId: string; zIndex: number }
        | { type: 'frame'; layer: (typeof frameLayers)[number]; zIndex: number }
      const items: Item[] = []
      for (const slot of slots) items.push({ type: 'slot', slotId: slot.id, zIndex: slot.zIndex ?? 10 })
      for (const layer of frameLayers || []) {
        if (layer.visible !== false) items.push({ type: 'frame', layer, zIndex: layer.zIndex })
      }
      items.sort((a, b) => a.zIndex - b.zIndex)

      // Create canvas
      const canvas = document.createElement('canvas')
      canvas.width = canvasWidth
      canvas.height = canvasHeight
      const ctx = canvas.getContext('2d')!

      // Background
      ctx.fillStyle = bgColor
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)

      // Helper: load image from URL or File
      const loadImg = (src: string | File): Promise<HTMLImageElement> =>
        new Promise((resolve, reject) => {
          const img = new window.Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => resolve(img)
          img.onerror = reject
          img.src = src instanceof File ? URL.createObjectURL(src) : src
        })

      // Draw each item in z-order
      for (const item of items) {
        if (item.type === 'slot') {
          const slot = slots.find(s => s.id === item.slotId)!
          const data = slotData.find(d => d.slotId === slot.id)
          if (!data) continue
          const img = await loadImg(data.file)
          const { x: cropX, y: cropY, width: cropW, height: cropH } = data.cropArea
          const rotation = slot.rotation ?? 0
          ctx.save()
          if (rotation !== 0) {
            ctx.translate(slot.x + slot.width / 2, slot.y + slot.height / 2)
            ctx.rotate((rotation * Math.PI) / 180)
            ctx.drawImage(img, cropX, cropY, cropW, cropH, -slot.width / 2, -slot.height / 2, slot.width, slot.height)
          } else {
            ctx.drawImage(img, cropX, cropY, cropW, cropH, slot.x, slot.y, slot.width, slot.height)
          }
          ctx.restore()
          URL.revokeObjectURL(img.src)
        } else {
          const layer = item.layer
          try {
            const img = await loadImg(layer.imageUrl)
            const lx = layer.x ?? 0
            const ly = layer.y ?? 0
            const lw = layer.width ?? canvasWidth
            const lh = layer.height ?? canvasHeight
            const rotation = layer.rotation ?? 0
            ctx.save()
            ctx.globalAlpha = layer.opacity ?? 1
            if (rotation !== 0) {
              ctx.translate(lx + lw / 2, ly + lh / 2)
              ctx.rotate((rotation * Math.PI) / 180)
              ctx.drawImage(img, -lw / 2, -lh / 2, lw, lh)
            } else {
              ctx.drawImage(img, lx, ly, lw, lh)
            }
            ctx.restore()
          } catch {
            console.warn(`Failed to load frame layer ${layer.id}, skipping`)
          }
        }
      }

      const mergedDataUrl = canvas.toDataURL('image/jpeg', 0.95)
      setMergedUrl(mergedDataUrl)
      trackPreviewReady(params.slug)
      setStep('fill-photos')
    } catch (err: any) {
      setError(err.message || t('error.imageProcess'))
    } finally {
      setMerging(false)
    }
  }

  const handlePrint = async () => {
    if (!mergedUrl || !event) return
    setPrinting(true)
    setError('')
    try {
      const collectedJobIds: string[] = []
      if (puzzleMode && puzzlePieces.length > 0) {
        // Print each puzzle piece individually
        for (let copy = 0; copy < printQuantity; copy++) {
          for (let i = 0; i < puzzlePieces.length; i++) {
            const dataUrl = await new Promise<string>((resolve) => {
              const reader = new FileReader()
              reader.onloadend = () => resolve(reader.result as string)
              reader.readAsDataURL(puzzlePieces[i])
            })
            const res = await fetch('/api/print', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ slug: event.slug, layoutId: params.layoutId, imageUrl: dataUrl, ...(event.authCodeRequired && authCode ? { authCode } : {}) }),
            })
            if (!res.ok) {
              const data = await res.json().catch(() => ({}))
              throw new Error(data.error || t('error.print'))
            }
            const data = await res.json()
            if (data.jobIds) collectedJobIds.push(...data.jobIds)
          }
        }
      } else {
        const res = await fetch('/api/print', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: event.slug, layoutId: params.layoutId, imageUrl: mergedUrl, quantity: printQuantity, ...(event.authCodeRequired && authCode ? { authCode } : {}) }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || t('error.print'))
        }
        const data = await res.json()
        if (data.jobIds) collectedJobIds.push(...data.jobIds)
      }
      setPrintJobIds(collectedJobIds)
      trackPrintSuccess(params.slug)
      trackStepView('success', params.slug)
      setStep('success')
    } catch (err: any) {
      setError(err.message)
      logClientError('Failed to print', err, params.slug)
    } finally {
      setPrinting(false)
    }
  }

  const handleVerifyAuthCode = async (): Promise<boolean> => {
    if (!event?.authCodeRequired) return true
    if (authCodeVerified) return true
    if (!authCode.trim()) {
      setAuthCodeError(t('auth.required'))
      return false
    }
    try {
      const res = await fetch('/api/auth-codes/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: event.slug, code: authCode.trim() }),
      })
      const data = await res.json()
      if (data.valid) {
        setAuthCodeVerified(true)
        setAuthCodeError('')
        return true
      }
      setAuthCodeError(data.error || t('auth.invalid'))
      return false
    } catch {
      setAuthCodeError(t('auth.error'))
      return false
    }
  }

  const handleGoToPayment = async () => {
    if (!mergedUrl || !event) return

    if (event.authCodeRequired && !authCodeVerified) {
      const valid = await handleVerifyAuthCode()
      if (!valid) return
    }

    const unitPrice = layout?.price ?? event.price ?? 0
    const multiplier = puzzleMode ? totalPieces : 1
    const paymentAmount = unitPrice * printQuantity * multiplier

    if (paymentAmount === 0) {
      trackPrintRequest(printQuantity, params.slug)
      await handlePrint()
      return
    }

    trackPaymentStart(paymentAmount, printQuantity, params.slug)
    trackStepView('payment', params.slug)
    setStep('payment')
    setError('')
  }

  const handlePayment = () => {
    if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      setError(t('pay.emailError'))
      return
    }
    if (!window.AUTHNICE || !event) {
      setError(t('pay.moduleLoading'))
      return
    }

    const unitPrice = layout?.price ?? event.price ?? 0
    const multiplier = puzzleMode ? totalPieces : 1
    const paymentAmount = unitPrice * printQuantity * multiplier
    const orderId = `PRINT_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    setPaymentProcessing(true)
    setError('')

    if (mergedUrl) localStorage.setItem('pendingPrintUrl', mergedUrl)
    if (authCode) localStorage.setItem('pendingAuthCode', authCode)
    if (customerEmail) {
      localStorage.setItem('pendingCustomerEmail', customerEmail)
      localStorage.setItem('lastCustomerEmail', customerEmail)
    }
    localStorage.setItem('pendingPaymentReturn', window.location.pathname)
    localStorage.setItem('pendingLayoutId', params.layoutId)

    const nicepayMethod = 'card'

    window.AUTHNICE.requestPay({
      clientId: NICEPAY_CLIENT_ID,
      method: nicepayMethod,
      orderId,
      amount: paymentAmount,
      goodsName: puzzleMode ? `Puzzle ${totalPieces}pcs` : `Photo Print ${printQuantity}`,
      returnUrl: `${window.location.origin}/api/payment/nicepay-return`,
      mallReserved: window.location.pathname,
      fnError: (result) => {
        setError(result.errorMsg || t('error.payment'))
        setPaymentProcessing(false)
      },
    })
  }

  const handleDownload = async () => {
    if (!mergedUrl) return
    trackDownload(params.slug)
    try {
      const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
        const res = await fetch(dataUrl)
        return res.blob()
      }

      if (puzzleMode && puzzlePieceUrls.length > 0) {
        for (let i = 0; i < puzzlePieceUrls.length; i++) {
          const blob = await dataUrlToBlob(puzzlePieceUrls[i])
          const file = new File([blob], `puzzle-piece-${i + 1}.jpg`, { type: 'image/jpeg' })
          if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file] })
          } else {
            const link = document.createElement('a')
            link.href = puzzlePieceUrls[i]
            link.download = file.name
            link.click()
          }
          await new Promise(r => setTimeout(r, 300))
        }
      } else {
        const blob = mergedUrl.startsWith('data:')
          ? await dataUrlToBlob(mergedUrl)
          : await (await fetch(mergedUrl)).blob()
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' })

        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file] })
        } else {
          const link = document.createElement('a')
          link.href = URL.createObjectURL(blob)
          link.download = file.name
          link.click()
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') setError(t('error.download'))
    }
  }

  const handleReset = () => {
    trackReset(params.slug)
    setMergedUrl(null)
    setError('')
    setPrintQuantity(1)
    setPuzzleMode(false)
    setPuzzleGrid('2x2')
    puzzlePieceUrls.forEach(url => URL.revokeObjectURL(url))
    setPuzzlePieces([])
    setPuzzlePieceUrls([])
    setCompletedSlotData(null)
    setSelectedColor(layout?.backgroundColor || '#FFFFFF')
    setPrintJobIds([])
    setPrintJobStatuses([])
    setStep('fill-photos')
  }

  // Poll print job status when on success screen
  const allJobsSettled = printJobStatuses.length > 0 &&
    printJobStatuses.every(j => j.status === 'DONE' || j.status === 'FAILED' || j.status === 'CANCELLED')

  useEffect(() => {
    if (step !== 'success' || printJobIds.length === 0 || allJobsSettled) return

    const poll = async () => {
      try {
        const res = await fetch(`/api/print-jobs/status?jobIds=${printJobIds.join(',')}`)
        if (res.ok) {
          const data = await res.json()
          setPrintJobStatuses(data.jobs || [])
        }
      } catch {}
    }

    poll()
    const interval = setInterval(poll, 3000)
    return () => clearInterval(interval)
  }, [step, printJobIds, allJobsSettled])

  if (loading || paymentConfirming) return <UIPageSpinner />

  if (!event || !layout) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gray-50">
        <UIStatusBanner type="error" message={error || t('error.pageLoad')} />
      </div>
    )
  }

  // ---- Success screen with status tracking ----
  if (step === 'success') {
    const hasPending = printJobStatuses.some(j => j.status === 'PENDING')
    const hasPrinting = printJobStatuses.some(j => j.status === 'PRINTING')
    const hasFailed = printJobStatuses.some(j => j.status === 'FAILED')
    const allDone = allJobsSettled && !hasFailed
    const allFailed = allJobsSettled && printJobStatuses.every(j => j.status === 'FAILED')
    const maxQueue = Math.max(...printJobStatuses.filter(j => j.status === 'PENDING').map(j => j.queuePosition || 0), 0)

    let statusType: 'processing' | 'success' | 'error' = 'processing'
    let statusMessage = hasPrinting ? t('success.printing') : maxQueue > 1 ? `${t('success.pendingQueue')} ${maxQueue}${t('success.queueSuffix')}` : t('success.pending')

    if (allDone) {
      statusType = 'success'
      statusMessage = t('success.done')
    } else if (allFailed) {
      statusType = 'error'
      statusMessage = t('success.allFailed')
    } else if (!hasPending && printJobStatuses.length === 0) {
      statusType = 'success'
      statusMessage = t('success.sent')
    } else if (hasFailed && !allFailed) {
      statusType = 'error'
      statusMessage = t('success.someFailed')
    }

    return (
      <div className="min-h-dvh bg-gray-50 flex flex-col items-center px-4 py-8">
        <div className="w-full max-w-sm space-y-6">
          <UISectionHeading title={t('success.title')} subtitle={t('success.subtitle')} />

          <UIStatusBanner type={statusType} message={statusMessage} />

          {(layout?.price ?? event.price ?? 0) === 0 ? (
            <p className="text-center text-sm text-gray-500">{t('success.freeMsg')}</p>
          ) : (
            <p className="text-center text-sm text-gray-500">{t('success.paidMsg')}</p>
          )}

          {mergedUrl && (
            <div className="flex justify-center">
              <img src={mergedUrl} alt={t('misc.printPhoto')} className="rounded-lg shadow-lg object-contain" style={{ maxHeight: '40vh', maxWidth: '100%' }} />
            </div>
          )}

          {/* 후원 안내 */}
          {event?.donation?.enabled && (
            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl p-5 border border-yellow-200/80 text-center space-y-3">
              <p className="text-base font-bold text-gray-900">
                🎉 {event.donation.message || t('donate.defaultMsg')} 💕
              </p>
              <p className="text-xs text-gray-400">{t('donate.hint')} ☺️</p>
              {event.donation.link && (
                <a
                  href={event.donation.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-yellow-400 text-yellow-900 hover:bg-yellow-500 active:scale-95 transition-all font-bold text-[15px] shadow-md"
                >
                  ☕ {t('donate.btn')}
                </a>
              )}
              {event.donation.account && (
                <div className="bg-white/70 rounded-xl py-3 px-4 inline-flex items-center gap-2.5">
                  <div className="text-left">
                    <p className="text-[11px] text-gray-400 leading-none mb-1">{event.donation.bank}{event.donation.holder ? ` · ${event.donation.holder}` : ''}</p>
                    <p className="text-[15px] font-mono font-bold text-gray-800 tracking-wide">{event.donation.account}</p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(event.donation!.account.replace(/-/g, ''))
                      const btn = document.getElementById('copy-account-btn-layout')
                      if (btn) { btn.textContent = t('donate.copied'); setTimeout(() => { btn.textContent = t('donate.copy') }, 1500) }
                    }}
                    id="copy-account-btn-layout"
                    className="text-xs px-3 py-1.5 rounded-lg bg-yellow-400 text-yellow-900 hover:bg-yellow-500 transition-colors font-semibold shrink-0"
                  >
                    {t('donate.copy')}
                  </button>
                </div>
              )}
            </div>
          )}

          {event.contactPhone && (
            <p className="text-center text-xs text-gray-400">{t('misc.contact')} {event.contactPhone}</p>
          )}

          <div className="space-y-3">
            {!allFailed && (
              <UIButton fullWidth variant="download" onClick={handleDownload}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {t('btn.download')}
              </UIButton>
            )}
            {hasPending && !hasPrinting && printJobIds.length > 0 && (
              <UIButton fullWidth variant="danger" onClick={async () => {
                if (!confirm(t('success.confirmCancel'))) return
                try {
                  const results = await Promise.all(
                    printJobIds.map(id =>
                      fetch(`/api/print-jobs/job/${id}/cancel`, { method: 'POST' }).then(r => r.json())
                    )
                  )
                  const failed = results.filter(r => r.error)
                  if (failed.length > 0) {
                    alert(failed[0].error)
                  } else {
                    alert(t('success.cancelled'))
                    setStep('fill-photos')
                    setPrintJobIds([])
                    setPrintJobStatuses([])
                  }
                } catch {
                  alert(t('success.cancelError'))
                }
              }}>
                {t('btn.cancelPrint')}
              </UIButton>
            )}
            {hasPrinting && (
              <p className="text-center text-xs text-gray-400">{t('success.cantCancel')}</p>
            )}
            <UIButton fullWidth variant="secondary" onClick={() => router.push(`/${params.slug}`)}>{t('btn.newPhoto')}</UIButton>
          </div>
        </div>
      </div>
    )
  }

  const isPuzzleAvailable = event.puzzleEnabled === true
  const canCustomizeBg = layout.backgroundColorCustomizable ?? true
  const defaultColors = ['#FFFFFF', '#000000', '#FFB6C1', '#87CEEB', '#90EE90', '#DDA0DD']
  const availableColors = event.backgroundColors?.length ? event.backgroundColors : defaultColors
  const showColorStep = canCustomizeBg && availableColors.length > 1

  const stepBarSteps = showColorStep
    ? [
        { id: 'layout', label: t('step.layout') },
        { id: 'fill-photos', label: t('step.photo') },
        { id: 'select-bg-color', label: t('step.bgColor') },
        { id: 'payment', label: t('step.done') },
      ]
    : [
        { id: 'layout', label: t('step.layout') },
        { id: 'fill-photos', label: t('step.photo') },
        { id: 'payment', label: t('step.done') },
      ]

  return (
    <div className="min-h-dvh bg-gray-50 py-6 px-4">
      <Script src="https://pay.nicepay.co.kr/v1/js/" strategy="lazyOnload" />
      <div className="max-w-sm mx-auto space-y-5">
        {/* Header */}
        <div className="px-1 flex items-center gap-3">
          <img src={event.logoUrl || '/logo-without-bg.png'} alt={event.name} className="w-10 h-10 rounded-full object-cover" />
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">{event.name}</h1>
            <p className="text-sm text-gray-400 mt-0.5">{layout.name}</p>
          </div>
          <LanguageToggle />
        </div>

        {/* Step Bar */}
        <UIStepBar
          steps={stepBarSteps}
          currentStep={step}
        />

        <div className="bg-white shadow-sm border border-gray-100 p-5">
          {/* Step: Fill Photos */}
          {step === 'fill-photos' && !mergedUrl && (
            <FrameUserEditor
              key={layout._id}
              layout={layout}
              eventSlug={params.slug}
              backgroundColor={selectedColor}
              onComplete={handleComplete}
              onPhotosReady={handlePhotosReady}
              onBack={() => router.push(`/${params.slug}`)}
              onLayoutChange={filteredLayouts.length > 1 ? () => setShowLayoutPicker(true) : undefined}
            />
          )}

          {/* Step: Select Background Color */}
          {step === 'select-bg-color' && completedSlotData && (
            <div className="space-y-5">
              <UISectionHeading title={t('color.selectTitle')} subtitle={t('color.selectSubtitle')} />

              {/* Preview with selected color */}
              <div
                className="relative mx-auto overflow-hidden shadow border border-gray-100"
                style={{
                  aspectRatio: `${layout.canvasWidth} / ${layout.canvasHeight}`,
                  maxWidth: 280,
                  backgroundColor: selectedColor,
                }}
              >
                {/* Frame layers preview */}
                {layout.frameLayers
                  ?.filter(l => l.visible !== false)
                  .sort((a, b) => a.zIndex - b.zIndex)
                  .map(layer => (
                    <img
                      key={layer.id}
                      src={layer.imageUrl}
                      alt={layer.name}
                      className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                      style={{
                        zIndex: layer.zIndex,
                        opacity: layer.opacity ?? 1,
                        left: layer.x != null ? `${(layer.x / layout.canvasWidth) * 100}%` : 0,
                        top: layer.y != null ? `${(layer.y / layout.canvasHeight) * 100}%` : 0,
                        width: layer.width != null ? `${(layer.width / layout.canvasWidth) * 100}%` : '100%',
                        height: layer.height != null ? `${(layer.height / layout.canvasHeight) * 100}%` : '100%',
                      }}
                    />
                  ))}
                {/* Slot placeholders with cropped images */}
                {layout.slots
                  .sort((a, b) => (a.zIndex ?? 10) - (b.zIndex ?? 10))
                  .map((slot, i) => {
                    const slotData = completedSlotData.find(d => d.slotId === slot.id)
                    const slotState = slotData ? { croppedUrl: URL.createObjectURL(slotData.file) } : null
                    return (
                      <div
                        key={slot.id}
                        className="absolute overflow-hidden"
                        style={{
                          left: `${(slot.x / layout.canvasWidth) * 100}%`,
                          top: `${(slot.y / layout.canvasHeight) * 100}%`,
                          width: `${(slot.width / layout.canvasWidth) * 100}%`,
                          height: `${(slot.height / layout.canvasHeight) * 100}%`,
                          zIndex: slot.zIndex ?? 10,
                          backgroundColor: 'rgba(200,200,200,0.3)',
                        }}
                      >
                        {slotData && (
                          <img
                            src={URL.createObjectURL(slotData.file)}
                            alt={`슬롯 ${i + 1}`}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                    )
                  })}
              </div>

              {/* Color swatches */}
              <div className="flex justify-center gap-3 flex-wrap">
                {availableColors.map(color => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`w-12 h-12 rounded-full border-2 transition-all ${
                      selectedColor === color
                        ? 'border-blue-500 ring-2 ring-blue-200 scale-110'
                        : 'border-gray-200 hover:border-gray-400'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  >
                    {selectedColor === color && (
                      <svg className="w-5 h-5 mx-auto" fill="none" stroke={isLightColor(color) ? '#333' : '#fff'} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>

              {error && <UIStatusBanner type="error" message={error} />}
              {merging && (
                <div className="flex items-center justify-center gap-2 py-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
                  <span className="text-sm text-gray-500">{t('photo.merging')}</span>
                </div>
              )}

              <div className="space-y-2">
                <UIButton
                  fullWidth
                  onClick={() => { trackColorSelect(selectedColor, params.slug); performMerge(completedSlotData, selectedColor) }}
                  disabled={merging}
                  loading={merging}
                >
                  {t('color.confirm')}
                </UIButton>
                <UIButton
                  fullWidth
                  variant="secondary"
                  onClick={() => {
                    setStep('fill-photos')
                    setCompletedSlotData(null)
                  }}
                  disabled={merging}
                >
                  {t('color.reEdit')}
                </UIButton>
              </div>
            </div>
          )}

          {/* Preview after merge */}
          {step === 'fill-photos' && mergedUrl && (
            <div className="space-y-4">
              <UISectionHeading title={t('preview.title')} subtitle={t('preview.subtitle')} />

              {/* Main preview or puzzle preview */}
              {puzzleMode && puzzlePieceUrls.length > 0 ? (
                <div className="space-y-3">
                  {/* Puzzle animation preview */}
                  <div
                    className="relative mx-auto overflow-hidden shadow bg-gray-100"
                    style={{ aspectRatio: `${layout.canvasWidth} / ${layout.canvasHeight}`, maxWidth: 300 }}
                  >
                    {puzzlePieceUrls.map((url, index) => {
                      const col = index % gridSize
                      const row = Math.floor(index / gridSize)
                      const pctW = 100 / gridSize
                      const pctH = 100 / gridSize
                      const combinedX = col * pctW
                      const combinedY = row * pctH
                      const spreadFactor = 1.06
                      const centerX = 50 - pctW / 2
                      const centerY = 50 - pctH / 2
                      const splitX = centerX + (combinedX - centerX) * spreadFactor
                      const splitY = centerY + (combinedY - centerY) * spreadFactor

                      return (
                        <div
                          key={index}
                          className="absolute"
                          style={{
                            width: `${pctW}%`,
                            height: `${pctH}%`,
                            left: `${puzzleSplit ? splitX : combinedX}%`,
                            top: `${puzzleSplit ? splitY : combinedY}%`,
                            transform: `scale(${puzzleSplit ? 0.96 : 1})`,
                            transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                            padding: puzzleSplit ? '1px' : '0px',
                          }}
                        >
                          <img
                            src={url}
                            alt={`조각 ${index + 1}`}
                            className="w-full h-full object-cover"
                            style={{
                              border: puzzleSplit ? '1.5px solid rgb(192, 132, 252)' : '0px solid transparent',
                              transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                            }}
                          />
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-xs text-center text-gray-400">
                    {puzzleSplit ? `${totalPieces} ${t('puzzle.split')}` : t('puzzle.combined')}
                  </p>
                </div>
              ) : (
                <div
                  className="relative mx-auto overflow-hidden shadow"
                  style={{ aspectRatio: `${layout.canvasWidth} / ${layout.canvasHeight}`, maxWidth: 300 }}
                >
                  <Image src={mergedUrl} alt={t('misc.printPreview')} fill className="object-cover" unoptimized />
                </div>
              )}

              {error && <UIStatusBanner type="error" message={error} />}

              {/* Puzzle toggle */}
              {isPuzzleAvailable && (
                <div className="rounded-xl bg-purple-50 overflow-hidden">
                  <label className="flex items-center justify-between py-2.5 px-3 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🧩</span>
                      <span className="text-sm font-semibold text-purple-700">{t('puzzle.label')}</span>
                    </div>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={puzzleMode}
                        onChange={e => setPuzzleMode(e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`w-10 h-6 rounded-full transition-colors ${puzzleMode ? 'bg-purple-500' : 'bg-gray-300'}`} />
                      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${puzzleMode ? 'translate-x-4' : ''}`} />
                    </div>
                  </label>
                  {puzzleMode && (
                    <div className="px-3 pb-2.5 flex gap-2">
                      {(['2x2', '3x3', '4x4'] as const).map(grid => {
                        const n = grid === '4x4' ? 4 : grid === '3x3' ? 3 : 2
                        const isActive = puzzleGrid === grid
                        return (
                          <button
                            key={grid}
                            onClick={() => setPuzzleGrid(grid)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                              isActive
                                ? 'bg-purple-500 text-white shadow-sm'
                                : 'bg-white text-purple-600 border border-purple-200'
                            }`}
                          >
                            {grid} ({n * n} {t('puzzle.pieces')})
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Print quantity */}
              <div className="flex items-center justify-between py-2">
                <span className="text-sm font-semibold text-gray-700">
                  {puzzleMode ? t('puzzle.sets') : t('puzzle.printCount')}
                </span>
                <UICounterControl
                  value={printQuantity}
                  onChange={setPrintQuantity}
                  min={1}
                  max={10}
                />
              </div>

              {puzzleMode && (
                <p className="text-xs text-gray-400 text-center">
                  {printQuantity} {t('misc.set')} x {totalPieces} {t('puzzle.pieces')} = {t('misc.total')} {printQuantity * totalPieces} {t('misc.sheets')}
                </p>
              )}

              {/* Auth Code Input */}
              {event.authCodeRequired && !authCodeVerified && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">{t('auth.label')}</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={authCode}
                      onChange={e => { setAuthCode(e.target.value.toUpperCase()); setAuthCodeError('') }}
                      placeholder={t('auth.placeholder')}
                      maxLength={6}
                      className="flex-1 px-3 py-2 border rounded-lg text-center font-mono text-lg tracking-widest uppercase focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  {authCodeError && <p className="text-sm text-red-500">{authCodeError}</p>}
                </div>
              )}
              {event.authCodeRequired && authCodeVerified && (
                <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  {t('auth.verified')}
                </div>
              )}

              <div className="flex gap-3">
                <UIButton className="flex-1 min-w-0" onClick={handleGoToPayment} loading={printing} disabled={printing}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  {(layout?.price ?? event.price ?? 0) === 0
                    ? puzzleMode
                      ? `${t('btn.freePrint')} (${printQuantity * totalPieces}${t('misc.sheets')})`
                      : `${t('btn.freePrint')}${printQuantity > 1 ? ` (${printQuantity}${t('misc.sheets')})` : ''}`
                    : `${((layout?.price ?? event.price ?? 0) * printQuantity * (puzzleMode ? totalPieces : 1)).toLocaleString()}${t('misc.won')} ${t('btn.pay')}`}
                </UIButton>
              </div>
              <UIButton fullWidth variant="secondary" onClick={() => { setMergedUrl(null); setStep('fill-photos') }}>{t('btn.prevStep')}</UIButton>
              <p className="text-[11px] text-gray-400 text-center leading-relaxed pt-1">
                {t('preview.privacy')}
              </p>
            </div>
          )}

          {/* Step: Payment */}
          {step === 'payment' && (
            <div className="space-y-4">
              <UISectionHeading title={t('pay.title')} subtitle={t('pay.subtitle')} />

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">{t('pay.emailLabel')}</label>
                <div className="relative">
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={customerEmail}
                    onChange={e => handleEmailChange(e.target.value)}
                    onBlur={() => setTimeout(() => setShowEmailSuggestions(false), 150)}
                    placeholder="example@email.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {showEmailSuggestions && emailSuggestions.length > 0 && (
                    <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                      {emailSuggestions.map(s => (
                        <li
                          key={s}
                          onMouseDown={() => selectEmailSuggestion(s)}
                          className="px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0"
                        >
                          {s}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {error && <UIStatusBanner type="error" message={error} />}

              <UIButton
                fullWidth
                onClick={handlePayment}
                loading={paymentProcessing}
                disabled={paymentProcessing}
              >
                {paymentProcessing ? t('misc.payProcessing') : `${t('pay.card')} ${((layout?.price ?? event.price ?? 0) * printQuantity * (puzzleMode ? totalPieces : 1)).toLocaleString()}${t('misc.won')}`}
              </UIButton>
              <UIButton fullWidth variant="secondary" onClick={() => setStep('fill-photos')}>
                {t('btn.prevStep')}
              </UIButton>
            </div>
          )}

          {/* Step: Payment Failed */}
          {step === 'payment-failed' && (
            <div className="space-y-4">
              <UISectionHeading title={t('pay.failed.title')} subtitle={t('pay.failed.subtitle')} />
              <UIStatusBanner type="error" message={error || t('error.payment')} />
              <UIButton fullWidth onClick={() => setStep('payment')}>
                {t('pay.failed.retry')}
              </UIButton>
              <UIButton fullWidth variant="secondary" onClick={handleReset}>
                {t('pay.failed.back')}
              </UIButton>
            </div>
          )}
        </div>

        {/* Layout picker bottom sheet */}
        <UIBottomSheet open={showLayoutPicker} onClose={() => setShowLayoutPicker(false)} title={t('layout.changeLayout')}>
          <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pb-3">
            {filteredLayouts.map((sl) => {
              const isCurrent = sl._id === layout._id
              const isLandscape = sl.canvasWidth > sl.canvasHeight

              return (
                <UISelectItem
                  key={sl._id}
                  selected={isCurrent}
                  onClick={() => !isCurrent && handleLayoutSwitch(sl)}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className="relative overflow-hidden border border-gray-200 bg-white mx-auto"
                      style={{
                        aspectRatio: `${sl.canvasWidth} / ${sl.canvasHeight}`,
                        height: isLandscape ? undefined : 100,
                        width: isLandscape ? '100%' : undefined,
                        maxHeight: 100,
                      }}
                    >
                      {(sl.frameLayers || [])
                        .filter(l => l.visible !== false)
                        .sort((a, b) => a.zIndex - b.zIndex)
                        .map(layer => (
                          <img
                            key={layer.id}
                            src={layer.imageUrl}
                            alt=""
                            className="absolute inset-0 w-full h-full object-fill pointer-events-none"
                            style={{ zIndex: layer.zIndex, opacity: layer.opacity ?? 1 }}
                          />
                        ))}
                      {sl.slots.map((slot, idx) => (
                        <div
                          key={slot.id}
                          className="absolute bg-gray-100 border border-dashed border-gray-300 flex items-center justify-center"
                          style={{
                            left: `${(slot.x / sl.canvasWidth) * 100}%`,
                            top: `${(slot.y / sl.canvasHeight) * 100}%`,
                            width: `${(slot.width / sl.canvasWidth) * 100}%`,
                            height: `${(slot.height / sl.canvasHeight) * 100}%`,
                            zIndex: slot.zIndex ?? 10,
                          }}
                        >
                          <span className="text-[8px] font-bold text-gray-400">{idx + 1}</span>
                        </div>
                      ))}
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-sm text-gray-700">{sl.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{sl.printSize} · {sl.slots.length} {t('layout.slots')}</div>
                    </div>
                  </div>
                </UISelectItem>
              )
            })}
          </div>
          <UIButton fullWidth variant="secondary" onClick={() => setShowLayoutPicker(false)}>{t('btn.close')}</UIButton>
        </UIBottomSheet>

      </div>
    </div>
  )
}
