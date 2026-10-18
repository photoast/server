'use client'
import { useRef, useState } from 'react'
import { encodeProposalPhotos } from '@/lib/proposalPhotos'
import { drawWeddingFrame, WEDDING_STYLES, type WeddingOptions, type WeddingStyle } from '@/lib/weddingFrames'

interface Props { options: WeddingOptions; photos: (HTMLImageElement | null)[]; ready: boolean }
interface EventChoice { _id: string; name: string }
export default function FrameStudioPublishing({ options, photos, ready }: Props) {
  const [events, setEvents] = useState<EventChoice[]>([]), [eventId, setEventId] = useState('')
  const [busy, setBusy] = useState(''), [message, setMessage] = useState('')
  const [layout, setLayout] = useState<{ id: string; key: string } | null>(null)
  const [proposalUrl, setProposalUrl] = useState('')
  const [title, setTitle] = useState('')
  const [order, setOrder] = useState<WeddingStyle[]>(WEDDING_STYLES.map(s => s.id))
  const lock = useRef(false)
  const key = JSON.stringify({ eventId, options })
  async function task(name: string, action: () => Promise<void>) {
    if (lock.current) return
    lock.current = true; setBusy(name); setMessage('')
    try { await action() } catch (e) { setMessage(e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요.') }
    finally { lock.current = false; setBusy('') }
  }
  async function responseJson(response: Response) {
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || '요청을 완료하지 못했어요.')
    return data
  }
  function move(index: number, direction: number) {
    setOrder(old => { const next = [...old]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; return next })
  }
  return <section className="ws-publishing" aria-label="이벤트 등록과 제안 링크">
    <div className="ws-section-title"><span>03</span><h2>이벤트에 바로 등록</h2></div>
    <p>선택한 프레임과 동일한 사진 슬롯 3개를 하나의 새 레이아웃으로 저장합니다.</p>
    <div className="ws-publish-row"><button disabled={Boolean(busy)} onClick={() => void task('events', async () => {
      const data = await responseJson(await fetch('/api/events', { cache: 'no-store' }))
      setEvents(data.map((event: EventChoice) => ({ _id: event._id, name: event.name })))
      if (!data.length) { setMessage('등록할 이벤트가 없어요. 관리자에서 이벤트를 먼저 만들어 주세요.'); return }
      setEventId(previous => previous || data[0]._id)
    })}>{busy === 'events' ? '불러오는 중…' : '이벤트 불러오기'}</button>
    <select aria-label="등록할 이벤트" value={eventId} disabled={!events.length || Boolean(busy)} onChange={e => setEventId(e.target.value)}><option value="">이벤트 선택</option>{events.map(event => <option key={event._id} value={event._id}>{event.name}</option>)}</select>
    <button disabled={!ready || Boolean(busy) || !eventId || layout?.key === key} onClick={() => void task('register', async () => {
      if (!options.names.trim()) throw new Error('두 사람의 이름을 입력해 주세요.')
      const canvas = document.createElement('canvas'); await drawWeddingFrame(canvas, options)
      const data = await responseJson(await fetch('/api/wedding-layouts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId, name: `${options.names} · ${WEDDING_STYLES.find(s => s.id === options.style)?.name}`, overlay: canvas.toDataURL('image/png') }) }))
      setLayout({ id: data.id, key }); setMessage('이벤트 레이아웃으로 등록했어요. 편집기에서 확인할 수 있습니다.')
    })}>{busy === 'register' ? '등록 중…' : layout?.key === key ? '등록 완료' : '선택한 프레임 등록'}</button></div>
    {layout && <a className="ws-publish-link" href={`/admin/layouts/${layout.id}/edit`}>등록한 레이아웃 확인 ↗</a>}
    <p className="ws-publish-note">촬영에 사용하려면 관리자 이벤트 설정에서 이 레이아웃을 선택해 주세요.</p>
    <div className="ws-section-title ws-photo-heading"><span>04</span><h2>두 분께 제안하기</h2></div>
    <p>사진 3장을 넣으면 디자인마다 완성 샘플을 만들어, 번호순으로 비교할 수 있는 공유 페이지에 담습니다.</p>
    <label className="ws-proposal-title">제안 제목<input value={title} maxLength={100} placeholder={`${options.names}님의 웨딩 프레임 제안`} onChange={e => setTitle(e.target.value)} /></label>
    <details className="ws-proposal-order"><summary>제안할 디자인 {order.length}개 · 구성과 순서 편집</summary>
      <p className="ws-publish-note">체크한 순서대로 공유됩니다. 화살표로 순서를 바꿀 수 있어요.</p>
      <div className="ws-proposal-checks">{WEDDING_STYLES.map(style => <label key={style.id}><input type="checkbox" checked={order.includes(style.id)} onChange={e => setOrder(old => e.target.checked ? [...old, style.id] : old.filter(id => id !== style.id))} />{style.name}</label>)}</div>
      <ol>{order.map((id, i) => <li key={id}><span>{String(i + 1).padStart(2, '0')} · {WEDDING_STYLES.find(s => s.id === id)?.name}</span><button disabled={i === 0} aria-label={`${id} 위로 이동`} onClick={() => move(i, -1)}>↑</button><button disabled={i === order.length - 1} aria-label={`${id} 아래로 이동`} onClick={() => move(i, 1)}>↓</button></li>)}</ol>
    </details>
    <p className="ws-publish-note">링크를 가진 분은 샘플 사진과 프레임을 보고 선택을 저장할 수 있습니다. 공유할 사진인지 확인해 주세요. 발급된 제안은 현재 입력의 스냅샷으로 저장됩니다.</p>
    <button className="ws-create-proposal" disabled={!ready || Boolean(busy) || !order.length} onClick={() => void task('proposal', async () => {
      if (!options.names.trim()) throw new Error('두 사람의 이름을 입력해 주세요.')
      if (photos.some(p => !p)) throw new Error('제안에 담을 샘플 사진 3장을 먼저 선택해 주세요.')
      const items = []
      for (const id of order) {
        const style = WEDDING_STYLES.find(s => s.id === id)!
        const settings = { ...options, style: id }, frame = document.createElement('canvas')
        await drawWeddingFrame(frame, settings)
        items.push({ id, name: style.name, options: settings, overlay: frame.toDataURL('image/png') })
      }
      const body = JSON.stringify({ photos: encodeProposalPhotos(photos), title: title.trim() || `${options.names}님의 웨딩 프레임 제안`, items })
      if (new Blob([body]).size > 3500000) throw new Error('제안 파일이 커요. 디자인 수를 줄여 다시 만들어 주세요.')
      const data = await responseJson(await fetch('/api/frame-proposals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }))
      setProposalUrl(`${window.location.origin}/frame-proposals/${data.id}`); setMessage('제안 링크를 만들었어요. 아래 링크를 공유해 주세요.')
    })}>{busy === 'proposal' ? '샘플과 제안 링크를 만드는 중…' : '제안 링크 만들기'}</button>
    {proposalUrl && <div className="ws-share-result"><a href={proposalUrl} target="_blank" rel="noreferrer">제안 페이지 열기 ↗</a><input aria-label="공유할 제안 링크" value={proposalUrl} readOnly onFocus={e => e.target.select()} /><button onClick={() => { void navigator.clipboard.writeText(proposalUrl).then(() => setMessage('제안 링크를 복사했어요.')).catch(() => setMessage('위 주소를 선택해 복사해 주세요.')) }}>링크 복사</button></div>}
    <p className="ws-status" role="status">{message}</p><a className="ws-publish-note" href="/admin" target="_blank" rel="noreferrer">관리자 로그인 / 이벤트 관리 ↗</a>
  </section>
}
