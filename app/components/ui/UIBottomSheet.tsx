'use client'

import { ReactNode, useEffect } from 'react'

interface UIBottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

export default function UIBottomSheet({ open, onClose, title, children }: UIBottomSheetProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      {/* Sheet */}
      <div className="relative w-full bg-white rounded-t-2xl p-5 space-y-2 animate-in slide-in-from-bottom duration-200">
        {title && (
          <p className="text-xs font-semibold text-gray-400 mb-3">{title}</p>
        )}
        {children}
      </div>
    </div>
  )
}
