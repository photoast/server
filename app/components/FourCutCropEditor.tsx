'use client'

import { useState, useCallback, useEffect } from 'react'
import Cropper from 'react-easy-crop'
import { Area, Point } from 'react-easy-crop'

interface CropData {
  crop: Point
  zoom: number
  croppedAreaPixels: Area | null
}

interface FourCutCropEditorProps {
  images: File[]
  onComplete: (cropAreas: Array<{ x: number; y: number; width: number; height: number }>) => void
  onCancel: () => void
  aspectRatio?: number // Optional aspect ratio, defaults to life-four-cut ratio
}

export default function FourCutCropEditor({ images, onComplete, onCancel, aspectRatio: propAspectRatio }: FourCutCropEditorProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [cropData, setCropData] = useState<CropData[]>(
    images.map(() => ({
      crop: { x: 0, y: 0 },
      zoom: 1,
      croppedAreaPixels: null,
    }))
  )
  const [imageUrls, setImageUrls] = useState<string[]>([])

  // Create object URLs for images
  useEffect(() => {
    const urls = images.map(file => URL.createObjectURL(file))
    setImageUrls(urls)

    // Cleanup URLs on unmount
    return () => {
      urls.forEach(url => URL.revokeObjectURL(url))
    }
  }, [images])

  const currentCrop = cropData[currentIndex]

  const onCropChange = (crop: Point) => {
    const newCropData = [...cropData]
    newCropData[currentIndex] = { ...newCropData[currentIndex], crop }
    setCropData(newCropData)
  }

  const onZoomChange = (zoom: number) => {
    const newCropData = [...cropData]
    newCropData[currentIndex] = { ...newCropData[currentIndex], zoom }
    setCropData(newCropData)
  }

  const onCropComplete = useCallback(
    (_croppedArea: Area, croppedAreaPixels: Area) => {
      const newCropData = [...cropData]
      newCropData[currentIndex] = { ...newCropData[currentIndex], croppedAreaPixels }
      setCropData(newCropData)
    },
    [cropData, currentIndex]
  )

  const handleNext = () => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const handleComplete = () => {
    const cropAreas = cropData.map(data => {
      if (data.croppedAreaPixels) {
        return {
          x: data.croppedAreaPixels.x,
          y: data.croppedAreaPixels.y,
          width: data.croppedAreaPixels.width,
          height: data.croppedAreaPixels.height,
        }
      }
      return { x: 0, y: 0, width: 0, height: 0 }
    })
    onComplete(cropAreas)
  }

  const aspectRatio = propAspectRatio || (900 / 685) // Default to Life Four-Cut photo dimensions

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
      <div className="w-full h-full max-w-4xl mx-auto p-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-white">
            <h2 className="text-2xl font-bold">사진 편집</h2>
            <p className="text-sm text-gray-300">
              사진 {currentIndex + 1} / {images.length}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
          >
            취소
          </button>
        </div>

        {/* Progress indicator */}
        <div className="flex gap-2 mb-4">
          {images.map((_, index) => (
            <div
              key={index}
              className={`flex-1 h-2 rounded-full transition-colors ${
                index === currentIndex
                  ? 'bg-purple-500'
                  : index < currentIndex
                  ? 'bg-green-500'
                  : 'bg-gray-600'
              }`}
            />
          ))}
        </div>

        {/* Cropper */}
        <div className="flex-1 relative bg-gray-900 rounded-lg overflow-hidden">
          {imageUrls[currentIndex] && (
            <Cropper
              image={imageUrls[currentIndex]}
              crop={currentCrop.crop}
              zoom={currentCrop.zoom}
              aspect={aspectRatio}
              onCropChange={onCropChange}
              onZoomChange={onZoomChange}
              onCropComplete={onCropComplete}
              style={{
                containerStyle: {
                  width: '100%',
                  height: '100%',
                },
              }}
            />
          )}
        </div>

        {/* Zoom slider */}
        <div className="mt-4 px-4">
          <label className="text-white text-sm mb-2 block">확대/축소</label>
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={currentCrop.zoom}
            onChange={(e) => onZoomChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Controls */}
        <div className="flex gap-4 mt-4">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← 이전
          </button>
          {currentIndex < images.length - 1 ? (
            <button
              onClick={handleNext}
              className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
            >
              다음 →
            </button>
          ) : (
            <button
              onClick={handleComplete}
              className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-bold"
            >
              완료 ✓
            </button>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-4 text-center text-gray-400 text-sm">
          <p>드래그로 위치 조정, 핀치/슬라이더로 확대/축소</p>
        </div>
      </div>
    </div>
  )
}
