'use client'

type EraserMode = 'wand' | 'brush'

interface Props {
  eraserMode: EraserMode
  eraserColor: { r: number; g: number; b: number } | null
  eraserColorHex: string | null
  eraserPicking: boolean
  eraserTolerance: number
  eraserBrushSize: number
  eraserSaving: boolean
  onModeChange: (mode: EraserMode) => void
  onPickingChange: (picking: boolean) => void
  onToleranceChange: (tolerance: number) => void
  onBrushSizeChange: (size: number) => void
  onUndo: () => void
  onCancel: () => void
  onSave: () => void
}

export default function EraserPanel({
  eraserMode, eraserColor, eraserColorHex, eraserPicking,
  eraserTolerance, eraserBrushSize, eraserSaving,
  onModeChange, onPickingChange, onToleranceChange, onBrushSizeChange,
  onUndo, onCancel, onSave,
}: Props) {
  return (
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
            <button onClick={() => onPickingChange(true)}
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
        <button onClick={() => onModeChange('wand')}
          className={`flex-1 py-1.5 text-[11px] rounded-lg font-semibold transition-colors ${
            eraserMode === 'wand' ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}>
          Magic Wand
        </button>
        <button onClick={() => onModeChange('brush')}
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
          onChange={e => onToleranceChange(Number(e.target.value))}
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
            onChange={e => onBrushSizeChange(Number(e.target.value))}
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
        <button onClick={onUndo}
          className="px-2 py-1.5 text-[10px] rounded-lg bg-gray-100 text-gray-600 font-semibold hover:bg-gray-200 transition-colors">
          되돌리기
        </button>
        <button onClick={onCancel}
          className="flex-1 px-2 py-1.5 text-[10px] rounded-lg border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition-colors">
          취소
        </button>
        <button onClick={onSave} disabled={eraserSaving}
          className="flex-1 px-2 py-1.5 text-[10px] rounded-lg bg-pink-500 text-white font-semibold hover:bg-pink-600 disabled:opacity-50 transition-colors">
          {eraserSaving ? '저장 중...' : '적용'}
        </button>
      </div>
    </div>
  )
}
