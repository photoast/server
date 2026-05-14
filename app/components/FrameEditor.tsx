'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Stage, Layer, Rect, Image as KonvaImage, Transformer, Text, Line, Circle, Group } from 'react-konva'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { PhotoSlot, FrameLayout, FrameLayer } from '@/lib/types'
import { detectColorRegions, floodFillErase, brushErase } from '@/lib/imageProcessing'
import type { DetectedRegion } from '@/lib/imageProcessing'

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


interface Props {
  layout: FrameLayout
  onSave: (slots: PhotoSlot[], frameLayers: FrameLayer[], bgColor: string, bgCustomizable: boolean) => Promise<void>
}

type LayerItem =
  | { type: 'slot'; id: string; name: string; zIndex: number; visible: boolean }
  | { type: 'frame'; id: string; name: string; zIndex: number; visible: boolean }

export default function FrameEditor({ layout, onSave }: Props) {
  const [slots, setSlots] = useState<PhotoSlot[]>(layout.slots)
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [selectedFrameLayerId, setSelectedFrameLayerId] = useState<string | null>(null)
  const [drawing, setDrawing] = useState<DrawingRect | null>(null)
  const [frameLayers, setFrameLayers] = useState<FrameLayer[]>(layout.frameLayers || [])
  const [frameImages, setFrameImages] = useState<Map<string, HTMLImageElement>>(new Map())
  const [testImages, setTestImages] = useState<Map<string, HTMLImageElement>>(new Map())
  const [uploadingFrame, setUploadingFrame] = useState(false)
  const [saving, setSaving] = useState(false)
  const [shiftHeld, setShiftHeld] = useState(false)
  const [bgColor, setBgColor] = useState(layout.backgroundColor || '#FFFFFF')
  const [bgCustomizable, setBgCustomizable] = useState(layout.backgroundColorCustomizable ?? true)

  // --- Undo / Redo ---
  type Snapshot = { slots: PhotoSlot[]; frameLayers: FrameLayer[] }
  const undoStack = useRef<Snapshot[]>([])
  const redoStack = useRef<Snapshot[]>([])
  const lastSnapshotRef = useRef<string>(JSON.stringify({ slots: layout.slots, frameLayers: layout.frameLayers || [] }))

  const pushUndo = useCallback(() => {
    const current: Snapshot = { slots, frameLayers }
    const key = JSON.stringify(current)
    if (key === lastSnapshotRef.current) return // 변화 없으면 스킵
    undoStack.current.push(JSON.parse(lastSnapshotRef.current))
    if (undoStack.current.length > 50) undoStack.current.shift()
    redoStack.current = []
    lastSnapshotRef.current = key
  }, [slots, frameLayers])

  // slots/frameLayers 변경 감지하여 자동으로 undo 스택 기록
  const prevSlotsRef = useRef(slots)
  const prevLayersRef = useRef(frameLayers)
  useEffect(() => {
    if (prevSlotsRef.current !== slots || prevLayersRef.current !== frameLayers) {
      pushUndo()
      prevSlotsRef.current = slots
      prevLayersRef.current = frameLayers
    }
  }, [slots, frameLayers, pushUndo])

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return
    const prev = undoStack.current.pop()!
    redoStack.current.push(JSON.parse(lastSnapshotRef.current))
    lastSnapshotRef.current = JSON.stringify(prev)
    prevSlotsRef.current = prev.slots
    prevLayersRef.current = prev.frameLayers
    setSlots(prev.slots)
    setFrameLayers(prev.frameLayers)
  }, [])

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return
    const next = redoStack.current.pop()!
    undoStack.current.push(JSON.parse(lastSnapshotRef.current))
    lastSnapshotRef.current = JSON.stringify(next)
    prevSlotsRef.current = next.slots
    prevLayersRef.current = next.frameLayers
    setSlots(next.slots)
    setFrameLayers(next.frameLayers)
  }, [])

  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'slot' | 'frame'; id: string; name: string } | null>(null)
  const [layerDeleteConfirm, setLayerDeleteConfirm] = useState<{ type: 'slot' | 'frame'; id: string; name: string } | null>(null)

  // Slot detection from frame layer
  const [editorMode, setEditorMode] = useState<'draw' | 'colorPick'>('draw')
  const [detectTargetLayerId, setDetectTargetLayerId] = useState<string | null>(null)
  const [colorTolerance, setColorTolerance] = useState(30)
  const [detectedRegions, setDetectedRegions] = useState<DetectedRegion[]>([])
  const [sampledColor, setSampledColor] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState(false)
  const [showGrid, setShowGrid] = useState(false)

  // --- Background eraser tool ---
  type EraserMode = 'wand' | 'brush'
  const [eraserActive, setEraserActive] = useState(false)
  const [eraserMode, setEraserMode] = useState<EraserMode>('wand')
  const [eraserTargetLayerId, setEraserTargetLayerId] = useState<string | null>(null)
  const [eraserTolerance, setEraserTolerance] = useState(30)
  const [eraserBrushSize, setEraserBrushSize] = useState(20)
  const [eraserColor, setEraserColor] = useState<{ r: number; g: number; b: number } | null>(null)
  const [eraserColorHex, setEraserColorHex] = useState<string | null>(null)
  const [eraserPicking, setEraserPicking] = useState(false) // 스포이드 모드
  const [eraserSaving, setEraserSaving] = useState(false)
  const [eraserCursorPos, setEraserCursorPos] = useState<{ x: number; y: number } | null>(null)
  const eraserCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const eraserOriginalRef = useRef<HTMLCanvasElement | null>(null)
  const eraserImageRef = useRef<HTMLImageElement | null>(null)
  const [eraserPreviewImg, setEraserPreviewImg] = useState<HTMLImageElement | null>(null)
  const eraserBrushingRef = useRef(false)

  // --- Alignment guides ---
  type AlignGuide = { orient: 'V' | 'H'; pos: number }
  const [alignGuides, setAlignGuides] = useState<AlignGuide[]>([])
  const alignTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const SNAP_THRESH = 4

  const computeAlignGuides = (movingId: string, mx: number, my: number, mw: number, mh: number): AlignGuide[] => {
    const guides: AlignGuide[] = []
    const edges = {
      left: mx, centerX: mx + mw / 2, right: mx + mw,
      top: my, centerY: my + mh / 2, bottom: my + mh,
    }
    for (const s of slots) {
      if (s.id === movingId) continue
      const refs = {
        left: s.x, centerX: s.x + s.width / 2, right: s.x + s.width,
        top: s.y, centerY: s.y + s.height / 2, bottom: s.y + s.height,
      }
      for (const ek of ['left', 'centerX', 'right'] as const) {
        for (const rk of ['left', 'centerX', 'right'] as const) {
          if (Math.abs(edges[ek] - refs[rk]) < SNAP_THRESH) {
            guides.push({ orient: 'V', pos: refs[rk] })
          }
        }
      }
      for (const ek of ['top', 'centerY', 'bottom'] as const) {
        for (const rk of ['top', 'centerY', 'bottom'] as const) {
          if (Math.abs(edges[ek] - refs[rk]) < SNAP_THRESH) {
            guides.push({ orient: 'H', pos: refs[rk] })
          }
        }
      }
    }
    const seen = new Set<string>()
    return guides.filter(g => {
      const k = `${g.orient}:${g.pos}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  }

  const showGuidesTemporarily = (guides: AlignGuide[]) => {
    setAlignGuides(guides)
    if (alignTimerRef.current) clearTimeout(alignTimerRef.current)
    alignTimerRef.current = setTimeout(() => setAlignGuides([]), 600)
  }

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
      // Undo: Ctrl+Z / Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
        return
      }
      // Redo: Ctrl+Shift+Z / Cmd+Shift+Z / Ctrl+Y
      if (((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) || ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
        e.preventDefault()
        redo()
        return
      }

      if (e.key === 'Escape' && eraserActive) {
        setEraserActive(false)
        setEraserTargetLayerId(null)
        setEraserColor(null)
        setEraserColorHex(null)
        setEraserPicking(false)
        setEraserPreviewImg(null)
        setEraserCursorPos(null)
        eraserCanvasRef.current = null
        eraserOriginalRef.current = null
        eraserImageRef.current = null
        eraserBrushingRef.current = false
        e.preventDefault()
        return
      }

      if (e.key === 'Escape' && (editorMode === 'colorPick' || detectedRegions.length > 0)) {
        setEditorMode('draw')
        setDetectedRegions([])
        setSampledColor(null)
        setDetectTargetLayerId(null)
        lastPickRef.current = null
        e.preventDefault()
        return
      }

      // Ignore if typing in an input
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      // Arrow keys: 1px nudge (Shift = 10px)
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        const step = e.shiftKey ? 10 : 1
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        if (selectedSlotId) {
          const s = slots.find(s => s.id === selectedSlotId)
          if (s) showGuidesTemporarily(computeAlignGuides(s.id, s.x + dx, s.y + dy, s.width, s.height))
          setSlots(prev => prev.map(s => s.id === selectedSlotId ? { ...s, x: s.x + dx, y: s.y + dy } : s))
          e.preventDefault()
        } else if (selectedFrameLayerId) {
          setFrameLayers(prev => prev.map(l => l.id === selectedFrameLayerId
            ? { ...l, x: (l.x ?? 0) + dx, y: (l.y ?? 0) + dy } : l))
          e.preventDefault()
        }
        return
      }

      if (e.key !== 'Backspace' && e.key !== 'Delete') return

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
  }, [selectedSlotId, selectedFrameLayerId, slots, frameLayers, editorMode, detectedRegions.length, undo, redo, eraserActive])

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
    const newSlots: PhotoSlot[] = detectedRegions.map((r, i) => ({
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
      const newSlot: PhotoSlot = {
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
      const newSlot: PhotoSlot = {
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
    const newSlots: PhotoSlot[] = []

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
  const onSlotDragMove = (id: string, x: number, y: number) => {
    const s = slots.find(s => s.id === id)
    if (!s) return
    setAlignGuides(computeAlignGuides(id, x / scale, y / scale, s.width, s.height))
  }

  const onSlotDragEnd = (id: string, x: number, y: number) => {
    setAlignGuides([])
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
      const res = await fetch(`/api/layouts/${layout._id}/frame`, { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json()
      setFrameLayers(data.frameLayers)
    } catch {
      alert('이미지 업로드 실패')
    } finally {
      setUploadingFrame(false)
    }
  }

  // --- Instagram frame generation ---
  const [igForm, setIgForm] = useState({ username: '', qrUrl: '', caption: '', likesText: '', qrLabel: '' })
  const [igGenerating, setIgGenerating] = useState(false)
  const [showIgDialog, setShowIgDialog] = useState(false)

  const handleGenerateInstagramFrame = async () => {
    if (!igForm.username.trim()) return
    setIgGenerating(true)
    try {
      const res = await fetch(`/api/layouts/${layout._id}/instagram-frame`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: igForm.username.trim(),
          qrUrl: igForm.qrUrl.trim() || undefined,
          caption: igForm.caption.trim() || undefined,
          likesText: igForm.likesText.trim() || undefined,
          qrLabel: igForm.qrLabel.trim() || undefined,
        }),
      })
      if (!res.ok) throw new Error('Generation failed')
      const data = await res.json()
      setFrameLayers(data.frameLayers)
      setShowIgDialog(false)
    } catch {
      alert('인스타그램 프레임 생성 실패')
    } finally {
      setIgGenerating(false)
    }
  }

  // --- Text overlay tool ---
  const TEXT_COLORS = ['#FFFFFF', '#000000', '#ED4956', '#E1306C', '#833AB4', '#405DE6', '#5B51D8', '#00B2FF', '#58C322', '#FCAF45', '#F77737', '#FD1D1D']
  const [showTextDialog, setShowTextDialog] = useState(false)
  const [textGenerating, setTextGenerating] = useState(false)
  const [textForm, setTextForm] = useState({
    text: '',
    fontSize: 64,
    color: '#FFFFFF',
    bgStyle: 'none' as 'none' | 'solid' | 'translucent',
    bgColor: '#000000',
    bold: true,
  })

  const handleGenerateText = async () => {
    if (!textForm.text.trim()) return
    setTextGenerating(true)
    try {
      const res = await fetch(`/api/layouts/${layout._id}/text-overlay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(textForm),
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setFrameLayers(data.frameLayers)
      setShowTextDialog(false)
      setTextForm(f => ({ ...f, text: '' }))
    } catch {
      alert('텍스트 생성 실패')
    } finally {
      setTextGenerating(false)
    }
  }

  const deleteFrameLayer = async (layerId: string) => {
    try {
      const res = await fetch(`/api/layouts/${layout._id}/frame`, {
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
    const newSlot: PhotoSlot = {
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
    const newLayer: FrameLayer = {
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

  // --- Background Eraser Tool ---
  const startEraser = useCallback((layerId: string) => {
    const layer = frameLayers.find(l => l.id === layerId)
    const img = frameImages.get(layerId)
    if (!layer || !img) return

    // Create off-screen canvases
    const nw = img.naturalWidth
    const nh = img.naturalHeight
    const canvas = document.createElement('canvas')
    canvas.width = nw
    canvas.height = nh
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(img, 0, 0)

    // Keep a copy of original for undo
    const original = document.createElement('canvas')
    original.width = nw
    original.height = nh
    original.getContext('2d')!.drawImage(img, 0, 0)

    eraserCanvasRef.current = canvas
    eraserOriginalRef.current = original
    eraserImageRef.current = img
    setEraserTargetLayerId(layerId)
    setEraserActive(true)
    setEraserPicking(true) // 스포이드로 시작
    setEraserColor(null)
    setEraserColorHex(null)
    setEraserCursorPos(null)
    eraserBrushingRef.current = false

    // Create initial preview image
    const previewImg = new window.Image()
    previewImg.src = canvas.toDataURL('image/png')
    previewImg.onload = () => setEraserPreviewImg(previewImg)
  }, [frameLayers, frameImages])

  const updateEraserPreview = useCallback(() => {
    const canvas = eraserCanvasRef.current
    if (!canvas) return
    const img = new window.Image()
    img.src = canvas.toDataURL('image/png')
    img.onload = () => setEraserPreviewImg(img)
  }, [])

  // Helper: get native image coords from pointer position
  const getEraserImageCoords = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (!eraserTargetLayerId) return null
    const canvas = eraserCanvasRef.current
    if (!canvas) return null
    const layer = frameLayers.find(l => l.id === eraserTargetLayerId)
    if (!layer) return null

    const pos = e.target.getStage()!.getPointerPosition()!
    const cp = { x: pos.x / scale, y: pos.y / scale }
    const lx = layer.x ?? 0
    const ly = layer.y ?? 0
    const lw = layer.width ?? layout.canvasWidth
    const lh = layer.height ?? layout.canvasHeight
    const nw = canvas.width
    const nh = canvas.height

    const ix = ((cp.x - lx) / lw) * nw
    const iy = ((cp.y - ly) / lh) * nh
    if (ix < 0 || iy < 0 || ix >= nw || iy >= nh) return null
    return { ix, iy, lw, nw, nh, canvas }
  }, [eraserTargetLayerId, frameLayers, scale, layout])

  const sampleColorAt = useCallback((canvas: HTMLCanvasElement, ix: number, iy: number) => {
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    const pixel = ctx.getImageData(Math.round(ix), Math.round(iy), 1, 1).data
    if (pixel[3] < 10) return null // transparent
    const color = { r: pixel[0], g: pixel[1], b: pixel[2] }
    const hex = `#${pixel[0].toString(16).padStart(2, '0')}${pixel[1].toString(16).padStart(2, '0')}${pixel[2].toString(16).padStart(2, '0')}`.toUpperCase()
    return { color, hex }
  }, [])

  const handleEraserCanvasClick = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (!eraserActive) return
    const coords = getEraserImageCoords(e)
    if (!coords) return
    const { ix, iy, lw, nw, nh, canvas } = coords
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!

    // --- 스포이드 모드: 색상만 선택하고 돌아감 ---
    if (eraserPicking) {
      const sampled = sampleColorAt(canvas, ix, iy)
      if (sampled) {
        setEraserColor(sampled.color)
        setEraserColorHex(sampled.hex)
        setEraserPicking(false) // 색상 선택 완료 → 지우기 모드로 전환
      }
      return
    }

    // --- Magic Wand: 클릭 즉시 연결 영역 제거 ---
    if (eraserMode === 'wand') {
      if (!eraserColor) {
        // 색상 미선택 → 스포이드로 전환
        setEraserPicking(true)
        return
      }
      const imageData = ctx.getImageData(0, 0, nw, nh)
      floodFillErase(imageData, ix, iy, eraserTolerance)
      ctx.putImageData(imageData, 0, 0)
      updateEraserPreview()
      return
    }

    // --- Brush: 드래그 시작 ---
    if (eraserMode === 'brush') {
      if (!eraserColor) {
        setEraserPicking(true)
        return
      }
      eraserBrushingRef.current = true
      const brushNativeRadius = (eraserBrushSize / lw) * nw / 2
      const imageData = ctx.getImageData(0, 0, nw, nh)
      brushErase(imageData, ix, iy, brushNativeRadius, eraserColor.r, eraserColor.g, eraserColor.b, eraserTolerance)
      ctx.putImageData(imageData, 0, 0)
      updateEraserPreview()
    }
  }, [eraserActive, eraserPicking, eraserMode, eraserTolerance, eraserBrushSize, eraserColor, getEraserImageCoords, sampleColorAt, updateEraserPreview])

  const handleEraserMouseMove = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (!eraserActive || !eraserTargetLayerId) return
    const pos = e.target.getStage()!.getPointerPosition()
    if (!pos) return

    // Update cursor position for brush preview
    setEraserCursorPos({ x: pos.x, y: pos.y })

    // Brush drag erase
    if (eraserMode === 'brush' && eraserBrushingRef.current && eraserColor) {
      const canvas = eraserCanvasRef.current
      if (!canvas) return
      const layer = frameLayers.find(l => l.id === eraserTargetLayerId)
      if (!layer) return

      const cp = { x: pos.x / scale, y: pos.y / scale }
      const lx = layer.x ?? 0
      const ly = layer.y ?? 0
      const lw = layer.width ?? layout.canvasWidth
      const lh = layer.height ?? layout.canvasHeight
      const nw = canvas.width
      const nh = canvas.height
      const ix = ((cp.x - lx) / lw) * nw
      const iy = ((cp.y - ly) / lh) * nh
      if (ix < 0 || iy < 0 || ix >= nw || iy >= nh) return

      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      const brushNativeRadius = (eraserBrushSize / lw) * nw / 2
      const imageData = ctx.getImageData(0, 0, nw, nh)
      brushErase(imageData, ix, iy, brushNativeRadius, eraserColor.r, eraserColor.g, eraserColor.b, eraserTolerance)
      ctx.putImageData(imageData, 0, 0)
      updateEraserPreview()
    }
  }, [eraserActive, eraserTargetLayerId, eraserMode, eraserColor, eraserBrushSize, eraserTolerance, frameLayers, scale, layout, updateEraserPreview])

  const handleEraserMouseUp = useCallback(() => {
    eraserBrushingRef.current = false
  }, [])

  const eraserUndo = useCallback(() => {
    const original = eraserOriginalRef.current
    const canvas = eraserCanvasRef.current
    if (!original || !canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(original, 0, 0)
    updateEraserPreview()
  }, [updateEraserPreview])

  const eraserCancel = useCallback(() => {
    setEraserActive(false)
    setEraserTargetLayerId(null)
    setEraserColor(null)
    setEraserColorHex(null)
    setEraserPicking(false)
    setEraserPreviewImg(null)
    setEraserCursorPos(null)
    eraserCanvasRef.current = null
    eraserOriginalRef.current = null
    eraserImageRef.current = null
    eraserBrushingRef.current = false
  }, [])

  const eraserSave = useCallback(async () => {
    const canvas = eraserCanvasRef.current
    if (!canvas || !eraserTargetLayerId) return
    setEraserSaving(true)
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('Failed to create blob')), 'image/png')
      })
      const fd = new FormData()
      fd.append('layerId', eraserTargetLayerId)
      fd.append('file', new File([blob], 'erased.png', { type: 'image/png' }))
      const res = await fetch(`/api/layouts/${layout._id}/frame`, { method: 'PUT', body: fd })
      if (!res.ok) throw new Error('Save failed')
      const data = await res.json()
      setFrameLayers(data.frameLayers)
      eraserCancel()
    } catch {
      alert('배경 제거 저장 실패')
    } finally {
      setEraserSaving(false)
    }
  }, [eraserTargetLayerId, layout._id, eraserCancel])

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
    let allItems = buildLayerList()

    const hasDupes = new Set(allItems.map(i => i.zIndex)).size < allItems.length
    if (hasDupes) {
      const reversed = [...allItems].reverse()
      reversed.forEach((item, i) => { item.zIndex = i + 1 })
      allItems = [...reversed].reverse()
    }

    const idx = allItems.findIndex(i => i.id === itemId && i.type === itemType)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= allItems.length) return
    const current = allItems[idx]
    const target = allItems[swapIdx]
    const newCurrentZ = target.zIndex
    const newTargetZ = current.zIndex

    const zMap = new Map<string, number>()
    if (hasDupes) {
      for (const item of allItems) zMap.set(`${item.type}:${item.id}`, item.zIndex)
    }
    zMap.set(`${current.type}:${current.id}`, newCurrentZ)
    zMap.set(`${target.type}:${target.id}`, newTargetZ)

    setSlots(prev => prev.map(s => {
      const z = zMap.get(`slot:${s.id}`)
      return z != null ? { ...s, zIndex: z } : s
    }))
    setFrameLayers(prev => prev.map(l => {
      const z = zMap.get(`frame:${l.id}`)
      return z != null ? { ...l, zIndex: z } : l
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
      | { type: 'slot'; slot: PhotoSlot; index: number; zIndex: number }
      | { type: 'frame'; layer: FrameLayer; zIndex: number }
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

        {/* Instagram frame generator */}
        <button
          onClick={() => setShowIgDialog(true)}
          className="px-3 py-1.5 text-xs rounded-xl font-semibold bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white hover:opacity-90 transition-opacity"
        >
          IG 프레임
        </button>

        {/* Text overlay tool */}
        <button
          onClick={() => setShowTextDialog(true)}
          className="px-3 py-1.5 text-xs rounded-xl font-semibold bg-gray-800 text-white hover:bg-gray-700 transition-colors"
        >
          Aa 텍스트
        </button>

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
              <>
                <button
                  onClick={() => {
                    setDetectTargetLayerId(selectedFrameLayerId)
                    setDetectedRegions([])
                    setSampledColor(null)
                    lastPickRef.current = null
                    setEditorMode('colorPick')
                  }}
                  disabled={editorMode === 'colorPick' || eraserActive}
                  className={`px-3 py-1.5 text-xs rounded-xl font-semibold transition-colors ${
                    editorMode === 'colorPick'
                      ? 'bg-orange-500 text-white cursor-wait'
                      : 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                  }`}
                >
                  {editorMode === 'colorPick' ? '색상 클릭...' : '슬롯 감지'}
                </button>
                <button
                  onClick={() => startEraser(selectedFrameLayerId)}
                  disabled={eraserActive}
                  className={`px-3 py-1.5 text-xs rounded-xl font-semibold transition-colors ${
                    eraserActive
                      ? 'bg-pink-500 text-white'
                      : 'bg-pink-50 text-pink-600 hover:bg-pink-100'
                  }`}
                >
                  배경 제거
                </button>
              </>
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

        <button onClick={() => setShowGrid(g => !g)}
          className={`px-3 py-1.5 text-xs rounded-xl font-semibold transition-colors ${
            showGrid
              ? 'bg-indigo-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}>
          {showGrid ? '격자 끄기' : '# 격자'}
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
              : eraserActive
                ? `border-2 border-pink-300 bg-gray-200 ${eraserPicking ? 'cursor-cell' : 'cursor-none'}`
                : `border-2 border-gray-200 bg-gray-200 ${editorMode === 'colorPick' ? 'cursor-cell' : 'cursor-crosshair'}`
          }`}
          style={{
            width: DISPLAY_W, height: displayH,
            ...(eraserActive ? {
              backgroundImage: 'linear-gradient(45deg, #e5e5e5 25%, transparent 25%), linear-gradient(-45deg, #e5e5e5 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e5e5 75%), linear-gradient(-45deg, transparent 75%, #e5e5e5 75%)',
              backgroundSize: '16px 16px',
              backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
            } : {}),
          }}
        >
          <Stage ref={stageRef} width={DISPLAY_W} height={displayH}
            onMouseDown={eraserActive ? handleEraserCanvasClick : handleMouseDown}
            onMouseMove={eraserActive ? handleEraserMouseMove : handleMouseMove}
            onMouseUp={eraserActive ? handleEraserMouseUp : handleMouseUp}
            onMouseLeave={() => { if (eraserActive) { setEraserCursorPos(null); eraserBrushingRef.current = false } }}>
            <Layer>
              <Rect name="canvas-bg" x={0} y={0} width={DISPLAY_W} height={displayH} fill={bgColor} />

              {renderItems.map(item => {
                if (item.type === 'slot') {
                  const { slot } = item
                  const tImg = testImages.get(slot.id)
                  return (
                    <React.Fragment key={slot.id}>
                      {/* Test image fill — cover fit with dimmed overflow */}
                      {tImg && (() => {
                        const imgRatio = tImg.naturalWidth / tImg.naturalHeight
                        const slotRatio = slot.width / slot.height
                        let drawW: number, drawH: number
                        if (imgRatio > slotRatio) {
                          drawH = slot.height
                          drawW = slot.height * imgRatio
                        } else {
                          drawW = slot.width
                          drawH = slot.width / imgRatio
                        }
                        const offsetX = (slot.width - drawW) / 2
                        const offsetY = (slot.height - drawH) / 2
                        const imgX = (slot.x + offsetX) * scale
                        const imgY = (slot.y + offsetY) * scale
                        const imgW = drawW * scale
                        const imgH = drawH * scale
                        const sx = slot.x * scale
                        const sy = slot.y * scale
                        const sw = slot.width * scale
                        const sh = slot.height * scale
                        return (
                          <>
                            <KonvaImage image={tImg} x={imgX} y={imgY} width={imgW} height={imgH}
                              rotation={slot.rotation ?? 0} opacity={0.2} listening={false} />
                            <Group clipFunc={(ctx: { rect: (x: number, y: number, w: number, h: number) => void }) => { ctx.rect(sx, sy, sw, sh) }}>
                              <KonvaImage image={tImg} x={imgX} y={imgY} width={imgW} height={imgH}
                                rotation={slot.rotation ?? 0} listening={false} />
                            </Group>
                          </>
                        )
                      })()}
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
                      {!previewMode && !eraserActive && (
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
                          onDragMove={e => onSlotDragMove(slot.id, e.target.x(), e.target.y())}
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
                  const isEraserTarget = eraserActive && eraserTargetLayerId === layer.id
                  const displayImg = isEraserTarget && eraserPreviewImg ? eraserPreviewImg : img
                  return (
                    <React.Fragment key={layer.id}>
                      <KonvaImage image={displayImg}
                        x={lx} y={ly} width={lw} height={lh}
                        rotation={layer.rotation ?? 0}
                        opacity={layer.opacity} listening={false} />
                      {/* Interaction rect — only interactive when this layer is selected */}
                      {isSelectedFrame && !previewMode && !eraserActive && (
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

              {/* Grid overlay */}
              {showGrid && !previewMode && (() => {
                const gridLines: React.ReactNode[] = []
                const gridSizes = [
                  { step: layout.canvasWidth / 2, color: 'rgba(255,0,0,0.4)', width: 1 },      // 중심선
                  { step: layout.canvasWidth / 6, color: 'rgba(0,120,255,0.25)', width: 0.7 },  // 6등분
                  { step: layout.canvasWidth / 12, color: 'rgba(0,0,0,0.1)', width: 0.5 },     // 12등분
                  { step: layout.canvasWidth / 24, color: 'rgba(0,0,0,0.06)', width: 0.3 },    // 24등분
                ]
                for (const { step, color, width } of gridSizes) {
                  const stepPx = step * scale
                  // 세로선
                  for (let x = stepPx; x < DISPLAY_W; x += stepPx) {
                    gridLines.push(<Line key={`gv-${step}-${x}`} points={[x, 0, x, displayH]} stroke={color} strokeWidth={width} listening={false} />)
                  }
                  // 가로선
                  const stepH = step * (layout.canvasHeight / layout.canvasWidth)
                  const stepHPx = stepH * scale
                  for (let y = stepHPx; y < displayH; y += stepHPx) {
                    gridLines.push(<Line key={`gh-${step}-${y}`} points={[0, y, DISPLAY_W, y]} stroke={color} strokeWidth={width} listening={false} />)
                  }
                }
                return gridLines
              })()}

              {/* Alignment guides */}
              {!previewMode && alignGuides.map((g, i) =>
                g.orient === 'V'
                  ? <Line key={`ag-${i}`} points={[g.pos * scale, 0, g.pos * scale, displayH]} stroke="#f43f5e" strokeWidth={1} dash={[4, 3]} listening={false} />
                  : <Line key={`ag-${i}`} points={[0, g.pos * scale, DISPLAY_W, g.pos * scale]} stroke="#f43f5e" strokeWidth={1} dash={[4, 3]} listening={false} />
              )}

              {/* Eraser brush cursor */}
              {eraserActive && eraserMode === 'brush' && eraserCursorPos && (
                <Circle
                  x={eraserCursorPos.x}
                  y={eraserCursorPos.y}
                  radius={eraserBrushSize * scale / 2}
                  stroke="#ec4899"
                  strokeWidth={1.5}
                  dash={[4, 3]}
                  fill="rgba(236,72,153,0.08)"
                  listening={false}
                />
              )}
              {/* Eraser wand / picking cursor */}
              {eraserActive && (eraserMode === 'wand' || eraserPicking) && eraserCursorPos && !eraserPicking && (
                <Circle
                  x={eraserCursorPos.x}
                  y={eraserCursorPos.y}
                  radius={6}
                  stroke="#ec4899"
                  strokeWidth={2}
                  fill="rgba(236,72,153,0.2)"
                  listening={false}
                />
              )}

              {!previewMode && !eraserActive && (
                <Transformer ref={trRef} keepRatio={shiftHeld} rotateEnabled={true}
                  rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
                  boundBoxFunc={(_, newBox) => (newBox.width < 20 || newBox.height < 20) ? _ : newBox} />
              )}
            </Layer>
          </Stage>
        </div>

        {/* Right Panel: Layer list + Slot properties */}
        <div className="flex-1 min-w-[220px] space-y-3">
          {/* Background Eraser Panel */}
          {eraserActive && (
            <div className="bg-white rounded-xl border border-pink-200 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-pink-700">배경 제거</span>
                {eraserPicking && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold animate-pulse">스포이드</span>
                )}
              </div>

              {/* Selected color display + change button */}
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-2.5 py-2">
                {eraserColor ? (
                  <>
                    <div className="w-6 h-6 rounded-md border-2 border-gray-300 shrink-0"
                      style={{ backgroundColor: eraserColorHex || '#000' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-gray-400 leading-tight">선택된 색상</p>
                      <p className="text-xs font-bold text-gray-700 tabular-nums">{eraserColorHex}</p>
                    </div>
                    <button onClick={() => setEraserPicking(true)}
                      className={`px-2 py-1 text-[10px] rounded-lg font-semibold transition-colors shrink-0 ${
                        eraserPicking
                          ? 'bg-amber-400 text-white'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}>
                      변경
                    </button>
                  </>
                ) : (
                  <div className="flex-1 text-center py-1">
                    <p className="text-[10px] text-amber-600 font-semibold">
                      이미지에서 제거할 색상을 클릭하세요
                    </p>
                  </div>
                )}
              </div>

              {/* Mode toggle */}
              <div className="flex gap-1.5">
                <button onClick={() => setEraserMode('wand')}
                  className={`flex-1 py-1.5 text-[11px] rounded-lg font-semibold transition-colors ${
                    eraserMode === 'wand' ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  Magic Wand
                </button>
                <button onClick={() => setEraserMode('brush')}
                  className={`flex-1 py-1.5 text-[11px] rounded-lg font-semibold transition-colors ${
                    eraserMode === 'brush' ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  브러시 지우개
                </button>
              </div>

              {/* Tolerance */}
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <label className="text-[10px] text-gray-400 font-semibold">색상 허용 범위</label>
                  <span className="text-[10px] text-gray-500 tabular-nums">{eraserTolerance}</span>
                </div>
                <input type="range" min={5} max={100} step={5} value={eraserTolerance}
                  onChange={e => setEraserTolerance(Number(e.target.value))}
                  className="w-full h-1.5 accent-pink-500" />
              </div>

              {/* Brush size (brush mode only) */}
              {eraserMode === 'brush' && (
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="text-[10px] text-gray-400 font-semibold">브러시 크기</label>
                    <span className="text-[10px] text-gray-500 tabular-nums">{eraserBrushSize}px</span>
                  </div>
                  <input type="range" min={5} max={100} step={5} value={eraserBrushSize}
                    onChange={e => setEraserBrushSize(Number(e.target.value))}
                    className="w-full h-1.5 accent-pink-500" />
                </div>
              )}

              {/* Instructions */}
              {eraserColor && !eraserPicking && (
                <p className="text-[10px] text-pink-600 font-semibold text-center py-1">
                  {eraserMode === 'wand'
                    ? '클릭하면 연결된 같은 색상 영역이 제거됩니다'
                    : '드래그하여 선택 색상과 비슷한 영역을 지워보세요'}
                </p>
              )}

              {/* Undo / Cancel / Save */}
              <div className="flex gap-2">
                <button onClick={eraserUndo}
                  className="px-2 py-1.5 text-[10px] rounded-lg bg-gray-100 text-gray-600 font-semibold hover:bg-gray-200 transition-colors">
                  되돌리기
                </button>
                <button onClick={eraserCancel}
                  className="flex-1 px-2 py-1.5 text-[10px] rounded-lg border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition-colors">
                  취소
                </button>
                <button onClick={eraserSave} disabled={eraserSaving}
                  className="flex-1 px-2 py-1.5 text-[10px] rounded-lg bg-pink-500 text-white font-semibold hover:bg-pink-600 disabled:opacity-50 transition-colors">
                  {eraserSaving ? '저장 중...' : '적용'}
                </button>
              </div>
            </div>
          )}

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

                    {/* Delete */}
                    <button onClick={e => {
                      e.stopPropagation()
                      setLayerDeleteConfirm({ id: item.id, type: item.type, name: item.name })
                    }}
                      className="text-[10px] text-gray-300 hover:text-red-500 shrink-0 transition-colors" title="삭제">
                      ✕
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

      {/* Layer delete confirm dialog */}
      {layerDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setLayerDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-[320px]" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-gray-800 mb-1">레이어 삭제</p>
            <p className="text-xs text-gray-500 mb-4">
              <span className="font-semibold text-gray-700">{layerDeleteConfirm.name}</span> 레이어를 삭제할까요?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setLayerDeleteConfirm(null)}
                className="flex-1 px-4 py-2 text-sm rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold">
                취소
              </button>
              <button onClick={() => {
                if (layerDeleteConfirm.type === 'slot') {
                  setSlots(prev => prev.filter(s => s.id !== layerDeleteConfirm.id))
                  if (selectedSlotId === layerDeleteConfirm.id) setSelectedSlotId(null)
                } else {
                  deleteFrameLayer(layerDeleteConfirm.id)
                }
                setLayerDeleteConfirm(null)
              }}
                className="flex-1 px-4 py-2 text-sm rounded-xl bg-red-500 text-white hover:bg-red-600 font-semibold">
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instagram frame dialog */}
      {showIgDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40" onClick={() => setShowIgDialog(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-[420px] max-w-[90vw] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center text-sm">📸</div>
              <div>
                <h3 className="text-base font-bold">인스타그램 프레임</h3>
                <p className="text-[10px] text-gray-400">프레임과 QR코드가 자동 생성됩니다</p>
              </div>
            </div>

            <div className="space-y-3 mb-5">
              <div>
                <label className="text-[11px] font-semibold text-gray-500 mb-1 block">인스타 아이디 *</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400 font-medium">@</span>
                  <input type="text" value={igForm.username}
                    onChange={e => setIgForm(f => ({ ...f, username: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') handleGenerateInstagramFrame() }}
                    placeholder="instagram_id"
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-300"
                    autoFocus />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-500 mb-1 block">QR코드 URL</label>
                <input type="text" value={igForm.qrUrl}
                  onChange={e => setIgForm(f => ({ ...f, qrUrl: e.target.value }))}
                  placeholder={igForm.username ? `instagram.com/${igForm.username.replace(/^@/, '')}` : 'https://instagram.com/...'}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-300" />
                <p className="text-[10px] text-gray-400 mt-0.5">비워두면 인스타 프로필 링크 사용</p>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-500 mb-1 block">캡션</label>
                <input type="text" value={igForm.caption}
                  onChange={e => setIgForm(f => ({ ...f, caption: e.target.value }))}
                  placeholder="사진을 찍었어요"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-300" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-gray-500 mb-1 block">좋아요 텍스트</label>
                  <input type="text" value={igForm.likesText}
                    onChange={e => setIgForm(f => ({ ...f, likesText: e.target.value }))}
                    placeholder="좋아요 999개"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-300" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-500 mb-1 block">QR 라벨</label>
                  <input type="text" value={igForm.qrLabel}
                    onChange={e => setIgForm(f => ({ ...f, qrLabel: e.target.value }))}
                    placeholder="QR로 팔로우"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-300" />
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowIgDialog(false)}
                className="flex-1 px-4 py-2 text-sm rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold">
                취소
              </button>
              <button onClick={handleGenerateInstagramFrame}
                disabled={!igForm.username.trim() || igGenerating}
                className="flex-1 px-4 py-2 text-sm rounded-xl bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white font-semibold disabled:opacity-50 hover:opacity-90">
                {igGenerating ? '생성 중...' : '프레임 생성'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Text overlay dialog */}
      {showTextDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40" onClick={() => setShowTextDialog(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-[420px] max-w-[90vw]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center text-sm text-white font-bold">Aa</div>
              <div>
                <h3 className="text-base font-bold">텍스트 추가</h3>
                <p className="text-[10px] text-gray-400">레이어로 추가되어 위치/크기/회전 조절 가능</p>
              </div>
            </div>

            {/* 미리보기 */}
            <div
              className="rounded-xl p-4 mb-4 min-h-[80px] flex items-center justify-center"
              style={{ backgroundColor: textForm.bgStyle !== 'none' ? '#F3F4F6' : '#1F2937' }}
            >
              <p
                className="text-center whitespace-pre-wrap break-words"
                style={{
                  fontSize: Math.min(textForm.fontSize * 0.5, 36),
                  fontWeight: textForm.bold ? 700 : 400,
                  color: textForm.color,
                  backgroundColor: textForm.bgStyle === 'solid' ? textForm.bgColor : textForm.bgStyle === 'translucent' ? textForm.bgColor + '99' : 'transparent',
                  padding: textForm.bgStyle !== 'none' ? '4px 12px' : 0,
                  borderRadius: 8,
                }}
              >
                {textForm.text || '텍스트를 입력하세요'}
              </p>
            </div>

            <div className="space-y-3 mb-5">
              {/* 텍스트 입력 */}
              <textarea
                value={textForm.text}
                onChange={e => setTextForm(f => ({ ...f, text: e.target.value }))}
                placeholder="텍스트를 입력하세요"
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none"
                autoFocus
              />

              {/* 폰트 크기 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-gray-500">크기</label>
                  <span className="text-[11px] text-gray-400">{textForm.fontSize}px</span>
                </div>
                <input type="range" min={24} max={160} value={textForm.fontSize}
                  onChange={e => setTextForm(f => ({ ...f, fontSize: parseInt(e.target.value) }))}
                  className="w-full h-1.5 accent-gray-700" />
              </div>

              {/* 색상 선택 */}
              <div>
                <label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">텍스트 색상</label>
                <div className="flex flex-wrap gap-1.5">
                  {TEXT_COLORS.map(c => (
                    <button key={c} onClick={() => setTextForm(f => ({ ...f, color: c }))}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${textForm.color === c ? 'border-blue-500 scale-110' : 'border-gray-200'}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>

              {/* 배경 스타일 */}
              <div>
                <label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">배경</label>
                <div className="flex gap-1.5">
                  {([['none', '없음'], ['solid', '채움'], ['translucent', '반투명']] as const).map(([val, label]) => (
                    <button key={val}
                      onClick={() => setTextForm(f => ({ ...f, bgStyle: val }))}
                      className={`flex-1 py-1.5 text-xs rounded-xl font-semibold transition-colors ${
                        textForm.bgStyle === val ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 배경 색상 (배경이 있을 때만) */}
              {textForm.bgStyle !== 'none' && (
                <div>
                  <label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">배경 색상</label>
                  <div className="flex flex-wrap gap-1.5">
                    {TEXT_COLORS.map(c => (
                      <button key={c} onClick={() => setTextForm(f => ({ ...f, bgColor: c }))}
                        className={`w-7 h-7 rounded-full border-2 transition-transform ${textForm.bgColor === c ? 'border-blue-500 scale-110' : 'border-gray-200'}`}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
              )}

              {/* 볼드 토글 */}
              <button
                onClick={() => setTextForm(f => ({ ...f, bold: !f.bold }))}
                className={`px-3 py-1.5 text-xs rounded-xl font-semibold transition-colors ${
                  textForm.bold ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                B 볼드
              </button>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowTextDialog(false)}
                className="flex-1 px-4 py-2 text-sm rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold">
                취소
              </button>
              <button onClick={handleGenerateText}
                disabled={!textForm.text.trim() || textGenerating}
                className="flex-1 px-4 py-2 text-sm rounded-xl bg-gray-800 text-white font-semibold disabled:opacity-50 hover:bg-gray-700">
                {textGenerating ? '생성 중...' : '텍스트 추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
