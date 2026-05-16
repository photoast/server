'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useI18n } from '../[slug]/i18n'

interface CameraCaptureProps {
  onCapture: (file: File) => void
  onCancel: () => void
  aspectRatio?: number
}

export default function CameraCapture({ onCapture, onCancel, aspectRatio }: CameraCaptureProps) {
  const { t } = useI18n()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startCamera = useCallback(async (facing: 'user' | 'environment') => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
    }
    setReady(false)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => setReady(true)
      }
    } catch {
      setError(t('camera.noAccess'))
    }
  }, [])

  useEffect(() => {
    startCamera(facingMode)
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCamera = () => {
    const next = facingMode === 'user' ? 'environment' : 'user'
    setFacingMode(next)
    startCamera(next)
  }

  const capture = () => {
    const video = videoRef.current
    if (!video) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')!

    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, 0, 0)

    canvas.toBlob(blob => {
      if (!blob) return
      const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' })
      streamRef.current?.getTracks().forEach(t => t.stop())
      onCapture(file)
    }, 'image/jpeg', 0.92)
  }

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-black rounded-lg overflow-hidden">
      {error ? (
        <div className="flex flex-col items-center gap-3 p-4">
          <p className="text-white text-sm text-center">{error}</p>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-white/20 text-white text-sm rounded-lg"
          >
            {t('camera.close')}
          </button>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : undefined }}
          />

          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}

          {/* Controls overlay */}
          <div className="absolute bottom-0 inset-x-0 p-3 flex items-center justify-between bg-gradient-to-t from-black/60 to-transparent">
            {/* Cancel */}
            <button
              onClick={() => {
                streamRef.current?.getTracks().forEach(t => t.stop())
                onCancel()
              }}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/20 backdrop-blur-sm"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Shutter */}
            <button
              onClick={capture}
              disabled={!ready}
              className="w-14 h-14 rounded-full border-4 border-white flex items-center justify-center disabled:opacity-50 transition-transform active:scale-90"
            >
              <div className="w-11 h-11 rounded-full bg-white" />
            </button>

            {/* Flip */}
            <button
              onClick={toggleCamera}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/20 backdrop-blur-sm"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
