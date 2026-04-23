'use client'

import { useState } from 'react'
import type { FrameLayer } from '@/lib/types'

interface Props {
  layoutId: string
  onClose: () => void
  onLayersUpdate: (layers: FrameLayer[]) => void
}

export default function InstagramFrameDialog({ layoutId, onClose, onLayersUpdate }: Props) {
  const [igForm, setIgForm] = useState({ username: '', qrUrl: '', caption: '', likesText: '', qrLabel: '' })
  const [generating, setGenerating] = useState(false)

  const handleGenerate = async () => {
    if (!igForm.username.trim()) return
    setGenerating(true)
    try {
      const res = await fetch(`/api/layouts/${layoutId}/instagram-frame`, {
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
      onLayersUpdate(data.frameLayers)
      onClose()
    } catch {
      alert('인스타그램 프레임 생성 실패')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40" onClick={onClose}>
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
                onKeyDown={e => { if (e.key === 'Enter') handleGenerate() }}
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
          <button onClick={onClose}
            className="flex-1 px-4 py-2 text-sm rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold">
            취소
          </button>
          <button onClick={handleGenerate}
            disabled={!igForm.username.trim() || generating}
            className="flex-1 px-4 py-2 text-sm rounded-xl bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white font-semibold disabled:opacity-50 hover:opacity-90">
            {generating ? '생성 중...' : '프레임 생성'}
          </button>
        </div>
      </div>
    </div>
  )
}
