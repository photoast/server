'use client'

import { useEffect } from 'react'

/**
 * /owner 영업 랜딩 접속을 세션당 1회 기록·알림한다.
 * (re-render·새로고침마다 중복 발송되지 않도록 sessionStorage로 가드)
 */
function send(type: string) {
  // 같은 종류 이벤트는 세션당 1회만 발송 (중복 알림 방지)
  const key = `pt_owner_${type}_sent`
  try {
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
  } catch {
    // sessionStorage 불가 환경이면 그냥 진행
  }
  fetch('/api/owner-visit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type,
      referrer: document.referrer || undefined,
      screen: `${window.innerWidth}x${window.innerHeight}`,
    }),
    keepalive: true,
  }).catch(() => {})
}

export default function VisitTracker() {
  useEffect(() => {
    // 1) 접속 기록
    send('visit')

    // 2) 문의 CTA(#apply) 클릭 기록
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest('a[href="#apply"]')
      if (el) send('cta_click')
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  return null
}
