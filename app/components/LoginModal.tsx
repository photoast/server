'use client'

import { signIn } from 'next-auth/react'

interface LoginModalProps {
  open: boolean
  onClose: () => void
  callbackUrl?: string
}

export default function LoginModal({ open, onClose, callbackUrl }: LoginModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-[90%] max-w-sm p-6 space-y-5 animate-in fade-in zoom-in-95">
        <div className="text-center">
          <h2 className="text-lg font-bold text-gray-900">로그인</h2>
          <p className="text-sm text-gray-500 mt-1">결제를 위해 로그인이 필요해요</p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => signIn('google', { callbackUrl })}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 active:scale-[0.98] transition-all text-sm font-medium text-gray-700"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google로 계속하기
          </button>

          <button
            onClick={() => signIn('kakao', { callbackUrl })}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-[#FEE500] hover:bg-[#F5DC00] active:scale-[0.98] transition-all text-sm font-medium text-[#191919]"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#191919">
              <path d="M12 3C6.48 3 2 6.48 2 10.5c0 2.58 1.72 4.84 4.3 6.14l-1.1 4.06c-.08.3.26.54.52.37l4.7-3.12c.52.06 1.05.1 1.58.1 5.52 0 10-3.48 10-7.55S17.52 3 12 3z"/>
            </svg>
            카카오로 계속하기
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          취소
        </button>
      </div>
    </div>
  )
}
