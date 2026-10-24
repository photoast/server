'use client'
import { useEffect, useRef, useState } from 'react'
import type { KeepsakePhoto } from '@/lib/keepsake'
import s from './KeepsakeGifMaker.module.css'
export default function KeepsakeGifMaker({ photos, hasMore, loading, onLoadMore }: { photos: KeepsakePhoto[]; hasMore: boolean; loading: boolean; onLoadMore: () => Promise<void> }) {
  const body = useRef<HTMLDivElement>(null)
  const dialog = useRef<HTMLDialogElement>(null), controller = useRef<AbortController | null>(null), locked = useRef(false)
  const [opened, setOpened] = useState(false), [ids, setIds] = useState<string[]>([]), [delay, setDelay] = useState(800), [width, setWidth] = useState(360), [index, setIndex] = useState(0), [playing, setPlaying] = useState(false), [working, setWorking] = useState(false), [progress, setProgress] = useState(0), [error, setError] = useState(''), [result, setResult] = useState<{ url: string; blob: Blob } | null>(null)
  const chosen = ids.map(id => photos.find(photo => photo.id === id)).filter((photo): photo is KeepsakePhoto => Boolean(photo))
  useEffect(() => { setResult(null); setIndex(0); setError('') }, [ids, delay, width])
  useEffect(() => { if (!opened || !playing || chosen.length < 2) return; const timer = setInterval(() => setIndex(value => (value + 1) % chosen.length), delay); return () => clearInterval(timer) }, [opened, playing, chosen.length, delay])
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url) }, [result])
  useEffect(() => () => controller.current?.abort(), [])
  const close = () => { controller.current?.abort(); setPlaying(false); setOpened(false); setResult(null) }
  const toggle = (id: string) => { if (working) return; if (!ids.includes(id) && ids.length >= 20) { setError('최대 20장까지 선택할 수 있어요.'); return } setIds(ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id]) }
  const reorder = (position: number, direction: number) => { const next = [...ids], target = position + direction; if (target < 0 || target >= ids.length) return; [next[position], next[target]] = [next[target], next[position]]; setIds(next) }
  const create = async () => {
    if (locked.current || chosen.length < 2) return
    locked.current = true; setWorking(true); setPlaying(false); setProgress(0); setError(''); setResult(null)
    const abort = new AbortController(); controller.current = abort
    try {
      const { makeKeepsakeGif } = await import('@/lib/keepsakeGif')
      const blob = await makeKeepsakeGif(chosen.map(photo => photo.url), width, delay, abort.signal, setProgress)
      if (!abort.signal.aborted) { setResult({ url: URL.createObjectURL(blob), blob }); body.current?.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }) }
    } catch (e) { if (!(e instanceof Error && e.name === 'AbortError')) setError(e instanceof Error ? e.message : 'GIF 제작에 실패했어요. 다시 시도해 주세요.') }
    finally { locked.current = false; setWorking(false); controller.current = null }
  }
  return <><button className={s.trigger} onClick={() => { setOpened(true); body.current?.scrollTo(0, 0); dialog.current?.showModal() }}>GIF 만들기</button>
    <dialog ref={dialog} className={s.dialog} aria-label="추억 GIF 만들기" onClose={close}>
      <header className={s.header}><div><span>A LITTLE MOVING MEMORY</span><h2>추억을 움직이는 선물로</h2></div><button autoFocus aria-label="GIF 제작 닫기" onClick={() => dialog.current?.close()}>×</button></header>
      <div ref={body} className={s.body}>
        <section className={s.preview} aria-label="GIF 재생 미리보기">
          <div className={s.canvas}>{result ? <img src={result.url} alt="완성된 GIF 미리보기" /> : chosen.length ? <img src={chosen[index % chosen.length].url} alt="선택 사진 재생 미리보기" /> : <p>아래에서 사진을 골라<br />우리의 추억을 이어보세요.</p>}</div>
          {!result && <button disabled={chosen.length < 2 || working} onClick={() => setPlaying(value => !value)}>{playing ? '미리보기 멈춤 Ⅱ' : '미리보기 재생 ▷'}</button>}
          {result && <div className={s.result}><span>GIF 완성 · {(result.blob.size / 1024 / 1024).toFixed(1)} MB</span><a href={result.url} download="our-wedding-memories.gif">GIF 다운로드 ↓</a><p>다운로드한 파일에서 움직이는 사진을 확인할 수 있어요.</p></div>}
        </section>
        <section className={s.settings}>
          <div className={s.sectionHead}><h3>1. 사진 고르기 <span>{ids.length} / 20</span></h3><button disabled={working || !ids.length} onClick={() => setIds([])}>선택 해제</button></div>
          <p className={s.hint}>최소 2장 · 고른 순서대로 재생돼요.</p>
          <div className={s.photos}>{photos.map((photo, i) => <button key={photo.id} disabled={working} aria-label={`${i + 1}번째 사진 선택`} aria-pressed={ids.includes(photo.id)} onClick={() => toggle(photo.id)}><img src={photo.url} alt="" loading="lazy" />{ids.includes(photo.id) && <span>{ids.indexOf(photo.id) + 1}</span>}</button>)}</div>
          {hasMore && <button className={s.load} disabled={loading || working} onClick={async () => { try { await onLoadMore() } catch { setError('사진을 더 불러오지 못했어요. 다시 시도해 주세요.') } }}>{loading ? '사진 불러오는 중…' : '사진 더 불러오기'}</button>}
          {ids.length > 1 && <div className={s.order} aria-label="선택 사진 순서">{chosen.map((photo, i) => <div key={photo.id}><span>{i + 1}</span><img src={photo.url} alt={`${i + 1}번째 재생 사진`} /><div><button aria-label={`${i + 1}번째 사진 앞으로`} disabled={working || i === 0} onClick={() => reorder(i, -1)}>←</button><button aria-label={`${i + 1}번째 사진 뒤로`} disabled={working || i === ids.length - 1} onClick={() => reorder(i, 1)}>→</button></div></div>)}</div>}
          <h3>2. 전환 속도</h3><label className={s.interval}>사진 한 장당 <b>{(delay / 1000).toFixed(1)}초</b><input aria-label="GIF 사진 전환 간격" type="range" min="200" max="3000" step="100" value={delay} disabled={working} onChange={e => setDelay(Number(e.target.value))} /></label>
          <div className={s.presets}>{[300, 500, 1000, 2000].map(value => <button key={value} aria-pressed={delay === value} disabled={working} onClick={() => setDelay(value)}>{value / 1000}초</button>)}</div>
          <label className={s.size}>파일 크기<select aria-label="GIF 이미지 크기" disabled={working} value={width} onChange={e => setWidth(Number(e.target.value))}><option value={240}>가볍게 · 가로 240px</option><option value={360}>기본 · 가로 360px</option><option value={480}>크게 · 가로 480px</option></select></label>
          <p className={s.hint}>{chosen.length ? `${chosen.length}장 · 한 바퀴 ${(chosen.length * delay / 1000).toFixed(1)}초 · 계속 반복` : '사진을 선택하면 재생 시간을 보여드려요.'}</p>
          <div className={s.action}>{working ? <><p role="status">사진을 이어 붙이는 중… {progress}%</p><progress value={progress} max="100" /><button onClick={() => controller.current?.abort()}>제작 취소</button></> : <button disabled={chosen.length < 2} onClick={() => void create()}>GIF 만들기</button>}</div>
          {error && <p className={s.error} role="alert">{error}</p>}
          <p className={s.hint}>프레임 전체 비율을 유지해요. 제작은 이 기기에서 처리하며 별도로 업로드하지 않습니다.</p>
        </section>
      </div>
    </dialog>
  </>
}
