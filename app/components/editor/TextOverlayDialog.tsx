'use client'

import { useState } from 'react'
import type { FrameLayer } from '@/lib/types'

const TEXT_COLORS = ['#FFFFFF', '#000000', '#ED4956', '#E1306C', '#833AB4', '#405DE6', '#5B51D8', '#00B2FF', '#58C322', '#FCAF45', '#F77737', '#FD1D1D']

interface Props {
  layoutId: string
  onClose: () => void
  onLayersUpdate: (layers: FrameLayer[]) => void
}

export default function TextOverlayDialog({ layoutId, onClose, onLayersUpdate }: Props) {
  const [generating, setGenerating] = useState(false)
  const [textForm, setTextForm] = useState({
    text: '',
    fontSize: 64,
    color: '#FFFFFF',
    bgStyle: 'none' as 'none' | 'solid' | 'translucent',
    bgColor: '#000000',
    bold: true,
  })

  const handleGenerate = async () => {
    if (!textForm.text.trim()) return
    setGenerating(true)
    try {
      const res = await fetch(`/api/layouts/${layoutId}/text-overlay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(textForm),
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      onLayersUpdate(data.frameLayers)
      onClose()
    } catch {
      alert('텍스트 생성 실패')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40" onClick={onClose}>
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
          <textarea
            value={textForm.text}
            onChange={e => setTextForm(f => ({ ...f, text: e.target.value }))}
            placeholder="텍스트를 입력하세요"
            rows={2}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none"
            autoFocus
          />

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-gray-500">크기</label>
              <span className="text-[11px] text-gray-400">{textForm.fontSize}px</span>
            </div>
            <input type="range" min={24} max={160} value={textForm.fontSize}
              onChange={e => setTextForm(f => ({ ...f, fontSize: parseInt(e.target.value) }))}
              className="w-full h-1.5 accent-gray-700" />
          </div>

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

          <button
            onClick={() => setTextForm(f => ({ ...f, bold: !f.bold }))}
            className={`px-3 py-1.5 text-xs rounded-xl font-semibold transition-colors ${
              textForm.bold ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'
            }`}>
            B 볼드
          </button>
        </div>

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 text-sm rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold">
            취소
          </button>
          <button onClick={handleGenerate}
            disabled={!textForm.text.trim() || generating}
            className="flex-1 px-4 py-2 text-sm rounded-xl bg-gray-800 text-white font-semibold disabled:opacity-50 hover:bg-gray-700">
            {generating ? '생성 중...' : '텍스트 추가'}
          </button>
        </div>
      </div>
    </div>
  )
}
