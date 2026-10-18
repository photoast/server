'use client'

import { useEffect, useState } from 'react'
import type { FrameLayout } from '@/lib/types'
import LayoutPreviewComposer from './LayoutPreviewComposer'
import { uploadPreviewFile } from '@/lib/boothSamples'

export default function LayoutSamplesManager({ layout, onChange }: { layout: FrameLayout; onChange?: (layout: FrameLayout) => void }) {
  const [current, setCurrent] = useState(layout)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  useEffect(() => { setCurrent(layout) }, [layout])

  const save = async (updates: Partial<FrameLayout>) => {
    const response = await fetch(`/api/layouts/${layout._id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || '미리보기를 저장하지 못했어요.')
    setCurrent(data)
    onChange?.(data)
    return data as FrameLayout
  }
  const update = async (updates: Partial<FrameLayout>) => {
    setBusy(true); setError(''); setStatus('')
    try { await save(updates); setStatus('저장됐어요.') }
    catch (err) { setError(err instanceof Error ? err.message : '저장하지 못했어요.') }
    finally { setBusy(false) }
  }
  const urls = current.previewImageUrls || []

  return <section className="space-y-4">
    <div><h3 className="text-base font-semibold text-gray-900">포토부스 미리보기 갤러리</h3>
      <p className="mt-1 text-sm text-gray-500">{layout.name} 전용입니다. 사진을 넣어 이 레이아웃의 프레임으로 합성한 뒤, 인쇄 없이 여러 장 등록하세요.</p></div>
    <label className="block text-sm font-medium text-gray-700">첫 화면에 보여줄 사진
      <select value={current.boothPreviewSource || 'samples'} disabled={busy}
        onChange={e => void update({ boothPreviewSource: e.target.value as FrameLayout['boothPreviewSource'] })}
        className="mt-2 block min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3">
        <option value="samples">등록한 미리보기 우선 · 없으면 인화 사진</option>
        <option value="prints">이 레이아웃의 인화 사진만</option>
        <option value="mixed">등록한 미리보기 + 인화 사진 랜덤</option>
      </select>
    </label>
    <LayoutPreviewComposer key={layout._id} layout={current} disabled={busy || urls.length >= 30} onBusyChange={setBusy} onRegister={async url => {
      if (urls.length >= 30) throw new Error('미리보기는 최대 30장까지 등록할 수 있어요.')
      await save({ previewImageUrls: [...urls, url] })
    }} />
    <details className="rounded-xl border border-gray-200 p-3"><summary className="min-h-11 cursor-pointer text-sm text-gray-600">이미 프레임까지 합성된 완성 이미지가 있다면</summary>
    <div className="flex flex-wrap items-center gap-3">
      <label className={`inline-flex min-h-11 items-center rounded-xl bg-blue-50 px-4 text-sm font-semibold text-blue-700 ${busy ? 'opacity-50' : 'cursor-pointer'}`}>
        {busy ? '저장 중…' : '합성된 완성 이미지 업로드'}
        <input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busy || urls.length >= 30} className="sr-only"
          onChange={async e => {
            const files = Array.from(e.target.files || [])
            e.target.value = ''
            if (!files.length) return
            if (files.length + urls.length > 30) { setError('미리보기는 최대 30장까지 등록할 수 있어요.'); return }
            setBusy(true); setError(''); setStatus('')
            let saved = 0
            let next = [...urls]
            try {
              for (const file of files) {
                setStatus(`${saved + 1} / ${files.length}장 저장 중…`)
                const url = await uploadPreviewFile(file)
                next = [...next, url]
                await save({ previewImageUrls: next })
                saved++
              }
              setStatus(`${saved}장 저장됐어요. 인쇄는 요청하지 않았습니다.`)
            } catch (err) {
              setStatus(saved ? `${saved}장까지 저장됐어요.` : '')
              setError(err instanceof Error ? err.message : '등록하지 못했어요.')
            } finally { setBusy(false) }
          }} />
      </label>
      <span className="text-xs text-gray-500">JPG · PNG · WebP, 장당 8MB 이하 · {urls.length}/30장</span>
      <a href={`/admin/layouts/${layout._id}/edit`} className="inline-flex min-h-11 items-center text-sm text-blue-600 underline">슬롯별 테스트 사진 편집 ↗</a>
    </div>
    </details>
    {(current.testPreviewImageUrl || urls.length > 0) ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {current.testPreviewImageUrl && <div className="rounded-xl border border-gray-200 p-2">
        <img src={current.testPreviewImageUrl} alt="슬롯별 테스트 사진으로 만든 완성 샘플" className="h-44 w-full bg-gray-100 object-contain" />
        <p className="mt-2 text-xs text-gray-500">편집기 테스트 샘플 · 저장 시 갱신</p>
        <button type="button" disabled={busy} onClick={() => void update({ testPreviewImageUrl: '' })} className="min-h-11 text-sm text-red-600">미리보기에서 제거</button>
      </div>}
      {urls.map((url, index) => <div key={url} className="rounded-xl border border-gray-200 p-2">
        <img src={url} alt={`등록한 완성 미리보기 ${index + 1}`} className="h-44 w-full bg-gray-100 object-contain" />
        <button type="button" disabled={busy} onClick={() => void update({ previewImageUrls: urls.filter(item => item !== url) })} className="min-h-11 text-sm text-red-600">미리보기 삭제</button>
      </div>)}
    </div> : <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">등록된 미리보기가 없어요. 위에서 각 칸의 사진을 선택하고 프레임을 적용해 등록해 주세요.</p>}
    {status && <p role="status" className="text-sm text-green-700">{status}</p>}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
  </section>
}
