'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { collectDeviceInfo } from '@/lib/deviceInfo'
import FourCutCropEditor from '@/app/components/FourCutCropEditor'

interface Event {
  _id: string
  name: string
  slug: string
  printerUrl: string
  logoUrl?: string
  photoAreaRatio?: number
}

type FrameType = 'single' | 'four-cut' | 'two-by-two'
type Step = 'select-layout' | 'select-color' | 'fill-photos' | 'preview' | 'success'

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
}

export default function GuestPage({ params }: { params: { slug: string } }) {
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [step, setStep] = useState<Step>('select-layout')
  const [frameType, setFrameType] = useState<FrameType>('single')
  const [backgroundColor, setBackgroundColor] = useState('#FFFFFF')
  const [showLogo, setShowLogo] = useState(true)
  const [photoSlots, setPhotoSlots] = useState<PhotoSlot[]>([])
  const [currentEditingSlot, setCurrentEditingSlot] = useState<number | null>(null)
  const [showCropEditor, setShowCropEditor] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [printing, setPrinting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchEvent()
  }, [params.slug])

  useEffect(() => {
    // Initialize photo slots based on frame type
    const slotCount = frameType === 'single' ? 1 : 4
    setPhotoSlots(Array.from({ length: slotCount }, (_, i) => ({
      index: i,
      file: null,
      cropArea: null,
    })))
  }, [frameType])

  const fetchEvent = async () => {
    try {
      const res = await fetch(`/api/events/slug/${params.slug}`)
      if (!res.ok) {
        throw new Error('Event not found')
      }
      const data = await res.json()
      setEvent(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleLayoutSelect = (type: FrameType) => {
    setFrameType(type)
    if (type === 'single') {
      setBackgroundColor('#FFFFFF')
      setStep('fill-photos')
    } else {
      setBackgroundColor('#000000')
      setStep('select-color')
    }
  }

  const handleColorSelect = () => {
    setStep('fill-photos')
  }

  const handleSlotClick = (slotIndex: number) => {
    setCurrentEditingSlot(slotIndex)
    fileInputRef.current?.click()
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || currentEditingSlot === null) return

    // Show crop editor
    const newSlots = [...photoSlots]
    newSlots[currentEditingSlot].file = file
    setPhotoSlots(newSlots)
    setShowCropEditor(true)

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleCropComplete = (areas: CropArea[]) => {
    if (currentEditingSlot === null) return

    const newSlots = [...photoSlots]
    newSlots[currentEditingSlot].cropArea = areas[0]
    setPhotoSlots(newSlots)
    setShowCropEditor(false)
    setCurrentEditingSlot(null)
  }

  const handleCropCancel = () => {
    if (currentEditingSlot === null) return

    const newSlots = [...photoSlots]
    newSlots[currentEditingSlot].file = null
    newSlots[currentEditingSlot].cropArea = null
    setPhotoSlots(newSlots)
    setShowCropEditor(false)
    setCurrentEditingSlot(null)
  }

  const handleRemovePhoto = (slotIndex: number) => {
    const newSlots = [...photoSlots]
    newSlots[slotIndex].file = null
    newSlots[slotIndex].cropArea = null
    setPhotoSlots(newSlots)
  }

  const allSlotsFilled = photoSlots.every(slot => slot.file !== null)

  const handleProcess = async () => {
    setProcessing(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('slug', params.slug)
      formData.append('frameType', frameType)

      if (frameType === 'four-cut' || frameType === 'two-by-two') {
        photoSlots.forEach(slot => {
          if (slot.file) formData.append('photos', slot.file)
        })
        const cropAreas = photoSlots.map(slot => slot.cropArea!)
        formData.append('cropAreas', JSON.stringify(cropAreas))
        formData.append('backgroundColor', backgroundColor)
      } else {
        if (photoSlots[0].file) {
          formData.append('photo', photoSlots[0].file)
        }
        if (photoSlots[0].cropArea) {
          formData.append('cropArea', JSON.stringify(photoSlots[0].cropArea))
        }
        formData.append('showLogo', showLogo.toString())
        formData.append('backgroundColor', '#FFFFFF')
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
      setStep('preview')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcessing(false)
    }
  }

  const handlePrint = async () => {
    if (!previewUrl) return

    setPrinting(true)
    setError('')

    try {
      const deviceInfo = collectDeviceInfo()

      const res = await fetch('/api/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: params.slug,
          imageUrl: previewUrl,
          deviceInfo,
        }),
      })

      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error || 'Print failed')
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
    setBackgroundColor('#FFFFFF')
    setShowLogo(true)
    setPhotoSlots([])
    setPreviewUrl(null)
    setError('')
  }

  const getCropAspectRatio = () => {
    if (frameType === 'four-cut') return 485 / 357
    if (frameType === 'two-by-two') return 450 / 680
    return 1000 / 1500
  }

  const getLayoutPreview = () => {
    if (frameType === 'single') {
      return (
        <div className="relative w-full max-w-sm mx-auto" style={{ aspectRatio: '2/3' }}>
          <div className="absolute inset-0 bg-gray-100 rounded-2xl overflow-hidden shadow-lg">
            <button
              onClick={() => handleSlotClick(0)}
              className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100 hover:from-purple-200 hover:to-pink-200 transition-colors group"
            >
              {photoSlots[0]?.file ? (
                <div className="relative w-full h-full">
                  <Image
                    src={URL.createObjectURL(photoSlots[0].file)}
                    alt="Photo 1"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemovePhoto(0)
                    }}
                    className="absolute top-3 right-3 bg-red-500 text-white rounded-full w-10 h-10 flex items-center justify-center text-lg hover:bg-red-600 z-10 shadow-lg"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-6xl mb-3">📷</div>
                  <div className="text-lg font-semibold text-gray-700">사진 선택</div>
                  <div className="text-sm text-gray-500 mt-1">탭하여 추가</div>
                </div>
              )}
            </button>
          </div>
        </div>
      )
    }

    if (frameType === 'four-cut') {
      return (
        <div className="relative w-full max-w-sm mx-auto" style={{ aspectRatio: '2/3' }}>
          <div className="absolute inset-0 flex gap-2 p-2 bg-gray-900 rounded-2xl shadow-lg">
            {/* Left strip */}
            <div className="flex-1 flex flex-col gap-2">
              {[0, 1, 2, 3].map((i) => (
                <button
                  key={i}
                  onClick={() => handleSlotClick(i)}
                  className="flex-1 relative bg-gradient-to-br from-purple-100 to-pink-100 hover:from-purple-200 hover:to-pink-200 transition-colors rounded-lg overflow-hidden group"
                >
                  {photoSlots[i]?.file ? (
                    <div className="relative w-full h-full">
                      <Image
                        src={URL.createObjectURL(photoSlots[i].file)}
                        alt={`Photo ${i + 1}`}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemovePhoto(i)
                        }}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm hover:bg-red-600 z-10 shadow-md"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full">
                      <div className="text-3xl mb-1">📷</div>
                      <div className="text-xs font-medium text-gray-700">{i + 1}</div>
                    </div>
                  )}
                </button>
              ))}
            </div>
            {/* Right strip (duplicate) */}
            <div className="flex-1 flex flex-col gap-2 opacity-50">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex-1 relative bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg overflow-hidden"
                >
                  {photoSlots[i]?.file && (
                    <Image
                      src={URL.createObjectURL(photoSlots[i].file)}
                      alt={`Photo ${i + 1} duplicate`}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="text-center mt-3 text-sm text-gray-500">
            ✂️ 중앙을 잘라서 2개의 스트립으로
          </div>
        </div>
      )
    }

    if (frameType === 'two-by-two') {
      return (
        <div className="relative w-full max-w-sm mx-auto" style={{ aspectRatio: '2/3' }}>
          <div className="absolute inset-0 grid grid-cols-2 gap-2 p-2 bg-gray-900 rounded-2xl shadow-lg">
            {[0, 1, 2, 3].map((i) => (
              <button
                key={i}
                onClick={() => handleSlotClick(i)}
                className="relative bg-gradient-to-br from-purple-100 to-pink-100 hover:from-purple-200 hover:to-pink-200 transition-colors rounded-lg overflow-hidden group"
              >
                {photoSlots[i]?.file ? (
                  <div className="relative w-full h-full">
                    <Image
                      src={URL.createObjectURL(photoSlots[i].file)}
                      alt={`Photo ${i + 1}`}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemovePhoto(i)
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm hover:bg-red-600 z-10 shadow-md"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full">
                    <div className="text-4xl mb-2">📷</div>
                    <div className="text-sm font-medium text-gray-700">{i + 1}</div>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  if (error && !event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 p-4">
        <div className="text-center bg-white rounded-2xl p-8 shadow-xl max-w-md">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Error</h1>
          <p className="text-gray-700">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {showCropEditor && currentEditingSlot !== null && photoSlots[currentEditingSlot].file && (
        <FourCutCropEditor
          images={[photoSlots[currentEditingSlot].file!]}
          onComplete={handleCropComplete}
          onCancel={handleCropCancel}
          aspectRatio={getCropAspectRatio()}
        />
      )}

      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 pb-8">
        {/* Header */}
        <div className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold text-center text-gray-800">{event?.name}</h1>
            <p className="text-center text-sm text-gray-600 mt-1">
              Instant Photo Printing (4×6 inch)
            </p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-6">
          {/* Step 1: Select Layout */}
          {step === 'select-layout' && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-bold text-gray-800 mb-2">레이아웃 선택</h2>
                <p className="text-sm text-gray-600">원하는 사진 레이아웃을 선택하세요</p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <button
                  onClick={() => handleLayoutSelect('single')}
                  className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all active:scale-95"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-5xl">🖼️</div>
                    <div className="flex-1 text-left">
                      <div className="text-lg font-bold text-gray-800">일반 1장</div>
                      <div className="text-sm text-gray-600">Single Photo</div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => handleLayoutSelect('four-cut')}
                  className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all active:scale-95"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-5xl">📸</div>
                    <div className="flex-1 text-left">
                      <div className="text-lg font-bold text-gray-800">인생네컷</div>
                      <div className="text-sm text-gray-600">Four-Cut Style (반으로 자르기 가능)</div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => handleLayoutSelect('two-by-two')}
                  className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all active:scale-95"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-5xl">🎞️</div>
                    <div className="flex-1 text-left">
                      <div className="text-lg font-bold text-gray-800">2×2 그리드</div>
                      <div className="text-sm text-gray-600">2x2 Grid Layout</div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Select Color (for multi-photo only) */}
          {step === 'select-color' && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-bold text-gray-800 mb-2">배경색 선택</h2>
                <p className="text-sm text-gray-600">사진 배경색을 선택하세요</p>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-lg">
                <div className="grid grid-cols-5 gap-3 mb-6">
                  {[
                    { name: '블랙', color: '#000000' },
                    { name: '화이트', color: '#FFFFFF' },
                    { name: '네이비', color: '#2c3e50' },
                    { name: '핑크', color: '#ffb6c1' },
                    { name: '민트', color: '#98d8c8' },
                    { name: '라벤더', color: '#b19cd9' },
                    { name: '코랄', color: '#ff6b6b' },
                    { name: '스카이', color: '#87ceeb' },
                    { name: '그레이', color: '#6c757d' },
                    { name: '베이지', color: '#f5f5dc' },
                  ].map((preset) => (
                    <div key={preset.color} className="flex flex-col items-center gap-2">
                      <button
                        onClick={() => setBackgroundColor(preset.color)}
                        className={`w-full aspect-square rounded-xl border-3 transition-all active:scale-95 flex items-center justify-center ${
                          backgroundColor === preset.color
                            ? 'border-purple-600 ring-4 ring-purple-300'
                            : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: preset.color }}
                      >
                        {backgroundColor === preset.color && (
                          <span className={`text-2xl ${preset.color === '#000000' || preset.color === '#2c3e50' || preset.color === '#6c757d' ? 'text-white' : 'text-gray-800'}`}>✓</span>
                        )}
                      </button>
                      <span className="text-xs text-gray-600">{preset.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('select-layout')}
                  className="flex-1 py-4 bg-gray-200 text-gray-700 rounded-xl font-semibold text-lg hover:bg-gray-300 transition-colors active:scale-95"
                >
                  이전
                </button>
                <button
                  onClick={handleColorSelect}
                  className="flex-1 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold text-lg hover:from-purple-700 hover:to-pink-700 transition-colors active:scale-95 shadow-lg"
                >
                  다음
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Fill Photos */}
          {step === 'fill-photos' && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-bold text-gray-800 mb-2">사진 선택</h2>
                <p className="text-sm text-gray-600">각 영역을 탭하여 사진을 추가하세요</p>
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
                        onChange={(e) => setShowLogo(e.target.checked)}
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

              {/* Layout Preview */}
              <div className="bg-white rounded-2xl p-6 shadow-lg">
                {getLayoutPreview()}
              </div>

              {/* Progress */}
              <div className="bg-white rounded-2xl p-4 shadow-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    {photoSlots.filter(s => s.file).length} / {photoSlots.length} 완료
                  </span>
                  <span className="text-sm text-gray-600">
                    {allSlotsFilled ? '✓ 모든 사진 준비 완료' : '사진을 추가해주세요'}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-purple-600 to-pink-600 h-2 rounded-full transition-all"
                    style={{ width: `${(photoSlots.filter(s => s.file).length / photoSlots.length) * 100}%` }}
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4">
                  <p className="text-red-600 text-center">{error}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(frameType === 'single' ? 'select-layout' : 'select-color')}
                  className="flex-1 py-4 bg-gray-200 text-gray-700 rounded-xl font-semibold text-lg hover:bg-gray-300 transition-colors active:scale-95"
                >
                  이전
                </button>
                <button
                  onClick={handleProcess}
                  disabled={!allSlotsFilled || processing}
                  className={`flex-1 py-4 rounded-xl font-semibold text-lg transition-all active:scale-95 shadow-lg ${
                    allSlotsFilled && !processing
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {processing ? '처리 중...' : '프리뷰 보기'}
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

          {/* Step 4: Preview */}
          {step === 'preview' && previewUrl && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-bold text-gray-800 mb-2">프리뷰</h2>
                <p className="text-sm text-gray-600">출력 전 최종 확인</p>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-lg">
                <div className="relative w-full aspect-[2/3] max-w-sm mx-auto overflow-hidden rounded-xl shadow-2xl">
                  <Image
                    src={previewUrl}
                    alt="Preview"
                    fill
                    className="object-cover"
                  />
                </div>
                <p className="text-center text-sm text-gray-600 mt-4">
                  출력 크기: 4×6 inch (102×152mm)
                  {frameType === 'four-cut' && (
                    <span className="block text-purple-600 mt-1">
                      ✂️ 중앙을 세로로 자르면 2개의 동일한 스트립
                    </span>
                  )}
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4">
                  <p className="text-red-600 text-center">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('fill-photos')}
                  disabled={printing}
                  className="flex-1 py-4 bg-gray-200 text-gray-700 rounded-xl font-semibold text-lg hover:bg-gray-300 transition-colors active:scale-95 disabled:opacity-50"
                >
                  다시 선택
                </button>
                <button
                  onClick={handlePrint}
                  disabled={printing}
                  className="flex-1 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold text-lg hover:from-green-700 hover:to-emerald-700 transition-colors active:scale-95 shadow-lg disabled:opacity-50"
                >
                  {printing ? '출력 중...' : '프린트하기'}
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Success */}
          {step === 'success' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl p-8 shadow-lg text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-10 h-10 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-green-600 mb-2">출력 완료!</h2>
                <p className="text-gray-600 mb-6">
                  사진이 프린터로 전송되었습니다.<br />
                  잠시 후 출력물을 받으실 수 있습니다.
                </p>
                <button
                  onClick={handleReset}
                  className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold text-lg hover:from-purple-700 hover:to-pink-700 transition-colors active:scale-95 shadow-lg"
                >
                  새로운 사진 출력하기
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
