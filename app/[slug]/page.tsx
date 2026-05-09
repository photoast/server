'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import FourCutCropEditor from '../components/FourCutCropEditor'
import { UIButton, UIStatusBanner, UICounterControl, UISectionHeading, UIPageSpinner, UICardSpinner, UIStepBar, UISelectItem, UIBottomSheet } from '../components/ui'
import Script from 'next/script'
import {
  SinglePhotoPreview,
  FourCutPreview,
  TwoByTwoPreview,
  VerticalTwoPreview,
  OnePlusTwoPreview,
  LandscapeSinglePreview,
  LandscapeTwoPreview
} from '../components/LayoutPreviews'
import { LAYOUT_OPTIONS, getPhotoCount, getCropAspectRatioForSlot } from './layoutConfig'
import type { FrameType } from '@/lib/types'
import { logClientError, logClientInfo } from '@/lib/errorLogger'

interface Event {
  _id: string
  name: string
  slug: string
  printerUrl: string
  availableLayouts?: string[]
  supportedSizes?: string[]
  price?: number
  authCodeRequired?: boolean
  donation?: {
    enabled: boolean
    bank: string
    account: string
    holder?: string
    message?: string
    link?: string
  }
}

interface FrameLayoutOption {
  _id: string
  name: string
  printSize: string
  canvasWidth: number
  canvasHeight: number
  slots: { id: string; x: number; y: number; width: number; height: number; rotation: number; zIndex: number }[]
  frameLayers: { id: string; imageUrl: string; zIndex: number; opacity: number; visible: boolean }[]
  frameUrl: string | null
}

interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

interface CropSettings {
  cropPosition: { x: number; y: number }
  zoom: number
  rotation: number
}

interface PhotoSlot {
  index: number
  file: File | null
  cropArea: CropArea | null
  croppedImageUrl: string | null
  cropSettings?: CropSettings // 편집 상태 유지용
}

type Step = 'select-layout' | 'select-color' | 'fill-photos' | 'payment' | 'success'

// 토스페이먼츠 클라이언트 키 (테스트용)
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

const BACKGROUND_COLORS = [
  { name: '블랙', value: '#000000' },
  { name: '화이트', value: '#FFFFFF' },
  { name: '핑크', value: '#FFB6C1' },
  { name: '블루', value: '#87CEEB' },
  { name: '그린', value: '#90EE90' },
  { name: '퍼플', value: '#DDA0DD' }
]

const STEP_BAR_STEPS = [
  { id: 'select-layout', label: '레이아웃' },
  { id: 'select-color', label: '색상' },
  { id: 'fill-photos', label: '사진' },
  { id: 'payment', label: '완료' },
]

export default function GuestPage({ params }: { params: { slug: string } }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [customerEmail, setCustomerEmail] = useState('')

  // Event and loading state
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)

  // Step and layout state - initialize from URL
  const [step, setStep] = useState<Step>(() => {
    const urlStep = searchParams.get('step') as Step
    return urlStep && ['select-layout', 'select-color', 'fill-photos', 'payment', 'success'].includes(urlStep)
      ? urlStep
      : 'select-layout'
  })
  const [frameType, setFrameType] = useState<FrameType>(() => {
    const urlLayout = searchParams.get('layout') as FrameType
    return urlLayout || 'single'
  })
  const [backgroundColor, setBackgroundColor] = useState('#FFFFFF')

  // Photo management state
  const [photoSlots, setPhotoSlots] = useState<PhotoSlot[]>([])
  const [currentEditingSlot, setCurrentEditingSlot] = useState<number | null>(null)
  const [showCropEditor, setShowCropEditor] = useState(false)
  const [showActionModal, setShowActionModal] = useState(false)

  // Processing state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [error, setError] = useState('')
  const [printQuantity, setPrintQuantity] = useState(1)
  // Payment state
  const [paymentProcessing, setPaymentProcessing] = useState(false)
  const [paymentConfirming, setPaymentConfirming] = useState(false)

  // Auth code
  const [authCode, setAuthCode] = useState('')
  const [authCodeVerified, setAuthCodeVerified] = useState(false)
  const [authCodeError, setAuthCodeError] = useState('')

  // Print job tracking
  const [printJobIds, setPrintJobIds] = useState<string[]>([])
  const [printJobStatuses, setPrintJobStatuses] = useState<{ jobId: string; status: string; queuePosition?: number; errorMessage?: string }[]>([])

  // Frame layout options
  const [frameLayouts, setFrameLayouts] = useState<FrameLayoutOption[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Helper function to update URL with current step and layout
  const updateURL = useCallback((newStep?: Step, newLayout?: FrameType) => {
    const urlParams = new URLSearchParams(searchParams.toString())
    if (newStep) urlParams.set('step', newStep)
    if (newLayout) urlParams.set('layout', newLayout)
    router.replace(`/${params.slug}?${urlParams.toString()}`, { scroll: false })
  }, [router, params.slug, searchParams])

  // Wrapper functions that update both state and URL
  const updateStep = useCallback((newStep: Step) => {
    setStep(newStep)
    updateURL(newStep, frameType)
  }, [updateURL, frameType])

  const updateFrameType = useCallback((newFrameType: FrameType) => {
    setFrameType(newFrameType)
    updateURL(step, newFrameType)
  }, [updateURL, step])

  // Initialize photo slots when frame type changes
  useEffect(() => {
    const slotCount = getPhotoCount(frameType)
    setPhotoSlots(Array.from({ length: slotCount }, (_, i) => ({
      index: i,
      file: null,
      cropArea: null,
      croppedImageUrl: null,
    })))
    setPreviewUrl(null)
  }, [frameType])

  // Fetch event data + frame layouts
  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const res = await fetch(`/api/events/slug/${params.slug}`)
        if (!res.ok) throw new Error('Event not found')
        const data = await res.json()
        setEvent(data)

        // Fetch frame layouts for this event
        if (data._id) {
          fetch(`/api/layouts?eventId=${data._id}&visibleOnly=true`)
            .then(r => r.ok ? r.json() : [])
            .then(layouts => setFrameLayouts(Array.isArray(layouts) ? layouts : []))
            .catch(() => {})
        }
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to fetch event'
        setError(errorMessage)
        logClientError('Failed to fetch event data', err, params.slug)
      } finally {
        setLoading(false)
      }
    }
    fetchEvent()
  }, [params.slug])

  // Filter layouts by printer's supported sizes
  const filteredFrameLayouts = event?.supportedSizes
    ? frameLayouts.filter(sl => event.supportedSizes!.includes(sl.printSize))
    : frameLayouts

  // Auto-select layout if only one FrameLayout is available (and no special layouts)
  useEffect(() => {
    if (!event || step !== 'select-layout') return

    const availableLayouts = event.availableLayouts || []
    // If exactly one FrameLayout, auto-redirect
    if (filteredFrameLayouts.length === 1) {
      router.push(`/${params.slug}/layout/${filteredFrameLayouts[0]._id}`)
    }
  }, [event, step, filteredFrameLayouts, router, params.slug])

  // ============ Event Handlers ============

  // Process image handler (defined before useEffect that uses it)
  // ============================================
  // 공통 Canvas 렌더링 시스템
  // ============================================

  interface SlotConfig {
    x: number
    y: number
    width: number
    height: number
  }

  interface LayoutConfig {
    canvas: { width: number; height: number }
    slots: SlotConfig[]
  }

  // 레이아웃 설정 상수 (서버와 동일)
  const LAYOUT_CONFIG = {
    MARGIN_HORIZONTAL: 20,
    MARGIN_VERTICAL: 20,
    GAP: 20,
  }

  const FOUR_CUT_CONFIG = {
    MARGIN_OUTER: 13,
    GAP_CENTER: 26,
    GAP_BETWEEN_PHOTOS: 13,
  }

  // 각 레이아웃의 슬롯 배치 정보 (마진과 갭 포함, 서버 렌더링과 동일)
  const LAYOUT_CONFIGS: Record<string, LayoutConfig> = {
    'four-cut': (() => {
      const { MARGIN_OUTER, GAP_CENTER, GAP_BETWEEN_PHOTOS } = FOUR_CUT_CONFIG
      const stripWidth = Math.round((1200 - (MARGIN_OUTER * 2) - GAP_CENTER) / 2)
      const stripHeight = 1800 - (MARGIN_OUTER * 2)
      const totalGapsHeight = GAP_BETWEEN_PHOTOS * 3
      const photoHeight = Math.round((stripHeight - totalGapsHeight) / 4)
      const photoWidth = stripWidth
      const rightStripX = MARGIN_OUTER + stripWidth + GAP_CENTER

      return {
        canvas: { width: 1200, height: 1800 },
        slots: [
          // 왼쪽 스트립 - 4개 사진
          { x: MARGIN_OUTER, y: MARGIN_OUTER, width: photoWidth, height: photoHeight },
          { x: MARGIN_OUTER, y: MARGIN_OUTER + photoHeight + GAP_BETWEEN_PHOTOS, width: photoWidth, height: photoHeight },
          { x: MARGIN_OUTER, y: MARGIN_OUTER + (photoHeight + GAP_BETWEEN_PHOTOS) * 2, width: photoWidth, height: photoHeight },
          { x: MARGIN_OUTER, y: MARGIN_OUTER + (photoHeight + GAP_BETWEEN_PHOTOS) * 3, width: photoWidth, height: photoHeight },
          // 오른쪽 스트립 - 4개 사진 (동일하게 복제)
          { x: rightStripX, y: MARGIN_OUTER, width: photoWidth, height: photoHeight },
          { x: rightStripX, y: MARGIN_OUTER + photoHeight + GAP_BETWEEN_PHOTOS, width: photoWidth, height: photoHeight },
          { x: rightStripX, y: MARGIN_OUTER + (photoHeight + GAP_BETWEEN_PHOTOS) * 2, width: photoWidth, height: photoHeight },
          { x: rightStripX, y: MARGIN_OUTER + (photoHeight + GAP_BETWEEN_PHOTOS) * 3, width: photoWidth, height: photoHeight },
        ]
      }
    })(),
    'two-by-two': (() => {
      const { MARGIN_HORIZONTAL, MARGIN_VERTICAL, GAP } = LAYOUT_CONFIG
      const availableWidth = 1200 - (MARGIN_HORIZONTAL * 2)
      const availableHeight = 1800 - (MARGIN_VERTICAL * 2)
      const photoWidth = Math.round((availableWidth - GAP) / 2)
      const photoHeight = Math.round((availableHeight - GAP) / 2)

      return {
        canvas: { width: 1200, height: 1800 },
        slots: [
          { x: MARGIN_HORIZONTAL, y: MARGIN_VERTICAL, width: photoWidth, height: photoHeight },
          { x: MARGIN_HORIZONTAL + photoWidth + GAP, y: MARGIN_VERTICAL, width: photoWidth, height: photoHeight },
          { x: MARGIN_HORIZONTAL, y: MARGIN_VERTICAL + photoHeight + GAP, width: photoWidth, height: photoHeight },
          { x: MARGIN_HORIZONTAL + photoWidth + GAP, y: MARGIN_VERTICAL + photoHeight + GAP, width: photoWidth, height: photoHeight },
        ]
      }
    })(),
    'vertical-two': (() => {
      const { MARGIN_HORIZONTAL, MARGIN_VERTICAL, GAP } = LAYOUT_CONFIG
      const availableWidth = 1200 - (MARGIN_HORIZONTAL * 2)
      const availableHeight = 1800 - (MARGIN_VERTICAL * 2)
      const photoWidth = availableWidth
      const photoHeight = Math.round((availableHeight - GAP) / 2)

      return {
        canvas: { width: 1200, height: 1800 },
        slots: [
          { x: MARGIN_HORIZONTAL, y: MARGIN_VERTICAL, width: photoWidth, height: photoHeight },
          { x: MARGIN_HORIZONTAL, y: MARGIN_VERTICAL + photoHeight + GAP, width: photoWidth, height: photoHeight },
        ]
      }
    })(),
    'one-plus-two': (() => {
      const { MARGIN_HORIZONTAL, MARGIN_VERTICAL, GAP } = LAYOUT_CONFIG
      const availableWidth = 1200 - (MARGIN_HORIZONTAL * 2)
      const availableHeight = 1800 - (MARGIN_VERTICAL * 2)
      const largePhotoHeight = Math.round((availableHeight - GAP) / 2)
      const smallPhotoWidth = Math.round((availableWidth - GAP) / 2)
      const smallPhotoHeight = largePhotoHeight

      return {
        canvas: { width: 1200, height: 1800 },
        slots: [
          { x: MARGIN_HORIZONTAL, y: MARGIN_VERTICAL, width: availableWidth, height: largePhotoHeight },
          { x: MARGIN_HORIZONTAL, y: MARGIN_VERTICAL + largePhotoHeight + GAP, width: smallPhotoWidth, height: smallPhotoHeight },
          { x: MARGIN_HORIZONTAL + smallPhotoWidth + GAP, y: MARGIN_VERTICAL + largePhotoHeight + GAP, width: smallPhotoWidth, height: smallPhotoHeight },
        ]
      }
    })(),
    'landscape-single': {
      canvas: { width: 1800, height: 1200 },
      slots: [
        { x: 0, y: 0, width: 1800, height: 1200 },
      ]
    },
    'landscape-two': (() => {
      const { MARGIN_HORIZONTAL, MARGIN_VERTICAL, GAP } = LAYOUT_CONFIG
      const availableWidth = 1800 - (MARGIN_HORIZONTAL * 2)
      const availableHeight = 1200 - (MARGIN_VERTICAL * 2)
      const photoWidth = Math.round((availableWidth - GAP) / 2)
      const photoHeight = availableHeight

      return {
        canvas: { width: 1800, height: 1200 },
        slots: [
          { x: MARGIN_HORIZONTAL, y: MARGIN_VERTICAL, width: photoWidth, height: photoHeight },
          { x: MARGIN_HORIZONTAL + photoWidth + GAP, y: MARGIN_VERTICAL, width: photoWidth, height: photoHeight },
        ]
      }
    })(),
    'single': {
      canvas: { width: 1200, height: 1800 },
      slots: [
        { x: 0, y: 0, width: 1200, height: 1800 },
      ]
    },
  }

  // 이미지 로드 헬퍼 함수
  const loadImage = async (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image()
      if (!src.startsWith('blob:') && !src.startsWith('data:') && !src.startsWith('/uploads/')) {
        img.crossOrigin = 'anonymous'
      }
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
      img.src = src
    })
  }

  // Canvas를 Blob으로 변환
  const canvasToBlob = async (canvas: HTMLCanvasElement, quality = 0.95): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Failed to create blob from canvas'))
      }, 'image/jpeg', quality)
    })
  }

  // 공통 레이아웃 렌더링 함수
  const renderLayoutToCanvas = async (layout: FrameType): Promise<Blob> => {
    const config = LAYOUT_CONFIGS[layout]
    if (!config) {
      throw new Error(`Layout config not found: ${layout}`)
    }

    console.log(`[Canvas] Rendering ${layout} layout...`)

    const canvas = document.createElement('canvas')
    canvas.width = config.canvas.width
    canvas.height = config.canvas.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas context not available')

    // 화질 최대 설정
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    // 배경색 채우기
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    console.log(`[Canvas] Background filled: ${backgroundColor}`)

    // 각 슬롯에 사진 그리기
    for (let i = 0; i < config.slots.length; i++) {
      const slotConfig = config.slots[i]

      // Four-cut: 오른쪽 스트립(슬롯 4-7)은 왼쪽 스트립(슬롯 0-3)과 동일한 사진 사용
      const photoIndex = layout === 'four-cut' && i >= 4 ? i - 4 : i
      const photoSlot = photoSlots[photoIndex]

      if (photoSlot?.croppedImageUrl) {
        console.log(`[Canvas] Loading photo ${photoIndex + 1} for slot ${i + 1}/${config.slots.length}...`)
        const img = await loadImage(photoSlot.croppedImageUrl)
        console.log(`[Canvas] Drawing photo at slot ${i + 1}: (${slotConfig.x}, ${slotConfig.y})`)
        ctx.drawImage(img, slotConfig.x, slotConfig.y, slotConfig.width, slotConfig.height)
      }
    }

    console.log('[Canvas] Converting to blob...')
    const blob = await canvasToBlob(canvas, 0.95)
    console.log(`[Canvas] Blob created, size: ${blob.size} bytes`)

    return blob
  }

  const handleProcess = useCallback(async () => {
    setProcessing(true)
    setError('')

    try {
      console.log(`[handleProcess] Processing ${frameType} layout with client-side rendering`)
      logClientInfo('[Mobile] Using client-side Canvas rendering', params.slug, { frameType })

      // 모든 사진이 crop되었는지 확인
      const expectedPhotoCount = getPhotoCount(frameType)
      const validPhotos = photoSlots.filter(slot => slot.croppedImageUrl !== null)

      if (validPhotos.length !== expectedPhotoCount) {
        throw new Error('모든 사진을 선택하고 편집해주세요')
      }

      // 클라이언트에서 Canvas로 렌더링
      console.log(`[handleProcess] Rendering ${frameType} with common Canvas function`)
      const imageBlob = await renderLayoutToCanvas(frameType)

      console.log('[handleProcess] Canvas rendered, blob size:', imageBlob.size)

      // 서버에 렌더링된 이미지 전송
      const formData = new FormData()
      formData.append('slug', params.slug)
      formData.append('frameType', frameType)
      formData.append('preRenderedImage', imageBlob, 'preview.jpg')
      formData.append('applyPrinterCorrectionOnly', 'true')

      console.log('[handleProcess] Sending request to /api/process-image')
      logClientInfo('[Mobile] Sending fetch request', params.slug, { frameType })

      const res = await fetch('/api/process-image', {
        method: 'POST',
        body: formData,
      })

      logClientInfo('[Mobile] Fetch response received', params.slug, { status: res.status, ok: res.ok })

      if (!res.ok) {
        let errorMsg = `미리보기 생성 실패: ${res.status}`
        let errorDetails = null
        try {
          const data = await res.json()
          errorMsg = data.error || errorMsg
          errorDetails = data
          console.error('[handleProcess] Server error response:', data)
          logClientError('[Mobile] Server returned error', new Error(errorMsg), params.slug, {
            status: res.status,
            errorDetails,
            frameType
          })
        } catch (jsonErr) {
          console.error('[handleProcess] Failed to parse error response:', jsonErr)
          logClientError('[Mobile] Failed to parse error response', jsonErr as Error, params.slug, { status: res.status })
          try {
            const text = await res.text()
            console.error('[handleProcess] Error response text:', text)
          } catch (textErr) {
            console.error('[handleProcess] Failed to read error text:', textErr)
          }
        }
        console.error('[handleProcess] Process image error:', { status: res.status, errorMsg, errorDetails })
        throw new Error(errorMsg)
      }

      console.log('[handleProcess] Response OK, parsing JSON...')
      const data = await res.json()
      console.log('[handleProcess] Preview URL received:', data.url)
      logClientInfo('[Mobile] Preview URL received', params.slug, { url: data.url })

      if (!data.url) {
        throw new Error('미리보기 URL을 받지 못했습니다')
      }

      // Validate URL format
      if (typeof data.url !== 'string' || data.url.length === 0) {
        throw new Error('잘못된 미리보기 URL 형식')
      }

      setPreviewUrl(data.url)
      console.log('Preview URL set successfully')
      logClientInfo('[Mobile] Preview URL set successfully', params.slug, { frameType })
    } catch (err: any) {
      const errorMessage = err.message || '미리보기 생성에 실패했습니다'
      console.error('[handleProcess] ERROR:', err)
      console.error('[handleProcess] Error details:', {
        message: err.message,
        stack: err.stack,
        frameType,
        photoSlotsCount: photoSlots.length,
        filledSlotsCount: photoSlots.filter(s => s.file !== null).length,
        croppedSlotsCount: photoSlots.filter(s => s.cropArea !== null).length,
        backgroundColor,
      })
      setError(errorMessage)
      logClientError('Failed to process image', err, params.slug, {
        frameType,
        photoSlotsCount: photoSlots.length,
        filledSlotsCount: photoSlots.filter(s => s.file !== null).length,
        croppedSlotsCount: photoSlots.filter(s => s.cropArea !== null).length,
        backgroundColor,
        errorMessage: err.message,
      })
    } finally {
      setProcessing(false)
      console.log('[handleProcess] Processing complete, processing=false')
    }
  }, [params.slug, frameType, photoSlots, backgroundColor])


  // Auto-process image when all slots are filled AND cropped
  useEffect(() => {
    const allSlotsFilled = photoSlots.every(slot => slot.file !== null && slot.cropArea !== null)
    if (allSlotsFilled && photoSlots.length > 0 && !processing && !previewUrl && step === 'fill-photos') {
      console.log('Auto-processing with all slots filled and cropped')
      handleProcess()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoSlots, step, previewUrl, processing])

  const handleSlotClick = (slotIndex: number) => {
    setCurrentEditingSlot(slotIndex)

    // If photo already exists, show action modal
    if (photoSlots[slotIndex]?.file) {
      setShowActionModal(true)
    } else {
      // Otherwise, open file picker
      if (fileInputRef.current) {
        fileInputRef.current.click()
      }
    }
  }

  const handleEditPhoto = () => {
    setShowActionModal(false)
    setShowCropEditor(true)
  }

  const handleReplacePhoto = () => {
    setShowActionModal(false)
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleDeletePhoto = () => {
    if (currentEditingSlot === null) return

    setPhotoSlots(prevSlots => {
      const newSlots = [...prevSlots]
      if (newSlots[currentEditingSlot].croppedImageUrl) {
        URL.revokeObjectURL(newSlots[currentEditingSlot].croppedImageUrl!)
      }
      newSlots[currentEditingSlot] = {
        ...newSlots[currentEditingSlot],
        file: null,
        cropArea: null,
        croppedImageUrl: null
      }
      return newSlots
    })
    setPreviewUrl(null)
    setShowActionModal(false)
    setCurrentEditingSlot(null)
  }

  // Compress image to reduce file size
  const compressImage = async (file: File, maxSizeMB = 1.5): Promise<File> => {
    // Check if file is HEIC/HEIF format
    const isHeic = file.name.toLowerCase().endsWith('.heic') ||
                   file.name.toLowerCase().endsWith('.heif') ||
                   file.type === 'image/heic' ||
                   file.type === 'image/heif'

    // Convert HEIC to JPEG first (browser can't process HEIC directly)
    let fileToCompress = file
    if (isHeic) {
      try {
        console.log('[compressImage] HEIC file detected, converting to JPEG...')
        // Dynamic import to avoid SSR issues (heic2any uses window)
        const heic2any = (await import('heic2any')).default
        const jpegBlob = await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: 0.9
        }) as Blob

        // Convert Blob to File
        fileToCompress = new File(
          [jpegBlob],
          file.name.replace(/\.(heic|heif)$/i, '.jpg'),
          { type: 'image/jpeg', lastModified: Date.now() }
        )

        logClientInfo('HEIC converted to JPEG', undefined, {
          originalFile: file.name,
          originalSize: `${(file.size / (1024 * 1024)).toFixed(2)}MB`,
          convertedSize: `${(fileToCompress.size / (1024 * 1024)).toFixed(2)}MB`
        })
        console.log('[compressImage] HEIC converted successfully')
      } catch (error) {
        console.error('[compressImage] HEIC conversion failed:', error)
        logClientError('Failed to convert HEIC to JPEG', error as Error, undefined, {
          fileName: file.name
        })
        throw new Error('HEIC 변환에 실패했습니다')
      }
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(fileToCompress)
      reader.onload = (e) => {
        const img = new window.Image()
        img.src = e.target?.result as string
        img.onload = () => {
          const canvas = document.createElement('canvas')
          let width = img.width
          let height = img.height

          // Calculate new dimensions to keep aspect ratio
          const maxDimension = 2048
          if (width > height && width > maxDimension) {
            height = (height * maxDimension) / width
            width = maxDimension
          } else if (height > maxDimension) {
            width = (width * maxDimension) / height
            height = maxDimension
          }

          canvas.width = width
          canvas.height = height

          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('Failed to get canvas context'))
            return
          }

          ctx.drawImage(img, 0, 0, width, height)

          // Try different quality levels to achieve target size
          let quality = 0.9
          const tryCompress = () => {
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  reject(new Error('Failed to compress image'))
                  return
                }

                const sizeMB = blob.size / (1024 * 1024)

                // If still too large and quality can be reduced, try again
                if (sizeMB > maxSizeMB && quality > 0.5) {
                  quality -= 0.1
                  tryCompress()
                  return
                }

                const compressedFile = new File([blob], fileToCompress.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now()
                })

                logClientInfo('Image compressed', undefined, {
                  originalSize: `${(fileToCompress.size / (1024 * 1024)).toFixed(2)}MB`,
                  compressedSize: `${sizeMB.toFixed(2)}MB`,
                  quality: quality.toFixed(1),
                  dimensions: `${width}x${height}`
                })

                resolve(compressedFile)
              },
              'image/jpeg',
              quality
            )
          }

          tryCompress()
        }
        img.onerror = () => reject(new Error('Failed to load image'))
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
    })
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (currentEditingSlot === null) return

    const file = e.target.files?.[0]
    if (!file) return

    try {
      // Compress image before processing
      const compressedFile = await compressImage(file)

      // Update slot with compressed file
      setPhotoSlots(prevSlots => {
        const newSlots = [...prevSlots]
        newSlots[currentEditingSlot] = {
          ...newSlots[currentEditingSlot],
          file: compressedFile,
          cropArea: null,
          croppedImageUrl: null
        }
        return newSlots
      })

      // Clear preview when adding new photo
      setPreviewUrl(null)

      // Open crop editor
      setShowCropEditor(true)
    } catch (error) {
      logClientError('Failed to compress image', error, undefined, {
        slotNumber: currentEditingSlot + 1
      })
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleCropComplete = (result: {
    cropAreas: (CropArea | null)[],
    croppedImageUrls: string[],
    cropSettings: Array<{ cropPosition: { x: number; y: number }; zoom: number; rotation: number }>
  }) => {
    if (currentEditingSlot === null) return

    setPhotoSlots(prevSlots => {
      const newSlots = [...prevSlots]
      newSlots[currentEditingSlot] = {
        ...newSlots[currentEditingSlot],
        cropArea: result.cropAreas[0],
        croppedImageUrl: result.croppedImageUrls[0],
        cropSettings: result.cropSettings[0] // 편집 상태 저장
      }
      return newSlots
    })

    // Clear preview to trigger regeneration via useEffect
    setPreviewUrl(null)
    setShowCropEditor(false)
    setCurrentEditingSlot(null)
  }

  const handleCropCancel = () => {
    if (currentEditingSlot === null) return

    // 기존에 편집된 사진이 있었는지 확인 (cropSettings가 있으면 기존 편집이었음)
    const hadExistingEdit = photoSlots[currentEditingSlot]?.cropSettings !== undefined

    if (!hadExistingEdit) {
      // 새 사진을 선택하다가 취소한 경우에만 삭제
      setPhotoSlots(prevSlots => {
        const newSlots = [...prevSlots]
        if (newSlots[currentEditingSlot].croppedImageUrl) {
          URL.revokeObjectURL(newSlots[currentEditingSlot].croppedImageUrl!)
        }
        newSlots[currentEditingSlot] = {
          ...newSlots[currentEditingSlot],
          file: null,
          cropArea: null,
          croppedImageUrl: null,
          cropSettings: undefined
        }
        return newSlots
      })
    }
    // 기존 사진 편집 중 취소면 아무것도 변경하지 않음 (기존 상태 유지)

    setShowCropEditor(false)
    setCurrentEditingSlot(null)
  }

  const handleDownload = async () => {
    if (!previewUrl) return

    try {
      let blob: Blob
      if (previewUrl.startsWith('data:')) {
        blob = await (await fetch(previewUrl)).blob()
      } else {
        const absoluteUrl = previewUrl.startsWith('http')
          ? previewUrl
          : `${window.location.origin}${previewUrl}`
        blob = await (await fetch(absoluteUrl)).blob()
      }

      const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' })

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] })
      } else {
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = file.name
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setError('다운로드에 실패했습니다')
        logClientError('Failed to download image', err, params.slug, { previewUrl, frameType })
      }
    }
  }

  const handlePrint = async () => {
    if (!previewUrl) return

    setPrinting(true)
    setError('')

    try {
      const res = await fetch('/api/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: params.slug,
          imageUrl: previewUrl,
          quantity: printQuantity,
          ...(event?.authCodeRequired && authCode ? { authCode } : {}),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to print')
      }

      const data = await res.json()
      if (data.jobIds) setPrintJobIds(data.jobIds)

      updateStep('success')
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to print'
      setError(errorMessage)
      logClientError('Failed to print image', err, params.slug, {
        previewUrl,
        frameType,
        quantity: printQuantity,
      })
    } finally {
      setPrinting(false)
    }
  }

  const handleVerifyAuthCode = async (): Promise<boolean> => {
    if (!event?.authCodeRequired) return true
    if (authCodeVerified) return true
    if (!authCode.trim()) {
      setAuthCodeError('인증코드를 입력해주세요')
      return false
    }
    try {
      const res = await fetch('/api/auth-codes/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: params.slug, code: authCode.trim() }),
      })
      const data = await res.json()
      if (data.valid) {
        setAuthCodeVerified(true)
        setAuthCodeError('')
        return true
      }
      setAuthCodeError(data.error || '유효하지 않은 인증코드입니다')
      return false
    } catch {
      setAuthCodeError('인증코드 확인 중 오류가 발생했습니다')
      return false
    }
  }

  // 결제 페이지로 이동
  const handleGoToPayment = async () => {
    if (!previewUrl) return

    if (event?.authCodeRequired && !authCodeVerified) {
      const valid = await handleVerifyAuthCode()
      if (!valid) return
    }

    const unitPrice = event?.price ?? 0
    const paymentAmount = unitPrice * printQuantity

    // 무료 (0원)인 경우 결제 단계 건너뛰고 바로 프린트
    if (paymentAmount === 0) {
      await handlePrint()
      return
    }

    updateStep('payment')
    setError('')
  }

  // 나이스페이 결제 실행
  const handlePayment = () => {
    if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      setError('올바른 이메일을 입력해주세요')
      return
    }
    if (!window.AUTHNICE) {
      setError('결제 모듈을 불러오는 중입니다. 잠시 후 다시 시도해주세요.')
      return
    }

    const unitPrice = event?.price ?? 0
    const paymentAmount = unitPrice * printQuantity
    const orderId = `PRINT_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    setPaymentProcessing(true)
    setError('')

    window.AUTHNICE.requestPay({
      clientId: NICEPAY_CLIENT_ID,
      method: 'card',
      orderId,
      amount: paymentAmount,
      goodsName: `포토 프린트 ${printQuantity}매`,
      returnUrl: `${window.location.origin}/api/payment/nicepay-return`,
      mallReserved: window.location.pathname,
      fnError: (result) => {
        setError(result.errorMsg || '결제 중 오류가 발생했습니다')
        setPaymentProcessing(false)
      },
    })
  }

  // URL 파라미터로 결제 결과 처리 (나이스페이 returnUrl 리다이렉트 후)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const paymentStatus = urlParams.get('payment')
    const tid = urlParams.get('tid')
    const orderId = urlParams.get('orderId')
    const amount = urlParams.get('amount')

    if (paymentStatus === 'success' && tid && orderId && amount) {
      setPaymentConfirming(true)

      const confirmPayment = async () => {
        setError('')

        try {
          const paymentRes = await fetch('/api/payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tid,
              orderId,
              amount: Number(amount),
              eventSlug: params.slug,
            }),
          })

          if (!paymentRes.ok) {
            const data = await paymentRes.json()
            throw new Error(data.error || '결제 승인에 실패했습니다')
          }

          const savedPreviewUrl = localStorage.getItem('pendingPrintUrl')
          if (!savedPreviewUrl) {
            throw new Error('프린트할 이미지를 찾을 수 없습니다')
          }

          const savedAuthCode = localStorage.getItem('pendingAuthCode')
          const savedEmail = localStorage.getItem('pendingCustomerEmail')
          const printRes = await fetch('/api/print', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              slug: params.slug,
              imageUrl: savedPreviewUrl,
              paymentTid: tid,
              ...(savedAuthCode ? { authCode: savedAuthCode } : {}),
              ...(savedEmail ? { customerEmail: savedEmail } : {}),
            }),
          })

          if (!printRes.ok) {
            const data = await printRes.json()
            throw new Error(data.error || '프린트에 실패했습니다')
          }
          const printData = await printRes.json()
          if (printData.jobIds) setPrintJobIds(printData.jobIds)

          localStorage.removeItem('pendingPrintUrl')
          localStorage.removeItem('pendingAuthCode')
          localStorage.removeItem('pendingCustomerEmail')
          window.history.replaceState({}, '', window.location.pathname)
          updateStep('success')

        } catch (err: any) {
          console.error('Payment confirmation error:', err)
          setError(err.message || '결제 처리 중 오류가 발생했습니다')
          logClientError('Payment confirmation failed', err, params.slug)
          updateStep('fill-photos')
          window.history.replaceState({}, '', window.location.pathname)
        } finally {
          setPaymentConfirming(false)
        }
      }

      confirmPayment()
    } else if (paymentStatus === 'fail') {
      const errorMsg = urlParams.get('errorMsg')
      setError(errorMsg || '결제가 실패했습니다. 다시 시도해주세요.')
      updateStep('fill-photos')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [params.slug])

  // 결제 페이지로 가기 전 previewUrl 저장
  useEffect(() => {
    if (step === 'payment' && previewUrl) {
      localStorage.setItem('pendingPrintUrl', previewUrl)
      if (authCode) localStorage.setItem('pendingAuthCode', authCode)
      if (customerEmail) localStorage.setItem('pendingCustomerEmail', customerEmail)
    }
  }, [step, previewUrl])

  const handleReset = () => {
    updateStep('select-layout')
    updateFrameType('single')
    setBackgroundColor('#FFFFFF')
    setPhotoSlots([])
    setPreviewUrl(null)
    setError('')
    setPrintQuantity(1)
    setPrintJobIds([])
    setPrintJobStatuses([])
  }

  // Poll print job status when on success screen
  const allJobsSettled = printJobStatuses.length > 0 &&
    printJobStatuses.every(j => j.status === 'DONE' || j.status === 'FAILED')

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

  // ============ Render Helpers ============

  const renderLayoutPreview = () => {
    const baseProps = {
      photoSlots,
      onSlotClick: handleSlotClick,
      backgroundColor
    }

    switch (frameType) {
      case 'single':
        return <SinglePhotoPreview {...baseProps} />
      case 'landscape-single':
        return <LandscapeSinglePreview {...baseProps} />
      case 'landscape-two':
        return <LandscapeTwoPreview {...baseProps} />
      case 'four-cut':
        return <FourCutPreview {...baseProps} />
      case 'two-by-two':
        return <TwoByTwoPreview {...baseProps} />
      case 'vertical-two':
        return <VerticalTwoPreview {...baseProps} />
      case 'one-plus-two':
        return <OnePlusTwoPreview {...baseProps} />
      default:
        return null
    }
  }

  const renderLayoutOptionPreview = (type: FrameType) => {
    // Landscape layouts have different aspect ratio
    const isLandscape = type === 'landscape-single' || type === 'landscape-two'

    const gridStyles: Record<FrameType, string> = {
      'single': 'grid-cols-1 grid-rows-1',
      'landscape-single': 'grid-cols-1 grid-rows-1',
      'landscape-two': 'grid-cols-2 grid-rows-1',
      'vertical-two': 'grid-cols-1 grid-rows-2',
      'one-plus-two': 'grid-cols-2 grid-rows-2',
      'four-cut': 'grid-cols-1 grid-rows-4',
      'two-by-two': 'grid-cols-2 grid-rows-2',
    }

    const getCells = (): { colspan?: number, rowspan?: number }[] => {
      switch (type) {
        case 'single': return [{ colspan: 1, rowspan: 1 }]
        case 'landscape-single': return [{ colspan: 1, rowspan: 1 }]
        case 'landscape-two': return [{}, {}]
        case 'vertical-two': return [{}, {}]
        case 'one-plus-two': return [{ colspan: 2 }, {}, {}]
        case 'four-cut': return [{}, {}, {}, {}]
        case 'two-by-two': return [{}, {}, {}, {}]
        default: return []
      }
    }

    // Four-cut is half width (represents strip that gets cut in half)
    const isFourCut = type === 'four-cut'

    return (
      <div className={`grid gap-0.5 bg-gray-300 rounded overflow-hidden ${gridStyles[type]} ${isLandscape ? 'h-10 w-16' : isFourCut ? 'h-16 w-5' : 'h-16 w-10'}`}>
        {getCells().map((cell, i) => (
          <div
            key={i}
            className="bg-purple-400"
            style={{
              gridColumn: cell.colspan ? `span ${cell.colspan}` : undefined,
              gridRow: cell.rowspan ? `span ${cell.rowspan}` : undefined
            }}
          />
        ))}
      </div>
    )
  }

  // ============ Loading State ============

  // 결제 승인 처리 중일 때 전용 로딩 화면
  if (paymentConfirming) {
    return (
      <UICardSpinner
        label="결제 처리 중..."
        sublabel="잠시만 기다려주세요"
      />
    )
  }

  if (loading) {
    return <UIPageSpinner />
  }

  if (!event) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50">
        <div className="text-center">
          <p className="text-red-600 text-xl mb-4">이벤트를 찾을 수 없습니다</p>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  const allSlotsFilled = photoSlots.every(slot => slot.file !== null)

  // ============ Main Render ============

  return (
    <div className="min-h-dvh bg-gray-50 py-6 px-4">
      <Script src="https://pay.nicepay.co.kr/v1/js/" strategy="lazyOnload" />
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-4 px-1 flex items-center gap-3">
          <img src="/logo-without-bg.png" alt="Photo Toast" className="w-10 h-10" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">{event.name}</h1>
            <p className="text-sm text-gray-400 mt-0.5">사진을 선택해 인쇄해보세요</p>
          </div>
        </div>

        {/* Step Bar */}
        {step !== 'success' && (
          <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 mb-4">
            <UIStepBar
              steps={STEP_BAR_STEPS.filter(s => {
                if (s.id === 'select-color' && frameType === 'single') return false
                return true
              })}
              currentStep={step}
            />
          </div>
        )}

        {/* Main Content */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          {/* Step 1: Select Layout */}
          {step === 'select-layout' && (
            <div className="space-y-6">
              <UISectionHeading title="레이아웃 선택" subtitle="원하는 스타일을 골라보세요" />

              {/* FrameLayout 기반 레이아웃 그리드 (통합) */}
              <div className="grid grid-cols-2 gap-3">
                {filteredFrameLayouts.map((sl) => {
                  const isLandscape = sl.canvasWidth > sl.canvasHeight

                  return (
                    <UISelectItem
                      key={`frame-${sl._id}`}
                      selected={false}
                      onClick={() => router.push(`/${params.slug}/layout/${sl._id}`)}
                    >
                      <div className="flex flex-col items-center gap-2">
                        {/* Layout preview with frame layers + slot placeholders */}
                        <div
                          className="relative overflow-hidden border border-gray-200 bg-white mx-auto"
                          style={{
                            aspectRatio: `${sl.canvasWidth} / ${sl.canvasHeight}`,
                            height: isLandscape ? undefined : 120,
                            width: isLandscape ? '100%' : undefined,
                            maxHeight: 120,
                          }}
                        >
                          {/* Frame layers */}
                          {(sl.frameLayers || [])
                            .filter(l => l.visible)
                            .sort((a, b) => a.zIndex - b.zIndex)
                            .map(layer => (
                              <img
                                key={layer.id}
                                src={layer.imageUrl}
                                alt=""
                                className="absolute inset-0 w-full h-full object-fill pointer-events-none"
                                style={{ zIndex: layer.zIndex, opacity: layer.opacity }}
                              />
                            ))}
                          {/* Legacy frameUrl fallback */}
                          {(!sl.frameLayers || sl.frameLayers.length === 0) && sl.frameUrl && (
                            <img src={sl.frameUrl} alt="" className="absolute inset-0 w-full h-full object-fill pointer-events-none" style={{ zIndex: 100 }} />
                          )}
                          {/* Slot placeholders */}
                          {sl.canvasWidth > 0 && sl.slots.map((slot, idx) => (
                            <div
                              key={slot.id}
                              className="absolute bg-gray-100 border border-dashed border-gray-300 flex items-center justify-center"
                              style={{
                                left: `${(slot.x / sl.canvasWidth) * 100}%`,
                                top: `${(slot.y / sl.canvasHeight) * 100}%`,
                                width: `${(slot.width / sl.canvasWidth) * 100}%`,
                                height: `${(slot.height / sl.canvasHeight) * 100}%`,
                                zIndex: slot.zIndex ?? 10,
                                transform: (slot.rotation ?? 0) !== 0 ? `rotate(${slot.rotation}deg)` : undefined,
                                transformOrigin: 'top left',
                              }}
                            >
                              <span className="text-[8px] font-bold text-gray-400">{idx + 1}</span>
                            </div>
                          ))}
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-sm text-gray-700">{sl.name}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{sl.printSize} · {sl.slots.length}칸</div>
                        </div>
                      </div>
                    </UISelectItem>
                  )
                })}

              </div>
              {frameLayouts.length > 1 && (
                <p className="text-xs text-gray-400 text-center mt-2">사진 선택 후에도 레이아웃을 변경할 수 있어요</p>
              )}
            </div>
          )}

          {/* Step 2: Select Color (skip for single photo) */}
          {step === 'select-color' && (
            <div className="space-y-5">
              <UISectionHeading title="배경 색상" subtitle="배경색을 선택해주세요" />

              <div className="grid grid-cols-3 gap-2">
                {BACKGROUND_COLORS.map((color) => (
                  <UISelectItem
                    key={color.value}
                    selected={backgroundColor === color.value}
                    onClick={() => setBackgroundColor(color.value)}
                    className="text-center"
                  >
                    <div
                      className="w-full h-12 rounded-lg mb-2 border border-gray-100"
                      style={{ backgroundColor: color.value }}
                    />
                    <div className={`text-xs font-semibold ${backgroundColor === color.value ? 'text-blue-600' : 'text-gray-600'}`}>
                      {color.name}
                    </div>
                  </UISelectItem>
                ))}
              </div>

              <div className="flex gap-2">
                <UIButton variant="secondary" size="md" className="flex-1" onClick={() => updateStep('select-layout')}>
                  이전
                </UIButton>
                <UIButton size="md" className="flex-1" onClick={() => updateStep('fill-photos')}>
                  다음으로
                </UIButton>
              </div>
            </div>
          )}

          {/* Step 3: Fill Photos */}
          {step === 'fill-photos' && (
            <div className="space-y-6">
              {/* Header with layout info */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    {LAYOUT_OPTIONS.find(l => l.type === frameType)?.name}
                  </h2>
                  <p className="text-sm text-gray-400 mt-0.5">
                    {LAYOUT_OPTIONS.find(l => l.type === frameType)?.description}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-gray-900 tabular-nums">
                    {photoSlots.filter(s => s.file).length}/{photoSlots.length}
                  </div>
                  <div className="text-xs text-gray-400">사진 완료</div>
                </div>
              </div>

              {/* Status Banner */}
              {allSlotsFilled ? (
                <UIStatusBanner type="success" message="준비됐어요. 아래 버튼으로 프린트할 수 있어요." />
              ) : (
                <UIStatusBanner type="info" message="사진 영역을 탭해서 추가해주세요." />
              )}

              {/* Layout Preview */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">미리보기</h3>
                  {allSlotsFilled && (
                    <span className="text-xs bg-green-50 text-green-600 px-2.5 py-1 rounded-full font-medium">
                      준비 완료
                    </span>
                  )}
                </div>
                <div className="transition-all duration-300">
                  {renderLayoutPreview()}
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-center text-sm text-gray-500">
                    사진을 탭해 추가하거나 변경할 수 있어요
                  </p>
                  {frameType === 'four-cut' && (
                    <p className="text-center text-xs text-gray-400 mt-1">
                      중앙을 세로로 자르면 동일한 스트립 2개가 나와요
                    </p>
                  )}
                </div>
              </div>

              {/* Processing indicator */}
              {processing && <UIStatusBanner type="processing" message="미리보기 생성 중..." />}

              {error && <UIStatusBanner type="error" message={error} />}

              {/* Action Buttons */}
              <div className="space-y-3">
                {/* Print Quantity Selector */}
                {allSlotsFilled && previewUrl && !processing && (
                  <UICounterControl
                    value={printQuantity}
                    min={1}
                    max={10}
                    onChange={setPrintQuantity}
                    disabled={printing}
                    label="인쇄 매수"
                    hint="최대 10매까지 선택 가능합니다"
                  />
                )}

                {/* Auth Code Input */}
                {allSlotsFilled && previewUrl && !processing && event?.authCodeRequired && !authCodeVerified && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">인증코드</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={authCode}
                        onChange={e => { setAuthCode(e.target.value.toUpperCase()); setAuthCodeError('') }}
                        placeholder="인증코드 6자리 입력"
                        maxLength={6}
                        className="flex-1 px-3 py-2 border rounded-lg text-center font-mono text-lg tracking-widest uppercase focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    {authCodeError && <p className="text-sm text-red-500">{authCodeError}</p>}
                  </div>
                )}
                {allSlotsFilled && previewUrl && !processing && event?.authCodeRequired && authCodeVerified && (
                  <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    인증코드 확인됨
                  </div>
                )}

                {/* Payment / Print Button */}
                {allSlotsFilled && previewUrl && !processing && (
                  <UIButton size="md" fullWidth onClick={handleGoToPayment} disabled={printing} loading={printing}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    {(event?.price ?? 0) === 0 ? `무료 프린트 ${printQuantity}매` : `${(event?.price ?? 0) * printQuantity}원 결제하기`}
                  </UIButton>
                )}

                <UIButton
                  variant="secondary"
                  size="md"
                  fullWidth
                  onClick={() => {
                    updateStep(frameType === 'single' ? 'select-layout' : 'select-color')
                    setPreviewUrl(null)
                  }}
                  disabled={printing}
                >
                  이전으로
                </UIButton>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {/* Step 4: Payment */}
          {step === 'payment' && (
            <div className="space-y-6">
              <UISectionHeading
                title="결제"
                subtitle={`${printQuantity}매 프린트 비용을 결제해주세요`}
              />

              {/* 이메일 입력 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">이메일 (결제 확인용)</label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={e => setCustomerEmail(e.target.value)}
                  placeholder="example@email.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* 미리보기 이미지 */}
              {previewUrl && (
                <div className="flex justify-center">
                  <div className="relative w-32 h-48 rounded-lg overflow-hidden shadow-lg">
                    <Image
                      src={previewUrl}
                      alt="프린트 미리보기"
                      fill
                      className="object-cover"
                    />
                  </div>
                </div>
              )}

              {/* 결제 금액 */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">단가</span>
                    <span className="text-gray-700">{event?.price?.toLocaleString()}원</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">수량</span>
                    <span className="text-gray-700">{printQuantity}매</span>
                  </div>
                  <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between items-center">
                    <span className="text-sm font-semibold text-gray-700">총 결제 금액</span>
                    <span className="text-xl font-bold text-gray-900">
                      {((event?.price ?? 0) * printQuantity).toLocaleString()}원
                    </span>
                  </div>
                </div>
              </div>

              {error && <UIStatusBanner type="error" message={error} />}

              {/* 버튼 */}
              <div className="space-y-3">
                <UIButton
                  fullWidth
                  onClick={handlePayment}
                  disabled={paymentProcessing || printing}
                  loading={paymentProcessing || printing}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  카드/간편결제 {((event?.price ?? 0) * printQuantity).toLocaleString()}원
                </UIButton>

                <UIButton
                  variant="secondary"
                  size="md"
                  fullWidth
                  onClick={() => updateStep('fill-photos')}
                  disabled={paymentProcessing || printing}
                >
                  이전으로
                </UIButton>
              </div>
            </div>
          )}

          {/* Step 5: Success */}
          {step === 'success' && (() => {
            const hasPending = printJobStatuses.some(j => j.status === 'PENDING')
            const hasFailed = printJobStatuses.some(j => j.status === 'FAILED')
            const allDone = allJobsSettled && !hasFailed
            const allFailed = allJobsSettled && printJobStatuses.every(j => j.status === 'FAILED')
            const maxQueue = Math.max(...printJobStatuses.filter(j => j.status === 'PENDING').map(j => j.queuePosition || 0), 0)

            let statusType: 'processing' | 'success' | 'error' = 'processing'
            let statusMessage = maxQueue > 1 ? `인쇄 대기 중 · 대기 ${maxQueue}번째` : '인쇄 대기 중 · 곧 인쇄가 시작됩니다'

            if (allDone) {
              statusType = 'success'
              statusMessage = '인쇄가 완료되었습니다'
            } else if (allFailed) {
              statusType = 'error'
              statusMessage = '인쇄에 실패했습니다. 관리자에게 문의해 주세요.'
            } else if (!hasPending && printJobStatuses.length === 0) {
              statusType = 'success'
              statusMessage = '프린트 전송 완료 · 잠시 후 출력됩니다'
            } else if (hasFailed && !allFailed) {
              statusType = 'error'
              statusMessage = '일부 인쇄가 실패했습니다. 관리자에게 문의해 주세요.'
            }

            return (
              <div className="space-y-6">
                <UISectionHeading title="완료" subtitle="사진이 준비되었습니다" />

                <UIStatusBanner type={statusType} message={statusMessage} />

                <p className="text-center text-sm text-gray-500">📸 자유롭게 여러 장 뽑아도 괜찮아요! 마음껏 즐겨주세요</p>

                {previewUrl && (
                  <div className="flex justify-center">
                    <img src={previewUrl} alt="인쇄 사진" className="rounded-lg shadow-lg object-contain" style={{ maxHeight: '40vh', maxWidth: '100%' }} />
                  </div>
                )}

                {/* 후원 안내 */}
                {event?.donation?.enabled && (
                  <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl p-5 border border-yellow-200/80 text-center space-y-3">
                    <p className="text-base font-bold text-gray-900">
                      🎉 {event.donation.message || '즐거우셨다면 자유롭게 응원해주세요!'} 💕
                    </p>
                    <p className="text-xs text-gray-400">부담 없이, 마음만으로도 충분해요 ☺️</p>
                    {event.donation.link && (
                      <a
                        href={event.donation.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-yellow-400 text-yellow-900 hover:bg-yellow-500 active:scale-95 transition-all font-bold text-[15px] shadow-md"
                      >
                        ☕ 후원하기
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
                            const btn = document.getElementById('copy-account-btn')
                            if (btn) { btn.textContent = '복사됨'; setTimeout(() => { btn.textContent = '복사' }, 1500) }
                          }}
                          id="copy-account-btn"
                          className="text-xs px-3 py-1.5 rounded-lg bg-yellow-400 text-yellow-900 hover:bg-yellow-500 transition-colors font-semibold shrink-0"
                        >
                          복사
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-3">
                  {!allFailed && (
                    <UIButton fullWidth variant="download" onClick={handleDownload}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      사진 저장
                    </UIButton>
                  )}
                  <UIButton fullWidth variant="secondary" onClick={handleReset}>새로운 사진 만들기</UIButton>
                </div>
              </div>
            )
          })()}
        </div>

        {/* Action Modal */}
        <UIBottomSheet
          open={showActionModal && currentEditingSlot !== null}
          onClose={() => { setShowActionModal(false); setCurrentEditingSlot(null) }}
          title={currentEditingSlot !== null ? `사진 ${currentEditingSlot + 1}` : undefined}
        >
          <UIButton fullWidth onClick={handleEditPhoto}>사진 편집</UIButton>
          <UIButton fullWidth variant="secondary" onClick={handleReplacePhoto}>다른 사진으로 변경</UIButton>
          <UIButton fullWidth variant="danger" onClick={handleDeletePhoto}>사진 삭제</UIButton>
        </UIBottomSheet>

        {/* Crop Editor Modal */}
        {showCropEditor && currentEditingSlot !== null && photoSlots[currentEditingSlot]?.file && (
          <FourCutCropEditor
            images={[photoSlots[currentEditingSlot].file!]}
            aspectRatio={getCropAspectRatioForSlot(frameType, currentEditingSlot)}
            onComplete={handleCropComplete}
            onCancel={handleCropCancel}
            initialSettings={photoSlots[currentEditingSlot]?.cropSettings ? [photoSlots[currentEditingSlot].cropSettings!] : undefined}
          />
        )}

      </div>
    </div>
  )
}
