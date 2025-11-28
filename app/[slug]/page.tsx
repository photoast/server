'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import FourCutCropEditor from '../components/FourCutCropEditor'
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

interface Event {
  name: string
  slug: string
  printerUrl: string
  logoUrl?: string
  photoAreaRatio?: number
  availableLayouts?: string[]
  logoSettings?: any
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

type Step = 'select-layout' | 'select-color' | 'fill-photos' | 'success'

const BACKGROUND_COLORS = [
  { name: '블랙', value: '#000000' },
  { name: '화이트', value: '#FFFFFF' },
  { name: '핑크', value: '#FFB6C1' },
  { name: '블루', value: '#87CEEB' },
  { name: '그린', value: '#90EE90' },
  { name: '퍼플', value: '#DDA0DD' }
]

export default function GuestPage({ params }: { params: { slug: string } }) {
  // Event and loading state
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)

  // Step and layout state
  const [step, setStep] = useState<Step>('select-layout')
  const [frameType, setFrameType] = useState<FrameType>('single')
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

  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // ============ Event Handlers ============

  // Process image handler (defined before useEffect that uses it)
  const handleProcess = useCallback(async () => {
    setProcessing(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('slug', params.slug)
      formData.append('frameType', frameType)

      if (frameType === 'single' || frameType === 'single-with-logo' || frameType === 'landscape-single') {
        // 회전 정보 전송
        const rotation = photoSlots[0]?.cropSettings?.rotation || 0
        const logData = {
          hasFile: !!photoSlots[0]?.file,
          hasCropArea: !!photoSlots[0]?.cropArea,
          hasRotation: !!photoSlots[0]?.cropSettings?.rotation,
          rotation: rotation,
          cropSettings: photoSlots[0]?.cropSettings,
          fileName: photoSlots[0]?.file?.name,
          fileSize: photoSlots[0]?.file?.size,
          fileType: photoSlots[0]?.file?.type
        }
        console.log('[handleProcess] Single photo mode:', logData)
        console.log('[handleProcess] Rotation value being sent:', rotation)
        logClientInfo('[Mobile] Starting single photo processing', params.slug, logData)

        if (!photoSlots[0]?.file) {
          throw new Error('사진을 선택해주세요')
        }
        formData.append('photo', photoSlots[0].file)
        if (photoSlots[0].cropArea) {
          formData.append('cropArea', JSON.stringify(photoSlots[0].cropArea))
        }
        formData.append('rotation', rotation.toString())
        formData.append('backgroundColor', '#FFFFFF')
      } else {
        // Verify all photos exist
        const validPhotos = photoSlots.filter(slot => slot.file !== null)
        const logData = {
          frameType,
          totalSlots: photoSlots.length,
          filledSlots: validPhotos.length,
          croppedSlots: photoSlots.filter(slot => slot.cropArea !== null).length,
          slotDetails: photoSlots.map((slot, i) => ({
            index: i,
            hasFile: !!slot.file,
            hasCropArea: !!slot.cropArea,
            hasRotation: !!slot.cropSettings?.rotation,
            fileName: slot.file?.name,
            fileSize: slot.file?.size,
            fileType: slot.file?.type
          }))
        }
        console.log('[handleProcess] Multi-photo mode:', logData)
        logClientInfo('[Mobile] Starting multi-photo processing', params.slug, logData)

        if (validPhotos.length !== photoSlots.length) {
          throw new Error('모든 사진을 선택해주세요')
        }

        // Add all photos to formData
        let photoCount = 0
        photoSlots.forEach((slot, index) => {
          if (slot.file) {
            formData.append('photos', slot.file)
            photoCount++
            console.log(`[handleProcess] Added photo ${index + 1}:`, slot.file.name)
          }
        })
        const cropAreas = photoSlots.map(slot => slot.cropArea)
        formData.append('cropAreas', JSON.stringify(cropAreas))
        // 회전 정보 배열 전송
        const rotations = photoSlots.map(slot => slot.cropSettings?.rotation || 0)
        formData.append('rotations', JSON.stringify(rotations))
        formData.append('backgroundColor', backgroundColor)
        console.log(`[handleProcess] Added ${photoCount} photos to FormData`)
        console.log('[handleProcess] Rotations being sent:', rotations)
        console.log('[handleProcess] CropSettings per slot:', photoSlots.map(s => s.cropSettings))
        logClientInfo('[Mobile] FormData prepared', params.slug, { photoCount, backgroundColor, rotations })
      }

      // If single-with-logo layout and logo exists, convert logoUrl to base64
      // Only do this in production/Vercel environment where logoUrl might not be accessible
      if (frameType === 'single-with-logo' && event?.logoUrl) {
        // Check if we're in production (Vercel) by checking if logoUrl starts with /api/serve-image/
        const isVercelLogo = event.logoUrl.startsWith('/api/serve-image/')

        if (isVercelLogo) {
          // In Vercel, convert logo to base64 to send to API
          try {
            console.log('[handleProcess] Fetching logo from:', event.logoUrl)
            const logoResponse = await fetch(event.logoUrl)
            if (logoResponse.ok) {
              const logoBlob = await logoResponse.blob()
              const logoBase64 = await new Promise<string>((resolve) => {
                const reader = new FileReader()
                reader.onloadend = () => resolve(reader.result as string)
                reader.readAsDataURL(logoBlob)
              })
              formData.append('logoBase64', logoBase64)
              console.log('[handleProcess] Logo converted to base64 and added to FormData')
            } else {
              console.warn('[handleProcess] Failed to fetch logo:', logoResponse.status)
            }
          } catch (logoErr) {
            console.error('[handleProcess] Error fetching logo:', logoErr)
            // Continue without logo if fetch fails
          }
        } else {
          // In local development, logo is accessible via /uploads/, no need to convert
          console.log('[handleProcess] Using local logo URL (no conversion needed):', event.logoUrl)
        }
      }

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

      // Generate safe filename with timestamp (mobile-friendly)
      const now = new Date()
      const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
      const layoutName = (LAYOUT_OPTIONS.find(l => l.type === frameType)?.nameEn || frameType).replace(/\s+/g, '-').toLowerCase()
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
      const res = await fetch('/api/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: params.slug,
          imageUrl: previewUrl,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to print')
      }

      setStep('success')
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to print'
      setError(errorMessage)
      logClientError('Failed to print image', err, params.slug, {
        previewUrl,
        frameType,
      })
    } finally {
      setPrinting(false)
    }
  }

  const handleReset = () => {
    setStep('select-layout')
    setFrameType('single')
    setBackgroundColor('#000000')
    setPhotoSlots([])
    setPreviewUrl(null)
    setError('')
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
      'single-with-logo': 'grid-cols-1 grid-rows-1',
      'landscape-single': 'grid-cols-1 grid-rows-1',
      'landscape-two': 'grid-cols-2 grid-rows-1',
      'vertical-two': 'grid-cols-1 grid-rows-2',
      'one-plus-two': 'grid-cols-2 grid-rows-2',
      'four-cut': 'grid-cols-1 grid-rows-4',
      'two-by-two': 'grid-cols-2 grid-rows-2'
    }

    const getCells = (): { colspan?: number, rowspan?: number }[] => {
      switch (type) {
        case 'single': return [{ colspan: 1, rowspan: 1 }]
        case 'single-with-logo': return [{ colspan: 1, rowspan: 1 }]
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
            className={type === 'single-with-logo' && i === 0 ? 'bg-purple-400 border-b-2 border-yellow-400' : 'bg-purple-400'}
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
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
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">어떤 스타일로 만들까요? 🎨</h2>
                <p className="text-sm text-gray-500">마음에 드는 레이아웃을 골라보세요!</p>
              </div>

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
                    onClick={() => setFrameType(option.type)}
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

              <button
                onClick={() => setStep((frameType === 'single' || frameType === 'single-with-logo') ? 'fill-photos' : 'select-color')}
                className="w-full py-4 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white rounded-full font-bold text-lg hover:shadow-2xl transition-all shadow-lg"
              >
                다음 단계로 💫
              </button>
            </div>
          )}

          {/* Step 2: Select Color (skip for single photo) */}
          {step === 'select-color' && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">어떤 색이 좋아요? 🎨</h2>
                <p className="text-sm text-gray-500">배경색으로 분위기를 바꿔보세요!</p>
              </div>

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
                <button
                  onClick={() => setStep('select-layout')}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-full font-bold text-base hover:bg-gray-200 transition-all"
                >
                  ← 이전
                </button>
                <button
                  onClick={() => setStep('fill-photos')}
                  className="flex-1 py-3 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white rounded-full font-bold text-base hover:shadow-2xl transition-all shadow-lg"
                >
                  다음 단계로 💫
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Fill Photos */}
          {step === 'fill-photos' && (
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
                  <div className="text-right bg-white/80 backdrop-blur-sm rounded-2xl px-4 py-2">
                    <div className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
                      {photoSlots.filter(s => s.file).length}/{photoSlots.length}
                    </div>
                    <div className="text-xs text-gray-500 font-medium">완료됨 ✨</div>
                  </div>
                </div>
              </div>


              {/* Status Banner */}
              {allSlotsFilled ? (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-3xl p-4 shadow-lg">
                  <div className="flex items-center justify-center gap-2 text-green-600">
                    <span className="text-2xl">🎉</span>
                    <span className="font-bold text-lg">완벽해요! 이제 출력할 수 있어요!</span>
                  </div>
                </div>
              ) : (
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-3xl p-4 shadow-md">
                  <p className="text-center text-blue-600 font-bold flex items-center justify-center gap-2">
                    <span className="text-xl">📸</span>
                    영역을 탭해서 예쁜 사진을 올려보세요!
                  </p>
                </div>
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
                <div className="bg-white rounded-xl p-4 shadow-md">
                  <p className="text-center text-sm text-gray-600 font-medium mb-2">
                    사진을 탭하여 추가/변경/삭제
                  </p>
                  {frameType === 'four-cut' && (
                    <p className="text-center text-xs text-purple-600 mt-2">
                      ✂️ 중앙을 세로로 자르면 2개의 동일한 스트립
                    </p>
                  )}
                </div>
              </div>

              {/* Processing indicator */}
              {processing && (
                <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-4">
                  <div className="flex items-center justify-center gap-2 text-purple-700">
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-purple-600"></div>
                    <span className="font-medium">미리보기 생성 중...</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4">
                  <p className="text-red-600 text-center font-medium">{error}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                {/* Download & Print Buttons - Side by side */}
                {allSlotsFilled && previewUrl && !processing && (
                  <div className="flex gap-3">
                    <button
                      onClick={handleDownload}
                      disabled={printing}
                      className="flex-1 py-4 bg-gradient-to-r from-blue-400 to-purple-400 text-white rounded-full font-bold text-lg hover:shadow-2xl transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      저장
                    </button>
                    <button
                      onClick={handlePrint}
                      disabled={printing}
                      className="flex-1 py-4 bg-gradient-to-r from-pink-500 via-purple-500 to-pink-500 text-white rounded-full font-bold text-lg hover:shadow-2xl transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      {printing ? '출력 중...' : '프린트'}
                    </button>
                  </div>
                )}

                <button
                  onClick={() => {
                    setStep(frameType === 'single' ? 'select-layout' : 'select-color')
                    setPreviewUrl(null)
                  }}
                  disabled={printing}
                  className="w-full py-3 bg-gray-100 text-gray-700 rounded-full font-bold text-base hover:bg-gray-200 transition-all disabled:opacity-50"
                >
                  ← 이전 단계로
                </button>
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

          {/* Step 4: Success */}
          {step === 'success' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-3xl p-8 shadow-2xl text-center">
                <div className="text-6xl mb-4 animate-bounce">🎉</div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent mb-3">
                  완성되었어요!
                </h2>
                <p className="text-gray-600 mb-6 font-medium">
                  소중한 추억이 프린터로 전송되었어요 💕<br />
                  <span className="text-sm">곧 멋진 사진을 받아보실 수 있어요!</span>
                </p>
                <button
                  onClick={handleReset}
                  className="px-8 py-4 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white rounded-full font-bold text-lg hover:shadow-2xl transition-all shadow-lg"
                >
                  새로운 사진 만들기 ✨
                </button>
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
                <button
                  onClick={handleEditPhoto}
                  className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full font-bold hover:shadow-xl transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  사진 편집하기 ✨
                </button>

                <button
                  onClick={handleReplacePhoto}
                  className="w-full py-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-full font-bold hover:shadow-xl transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  다른 사진으로 바꾸기 🔄
                </button>

                <button
                  onClick={handleDeletePhoto}
                  className="w-full py-4 bg-gradient-to-r from-red-400 to-pink-400 text-white rounded-full font-bold hover:shadow-xl transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  사진 삭제하기 🗑️
                </button>

                <button
                  onClick={() => {
                    setShowActionModal(false)
                    setCurrentEditingSlot(null)
                  }}
                  className="w-full py-4 bg-gray-100 text-gray-600 rounded-full font-bold hover:bg-gray-200 transition-all"
                >
                  닫기
                </button>
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
