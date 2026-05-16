'use client'

import { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react'
import { useI18n } from '../[slug]/i18n'

export interface CameraRef {
  capture: () => void
  toggleCamera: () => void
  stop: () => void
}

interface CameraCaptureProps {
  onCapture: (file: File) => void
  onError?: (msg: string) => void
}

const CameraCapture = forwardRef<CameraRef, CameraCaptureProps>(({ onCapture, onError }, ref) => {
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
      const msg = t('camera.noAccess')
      setError(msg)
      onError?.(msg)
    }
  }, [])

  useEffect(() => {
    startCamera(facingMode)
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    capture: () => {
      const video = videoRef.current
      if (!video || !ready) return

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
    },
    toggleCamera: () => {
      const next = facingMode === 'user' ? 'environment' : 'user'
      setFacingMode(next)
      startCamera(next)
    },
    stop: () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
    },
  }))

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {error ? (
        <div className="flex flex-col items-center justify-center w-full h-full gap-2 p-2">
          <p className="text-white text-xs text-center">{error}</p>
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
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}
        </>
      )}
    </div>
  )
})

CameraCapture.displayName = 'CameraCapture'
export default CameraCapture
