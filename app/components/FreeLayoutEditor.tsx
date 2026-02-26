'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type Konva from 'konva'
import { Stage, Layer, Rect, Image, Text, Transformer } from 'react-konva'

// ─── Types ───────────────────────────────────────────────────────────────────

type ElementType = 'image' | 'sticker' | 'text'

interface CanvasElement {
  id: string
  type: ElementType
  x: number
  y: number
  width: number
  height: number
  rotation: number
  src?: string
  text?: string
  fontSize?: number
  fill?: string
}

interface StickerInfo {
  _id: string
  url: string
  filename: string
}

interface FreeLayoutEditorProps {
  onComplete: (blob: Blob) => void
  onBack: () => void
}

// ─── Canvas dimensions ───────────────────────────────────────────────────────

const CANVAS_W = 1200
const CANVAS_H = 1800
const ASPECT = CANVAS_H / CANVAS_W // 1.5

// ─── Konva Image Element ─────────────────────────────────────────────────────

function KonvaImage({
  element,
  isSelected,
  onSelect,
  onChange,
}: {
  element: CanvasElement
  isSelected: boolean
  onSelect: () => void
  onChange: (attrs: Partial<CanvasElement>) => void
}) {
  const imgRef = useRef<Konva.Image>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    if (!element.src) return
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => setImage(img)
    img.src = element.src
  }, [element.src])

  useEffect(() => {
    if (isSelected && trRef.current && imgRef.current) {
      trRef.current.nodes([imgRef.current])
      trRef.current.getLayer()?.batchDraw()
    }
  }, [isSelected])

  if (!image) return null

  return (
    <>
      <Image
        ref={imgRef}
        image={image}
        x={element.x}
        y={element.y}
        width={element.width}
        height={element.height}
        rotation={element.rotation}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={e => onChange({ x: e.target.x(), y: e.target.y() })}
        onTransformEnd={e => {
          const node = imgRef.current!
          onChange({
            x: node.x(),
            y: node.y(),
            width: Math.max(20, node.width() * node.scaleX()),
            height: Math.max(20, node.height() * node.scaleY()),
            rotation: node.rotation(),
          })
          node.scaleX(1)
          node.scaleY(1)
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(_, newBox) => ({
            ...newBox,
            width: Math.max(20, newBox.width),
            height: Math.max(20, newBox.height),
          })}
          rotateEnabled
          keepRatio={element.type === 'sticker'}
        />
      )}
    </>
  )
}

// ─── Konva Text Element ───────────────────────────────────────────────────────

function KonvaText({
  element,
  isSelected,
  onSelect,
  onChange,
}: {
  element: CanvasElement
  isSelected: boolean
  onSelect: () => void
  onChange: (attrs: Partial<CanvasElement>) => void
}) {
  const textRef = useRef<Konva.Text>(null)
  const trRef = useRef<Konva.Transformer>(null)

  useEffect(() => {
    if (isSelected && trRef.current && textRef.current) {
      trRef.current.nodes([textRef.current])
      trRef.current.getLayer()?.batchDraw()
    }
  }, [isSelected])

  return (
    <>
      <Text
        ref={textRef}
        text={element.text}
        x={element.x}
        y={element.y}
        fontSize={element.fontSize || 40}
        fill={element.fill || '#ffffff'}
        fontStyle="bold"
        rotation={element.rotation}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={e => onChange({ x: e.target.x(), y: e.target.y() })}
        onTransformEnd={e => {
          const node = textRef.current!
          onChange({
            x: node.x(),
            y: node.y(),
            fontSize: Math.max(12, (element.fontSize || 40) * node.scaleX()),
            rotation: node.rotation(),
          })
          node.scaleX(1)
          node.scaleY(1)
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          enabledAnchors={['middle-left', 'middle-right']}
          rotateEnabled
          boundBoxFunc={(oldBox, newBox) => ({ ...newBox, width: Math.max(20, newBox.width) })}
        />
      )}
    </>
  )
}

// ─── Text Input Modal ─────────────────────────────────────────────────────────

function TextModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: (text: string, color: string, fontSize: number) => void
  onCancel: () => void
}) {
  const [text, setText] = useState('')
  const [color, setColor] = useState('#ffffff')
  const [fontSize, setFontSize] = useState(60)

  const COLORS = ['#ffffff', '#000000', '#ff4d6d', '#a855f7', '#3b82f6', '#facc15', '#4ade80']

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center">
      <div className="bg-white rounded-t-3xl w-full max-w-lg p-6 space-y-4">
        <h3 className="text-lg font-bold text-center text-gray-800">텍스트 추가</h3>
        <textarea
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="텍스트를 입력하세요"
          rows={3}
          className="w-full border-2 border-purple-200 rounded-xl p-3 text-gray-800 resize-none focus:outline-none focus:border-purple-400"
        />
        <div className="flex gap-2 items-center">
          <span className="text-sm text-gray-600">색상</span>
          <div className="flex gap-2">
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="w-7 h-7 rounded-full border-2 transition-all"
                style={{
                  backgroundColor: c,
                  borderColor: color === c ? '#a855f7' : '#e5e7eb',
                  transform: color === c ? 'scale(1.2)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        </div>
        <div className="flex gap-3 items-center">
          <span className="text-sm text-gray-600">크기</span>
          <input
            type="range"
            min={20}
            max={150}
            value={fontSize}
            onChange={e => setFontSize(Number(e.target.value))}
            className="flex-1 accent-purple-500"
          />
          <span className="text-sm text-gray-500 w-8">{fontSize}</span>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold"
          >
            취소
          </button>
          <button
            onClick={() => text.trim() && onConfirm(text.trim(), color, fontSize)}
            disabled={!text.trim()}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold disabled:opacity-40"
          >
            추가
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Background Color Picker ──────────────────────────────────────────────────

const BG_COLORS = [
  { label: '화이트', value: '#ffffff' },
  { label: '블랙', value: '#000000' },
  { label: '핑크', value: '#fce4ec' },
  { label: '퍼플', value: '#f3e5f5' },
  { label: '블루', value: '#e3f2fd' },
  { label: '베이지', value: '#fdf6ec' },
]

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FreeLayoutEditor({ onComplete, onBack }: FreeLayoutEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [stageWidth, setStageWidth] = useState(390)
  const [elements, setElements] = useState<CanvasElement[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [bgColor, setBgColor] = useState('#ffffff')
  const [showTextModal, setShowTextModal] = useState(false)
  const [showStickerPanel, setShowStickerPanel] = useState(false)
  const [showBgPanel, setShowBgPanel] = useState(false)
  const [stickers, setStickers] = useState<StickerInfo[]>([])
  const [exporting, setExporting] = useState(false)

  const stageHeight = stageWidth * ASPECT

  // Responsive stage width
  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setStageWidth(containerRef.current.offsetWidth)
      }
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // Load stickers
  useEffect(() => {
    fetch('/api/stickers')
      .then(r => r.json())
      .then(data => setStickers(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  const addElement = useCallback((el: Omit<CanvasElement, 'id'>) => {
    const id = `el-${Date.now()}-${Math.random().toString(36).slice(2)}`
    setElements(prev => [...prev, { id, ...el }])
    setSelectedId(id)
  }, [])

  // Add photo
  const handleAddPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => {
      const maxW = stageWidth * 0.8
      const ratio = img.height / img.width
      const w = maxW
      const h = maxW * ratio
      addElement({
        type: 'image',
        src: url,
        x: (stageWidth - w) / 2,
        y: (stageHeight - h) / 2,
        width: w,
        height: h,
        rotation: 0,
      })
    }
    img.src = url
    e.target.value = ''
  }

  // Add sticker
  const handleAddSticker = (sticker: StickerInfo) => {
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const w = stageWidth * 0.3
      const ratio = img.height / img.width
      addElement({
        type: 'sticker',
        src: sticker.url,
        x: (stageWidth - w) / 2,
        y: (stageHeight * 0.3),
        width: w,
        height: w * ratio,
        rotation: 0,
      })
    }
    img.src = sticker.url
    setShowStickerPanel(false)
  }

  // Add text
  const handleAddText = (text: string, color: string, fontSize: number) => {
    const scaledFontSize = fontSize * (stageWidth / CANVAS_W)
    addElement({
      type: 'text',
      text,
      x: stageWidth * 0.1,
      y: stageHeight * 0.4,
      width: stageWidth * 0.8,
      height: scaledFontSize * 2,
      rotation: 0,
      fontSize: scaledFontSize,
      fill: color,
    })
    setShowTextModal(false)
  }

  const updateElement = useCallback((id: string, attrs: Partial<CanvasElement>) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, ...attrs } : el))
  }, [])

  const deleteSelected = () => {
    if (!selectedId) return
    setElements(prev => prev.filter(el => el.id !== selectedId))
    setSelectedId(null)
  }

  // Export 1200×1800 JPEG
  const handleComplete = async () => {
    if (!stageRef.current) return
    setExporting(true)
    setSelectedId(null)

    await new Promise(r => setTimeout(r, 100)) // deselect transformer

    const pixelRatio = CANVAS_W / stageWidth
    const blob = await new Promise<Blob>((resolve, reject) => {
      stageRef.current!.toBlob({
        pixelRatio,
        mimeType: 'image/jpeg',
        quality: 0.95,
        callback: (b: Blob | null) => {
          if (b) resolve(b)
          else reject(new Error('Export failed'))
        }
      } as any)
    })

    setExporting(false)
    onComplete(blob)
  }

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 border-b border-gray-700">
        <button
          onClick={onBack}
          className="p-2 text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex-1 flex items-center gap-2 overflow-x-auto">
          {/* Add photo */}
          <ToolBtn
            icon="📷"
            label="사진"
            onClick={() => fileInputRef.current?.click()}
          />

          {/* Sticker */}
          <ToolBtn
            icon="✨"
            label="스티커"
            active={showStickerPanel}
            onClick={() => {
              setShowStickerPanel(p => !p)
              setShowBgPanel(false)
            }}
          />

          {/* Text */}
          <ToolBtn
            icon="T"
            label="텍스트"
            onClick={() => {
              setShowTextModal(true)
              setShowStickerPanel(false)
              setShowBgPanel(false)
            }}
          />

          {/* Background */}
          <ToolBtn
            icon="🎨"
            label="배경"
            active={showBgPanel}
            onClick={() => {
              setShowBgPanel(p => !p)
              setShowStickerPanel(false)
            }}
          />

          {/* Delete selected */}
          {selectedId && (
            <ToolBtn icon="🗑️" label="삭제" onClick={deleteSelected} danger />
          )}
        </div>

        {/* Complete */}
        <button
          onClick={handleComplete}
          disabled={exporting}
          className="shrink-0 px-4 py-2 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 text-white text-sm font-bold disabled:opacity-50"
        >
          {exporting ? '처리 중...' : '완료'}
        </button>
      </div>

      {/* Sticker panel */}
      {showStickerPanel && (
        <div className="bg-gray-800 border-b border-gray-700 p-3">
          {stickers.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-2">
              어드민에서 스티커를 먼저 업로드해주세요
            </p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {stickers.map(s => (
                <button
                  key={s._id}
                  onClick={() => handleAddSticker(s)}
                  className="shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-gray-700 hover:ring-2 hover:ring-purple-400 transition-all"
                >
                  <img src={s.url} alt={s.filename} className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Background color panel */}
      {showBgPanel && (
        <div className="bg-gray-800 border-b border-gray-700 p-3 flex gap-3 overflow-x-auto">
          {BG_COLORS.map(c => (
            <button
              key={c.value}
              onClick={() => setBgColor(c.value)}
              className="shrink-0 flex flex-col items-center gap-1"
            >
              <div
                className="w-10 h-10 rounded-full border-2 transition-all"
                style={{
                  backgroundColor: c.value,
                  borderColor: bgColor === c.value ? '#a855f7' : '#4b5563',
                  transform: bgColor === c.value ? 'scale(1.15)' : 'scale(1)',
                }}
              />
              <span className="text-xs text-gray-400">{c.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Canvas area */}
      <div ref={containerRef} className="flex-1 overflow-hidden flex items-center justify-center bg-gray-900 p-2">
        <div style={{ width: stageWidth, height: stageHeight }}>
          <Stage
            ref={stageRef}
            width={stageWidth}
            height={stageHeight}
            onMouseDown={e => { if (e.target === e.target.getStage()) setSelectedId(null) }}
            onTouchStart={e => { if (e.target === e.target.getStage()) setSelectedId(null) }}
          >
            <Layer>
              {/* Background */}
              <Rect x={0} y={0} width={stageWidth} height={stageHeight} fill={bgColor} />

              {/* Elements */}
              {elements.map(el => {
                if (el.type === 'text') {
                  return (
                    <KonvaText
                      key={el.id}
                      element={el}
                      isSelected={selectedId === el.id}
                      onSelect={() => setSelectedId(el.id)}
                      onChange={attrs => updateElement(el.id, attrs)}
                    />
                  )
                }
                return (
                  <KonvaImage
                    key={el.id}
                    element={el}
                    isSelected={selectedId === el.id}
                    onSelect={() => setSelectedId(el.id)}
                    onChange={attrs => updateElement(el.id, attrs)}
                  />
                )
              })}
            </Layer>
          </Stage>
        </div>
      </div>

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAddPhoto} className="hidden" />

      {/* Text modal */}
      {showTextModal && (
        <TextModal
          onConfirm={handleAddText}
          onCancel={() => setShowTextModal(false)}
        />
      )}
    </div>
  )
}

// ─── ToolBtn ──────────────────────────────────────────────────────────────────

function ToolBtn({
  icon,
  label,
  onClick,
  active,
  danger,
}: {
  icon: string
  label: string
  onClick: () => void
  active?: boolean
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'shrink-0 flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors text-xs font-medium',
        danger
          ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
          : active
          ? 'bg-purple-500/30 text-purple-300'
          : 'text-gray-400 hover:bg-gray-700 hover:text-white',
      ].join(' ')}
    >
      <span className="text-lg leading-none">{icon}</span>
      <span>{label}</span>
    </button>
  )
}
