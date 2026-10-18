'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import type { FrameLayout, PhotoSlot, FrameLayer } from '@/lib/types'
import { UIButton, UICard, UIStatusBanner } from '@/app/components/ui'
import LayoutSamplesManager from '@/app/components/LayoutSamplesManager'

const FrameEditor = dynamic(() => import('@/app/components/FrameEditor'), { ssr: false })

export default function LayoutEditPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [layout, setLayout] = useState<FrameLayout | null>(null)
  const [error, setError] = useState('')
  const [importError, setImportError] = useState('')
  const [editorVersion, setEditorVersion] = useState(0)

  useEffect(() => {
    fetch(`/api/layouts/${id}`)
      .then(r => { if (!r.ok) throw new Error('Not found'); return r.json() })
      .then(setLayout)
      .catch(() => setError('레이아웃을 찾을 수 없습니다'))
  }, [id])

  const handleSave = async (slots: PhotoSlot[], frameLayers: FrameLayer[], bgColor: string, bgCustomizable: boolean, samples: Pick<FrameLayout, 'testImageUrls' | 'testPreviewImageUrl'>) => {
    const res = await fetch(`/api/layouts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slots, frameLayers, backgroundColor: bgColor, backgroundColorCustomizable: bgCustomizable, ...samples }),
    })
    if (res.ok) {
      const updated = await res.json()
      setLayout(updated)
      alert('저장되었습니다!')
    } else throw new Error('레이아웃을 저장하지 못했어요. 다시 시도해 주세요.')
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

        {layout.printSize === '2x6' && <UICard>
          <div className="flex flex-wrap items-center gap-4">
            <a href="/frame-studio" target="_blank" rel="noreferrer" className="text-green-700 underline">웨딩 프레임 만들기 ↗</a>
            <label className="cursor-pointer text-sm border rounded px-4 py-3">웨딩 레이아웃 가져오기
              <input className="block mt-2" type="file" accept="application/json,.json" onChange={async e => {
                const file = e.target.files?.[0]; e.target.value = ''; if (!file) return
                try {
                  if (file.size > 2 * 1024 * 1024) throw new Error('2MB 이하 레이아웃 파일을 선택해 주세요.')
                  const data = JSON.parse(await file.text())
                  const { WEDDING_SLOTS } = await import('@/lib/weddingFrames')
                  if (data.format !== 'phototoast-wedding-v1' || data.printSize !== '2x6' || data.canvasWidth !== 600 || data.canvasHeight !== 1800 ||
                    !Array.isArray(data.slots) || data.slots.length !== 3 || !data.slots.every((slot: PhotoSlot, i: number) => ['x', 'y', 'width', 'height'].every(key => slot[key as keyof PhotoSlot] === WEDDING_SLOTS[i][key as keyof PhotoSlot])) ||
                    !Array.isArray(data.frameLayers) || data.frameLayers.length !== 1 || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(data.frameLayers[0]?.imageUrl)) throw new Error('프레임 스튜디오에서 내려받은 2×6 파일인지 확인해 주세요.')
                  const image = await new Promise<HTMLImageElement>((resolve, reject) => { const img = new window.Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = data.frameLayers[0].imageUrl })
                  if (image.naturalWidth !== 600 || image.naturalHeight !== 1800) throw new Error('프레임 크기가 올바르지 않아요.')
                  setLayout({ ...layout, slots: WEDDING_SLOTS.map(s => ({...s})), frameLayers: [{ id: 'wedding-overlay', name: '웨딩 프레임', imageUrl: data.frameLayers[0].imageUrl, zIndex: 100, opacity: 1, visible: true }], backgroundColor: '#FFFFFF', backgroundColorCustomizable: false, testImageUrls: {}, testPreviewImageUrl: '' })
                  setEditorVersion(v => v + 1); setImportError('가져왔습니다. 아래 편집기에서 확인한 뒤 저장해 주세요.')
                } catch (err) { setImportError(err instanceof Error ? err.message : '파일을 읽지 못했어요.') }
              }} />
            </label>
          </div>
          <p role="status" className="text-sm mt-3">{importError || '가져오면 편집 중인 프레임과 테스트 사진이 교체됩니다. 저장 전에는 서버에 반영되지 않습니다.'}</p>
        </UICard>}
        {/* Editor */}
        <FrameEditor
          key={`${layout._id}-${editorVersion}`}
          layout={layout}
          onSave={handleSave}
        />
        <UICard><LayoutSamplesManager layout={layout} onChange={setLayout} /></UICard>
      </div>
    </div>
  )
}
