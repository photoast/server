'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import ZoomableImage from '@/app/components/ZoomableImage'
import ProposalSample from '@/app/components/ProposalSample'
import type { FrameProposal } from '@/lib/frameProposals'
import '@/app/frame-studio/studio.css'
import './proposal.css'
export default function ProposalPage() {
  const { id } = useParams<{ id: string }>()
  const [proposal, setProposal] = useState<FrameProposal | null>(null), [chosen, setChosen] = useState('')
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setMessage('')
    fetch(`/api/frame-proposals/${id}`, { cache: 'no-store', signal: controller.signal }).then(async r => {
      const data = await r.json(); if (!r.ok) throw new Error(data.error || '제안을 불러오지 못했어요.')
      setProposal(data); setChosen(data.selection?.itemId || '')
    }).catch(e => { if (!controller.signal.aborted) setMessage(e instanceof Error ? e.message : '제안을 불러오지 못했어요.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [id, retry])
  const selected = proposal?.items.find(item => item.id === chosen)
  async function save() {
    if (!chosen || busy) return
    setBusy(true); setMessage('')
    try {
      const response = await fetch(`/api/frame-proposals/${id}/selection`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId: chosen }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error || '선택을 저장하지 못했어요.')
      setProposal(previous => previous && { ...previous, selection: data.selection }); setMessage('선택을 저장했어요. 이 링크에서 선택 결과를 함께 확인할 수 있습니다.')
    } catch (e) { setMessage(e instanceof Error ? e.message : '다시 시도해 주세요.') }
    finally { setBusy(false) }
  }
  return <main className="wedding-studio proposal-page">
    <header className="ws-header"><span>PHOTO TOAST / PROPOSAL</span><span>FOR YOUR WEDDING</span></header>
    <div className="ws-intro"><p className="ws-eyebrow">A LITTLE PREVIEW OF YOUR DAY</p><h1>{proposal?.title || '두 분을 위한 프레임 제안'}</h1><p>사진이 담긴 모습과 프레임을 순서대로 비교하고, 마음에 드는 디자인을 골라주세요.</p></div>
    {loading && <p role="status">제안을 불러오고 있어요…</p>}
    {!loading && !proposal && <div><p role="alert">{message}</p><button className="proposal-save" onClick={() => setRetry(n => n + 1)}>다시 불러오기</button></div>}
    {proposal && <>
      <nav className="proposal-index" aria-label="디자인 바로가기">{proposal.items.map((item, i) => <a key={item.id} href={`#design-${item.id}`}>{String(i + 1).padStart(2, '0')} {item.name}</a>)}</nav>
      {proposal.selection && <p className="proposal-saved">현재 저장된 선택: <strong>{proposal.items.find(item => item.id === proposal.selection?.itemId)?.name}</strong></p>}
      <div className="proposal-grid">{proposal.items.map((item, i) => <section id={`design-${item.id}`} key={item.id} className={`proposal-card ${chosen === item.id ? 'chosen' : ''}`}>
        <div className="proposal-card-title"><span>{String(i + 1).padStart(2, '0')}</span><h2>{item.name}</h2></div>
        <div className="proposal-images"><ProposalSample item={item} photos={proposal.photos} /><figure><div className="proposal-transparent"><ZoomableImage src={item.overlay} alt={`${item.name} 투명 프레임`} transparent /></div><figcaption>프레임 · 사진 영역 투명</figcaption></figure></div>
        <button className="proposal-choose" aria-pressed={chosen === item.id} disabled={busy} onClick={() => { setChosen(item.id); setMessage('') }}>{chosen === item.id ? '✓ 고른 디자인' : '이 디자인 고르기'}</button>
        <div className="proposal-downloads"><a href={item.overlay} download={`phototoast-${item.id}-frame.png`}>프레임 PNG ↓</a></div>
      </section>)}</div>
      <div className="proposal-selection"><div><span className="ws-eyebrow">YOUR CHOICE</span><h2>{selected?.name || '마음에 드는 디자인을 골라주세요'}</h2><p>링크를 가진 분들이 선택 결과를 함께 볼 수 있습니다. 다시 고른 뒤 저장하면 변경됩니다.</p></div><button className="proposal-save" disabled={!chosen || busy || chosen === proposal.selection?.itemId} onClick={() => void save()}>{busy ? '저장 중…' : chosen && chosen === proposal.selection?.itemId ? '선택 저장 완료' : '이 디자인으로 선택 저장'}</button><p role="status">{message}</p></div>
    </>}
    <footer className="ws-footer">PHOTO TOAST<span>두 사람의 날을, 오래 간직할 프레임으로.</span></footer>
  </main>
}
