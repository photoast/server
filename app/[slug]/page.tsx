'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import FourCutCropEditor from '../components/FourCutCropEditor'
const FreeLayoutEditor = dynamic(() => import('../components/FreeLayoutEditor'), { ssr: false })
import { UIButton, UIStatusBanner, UICounterControl, UISectionHeading, UIPageSpinner, UICardSpinner } from '../components/ui'
import { loadTossPayments } from '@tosspayments/tosspayments-sdk'
import type { TossPaymentsWidgets } from '@tosspayments/tosspayments-sdk'

// 비회원 결제용 상수
const ANONYMOUS_CUSTOMER_KEY = 'ANONYMOUS'
import {
  SinglePhotoPreview,
  SingleWithLogoPreview,
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
import { renderSingleWithLogoToCanvas } from '@/lib/canvas-renderer'

interface Event {
  name: string
  slug: string
  printerUrl: string
  logoUrl?: string
  photoAreaRatio?: number
  availableLayouts?: string[]
  logoSettings?: any
  overlayLogoSettings?: any
  price?: number
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
const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || 'test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm'

const BACKGROUND_COLORS = [
  { name: '블랙', value: '#000000' },
  { name: '화이트', value: '#FFFFFF' },
  { name: '핑크', value: '#FFB6C1' },
  { name: '블루', value: '#87CEEB' },
  { name: '그린', value: '#90EE90' },
  { name: '퍼플', value: '#DDA0DD' }
]

export default function GuestPage({ params }: { params: { slug: string } }) {
  const router = useRouter()
  const searchParams = useSearchParams()

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
  const [backgroundColor, setBackgroundColor] = useState('#000000')

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
  const [puzzlePieces, setPuzzlePieces] = useState<Blob[]>([])
  const [puzzlePieceUrls, setPuzzlePieceUrls] = useState<string[]>([])
  const [puzzleAnimationSplit, setPuzzleAnimationSplit] = useState(false)

  // Payment state
  const [paymentWidgets, setPaymentWidgets] = useState<TossPaymentsWidgets | null>(null)
  const [paymentReady, setPaymentReady] = useState(false)
  const [paymentProcessing, setPaymentProcessing] = useState(false)
  const [paymentConfirming, setPaymentConfirming] = useState(false) // 결제 승인 처리 중

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

  // Fetch event data
  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const res = await fetch(`/api/events/slug/${params.slug}`)
        if (!res.ok) throw new Error('Event not found')
        const data = await res.json()
        setEvent(data)
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

  // Auto-select layout if only one is available
  useEffect(() => {
    if (!event || step !== 'select-layout') return

    const availableLayouts = event.availableLayouts || []

    // If only one layout is available, auto-select it and skip to next step
    if (availableLayouts.length === 1) {
      const selectedLayout = availableLayouts[0] as FrameType
      updateFrameType(selectedLayout)

      // Move to appropriate next step based on layout type
      const nextStep = (selectedLayout === 'single' || selectedLayout === 'single-with-logo' || selectedLayout === 'single-with-logo-overlay')
        ? 'fill-photos'
        : 'select-color'
      updateStep(nextStep)
    }
  }, [event, step])

  // Auto-animate puzzle pieces (split/combine)
  useEffect(() => {
    if (puzzlePieceUrls.length > 0) {
      const interval = setInterval(() => {
        setPuzzleAnimationSplit(prev => !prev)
      }, 2500) // Toggle every 2.5 seconds

      return () => clearInterval(interval)
    }
  }, [puzzlePieceUrls.length])

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

  // 퍼즐 레이아웃 렌더링 (1장의 사진을 여러 조각으로 분할)
  const renderPuzzleToCanvases = async (gridSize: 2 | 3): Promise<Blob[]> => {
    console.log(`[Puzzle] Rendering ${gridSize}x${gridSize} puzzle...`)

    const photoSlot = photoSlots[0]
    if (!photoSlot?.croppedImageUrl) {
      throw new Error('사진을 선택하고 편집해주세요')
    }

    // 원본 사진 로드
    const sourceImg = await loadImage(photoSlot.croppedImageUrl)
    console.log(`[Puzzle] Source image loaded: ${sourceImg.width}x${sourceImg.height}`)

    const CANVAS_WIDTH = 1200
    const CANVAS_HEIGHT = 1800
    const pieceCount = gridSize * gridSize

    // 원본 이미지의 각 조각 크기
    const pieceWidth = sourceImg.width / gridSize
    const pieceHeight = sourceImg.height / gridSize

    console.log(`[Puzzle] Piece dimensions: ${pieceWidth}x${pieceHeight}`)
    console.log(`[Puzzle] Creating ${pieceCount} pieces...`)

    const blobs: Blob[] = []

    // 각 조각을 개별 캔버스로 렌더링
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const pieceIndex = row * gridSize + col
        console.log(`[Puzzle] Rendering piece ${pieceIndex + 1}/${pieceCount} (row=${row}, col=${col})`)

        // 새 캔버스 생성
        const canvas = document.createElement('canvas')
        canvas.width = CANVAS_WIDTH
        canvas.height = CANVAS_HEIGHT
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas context not available')

        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'

        // 배경색 채우기
        ctx.fillStyle = backgroundColor
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

        // 원본 이미지에서 이 조각에 해당하는 부분 추출
        const sourceX = col * pieceWidth
        const sourceY = row * pieceHeight

        // 전체 캔버스에 확대하여 그리기
        ctx.drawImage(
          sourceImg,
          sourceX, sourceY, pieceWidth, pieceHeight,  // 소스 영역
          0, 0, CANVAS_WIDTH, CANVAS_HEIGHT           // 대상 영역 (전체 캔버스)
        )

        console.log(`[Puzzle] Piece ${pieceIndex + 1}: source=(${sourceX},${sourceY},${pieceWidth},${pieceHeight})`)

        // Blob으로 변환
        const blob = await canvasToBlob(canvas, 0.95)
        blobs.push(blob)
        console.log(`[Puzzle] Piece ${pieceIndex + 1} converted to blob: ${blob.size} bytes`)
      }
    }

    console.log(`[Puzzle] All ${pieceCount} pieces rendered successfully`)
    return blobs
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

      // 퍼즐 레이아웃 처리
      if (frameType === 'puzzle-2x2' || frameType === 'puzzle-3x3') {
        const gridSize = frameType === 'puzzle-2x2' ? 2 : 3
        console.log(`[handleProcess] Rendering ${gridSize}x${gridSize} puzzle`)

        const pieces = await renderPuzzleToCanvases(gridSize)
        setPuzzlePieces(pieces)

        // 각 조각의 미리보기 URL 생성
        const pieceUrls = pieces.map(piece => URL.createObjectURL(piece))
        setPuzzlePieceUrls(pieceUrls)

        // 미리보기용: 모든 조각을 하나의 그리드 이미지로 결합
        const previewCanvas = document.createElement('canvas')
        const previewSize = 600 // 미리보기 크기
        previewCanvas.width = previewSize
        previewCanvas.height = previewSize
        const ctx = previewCanvas.getContext('2d')
        if (!ctx) throw new Error('Canvas context not available')

        ctx.fillStyle = backgroundColor
        ctx.fillRect(0, 0, previewSize, previewSize)

        const pieceSize = previewSize / gridSize

        for (let row = 0; row < gridSize; row++) {
          for (let col = 0; col < gridSize; col++) {
            const pieceIndex = row * gridSize + col
            const img = await loadImage(pieceUrls[pieceIndex])
            ctx.drawImage(img, col * pieceSize, row * pieceSize, pieceSize, pieceSize)
          }
        }

        const previewBlob = await canvasToBlob(previewCanvas, 0.85)
        const previewDataUrl = URL.createObjectURL(previewBlob)
        setPreviewUrl(previewDataUrl)

        console.log(`[handleProcess] Puzzle preview created, ${pieces.length} pieces ready`)
        setProcessing(false)
        return
      }

      // 클라이언트에서 Canvas로 렌더링 (일반 레이아웃)
      let imageBlob: Blob

      if (frameType === 'single-with-logo' || frameType === 'single-with-logo-overlay') {
        // 로고 레이아웃은 공통 함수 사용
        const isOverlay = frameType === 'single-with-logo-overlay'
        console.log(`[handleProcess] Rendering ${frameType} with Canvas`)
        const photoSlot = photoSlots[0]
        if (!photoSlot?.croppedImageUrl) {
          throw new Error('사진을 선택하고 편집해주세요')
        }
        const logoSettingsToUse = isOverlay
          ? (event?.overlayLogoSettings || event?.logoSettings || { position: 'bottom-center', size: 80 })
          : (event?.logoSettings || { position: 'bottom-center', size: 80 })
        imageBlob = await renderSingleWithLogoToCanvas(
          photoSlot.croppedImageUrl,
          event?.logoUrl,
          isOverlay ? 100 : (event?.photoAreaRatio ?? 85),
          logoSettingsToUse
        )
      } else {
        // 다른 모든 레이아웃은 공통 함수 사용
        console.log(`[handleProcess] Rendering ${frameType} with common Canvas function`)
        imageBlob = await renderLayoutToCanvas(frameType)
      }

      console.log('[handleProcess] Canvas rendered, blob size:', imageBlob.size)

      // 서버에 렌더링된 이미지 전송 (프린터 보정만 적용)
      const formData = new FormData()
      formData.append('slug', params.slug)
      formData.append('frameType', frameType)
      formData.append('preRenderedImage', imageBlob, 'preview.jpg')
      formData.append('applyPrinterCorrectionOnly', 'true')

      // 모든 레이아웃이 클라이언트에서 렌더링되므로 서버는 프린터 보정만 담당

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

  // 자유 레이아웃 완료 처리
  const handleFreeLayoutComplete = useCallback(async (blob: Blob) => {
    setProcessing(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('slug', params.slug)
      formData.append('frameType', 'free-layout')
      formData.append('preRenderedImage', blob, 'free-layout.jpg')
      formData.append('applyPrinterCorrectionOnly', 'true')

      const res = await fetch('/api/process-image', { method: 'POST', body: formData })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `미리보기 생성 실패: ${res.status}`)
      }

      const data = await res.json()
      if (!data.url) throw new Error('미리보기 URL을 받지 못했습니다')
      setPreviewUrl(data.url)
    } catch (err: any) {
      setError(err.message || '미리보기 생성에 실패했습니다')
    } finally {
      setProcessing(false)
    }
  }, [params.slug])

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
      // Generate timestamp for filenames
      const now = new Date()
      const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
      const layoutName = (LAYOUT_OPTIONS.find(l => l.type === frameType)?.nameEn || frameType).replace(/\s+/g, '-').toLowerCase()

      // 퍼즐 레이아웃: 모든 조각 다운로드
      if (frameType === 'puzzle-2x2' || frameType === 'puzzle-3x3') {
        if (puzzlePieces.length === 0) {
          throw new Error('퍼즐 조각이 생성되지 않았습니다')
        }

        console.log(`[Download] Downloading ${puzzlePieces.length} puzzle pieces`)

        // 각 조각을 순차적으로 다운로드
        for (let i = 0; i < puzzlePieces.length; i++) {
          const url = window.URL.createObjectURL(puzzlePieces[i])
          const link = document.createElement('a')
          link.href = url
          link.download = `phost_${layoutName}_piece-${i + 1}_${timestamp}.jpg`

          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          window.URL.revokeObjectURL(url)

          // 다운로드 간 짧은 딜레이 (브라우저가 여러 다운로드를 처리할 시간)
          await new Promise(resolve => setTimeout(resolve, 100))
        }

        console.log(`[Download] All ${puzzlePieces.length} pieces downloaded`)
        return
      }

      // 일반 레이아웃: 기존 로직
      let blob: Blob

      // Handle data URL (Vercel environment)
      if (previewUrl.startsWith('data:')) {
        // Convert data URL to blob
        const response = await fetch(previewUrl)
        blob = await response.blob()
      } else {
        // Handle regular URL (local development)
        const absoluteUrl = previewUrl.startsWith('http')
          ? previewUrl
          : `${window.location.origin}${previewUrl}`

        const response = await fetch(absoluteUrl)

        if (!response.ok) {
          throw new Error(`이미지 다운로드 실패: ${response.status}`)
        }

        blob = await response.blob()
      }

      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `phost_${layoutName}_${timestamp}.jpg`

      // Trigger download
      document.body.appendChild(link)
      link.click()

      // Cleanup
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      const errorMessage = err.message || '다운로드에 실패했습니다'
      console.error('Download error:', err)
      setError(errorMessage)
      logClientError('Failed to download image', err, params.slug, {
        previewUrl,
        frameType,
      })
    }
  }

  const handlePrint = async () => {
    if (!previewUrl) return

    setPrinting(true)
    setError('')

    try {
      // 퍼즐 레이아웃: 각 조각을 개별 프린트
      if (frameType === 'puzzle-2x2' || frameType === 'puzzle-3x3') {
        if (puzzlePieces.length === 0) {
          throw new Error('퍼즐 조각이 생성되지 않았습니다')
        }

        console.log(`[Print] Printing ${puzzlePieces.length} puzzle pieces, ${printQuantity} copy(ies) each`)

        const totalJobs = puzzlePieces.length * printQuantity
        console.log(`[Print] Total print jobs: ${totalJobs}`)

        // 각 조각을 프린트 (수량만큼 반복)
        for (let copy = 0; copy < printQuantity; copy++) {
          for (let i = 0; i < puzzlePieces.length; i++) {
            console.log(`[Print] Sending puzzle piece ${i + 1}/${puzzlePieces.length}, copy ${copy + 1}/${printQuantity}`)

            // Blob을 data URL로 변환
            const reader = new FileReader()
            const dataUrl = await new Promise<string>((resolve, reject) => {
              reader.onload = () => resolve(reader.result as string)
              reader.onerror = reject
              reader.readAsDataURL(puzzlePieces[i])
            })

            const res = await fetch('/api/print', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                slug: params.slug,
                imageUrl: dataUrl,
                quantity: 1, // 각 조각은 1장씩
              }),
            })

            if (!res.ok) {
              const data = await res.json()
              throw new Error(`Piece ${i + 1} failed: ${data.error || 'Print failed'}`)
            }

            console.log(`[Print] Piece ${i + 1}/${puzzlePieces.length}, copy ${copy + 1}/${printQuantity} sent successfully`)
          }
        }

        console.log(`[Print] All ${totalJobs} puzzle pieces sent successfully`)
        updateStep('success')
        return
      }

      // 일반 레이아웃: 기존 로직
      const res = await fetch('/api/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: params.slug,
          imageUrl: previewUrl,
          quantity: printQuantity,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to print')
      }

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

  // 결제 페이지로 이동
  const handleGoToPayment = async () => {
    if (!previewUrl) return

    const unitPrice = event?.price ?? 0
    const paymentAmount = unitPrice * printQuantity

    // 무료 (0원)인 경우 결제 단계 건너뛰고 바로 프린트
    if (paymentAmount === 0) {
      await handlePrint()
      return
    }

    updateStep('payment')
    setError('')
    setPaymentReady(false)

    try {
      // 토스페이먼츠 SDK 로드
      const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY)

      // 위젯 초기화 (비회원 결제)
      const widgets = tossPayments.widgets({ customerKey: ANONYMOUS_CUSTOMER_KEY })

      // 결제 금액 설정 (단가 × 수량)
      await widgets.setAmount({
        currency: 'KRW',
        value: paymentAmount,
      })

      // 결제 위젯 렌더링
      await Promise.all([
        widgets.renderPaymentMethods({
          selector: '#payment-method',
          variantKey: 'DEFAULT',
        }),
        widgets.renderAgreement({
          selector: '#agreement',
          variantKey: 'AGREEMENT',
        }),
      ])

      setPaymentWidgets(widgets)
      setPaymentReady(true)
    } catch (err: any) {
      console.error('Payment widget error:', err)
      setError('결제 위젯을 불러오는데 실패했습니다')
      logClientError('Failed to load payment widget', err, params.slug)
    }
  }

  // 결제 실행
  const handlePayment = async () => {
    if (!paymentWidgets || !paymentReady) return

    setPaymentProcessing(true)
    setError('')

    try {
      // 주문 ID 생성 (고유값)
      const orderId = `PRINT_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

      // 결제 요청
      await paymentWidgets.requestPayment({
        orderId,
        orderName: '포토 프린트 1장',
        successUrl: `${window.location.origin}${window.location.pathname}?payment=success&orderId=${orderId}`,
        failUrl: `${window.location.origin}${window.location.pathname}?payment=fail`,
      })
    } catch (err: any) {
      // 사용자가 취소한 경우
      if (err.code === 'USER_CANCEL') {
        setError('결제가 취소되었습니다')
      } else {
        console.error('Payment request error:', err)
        setError(err.message || '결제 요청 중 오류가 발생했습니다')
        logClientError('Payment request failed', err, params.slug)
      }
    } finally {
      setPaymentProcessing(false)
    }
  }

  // URL 파라미터로 결제 결과 처리 (페이지 로드 시 즉시 확인)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const paymentStatus = urlParams.get('payment')
    const paymentKey = urlParams.get('paymentKey')
    const orderId = urlParams.get('orderId')
    const amount = urlParams.get('amount')

    if (paymentStatus === 'success' && paymentKey && orderId && amount) {
      // 즉시 로딩 상태로 전환 (메인 화면 깜빡임 방지)
      setPaymentConfirming(true)

      // 결제 승인 처리
      const confirmPayment = async () => {
        setError('')

        try {
          // 결제 승인 API 호출
          const paymentRes = await fetch('/api/payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentKey,
              orderId,
              amount: Number(amount),
              eventSlug: params.slug,
            }),
          })

          if (!paymentRes.ok) {
            const data = await paymentRes.json()
            throw new Error(data.error || '결제 승인에 실패했습니다')
          }

          // 결제 성공 시 프린트 실행
          // previewUrl이 localStorage에 저장되어 있어야 함
          const savedPreviewUrl = localStorage.getItem('pendingPrintUrl')
          if (!savedPreviewUrl) {
            throw new Error('프린트할 이미지를 찾을 수 없습니다')
          }

          const printRes = await fetch('/api/print', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              slug: params.slug,
              imageUrl: savedPreviewUrl,
            }),
          })

          if (!printRes.ok) {
            const data = await printRes.json()
            throw new Error(data.error || '프린트에 실패했습니다')
          }

          // 성공 처리
          localStorage.removeItem('pendingPrintUrl')

          // URL 파라미터 제거
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
      setError('결제가 실패했습니다. 다시 시도해주세요.')
      updateStep('fill-photos')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [params.slug])

  // 결제 페이지로 가기 전 previewUrl 저장
  useEffect(() => {
    if (step === 'payment' && previewUrl) {
      localStorage.setItem('pendingPrintUrl', previewUrl)
    }
  }, [step, previewUrl])

  const handleReset = () => {
    // Clean up puzzle piece URLs
    puzzlePieceUrls.forEach(url => URL.revokeObjectURL(url))

    updateStep('select-layout')
    updateFrameType('single')
    setBackgroundColor('#000000')
    setPhotoSlots([])
    setPreviewUrl(null)
    setError('')
    setPrintQuantity(1)
    setPuzzlePieces([])
    setPuzzlePieceUrls([])
  }

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
      case 'single-with-logo':
        return <SingleWithLogoPreview {...baseProps} logoUrl={event?.logoUrl} logoSettings={event?.logoSettings} photoAreaRatio={event?.photoAreaRatio} />
      case 'single-with-logo-overlay':
        return <SingleWithLogoPreview {...baseProps} logoUrl={event?.logoUrl} logoSettings={event?.overlayLogoSettings || event?.logoSettings} photoAreaRatio={100} />
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
      case 'puzzle-2x2':
      case 'puzzle-3x3':
        return <SinglePhotoPreview {...baseProps} />
      case 'free-layout':
        return previewUrl ? (
          <div className="relative w-full rounded-2xl overflow-hidden shadow-lg" style={{ paddingBottom: '150%' }}>
            <Image src={previewUrl} alt="자유 레이아웃 미리보기" fill className="object-contain" />
          </div>
        ) : null
      default:
        return null
    }
  }

  const renderLayoutOptionPreview = (type: FrameType) => {
    // Landscape layouts have different aspect ratio
    const isLandscape = type === 'landscape-single' || type === 'landscape-two'

    const gridStyles: Record<FrameType, string> = {
      'single': 'grid-cols-1 grid-rows-1',
      'single-with-logo': 'grid-cols-1 grid-rows-1',
      'single-with-logo-overlay': 'grid-cols-1 grid-rows-1',
      'landscape-single': 'grid-cols-1 grid-rows-1',
      'landscape-two': 'grid-cols-2 grid-rows-1',
      'vertical-two': 'grid-cols-1 grid-rows-2',
      'one-plus-two': 'grid-cols-2 grid-rows-2',
      'four-cut': 'grid-cols-1 grid-rows-4',
      'two-by-two': 'grid-cols-2 grid-rows-2',
      'puzzle-2x2': 'grid-cols-2 grid-rows-2',
      'puzzle-3x3': 'grid-cols-3 grid-rows-3',
      'free-layout': 'grid-cols-1 grid-rows-1'
    }

    const getCells = (): { colspan?: number, rowspan?: number }[] => {
      switch (type) {
        case 'single': return [{ colspan: 1, rowspan: 1 }]
        case 'single-with-logo': return [{ colspan: 1, rowspan: 1 }]
        case 'single-with-logo-overlay': return [{ colspan: 1, rowspan: 1 }]
        case 'landscape-single': return [{ colspan: 1, rowspan: 1 }]
        case 'landscape-two': return [{}, {}]
        case 'vertical-two': return [{}, {}]
        case 'one-plus-two': return [{ colspan: 2 }, {}, {}]
        case 'four-cut': return [{}, {}, {}, {}]
        case 'two-by-two': return [{}, {}, {}, {}]
        case 'puzzle-2x2': return [{}, {}, {}, {}]
        case 'puzzle-3x3': return [{}, {}, {}, {}, {}, {}, {}, {}, {}]
        case 'free-layout': return [{ colspan: 1, rowspan: 1 }]
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
            className={type === 'single-with-logo' && i === 0 ? 'bg-purple-400 border-b-2 border-yellow-400' : type === 'single-with-logo-overlay' && i === 0 ? 'bg-purple-400 relative overflow-hidden' : 'bg-purple-400'}
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
        sublabel="잠시만 기다려주세요 💕"
      />
    )
  }

  if (loading) {
    return <UIPageSpinner />
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50">
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
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 py-6 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-block bg-white/80 backdrop-blur-sm rounded-full px-6 py-3 shadow-lg mb-4">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
              ✨ {event.name} ✨
            </h1>
          </div>
          <p className="text-gray-600 text-sm font-medium">나만의 특별한 순간을 담아요 💕</p>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-3xl shadow-2xl p-6">
          {/* Step 1: Select Layout */}
          {step === 'select-layout' && (
            <div className="space-y-6">
              <UISectionHeading title="어떤 스타일로 만들까요? 🎨" subtitle="마음에 드는 레이아웃을 골라보세요!" />

              <div className="grid grid-cols-2 gap-3">
                {LAYOUT_OPTIONS
                  .filter((option) => {
                    // If availableLayouts is not set or empty, show all layouts
                    if (!event?.availableLayouts || event.availableLayouts.length === 0) {
                      return true
                    }
                    // Otherwise, only show layouts in the availableLayouts array
                    return event.availableLayouts.includes(option.type)
                  })
                  .map((option) => (
                  <button
                    key={option.type}
                    onClick={() => updateFrameType(option.type)}
                    className={`p-4 rounded-3xl border-2 transition-all duration-300 ${
                      frameType === option.type
                        ? 'border-pink-400 bg-gradient-to-br from-pink-50 to-purple-50 shadow-xl'
                        : 'border-gray-200 hover:border-pink-300 hover:shadow-lg bg-white'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      {renderLayoutOptionPreview(option.type)}
                      <div className="text-center">
                        <div className={`font-bold text-sm ${frameType === option.type ? 'text-pink-600' : 'text-gray-800'}`}>
                          {option.name}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{option.description}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <UIButton
                fullWidth
                onClick={() => updateStep((frameType === 'single' || frameType === 'single-with-logo' || frameType === 'single-with-logo-overlay' || frameType === 'free-layout') ? 'fill-photos' : 'select-color')}
              >
                다음 단계로 💫
              </UIButton>
            </div>
          )}

          {/* Step 2: Select Color (skip for single photo) */}
          {step === 'select-color' && (
            <div className="space-y-6">
              <UISectionHeading title="어떤 색이 좋아요? 🎨" subtitle="배경색으로 분위기를 바꿔보세요!" />

              <div className="grid grid-cols-3 gap-3">
                {BACKGROUND_COLORS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setBackgroundColor(color.value)}
                    className={`p-3 rounded-3xl border-2 transition-all duration-300 ${
                      backgroundColor === color.value
                        ? 'border-pink-400 shadow-2xl'
                        : 'border-gray-200 hover:border-pink-300 hover:shadow-lg'
                    }`}
                  >
                    <div
                      className="w-full h-16 rounded-2xl mb-2 shadow-md ring-2 ring-white"
                      style={{ backgroundColor: color.value }}
                    />
                    <div className={`text-sm font-bold ${backgroundColor === color.value ? 'text-pink-600' : 'text-gray-700'}`}>
                      {color.name}
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <UIButton variant="secondary" size="md" className="flex-1" onClick={() => updateStep('select-layout')}>
                  ← 이전
                </UIButton>
                <UIButton size="md" className="flex-1" onClick={() => updateStep('fill-photos')}>
                  다음 단계로 💫
                </UIButton>
              </div>
            </div>
          )}

          {/* Step 3: Fill Photos */}
          {step === 'fill-photos' && frameType === 'free-layout' && !previewUrl && (
            <FreeLayoutEditor
              onComplete={handleFreeLayoutComplete}
              onBack={() => updateStep('select-layout')}
            />
          )}

          {step === 'fill-photos' && (frameType !== 'free-layout' || previewUrl) && (
            <div className="space-y-6">
              {/* Header with layout info */}
              <div className="bg-gradient-to-r from-pink-100 via-purple-100 to-blue-100 rounded-3xl p-5 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
                      {LAYOUT_OPTIONS.find(l => l.type === frameType)?.name}
                    </h2>
                    <p className="text-sm text-gray-600 mt-1 font-medium">
                      {LAYOUT_OPTIONS.find(l => l.type === frameType)?.description}
                    </p>
                  </div>
                  {frameType !== 'free-layout' && (
                    <div className="text-right bg-white/80 backdrop-blur-sm rounded-2xl px-4 py-2">
                      <div className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
                        {photoSlots.filter(s => s.file).length}/{photoSlots.length}
                      </div>
                      <div className="text-xs text-gray-500 font-medium">완료됨 ✨</div>
                    </div>
                  )}
                </div>
              </div>


              {/* Status Banner */}
              {allSlotsFilled ? (
                <UIStatusBanner type="success" message="완벽해요! 이제 출력할 수 있어요!" className="rounded-3xl shadow-lg" />
              ) : (
                <UIStatusBanner type="info" message="영역을 탭해서 예쁜 사진을 올려보세요!" className="rounded-3xl shadow-md" />
              )}

              {/* Layout Preview */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="font-semibold text-gray-800">출력 미리보기</h3>
                  {allSlotsFilled && (
                    <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
                      ✓ 준비완료
                    </span>
                  )}
                </div>
                <div className="transition-all duration-300">
                  {renderLayoutPreview()}
                </div>
                {frameType !== 'free-layout' && <div className="bg-white rounded-xl p-4 shadow-md">
                  <p className="text-center text-sm text-gray-600 font-medium mb-2">
                    사진을 탭하여 추가/변경/삭제
                  </p>
                  {frameType === 'four-cut' && (
                    <p className="text-center text-xs text-purple-600 mt-2">
                      ✂️ 중앙을 세로로 자르면 2개의 동일한 스트립
                    </p>
                  )}
                  {frameType === 'puzzle-2x2' && (
                    <p className="text-center text-xs text-purple-600 mt-2">
                      🧩 4조각으로 나눠져 인쇄됩니다 • 조립하면 2배 확대!
                    </p>
                  )}
                  {frameType === 'puzzle-3x3' && (
                    <p className="text-center text-xs text-purple-600 mt-2">
                      🧩 9조각으로 나눠져 인쇄됩니다 • 조립하면 3배 확대!
                    </p>
                  )}
                </div>}
              </div>

              {/* Processing indicator */}
              {processing && <UIStatusBanner type="processing" message="미리보기 생성 중..." />}

              {error && <UIStatusBanner type="error" message={error} />}

              {/* Puzzle Pieces Preview with Animation */}
              {(frameType === 'puzzle-2x2' || frameType === 'puzzle-3x3') && puzzlePieceUrls.length > 0 && (
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-2xl p-4">
                  <h4 className="text-sm font-semibold text-gray-800 mb-3 text-center">
                    🧩 인쇄될 퍼즐 조각들 (총 {puzzlePieceUrls.length}조각)
                  </h4>
                  <div className="relative w-full" style={{ paddingBottom: '150%' }}>
                    {puzzlePieceUrls.map((url, index) => {
                      const gridSize = frameType === 'puzzle-2x2' ? 2 : 3
                      const row = Math.floor(index / gridSize)
                      const col = index % gridSize

                      // Combined position (perfectly aligned, no gap)
                      const combinedX = col * (100 / gridSize)
                      const combinedY = row * (100 / gridSize)

                      // Split position (spread out from center)
                      const spreadFactor = puzzleAnimationSplit ? 1.08 : 1 // 8% spread when split (subtle)
                      const centerOffset = (gridSize - 1) / 2
                      const splitX = combinedX + (col - centerOffset) * 5 * (spreadFactor - 1)
                      const splitY = combinedY + (row - centerOffset) * 5 * (spreadFactor - 1)

                      return (
                        <div
                          key={index}
                          className="absolute transition-all duration-1000 ease-in-out"
                          style={{
                            width: `${100 / gridSize}%`,
                            height: `${100 / gridSize}%`,
                            left: `${puzzleAnimationSplit ? splitX : combinedX}%`,
                            top: `${puzzleAnimationSplit ? splitY : combinedY}%`,
                            transform: `scale(${puzzleAnimationSplit ? 0.98 : 1})`,
                          }}
                        >
                          <div className="relative w-full h-full" style={{
                            padding: puzzleAnimationSplit ? '2px' : '0px',
                            transition: 'padding 1000ms ease-in-out'
                          }}>
                            <div
                              className="relative bg-white overflow-hidden shadow-lg h-full transition-all duration-1000"
                              style={{
                                borderRadius: puzzleAnimationSplit ? '8px' : '0px',
                                border: puzzleAnimationSplit ? '2px solid rgb(192, 132, 252)' : '0px solid transparent',
                              }}
                            >
                              <img
                                src={url}
                                alt={`퍼즐 조각 ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute top-1 right-1 bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">
                                {index + 1}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-xs text-gray-500 text-center mt-3">
                    {puzzleAnimationSplit ? '📤 각 조각이 개별 인쇄됩니다' : '🧩 조립하면 하나의 큰 사진!'}
                  </p>
                </div>
              )}

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
                    label={frameType === 'puzzle-2x2' || frameType === 'puzzle-3x3' ? '퍼즐 세트 수' : '인쇄 매수'}
                    hint={
                      frameType === 'puzzle-2x2'
                        ? `최대 10세트 (총 ${printQuantity * 4}장)`
                        : frameType === 'puzzle-3x3'
                        ? `최대 10세트 (총 ${printQuantity * 9}장)`
                        : '최대 10매까지 선택 가능합니다'
                    }
                  />
                )}

                {/* Download & Payment Buttons - Side by side */}
                {allSlotsFilled && previewUrl && !processing && (
                  <div className="flex gap-3">
                    <UIButton variant="download" size="md" className="flex-1" onClick={handleDownload} disabled={printing}>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      저장
                    </UIButton>
                    <UIButton size="md" className="flex-1" onClick={handleGoToPayment} disabled={printing} loading={printing}>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      {(event?.price ?? 0) === 0 ? `무료 프린트 ${printQuantity}매` : `${(event?.price ?? 0) * printQuantity}원 결제하기`}
                    </UIButton>
                  </div>
                )}

                <UIButton
                  variant="secondary"
                  size="md"
                  fullWidth
                  onClick={() => {
                    if (frameType === 'free-layout' && previewUrl) {
                      // 자유 레이아웃: 미리보기 → 에디터로 돌아가기
                      setPreviewUrl(null)
                    } else {
                      updateStep(frameType === 'single' || frameType === 'single-with-logo' || frameType === 'single-with-logo-overlay' || frameType === 'free-layout' ? 'select-layout' : 'select-color')
                      setPreviewUrl(null)
                    }
                  }}
                  disabled={printing}
                >
                  ← 이전 단계로
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
                title={(event?.price ?? 0) === 0 ? '무료 프린트 🎉' : '결제하기 💳'}
                subtitle={(event?.price ?? 0) === 0
                  ? `${printQuantity}매 무료로 프린트 하실 수 있습니다`
                  : `${printQuantity}매 프린트 비용을 결제해주세요`
                }
              />

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
              <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-2xl p-4">
                {(event?.price ?? 0) === 0 ? (
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-1">프린트 비용</p>
                    <p className="text-3xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
                      무료
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{printQuantity}매</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm text-gray-600">
                      <span>단가</span>
                      <span>{event?.price}원</span>
                    </div>
                    <div className="flex justify-between items-center text-sm text-gray-600">
                      <span>수량</span>
                      <span>{printQuantity}매</span>
                    </div>
                    <div className="border-t border-purple-200 pt-2 mt-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">총 결제 금액</span>
                        <p className="text-2xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
                          {(event?.price ?? 0) * printQuantity}원
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 토스페이먼츠 위젯 */}
              <div className="space-y-4">
                <div id="payment-method" className="min-h-[200px]">
                  {!paymentReady && (
                    <div className="flex items-center justify-center h-[200px]">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-purple-600"></div>
                    </div>
                  )}
                </div>
                <div id="agreement" className="min-h-[50px]"></div>
              </div>

              {error && <UIStatusBanner type="error" message={error} />}

              {/* 버튼 */}
              <div className="space-y-3">
                <UIButton
                  fullWidth
                  onClick={handlePayment}
                  disabled={!paymentReady || paymentProcessing || printing}
                  loading={paymentProcessing || printing}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  {(event?.price ?? 0) === 0 ? '무료로 프린트하기' : `${event?.price}원 결제하기`}
                </UIButton>

                <UIButton
                  variant="secondary"
                  size="md"
                  fullWidth
                  onClick={() => {
                    updateStep('fill-photos')
                    setPaymentWidgets(null)
                    setPaymentReady(false)
                  }}
                  disabled={paymentProcessing || printing}
                >
                  ← 이전 단계로
                </UIButton>
              </div>
            </div>
          )}

          {/* Step 5: Success */}
          {step === 'success' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-3xl p-8 shadow-2xl text-center">
                <div className="text-6xl mb-4 animate-bounce">🎉</div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent mb-3">
                  완성되었어요!
                </h2>
                <p className="text-gray-600 mb-6 font-medium">
                  소중한 추억 {printQuantity}매가 프린터로 전송되었어요 💕<br />
                  <span className="text-sm">곧 멋진 사진을 받아보실 수 있어요!</span>
                </p>
                <UIButton onClick={handleReset} size="md" className="px-8">
                  새로운 사진 만들기 ✨
                </UIButton>
              </div>
            </div>
          )}
        </div>

        {/* Action Modal */}
        {showActionModal && currentEditingSlot !== null && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in duration-300">
              <div className="text-center mb-2">
                <div className="inline-block bg-gradient-to-r from-pink-100 to-purple-100 rounded-full px-4 py-2">
                  <h3 className="text-lg font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
                    사진 {currentEditingSlot + 1} 💕
                  </h3>
                </div>
              </div>

              <div className="space-y-3">
                <UIButton fullWidth onClick={handleEditPhoto}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  사진 편집하기 ✨
                </UIButton>

                <UIButton fullWidth variant="download" onClick={handleReplacePhoto}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  다른 사진으로 바꾸기 🔄
                </UIButton>

                <UIButton fullWidth variant="danger" onClick={handleDeletePhoto}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  사진 삭제하기 🗑️
                </UIButton>

                <UIButton
                  fullWidth
                  variant="secondary"
                  onClick={() => {
                    setShowActionModal(false)
                    setCurrentEditingSlot(null)
                  }}
                >
                  닫기
                </UIButton>
              </div>
            </div>
          </div>
        )}

        {/* Crop Editor Modal */}
        {showCropEditor && currentEditingSlot !== null && photoSlots[currentEditingSlot]?.file && (
          <FourCutCropEditor
            images={[photoSlots[currentEditingSlot].file!]}
            aspectRatio={getCropAspectRatioForSlot(frameType, currentEditingSlot, !!event?.logoUrl, event?.photoAreaRatio ?? 85)}
            onComplete={handleCropComplete}
            onCancel={handleCropCancel}
            initialSettings={photoSlots[currentEditingSlot]?.cropSettings ? [photoSlots[currentEditingSlot].cropSettings!] : undefined}
          />
        )}
      </div>
    </div>
  )
}
