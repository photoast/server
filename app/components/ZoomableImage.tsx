'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './ZoomableImage.css'

export default function ZoomableImage({ src, alt, transparent = false }: { src: string; alt: string; transparent?: boolean }) {
  const [open, setOpen] = useState(false), [zoom, setZoom] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null), trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.current?.showModal()
    return () => { document.body.style.overflow = previous; trigger.current?.focus({ preventScroll: true }) }
  }, [open])
  return <>
    <button ref={trigger} className="proposal-image-trigger" aria-label={`${alt} 크게 보기`} onClick={() => { setZoom(false); setOpen(true) }}>
      <img src={src} alt={alt} /><span className="proposal-image-hint">확대 ↗</span>
    </button>
    {open && createPortal(<dialog ref={dialog} className={`image-viewer ${zoom ? 'is-zoomed' : ''}`} aria-label={`${alt} 확대 보기`} onCancel={e => { e.preventDefault(); setOpen(false) }} onClose={() => setOpen(false)} onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}>
      <div className="image-viewer-toolbar"><h2>{alt}</h2><button aria-pressed={zoom} onClick={() => setZoom(v => !v)}>{zoom ? '전체 보기' : '원본 크기로 확대'}</button><button autoFocus aria-label="확대 보기 닫기" onClick={() => setOpen(false)}>닫기 ✕</button></div>
      <div className="image-viewer-stage" onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}>
        <button className={`image-viewer-image ${transparent ? 'is-transparent' : ''}`} aria-label={zoom ? '이미지 전체 보기' : '이미지 원본 크기로 확대'} onClick={() => setZoom(v => !v)}><img src={src} alt={alt} /></button>
      </div><p className="image-viewer-help">{zoom ? '스크롤하거나 밀어서 자세히 보세요.' : '이미지를 누르면 원본 크기로 확대됩니다.'}</p>
    </dialog>, document.body)}
  </>
}
