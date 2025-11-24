'use client'

import PhotoSlot from './PhotoSlot'
import Image from 'next/image'
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
  logoUrl?: string
}

export function SinglePhotoPreview({ photoSlots, onSlotClick, logoUrl }: LayoutPreviewProps) {
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
        {/* Logo overlay - positioned at bottom center like in actual output */}
        {logoUrl && (
          <div className="absolute bottom-0 left-0 right-0 h-[15%] flex items-center justify-center bg-white pointer-events-none">
            <div className="relative h-full w-full flex items-center justify-center p-2">
              <Image
                src={logoUrl}
                alt="Event Logo"
                fill
                className="object-contain"
                unoptimized
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function FourCutPreview({ photoSlots, onSlotClick, logoUrl }: LayoutPreviewProps) {
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
        className="absolute inset-0 bg-black overflow-hidden shadow-2xl relative"
        style={{
          padding: `${marginVerticalPercent}% ${marginHorizontalPercent}%`,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: `0 ${gapCenterPercent}%`
        }}
      >
        {/* Left strip */}
        <div
          className="grid"
          style={{
            gridTemplateRows: '1fr 1fr 1fr 1fr',
            gap: `${gapBetweenPhotosPercent}% 0`
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ aspectRatio: '475/358' }}>
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
          className="grid opacity-50"
          style={{
            gridTemplateRows: '1fr 1fr 1fr 1fr',
            gap: `${gapBetweenPhotosPercent}% 0`
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ aspectRatio: '475/358' }}>
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

        {/* Logo overlay on both strips */}
        {logoUrl && (
          <>
            <div className="absolute bottom-2 left-0 right-[53%] h-[8%] flex items-center justify-center pointer-events-none">
              <div className="relative h-full w-[80%]">
                <Image
                  src={logoUrl}
                  alt="Logo"
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
            </div>
            <div className="absolute bottom-2 left-[53%] right-0 h-[8%] flex items-center justify-center pointer-events-none opacity-50">
              <div className="relative h-full w-[80%]">
                <Image
                  src={logoUrl}
                  alt="Logo"
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
            </div>
          </>
        )}
      </div>
      <div className="text-center mt-3 text-sm text-gray-500">
        ✂️ 중앙을 잘라서 2개의 스트립으로
      </div>
    </div>
  )
}

export function TwoByTwoPreview({ photoSlots, onSlotClick, backgroundColor = '#000000', logoUrl }: LayoutPreviewProps) {
  // Exact pixel coordinates from lib/image.ts processTwoByTwoImage
  const { MARGIN_HORIZONTAL: MARGIN_H, MARGIN_VERTICAL: MARGIN_V, GAP } = LAYOUT_CONFIG

  const photoAreaHeight = logoUrl ? Math.round(CANVAS_HEIGHT * (DEFAULT_PHOTO_RATIO / 100)) : CANVAS_HEIGHT
  const logoAreaHeight = CANVAS_HEIGHT - photoAreaHeight

  const availableWidth = CANVAS_WIDTH - (MARGIN_H * 2)  // 920px
  const availableHeight = photoAreaHeight - (MARGIN_V * 2)

  const photoWidth = Math.round((availableWidth - GAP) / 2)  // 450px
  const photoHeight = Math.round((availableHeight - GAP) / 2)

  // Calculate positions for 2x2 grid
  const positions = [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 1, col: 0 },
    { row: 1, col: 1 }
  ].map(({ row, col }) => ({
    left: (MARGIN_H + (col * (photoWidth + GAP))) / CANVAS_WIDTH * 100,
    top: (MARGIN_V + (row * (photoHeight + GAP))) / photoAreaHeight * 100,
    width: photoWidth / CANVAS_WIDTH * 100,
    height: photoHeight / photoAreaHeight * 100
  }))

  return (
    <div className="relative w-full max-w-sm mx-auto" style={{ aspectRatio: '2/3' }}>
      <div className="absolute inset-0 overflow-hidden shadow-2xl" style={{ backgroundColor }}>
        {/* Photo area */}
        <div
          className="relative"
          style={{
            height: `${(photoAreaHeight / CANVAS_HEIGHT) * 100}%`
          }}
        >
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

        {/* Logo area */}
        {logoUrl && (
          <div
            className="flex items-center justify-center pointer-events-none"
            style={{
              height: `${(logoAreaHeight / CANVAS_HEIGHT) * 100}%`,
              backgroundColor
            }}
          >
            <div className="relative w-[80%] max-h-full">
              <Image
                src={logoUrl}
                alt="Logo"
                width={800}
                height={200}
                className="object-contain w-full h-auto"
                unoptimized
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function VerticalTwoPreview({ photoSlots, onSlotClick, backgroundColor = '#000000', logoUrl }: LayoutPreviewProps) {
  // Exact pixel coordinates from lib/image.ts processVerticalTwoImage
  const { MARGIN_HORIZONTAL: MARGIN_H, MARGIN_VERTICAL: MARGIN_V, GAP } = LAYOUT_CONFIG

  const photoAreaHeight = logoUrl ? Math.round(CANVAS_HEIGHT * (DEFAULT_PHOTO_RATIO / 100)) : CANVAS_HEIGHT
  const logoAreaHeight = CANVAS_HEIGHT - photoAreaHeight

  const availableWidth = CANVAS_WIDTH - (MARGIN_H * 2)  // 920px
  const availableHeight = photoAreaHeight - (MARGIN_V * 2)

  const photoWidth = availableWidth
  const photoHeight = Math.round((availableHeight - GAP) / 2)

  const positions = [0, 1].map((i) => ({
    left: MARGIN_H / CANVAS_WIDTH * 100,
    top: (MARGIN_V + (i * (photoHeight + GAP))) / photoAreaHeight * 100,
    width: photoWidth / CANVAS_WIDTH * 100,
    height: photoHeight / photoAreaHeight * 100
  }))

  return (
    <div className="relative w-full max-w-sm mx-auto" style={{ aspectRatio: '2/3' }}>
      <div className="absolute inset-0 overflow-hidden shadow-2xl" style={{ backgroundColor }}>
        {/* Photo area */}
        <div
          className="relative"
          style={{
            height: `${(photoAreaHeight / CANVAS_HEIGHT) * 100}%`
          }}
        >
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

        {/* Logo area */}
        {logoUrl && (
          <div
            className="flex items-center justify-center pointer-events-none"
            style={{
              height: `${(logoAreaHeight / CANVAS_HEIGHT) * 100}%`,
              backgroundColor
            }}
          >
            <div className="relative w-[80%] max-h-full">
              <Image
                src={logoUrl}
                alt="Logo"
                width={800}
                height={200}
                className="object-contain w-full h-auto"
                unoptimized
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function HorizontalTwoPreview({ photoSlots, onSlotClick, backgroundColor = '#000000', logoUrl }: LayoutPreviewProps) {
  // Exact pixel coordinates from lib/image.ts processHorizontalTwoImage
  const { MARGIN_HORIZONTAL: MARGIN_H, MARGIN_VERTICAL: MARGIN_V, GAP } = LAYOUT_CONFIG

  const photoAreaHeight = logoUrl ? Math.round(CANVAS_HEIGHT * (DEFAULT_PHOTO_RATIO / 100)) : CANVAS_HEIGHT
  const logoAreaHeight = CANVAS_HEIGHT - photoAreaHeight

  const availableWidth = CANVAS_WIDTH - (MARGIN_H * 2)
  const availableHeight = photoAreaHeight - (MARGIN_V * 2)

  const photoWidth = Math.round((availableWidth - GAP) / 2)  // 450px
  const photoHeight = availableHeight

  const positions = [0, 1].map((i) => ({
    left: (MARGIN_H + (i * (photoWidth + GAP))) / CANVAS_WIDTH * 100,
    top: MARGIN_V / photoAreaHeight * 100,
    width: photoWidth / CANVAS_WIDTH * 100,
    height: photoHeight / photoAreaHeight * 100
  }))

  return (
    <div className="relative w-full max-w-sm mx-auto" style={{ aspectRatio: '2/3' }}>
      <div className="absolute inset-0 overflow-hidden shadow-2xl" style={{ backgroundColor }}>
        {/* Photo area */}
        <div
          className="relative"
          style={{
            height: `${(photoAreaHeight / CANVAS_HEIGHT) * 100}%`
          }}
        >
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

        {/* Logo area */}
        {logoUrl && (
          <div
            className="flex items-center justify-center pointer-events-none"
            style={{
              height: `${(logoAreaHeight / CANVAS_HEIGHT) * 100}%`,
              backgroundColor
            }}
          >
            <div className="relative w-[80%] max-h-full">
              <Image
                src={logoUrl}
                alt="Logo"
                width={800}
                height={200}
                className="object-contain w-full h-auto"
                unoptimized
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function OnePlusTwoPreview({ photoSlots, onSlotClick, backgroundColor = '#000000', logoUrl }: LayoutPreviewProps) {
  // Exact pixel coordinates from lib/image.ts processOnePlusTwoImage
  const { MARGIN_HORIZONTAL: MARGIN_H, MARGIN_VERTICAL: MARGIN_V, GAP } = LAYOUT_CONFIG

  const photoAreaHeight = logoUrl ? Math.round(CANVAS_HEIGHT * (DEFAULT_PHOTO_RATIO / 100)) : CANVAS_HEIGHT
  const logoAreaHeight = CANVAS_HEIGHT - photoAreaHeight

  const availableWidth = CANVAS_WIDTH - (MARGIN_H * 2)  // 920px
  const availableHeight = photoAreaHeight - (MARGIN_V * 2)

  const topPhotoWidth = availableWidth  // 920px
  const topPhotoHeight = Math.round((availableHeight - GAP) / 2)
  const bottomPhotoWidth = Math.round((availableWidth - GAP) / 2)  // 450px
  const bottomPhotoHeight = topPhotoHeight

  const topPosition = {
    left: MARGIN_H / CANVAS_WIDTH * 100,
    top: MARGIN_V / photoAreaHeight * 100,
    width: topPhotoWidth / CANVAS_WIDTH * 100,
    height: topPhotoHeight / photoAreaHeight * 100
  }

  const bottomPositions = [0, 1].map((i) => ({
    left: (MARGIN_H + (i * (bottomPhotoWidth + GAP))) / CANVAS_WIDTH * 100,
    top: (MARGIN_V + topPhotoHeight + GAP) / photoAreaHeight * 100,
    width: bottomPhotoWidth / CANVAS_WIDTH * 100,
    height: bottomPhotoHeight / photoAreaHeight * 100
  }))

  return (
    <div className="relative w-full max-w-sm mx-auto" style={{ aspectRatio: '2/3' }}>
      <div className="absolute inset-0 overflow-hidden shadow-2xl" style={{ backgroundColor }}>
        {/* Photo area */}
        <div
          className="relative"
          style={{
            height: `${(photoAreaHeight / CANVAS_HEIGHT) * 100}%`
          }}
        >
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

        {/* Logo area */}
        {logoUrl && (
          <div
            className="flex items-center justify-center pointer-events-none"
            style={{
              height: `${(logoAreaHeight / CANVAS_HEIGHT) * 100}%`,
              backgroundColor
            }}
          >
            <div className="relative w-[80%] max-h-full">
              <Image
                src={logoUrl}
                alt="Logo"
                width={800}
                height={200}
                className="object-contain w-full h-auto"
                unoptimized
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
