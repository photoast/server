'use client'

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'

type WallPhoto = { imageUrl: string }

export default function BoothPhotoWall({ slug, fallback }: { slug: string; fallback: ReactNode }) {
  const [photos, setPhotos] = useState<WallPhoto[]>([])
  const [failed, setFailed] = useState<string[]>([])

  useEffect(() => {
    const controller = new AbortController()
    let loading = false
    const refresh = async () => {
      if (document.hidden || loading) return
      loading = true
      try {
        const response = await fetch(`/api/events/slug/${encodeURIComponent(slug)}/booth-photos`, { cache: 'no-store', signal: controller.signal })
        if (!response.ok) return
        const data = await response.json()
        if (controller.signal.aborted || !Array.isArray(data.photos)) return
        const next = data.photos.filter((photo: WallPhoto) => typeof photo?.imageUrl === 'string' && photo.imageUrl).slice(0, 6)
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
          setPhotos(next)
          setFailed([])
        }
      } catch {
        // Retain the last wall (or the layout sample) when the network is unavailable.
      } finally {
        loading = false
      }
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
  if (!visible.length) return <>{fallback}</>

  return <div className="booth-photo-wall" aria-label="이 결혼식에서 함께 남긴 사진들">
    <div className={`booth-floating-photos booth-floating-count-${visible.length}`}>
      {visible.map((photo, index) => <div className="booth-floating-frame" key={photo.imageUrl}
        style={{ '--photo-index': index } as CSSProperties}>
        <img src={photo.imageUrl} alt="프레임에 담긴 결혼식 기념 사진" decoding="async"
          onError={() => setFailed(current => current.includes(photo.imageUrl) ? current : [...current, photo.imageUrl])} />
      </div>)}
    </div>
    <div className="booth-photo-wall-caption"><span>OUR HAPPY MOMENTS</span><strong>오늘 함께 남긴 추억들</strong><p>이제 여러분의 사진도 남겨 주세요.</p></div>
  </div>
}
