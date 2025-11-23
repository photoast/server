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
  onRemovePhoto: (index: number) => void
}

export function SinglePhotoPreview({ photoSlots, onSlotClick, onRemovePhoto }: LayoutPreviewProps) {
  return (
    <div className="relative w-full max-w-sm mx-auto" style={{ aspectRatio: '2/3' }}>
      <div className="absolute inset-0 bg-gray-100 rounded-2xl overflow-hidden shadow-lg">
        <PhotoSlot
          file={photoSlots[0]?.file}
          croppedImageUrl={photoSlots[0]?.croppedImageUrl}
          slotNumber={1}
          onClick={() => onSlotClick(0)}
          onRemove={() => onRemovePhoto(0)}
          className="w-full h-full"
          size="large"
        />
      </div>
    </div>
  )
}

export function FourCutPreview({ photoSlots, onSlotClick, onRemovePhoto }: LayoutPreviewProps) {
  return (
    <div className="relative w-full max-w-sm mx-auto" style={{ aspectRatio: '2/3' }}>
      <div className="absolute inset-0 flex gap-2 p-2 bg-gray-900 rounded-2xl shadow-lg">
        {/* Left strip */}
        <div className="flex-1 flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <PhotoSlot
              key={i}
              file={photoSlots[i]?.file}
              croppedImageUrl={photoSlots[i]?.croppedImageUrl}
              slotNumber={i + 1}
              onClick={() => onSlotClick(i)}
              onRemove={() => onRemovePhoto(i)}
              className="flex-1"
              size="small"
            />
          ))}
        </div>

        {/* Right strip (duplicate preview) */}
        <div className="flex-1 flex flex-col gap-2 opacity-50">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex-1 relative bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg overflow-hidden"
            >
              {photoSlots[i]?.file && (
                <img
                  src={photoSlots[i].croppedImageUrl || URL.createObjectURL(photoSlots[i].file)}
                  alt={`Photo ${i + 1} duplicate`}
                  className={`w-full h-full ${photoSlots[i]?.croppedImageUrl ? "object-contain" : "object-cover"}`}
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

export function TwoByTwoPreview({ photoSlots, onSlotClick, onRemovePhoto }: LayoutPreviewProps) {
  return (
    <div className="relative w-full max-w-sm mx-auto" style={{ aspectRatio: '2/3' }}>
      <div className="absolute inset-0 grid grid-cols-2 gap-2 p-2 bg-gray-900 rounded-2xl shadow-lg">
        {[0, 1, 2, 3].map((i) => (
          <PhotoSlot
            key={i}
            file={photoSlots[i]?.file}
            croppedImageUrl={photoSlots[i]?.croppedImageUrl}
            slotNumber={i + 1}
            onClick={() => onSlotClick(i)}
            onRemove={() => onRemovePhoto(i)}
            size="medium"
          />
        ))}
      </div>
    </div>
  )
}

export function VerticalTwoPreview({ photoSlots, onSlotClick, onRemovePhoto }: LayoutPreviewProps) {
  return (
    <div className="relative w-full max-w-sm mx-auto" style={{ aspectRatio: '2/3' }}>
      <div className="absolute inset-0 flex flex-col gap-2 p-2 bg-gray-900 rounded-2xl shadow-lg">
        {[0, 1].map((i) => (
          <PhotoSlot
            key={i}
            file={photoSlots[i]?.file}
            croppedImageUrl={photoSlots[i]?.croppedImageUrl}
            slotNumber={i + 1}
            onClick={() => onSlotClick(i)}
            onRemove={() => onRemovePhoto(i)}
            className="flex-1"
            size="medium"
          />
        ))}
      </div>
    </div>
  )
}

export function HorizontalTwoPreview({ photoSlots, onSlotClick, onRemovePhoto }: LayoutPreviewProps) {
  return (
    <div className="relative w-full max-w-sm mx-auto" style={{ aspectRatio: '2/3' }}>
      <div className="absolute inset-0 flex gap-2 p-2 bg-gray-900 rounded-2xl shadow-lg">
        {[0, 1].map((i) => (
          <PhotoSlot
            key={i}
            file={photoSlots[i]?.file}
            croppedImageUrl={photoSlots[i]?.croppedImageUrl}
            slotNumber={i + 1}
            onClick={() => onSlotClick(i)}
            onRemove={() => onRemovePhoto(i)}
            className="flex-1"
            size="medium"
          />
        ))}
      </div>
    </div>
  )
}

export function OnePlusTwoPreview({ photoSlots, onSlotClick, onRemovePhoto }: LayoutPreviewProps) {
  return (
    <div className="relative w-full max-w-sm mx-auto" style={{ aspectRatio: '2/3' }}>
      <div className="absolute inset-0 flex flex-col gap-2 p-2 bg-gray-900 rounded-2xl shadow-lg">
        {/* Top: 1 large photo */}
        <PhotoSlot
          file={photoSlots[0]?.file}
          croppedImageUrl={photoSlots[0]?.croppedImageUrl}
          slotNumber={1}
          onClick={() => onSlotClick(0)}
          onRemove={() => onRemovePhoto(0)}
          className="flex-[3]"
          size="large"
        />

        {/* Bottom: 2 small photos */}
        <div className="flex-[2] flex gap-2">
          {[1, 2].map((i) => (
            <PhotoSlot
              key={i}
              file={photoSlots[i]?.file}
              croppedImageUrl={photoSlots[i]?.croppedImageUrl}
              slotNumber={i + 1}
              onClick={() => onSlotClick(i)}
              onRemove={() => onRemovePhoto(i)}
              className="flex-1"
              size="medium"
            />
          ))}
        </div>
      </div>
    </div>
  )
}
