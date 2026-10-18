'use client'
import { useEffect, useRef, useState } from 'react'
import type { ProposalItem } from '@/lib/frameProposals'
import ZoomableImage from './ZoomableImage'
import { WEDDING_SLOTS } from '@/lib/weddingFrames'

const load = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src
})
export default function ProposalSample({ item, photos }: { item: ProposalItem; photos?: string[] }) {
  const ref = useRef<HTMLElement>(null)
  const [src, setSrc] = useState(item.preview || ''), [error, setError] = useState(false), [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!photos?.length) return
    let cancelled = false, started = false
    const render = async () => {
      if (started) return
      started = true; setError(false)
      try {
        const [overlay, ...images] = await Promise.all([item.overlay, ...photos].map(load))
        if (cancelled) return
        const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 1800
        const ctx = canvas.getContext('2d')!
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'
        WEDDING_SLOTS.forEach((slot, i) => ctx.drawImage(images[i], slot.x, slot.y, slot.width, slot.height))
        ctx.drawImage(overlay, 0, 0, 600, 1800)
        setSrc(canvas.toDataURL('image/png'))
      } catch { if (!cancelled) setError(true) }
    }
    const observer = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { observer.disconnect(); void render() } }, { rootMargin: '400px' })
    if (ref.current) observer.observe(ref.current)
    return () => { cancelled = true; observer.disconnect() }
  }, [item.overlay, photos, retry])
  return <figure ref={ref}>
    {src ? <ZoomableImage src={src} alt={`${item.name}에 샘플 사진을 넣은 모습`} /> : <div className="proposal-sample-loading">{error ? <button onClick={() => setRetry(n => n + 1)}>샘플 다시 불러오기</button> : '샘플을 준비하고 있어요…'}</div>}
    <figcaption>사진을 담은 모습</figcaption>
    {src && <a className="proposal-sample-download" href={src} download={`phototoast-${item.id}-sample.${photos?.length ? 'png' : 'jpg'}`}>샘플 이미지 ↓</a>}
  </figure>
}
