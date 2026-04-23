'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import type { FrameLayout, PhotoSlot, FrameLayer } from '@/lib/types'
import { UIButton, UICard, UIStatusBanner } from '@/app/components/ui'

const FrameEditor = dynamic(() => import('@/app/components/FrameEditor'), { ssr: false })

export default function LayoutEditPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [layout, setLayout] = useState<FrameLayout | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/layouts/${id}`)
      .then(r => { if (!r.ok) throw new Error('Not found'); return r.json() })
      .then(setLayout)
      .catch(() => setError('레이아웃을 찾을 수 없습니다'))
  }, [id])

  const handleSave = async (slots: PhotoSlot[], frameLayers: FrameLayer[], bgColor: string, bgCustomizable: boolean) => {
    const res = await fetch(`/api/layouts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slots, frameLayers, backgroundColor: bgColor, backgroundColorCustomizable: bgCustomizable }),
    })
    if (res.ok) {
      const updated = await res.json()
      setLayout(updated)
      alert('저장되었습니다!')
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-5xl mx-auto space-y-4">
          <UIStatusBanner type="error" message={error} />
          <UIButton variant="secondary" size="sm" onClick={() => router.back()}>← 돌아가기</UIButton>
        </div>
      </div>
    )
  }

  if (!layout) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-blue-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{layout.name}</h1>
              <p className="text-xs text-gray-400">
                {layout.printSize} · {layout.canvasWidth}×{layout.canvasHeight}px · 슬롯 {layout.slots.length}개
                {(layout.frameLayers?.length || 0) > 0 && ` · 레이어 ${layout.frameLayers.length}개`}
              </p>
            </div>
          </div>
        </div>

        {/* Editor */}
        <FrameEditor
          key={layout._id}
          layout={layout}
          onSave={handleSave}
        />
      </div>
    </div>
  )
}
