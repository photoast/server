'use client'
import { useEffect, useState } from 'react'
export default function KeepsakeLink({ eventId, eventName }: { eventId: string; eventName: string }) {
  const [title, setTitle] = useState(eventName), [date, setDate] = useState(''), [url, setUrl] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  useEffect(() => {
    let active = true
    fetch(`/api/events/${eventId}/keepsake`, { cache: 'no-store' }).then(async res => {
      if (!res.ok) throw new Error('앨범 설정을 불러오지 못했어요. 다시 열어 주세요.')
      const album = await res.json()
      if (active && album) { setTitle(album.title); setDate(album.date); setUrl(new URL(album.url, location.origin).href) }
    }).catch(e => { if (active) setMessage(e.message) })
    return () => { active = false }
  }, [eventId])
  const create = async () => {
    setBusy(true); setMessage('')
    try {
      const res = await fetch(`/api/events/${eventId}/keepsake`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, date }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setUrl(new URL(data.url, location.origin).href)
    } catch (e) { setMessage(e instanceof Error ? e.message : '링크 생성 실패') }
    finally { setBusy(false) }
  }
  return <section className="rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-3">
    <h3 className="font-semibold">신랑·신부에게 보내는 선물 앨범</h3>
    <p className="text-sm text-gray-600">미리보기로 표지를 꾸미고, 촬영 사진은 중복 없이 모아 보여줘요. 링크를 가진 분은 사진을 보고 저장할 수 있습니다.</p>
    <label className="block text-sm">표지 이름<input className="block mt-1 border rounded-lg p-3 w-full" maxLength={80} value={title} onChange={e => setTitle(e.target.value)} placeholder="신랑 · 신부" /></label>
    <label className="block text-sm">결혼 날짜 (선택)<input className="block mt-1 border rounded-lg p-3" type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
    <button type="button" disabled={busy || !title.trim()} onClick={create} className="min-h-11 px-4 bg-stone-800 text-white rounded-lg disabled:opacity-40">{busy ? '준비 중…' : url ? '표지 정보 저장' : '선물 앨범 링크 만들기'}</button>
    {url && <div className="space-y-2"><input aria-label="선물 앨범 공유 링크" className="w-full border p-3 rounded-lg text-sm" readOnly value={url} onFocus={e => e.target.select()} /><div className="flex gap-4"><a className="min-h-11 inline-flex items-center underline" href={url} target="_blank" rel="noreferrer">앨범 열어보기 ↗</a><button className="min-h-11 underline" onClick={async () => { try { await navigator.clipboard.writeText(url); setMessage('링크를 복사했어요.') } catch { setMessage('위 링크를 길게 눌러 복사해 주세요.') } }}>링크 복사</button></div></div>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>
}
