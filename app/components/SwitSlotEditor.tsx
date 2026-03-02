'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Stage, Layer, Rect, Image as KonvaImage, Transformer, Text } from 'react-konva'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { SwitSlot, SwitLayout, SwitFrameLayer } from '@/lib/types'

type AspectKey = '1:1' | '2:3' | '3:4' | '3:2' | '4:3' | 'free'

const ASPECT_RATIOS: Record<AspectKey, number | null> = {
  '1:1': 1,
  '2:3': 2 / 3,
  '3:4': 3 / 4,
  '3:2': 3 / 2,
  '4:3': 4 / 3,
  'free': null,
}

// Grid layout presets: cols x rows
const MARGIN = 20
const GAP = 20

interface GridPreset {
  label: string
  cols: number
  rows: number
}

const GRID_PRESETS: GridPreset[] = [
  { label: '1x1', cols: 1, rows: 1 },
  { label: '1x2', cols: 1, rows: 2 },
  { label: '2x1', cols: 2, rows: 1 },
  { label: '2x2', cols: 2, rows: 2 },
  { label: '1x4', cols: 1, rows: 4 },
  { label: '4x1', cols: 4, rows: 1 },
]

interface DrawingRect {
  x: number
  y: number
  w: number
  h: number
}

interface DetectedRegion {
  x: number; y: number; width: number; height: number
}

function detectColorRegions(
  img: HTMLImageElement,
  clickIX: number, clickIY: number,
  tolerance: number,
  layerCanvasX: number, layerCanvasY: number,
  layerCanvasW: number, layerCanvasH: number,
  minCanvasDim: number,
): { regions: DetectedRegion[]; sampledColor: string } {
  const nw = img.naturalWidth
  const nh = img.naturalHeight

  const oc = document.createElement('canvas')
  oc.width = nw
  oc.height = nh
  const ctx = oc.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  const { data } = ctx.getImageData(0, 0, nw, nh)

  const ci = (Math.round(clickIY) * nw + Math.round(clickIX)) * 4
  const tr = data[ci], tg = data[ci + 1], tb = data[ci + 2]
  const sampledColor = `#${tr.toString(16).padStart(2, '0')}${tg.toString(16).padStart(2, '0')}${tb.toString(16).padStart(2, '0')}`.toUpperCase()

  // Build match mask
  const total = nw * nh
  const matches = new Uint8Array(total)
  for (let i = 0; i < total; i++) {
    const off = i * 4
    if (data[off + 3] < 128) continue // skip transparent
    const diff = Math.max(
      Math.abs(data[off] - tr),
      Math.abs(data[off + 1] - tg),
      Math.abs(data[off + 2] - tb),
    )
    if (diff <= tolerance) matches[i] = 1
  }

  // Union-Find connected components (4-connectivity)
  const labels = new Int32Array(total).fill(-1)
  const parent: number[] = []
  let nextLabel = 0

  const find = (x: number): number => {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] }
    return x
  }
  const union = (a: number, b: number) => {
    const ra = find(a), rb = find(b)
    if (ra !== rb) parent[ra] = rb
  }

  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const idx = y * nw + x
      if (!matches[idx]) continue
      const above = y > 0 ? labels[(y - 1) * nw + x] : -1
      const left = x > 0 ? labels[y * nw + x - 1] : -1
      if (above === -1 && left === -1) {
        labels[idx] = nextLabel
        parent.push(nextLabel)
        nextLabel++
      } else if (above !== -1 && left === -1) {
        labels[idx] = above
      } else if (above === -1 && left !== -1) {
        labels[idx] = left
      } else {
        labels[idx] = above
        union(above, left)
      }
    }
  }

  // Collect bounding boxes
  const bboxMap = new Map<number, { minX: number; minY: number; maxX: number; maxY: number }>()
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const idx = y * nw + x
      if (labels[idx] === -1) continue
      const root = find(labels[idx])
      const bb = bboxMap.get(root)
      if (!bb) bboxMap.set(root, { minX: x, minY: y, maxX: x, maxY: y })
      else {
        if (x < bb.minX) bb.minX = x; if (y < bb.minY) bb.minY = y
        if (x > bb.maxX) bb.maxX = x; if (y > bb.maxY) bb.maxY = y
      }
    }
  }

  // Convert to canvas coords and filter noise
  const scaleX = layerCanvasW / nw
  const scaleY = layerCanvasH / nh
  const regions: DetectedRegion[] = []
  bboxMap.forEach(bb => {
    const cw = (bb.maxX - bb.minX + 1) * scaleX
    const ch = (bb.maxY - bb.minY + 1) * scaleY
    if (cw < minCanvasDim || ch < minCanvasDim) return
    regions.push({
      x: layerCanvasX + bb.minX * scaleX,
      y: layerCanvasY + bb.minY * scaleY,
      width: cw, height: ch,
    })
  })

  return { regions, sampledColor }
}

interface Props {
  layout: SwitLayout
  onSave: (slots: SwitSlot[], frameLayers: SwitFrameLayer[], bgColor: string, bgCustomizable: boolean) => Promise<void>
}

type LayerItem =
  | { type: 'slot'; id: string; name: string; zIndex: number; visible: boolean }
  | { type: 'frame'; id: string; name: string; zIndex: number; visible: boolean }

export default function SwitSlotEditor({ layout, onSave }: Props) {
  const [slots, setSlots] = useState<SwitSlot[]>(layout.slots)
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [selectedFrameLayerId, setSelectedFrameLayerId] = useState<string | null>(null)
  const [drawing, setDrawing] = useState<DrawingRect | null>(null)
  const [frameLayers, setFrameLayers] = useState<SwitFrameLayer[]>(layout.frameLayers || [])
  const [frameImages, setFrameImages] = useState<Map<string, HTMLImageElement>>(new Map())
  const [testImages, setTestImages] = useState<Map<string, HTMLImageElement>>(new Map())
  const [uploadingFrame, setUploadingFrame] = useState(false)
  const [saving, setSaving] = useState(false)
  const [shiftHeld, setShiftHeld] = useState(false)
  const [bgColor, setBgColor] = useState(layout.backgroundColor || '#FFFFFF')
  const [bgCustomizable, setBgCustomizable] = useState(layout.backgroundColorCustomizable ?? true)

  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'slot' | 'frame'; id: string; name: string } | null>(null)

  // Slot detection from frame layer
  const [editorMode, setEditorMode] = useState<'draw' | 'colorPick'>('draw')
  const [detectTargetLayerId, setDetectTargetLayerId] = useState<string | null>(null)
  const [colorTolerance, setColorTolerance] = useState(30)
  const [detectedRegions, setDetectedRegions] = useState<DetectedRegion[]>([])
  const [sampledColor, setSampledColor] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState(false)

  const stageRef = useRef<Konva.Stage>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const slotNodeRefs = useRef<Map<string, Konva.Rect>>(new Map())
  const frameNodeRefs = useRef<Map<string, Konva.Rect>>(new Map())
  const shimmerRefs = useRef<Map<string, Konva.Rect>>(new Map())
  const testImageInputRef = useRef<HTMLInputElement>(null)
  const lastPickRef = useRef<{ img: HTMLImageElement; ix: number; iy: number; lx: number; ly: number; lw: number; lh: number } | null>(null)

  // Display scaling — fit in ~480px wide
  const DISPLAY_W = 480
  const scale = DISPLAY_W / layout.canvasWidth
  const displayH = Math.round(layout.canvasHeight * scale)

  const toCanvas = useCallback((sx: number, sy: number) => ({
    x: sx / scale,
    y: sy / scale,
  }), [scale])

  // Selected slot object
  const selectedSlot = selectedSlotId ? slots.find(s => s.id === selectedSlotId) : null

  // Shimmer animation for empty slots
  useEffect(() => {
    let animId: number
    const animate = () => {
      const t = (Date.now() % 1500) / 1500 // 0→1 over 1.5s
      shimmerRefs.current.forEach((node, slotId) => {
        if (testImages.has(slotId)) return
        const w = node.width()
        // Slide gradient across the slot width
        const offset = (t - 0.5) * w * 2
        node.fillLinearGradientStartPoint({ x: offset, y: 0 })
        node.fillLinearGradientEndPoint({ x: offset + w, y: 0 })
      })
      stageRef.current?.batchDraw()
      animId = requestAnimationFrame(animate)
    }
    animId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animId)
  }, [slots, testImages])

  // Load frame images
  useEffect(() => {
    const newMap = new Map<string, HTMLImageElement>()
    if (frameLayers.length === 0) { setFrameImages(new Map()); return }
    let loaded = 0
    frameLayers.forEach(layer => {
      const img = new window.Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => { newMap.set(layer.id, img); loaded++; if (loaded === frameLayers.length) setFrameImages(new Map(newMap)) }
      img.onerror = () => { loaded++; if (loaded === frameLayers.length) setFrameImages(new Map(newMap)) }
      img.src = layer.imageUrl
    })
  }, [frameLayers])

  // Attach Transformer to selected slot or frame layer
  useEffect(() => {
    if (!trRef.current) return
    let node: Konva.Rect | Konva.Node | undefined
    if (selectedSlotId) node = slotNodeRefs.current.get(selectedSlotId)
    else if (selectedFrameLayerId) node = frameNodeRefs.current.get(selectedFrameLayerId)
    trRef.current.nodes(node ? [node] : [])
    trRef.current.getLayer()?.batchDraw()
  }, [selectedSlotId, selectedFrameLayerId])

  // Keyboard: Escape → cancel colorPick, Backspace/Delete → confirm delete
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Escape cancels color pick mode
      if (e.key === 'Escape' && (editorMode === 'colorPick' || detectedRegions.length > 0)) {
        setEditorMode('draw')
        setDetectedRegions([])
        setSampledColor(null)
        setDetectTargetLayerId(null)
        lastPickRef.current = null
        e.preventDefault()
        return
      }

      if (e.key !== 'Backspace' && e.key !== 'Delete') return
      // Ignore if typing in an input
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (selectedSlotId) {
        const idx = slots.findIndex(s => s.id === selectedSlotId)
        setDeleteConfirm({ type: 'slot', id: selectedSlotId, name: `슬롯 ${idx + 1}` })
        e.preventDefault()
      } else if (selectedFrameLayerId) {
        const layer = frameLayers.find(l => l.id === selectedFrameLayerId)
        if (layer) setDeleteConfirm({ type: 'frame', id: selectedFrameLayerId, name: layer.name })
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedSlotId, selectedFrameLayerId, slots, frameLayers, editorMode, detectedRegions.length])

  // Track Shift key for proportional resize
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftHeld(true) }
    const up = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftHeld(false) }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])

  // Re-detect when tolerance changes
  useEffect(() => {
    const p = lastPickRef.current
    if (!p || detectedRegions.length === 0) return
    try {
      const { regions, sampledColor: color } = detectColorRegions(
        p.img, p.ix, p.iy, colorTolerance, p.lx, p.ly, p.lw, p.lh, 40,
      )
      setSampledColor(color)
      setDetectedRegions(regions)
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorTolerance])

  const getNextZIndex = () => {
    const allZ = [...slots.map(s => s.zIndex ?? 10), ...frameLayers.map(l => l.zIndex)]
    return allZ.length > 0 ? Math.max(...allZ) + 1 : 10
  }

  // --- Color pick click for slot detection ---
  const handleColorPickClick = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (!detectTargetLayerId) return
    const layer = frameLayers.find(l => l.id === detectTargetLayerId)
    const img = frameImages.get(detectTargetLayerId)
    if (!layer || !img) return

    const pos = e.target.getStage()!.getPointerPosition()!
    const cp = toCanvas(pos.x, pos.y)

    const lx = layer.x ?? 0
    const ly = layer.y ?? 0
    const lw = layer.width ?? layout.canvasWidth
    const lh = layer.height ?? layout.canvasHeight
    const nw = img.naturalWidth
    const nh = img.naturalHeight

    const ix = ((cp.x - lx) / lw) * nw
    const iy = ((cp.y - ly) / lh) * nh

    if (ix < 0 || iy < 0 || ix >= nw || iy >= nh) return

    lastPickRef.current = { img, ix, iy, lx, ly, lw, lh }

    try {
      const { regions, sampledColor: color } = detectColorRegions(
        img, ix, iy, colorTolerance, lx, ly, lw, lh, 40,
      )
      setSampledColor(color)
      setDetectedRegions(regions)
    } catch {
      alert('이미지 색상 분석 실패 (CORS 오류일 수 있습니다)')
    }
    setEditorMode('draw')
  }, [detectTargetLayerId, frameLayers, frameImages, toCanvas, layout, colorTolerance])

  // --- Confirm detected regions as slots ---
  const confirmDetectedSlots = useCallback(() => {
    if (detectedRegions.length === 0) return
    const baseZ = getNextZIndex()
    const now = Date.now()
    const newSlots: SwitSlot[] = detectedRegions.map((r, i) => ({
      id: `slot-${now}-d${i}`,
      x: Math.round(r.x),
      y: Math.round(r.y),
      width: Math.round(r.width),
      height: Math.round(r.height),
      aspectRatio: 'free' as const,
      order: slots.length + i,
      zIndex: baseZ + i,
      rotation: 0,
    }))
    setSlots(prev => [...prev, ...newSlots])
    setDetectedRegions([])
    setSampledColor(null)
    setDetectTargetLayerId(null)
    lastPickRef.current = null
  }, [detectedRegions, slots.length, getNextZIndex])

  // --- Drag-to-create ---
  const handleMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    // Intercept clicks in colorPick mode
    if (editorMode === 'colorPick') {
      handleColorPickClick(e)
      return
    }

    const clickedOnStage = e.target === e.target.getStage()
    const clickedOnBg = e.target.hasName('canvas-bg')
    if (!clickedOnStage && !clickedOnBg) return
    const pos = e.target.getStage()!.getPointerPosition()!
    const cp = toCanvas(pos.x, pos.y)
    setSelectedSlotId(null)
    setSelectedFrameLayerId(null)
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
    const MIN = 40
    if (Math.abs(drawing.w) > MIN && Math.abs(drawing.h) > MIN) {
      const newSlot: SwitSlot = {
        id: `slot-${Date.now()}`,
        x: drawing.w >= 0 ? drawing.x : drawing.x + drawing.w,
        y: drawing.h >= 0 ? drawing.y : drawing.y + drawing.h,
        width: Math.abs(drawing.w),
        height: Math.abs(drawing.h),
        aspectRatio: 'free',
        order: slots.length,
        zIndex: getNextZIndex(),
        rotation: 0,
      }
      setSlots(prev => [...prev, newSlot])
      setSelectedSlotId(newSlot.id)
      setSelectedFrameLayerId(null)
    }
    setDrawing(null)
  }

  // --- Grid preset: replace all slots with a grid layout ---
  const applyGridPreset = (preset: GridPreset) => {
    const { cols, rows } = preset
    const cw = layout.canvasWidth
    const ch = layout.canvasHeight
    // Base zIndex above existing frame layers
    const frameMaxZ = frameLayers.length > 0 ? Math.max(...frameLayers.map(l => l.zIndex)) : 0
    const baseZ = Math.max(10, frameMaxZ + 1)

    // Full bleed for 1x1
    if (cols === 1 && rows === 1) {
      const newSlot: SwitSlot = {
        id: `slot-${Date.now()}`,
        x: 0, y: 0, width: cw, height: ch,
        aspectRatio: 'free', order: 0, zIndex: baseZ, rotation: 0,
      }
      setSlots([newSlot])
      setSelectedSlotId(newSlot.id)
      setSelectedFrameLayerId(null)
      return
    }

    const slotW = Math.round((cw - MARGIN * 2 - GAP * (cols - 1)) / cols)
    const slotH = Math.round((ch - MARGIN * 2 - GAP * (rows - 1)) / rows)
    const now = Date.now()
    const newSlots: SwitSlot[] = []

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c
        newSlots.push({
          id: `slot-${now}-${idx}`,
          x: MARGIN + c * (slotW + GAP),
          y: MARGIN + r * (slotH + GAP),
          width: slotW,
          height: slotH,
          aspectRatio: 'free',
          order: idx,
          zIndex: baseZ + idx,
          rotation: 0,
        })
      }
    }

    setSlots(newSlots)
    setSelectedSlotId(null)
    setSelectedFrameLayerId(null)
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
      rotation: node.rotation(),
    } : s))
  }

  // --- Pixel-level property update ---
  const updateSlotProp = (id: string, prop: 'x' | 'y' | 'width' | 'height' | 'rotation', value: number) => {
    setSlots(prev => prev.map(s => s.id === id ? { ...s, [prop]: value } : s))
  }

  // --- Aspect ratio preset ---
  const applyAspectRatio = (key: AspectKey) => {
    if (!selectedSlotId) return
    setSlots(prev => prev.map(s => {
      if (s.id !== selectedSlotId) return s
      const ratio = ASPECT_RATIOS[key]
      const newHeight = ratio ? Math.round(s.width / ratio) : s.height
      return { ...s, aspectRatio: key, height: newHeight }
    }))
  }

  // --- Frame layer upload ---
  const handleFrameLayerUpload = async (file: File) => {
    setUploadingFrame(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('name', file.name.replace(/\.[^.]+$/, ''))
      const res = await fetch(`/api/swit-layouts/${layout._id}/frame`, { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json()
      setFrameLayers(data.frameLayers)
    } catch {
      alert('이미지 업로드 실패')
    } finally {
      setUploadingFrame(false)
    }
  }

  const deleteFrameLayer = async (layerId: string) => {
    try {
      const res = await fetch(`/api/swit-layouts/${layout._id}/frame`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layerId }),
      })
      if (!res.ok) throw new Error('Delete failed')
      const data = await res.json()
      setFrameLayers(data.frameLayers)
      if (selectedFrameLayerId === layerId) setSelectedFrameLayerId(null)
    } catch {
      alert('레이어 삭제 실패')
    }
  }

  const duplicateSlot = () => {
    if (!selectedSlotId) return
    const src = slots.find(s => s.id === selectedSlotId)
    if (!src) return
    const offset = 20
    const newSlot: SwitSlot = {
      ...src,
      id: `slot-${Date.now()}`,
      x: src.x + offset,
      y: src.y + offset,
      order: slots.length,
      zIndex: getNextZIndex(),
    }
    setSlots(prev => [...prev, newSlot])
    // Copy test image if exists
    const tImg = testImages.get(selectedSlotId)
    if (tImg) setTestImages(prev => new Map(prev).set(newSlot.id, tImg))
    setSelectedSlotId(newSlot.id)
    setSelectedFrameLayerId(null)
  }

  const duplicateFrameLayer = (layerId: string) => {
    const src = frameLayers.find(l => l.id === layerId)
    if (!src) return
    const newLayer: SwitFrameLayer = {
      ...src,
      id: `layer-${Date.now()}`,
      name: `${src.name} 복사`,
      zIndex: getNextZIndex(),
    }
    setFrameLayers(prev => [...prev, newLayer])
    setSelectedFrameLayerId(newLayer.id)
    setSelectedSlotId(null)
  }

  const deleteSelectedSlot = () => {
    if (!selectedSlotId) return
    setTestImages(prev => { const n = new Map(prev); n.delete(selectedSlotId); return n })
    setSlots(prev => prev.filter(s => s.id !== selectedSlotId))
    setSelectedSlotId(null)
  }

  // --- Frame layer drag/transform handlers ---
  const onFrameLayerDragEnd = (layerId: string, x: number, y: number) => {
    setFrameLayers(prev => prev.map(l => l.id === layerId ? { ...l, x: x / scale, y: y / scale } : l))
  }

  const onFrameLayerTransformEnd = (layerId: string, node: Konva.Rect) => {
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    node.scaleX(1)
    node.scaleY(1)
    setFrameLayers(prev => prev.map(l => l.id === layerId ? {
      ...l,
      x: node.x() / scale,
      y: node.y() / scale,
      width: (node.width() * scaleX) / scale,
      height: (node.height() * scaleY) / scale,
      rotation: node.rotation(),
    } : l))
  }

  const updateFrameLayerProp = (id: string, prop: 'x' | 'y' | 'width' | 'height' | 'rotation' | 'opacity', value: number) => {
    setFrameLayers(prev => prev.map(l => l.id === id ? { ...l, [prop]: value } : l))
  }

  // Selected frame layer object
  const selectedFrameLayer = selectedFrameLayerId ? frameLayers.find(l => l.id === selectedFrameLayerId) : null

  const handleSave = async () => {
    setSaving(true)
    try { await onSave(slots, frameLayers, bgColor, bgCustomizable) } finally { setSaving(false) }
  }

  // --- Test image for slots ---
  const handleTestImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedSlotId) return
    const url = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => {
      setTestImages(prev => new Map(prev).set(selectedSlotId, img))
    }
    img.src = url
    e.target.value = ''
  }

  const removeTestImage = (slotId: string) => {
    setTestImages(prev => { const n = new Map(prev); n.delete(slotId); return n })
  }

  // --- Layer ordering ---
  const buildLayerList = (): LayerItem[] => {
    const items: LayerItem[] = [
      ...slots.map((s, i) => ({
        type: 'slot' as const, id: s.id, name: `슬롯 ${i + 1}`,
        zIndex: s.zIndex ?? 10, visible: true,
      })),
      ...frameLayers.map(l => ({
        type: 'frame' as const, id: l.id, name: l.name,
        zIndex: l.zIndex, visible: l.visible,
      })),
    ]
    items.sort((a, b) => b.zIndex - a.zIndex)
    return items
  }

  const moveLayer = (itemId: string, itemType: 'slot' | 'frame', direction: 'up' | 'down') => {
    const allItems = buildLayerList()
    const idx = allItems.findIndex(i => i.id === itemId && i.type === itemType)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= allItems.length) return
    const current = allItems[idx]
    const target = allItems[swapIdx]
    const newCurrentZ = target.zIndex
    const newTargetZ = current.zIndex
    setSlots(prev => prev.map(s => {
      if (s.id === current.id && current.type === 'slot') return { ...s, zIndex: newCurrentZ }
      if (s.id === target.id && target.type === 'slot') return { ...s, zIndex: newTargetZ }
      return s
    }))
    setFrameLayers(prev => prev.map(l => {
      if (l.id === current.id && current.type === 'frame') return { ...l, zIndex: newCurrentZ }
      if (l.id === target.id && target.type === 'frame') return { ...l, zIndex: newTargetZ }
      return l
    }))
  }

  const toggleFrameLayerVisibility = (layerId: string) => {
    setFrameLayers(prev => prev.map(l => l.id === layerId ? { ...l, visible: !l.visible } : l))
  }

  const selectLayer = (item: LayerItem) => {
    if (item.type === 'slot') { setSelectedSlotId(item.id); setSelectedFrameLayerId(null) }
    else { setSelectedFrameLayerId(item.id); setSelectedSlotId(null) }
  }

  // Drawing preview
  const drawPreview = drawing && Math.abs(drawing.w) > 5 && Math.abs(drawing.h) > 5
    ? {
        x: (drawing.w >= 0 ? drawing.x : drawing.x + drawing.w) * scale,
        y: (drawing.h >= 0 ? drawing.y : drawing.y + drawing.h) * scale,
        w: Math.abs(drawing.w) * scale,
        h: Math.abs(drawing.h) * scale,
      }
    : null

  // Z-ordered render items
  const renderItems = (() => {
    type RenderItem =
      | { type: 'slot'; slot: SwitSlot; index: number; zIndex: number }
      | { type: 'frame'; layer: SwitFrameLayer; zIndex: number }
    const items: RenderItem[] = [
      ...slots.map((slot, i) => ({ type: 'slot' as const, slot, index: i, zIndex: slot.zIndex ?? 10 })),
      ...frameLayers.filter(l => l.visible).map(layer => ({ type: 'frame' as const, layer, zIndex: layer.zIndex })),
    ]
    items.sort((a, b) => a.zIndex - b.zIndex)
    return items
  })()

  const layerList = buildLayerList()

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center bg-gray-50 rounded-xl p-3">
        {/* Grid layout presets */}
        <span className="text-xs font-semibold text-gray-500 shrink-0">그리드</span>
        {GRID_PRESETS.map(preset => (
          <button
            key={preset.label}
            onClick={() => {
              if (slots.length > 0 && !confirm(`기존 슬롯 ${slots.length}개를 ${preset.label} 그리드로 교체할까요?`)) return
              applyGridPreset(preset)
            }}
            className="px-2.5 py-1 text-xs rounded-lg border border-green-300 text-green-600 hover:bg-green-50 bg-white font-medium transition-colors"
          >
            {preset.label}
          </button>
        ))}

        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* Aspect ratio presets */}
        <span className="text-xs font-semibold text-gray-500 shrink-0">비율</span>
        {(Object.keys(ASPECT_RATIOS) as AspectKey[]).map(key => (
          <button
            key={key}
            onClick={() => applyAspectRatio(key)}
            disabled={!selectedSlotId}
            className={`px-2 py-1 text-xs rounded-lg border font-medium transition-colors ${
              selectedSlotId
                ? 'border-blue-300 text-blue-600 hover:bg-blue-50 bg-white'
                : 'border-gray-200 text-gray-300 cursor-not-allowed bg-white'
            }`}
          >
            {key}
          </button>
        ))}

        <div className="flex-1 min-w-[8px]" />

        {/* Image layer upload */}
        <label className={`px-3 py-1.5 text-xs rounded-xl font-semibold text-white cursor-pointer transition-colors ${
          uploadingFrame ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600'
        }`}>
          {uploadingFrame ? '업로드 중...' : '+ 이미지 레이어'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            disabled={uploadingFrame}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFrameLayerUpload(f); e.target.value = '' }}
          />
        </label>

        {selectedSlotId && (
          <>
            <button onClick={duplicateSlot}
              className="px-3 py-1.5 text-xs rounded-xl font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100">
              슬롯 복제
            </button>
            <button onClick={deleteSelectedSlot}
              className="px-3 py-1.5 text-xs rounded-xl font-semibold bg-red-100 text-red-600 hover:bg-red-200">
              슬롯 삭제
            </button>
          </>
        )}
        {selectedFrameLayerId && (
          <>
            <button onClick={() => duplicateFrameLayer(selectedFrameLayerId)}
              className="px-3 py-1.5 text-xs rounded-xl font-semibold bg-purple-50 text-purple-600 hover:bg-purple-100">
              레이어 복제
            </button>
            <button onClick={() => deleteFrameLayer(selectedFrameLayerId)}
              className="px-3 py-1.5 text-xs rounded-xl font-semibold bg-red-100 text-red-600 hover:bg-red-200">
              레이어 삭제
            </button>
            {frameLayers.find(l => l.id === selectedFrameLayerId && !(l.rotation && l.rotation !== 0)) && (
              <button
                onClick={() => {
                  setDetectTargetLayerId(selectedFrameLayerId)
                  setDetectedRegions([])
                  setSampledColor(null)
                  lastPickRef.current = null
                  setEditorMode('colorPick')
                }}
                disabled={editorMode === 'colorPick'}
                className={`px-3 py-1.5 text-xs rounded-xl font-semibold transition-colors ${
                  editorMode === 'colorPick'
                    ? 'bg-orange-500 text-white cursor-wait'
                    : 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                }`}
              >
                {editorMode === 'colorPick' ? '색상 클릭...' : '슬롯 감지'}
              </button>
            )}
          </>
        )}

        <button onClick={() => setPreviewMode(p => !p)}
          className={`px-3 py-1.5 text-xs rounded-xl font-semibold transition-colors ${
            previewMode
              ? 'bg-gray-800 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}>
          {previewMode ? '편집 모드' : '미리보기'}
        </button>

        <button onClick={handleSave} disabled={saving}
          className="px-4 py-1.5 text-xs rounded-xl font-semibold bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50">
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      <div className="flex gap-4">
        {/* Canvas Editor */}
        <div
          className={`overflow-hidden shrink-0 select-none ${
            previewMode
              ? 'border-2 border-transparent bg-gray-100 cursor-default'
              : `border-2 border-gray-200 bg-gray-200 ${editorMode === 'colorPick' ? 'cursor-cell' : 'cursor-crosshair'}`
          }`}
          style={{ width: DISPLAY_W, height: displayH }}
        >
          <Stage ref={stageRef} width={DISPLAY_W} height={displayH}
            onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
            <Layer>
              <Rect name="canvas-bg" x={0} y={0} width={DISPLAY_W} height={displayH} fill={bgColor} />

              {renderItems.map(item => {
                if (item.type === 'slot') {
                  const { slot } = item
                  const tImg = testImages.get(slot.id)
                  return (
                    <React.Fragment key={slot.id}>
                      {/* Test image fill */}
                      {tImg && (
                        <KonvaImage
                          image={tImg}
                          x={slot.x * scale}
                          y={slot.y * scale}
                          width={slot.width * scale}
                          height={slot.height * scale}
                          rotation={slot.rotation ?? 0}
                          listening={false}
                        />
                      )}
                      {/* Shimmer background for empty slots */}
                      {!tImg && !previewMode && (
                        <Rect
                          ref={node => {
                            if (node) shimmerRefs.current.set(slot.id, node)
                            else shimmerRefs.current.delete(slot.id)
                          }}
                          x={slot.x * scale}
                          y={slot.y * scale}
                          width={slot.width * scale}
                          height={slot.height * scale}
                          rotation={slot.rotation ?? 0}
                          fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                          fillLinearGradientEndPoint={{ x: slot.width * scale, y: 0 }}
                          fillLinearGradientColorStops={[
                            0, '#e5e7eb',
                            0.3, '#e5e7eb',
                            0.5, '#f3f4f6',
                            0.7, '#e5e7eb',
                            1, '#e5e7eb',
                          ]}
                          cornerRadius={4}
                          listening={false}
                        />
                      )}
                      {!previewMode && (
                        <Rect
                          ref={node => {
                            if (node) slotNodeRefs.current.set(slot.id, node)
                            else slotNodeRefs.current.delete(slot.id)
                          }}
                          x={slot.x * scale}
                          y={slot.y * scale}
                          width={slot.width * scale}
                          height={slot.height * scale}
                          rotation={slot.rotation ?? 0}
                          fill="transparent"
                          stroke={selectedSlotId === slot.id ? '#3b82f6' : '#93c5fd'}
                          strokeWidth={selectedSlotId === slot.id ? 2 : 1}
                          draggable
                          onClick={() => { setSelectedSlotId(slot.id); setSelectedFrameLayerId(null) }}
                          onTap={() => { setSelectedSlotId(slot.id); setSelectedFrameLayerId(null) }}
                          onDragEnd={e => onSlotDragEnd(slot.id, e.target.x(), e.target.y())}
                          onTransformEnd={e => onSlotTransformEnd(slot.id, e.target as Konva.Rect)}
                        />
                      )}
                    </React.Fragment>
                  )
                } else {
                  const { layer } = item
                  const img = frameImages.get(layer.id)
                  if (!img) return null
                  const lx = (layer.x ?? 0) * scale
                  const ly = (layer.y ?? 0) * scale
                  const lw = (layer.width ?? layout.canvasWidth) * scale
                  const lh = (layer.height ?? layout.canvasHeight) * scale
                  const isSelectedFrame = selectedFrameLayerId === layer.id
                  return (
                    <React.Fragment key={layer.id}>
                      <KonvaImage image={img}
                        x={lx} y={ly} width={lw} height={lh}
                        rotation={layer.rotation ?? 0}
                        opacity={layer.opacity} listening={false} />
                      {/* Interaction rect — only interactive when this layer is selected */}
                      {isSelectedFrame && !previewMode && (
                        <Rect
                          ref={node => {
                            if (node) frameNodeRefs.current.set(layer.id, node)
                            else frameNodeRefs.current.delete(layer.id)
                          }}
                          x={lx} y={ly} width={lw} height={lh}
                          rotation={layer.rotation ?? 0}
                          fill="transparent"
                          stroke="#a855f7"
                          strokeWidth={2}
                          draggable
                          onDragEnd={e => onFrameLayerDragEnd(layer.id, e.target.x(), e.target.y())}
                          onTransformEnd={e => onFrameLayerTransformEnd(layer.id, e.target as Konva.Rect)}
                        />
                      )}
                    </React.Fragment>
                  )
                }
              })}

              {/* Slot labels */}
              {!previewMode && slots.map((slot, i) => (
                <Text key={`label-${slot.id}`}
                  x={slot.x * scale + 4} y={slot.y * scale + 4}
                  text={`${i + 1}`} fontSize={11}
                  fill={selectedSlotId === slot.id ? '#1d4ed8' : '#3b82f6'}
                  listening={false} />
              ))}

              {!previewMode && drawPreview && (
                <Rect x={drawPreview.x} y={drawPreview.y} width={drawPreview.w} height={drawPreview.h}
                  fill="rgba(59,130,246,0.15)" stroke="#3b82f6" strokeWidth={1.5} dash={[6, 4]} listening={false} />
              )}

              {/* Detected region previews */}
              {!previewMode && detectedRegions.map((r, i) => (
                <Rect key={`detected-${i}`}
                  x={r.x * scale} y={r.y * scale}
                  width={r.width * scale} height={r.height * scale}
                  fill="rgba(251,146,60,0.15)" stroke="#f97316" strokeWidth={2}
                  dash={[8, 4]} listening={false} />
              ))}

              {!previewMode && (
                <Transformer ref={trRef} keepRatio={shiftHeld} rotateEnabled={true}
                  rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
                  boundBoxFunc={(_, newBox) => (newBox.width < 20 || newBox.height < 20) ? _ : newBox} />
              )}
            </Layer>
          </Stage>
        </div>

        {/* Right Panel: Layer list + Slot properties */}
        <div className="flex-1 min-w-[220px] space-y-3">
          {/* Slot Detection Panel */}
          {(editorMode === 'colorPick' || detectedRegions.length > 0) && (
            <div className="bg-white rounded-xl border border-orange-200 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-orange-700">슬롯 감지</span>
                {sampledColor && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded border border-gray-200" style={{ backgroundColor: sampledColor }} />
                    <span className="text-[10px] text-gray-500 tabular-nums">{sampledColor}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] text-gray-400 font-semibold">색상 허용 범위: {colorTolerance}</label>
                <input type="range" min={5} max={80} step={5} value={colorTolerance}
                  onChange={e => setColorTolerance(Number(e.target.value))}
                  className="w-full h-1.5 accent-orange-500" />
              </div>

              {editorMode === 'colorPick' && (
                <p className="text-[10px] text-orange-600 font-semibold text-center py-1">
                  프레임 이미지에서 색상을 클릭하세요
                </p>
              )}

              {detectedRegions.length > 0 && (
                <>
                  <p className="text-xs text-gray-700">{detectedRegions.length}개 영역 감지됨</p>
                  {detectTargetLayerId && (
                    <button onClick={() => {
                      setDetectedRegions([])
                      setSampledColor(null)
                      lastPickRef.current = null
                      setEditorMode('colorPick')
                    }}
                      className="w-full px-2 py-1.5 text-[10px] rounded-lg bg-orange-50 text-orange-600 font-semibold hover:bg-orange-100 transition-colors">
                      다시 감지
                    </button>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => {
                      setDetectedRegions([])
                      setSampledColor(null)
                      setDetectTargetLayerId(null)
                      lastPickRef.current = null
                    }}
                      className="flex-1 px-2 py-1.5 text-[10px] rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold">
                      취소
                    </button>
                    <button onClick={confirmDetectedSlots}
                      className="flex-1 px-2 py-1.5 text-[10px] rounded-lg bg-orange-500 text-white hover:bg-orange-600 font-semibold">
                      슬롯 생성
                    </button>
                  </div>
                </>
              )}

              {detectedRegions.length === 0 && editorMode !== 'colorPick' && sampledColor && (
                <p className="text-[10px] text-gray-400 text-center py-1">
                  감지된 영역이 없습니다. 다른 색상을 클릭하거나 허용 범위를 조정하세요.
                </p>
              )}
            </div>
          )}

          {/* Slot Properties Panel */}
          {selectedSlot && (
            <div className="bg-white rounded-xl border border-blue-200 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-700">슬롯 속성</span>
                <div className="flex gap-1">
                  {/* Test image */}
                  <label className="px-2 py-1 text-[10px] rounded-lg bg-purple-50 text-purple-600 font-semibold cursor-pointer hover:bg-purple-100 transition-colors">
                    {testImages.has(selectedSlot.id) ? '이미지 변경' : '테스트 이미지'}
                    <input ref={testImageInputRef} type="file" accept="image/*" className="hidden"
                      onChange={handleTestImageUpload} />
                  </label>
                  {testImages.has(selectedSlot.id) && (
                    <button onClick={() => removeTestImage(selectedSlot.id)}
                      className="px-2 py-1 text-[10px] rounded-lg bg-gray-100 text-gray-500 font-semibold hover:bg-gray-200">
                      제거
                    </button>
                  )}
                </div>
              </div>

              {/* Position */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gray-400 font-semibold">X (px)</label>
                  <input type="number" value={Math.round(selectedSlot.x)}
                    onChange={e => updateSlotProp(selectedSlot.id, 'x', Number(e.target.value))}
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:border-blue-400 focus:bg-white outline-none tabular-nums" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 font-semibold">Y (px)</label>
                  <input type="number" value={Math.round(selectedSlot.y)}
                    onChange={e => updateSlotProp(selectedSlot.id, 'y', Number(e.target.value))}
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:border-blue-400 focus:bg-white outline-none tabular-nums" />
                </div>
              </div>

              {/* Size */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gray-400 font-semibold">Width (px)</label>
                  <input type="number" value={Math.round(selectedSlot.width)} min={1}
                    onChange={e => updateSlotProp(selectedSlot.id, 'width', Math.max(1, Number(e.target.value)))}
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:border-blue-400 focus:bg-white outline-none tabular-nums" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 font-semibold">Height (px)</label>
                  <input type="number" value={Math.round(selectedSlot.height)} min={1}
                    onChange={e => updateSlotProp(selectedSlot.id, 'height', Math.max(1, Number(e.target.value)))}
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:border-blue-400 focus:bg-white outline-none tabular-nums" />
                </div>
              </div>

              {/* Rotation */}
              <div>
                <label className="text-[10px] text-gray-400 font-semibold">Rotation (°)</label>
                <div className="flex items-center gap-2">
                  <input type="number" value={Math.round(selectedSlot.rotation ?? 0)} step={1}
                    onChange={e => updateSlotProp(selectedSlot.id, 'rotation', Number(e.target.value) % 360)}
                    className="w-20 px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:border-blue-400 focus:bg-white outline-none tabular-nums" />
                  <div className="flex gap-1">
                    {[0, 45, 90, 180, 270].map(deg => (
                      <button key={deg} onClick={() => updateSlotProp(selectedSlot.id, 'rotation', deg)}
                        className={`px-1.5 py-0.5 text-[10px] rounded font-semibold transition-colors ${
                          Math.round(selectedSlot.rotation ?? 0) === deg
                            ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}>
                        {deg}°
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="text-[10px] text-gray-400">
                비율: {selectedSlot.aspectRatio} · zIndex: {selectedSlot.zIndex}
              </div>
            </div>
          )}

          {/* Frame Layer Properties Panel */}
          {selectedFrameLayer && (
            <div className="bg-white rounded-xl border border-purple-200 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-700">레이어 속성</span>
                <span className="text-[10px] text-gray-400 truncate ml-2">{selectedFrameLayer.name}</span>
              </div>

              {/* Position */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gray-400 font-semibold">X (px)</label>
                  <input type="number" value={Math.round(selectedFrameLayer.x ?? 0)}
                    onChange={e => updateFrameLayerProp(selectedFrameLayer.id, 'x', Number(e.target.value))}
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:border-purple-400 focus:bg-white outline-none tabular-nums" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 font-semibold">Y (px)</label>
                  <input type="number" value={Math.round(selectedFrameLayer.y ?? 0)}
                    onChange={e => updateFrameLayerProp(selectedFrameLayer.id, 'y', Number(e.target.value))}
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:border-purple-400 focus:bg-white outline-none tabular-nums" />
                </div>
              </div>

              {/* Size */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gray-400 font-semibold">Width (px)</label>
                  <input type="number" value={Math.round(selectedFrameLayer.width ?? layout.canvasWidth)} min={1}
                    onChange={e => updateFrameLayerProp(selectedFrameLayer.id, 'width', Math.max(1, Number(e.target.value)))}
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:border-purple-400 focus:bg-white outline-none tabular-nums" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 font-semibold">Height (px)</label>
                  <input type="number" value={Math.round(selectedFrameLayer.height ?? layout.canvasHeight)} min={1}
                    onChange={e => updateFrameLayerProp(selectedFrameLayer.id, 'height', Math.max(1, Number(e.target.value)))}
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:border-purple-400 focus:bg-white outline-none tabular-nums" />
                </div>
              </div>

              {/* Rotation + Opacity */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gray-400 font-semibold">Rotation (°)</label>
                  <input type="number" value={Math.round(selectedFrameLayer.rotation ?? 0)} step={1}
                    onChange={e => updateFrameLayerProp(selectedFrameLayer.id, 'rotation', Number(e.target.value) % 360)}
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:border-purple-400 focus:bg-white outline-none tabular-nums" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 font-semibold">Opacity</label>
                  <input type="number" value={selectedFrameLayer.opacity} step={0.1} min={0} max={1}
                    onChange={e => updateFrameLayerProp(selectedFrameLayer.id, 'opacity', Math.min(1, Math.max(0, Number(e.target.value))))}
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:border-purple-400 focus:bg-white outline-none tabular-nums" />
                </div>
              </div>

              {/* Quick: fit to canvas */}
              <button onClick={() => {
                setFrameLayers(prev => prev.map(l => l.id === selectedFrameLayer.id
                  ? { ...l, x: 0, y: 0, width: layout.canvasWidth, height: layout.canvasHeight, rotation: 0 }
                  : l))
              }}
                className="w-full px-2 py-1.5 text-[10px] rounded-lg bg-purple-50 text-purple-600 font-semibold hover:bg-purple-100 transition-colors">
                캔버스에 맞추기
              </button>

              <div className="text-[10px] text-gray-400">
                zIndex: {selectedFrameLayer.zIndex}
              </div>
            </div>
          )}

          {/* Layer Panel */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-200 bg-gray-100">
              <span className="text-xs font-bold text-gray-700">레이어</span>
              <span className="text-xs text-gray-400 ml-1.5">{layerList.length}개</span>
            </div>

            <div className="divide-y divide-gray-100 max-h-[320px] overflow-y-auto">
              {layerList.map((item, idx) => {
                const isSelected = (item.type === 'slot' && selectedSlotId === item.id) ||
                                   (item.type === 'frame' && selectedFrameLayerId === item.id)
                const hasTestImg = item.type === 'slot' && testImages.has(item.id)
                return (
                  <div key={`${item.type}-${item.id}`} onClick={() => selectLayer(item)}
                    className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}>
                    {/* Up/Down */}
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button onClick={e => { e.stopPropagation(); moveLayer(item.id, item.type, 'up') }}
                        disabled={idx === 0}
                        className="text-[10px] text-gray-400 hover:text-gray-700 disabled:opacity-30 leading-none">▲</button>
                      <button onClick={e => { e.stopPropagation(); moveLayer(item.id, item.type, 'down') }}
                        disabled={idx === layerList.length - 1}
                        className="text-[10px] text-gray-400 hover:text-gray-700 disabled:opacity-30 leading-none">▼</button>
                    </div>

                    {/* Visibility */}
                    {item.type === 'frame' ? (
                      <button onClick={e => { e.stopPropagation(); toggleFrameLayerVisibility(item.id) }}
                        className={`text-sm shrink-0 w-5 text-center ${item.visible ? 'text-blue-500' : 'text-gray-300'}`}>
                        {item.visible ? '◉' : '○'}
                      </button>
                    ) : (
                      <span className="text-sm shrink-0 w-5 text-center text-blue-400">◻</span>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${
                          item.type === 'slot' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
                        }`}>
                          {item.type === 'slot' ? '슬롯' : '이미지'}
                        </span>
                        <span className={`text-xs truncate ${isSelected ? 'text-blue-700 font-semibold' : 'text-gray-700'}`}>
                          {item.name}
                        </span>
                        {hasTestImg && (
                          <span className="text-[10px] text-purple-400 shrink-0">IMG</span>
                        )}
                      </div>
                    </div>

                    {/* Duplicate */}
                    <button onClick={e => {
                      e.stopPropagation()
                      if (item.type === 'slot') {
                        setSelectedSlotId(item.id)
                        setTimeout(() => duplicateSlot(), 0)
                      } else {
                        duplicateFrameLayer(item.id)
                      }
                    }}
                      className="text-[10px] text-gray-300 hover:text-gray-600 shrink-0 transition-colors" title="복제">
                      ⧉
                    </button>

                    <span className="text-[10px] text-gray-400 shrink-0 tabular-nums">z{item.zIndex}</span>
                  </div>
                )
              })}

              {layerList.length === 0 && (
                <div className="px-3 py-4 text-xs text-gray-400 text-center">레이어가 없습니다</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Background Color Settings */}
      <div className="flex items-center gap-4 bg-gray-50 rounded-xl p-3">
        <span className="text-xs font-semibold text-gray-500 shrink-0">배경색</span>
        <div className="flex items-center gap-2">
          <label className="relative cursor-pointer">
            <div
              className="w-7 h-7 rounded-full border-2 border-gray-200 shadow-sm"
              style={{ backgroundColor: bgColor }}
            />
            <input
              type="color"
              value={bgColor}
              onChange={e => setBgColor(e.target.value.toUpperCase())}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
          </label>
          <span className="text-xs text-gray-400 tabular-nums">{bgColor}</span>
        </div>
        <div className="w-px h-5 bg-gray-200" />
        <label className="flex items-center gap-2 cursor-pointer">
          <div className="relative">
            <input
              type="checkbox"
              checked={bgCustomizable}
              onChange={e => setBgCustomizable(e.target.checked)}
              className="sr-only"
            />
            <div className={`w-9 h-5 rounded-full transition-colors ${bgCustomizable ? 'bg-blue-500' : 'bg-gray-300'}`} />
            <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${bgCustomizable ? 'translate-x-4' : ''}`} />
          </div>
          <span className="text-xs font-semibold text-gray-600">클라이언트 변경 허용</span>
        </label>
      </div>

      {/* Info */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>슬롯 {slots.length}개 · 이미지 레이어 {frameLayers.length}개 · Shift+리사이즈로 비율 고정</span>
        <span className="text-gray-400">{layout.printSize} · {layout.canvasWidth}×{layout.canvasHeight}px</span>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-xs w-full mx-4 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-gray-900">삭제 확인</h3>
            <p className="text-sm text-gray-600">
              <span className="font-semibold">{deleteConfirm.name}</span>을(를) 삭제하시겠습니까?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 text-sm rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold">
                취소
              </button>
              <button onClick={() => {
                if (deleteConfirm.type === 'slot') {
                  setTestImages(prev => { const n = new Map(prev); n.delete(deleteConfirm.id); return n })
                  setSlots(prev => prev.filter(s => s.id !== deleteConfirm.id))
                  setSelectedSlotId(null)
                } else {
                  deleteFrameLayer(deleteConfirm.id)
                }
                setDeleteConfirm(null)
              }}
                className="flex-1 px-4 py-2 text-sm rounded-xl bg-red-500 text-white hover:bg-red-600 font-semibold">
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
