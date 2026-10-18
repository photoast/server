'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FrameLayout } from '@/lib/types'
import { renderLayoutPreviewCanvas, uploadSampleCanvas } from '@/lib/boothSamples'

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image(); image.crossOrigin = 'anonymous'
  const timer = window.setTimeout(() => reject(new Error('프레임을 불러오지 못했어요. 다시 시도해 주세요.')), 15000)
  image.onload = () => { clearTimeout(timer); resolve(image) }; image.onerror = () => { clearTimeout(timer); reject(new Error('사진 또는 프레임을 불러오지 못했어요.')) }; image.src = src
})
export default function LayoutPreviewComposer({ layout, disabled, onRegister, onBusyChange }: { layout: FrameLayout; disabled: boolean; onRegister: (url: string) => Promise<void>; onBusyChange?: (busy: boolean) => void }) {
  const [photos, setPhotos] = useState<Map<string, HTMLImageElement>>(new Map())
  const [frames, setFrames] = useState<Map<string, HTMLImageElement>>(new Map())
  const [renderReady, setRenderReady] = useState(false)
  const [frameRetry, setFrameRetry] = useState(0)
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('')
  const canvas = useRef<HTMLCanvasElement>(null), composed = useRef<HTMLCanvasElement | null>(null), locked = useRef(false)
  const selectionRevision = useRef(0)
  const layers = useMemo(() => layout.frameLayers?.length ? layout.frameLayers : layout.frameUrl ? [{ id: 'legacy', name: '프레임', imageUrl: layout.frameUrl, visible: true, opacity: 1, zIndex: 100 }] : [], [layout.frameLayers, layout.frameUrl])
  useEffect(() => { onBusyChange?.(busy) }, [busy, onBusyChange])
  const slots = [...layout.slots].sort((a, b) => a.order - b.order)
  useEffect(() => {
    let cancelled = false
    setReady(false); setFrames(new Map())
    Promise.all(layers.filter(l => l.visible).map(async layer => [layer.id, await loadImage(layer.imageUrl)] as const))
      .then(entries => { if (!cancelled) { setFrames(new Map(entries)); setReady(true) } })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : '프레임을 불러오지 못했어요.') })
    return () => { cancelled = true }
  }, [layers, frameRetry])
  const complete = ready && layout.slots.length > 0 && layout.slots.every(s => photos.has(s.id))
  useEffect(() => {
    composed.current = null
    setRenderReady(false)
    const target = canvas.current
    if (!target) return
    if (!complete) { target.width = 1; target.height = 1; return }
    try {
      const output = renderLayoutPreviewCanvas(layout.canvasWidth, layout.canvasHeight, layout.backgroundColor || '#FFFFFF', layout.slots, layers, photos, frames)
      target.width = output.width; target.height = output.height; target.getContext('2d')!.drawImage(output, 0, 0)
      composed.current = output
      setRenderReady(true)
    } catch (e) { setError(e instanceof Error ? e.message : '미리보기를 만들지 못했어요.') }
  }, [complete, photos, frames, layout, layers])
  async function choose(files: File[], ids: string[]) {
    if (!files.length) return
    const revision = ++selectionRevision.current
    setError(''); setMessage(''); setBusy(true)
    try {
      if (files.length > ids.length) throw new Error(`사진은 ${ids.length}장까지 선택해 주세요.`)
      const entries = await Promise.all(files.map(async (file, index) => {
        if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) throw new Error('8MB 이하 JPG·PNG·WebP 사진을 선택해 주세요.')
        const url = URL.createObjectURL(file)
        try {
          const image = await loadImage(url), thumb = document.createElement('canvas')
          thumb.width = 160; thumb.height = 120
          const factor = Math.max(160 / image.naturalWidth, 120 / image.naturalHeight), w = image.naturalWidth * factor, h = image.naturalHeight * factor
          thumb.getContext('2d')!.drawImage(image, (160-w)/2, (120-h)/2, w, h)
          image.dataset.thumbnail = thumb.toDataURL('image/jpeg', .85)
          return [ids[index], image] as const
        } finally { URL.revokeObjectURL(url) }
      }))
      if (selectionRevision.current === revision) setPhotos(old => new Map([...Array.from(old), ...entries]))
    } catch (e) { setError(e instanceof Error ? e.message : '사진을 읽지 못했어요.') }
    finally { if (selectionRevision.current === revision) setBusy(false) }
  }
  return <div className="rounded-xl border border-green-200 bg-green-50/40 p-4 space-y-3">
    <div><h4 className="font-semibold text-gray-900">이 프레임으로 미리보기 만들기</h4><p className="mt-1 text-sm text-gray-600">사진을 칸에 넣으면 저장된 {layout.name} 프레임으로 합성됩니다. 중앙을 기준으로 잘라 보여드려요.</p></div>
    <label className="inline-flex min-h-11 items-center rounded-lg border border-green-200 bg-white px-4 text-sm text-green-800 cursor-pointer">사진 여러 장 선택<input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={disabled || busy} className="sr-only" onChange={e => { void choose(Array.from(e.target.files || []), slots.map(s => s.id)); e.target.value = '' }} /></label>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{slots.map((slot, i) => <label key={slot.id} className="rounded-lg border border-gray-200 bg-white p-2 cursor-pointer text-sm text-gray-700">
      {photos.get(slot.id) ? <img src={photos.get(slot.id)!.dataset.thumbnail} alt={`${i+1}번 칸 선택 사진`} className="h-20 w-full object-cover mb-2" /> : <div className="h-20 bg-gray-100 grid place-items-center mb-2 text-gray-400">{i+1}</div>}
      {i+1}번 사진 {photos.has(slot.id) ? '교체' : '선택'}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled || busy} onChange={e => { void choose(Array.from(e.target.files || []), [slot.id]); e.target.value = '' }} />
    </label>)}</div>
    {photos.size > 0 && <button type="button" disabled={disabled || busy} className="min-h-11 text-sm text-gray-600 underline" onClick={() => { setPhotos(new Map()); setMessage(''); setError('') }}>선택한 사진 비우기</button>}
    <div className={complete ? 'rounded-lg bg-gray-100 p-3 flex justify-center' : 'hidden'}><canvas ref={canvas} aria-label="선택한 프레임으로 합성한 미리보기" style={{ maxHeight: 480, maxWidth: '100%', width: 'auto', height: 'auto' }} /></div>
    <div className="flex flex-wrap items-center gap-3"><button type="button" disabled={disabled || busy || !complete || !renderReady} className="min-h-11 rounded-lg bg-green-800 text-white px-4 text-sm disabled:opacity-40" onClick={async () => {
      if (locked.current || !composed.current) return
      locked.current = true; setBusy(true); setError(''); setMessage('')
      try { const url = await uploadSampleCanvas(composed.current, 'image/png'); await onRegister(url); setMessage('프레임이 적용된 미리보기를 등록했어요. 사진을 바꿔 다른 샘플도 추가할 수 있습니다.') }
      catch(e) { setError(e instanceof Error ? e.message : '등록하지 못했어요.') }
      finally { locked.current = false; setBusy(false) }
    }}>{busy ? '처리 중…' : '프레임 적용해서 미리보기 등록'}</button><span className="text-xs text-gray-500">{photos.size}/{slots.length}칸 · 원본 크기 PNG · 인쇄하지 않음</span></div>
    {!ready && error && <button type="button" className="min-h-11 text-sm text-green-800 underline" onClick={() => { setError(''); setFrameRetry(n => n+1) }}>프레임 다시 불러오기</button>}
    {message && <p role="status" className="text-sm text-green-800">{message}</p>}{error && <p role="alert" className="text-sm text-red-600">{error}</p>}
  </div>
}
