'use client'

import Image from 'next/image'

interface PhotoSlotProps {
  file: File | null
  croppedImageUrl: string | null
  slotNumber: number
  onClick: () => void
  onRemove: () => void
  className?: string
  size?: 'small' | 'medium' | 'large'
}

export default function PhotoSlot({
  file,
  croppedImageUrl,
  slotNumber,
  onClick,
  onRemove,
  className = '',
  size = 'medium'
}: PhotoSlotProps) {
  const sizeClasses = {
    small: 'text-2xl',
    medium: 'text-4xl',
    large: 'text-5xl'
  }

  const buttonSizeClasses = {
    small: 'w-6 h-6 text-xs top-1 right-1',
    medium: 'w-8 h-8 text-sm top-2 right-2',
    large: 'w-10 h-10 text-base top-3 right-3'
  }

  return (
    <button
      onClick={onClick}
      className={`relative bg-gradient-to-br from-purple-100 to-pink-100 hover:from-purple-200 hover:to-pink-200 transition-colors rounded-lg overflow-hidden group ${className}`}
    >
      {file ? (
        <div
          key={`photo-${slotNumber}-${croppedImageUrl || 'original'}`}
          className="relative w-full h-full"
        >
          <Image
            src={croppedImageUrl || URL.createObjectURL(file)}
            alt={`Photo ${slotNumber}`}
            fill
            className={croppedImageUrl ? "object-contain" : "object-cover"}
            unoptimized
          />
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            className={`absolute bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 z-10 shadow-md ${buttonSizeClasses[size]}`}
          >
            ✕
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full">
          <div className={`${sizeClasses[size]} mb-1`}>📷</div>
          <div className="text-sm font-medium text-gray-700">{slotNumber}</div>
        </div>
      )}
    </button>
  )
}
