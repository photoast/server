'use client'

import PhotoSlot from './PhotoSlot'
import { CANVAS_WIDTH, CANVAS_HEIGHT, DEFAULT_PHOTO_RATIO, LAYOUT_CONFIG, FOUR_CUT_CONFIG } from '@/lib/layoutConstants'

interface PhotoSlotData {
  index: number
  file: File | null
  cropArea: any
  croppedImageUrl: string | null
}

interface LayoutPreviewProps {
  photoSlots: PhotoSlotData[]
  onSlotClick: (index: number) => void
  backgroundColor?: string
}

// 4x6 세로 1장
export function SinglePhotoPreview({ photoSlots, onSlotClick }: LayoutPreviewProps) {
  return (
    <div className="relative w-full max-w-sm mx-auto" style={{ aspectRatio: '2/3' }}>
      <div className="absolute inset-0 bg-white overflow-hidden shadow-2xl">
        <PhotoSlot
          file={photoSlots[0]?.file}
          croppedImageUrl={photoSlots[0]?.croppedImageUrl}
          slotNumber={1}
          onClick={() => onSlotClick(0)}
          className="w-full h-full"
          size="large"
        />
      </div>
    </div>
  )
}

// 6x4 가로 1장
export function LandscapeSinglePreview({ photoSlots, onSlotClick }: LayoutPreviewProps) {
  return (
    <div className="relative w-full max-w-md mx-auto" style={{ aspectRatio: '3/2' }}>
      <div className="absolute inset-0 bg-white overflow-hidden shadow-2xl">
        <PhotoSlot
          file={photoSlots[0]?.file}
          croppedImageUrl={photoSlots[0]?.croppedImageUrl}
          slotNumber={1}
          onClick={() => onSlotClick(0)}
          className="w-full h-full"
          size="large"
        />
      </div>
    </div>
  )
}

// 6x4 가로 2장 (2x1 그리드)
export function LandscapeTwoPreview({ photoSlots, onSlotClick, backgroundColor = '#FFFFFF' }: LayoutPreviewProps) {
  const { MARGIN_HORIZONTAL: MARGIN_H, MARGIN_VERTICAL: MARGIN_V, GAP } = LAYOUT_CONFIG

  // 6x4 landscape canvas dimensions
  const canvasWidth = CANVAS_HEIGHT  // 1800
  const canvasHeight = CANVAS_WIDTH  // 1200

  const availableWidth = canvasWidth - (MARGIN_H * 2)
  const availableHeight = canvasHeight - (MARGIN_V * 2)

  const photoWidth = Math.round((availableWidth - GAP) / 2)
  const photoHeight = availableHeight

  const positions = [0, 1].map((i) => ({
    left: (MARGIN_H + (i * (photoWidth + GAP))) / canvasWidth * 100,
    top: MARGIN_V / canvasHeight * 100,
    width: photoWidth / canvasWidth * 100,
    height: photoHeight / canvasHeight * 100
  }))

  return (
    <div className="relative w-full max-w-md mx-auto" style={{ aspectRatio: '3/2' }}>
      <div className="absolute inset-0 overflow-hidden shadow-2xl" style={{ backgroundColor }}>
        <div className="relative w-full h-full">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="absolute"
              style={{
                left: `${positions[i].left}%`,
                top: `${positions[i].top}%`,
                width: `${positions[i].width}%`,
                height: `${positions[i].height}%`
              }}
            >
              <PhotoSlot
                file={photoSlots[i]?.file}
                croppedImageUrl={photoSlots[i]?.croppedImageUrl}
                slotNumber={i + 1}
                onClick={() => onSlotClick(i)}
                className="w-full h-full"
                size="medium"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// 4x6 네컷 (1x4 스트립 x 2)
export function FourCutPreview({ photoSlots, onSlotClick }: LayoutPreviewProps) {
  // Match exact dimensions from lib/image.ts processFourCutImage
  const { MARGIN_OUTER, GAP_CENTER, GAP_BETWEEN_PHOTOS } = FOUR_CUT_CONFIG

  // Calculate percentages from pixel values
  const marginVerticalPercent = (MARGIN_OUTER / CANVAS_HEIGHT * 100).toFixed(2)
  const marginHorizontalPercent = (MARGIN_OUTER / CANVAS_WIDTH * 100).toFixed(2)
  const gapCenterPercent = (GAP_CENTER / CANVAS_WIDTH * 100).toFixed(2)
  const gapBetweenPhotosPercent = (GAP_BETWEEN_PHOTOS / CANVAS_HEIGHT * 100).toFixed(2)

  return (
    <div className="relative w-full max-w-sm mx-auto" style={{ aspectRatio: '2/3' }}>
      <div
        className="absolute inset-0 bg-black overflow-hidden shadow-2xl"
        style={{
          padding: `${marginVerticalPercent}% ${marginHorizontalPercent}%`,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: `0 ${gapCenterPercent}%`
        }}
      >
        {/* Left strip */}
        <div
          className="grid h-full"
          style={{
            gridTemplateRows: '1fr 1fr 1fr 1fr',
            gap: `${gapBetweenPhotosPercent}% 0`
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="w-full h-full overflow-hidden">
              <PhotoSlot
                file={photoSlots[i]?.file}
                croppedImageUrl={photoSlots[i]?.croppedImageUrl}
                slotNumber={i + 1}
                onClick={() => onSlotClick(i)}
                className="w-full h-full"
                size="small"
              />
            </div>
          ))}
        </div>

        {/* Right strip (duplicate preview) */}
        <div
          className="grid h-full opacity-50"
          style={{
            gridTemplateRows: '1fr 1fr 1fr 1fr',
            gap: `${gapBetweenPhotosPercent}% 0`
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="w-full h-full overflow-hidden">
              <div className="relative bg-gradient-to-br from-purple-100 to-pink-100 overflow-hidden w-full h-full">
                {photoSlots[i]?.file && (
                  <img
                    src={photoSlots[i].croppedImageUrl || URL.createObjectURL(photoSlots[i].file)}
                    alt={`Photo ${i + 1} duplicate`}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
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

// 4x6 2x2 그리드
export function TwoByTwoPreview({ photoSlots, onSlotClick, backgroundColor = '#FFFFFF' }: LayoutPreviewProps) {
  // Exact pixel coordinates from lib/image.ts processTwoByTwoImage
  const { MARGIN_HORIZONTAL: MARGIN_H, MARGIN_VERTICAL: MARGIN_V, GAP } = LAYOUT_CONFIG

  const availableWidth = CANVAS_WIDTH - (MARGIN_H * 2)
  const availableHeight = CANVAS_HEIGHT - (MARGIN_V * 2)

  const photoWidth = Math.round((availableWidth - GAP) / 2)
  const photoHeight = Math.round((availableHeight - GAP) / 2)

  // Calculate positions for 2x2 grid
  const positions = [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 1, col: 0 },
    { row: 1, col: 1 }
  ].map(({ row, col }) => ({
    left: (MARGIN_H + (col * (photoWidth + GAP))) / CANVAS_WIDTH * 100,
    top: (MARGIN_V + (row * (photoHeight + GAP))) / CANVAS_HEIGHT * 100,
    width: photoWidth / CANVAS_WIDTH * 100,
    height: photoHeight / CANVAS_HEIGHT * 100
  }))

  return (
    <div className="relative w-full max-w-sm mx-auto" style={{ aspectRatio: '2/3' }}>
      <div className="absolute inset-0 overflow-hidden shadow-2xl" style={{ backgroundColor }}>
        <div className="relative w-full h-full">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="absolute"
              style={{
                left: `${positions[i].left}%`,
                top: `${positions[i].top}%`,
                width: `${positions[i].width}%`,
                height: `${positions[i].height}%`
              }}
            >
              <PhotoSlot
                file={photoSlots[i]?.file}
                croppedImageUrl={photoSlots[i]?.croppedImageUrl}
                slotNumber={i + 1}
                onClick={() => onSlotClick(i)}
                className="w-full h-full"
                size="medium"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// 4x6 세로 2장 (1x2)
export function VerticalTwoPreview({ photoSlots, onSlotClick, backgroundColor = '#FFFFFF' }: LayoutPreviewProps) {
  // Exact pixel coordinates from lib/image.ts processVerticalTwoImage
  const { MARGIN_HORIZONTAL: MARGIN_H, MARGIN_VERTICAL: MARGIN_V, GAP } = LAYOUT_CONFIG

  const availableWidth = CANVAS_WIDTH - (MARGIN_H * 2)
  const availableHeight = CANVAS_HEIGHT - (MARGIN_V * 2)

  const photoWidth = availableWidth
  const photoHeight = Math.round((availableHeight - GAP) / 2)

  const positions = [0, 1].map((i) => ({
    left: MARGIN_H / CANVAS_WIDTH * 100,
    top: (MARGIN_V + (i * (photoHeight + GAP))) / CANVAS_HEIGHT * 100,
    width: photoWidth / CANVAS_WIDTH * 100,
    height: photoHeight / CANVAS_HEIGHT * 100
  }))

  return (
    <div className="relative w-full max-w-sm mx-auto" style={{ aspectRatio: '2/3' }}>
      <div className="absolute inset-0 overflow-hidden shadow-2xl" style={{ backgroundColor }}>
        <div className="relative w-full h-full">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="absolute"
              style={{
                left: `${positions[i].left}%`,
                top: `${positions[i].top}%`,
                width: `${positions[i].width}%`,
                height: `${positions[i].height}%`
              }}
            >
              <PhotoSlot
                file={photoSlots[i]?.file}
                croppedImageUrl={photoSlots[i]?.croppedImageUrl}
                slotNumber={i + 1}
                onClick={() => onSlotClick(i)}
                className="w-full h-full"
                size="medium"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// 4x6 1+2 레이아웃
export function OnePlusTwoPreview({ photoSlots, onSlotClick, backgroundColor = '#FFFFFF' }: LayoutPreviewProps) {
  // Exact pixel coordinates from lib/image.ts processOnePlusTwoImage
  const { MARGIN_HORIZONTAL: MARGIN_H, MARGIN_VERTICAL: MARGIN_V, GAP } = LAYOUT_CONFIG

  const availableWidth = CANVAS_WIDTH - (MARGIN_H * 2)
  const availableHeight = CANVAS_HEIGHT - (MARGIN_V * 2)

  const topPhotoWidth = availableWidth
  const topPhotoHeight = Math.round((availableHeight - GAP) / 2)
  const bottomPhotoWidth = Math.round((availableWidth - GAP) / 2)
  const bottomPhotoHeight = topPhotoHeight

  const topPosition = {
    left: MARGIN_H / CANVAS_WIDTH * 100,
    top: MARGIN_V / CANVAS_HEIGHT * 100,
    width: topPhotoWidth / CANVAS_WIDTH * 100,
    height: topPhotoHeight / CANVAS_HEIGHT * 100
  }

  const bottomPositions = [0, 1].map((i) => ({
    left: (MARGIN_H + (i * (bottomPhotoWidth + GAP))) / CANVAS_WIDTH * 100,
    top: (MARGIN_V + topPhotoHeight + GAP) / CANVAS_HEIGHT * 100,
    width: bottomPhotoWidth / CANVAS_WIDTH * 100,
    height: bottomPhotoHeight / CANVAS_HEIGHT * 100
  }))

  return (
    <div className="relative w-full max-w-sm mx-auto" style={{ aspectRatio: '2/3' }}>
      <div className="absolute inset-0 overflow-hidden shadow-2xl" style={{ backgroundColor }}>
        <div className="relative w-full h-full">
          {/* Top photo */}
          <div
            className="absolute"
            style={{
              left: `${topPosition.left}%`,
              top: `${topPosition.top}%`,
              width: `${topPosition.width}%`,
              height: `${topPosition.height}%`
            }}
          >
            <PhotoSlot
              file={photoSlots[0]?.file}
              croppedImageUrl={photoSlots[0]?.croppedImageUrl}
              slotNumber={1}
              onClick={() => onSlotClick(0)}
              className="w-full h-full"
              size="large"
            />
          </div>

          {/* Bottom 2 photos */}
          {[1, 2].map((i) => (
            <div
              key={i}
              className="absolute"
              style={{
                left: `${bottomPositions[i - 1].left}%`,
                top: `${bottomPositions[i - 1].top}%`,
                width: `${bottomPositions[i - 1].width}%`,
                height: `${bottomPositions[i - 1].height}%`
              }}
            >
              <PhotoSlot
                file={photoSlots[i]?.file}
                croppedImageUrl={photoSlots[i]?.croppedImageUrl}
                slotNumber={i + 1}
                onClick={() => onSlotClick(i)}
                className="w-full h-full"
                size="medium"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
