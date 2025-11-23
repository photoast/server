'use client'

import Image from 'next/image'

interface PhotoSlotProps {
  file: File | null
  croppedImageUrl: string | null
  slotNumber: number
  onClick: () => void
  className?: string
  size?: 'small' | 'medium' | 'large'
}

export default function PhotoSlot({
  file,
  croppedImageUrl,
  slotNumber,
  onClick,
  className = '',
  size = 'medium'
}: PhotoSlotProps) {
  const sizeClasses = {
    small: 'text-2xl',
    medium: 'text-4xl',
    large: 'text-5xl'
  }

  return (
    <button
      onClick={onClick}
      className={`relative bg-gradient-to-br from-purple-100 to-pink-100 hover:from-purple-200 hover:to-pink-200 transition-all overflow-hidden group ${className} ${file ? 'hover:ring-4 hover:ring-purple-400' : ''}`}
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
            className="object-cover"
            unoptimized
          />
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-full p-2 shadow-lg">
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
          </div>
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
