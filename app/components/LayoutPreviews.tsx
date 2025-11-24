'use client'

import PhotoSlot from './PhotoSlot'
import Image from 'next/image'

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
  return (
    <div className="relative w-full max-w-sm mx-auto" style={{ aspectRatio: '2/3' }}>
      <div className="absolute inset-0 bg-black overflow-hidden shadow-2xl" style={{ padding: '4% 3.5%' }}>
        <div className="flex h-full relative" style={{ gap: '7%' }}>
          {/* Left strip */}
          <div className="flex-1 flex flex-col" style={{ gap: '1.33%' }}>
            {[0, 1, 2, 3].map((i) => (
              <PhotoSlot
                key={i}
                file={photoSlots[i]?.file}
                croppedImageUrl={photoSlots[i]?.croppedImageUrl}
                slotNumber={i + 1}
                onClick={() => onSlotClick(i)}
                className="flex-1"
                size="small"
              />
            ))}
          </div>

          {/* Right strip (duplicate preview) */}
          <div className="flex-1 flex flex-col opacity-50" style={{ gap: '1.33%' }}>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex-1 relative bg-gradient-to-br from-purple-100 to-pink-100 overflow-hidden"
              >
                {photoSlots[i]?.file && (
                  <img
                    src={photoSlots[i].croppedImageUrl || URL.createObjectURL(photoSlots[i].file)}
                    alt={`Photo ${i + 1} duplicate`}
                    className="w-full h-full object-cover"
                  />
                )}
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
      </div>
      <div className="text-center mt-3 text-sm text-gray-500">
        ✂️ 중앙을 잘라서 2개의 스트립으로
      </div>
    </div>
  )
}

export function TwoByTwoPreview({ photoSlots, onSlotClick, backgroundColor = '#000000', logoUrl }: LayoutPreviewProps) {
  // Match exact margins from lib/image.ts processTwoByTwoImage
  // MARGIN_HORIZONTAL = 40px / 1000px = 4%
  // MARGIN_VERTICAL = 60px / 1500px = 4%
  // GAP = 20px (both horizontal and vertical)
  // Horizontal gap: 20px / 1000px = 2%
  // Vertical gap: 20px / 1500px = 1.33%
  return (
    <div className="relative w-full max-w-sm mx-auto" style={{ aspectRatio: '2/3' }}>
      <div
        className="absolute inset-0 grid grid-cols-2 overflow-hidden shadow-2xl relative"
        style={{
          backgroundColor,
          padding: '4% 4%',
          gap: '1.33% 2%'  // vertical gap 1.33%, horizontal gap 2%
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <PhotoSlot
            key={i}
            file={photoSlots[i]?.file}
            croppedImageUrl={photoSlots[i]?.croppedImageUrl}
            slotNumber={i + 1}
            onClick={() => onSlotClick(i)}
            size="medium"
          />
        ))}
        {/* Logo overlay at bottom center */}
        {logoUrl && (
          <div className="absolute bottom-[4%] left-1/2 -translate-x-1/2 h-[6%] w-[40%] pointer-events-none">
            <Image
              src={logoUrl}
              alt="Logo"
              fill
              className="object-contain drop-shadow-lg"
              unoptimized
            />
          </div>
        )}
      </div>
    </div>
  )
}

export function VerticalTwoPreview({ photoSlots, onSlotClick, backgroundColor = '#000000', logoUrl }: LayoutPreviewProps) {
  // Match exact margins from lib/image.ts processVerticalTwoImage
  // MARGIN_HORIZONTAL = 40px / 1000px = 4%
  // MARGIN_VERTICAL = 60px / 1500px = 4%
  // GAP = 20px / 1500px = 1.33%
  return (
    <div className="relative w-full max-w-sm mx-auto" style={{ aspectRatio: '2/3' }}>
      <div
        className="absolute inset-0 flex flex-col overflow-hidden shadow-2xl relative"
        style={{
          backgroundColor,
          padding: '4% 4%',  // vertical 4%, horizontal 4%
          gap: '1.33%'
        }}
      >
        {[0, 1].map((i) => (
          <PhotoSlot
            key={i}
            file={photoSlots[i]?.file}
            croppedImageUrl={photoSlots[i]?.croppedImageUrl}
            slotNumber={i + 1}
            onClick={() => onSlotClick(i)}
            className="flex-1"
            size="medium"
          />
        ))}
        {/* Logo overlay at bottom center */}
        {logoUrl && (
          <div className="absolute bottom-[4%] left-1/2 -translate-x-1/2 h-[6%] w-[40%] pointer-events-none">
            <Image
              src={logoUrl}
              alt="Logo"
              fill
              className="object-contain drop-shadow-lg"
              unoptimized
            />
          </div>
        )}
      </div>
    </div>
  )
}

export function HorizontalTwoPreview({ photoSlots, onSlotClick, backgroundColor = '#000000', logoUrl }: LayoutPreviewProps) {
  // Match exact margins from lib/image.ts processHorizontalTwoImage
  // MARGIN_HORIZONTAL = 40px / 1000px = 4%
  // MARGIN_VERTICAL = 60px / 1500px = 4%
  // GAP = 20px / 1000px = 2% (horizontal gap)
  return (
    <div className="relative w-full max-w-sm mx-auto" style={{ aspectRatio: '2/3' }}>
      <div
        className="absolute inset-0 flex overflow-hidden shadow-2xl relative"
        style={{
          backgroundColor,
          padding: '4% 4%',
          gap: '2%'  // 20px / 1000px
        }}
      >
        {[0, 1].map((i) => (
          <PhotoSlot
            key={i}
            file={photoSlots[i]?.file}
            croppedImageUrl={photoSlots[i]?.croppedImageUrl}
            slotNumber={i + 1}
            onClick={() => onSlotClick(i)}
            className="flex-1"
            size="medium"
          />
        ))}
        {/* Logo overlay at bottom center */}
        {logoUrl && (
          <div className="absolute bottom-[4%] left-1/2 -translate-x-1/2 h-[6%] w-[40%] pointer-events-none">
            <Image
              src={logoUrl}
              alt="Logo"
              fill
              className="object-contain drop-shadow-lg"
              unoptimized
            />
          </div>
        )}
      </div>
    </div>
  )
}

export function OnePlusTwoPreview({ photoSlots, onSlotClick, backgroundColor = '#000000', logoUrl }: LayoutPreviewProps) {
  // Match exact margins from lib/image.ts processOnePlusTwoImage
  // MARGIN_HORIZONTAL = 40px / 1000px = 4%
  // MARGIN_VERTICAL = 60px / 1500px = 4%
  // GAP = 20px
  // Vertical gap: 20px / 1500px = 1.33%
  // Horizontal gap: 20px / 1000px = 2%
  return (
    <div className="relative w-full max-w-sm mx-auto" style={{ aspectRatio: '2/3' }}>
      <div
        className="absolute inset-0 flex flex-col overflow-hidden shadow-2xl relative"
        style={{
          backgroundColor,
          padding: '4% 4%',
          gap: '1.33%'
        }}
      >
        {/* Top: 1 large photo */}
        <PhotoSlot
          file={photoSlots[0]?.file}
          croppedImageUrl={photoSlots[0]?.croppedImageUrl}
          slotNumber={1}
          onClick={() => onSlotClick(0)}
          className="flex-[3]"
          size="large"
        />

        {/* Bottom: 2 small photos */}
        <div className="flex-[2] flex" style={{ gap: '2%' }}>
          {[1, 2].map((i) => (
            <PhotoSlot
              key={i}
              file={photoSlots[i]?.file}
              croppedImageUrl={photoSlots[i]?.croppedImageUrl}
              slotNumber={i + 1}
              onClick={() => onSlotClick(i)}
              className="flex-1"
              size="medium"
            />
          ))}
        </div>

        {/* Logo overlay at bottom center */}
        {logoUrl && (
          <div className="absolute bottom-[4%] left-1/2 -translate-x-1/2 h-[6%] w-[40%] pointer-events-none">
            <Image
              src={logoUrl}
              alt="Logo"
              fill
              className="object-contain drop-shadow-lg"
              unoptimized
            />
          </div>
        )}
      </div>
    </div>
  )
}
