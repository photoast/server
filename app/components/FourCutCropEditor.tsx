'use client'

import { useState, useCallback, useEffect } from 'react'
import Cropper from 'react-easy-crop'
import { Area, Point } from 'react-easy-crop'

interface CropData {
  crop: Point
  zoom: number
  croppedAreaPixels: Area | null
  rotation: number // 0, 90, 180, 270
}

interface FourCutCropEditorProps {
  images: File[]
  onComplete: (result: {
    cropAreas: Array<{ x: number; y: number; width: number; height: number } | null>,
    croppedImageUrls: string[]
  }) => void
  onCancel: () => void
  aspectRatio?: number // Optional aspect ratio, defaults to life-four-cut ratio
}

export default function FourCutCropEditor({ images, onComplete, onCancel, aspectRatio: propAspectRatio }: FourCutCropEditorProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [cropData, setCropData] = useState<CropData[]>(
    images.map(() => ({
      crop: { x: 0, y: 0 },
      zoom: 1,
      croppedAreaPixels: null,
      rotation: 0,
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

  // Ensure initial crop is set for all images
  useEffect(() => {
    // Trigger initial crop complete for each image by setting a small timeout
    // This ensures react-easy-crop has loaded the image
    const timer = setTimeout(() => {
      // Check if any crop data is still missing croppedAreaPixels
      const hasUncroppedImages = cropData.some(data => !data.croppedAreaPixels)
      if (hasUncroppedImages) {
        console.log('Some images have not been cropped yet, waiting for onCropComplete...')
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [cropData])

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

  const onRotate = (direction: 'cw' | 'ccw') => {
    const newCropData = [...cropData]
    const currentRotation = newCropData[currentIndex].rotation
    let newRotation: number

    if (direction === 'cw') {
      newRotation = (currentRotation + 90) % 360
    } else {
      newRotation = (currentRotation - 90 + 360) % 360
    }

    // Reset crop position when rotating
    newCropData[currentIndex] = {
      ...newCropData[currentIndex],
      rotation: newRotation,
      crop: { x: 0, y: 0 },
      croppedAreaPixels: null
    }
    setCropData(newCropData)
  }

  const onCropComplete = useCallback(
    (_croppedArea: Area, croppedAreaPixels: Area) => {
      setCropData(prevData => {
        const newCropData = [...prevData]
        newCropData[currentIndex] = { ...newCropData[currentIndex], croppedAreaPixels }
        return newCropData
      })
    },
    [currentIndex]
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

  const createCroppedImage = async (imageFile: File, pixelCrop: Area, rotation: number): Promise<string> => {
    // Load image from file
    const imageBitmap = await createImageBitmap(imageFile)

    // First, create a rotated version of the image if needed
    let sourceImage: ImageBitmap | HTMLCanvasElement = imageBitmap

    if (rotation !== 0) {
      const rotatedCanvas = document.createElement('canvas')
      const rotatedCtx = rotatedCanvas.getContext('2d')

      if (!rotatedCtx) {
        throw new Error('No 2d context for rotation')
      }

      // For 90 or 270 degree rotation, swap width and height
      if (rotation === 90 || rotation === 270) {
        rotatedCanvas.width = imageBitmap.height
        rotatedCanvas.height = imageBitmap.width
      } else {
        rotatedCanvas.width = imageBitmap.width
        rotatedCanvas.height = imageBitmap.height
      }

      // Move to center, rotate, then draw
      rotatedCtx.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2)
      rotatedCtx.rotate((rotation * Math.PI) / 180)
      rotatedCtx.drawImage(imageBitmap, -imageBitmap.width / 2, -imageBitmap.height / 2)

      sourceImage = rotatedCanvas
    }

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      throw new Error('No 2d context')
    }

    // Set canvas size to cropped area size
    canvas.width = pixelCrop.width
    canvas.height = pixelCrop.height

    // Draw the cropped portion from the (possibly rotated) source
    ctx.drawImage(
      sourceImage,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    )

    // Convert canvas to blob and create URL
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (!blob) {
          reject(new Error('Canvas is empty'))
          return
        }
        const blobUrl = URL.createObjectURL(blob)
        console.log('Created cropped image blob URL:', blobUrl)
        resolve(blobUrl)
      }, 'image/jpeg', 0.95)
    })
  }

  const handleComplete = async () => {
    setIsProcessing(true)
    console.log('🎬 Starting crop completion process...')

    try {
      const cropAreas = cropData.map((data, index) => {
        if (data.croppedAreaPixels && data.croppedAreaPixels.width > 0 && data.croppedAreaPixels.height > 0) {
          console.log(`Image ${index + 1} crop area:`, data.croppedAreaPixels)
          return {
            x: data.croppedAreaPixels.x,
            y: data.croppedAreaPixels.y,
            width: data.croppedAreaPixels.width,
            height: data.croppedAreaPixels.height,
          }
        }
        // Return null if no valid crop area (will use full image)
        console.log(`Image ${index + 1} has no crop area, will use full image`)
        return null as any
      })

      // Create cropped image URLs
      console.log('🖼️ Creating cropped images...')
      const croppedImageUrls = await Promise.all(
        cropData.map(async (data, index) => {
          if (data.croppedAreaPixels && data.croppedAreaPixels.width > 0 && data.croppedAreaPixels.height > 0) {
            console.log(`Creating cropped image for photo ${index + 1} with rotation ${data.rotation}...`)
            try {
              const croppedUrl = await createCroppedImage(images[index], data.croppedAreaPixels, data.rotation)
              console.log(`✓ Photo ${index + 1} cropped successfully:`, croppedUrl)
              return croppedUrl
            } catch (error) {
              console.error(`✗ Failed to crop photo ${index + 1}:`, error)
              return imageUrls[index] // Fallback to original
            }
          }
          // If no crop, return original image URL
          console.log(`Photo ${index + 1}: no crop, using original`)
          return imageUrls[index]
        })
      )

      console.log('✅ Crop completion successful!')
      console.log('Crop areas:', cropAreas)
      console.log('Cropped image URLs:', croppedImageUrls)
      onComplete({ cropAreas, croppedImageUrls })
    } catch (error) {
      console.error('❌ Error during crop completion:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const aspectRatio = propAspectRatio || (900 / 685) // Default to Life Four-Cut photo dimensions

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-pink-900/95 via-purple-900/95 to-blue-900/95 backdrop-blur-md z-50 flex items-center justify-center">
      <div className="w-full h-full max-w-4xl mx-auto p-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-white">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <span className="text-3xl">✨</span>
              사진 꾸미기
            </h2>
            <p className="text-sm text-pink-200 font-medium mt-1">
              {currentIndex + 1} / {images.length} 장
            </p>
          </div>
          <button
            onClick={onCancel}
            className="px-6 py-3 bg-white/20 backdrop-blur-sm text-white rounded-full hover:bg-white/30 transition-all font-bold"
          >
            닫기
          </button>
        </div>

        {/* Progress indicator */}
        <div className="flex gap-2 mb-4">
          {images.map((_, index) => (
            <div
              key={index}
              className={`flex-1 h-3 rounded-full transition-all duration-300 ${
                index === currentIndex
                  ? 'bg-gradient-to-r from-pink-500 to-purple-500 shadow-lg scale-105'
                  : index < currentIndex
                  ? 'bg-gradient-to-r from-green-400 to-emerald-400'
                  : 'bg-white/20'
              }`}
            />
          ))}
        </div>

        {/* Cropper */}
        <div className="flex-1 relative bg-black/50 backdrop-blur-sm rounded-3xl overflow-hidden shadow-2xl border-2 border-white/20">
          {imageUrls[currentIndex] && (
            <Cropper
              image={imageUrls[currentIndex]}
              crop={currentCrop.crop}
              zoom={currentCrop.zoom}
              rotation={currentCrop.rotation}
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

        {/* Rotation and Zoom controls */}
        <div className="mt-4 px-4 space-y-3">
          {/* Rotation buttons */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => onRotate('ccw')}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm text-white rounded-full hover:bg-white/30 transition-all font-bold"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              90° 왼쪽
            </button>
            <div className="text-white/70 text-sm font-medium">
              {currentCrop.rotation}°
            </div>
            <button
              onClick={() => onRotate('cw')}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm text-white rounded-full hover:bg-white/30 transition-all font-bold"
            >
              90° 오른쪽
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
              </svg>
            </button>
          </div>

          {/* Zoom slider */}
          <div>
            <label className="text-white text-sm mb-2 block font-bold flex items-center gap-2">
              <span>🔍</span> 확대/축소
            </label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={currentCrop.zoom}
              onChange={(e) => onZoomChange(parseFloat(e.target.value))}
              className="w-full h-3 bg-white/20 rounded-full appearance-none cursor-pointer accent-pink-500"
            />
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-3 mt-4">
          <button
            onClick={currentIndex === 0 ? onCancel : handlePrev}
            className="px-6 py-3 bg-white/20 backdrop-blur-sm text-white rounded-full hover:bg-white/30 transition-all font-bold"
          >
            {currentIndex === 0 ? '취소' : '← 이전'}
          </button>
          {currentIndex < images.length - 1 ? (
            <button
              onClick={handleNext}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-full hover:shadow-2xl hover:scale-105 transition-all font-bold"
            >
              다음 사진 →
            </button>
          ) : (
            <button
              onClick={handleComplete}
              disabled={isProcessing}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-green-400 to-emerald-400 text-white rounded-full hover:shadow-2xl hover:scale-105 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? '처리 중... ⏳' : '완료! ✨'}
            </button>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-4 text-center text-white/80 text-sm font-medium">
          <p className="flex items-center justify-center gap-2">
            <span>💡</span>
            드래그로 위치 조정 · 버튼으로 회전 · 슬라이더로 확대/축소
          </p>
        </div>
      </div>
    </div>
  )
}
