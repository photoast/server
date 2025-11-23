'use client'

import { useState, useEffect } from 'react'
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

interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

export default function GuestPage({ params }: { params: { slug: string } }) {
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [frameType, setFrameType] = useState<FrameType>('single')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [printSuccess, setPrintSuccess] = useState(false)
  const [showCropEditor, setShowCropEditor] = useState(false)
  const [cropAreas, setCropAreas] = useState<CropArea[]>([])
  const [backgroundColor, setBackgroundColor] = useState('#000000') // Default black
  const [showLogo, setShowLogo] = useState(true) // For single photo: show logo or not

  useEffect(() => {
    fetchEvent()
  }, [params.slug])

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

  const requiredPhotos = (frameType === 'four-cut' || frameType === 'two-by-two') ? 4 : 1

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const newFiles = [...selectedFiles, ...files].slice(0, requiredPhotos)
    setSelectedFiles(newFiles)

    // For all frame types with photos, show crop editor
    if (newFiles.length === requiredPhotos) {
      setShowCropEditor(true)
    }
  }

  const handleCropComplete = async (areas: CropArea[]) => {
    setCropAreas(areas)
    setShowCropEditor(false)
    await processImages(selectedFiles, areas)
  }

  const handleCropCancel = () => {
    setShowCropEditor(false)
    setSelectedFiles([])
  }

  const processImages = async (files: File[], crops?: CropArea[]) => {
    setPreviewUrl(null)
    setPrintSuccess(false)
    setError('')
    setProcessing(true)

    try {
      const formData = new FormData()
      formData.append('slug', params.slug)
      formData.append('frameType', frameType)

      if (frameType === 'four-cut' || frameType === 'two-by-two') {
        // Add all 4 photos
        files.forEach(file => {
          formData.append('photos', file)
        })
        // Add crop areas if provided
        if (crops && crops.length > 0) {
          formData.append('cropAreas', JSON.stringify(crops))
        }
        // Add background color
        formData.append('backgroundColor', backgroundColor)
      } else {
        // Add single photo
        formData.append('photo', files[0])
        // Add crop area if provided
        if (crops && crops.length > 0) {
          formData.append('cropArea', JSON.stringify(crops[0]))
        }
        // Add logo preference
        formData.append('showLogo', showLogo.toString())
        // Add background color
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

      setPrintSuccess(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setPrinting(false)
    }
  }

  const handleReset = () => {
    setSelectedFiles([])
    setPreviewUrl(null)
    setPrintSuccess(false)
    setError('')
    setCropAreas([])
    setShowCropEditor(false)
  }

  const removePhoto = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index)
    setSelectedFiles(newFiles)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  if (error && !event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Error</h1>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  const getCropAspectRatio = () => {
    if (frameType === 'four-cut') {
      return 485 / 357 // Life Four-Cut dual strip ratio
    } else if (frameType === 'two-by-two') {
      return 450 / 680 // 2x2 grid ratio
    } else if (frameType === 'single') {
      return 1000 / 1500 // 4x6 inch ratio
    }
    return 1 // Default square
  }

  const movePhoto = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    const newFiles = [...selectedFiles]
    const [movedFile] = newFiles.splice(fromIndex, 1)
    newFiles.splice(toIndex, 0, movedFile)
    setSelectedFiles(newFiles)
  }

  return (
    <>
      {showCropEditor && selectedFiles.length === requiredPhotos && (
        <FourCutCropEditor
          images={selectedFiles}
          onComplete={handleCropComplete}
          onCancel={handleCropCancel}
          aspectRatio={getCropAspectRatio()}
        />
      )}
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-xl p-8">
          <h1 className="text-3xl font-bold text-center mb-2">{event?.name}</h1>
          <p className="text-center text-gray-600 mb-6">
            Instant Photo Printing (102×152mm)
          </p>

          {!previewUrl && !processing && (
            <div className="space-y-6">
              {/* Frame Type Selection */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6">
                <h3 className="text-lg font-bold text-center mb-4">프레임 선택</h3>
                <div className="grid grid-cols-3 gap-4">
                  <button
                    onClick={() => {
                      setFrameType('single')
                      setSelectedFiles([])
                    }}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      frameType === 'single'
                        ? 'border-purple-600 bg-purple-100 shadow-lg'
                        : 'border-gray-300 bg-white hover:border-purple-400'
                    }`}
                  >
                    <div className="text-4xl mb-2">🖼️</div>
                    <div className="font-bold">일반 1장</div>
                    <div className="text-xs text-gray-600 mt-1">Single Photo</div>
                  </button>
                  <button
                    onClick={() => {
                      setFrameType('four-cut')
                      setSelectedFiles([])
                    }}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      frameType === 'four-cut'
                        ? 'border-purple-600 bg-purple-100 shadow-lg'
                        : 'border-gray-300 bg-white hover:border-purple-400'
                    }`}
                  >
                    <div className="text-4xl mb-2">📸</div>
                    <div className="font-bold">인생네컷</div>
                    <div className="text-xs text-gray-600 mt-1">Four-Cut Style</div>
                  </button>
                  <button
                    onClick={() => {
                      setFrameType('two-by-two')
                      setSelectedFiles([])
                    }}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      frameType === 'two-by-two'
                        ? 'border-purple-600 bg-purple-100 shadow-lg'
                        : 'border-gray-300 bg-white hover:border-purple-400'
                    }`}
                  >
                    <div className="text-4xl mb-2">🎞️</div>
                    <div className="font-bold">2×2 그리드</div>
                    <div className="text-xs text-gray-600 mt-1">2x2 Grid</div>
                  </button>
                </div>
              </div>

              {/* Background Color Selection - Available for all layouts */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-6 pb-8">
                <h3 className="text-lg font-bold text-center mb-4">배경색 선택</h3>
                <div className="grid grid-cols-5 gap-3 mb-8">
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
                        className={`w-full aspect-square rounded-lg border-2 transition-all hover:scale-105 flex items-center justify-center ${
                          backgroundColor === preset.color
                            ? 'border-purple-600 ring-2 ring-purple-300'
                            : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: preset.color }}
                        title={preset.name}
                      >
                        {backgroundColor === preset.color && (
                          <span className={`text-2xl ${preset.color === '#000000' || preset.color === '#2c3e50' || preset.color === '#6c757d' ? 'text-white' : 'text-gray-800'}`}>✓</span>
                        )}
                      </button>
                      <span className="text-xs text-gray-600 whitespace-nowrap">{preset.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Photo selection UI */}
              {frameType === 'four-cut' || frameType === 'two-by-two' ? (
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-pink-100 to-purple-100 rounded-lg p-4">
                    <p className="text-center font-semibold text-purple-800">
                      {frameType === 'four-cut' ? '4장의 사진이 2개의 동일한 스트립으로 배열됩니다 (반으로 자르기 가능)' : '4장의 사진이 2×2 그리드로 배열됩니다'}
                    </p>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {[0, 1, 2, 3].map((index) => (
                      <div
                        key={index}
                        className="relative aspect-square border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-gray-50"
                      >
                        {selectedFiles[index] ? (
                          <>
                            <Image
                              src={URL.createObjectURL(selectedFiles[index])}
                              alt={`Photo ${index + 1}`}
                              fill
                              className="object-cover"
                            />
                            <button
                              onClick={() => removePhoto(index)}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 z-10"
                            >
                              ✕
                            </button>
                            {/* Reorder buttons */}
                            <div className="absolute bottom-1 left-1 right-1 flex gap-1">
                              {index > 0 && (
                                <button
                                  onClick={() => movePhoto(index, index - 1)}
                                  className="flex-1 bg-blue-500 text-white rounded text-xs py-1 hover:bg-blue-600"
                                  title="앞으로"
                                >
                                  ←
                                </button>
                              )}
                              {index < 3 && (
                                <button
                                  onClick={() => movePhoto(index, index + 1)}
                                  className="flex-1 bg-blue-500 text-white rounded text-xs py-1 hover:bg-blue-600"
                                  title="뒤로"
                                >
                                  →
                                </button>
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                            <span className="text-2xl">{index + 1}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="text-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="photo-upload"
                      multiple
                    />
                    <label
                      htmlFor="photo-upload"
                      className="cursor-pointer inline-block px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                    >
                      {selectedFiles.length === 0
                        ? '사진 선택하기'
                        : `사진 추가 (${selectedFiles.length}/4)`}
                    </label>
                    <p className="mt-2 text-sm text-gray-500">
                      {selectedFiles.length < 4
                        ? `${4 - selectedFiles.length}장 더 필요합니다`
                        : '모든 사진이 선택되었습니다!'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Logo toggle for single photo */}
                  <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-4">
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
                      <span className="text-sm text-gray-500">
                        {showLogo ? '로고가 함께 출력됩니다' : '사진만 출력됩니다'}
                      </span>
                    </label>
                  </div>

                  {/* Single photo selection */}
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="photo-upload"
                    />
                    <label
                      htmlFor="photo-upload"
                      className="cursor-pointer inline-block px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                    >
                      사진 선택하기
                    </label>
                    <p className="mt-4 text-sm text-gray-500">
                      사진 영역을 선택할 수 있습니다
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {processing && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Processing your photo{frameType === 'four-cut' ? 's' : ''}...</p>
            </div>
          )}

          {previewUrl && !printSuccess && (
            <div className="space-y-6">
              <div className="flex flex-col items-center">
                <div className="relative w-full aspect-[1000/1500] max-w-md mx-auto overflow-hidden shadow-2xl">
                  <Image
                    src={previewUrl}
                    alt="Preview"
                    fill
                    className="object-cover"
                  />
                </div>
                <p className="text-center text-gray-600 text-sm mt-4">
                  출력 크기: 4×6 inch (102×152mm)
                  {frameType === 'four-cut' && (
                    <span className="block text-purple-600 mt-1">
                      ✂️ 중앙을 세로로 자르면 2개의 동일한 스트립
                    </span>
                  )}
                  {frameType === 'two-by-two' && (
                    <span className="block text-purple-600 mt-1">
                      📷 2×2 그리드 레이아웃
                    </span>
                  )}
                </p>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600">{error}</p>
                </div>
              )}

              <div className="flex gap-4">
                <button
                  onClick={handlePrint}
                  disabled={printing}
                  className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                >
                  {printing ? 'Printing...' : 'Print Photo'}
                </button>
                <button
                  onClick={handleReset}
                  disabled={printing}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition disabled:opacity-50"
                >
                  New Photo
                </button>
              </div>
            </div>
          )}

          {printSuccess && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-green-600 mb-2">Print Sent!</h2>
              <p className="text-gray-600 mb-6">
                Your photo{frameType === 'four-cut' ? 's are' : ' is'} being printed at 102×152mm.
              </p>
              <button
                onClick={handleReset}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
              >
                Print Another Photo
              </button>
            </div>
          )}
          </div>
        </div>
      </div>
    </>
  )
}
