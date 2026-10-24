'use client'
import { useEffect, useRef, useState } from 'react'
import { KeepsakeData, KeepsakePhoto, shuffleKeepsake } from '@/lib/keepsake'
import { renderRandomBoothPreviews } from '@/lib/renderRandomBoothPreviews'
import dynamic from 'next/dynamic'
import s from './keepsake.module.css'
const KeepsakeGifMaker = dynamic(() => import('@/app/components/KeepsakeGifMaker'), { ssr: false })
const Heart = () => <svg viewBox="0 0 60 48" width="48" height="40" fill="none" aria-hidden="true"><path d="M30 43C20 35 4 25 5 13C6 0 23 0 30 11C37 0 54 0 55 13C56 25 40 35 30 43Z" stroke="currentColor" strokeWidth="1.2" /></svg>
export default function KeepsakePage({ params }: { params: { token: string } }) {
  const [data, setData] = useState<KeepsakeData | null>(null), [photos, setPhotos] = useState<KeepsakePhoto[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false), [selected, setSelected] = useState<KeepsakePhoto | null>(null), [saving, setSaving] = useState(false), [notice, setNotice] = useState('')
  const [sampleCovers, setSampleCovers] = useState<string[]>([]), [zoom, setZoom] = useState(1)
  const photoMenu = useRef<HTMLDetailsElement>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null), viewer = useRef<HTMLDivElement>(null)
  const dialog = useRef<HTMLDialogElement>(null), gallery = useRef<HTMLElement>(null), lock = useRef(false)
  const load = async (page = 1) => {
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try {
      const res = await fetch(`/api/keepsakes/${params.token}?page=${page}`, { cache: 'no-store' })
      const next: KeepsakeData & { error?: string } = await res.json()
      if (!res.ok) throw new Error(next.error)
      setData(next)
      const batch = shuffleKeepsake(next.photos)
      setPhotos(previous => page === 1 ? batch : Array.from(new Map([...previous, ...batch].map(p => [p.url, p])).values()))
      return batch[0]
    } catch (e) { setError(e instanceof Error ? e.message : '앨범을 열지 못했어요.') }
    finally { setBusy(false); lock.current = false }
  }
  useEffect(() => { void load() }, [params.token]) // eslint-disable-line react-hooks/exhaustive-deps
  const coverKey = JSON.stringify({ cover: data?.cover || [], randomPreview: data?.randomPreview || null })
  useEffect(() => {
    const sample: Pick<KeepsakeData, 'cover' | 'randomPreview'> = JSON.parse(coverKey)
    const controller = new AbortController()
    setSampleCovers(sample.cover)
    if (sample.randomPreview) {
      void renderRandomBoothPreviews(sample.randomPreview, 3, controller.signal)
        .then(images => { if (!controller.signal.aborted && images.length) setSampleCovers([...images, ...sample.cover].slice(0, 3)) })
        .catch(() => { /* Retain registered completed samples; never substitute guest history. */ })
    }
    return () => controller.abort()
  }, [coverKey])
  const move = async (direction: number) => {
    if (!selected || saving || busy) return
    if (photoMenu.current) photoMenu.current.open = false
    const index = photos.findIndex(p => p.id === selected.id)
    const next = photos[index + direction]
    if (next) { setSelected(next); setZoom(1); setNotice(''); viewer.current?.scrollTo(0, 0) }
    else if (direction > 0 && data?.hasMore) {
      const first = await load(data.page + 1)
      if (first) { setSelected(first); setZoom(1); setNotice(''); viewer.current?.scrollTo(0, 0) }
      else setNotice('다음 사진을 불러오지 못했어요. 연결을 확인하고 다시 눌러 주세요.')
    }
  }
  const open = (photo: KeepsakePhoto) => { if (photoMenu.current) photoMenu.current.open = false; setSelected(photo); setZoom(1); setNotice(''); dialog.current?.showModal() }
  const save = async () => {
    if (!selected || saving) return
    setSaving(true); setNotice('')
    try {
      const res = await fetch(selected.url, { referrerPolicy: 'no-referrer' })
      if (!res.ok) throw new Error()
      const file = new File([await res.blob()], `our-wedding-${selected.id}.jpg`, { type: 'image/jpeg' })
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: data?.title })
      else { const url = URL.createObjectURL(file); const a = document.createElement('a'); a.href = url; a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000); setNotice('다운로드를 시작했어요.') }
    } catch (e) { if (!(e instanceof Error && e.name === 'AbortError')) setNotice('사진을 길게 눌러 저장하거나 원본을 열어 주세요.') }
    finally { setSaving(false) }
  }
  const covers = sampleCovers
  const selectedIndex = selected ? photos.findIndex(p => p.id === selected.id) : -1
  return <main className={s.page}>
    <header className={s.header}><span>A DAY TO REMEMBER</span></header>
    {!data ? <section className={s.loading}><Heart /><h1>{error ? '아직 앨범을 열지 못했어요' : '소중한 순간을 펼치는 중'}</h1><p role={error ? 'alert' : 'status'}>{error || '잠시만 기다려 주세요.'}</p>{error && <button onClick={() => void load()} disabled={busy}>다시 열어보기</button>}</section> : <>
      <section className={s.cover}>
        <p className={s.eyebrow}>FOR THE TWO OF YOU</p>
        <p className={s.script}>Our wedding day</p>
        <h1>{data.title}</h1>
        {data.date && <p className={s.date}>{data.date.replace(/-/g, ' . ')}</p>}
        <button className={s.open} onClick={() => gallery.current?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}>우리의 하루 펼쳐보기 <span>↓</span></button>
        <div className={s.bouquet} aria-label="우리의 웨딩 프레임">
          {covers.length ? [0, 1, 2].map((n) => <div className={s.strip} key={n}><img src={covers[n % covers.length]} alt={`표지를 꾸민 웨딩 사진 ${n + 1}`} fetchPriority={n === 1 ? 'high' : 'auto'} /></div>) : <div className={s.blank}><Heart /><span>곧, 우리의 추억으로<br />채워질 한 페이지</span></div>}
          <div className={s.seal}><Heart /></div>
        </div>
        <div className={s.letter}><p>축하해 주신 마음과<br />함께 웃었던 순간들을 모아,<br />두 분께 작은 선물을 전합니다.</p><p>오늘의 행복을<br />오래오래 꺼내 보세요.</p></div>
        <p className={s.caption}>A little gift, filled with love.</p>
      </section>
      <section ref={gallery} id="memories" className={s.memories}>
        <div className={s.sectionTitle}><span>01 / THE MEMORIES</span><Heart /><h2>그날의 우리,<br />그리고 소중한 사람들</h2><p>한 장마다 담긴 축하와 웃음.<br />사진을 누르면 크게 보고 간직할 수 있어요.</p></div>
        {photos.length > 0 ? <><div className={s.tools}><span>서로 다른 추억 {data.total}장</span><KeepsakeGifMaker photos={photos} hasMore={data.hasMore} loading={busy} onLoadMore={async () => { if (!await load(data.page + 1)) throw new Error('사진 불러오기 실패') }} /><button onClick={() => setPhotos(shuffleKeepsake(photos))}>다시 섞어보기 ↻</button></div><div className={s.grid}>{photos.map((photo, i) => <button key={photo.id} className={s.photo} onClick={() => open(photo)} aria-label={`${i + 1}번째 추억 크게 보기`}><img src={photo.url} alt={`${i + 1}번째 웨딩 포토스트립`} loading="lazy" /><span>{String(i + 1).padStart(2, '0')} <i>with love</i></span></button>)}</div></> : <div className={s.empty}><Heart /><p>첫 번째 추억을 기다리고 있어요.</p><p>촬영한 사진이 준비되면 여기에 모여요.</p><button disabled={busy} onClick={() => void load()}>새 사진 확인하기</button></div>}
        {error && <p role="alert" className={s.error}>{error}<button disabled={busy} onClick={() => void load(data.page + 1)}>다시 시도</button></p>}
        {data.hasMore && <button className={s.more} disabled={busy} onClick={() => void load(data.page + 1)}>{busy ? '추억을 불러오는 중…' : '다음 추억도 펼쳐보기 ↓'}</button>}
      </section>
      <footer className={s.footer}><Heart /><p className={s.script}>Thank you for being with us</p><p>함께한 마음이 오래도록 남기를.</p><span>WITH LOVE, ALWAYS</span></footer>
    </>}
    <dialog ref={dialog} aria-label="웨딩 사진 앨범" className={s.dialog} onClose={() => { setSelected(null); setZoom(1) }} onKeyDown={e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); void move(e.key === 'ArrowRight' ? 1 : -1) } }} onClick={e => { if (e.target === e.currentTarget) dialog.current?.close() }}>
      <div className={s.dialogBar}><span className={s.dialogCounter} aria-live="polite">{selectedIndex + 1} <span>/ {data?.total || photos.length}</span></span><div className={s.viewerActions}>
        <button className={s.iconButton} aria-label={zoom > 1 ? '사진 축소' : '사진 확대'} onClick={() => setZoom(value => value === 1 ? 2 : 1)}><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><path d="m15 15 5 5M7 10h6"/>{zoom === 1 && <path d="M10 7v6"/>}</svg></button>
        <details ref={photoMenu} className={s.photoMenu}><summary aria-label="사진 메뉴">···</summary><div className={s.menuPanel}>{selected && <a href={selected.url} target="_blank" rel="noreferrer">원본 열기 ↗</a>}<p>사진을 두 번 누르면 확대돼요.<br />아이폰에서는 저장 후 공유 메뉴에서 ‘이미지 저장’을 선택해 주세요.</p></div></details>
        <button className={s.iconButton} autoFocus onClick={() => dialog.current?.close()} aria-label="사진 닫기"><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
      </div></div>
      {selected && <><div className={s.photoStage}><div ref={viewer} className={`${s.viewer} ${zoom > 1 ? s.zoomed : ''}`} onDoubleClick={() => setZoom(value => value === 1 ? 2 : 1)} onTouchStart={e => { touchStart.current = e.touches.length === 1 && zoom === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null }} onTouchMove={e => { if (e.touches.length !== 1) touchStart.current = null }} onTouchEnd={e => { const start = touchStart.current; touchStart.current = null; if (!start || zoom !== 1 || !e.changedTouches.length) return; const dx = e.changedTouches[0].clientX - start.x, dy = e.changedTouches[0].clientY - start.y; if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) void move(dx < 0 ? 1 : -1) }}>
        <img className={s.fullPhoto} style={zoom > 1 ? { height: 'auto', maxWidth: 'none', width: '200%', maxHeight: 'none' } : undefined} src={selected.url} alt="크게 보는 웨딩 사진" />
      </div><button className={`${s.sideArrow} ${s.previous}`} aria-label="이전 사진" disabled={selectedIndex <= 0 || saving || busy} onClick={() => void move(-1)}><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg></button><button className={`${s.sideArrow} ${s.next}`} aria-label="다음 사진" disabled={saving || busy || (selectedIndex === photos.length - 1 && !data?.hasMore)} onClick={() => void move(1)}><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button></div>
      <div className={s.compactSave}><button disabled={saving} onClick={save}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4"/></svg>{saving ? '사진 준비 중…' : '사진 저장'}</button>{notice && <p role="status">{notice}</p>}</div></>}

    </dialog>
  </main>
}
