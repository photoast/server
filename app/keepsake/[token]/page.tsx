'use client'
import { useEffect, useRef, useState } from 'react'
import { KeepsakeData, KeepsakePhoto, shuffleKeepsake } from '@/lib/keepsake'
import s from './keepsake.module.css'
const Heart = () => <svg viewBox="0 0 60 48" width="48" height="40" fill="none" aria-hidden="true"><path d="M30 43C20 35 4 25 5 13C6 0 23 0 30 11C37 0 54 0 55 13C56 25 40 35 30 43Z" stroke="currentColor" strokeWidth="1.2" /></svg>
export default function KeepsakePage({ params }: { params: { token: string } }) {
  const [data, setData] = useState<KeepsakeData | null>(null), [photos, setPhotos] = useState<KeepsakePhoto[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false), [selected, setSelected] = useState<KeepsakePhoto | null>(null), [saving, setSaving] = useState(false), [notice, setNotice] = useState('')
  const dialog = useRef<HTMLDialogElement>(null), gallery = useRef<HTMLElement>(null), lock = useRef(false)
  const load = async (page = 1) => {
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try {
      const res = await fetch(`/api/keepsakes/${params.token}?page=${page}`, { cache: 'no-store' })
      const next: KeepsakeData & { error?: string } = await res.json()
      if (!res.ok) throw new Error(next.error)
      setData(next)
      setPhotos(previous => shuffleKeepsake(page === 1 ? next.photos : Array.from(new Map([...previous, ...next.photos].map(p => [p.url, p])).values())))
    } catch (e) { setError(e instanceof Error ? e.message : '앨범을 열지 못했어요.') }
    finally { setBusy(false); lock.current = false }
  }
  useEffect(() => { void load() }, [params.token]) // eslint-disable-line react-hooks/exhaustive-deps
  const open = (photo: KeepsakePhoto) => { setSelected(photo); setNotice(''); dialog.current?.showModal() }
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
  const covers = data?.cover.length ? data.cover : photos.slice(0, 3).map(p => p.url)
  return <main className={s.page}>
    <header className={s.header}><a href="#" aria-label="앨범 처음으로">PhotoToast <span>keepsakes</span></a><span>A DAY TO REMEMBER</span></header>
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
        {photos.length > 0 ? <><div className={s.tools}><span>서로 다른 추억 {data.total}장</span><button onClick={() => setPhotos(shuffleKeepsake(photos))}>다시 섞어보기 ↻</button></div><div className={s.grid}>{photos.map((photo, i) => <button key={photo.id} className={s.photo} onClick={() => open(photo)} aria-label={`${i + 1}번째 추억 크게 보기`}><img src={photo.url} alt={`${i + 1}번째 웨딩 포토스트립`} loading="lazy" /><span>{String(i + 1).padStart(2, '0')} <i>with love</i></span></button>)}</div></> : <div className={s.empty}><Heart /><p>첫 번째 추억을 기다리고 있어요.</p><p>촬영한 사진이 준비되면 여기에 모여요.</p><button disabled={busy} onClick={() => void load()}>새 사진 확인하기</button></div>}
        {error && <p role="alert" className={s.error}>{error}<button disabled={busy} onClick={() => void load(data.page + 1)}>다시 시도</button></p>}
        {data.hasMore && <button className={s.more} disabled={busy} onClick={() => void load(data.page + 1)}>{busy ? '추억을 불러오는 중…' : '다음 추억도 펼쳐보기 ↓'}</button>}
      </section>
      <footer className={s.footer}><Heart /><p className={s.script}>Thank you for being with us</p><p>함께한 마음이 오래도록 남기를.</p><span>MADE WITH LOVE · PHOTOTOAST</span></footer>
    </>}
    <dialog ref={dialog} className={s.dialog} onClose={() => setSelected(null)} onClick={e => { if (e.target === e.currentTarget) dialog.current?.close() }}>
      <div className={s.dialogBar}><span>오늘의 소중한 한 장</span><button autoFocus onClick={() => dialog.current?.close()} aria-label="사진 닫기">닫기 ×</button></div>
      {selected && <><img className={s.fullPhoto} src={selected.url} alt="크게 보는 웨딩 사진" /><div className={s.saveBar}><button disabled={saving} onClick={save}>{saving ? '사진 준비 중…' : '사진 간직하기 ↓'}</button><a href={selected.url} target="_blank" rel="noreferrer">원본 열기 ↗</a><p role="status">{notice || '아이폰에서는 공유 메뉴에서 ‘이미지 저장’을 선택해 주세요.'}</p></div></>}
    </dialog>
  </main>
}
