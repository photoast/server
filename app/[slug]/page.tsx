'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import FourCutCropEditor from '../components/FourCutCropEditor'
import {
  SinglePhotoPreview,
  FourCutPreview,
  TwoByTwoPreview,
  VerticalTwoPreview,
  HorizontalTwoPreview,
  OnePlusTwoPreview
} from '../components/LayoutPreviews'
import { LAYOUT_OPTIONS, getPhotoCount, getCropAspectRatioForSlot } from './layoutConfig'
import type { FrameType } from '@/lib/types'

interface Event {
  name: string
  slug: string
  printerUrl: string
  logoUrl?: string
  photoAreaRatio?: number
}

interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

interface PhotoSlot {
  index: number
  file: File | null
  cropArea: CropArea | null
  croppedImageUrl: string | null
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
  const [showLogo, setShowLogo] = useState(true)

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
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchEvent()
  }, [params.slug])

  // Auto-process image when all slots are filled
  useEffect(() => {
    const allSlotsFilled = photoSlots.every(slot => slot.file !== null)
    if (allSlotsFilled && photoSlots.length > 0 && !processing && !previewUrl && step === 'fill-photos') {
      handleProcess()
    }
  }, [photoSlots, step])

  // ============ Event Handlers ============

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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (currentEditingSlot === null) return

    const file = e.target.files?.[0]
    if (!file) return

    // Update slot with new file
    setPhotoSlots(prevSlots => {
      const newSlots = [...prevSlots]
      newSlots[currentEditingSlot] = {
        ...newSlots[currentEditingSlot],
        file,
        cropArea: null,
        croppedImageUrl: null
      }
      return newSlots
    })

    // Clear preview when adding new photo
    setPreviewUrl(null)

    // Open crop editor
    setShowCropEditor(true)

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleCropComplete = (result: { cropAreas: (CropArea | null)[], croppedImageUrls: string[] }) => {
    if (currentEditingSlot === null) return

    setPhotoSlots(prevSlots => {
      const newSlots = [...prevSlots]
      newSlots[currentEditingSlot] = {
        ...newSlots[currentEditingSlot],
        cropArea: result.cropAreas[0],
        croppedImageUrl: result.croppedImageUrls[0]
      }
      return newSlots
    })

    // Clear preview to regenerate with new crop
    setPreviewUrl(null)
    setShowCropEditor(false)
    setCurrentEditingSlot(null)
  }

  const handleCropCancel = () => {
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

    setShowCropEditor(false)
    setCurrentEditingSlot(null)
  }


  const handleProcess = async () => {
    setProcessing(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('slug', params.slug)
      formData.append('frameType', frameType)

      if (frameType === 'single') {
        if (photoSlots[0].file) {
          formData.append('photo', photoSlots[0].file)
        }
        if (photoSlots[0].cropArea) {
          formData.append('cropArea', JSON.stringify(photoSlots[0].cropArea))
        }
        formData.append('showLogo', showLogo.toString())
        formData.append('backgroundColor', '#FFFFFF')
      } else {
        photoSlots.forEach(slot => {
          if (slot.file) formData.append('photos', slot.file)
        })
        const cropAreas = photoSlots.map(slot => slot.cropArea)
        formData.append('cropAreas', JSON.stringify(cropAreas))
        formData.append('backgroundColor', backgroundColor)
      }

      const res = await fetch('/api/process-image', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to process image')
      }

      const data = await res.json()
      setPreviewUrl(data.url)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcessing(false)
    }
  }

  const handleDownload = async () => {
    if (!previewUrl) return

    try {
      // Fetch the image
      const response = await fetch(previewUrl)
      const blob = await response.blob()

      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
      const layoutName = LAYOUT_OPTIONS.find(l => l.type === frameType)?.nameEn || frameType
      link.download = `photoast-${layoutName}-${timestamp}.jpg`

      // Trigger download
      document.body.appendChild(link)
      link.click()

      // Cleanup
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      setError('다운로드에 실패했습니다')
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
      setError(err.message)
    } finally {
      setPrinting(false)
    }
  }

  const handleReset = () => {
    setStep('select-layout')
    setFrameType('single')
    setBackgroundColor('#000000')
    setShowLogo(true)
    setPhotoSlots([])
    setPreviewUrl(null)
    setError('')
  }

  // ============ Render Helpers ============

  const renderLayoutPreview = () => {
    const previewProps = {
      photoSlots,
      onSlotClick: handleSlotClick,
      backgroundColor
    }

    switch (frameType) {
      case 'single':
        return <SinglePhotoPreview {...previewProps} />
      case 'four-cut':
        return <FourCutPreview {...previewProps} />
      case 'two-by-two':
        return <TwoByTwoPreview {...previewProps} />
      case 'vertical-two':
        return <VerticalTwoPreview {...previewProps} />
      case 'horizontal-two':
        return <HorizontalTwoPreview {...previewProps} />
      case 'one-plus-two':
        return <OnePlusTwoPreview {...previewProps} />
      default:
        return null
    }
  }

  const renderLayoutOptionPreview = (type: FrameType) => {
    const gridStyles: Record<FrameType, string> = {
      'single': 'grid-cols-1 grid-rows-1',
      'vertical-two': 'grid-cols-1 grid-rows-2',
      'horizontal-two': 'grid-cols-2 grid-rows-1',
      'one-plus-two': 'grid-cols-2 grid-rows-2',
      'four-cut': 'grid-cols-2 grid-rows-4',
      'two-by-two': 'grid-cols-2 grid-rows-2'
    }

    const getCells = (): { colspan?: number, rowspan?: number }[] => {
      switch (type) {
        case 'single': return [{ colspan: 1, rowspan: 1 }]
        case 'vertical-two': return [{}, {}]
        case 'horizontal-two': return [{}, {}]
        case 'one-plus-two': return [{ colspan: 2 }, {}, {}]
        case 'four-cut': return [{}, {}, {}, {}, {}, {}, {}, {}]
        case 'two-by-two': return [{}, {}, {}, {}]
        default: return []
      }
    }

    return (
      <div className={`grid gap-0.5 h-16 w-10 bg-gray-300 rounded overflow-hidden ${gridStyles[type]}`}>
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">{event.name}</h1>
          <p className="text-gray-600">사진을 선택하고 출력하세요</p>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-3xl shadow-2xl p-6">
          {/* Step 1: Select Layout */}
          {step === 'select-layout' && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-bold text-gray-800 mb-2">레이아웃 선택</h2>
                <p className="text-sm text-gray-600">원하시는 레이아웃을 선택하세요</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {LAYOUT_OPTIONS.map((option) => (
                  <button
                    key={option.type}
                    onClick={() => setFrameType(option.type)}
                    className={`p-4 rounded-2xl border-2 transition-all ${
                      frameType === option.type
                        ? 'border-purple-600 bg-purple-50 shadow-lg scale-105'
                        : 'border-gray-200 hover:border-purple-300 hover:shadow-md'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-3">
                      {renderLayoutOptionPreview(option.type)}
                      <div className="text-center">
                        <div className="font-semibold text-gray-800">{option.name}</div>
                        <div className="text-xs text-gray-500 mt-1">{option.description}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setStep(frameType === 'single' ? 'fill-photos' : 'select-color')}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold text-lg hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg active:scale-95"
              >
                다음
              </button>
            </div>
          )}

          {/* Step 2: Select Color (skip for single photo) */}
          {step === 'select-color' && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-bold text-gray-800 mb-2">배경색 선택</h2>
                <p className="text-sm text-gray-600">사진 배경색을 선택하세요</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {BACKGROUND_COLORS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setBackgroundColor(color.value)}
                    className={`p-4 rounded-2xl border-2 transition-all ${
                      backgroundColor === color.value
                        ? 'border-purple-600 shadow-lg scale-105'
                        : 'border-gray-200 hover:border-purple-300'
                    }`}
                  >
                    <div
                      className="w-full h-16 rounded-xl mb-2 shadow-md"
                      style={{ backgroundColor: color.value }}
                    />
                    <div className="text-sm font-medium text-gray-700">{color.name}</div>
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('select-layout')}
                  className="flex-1 py-4 bg-gray-200 text-gray-700 rounded-xl font-semibold text-lg hover:bg-gray-300 transition-colors active:scale-95"
                >
                  이전
                </button>
                <button
                  onClick={() => setStep('fill-photos')}
                  className="flex-1 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold text-lg hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg active:scale-95"
                >
                  다음
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Fill Photos */}
          {step === 'fill-photos' && (
            <div className="space-y-6">
              {/* Header with layout info */}
              <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-2xl p-4 shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">
                      {LAYOUT_OPTIONS.find(l => l.type === frameType)?.name}
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      {LAYOUT_OPTIONS.find(l => l.type === frameType)?.description}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-purple-600">
                      {photoSlots.filter(s => s.file).length}/{photoSlots.length}
                    </div>
                    <div className="text-xs text-gray-600">사진 선택됨</div>
                  </div>
                </div>
              </div>

              {/* Logo toggle for single photo */}
              {frameType === 'single' && (
                <div className="bg-gradient-to-r from-yellow-100 to-orange-100 rounded-2xl p-4 shadow-md">
                  <label className="flex items-center justify-center gap-3 cursor-pointer">
                    <span className="font-semibold text-gray-700">로고 포함</span>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={showLogo}
                        onChange={(e) => {
                          setShowLogo(e.target.checked)
                          setPreviewUrl(null)
                        }}
                        className="sr-only"
                      />
                      <div className={`w-14 h-8 rounded-full transition-colors ${showLogo ? 'bg-purple-600' : 'bg-gray-300'}`}>
                        <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${showLogo ? 'translate-x-6' : ''}`}></div>
                      </div>
                    </div>
                    <span className="text-sm text-gray-600">
                      {showLogo ? '로고가 함께 출력됩니다' : '사진만 출력됩니다'}
                    </span>
                  </label>
                </div>
              )}

              {/* Status Banner */}
              {allSlotsFilled ? (
                <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-4">
                  <div className="flex items-center justify-center gap-2 text-green-700">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="font-semibold">모든 사진이 준비되었습니다!</span>
                  </div>
                </div>
              ) : (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4">
                  <p className="text-center text-blue-700 font-medium">
                    📸 아래 영역을 탭하여 사진을 추가/수정하세요
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
                {renderLayoutPreview()}
                <div className="bg-white rounded-xl p-4 shadow-md">
                  <p className="text-center text-sm text-gray-600 font-medium mb-2">
                    사진을 탭하여 추가/변경/삭제
                  </p>
                  <p className="text-center text-xs text-gray-500">
                    출력 크기: <span className="font-semibold">4×6 inch</span> (102×152mm)
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

              {/* Progress bar */}
              <div className="bg-white rounded-2xl p-4 shadow-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">진행률</span>
                  <span className="text-sm text-gray-600">
                    {Math.round((photoSlots.filter(s => s.file).length / photoSlots.length) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-purple-600 to-pink-600 h-3 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${(photoSlots.filter(s => s.file).length / photoSlots.length) * 100}%` }}
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4">
                  <p className="text-red-600 text-center font-medium">{error}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                {/* Download Button - Only show when preview is ready */}
                {allSlotsFilled && previewUrl && !processing && (
                  <button
                    onClick={handleDownload}
                    disabled={printing}
                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-semibold text-lg hover:from-blue-700 hover:to-cyan-700 transition-all active:scale-95 shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    이미지 다운로드
                  </button>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setStep(frameType === 'single' ? 'select-layout' : 'select-color')
                      setPreviewUrl(null)
                    }}
                    disabled={printing}
                    className="flex-1 py-4 bg-gray-200 text-gray-700 rounded-xl font-semibold text-lg hover:bg-gray-300 transition-colors active:scale-95 disabled:opacity-50"
                  >
                    ← 이전
                  </button>
                  <button
                    onClick={handlePrint}
                    disabled={!allSlotsFilled || processing || !previewUrl || printing}
                    className={`flex-1 py-4 rounded-xl font-semibold text-lg transition-all active:scale-95 shadow-lg ${
                      allSlotsFilled && previewUrl && !processing && !printing
                        ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {printing ? '출력 중...' : '🖨️ 프린트하기'}
                  </button>
                </div>
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
              <div className="bg-white rounded-2xl p-8 shadow-lg text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">출력 완료!</h2>
                <p className="text-gray-600 mb-6">
                  사진이 프린터로 전송되었습니다.<br />
                  잠시 후 출력물을 받아가세요.
                </p>
                <button
                  onClick={handleReset}
                  className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg active:scale-95"
                >
                  처음으로
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Modal */}
        {showActionModal && currentEditingSlot !== null && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-4">
              <h3 className="text-xl font-bold text-gray-800 text-center">
                사진 {currentEditingSlot + 1}
              </h3>

              <div className="space-y-3">
                <button
                  onClick={handleEditPhoto}
                  className="w-full py-4 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  사진 편집 (크롭/확대)
                </button>

                <button
                  onClick={handleReplacePhoto}
                  className="w-full py-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  사진 교체
                </button>

                <button
                  onClick={handleDeletePhoto}
                  className="w-full py-4 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  사진 삭제
                </button>

                <button
                  onClick={() => {
                    setShowActionModal(false)
                    setCurrentEditingSlot(null)
                  }}
                  className="w-full py-4 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-all"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Crop Editor Modal */}
        {showCropEditor && currentEditingSlot !== null && photoSlots[currentEditingSlot]?.file && (
          <FourCutCropEditor
            images={[photoSlots[currentEditingSlot].file!]}
            aspectRatio={getCropAspectRatioForSlot(frameType, currentEditingSlot)}
            onComplete={handleCropComplete}
            onCancel={handleCropCancel}
          />
        )}
      </div>
    </div>
  )
}
