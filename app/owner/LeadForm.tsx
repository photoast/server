'use client'

import { useState } from 'react'

type Status = 'idle' | 'submitting' | 'success' | 'error'

const inputClass =
  'w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-base text-gray-900 placeholder-gray-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200'

export default function LeadForm() {
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [form, setForm] = useState({
    name: '',
    phone: '',
    storeName: '',
    meetingDate: '',
    meetingTime: '',
    message: '',
  })

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }))

  // 오늘 이후 날짜만 선택 가능하도록 min 지정
  const today = new Date().toISOString().slice(0, 10)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('submitting')
    setErrorMsg('')
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErrorMsg(data.error || '전송에 실패했어요. 잠시 후 다시 시도해 주세요.')
        setStatus('error')
        return
      }
      setStatus('success')
    } catch {
      setErrorMsg('네트워크 오류가 발생했어요. 잠시 후 다시 시도해 주세요.')
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">
          ✅
        </div>
        <h3 className="text-xl font-bold text-gray-900">신청이 접수됐어요!</h3>
        <p className="mt-2 text-gray-500">
          희망하신 일정에 맞춰 빠르게 연락드릴게요.<br />
          <span className="font-semibold text-gray-700">{form.storeName}</span> 사장님, 감사합니다 🙌
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl bg-white p-6 shadow-xl sm:p-8">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">성함</label>
          <input className={inputClass} value={form.name} onChange={update('name')} placeholder="홍길동" required />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">연락처</label>
          <input
            className={inputClass}
            value={form.phone}
            onChange={update('phone')}
            placeholder="010-0000-0000"
            inputMode="tel"
            required
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-gray-700">매장명</label>
        <input
          className={inputClass}
          value={form.storeName}
          onChange={update('storeName')}
          placeholder="홍대 ○○카페"
          required
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">미팅 희망 날짜</label>
          <input className={inputClass} type="date" min={today} value={form.meetingDate} onChange={update('meetingDate')} required />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">미팅 희망 시간</label>
          <input className={inputClass} type="time" value={form.meetingTime} onChange={update('meetingTime')} required />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-gray-700">
          문의 내용 <span className="font-normal text-gray-400">(선택)</span>
        </label>
        <textarea
          className={inputClass + ' min-h-[84px] resize-none'}
          value={form.message}
          onChange={update('message')}
          placeholder="궁금한 점이나 매장 상황을 자유롭게 적어주세요."
        />
      </div>

      {status === 'error' && <p className="text-sm font-medium text-red-500">{errorMsg}</p>}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="mt-2 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 py-4 text-lg font-bold text-white shadow-lg transition hover:opacity-95 active:scale-[0.99] disabled:opacity-60"
      >
        {status === 'submitting' ? '신청 중…' : '🎉 무료 테스트 미팅 신청하기'}
      </button>
      <p className="text-center text-xs text-gray-400">
        신청 후 1영업일 이내 연락드립니다. 부담 없이 상담만 받아보셔도 좋아요.
      </p>
    </form>
  )
}
