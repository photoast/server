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

interface LogoSettings {
  position?: string
  size?: number
  x?: number
  y?: number
}

interface LayoutPreviewProps {
  photoSlots: PhotoSlotData[]
  onSlotClick: (index: number) => void
  backgroundColor?: string
  logoUrl?: string
  logoSettings?: LogoSettings
  photoAreaRatio?: number
}

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

export function SingleWithLogoPreview({ photoSlots, onSlotClick, logoUrl, logoSettings, photoAreaRatio = 85 }: LayoutPreviewProps) {
  const logoSize = logoSettings?.size || 80 // Default 80%
  const logoPosition = logoSettings?.position || 'bottom-center'
  const logoX = logoSettings?.x || 50 // Default center
  const logoY = logoSettings?.y || 50 // Default center

  // Calculate logo area height
  const logoAreaHeight = 100 - photoAreaRatio

  return (
    <div className="relative w-full max-w-sm mx-auto" style={{ aspectRatio: '2/3' }}>
      <div className="absolute inset-0 bg-white shadow-2xl overflow-hidden">
        {/* Logo area background - lowest layer */}
        <div
          className="absolute bottom-0 left-0 right-0 bg-white"
          style={{ height: `${logoAreaHeight}%`, zIndex: 1 }}
        >
          {!logoUrl && (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">로고 영역</div>
          )}
        </div>
        {/* Logo - middle layer, visible in logo area but clipped by photo area */}
        {logoUrl && (
          logoPosition === 'custom' ? (
            // Custom position - absolute positioning relative to the entire container
            <div
              className="absolute pointer-events-none"
              style={{
                width: `${logoSize}%`,
                left: `${logoX}%`,
                top: `${photoAreaRatio + (logoY * logoAreaHeight / 100)}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: 5,
              }}
            >
              <Image
                src={logoUrl}
                alt="Event Logo"
                width={1000}
                height={300}
                className="object-contain w-full h-auto"
                unoptimized
              />
            </div>
          ) : (
            // Preset positions - positioned in logo area using flexbox
            (() => {
              const [vertical, horizontal] = logoPosition.split('-')
              let alignItems = 'center'
              let justifyContent = 'center'

              if (vertical === 'top') alignItems = 'flex-start'
              else if (vertical === 'bottom') alignItems = 'flex-end'

              if (horizontal === 'left') justifyContent = 'flex-start'
              else if (horizontal === 'right') justifyContent = 'flex-end'

              return (
                <div
                  className="absolute bottom-0 left-0 right-0 flex pointer-events-none p-2"
                  style={{
                    height: `${logoAreaHeight}%`,
                    alignItems,
                    justifyContent,
                    zIndex: 5,
                  }}
                >
                  <div style={{ width: `${logoSize}%` }}>
                    <Image
                      src={logoUrl}
                      alt="Event Logo"
                      width={1000}
                      height={300}
                      className="object-contain w-full h-auto"
                      unoptimized
                    />
                  </div>
                </div>
              )
            })()
          )
        )}
        {/* Photo area - highest layer, clips logo if overlapping */}
        <div
          className="absolute inset-0"
          style={{ height: `${photoAreaRatio}%`, zIndex: 10 }}
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

export function TwoByTwoPreview({ photoSlots, onSlotClick, backgroundColor = '#000000', logoUrl }: LayoutPreviewProps) {
  // Exact pixel coordinates from lib/image.ts processTwoByTwoImage
  const { MARGIN_HORIZONTAL: MARGIN_H, MARGIN_VERTICAL: MARGIN_V, GAP } = LAYOUT_CONFIG

  // No logo support for this layout - use full canvas
  const photoAreaHeight = CANVAS_HEIGHT
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

      </div>
    </div>
  )
}

export function VerticalTwoPreview({ photoSlots, onSlotClick, backgroundColor = '#000000', logoUrl }: LayoutPreviewProps) {
  // Exact pixel coordinates from lib/image.ts processVerticalTwoImage
  const { MARGIN_HORIZONTAL: MARGIN_H, MARGIN_VERTICAL: MARGIN_V, GAP } = LAYOUT_CONFIG

  // No logo support for this layout - use full canvas
  const photoAreaHeight = CANVAS_HEIGHT
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

      </div>
    </div>
  )
}


export function OnePlusTwoPreview({ photoSlots, onSlotClick, backgroundColor = '#000000', logoUrl }: LayoutPreviewProps) {
  // Exact pixel coordinates from lib/image.ts processOnePlusTwoImage
  const { MARGIN_HORIZONTAL: MARGIN_H, MARGIN_VERTICAL: MARGIN_V, GAP } = LAYOUT_CONFIG

  // No logo support for this layout - use full canvas
  const photoAreaHeight = CANVAS_HEIGHT
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

      </div>
    </div>
  )
}
