'use client'

import PhotoSlot from './PhotoSlot'

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

export function FourCutPreview({ photoSlots, onSlotClick }: LayoutPreviewProps) {
  return (
    <div className="relative w-full max-w-sm mx-auto" style={{ aspectRatio: '2/3' }}>
      <div className="absolute inset-0 bg-black overflow-hidden shadow-2xl" style={{ padding: '4% 3.5%' }}>
        <div className="flex h-full" style={{ gap: '7%' }}>
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
        </div>
      </div>
      <div className="text-center mt-3 text-sm text-gray-500">
        ✂️ 중앙을 잘라서 2개의 스트립으로
      </div>
    </div>
  )
}

export function TwoByTwoPreview({ photoSlots, onSlotClick, backgroundColor = '#000000' }: LayoutPreviewProps) {
  return (
    <div className="relative w-full max-w-sm mx-auto" style={{ aspectRatio: '2/3' }}>
      <div
        className="absolute inset-0 grid grid-cols-2 overflow-hidden shadow-2xl"
        style={{
          backgroundColor,
          padding: '4%',
          gap: '1.33%'
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
      </div>
    </div>
  )
}

export function VerticalTwoPreview({ photoSlots, onSlotClick, backgroundColor = '#000000' }: LayoutPreviewProps) {
  return (
    <div className="relative w-full max-w-sm mx-auto" style={{ aspectRatio: '2/3' }}>
      <div
        className="absolute inset-0 flex flex-col overflow-hidden shadow-2xl"
        style={{
          backgroundColor,
          padding: '4%',
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
      </div>
    </div>
  )
}

export function HorizontalTwoPreview({ photoSlots, onSlotClick, backgroundColor = '#000000' }: LayoutPreviewProps) {
  return (
    <div className="relative w-full max-w-sm mx-auto" style={{ aspectRatio: '2/3' }}>
      <div
        className="absolute inset-0 flex overflow-hidden shadow-2xl"
        style={{
          backgroundColor,
          padding: '4%',
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
      </div>
    </div>
  )
}

export function OnePlusTwoPreview({ photoSlots, onSlotClick, backgroundColor = '#000000' }: LayoutPreviewProps) {
  return (
    <div className="relative w-full max-w-sm mx-auto" style={{ aspectRatio: '2/3' }}>
      <div
        className="absolute inset-0 flex flex-col overflow-hidden shadow-2xl"
        style={{
          backgroundColor,
          padding: '4%',
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
        <div className="flex-[2] flex" style={{ gap: '1.33%' }}>
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
      </div>
    </div>
  )
}
