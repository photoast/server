'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Cropper from 'react-easy-crop'
import type { Area, Point } from 'react-easy-crop'
import Image from 'next/image'
import type { FrameLayout, PhotoSlot, FrameLayer } from '@/lib/types'
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

interface GalleryImage {
  id: string
  file: File
  previewUrl: string
}

export interface CompletedSlotData {
  slotId: string
  file: File
  cropArea: Area
}

interface Props {
  layout: FrameLayout
  eventSlug: string
  backgroundColor?: string
  onComplete: (mergedUrl: string) => void
  onPhotosReady?: (slotData: CompletedSlotData[]) => void
  onBack: () => void
  onLayoutChange?: () => void
}

export default function FrameUserEditor({ layout, eventSlug, backgroundColor = '#FFFFFF', onComplete, onPhotosReady, onBack, onLayoutChange }: Props) {
  const [slotStates, setSlotStates] = useState<SlotState[]>(
    layout.slots.map(() => initSlot())
  )
  const [editingSlotIndex, setEditingSlotIndex] = useState<number | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [actionMenuSlot, setActionMenuSlot] = useState<number | null>(null)
  const [gallery, setGallery] = useState<GalleryImage[]>([])
  const [swapSourceIndex, setSwapSourceIndex] = useState<number | null>(null)
  const [photoPickerSlot, setPhotoPickerSlot] = useState<number | null>(null)

  const [imageDims, setImageDims] = useState<Map<string, { w: number; h: number }>>(new Map())

  useEffect(() => {
    slotStates.forEach(state => {
      if (state.previewUrl && !imageDims.has(state.previewUrl)) {
        const img = new window.Image()
        const url = state.previewUrl
        img.onload = () => {
          setImageDims(prev => new Map(prev).set(url, { w: img.naturalWidth, h: img.naturalHeight }))
        }
        img.src = url
      }
    })
  }, [slotStates, imageDims])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const filePickerSlotRef = useRef<number | null>(null)
  const prevLayoutIdRef = useRef(layout._id)
  const sortedSlots = [...layout.slots].sort((a, b) => a.order - b.order)

  // Detect layout prop changes and remap photos synchronously (before render)
  if (layout._id !== prevLayoutIdRef.current) {
    prevLayoutIdRef.current = layout._id
    const photosWithFiles = slotStates.filter(s => s.file !== null)
    const remapped = sortedSlots.map((_, i) => {
      if (i < photosWithFiles.length) {
        const source = photosWithFiles[i]
        return { file: source.file, previewUrl: source.previewUrl, croppedUrl: null, cropArea: null, cropOffset: { x: 0, y: 0 }, cropScale: 1 } as SlotState
      }
      return initSlot()
    })
    setSlotStates(remapped)
    setEditingSlotIndex(null)
    setActionMenuSlot(null)
    setSwapSourceIndex(null)
    setPhotoPickerSlot(null)
    setError('')
  }

  // --- Gallery management ---
  const addToGallery = (file: File, previewUrl: string) => {
    // Avoid duplicate entries for the same file name + size
    const exists = gallery.some(g => g.file.name === file.name && g.file.size === file.size)
    if (!exists) {
      setGallery(prev => [...prev, { id: `gallery-${Date.now()}-${Math.random()}`, file, previewUrl }])
    }
  }

  const assignGalleryImage = (galleryImg: GalleryImage, slotIndex: number) => {
    // Create a new object URL for this slot's use
    const url = URL.createObjectURL(galleryImg.file)
    setSlotStates(prev => {
      const next = [...prev]
      if (next[slotIndex].previewUrl) URL.revokeObjectURL(next[slotIndex].previewUrl!)
      next[slotIndex] = { ...initSlot(), file: galleryImg.file, previewUrl: url }
      return next
    })
    // Open crop editor
    setTimeout(() => {
      setCropPos({ x: 0, y: 0 })
      setCropZoom(1)
      setCurrentCropArea(null)
      setEditingSlotIndex(slotIndex)
    }, 50)
  }

  // --- File selection ---
  const openFilePicker = (slotIndex: number) => {
    // Use ref instead of state to avoid triggering crop editor view for filled slots
    filePickerSlotRef.current = slotIndex
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const targetSlot = filePickerSlotRef.current
    if (!file || targetSlot === null) return
    filePickerSlotRef.current = null

    const url = URL.createObjectURL(file)
    // Add to gallery
    addToGallery(file, URL.createObjectURL(file))
    setSlotStates(prev => {
      const next = [...prev]
      if (next[targetSlot].previewUrl) URL.revokeObjectURL(next[targetSlot].previewUrl!)
      next[targetSlot] = { ...initSlot(), file, previewUrl: url }
      return next
    })
    // Open crop editor for the new image
    setCropPos({ x: 0, y: 0 })
    setCropZoom(1)
    setCurrentCropArea(null)
    setEditingSlotIndex(targetSlot)
    e.target.value = ''
  }

  // --- Swap ---
  const handleSwapStart = (slotIndex: number) => {
    setActionMenuSlot(null)
    setSwapSourceIndex(slotIndex)
  }

  const performSwap = (sourceIndex: number, targetIndex: number) => {
    setSlotStates(prev => {
      const next = [...prev]
      const temp = next[sourceIndex]
      next[sourceIndex] = next[targetIndex]
      next[targetIndex] = temp
      return next
    })
  }

  // --- Slot actions (for filled slots) ---
  const handleSlotClick = (slotIndex: number) => {
    // Swap mode
    if (swapSourceIndex !== null) {
      if (slotIndex !== swapSourceIndex) {
        performSwap(swapSourceIndex, slotIndex)
      }
      setSwapSourceIndex(null)
      return
    }

    const state = slotStates[slotIndex]
    if (state.croppedUrl) {
      // Show action menu for filled slot
      setActionMenuSlot(slotIndex)
    } else if (state.file && state.previewUrl) {
      // File exists but needs cropping (e.g. after layout change)
      openCropEditor(slotIndex)
    } else {
      // Empty slot - show photo picker if gallery has images, otherwise file picker
      if (gallery.length > 0) {
        setPhotoPickerSlot(slotIndex)
      } else {
        openFilePicker(slotIndex)
      }
    }
  }

  const clearSlot = (slotIndex: number) => {
    setSlotStates(prev => {
      const next = [...prev]
      if (next[slotIndex].previewUrl) URL.revokeObjectURL(next[slotIndex].previewUrl!)
      next[slotIndex] = initSlot()
      return next
    })
    setActionMenuSlot(null)
  }

  const changeSlotImage = (slotIndex: number) => {
    setActionMenuSlot(null)
    if (gallery.length > 0) {
      setPhotoPickerSlot(slotIndex)
    } else {
      openFilePicker(slotIndex)
    }
  }

  const editSlotCrop = (slotIndex: number) => {
    setActionMenuSlot(null)
    openCropEditor(slotIndex)
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

    // If parent wants to handle merge externally (for color selection step)
    if (onPhotosReady) {
      const slotData: CompletedSlotData[] = sortedSlots.map((slot, i) => ({
        slotId: slot.id,
        file: slotStates[i].file!,
        cropArea: slotStates[i].cropArea!,
      }))
      onPhotosReady(slotData)
      return
    }

    setProcessing(true)
    setError('')

    try {
      const { canvasWidth, canvasHeight, slots, frameLayers } = layout

      // Build unified items sorted by zIndex
      type Item =
        | { type: 'slot'; slotId: string; zIndex: number }
        | { type: 'frame'; layer: (typeof frameLayers)[number]; zIndex: number }
      const items: Item[] = []
      for (const slot of slots) items.push({ type: 'slot', slotId: slot.id, zIndex: slot.zIndex ?? 10 })
      for (const layer of frameLayers || []) {
        if (layer.visible !== false) items.push({ type: 'frame', layer, zIndex: layer.zIndex })
      }
      items.sort((a, b) => a.zIndex - b.zIndex)

      const canvas = document.createElement('canvas')
      canvas.width = canvasWidth
      canvas.height = canvasHeight
      const ctx = canvas.getContext('2d')!

      ctx.fillStyle = backgroundColor
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)

      const loadImg = (src: string | File): Promise<HTMLImageElement> =>
        new Promise((resolve, reject) => {
          const img = new window.Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => resolve(img)
          img.onerror = reject
          img.src = src instanceof File ? URL.createObjectURL(src) : src
        })

      for (const item of items) {
        if (item.type === 'slot') {
          const slot = slots.find(s => s.id === item.slotId)!
          const idx = sortedSlots.indexOf(slot)
          const state = slotStates[idx]
          if (!state?.file || !state.cropArea) continue
          const img = await loadImg(state.file)
          const { x: cropX, y: cropY, width: cropW, height: cropH } = state.cropArea
          const rotation = slot.rotation ?? 0
          ctx.save()
          if (rotation !== 0) {
            ctx.translate(slot.x + slot.width / 2, slot.y + slot.height / 2)
            ctx.rotate((rotation * Math.PI) / 180)
            ctx.drawImage(img, cropX, cropY, cropW, cropH, -slot.width / 2, -slot.height / 2, slot.width, slot.height)
          } else {
            ctx.drawImage(img, cropX, cropY, cropW, cropH, slot.x, slot.y, slot.width, slot.height)
          }
          ctx.restore()
          URL.revokeObjectURL(img.src)
        } else {
          const layer = item.layer
          try {
            const img = await loadImg(layer.imageUrl)
            const lx = layer.x ?? 0
            const ly = layer.y ?? 0
            const lw = layer.width ?? canvasWidth
            const lh = layer.height ?? canvasHeight
            const rotation = layer.rotation ?? 0
            ctx.save()
            ctx.globalAlpha = layer.opacity ?? 1
            if (rotation !== 0) {
              ctx.translate(lx + lw / 2, ly + lh / 2)
              ctx.rotate((rotation * Math.PI) / 180)
              ctx.drawImage(img, -lw / 2, -lh / 2, lw, lh)
            } else {
              ctx.drawImage(img, lx, ly, lw, lh)
            }
            ctx.restore()
          } catch {
            console.warn(`Failed to load frame layer ${layer.id}, skipping`)
          }
        }
      }

      const mergedDataUrl = canvas.toDataURL('image/jpeg', 0.95)
      onComplete(mergedDataUrl)
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

        <div className="relative bg-black overflow-hidden" style={{ height: 400 }}>
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
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-gray-900">{layout.name}</h2>
            {onLayoutChange && (
              <button
                onClick={onLayoutChange}
                className="text-xs text-blue-500 font-semibold hover:text-blue-600 transition-colors"
              >
                변경
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{layout.printSize} · 슬롯 {layout.slots.length}개</p>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-gray-900 tabular-nums">{filledCount}/{layout.slots.length}</div>
          <div className="text-xs text-gray-400">사진 완료</div>
        </div>
      </div>

      {swapSourceIndex !== null ? (
        <div className="flex items-center justify-between bg-blue-50 rounded-xl px-4 py-3">
          <span className="text-sm font-semibold text-blue-700">이동할 위치를 선택하세요</span>
          <button onClick={() => setSwapSourceIndex(null)} className="text-xs font-semibold text-blue-500 hover:text-blue-600">취소</button>
        </div>
      ) : filledCount === layout.slots.length
        ? <UIStatusBanner type="success" message="모든 슬롯이 준비됐어요. 완료 버튼을 눌러 합성하세요." />
        : <UIStatusBanner type="info" message="슬롯을 탭해서 사진을 추가해주세요." />
      }

      {error && <UIStatusBanner type="error" message={error} />}

      {/* Layout preview with slots */}
      <div className="relative mx-auto overflow-hidden border border-gray-100 shadow-sm"
        style={{ aspectRatio: `${layout.canvasWidth} / ${layout.canvasHeight}`, maxWidth: 360, backgroundColor }}
      >
        {/* Frame layers (sorted by zIndex) */}
        {(() => {
          const layers: FrameLayer[] = (layout.frameLayers && layout.frameLayers.length > 0)
            ? layout.frameLayers.filter(l => l.visible)
            : layout.frameUrl
              ? [{ id: 'legacy', name: '프레임', imageUrl: layout.frameUrl, zIndex: 100, opacity: 1, visible: true }]
              : []
          return layers
            .sort((a, b) => a.zIndex - b.zIndex)
            .map(layer => {
              const hasCustomPos = layer.x != null || layer.y != null || layer.width != null || layer.height != null
              if (hasCustomPos) {
                const pctX = ((layer.x ?? 0) / layout.canvasWidth) * 100
                const pctY = ((layer.y ?? 0) / layout.canvasHeight) * 100
                const pctW = ((layer.width ?? layout.canvasWidth) / layout.canvasWidth) * 100
                const pctH = ((layer.height ?? layout.canvasHeight) / layout.canvasHeight) * 100
                return (
                  <div key={layer.id} className="absolute pointer-events-none" style={{
                    left: `${pctX}%`, top: `${pctY}%`, width: `${pctW}%`, height: `${pctH}%`,
                    zIndex: layer.zIndex, opacity: layer.opacity,
                    transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
                    transformOrigin: 'top left',
                  }}>
                    <Image src={layer.imageUrl} alt={layer.name} fill className="object-fill" />
                  </div>
                )
              }
              return (
                <div key={layer.id} className="absolute inset-0 pointer-events-none" style={{ zIndex: layer.zIndex, opacity: layer.opacity }}>
                  <Image src={layer.imageUrl} alt={layer.name} fill className="object-fill" />
                </div>
              )
            })
        })()}

        {/* Full image overflow preview (dimmed, behind slots) */}
        {sortedSlots.map((slot, i) => {
          const state = slotStates[i]
          if (!state.previewUrl || !state.cropArea || !state.croppedUrl) return null
          const dims = imageDims.get(state.previewUrl)
          if (!dims) return null

          const { cropArea } = state
          const pctX = (slot.x / layout.canvasWidth) * 100
          const pctY = (slot.y / layout.canvasHeight) * 100
          const pctW = (slot.width / layout.canvasWidth) * 100
          const pctH = (slot.height / layout.canvasHeight) * 100

          const imgWidthPct = (dims.w / cropArea.width) * 100
          const imgHeightPct = (dims.h / cropArea.height) * 100
          const imgLeftPct = -(cropArea.x / cropArea.width) * 100
          const imgTopPct = -(cropArea.y / cropArea.height) * 100

          return (
            <div key={`overflow-${slot.id}`}
              className="absolute pointer-events-none"
              style={{
                left: `${pctX}%`, top: `${pctY}%`,
                width: `${pctW}%`, height: `${pctH}%`,
                zIndex: (slot.zIndex ?? 10) - 1,
                overflow: 'visible',
                transform: (slot.rotation ?? 0) !== 0 ? `rotate(${slot.rotation}deg)` : undefined,
                transformOrigin: 'top left',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={state.previewUrl}
                alt=""
                style={{
                  position: 'absolute',
                  left: `${imgLeftPct}%`, top: `${imgTopPct}%`,
                  width: `${imgWidthPct}%`, height: `${imgHeightPct}%`,
                  opacity: 0.15,
                  pointerEvents: 'none',
                }}
              />
            </div>
          )
        })}

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
              onClick={() => handleSlotClick(i)}
              className={`absolute transition-colors overflow-hidden group ${state.croppedUrl ? '' : 'border-2 border-dashed'} ${swapSourceIndex === i ? 'ring-3 ring-blue-500 z-30' : ''}`}
              style={{
                left: `${pctX}%`,
                top: `${pctY}%`,
                width: `${pctW}%`,
                height: `${pctH}%`,
                zIndex: swapSourceIndex === i ? 30 : (slot.zIndex ?? 10),
                borderColor: state.croppedUrl ? undefined : '#93c5fd',
                backgroundColor: state.croppedUrl ? undefined : 'rgba(219,234,254,0.6)',
                transform: (slot.rotation ?? 0) !== 0 ? `rotate(${slot.rotation}deg)` : undefined,
                transformOrigin: 'top left',
              }}
            >
              {state.croppedUrl ? (
                <>
                  <img src={state.croppedUrl} alt={`슬롯 ${i + 1}`} className="w-full h-full object-cover" />
                  {/* Hover overlay with edit hint */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <span className="text-white text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 px-2 py-1 rounded-lg">
                      {swapSourceIndex !== null ? '여기로 이동' : '편집'}
                    </span>
                  </div>
                </>
              ) : swapSourceIndex !== null && swapSourceIndex !== i ? (
                <div className="relative flex flex-col items-center justify-center w-full h-full gap-1 bg-blue-50/60">
                  <span className="text-xs font-semibold text-blue-400">여기로 이동</span>
                </div>
              ) : (
                <div className="relative flex flex-col items-center justify-center w-full h-full gap-1">
                  {/* Shimmer animation */}
                  <div className="absolute inset-0 animate-shimmer" style={{
                    background: 'linear-gradient(90deg, transparent 0%, rgba(147,197,253,0.3) 50%, transparent 100%)',
                    backgroundSize: '200% 100%',
                  }} />
                  <svg className="w-5 h-5 text-blue-400 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-xs font-semibold text-blue-400 relative z-10">{i + 1}</span>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Slot action menu (modal) */}
      {actionMenuSlot !== null && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setActionMenuSlot(null)}>
          <div
            className="w-full max-w-sm bg-white rounded-t-2xl p-5 pb-8 space-y-2 animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-sm font-bold text-gray-900 text-center mb-3">
              슬롯 {actionMenuSlot + 1}
            </p>
            <button
              onClick={() => editSlotCrop(actionMenuSlot)}
              className="w-full py-3 text-sm font-semibold text-gray-800 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
              </svg>
              크롭 편집
            </button>
            <button
              onClick={() => handleSwapStart(actionMenuSlot)}
              className="w-full py-3 text-sm font-semibold text-gray-800 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
              위치 변경
            </button>
            <button
              onClick={() => changeSlotImage(actionMenuSlot)}
              className="w-full py-3 text-sm font-semibold text-gray-800 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              다른 사진으로 변경
            </button>
            <button
              onClick={() => clearSlot(actionMenuSlot)}
              className="w-full py-3 text-sm font-semibold text-red-500 bg-red-50 rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              삭제
            </button>
            <button
              onClick={() => setActionMenuSlot(null)}
              className="w-full py-3 text-sm font-semibold text-gray-400 rounded-xl hover:bg-gray-50 transition-colors mt-1"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* Photo picker bottom sheet */}
      {photoPickerSlot !== null && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setPhotoPickerSlot(null)}>
          <div
            className="w-full max-w-sm bg-white rounded-t-2xl p-5 pb-8 space-y-4 animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-sm font-bold text-gray-900 text-center">
              슬롯 {photoPickerSlot + 1} — 사진 선택
            </p>

            {/* Gallery grid */}
            <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
              {gallery.map(img => (
                <button
                  key={img.id}
                  onClick={() => {
                    const slot = photoPickerSlot
                    setPhotoPickerSlot(null)
                    assignGalleryImage(img, slot)
                  }}
                  className="aspect-square rounded-xl overflow-hidden border-2 border-gray-100 hover:border-blue-400 transition-colors"
                >
                  <img src={img.previewUrl} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>

            {/* New photo button */}
            <button
              onClick={() => {
                const slot = photoPickerSlot
                setPhotoPickerSlot(null)
                openFilePicker(slot)
              }}
              className="w-full py-3 text-sm font-semibold text-gray-800 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              새 사진 추가
            </button>

            <button
              onClick={() => setPhotoPickerSlot(null)}
              className="w-full py-3 text-sm font-semibold text-gray-400 rounded-xl hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}

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

      {/* Animations */}
      <style jsx>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.25s ease-out;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .animate-shimmer {
          animation: shimmer 2s ease-in-out infinite;
        }
      `}</style>
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
