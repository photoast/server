'use client'

import { useState, useRef, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import type { Area, Point } from 'react-easy-crop'
import Image from 'next/image'
import type { SwitLayout, SwitSlot } from '@/lib/types'
import { UIButton, UIStatusBanner } from './ui'

// Aspect ratio map for react-easy-crop
const ASPECT_MAP: Record<string, number | undefined> = {
  '1:1': 1,
  '2:3': 2 / 3,
  '3:4': 3 / 4,
  '3:2': 3 / 2,
  '4:3': 4 / 3,
  'free': undefined,
}

interface SlotState {
  file: File | null
  previewUrl: string | null   // object URL of selected file
  croppedUrl: string | null   // data URL of cropped result
  cropArea: Area | null
  cropOffset: Point           // pan offset (x,y in pixels relative to image center)
  cropScale: number           // zoom scale
}

function initSlot(): SlotState {
  return { file: null, previewUrl: null, croppedUrl: null, cropArea: null, cropOffset: { x: 0, y: 0 }, cropScale: 1 }
}

interface Props {
  layout: SwitLayout
  eventSlug: string
  onComplete: (mergedUrl: string) => void
  onBack: () => void
}

export default function SwitUserEditor({ layout, eventSlug, onComplete, onBack }: Props) {
  const [slotStates, setSlotStates] = useState<SlotState[]>(
    layout.slots.map(() => initSlot())
  )
  const [editingSlotIndex, setEditingSlotIndex] = useState<number | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const sortedSlots = [...layout.slots].sort((a, b) => a.order - b.order)

  // --- File selection ---
  const openFilePicker = (slotIndex: number) => {
    setEditingSlotIndex(slotIndex)
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || editingSlotIndex === null) return
    const url = URL.createObjectURL(file)
    setSlotStates(prev => {
      const next = [...prev]
      if (next[editingSlotIndex].previewUrl) URL.revokeObjectURL(next[editingSlotIndex].previewUrl!)
      next[editingSlotIndex] = { ...initSlot(), file, previewUrl: url }
      return next
    })
    e.target.value = ''
  }

  // --- Crop editor state for the currently editing slot ---
  const editingSlot = editingSlotIndex !== null ? sortedSlots[editingSlotIndex] : null
  const editingState = editingSlotIndex !== null ? slotStates[editingSlotIndex] : null

  const [cropPos, setCropPos] = useState<Point>({ x: 0, y: 0 })
  const [cropZoom, setCropZoom] = useState(1)
  const [currentCropArea, setCurrentCropArea] = useState<Area | null>(null)

  // Open crop editor for a slot that already has a file
  const openCropEditor = (slotIndex: number) => {
    const state = slotStates[slotIndex]
    if (!state.previewUrl) return
    setCropPos(state.cropOffset)
    setCropZoom(state.cropScale)
    setCurrentCropArea(state.cropArea)
    setEditingSlotIndex(slotIndex)
  }

  const onCropChange = (position: Point) => setCropPos(position)
  const onZoomChange = (z: number) => setCropZoom(z)
  const onCropComplete = useCallback((_: Area, pixelCrop: Area) => {
    setCurrentCropArea(pixelCrop)
  }, [])

  // Confirm crop — generate cropped image and store
  const confirmCrop = async () => {
    if (editingSlotIndex === null || !editingState?.previewUrl || !currentCropArea || !editingSlot) return

    try {
      const croppedDataUrl = await getCroppedImage(editingState.previewUrl, currentCropArea)
      setSlotStates(prev => {
        const next = [...prev]
        next[editingSlotIndex] = {
          ...next[editingSlotIndex],
          croppedUrl: croppedDataUrl,
          cropArea: currentCropArea,
          cropOffset: cropPos,
          cropScale: cropZoom,
        }
        return next
      })
      setEditingSlotIndex(null)
    } catch (err) {
      setError('이미지 처리에 실패했습니다')
    }
  }

  const cancelCrop = () => {
    setEditingSlotIndex(null)
  }

  // --- Merge and complete ---
  const handleComplete = async () => {
    const allFilled = slotStates.every(s => s.croppedUrl !== null)
    if (!allFilled) {
      setError('모든 슬롯에 사진을 추가해주세요')
      return
    }
    setProcessing(true)
    setError('')

    try {
      const fd = new FormData()
      fd.append('layoutId', layout._id)

      for (let i = 0; i < sortedSlots.length; i++) {
        const slot = sortedSlots[i]
        const state = slotStates[i]
        if (!state.file || !state.cropArea) continue

        // Re-use original file (server will apply cropArea via offsetX/Y/scale)
        fd.append(`slot_${slot.id}_photo`, state.file)
        fd.append(`slot_${slot.id}_offsetX`, String(state.cropOffset.x))
        fd.append(`slot_${slot.id}_offsetY`, String(state.cropOffset.y))
        fd.append(`slot_${slot.id}_scale`, String(state.cropScale))
      }

      const res = await fetch('/api/swit-layouts/merge', { method: 'POST', body: fd })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || '합성 실패')
      }
      const data = await res.json()
      if (!data.url) throw new Error('이미지 URL을 받지 못했습니다')
      onComplete(data.url)
    } catch (err: any) {
      setError(err.message || '처리에 실패했습니다')
    } finally {
      setProcessing(false)
    }
  }

  const filledCount = slotStates.filter(s => s.croppedUrl !== null).length

  // ---- Crop editor view ----
  if (editingSlotIndex !== null && editingState?.previewUrl && editingSlot) {
    const aspectRatio = ASPECT_MAP[editingSlot.aspectRatio]
    const displayAspect = aspectRatio ?? (editingSlot.width / editingSlot.height)

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">
            슬롯 {editingSlotIndex + 1} 사진 편집
          </p>
          <span className="text-xs text-gray-400">{editingSlot.aspectRatio}</span>
        </div>

        <div className="relative bg-black rounded-2xl overflow-hidden" style={{ height: 400 }}>
          <Cropper
            image={editingState.previewUrl}
            crop={cropPos}
            zoom={cropZoom}
            aspect={displayAspect}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="flex gap-2">
          <UIButton fullWidth variant="secondary" onClick={cancelCrop}>취소</UIButton>
          <UIButton fullWidth onClick={confirmCrop}>확인</UIButton>
        </div>
      </div>
    )
  }

  // ---- Main slot grid view ----
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900">{layout.name}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{layout.printSize} · 슬롯 {layout.slots.length}개</p>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-gray-900 tabular-nums">{filledCount}/{layout.slots.length}</div>
          <div className="text-xs text-gray-400">사진 완료</div>
        </div>
      </div>

      {filledCount === layout.slots.length
        ? <UIStatusBanner type="success" message="모든 슬롯이 준비됐어요. 완료 버튼을 눌러 합성하세요." />
        : <UIStatusBanner type="info" message="슬롯을 탭해서 사진을 추가해주세요." />
      }

      {error && <UIStatusBanner type="error" message={error} />}

      {/* Layout preview with slots */}
      <div className="relative mx-auto bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm"
        style={{ aspectRatio: `${layout.canvasWidth} / ${layout.canvasHeight}`, maxWidth: 360 }}
      >
        {/* Frame overlay */}
        {layout.frameUrl && (
          <div className="absolute inset-0 z-10 pointer-events-none">
            <Image src={layout.frameUrl} alt="frame" fill className="object-fill" />
          </div>
        )}

        {/* Slot buttons */}
        {sortedSlots.map((slot, i) => {
          const state = slotStates[i]
          const pctX = (slot.x / layout.canvasWidth) * 100
          const pctY = (slot.y / layout.canvasHeight) * 100
          const pctW = (slot.width / layout.canvasWidth) * 100
          const pctH = (slot.height / layout.canvasHeight) * 100

          return (
            <button
              key={slot.id}
              onClick={() => state.croppedUrl ? openCropEditor(i) : openFilePicker(i)}
              className="absolute border-2 border-dashed transition-colors overflow-hidden"
              style={{
                left: `${pctX}%`,
                top: `${pctY}%`,
                width: `${pctW}%`,
                height: `${pctH}%`,
                borderColor: state.croppedUrl ? 'transparent' : '#93c5fd',
                backgroundColor: state.croppedUrl ? 'transparent' : 'rgba(219,234,254,0.6)',
              }}
            >
              {state.croppedUrl ? (
                <img src={state.croppedUrl} alt={`슬롯 ${i + 1}`} className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center justify-center w-full h-full gap-1">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-xs font-semibold text-blue-400">{i + 1}</span>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {processing && <UIStatusBanner type="processing" message="이미지 합성 중..." />}

      <div className="space-y-2">
        <UIButton
          fullWidth
          onClick={handleComplete}
          disabled={filledCount < layout.slots.length || processing}
          loading={processing}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          완성하기
        </UIButton>
        <UIButton fullWidth variant="secondary" onClick={onBack} disabled={processing}>
          이전으로
        </UIButton>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}

// --- Canvas crop helper ---
async function getCroppedImage(imageSrc: string, pixelCrop: Area): Promise<string> {
  const image = await loadImage(imageSrc)
  const canvas = document.createElement('canvas')
  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height)
  return canvas.toDataURL('image/jpeg', 0.92)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}
