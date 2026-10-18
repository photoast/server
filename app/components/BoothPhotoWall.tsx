'use client'

import type { RandomPreviewConfig } from '@/lib/boothRandomPreviews'
import { renderRandomBoothPreviews } from '@/lib/renderRandomBoothPreviews'
import { useEffect, useState, type CSSProperties } from 'react'

type WallPhoto = { imageUrl: string }

export default function BoothPhotoWall({ slug, initialImageUrls = [], initialSamplesOnly = false, initialRandomPreview }: {
  slug: string; initialImageUrls?: string[]; initialSamplesOnly?: boolean; initialRandomPreview?: RandomPreviewConfig | null
}) {
  const [photos, setPhotos] = useState<WallPhoto[]>(() => Array.from(new Set(initialImageUrls.filter(Boolean))).slice(0, 6).map(imageUrl => ({ imageUrl })))
  const [initialLoading, setInitialLoading] = useState(initialImageUrls.length === 0)
  const [failed, setFailed] = useState<string[]>([])
  const [samplesOnly, setSamplesOnly] = useState(initialSamplesOnly)

  useEffect(() => {
    const controller = new AbortController()
    let loading = false
    let refreshed = false
    const refresh = async () => {
      if (document.hidden || loading) return
      loading = true
      try {
        const response = await fetch(`/api/events/slug/${encodeURIComponent(slug)}/booth-photos`, { cache: 'no-store', signal: controller.signal })
        if (!response.ok) return
        const data = await response.json()
        if (controller.signal.aborted || !Array.isArray(data.photos)) return
        let next: WallPhoto[] = Array.from(new Set<string>(data.photos.filter((photo: WallPhoto) => typeof photo?.imageUrl === 'string' && photo.imageUrl).map((photo: WallPhoto) => photo.imageUrl))).slice(0, 6).map(imageUrl => ({ imageUrl }))
        if (data.randomPreview) {
          try {
            const generated = await renderRandomBoothPreviews(data.randomPreview, 3, controller.signal)
            if (!generated.length && !next.length) return
            const merged = [...generated.map(imageUrl => ({imageUrl})), ...next]
            for (let i=merged.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [merged[i],merged[j]]=[merged[j],merged[i]] }
            next = merged.slice(0,6)
          } catch { if (!next.length) return }
        }
        // Preload the next set so the floating frames never flash empty.
        await Promise.all(next.map((photo: WallPhoto) => new Promise<void>(resolve => {
          const image = new Image()
          const timeout = window.setTimeout(resolve, 8000)
          const finish = () => { window.clearTimeout(timeout); resolve() }
          image.onload = finish
          image.onerror = finish
          image.src = photo.imageUrl
        })))
        if (!controller.signal.aborted) {
          refreshed = true
          setPhotos(next)
          setFailed([])
          setSamplesOnly(data.isSampleOnly === true)
        }
      } catch {
        // Retain the existing photo gallery when the network is unavailable.
      } finally {
        loading = false
        if (!controller.signal.aborted) setInitialLoading(false)
      }
    }
    if (initialRandomPreview) {
      void renderRandomBoothPreviews(initialRandomPreview,3,controller.signal).then(images=>{
        if (!refreshed && !controller.signal.aborted && images.length) {
          setPhotos(previous=>[...images.map(imageUrl=>({imageUrl})),...previous].slice(0,6));setInitialLoading(false)
        }
      }).catch(()=>{})
    }
    void refresh()
    const interval = window.setInterval(() => void refresh(), 30_000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      controller.abort()
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [slug])

  const visible = photos.filter(photo => !failed.includes(photo.imageUrl))
  if (!visible.length) return <div className="booth-message" role="status">
    {initialLoading && <span className="booth-spinner" />}
    <h2>{initialLoading ? '미리보기를 불러오고 있어요' : '여러분의 사진을 기다려요'}</h2>
    <p>{initialLoading ? '잠시만 기다려 주세요.' : '촬영을 시작해 첫 추억을 남겨 주세요.'}</p>
  </div>

  return <div className="booth-photo-wall" aria-label={samplesOnly ? '등록된 포토부스 샘플 미리보기' : '이 결혼식에서 함께 남긴 사진들'}>
    <div className={`booth-floating-photos booth-floating-count-${visible.length}`}>
      {visible.map((photo, index) => <div className="booth-floating-frame" key={photo.imageUrl}
        style={{ '--photo-index': index } as CSSProperties}>
        <img src={photo.imageUrl} alt={samplesOnly ? '프레임이 포함된 샘플 미리보기' : '프레임에 담긴 결혼식 기념 사진'} decoding="async"
          onError={() => setFailed(current => current.includes(photo.imageUrl) ? current : [...current, photo.imageUrl])} />
      </div>)}
    </div>
    <div className="booth-photo-wall-caption"><span>{samplesOnly ? 'FRAME PREVIEW' : 'OUR HAPPY MOMENTS'}</span><strong>{samplesOnly ? '이렇게 사진을 남겨요' : '오늘 함께 남긴 추억들'}</strong><p>{samplesOnly ? '샘플 미리보기 · 여러분의 사진으로 완성돼요.' : '이제 여러분의 사진도 남겨 주세요.'}</p></div>
  </div>
}
