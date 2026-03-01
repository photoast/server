'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Stage, Layer, Rect, Image as KonvaImage, Transformer, Text } from 'react-konva'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { SwitSlot, SwitLayout } from '@/lib/types'

type AspectKey = '1:1' | '2:3' | '3:4' | '3:2' | '4:3' | 'free'

const ASPECT_RATIOS: Record<AspectKey, number | null> = {
  '1:1': 1,
  '2:3': 2 / 3,
  '3:4': 3 / 4,
  '3:2': 3 / 2,
  '4:3': 4 / 3,
  'free': null,
}

interface DrawingRect {
  x: number
  y: number
  w: number
  h: number
}

interface Props {
  layout: SwitLayout
  onSave: (slots: SwitSlot[], frameUrl: string | null) => Promise<void>
}

export default function SwitSlotEditor({ layout, onSave }: Props) {
  const [slots, setSlots] = useState<SwitSlot[]>(layout.slots)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawing, setDrawing] = useState<DrawingRect | null>(null)
  const [showFrame, setShowFrame] = useState(false)
  const [frameImage, setFrameImage] = useState<HTMLImageElement | null>(null)
  const [frameUrl, setFrameUrl] = useState<string | null>(layout.frameUrl)
  const [uploadingFrame, setUploadingFrame] = useState(false)
  const [saving, setSaving] = useState(false)

  const stageRef = useRef<Konva.Stage>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const slotNodeRefs = useRef<Map<string, Konva.Rect>>(new Map())

  // Display scaling — fit in ~480px wide
  const DISPLAY_W = 480
  const scale = DISPLAY_W / layout.canvasWidth
  const displayH = Math.round(layout.canvasHeight * scale)

  // Canvas coordinate helpers
  const toCanvas = useCallback((sx: number, sy: number) => ({
    x: sx / scale,
    y: sy / scale,
  }), [scale])

  // Load frame image when URL changes
  useEffect(() => {
    if (!frameUrl) { setFrameImage(null); return }
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => setFrameImage(img)
    img.src = frameUrl
  }, [frameUrl])

  // Attach Transformer to selected slot
  useEffect(() => {
    if (!trRef.current) return
    const node = selectedId ? slotNodeRefs.current.get(selectedId) : null
    trRef.current.nodes(node ? [node] : [])
    trRef.current.getLayer()?.batchDraw()
  }, [selectedId])

  // --- Drag-to-create handlers ---
  const handleMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    const clickedOnStage = e.target === e.target.getStage()
    const clickedOnBg = e.target.hasName('canvas-bg')
    if (!clickedOnStage && !clickedOnBg) return

    const pos = e.target.getStage()!.getPointerPosition()!
    const cp = toCanvas(pos.x, pos.y)
    setSelectedId(null)
    setDrawing({ x: cp.x, y: cp.y, w: 0, h: 0 })
  }

  const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    if (!drawing) return
    const pos = e.target.getStage()!.getPointerPosition()!
    const cp = toCanvas(pos.x, pos.y)
    setDrawing(d => d ? { ...d, w: cp.x - d.x, h: cp.y - d.y } : null)
  }

  const handleMouseUp = () => {
    if (!drawing) return
    const MIN = 40 // minimum slot size in canvas px
    if (Math.abs(drawing.w) > MIN && Math.abs(drawing.h) > MIN) {
      const newSlot: SwitSlot = {
        id: `slot-${Date.now()}`,
        x: drawing.w >= 0 ? drawing.x : drawing.x + drawing.w,
        y: drawing.h >= 0 ? drawing.y : drawing.y + drawing.h,
        width: Math.abs(drawing.w),
        height: Math.abs(drawing.h),
        aspectRatio: 'free',
        order: slots.length,
      }
      setSlots(prev => [...prev, newSlot])
      setSelectedId(newSlot.id)
    }
    setDrawing(null)
  }

  // --- Slot update helpers ---
  const onSlotDragEnd = (id: string, x: number, y: number) => {
    setSlots(prev => prev.map(s => s.id === id ? { ...s, x: x / scale, y: y / scale } : s))
  }

  const onSlotTransformEnd = (id: string, node: Konva.Rect) => {
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    node.scaleX(1)
    node.scaleY(1)
    setSlots(prev => prev.map(s => s.id === id ? {
      ...s,
      x: node.x() / scale,
      y: node.y() / scale,
      width: (node.width() * scaleX) / scale,
      height: (node.height() * scaleY) / scale,
    } : s))
  }

  // --- Aspect ratio preset ---
  const applyAspectRatio = (key: AspectKey) => {
    if (!selectedId) return
    setSlots(prev => prev.map(s => {
      if (s.id !== selectedId) return s
      const ratio = ASPECT_RATIOS[key]
      const newHeight = ratio ? Math.round(s.width / ratio) : s.height
      return { ...s, aspectRatio: key, height: newHeight }
    }))
  }

  // --- Frame upload ---
  const handleFrameUpload = async (file: File) => {
    setUploadingFrame(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/swit-layouts/${layout._id}/frame`, { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json()
      setFrameUrl(data.frameUrl)
    } catch (err) {
      alert('프레임 업로드 실패')
    } finally {
      setUploadingFrame(false)
    }
  }

  const deleteSelected = () => {
    if (!selectedId) return
    setSlots(prev => prev.filter(s => s.id !== selectedId))
    setSelectedId(null)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(slots, frameUrl)
    } finally {
      setSaving(false)
    }
  }

  // Drawing preview rect (normalized)
  const drawPreview = drawing && Math.abs(drawing.w) > 5 && Math.abs(drawing.h) > 5
    ? {
        x: (drawing.w >= 0 ? drawing.x : drawing.x + drawing.w) * scale,
        y: (drawing.h >= 0 ? drawing.y : drawing.y + drawing.h) * scale,
        w: Math.abs(drawing.w) * scale,
        h: Math.abs(drawing.h) * scale,
      }
    : null

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center bg-gray-50 rounded-xl p-3">
        <span className="text-xs font-semibold text-gray-500 shrink-0">그리드 프리셋</span>
        {(Object.keys(ASPECT_RATIOS) as AspectKey[]).map(key => (
          <button
            key={key}
            onClick={() => applyAspectRatio(key)}
            disabled={!selectedId}
            className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition-colors ${
              selectedId
                ? 'border-blue-300 text-blue-600 hover:bg-blue-50 bg-white'
                : 'border-gray-200 text-gray-300 cursor-not-allowed bg-white'
            }`}
          >
            {key}
          </button>
        ))}

        <div className="flex-1 min-w-[8px]" />

        {/* Frame upload */}
        <label className={`px-3 py-1.5 text-xs rounded-xl font-semibold text-white cursor-pointer transition-colors ${
          uploadingFrame ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600'
        }`}>
          {uploadingFrame ? '업로드 중...' : '프레임 PNG'}
          <input
            type="file"
            accept="image/png"
            className="hidden"
            disabled={uploadingFrame}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFrameUpload(f); e.target.value = '' }}
          />
        </label>

        {/* Frame guide toggle */}
        {frameUrl && (
          <button
            onClick={() => setShowFrame(v => !v)}
            className={`px-3 py-1.5 text-xs rounded-xl font-semibold transition-colors ${
              showFrame ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {showFrame ? '가이드 ON' : '가이드 OFF'}
          </button>
        )}

        {/* Delete */}
        {selectedId && (
          <button
            onClick={deleteSelected}
            className="px-3 py-1.5 text-xs rounded-xl font-semibold bg-red-100 text-red-600 hover:bg-red-200"
          >
            삭제
          </button>
        )}

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 text-xs rounded-xl font-semibold bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
        >
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      {/* Canvas Editor */}
      <div
        className="border-2 border-gray-200 rounded-2xl overflow-hidden bg-gray-200 inline-block cursor-crosshair select-none"
        style={{ width: DISPLAY_W, height: displayH }}
      >
        <Stage
          ref={stageRef}
          width={DISPLAY_W}
          height={displayH}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <Layer>
            {/* White paper */}
            <Rect name="canvas-bg" x={0} y={0} width={DISPLAY_W} height={displayH} fill="white" />

            {/* Slots */}
            {slots.map((slot, i) => (
              <Rect
                key={slot.id}
                ref={node => {
                  if (node) slotNodeRefs.current.set(slot.id, node)
                  else slotNodeRefs.current.delete(slot.id)
                }}
                x={slot.x * scale}
                y={slot.y * scale}
                width={slot.width * scale}
                height={slot.height * scale}
                fill={selectedId === slot.id ? 'rgba(59,130,246,0.25)' : 'rgba(99,179,237,0.2)'}
                stroke={selectedId === slot.id ? '#3b82f6' : '#93c5fd'}
                strokeWidth={selectedId === slot.id ? 2 : 1}
                draggable
                onClick={() => setSelectedId(slot.id)}
                onTap={() => setSelectedId(slot.id)}
                onDragEnd={e => onSlotDragEnd(slot.id, e.target.x(), e.target.y())}
                onTransformEnd={e => onSlotTransformEnd(slot.id, e.target as Konva.Rect)}
              />
            ))}

            {/* Slot order labels */}
            {slots.map((slot, i) => (
              <Text
                key={`label-${slot.id}`}
                x={slot.x * scale + 4}
                y={slot.y * scale + 4}
                text={`${i + 1}`}
                fontSize={11}
                fill={selectedId === slot.id ? '#1d4ed8' : '#3b82f6'}
                listening={false}
              />
            ))}

            {/* Drawing preview */}
            {drawPreview && (
              <Rect
                x={drawPreview.x}
                y={drawPreview.y}
                width={drawPreview.w}
                height={drawPreview.h}
                fill="rgba(59,130,246,0.15)"
                stroke="#3b82f6"
                strokeWidth={1.5}
                dash={[6, 4]}
                listening={false}
              />
            )}

            {/* Frame overlay (guide mode) */}
            {showFrame && frameImage && (
              <KonvaImage
                image={frameImage}
                x={0}
                y={0}
                width={DISPLAY_W}
                height={displayH}
                opacity={0.85}
                listening={false}
              />
            )}

            {/* Transformer */}
            <Transformer
              ref={trRef}
              keepRatio={false}
              rotateEnabled={false}
              boundBoxFunc={(_, newBox) => {
                if (newBox.width < 20 || newBox.height < 20) return _
                return newBox
              }}
            />
          </Layer>
        </Stage>
      </div>

      {/* Info */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>슬롯 {slots.length}개 · 빈 캔버스를 드래그해서 새 슬롯을 추가하세요</span>
        <span className="text-gray-400">{layout.printSize} · {layout.canvasWidth}×{layout.canvasHeight}px</span>
      </div>
    </div>
  )
}
