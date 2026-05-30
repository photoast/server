import { getDb, COLLECTIONS } from './mongodb'
import { sendNotification } from './leads'

/** /owner 영업 랜딩 방문/이벤트 로그 한 건 */
export interface OwnerVisitDoc {
  /** 'visit'(첫 접속) | 'cta_click'(문의 버튼) | 'lead'(폼 제출) 등 이벤트 종류 */
  type: string
  /** 유입 경로(referrer) */
  referrer?: string
  /** 브라우저 user-agent */
  userAgent?: string
  /** 접속 IP */
  ip?: string
  /** 화면 크기 (예: 390x844) */
  screen?: string
  createdAt: Date
}

/** 방문 로그를 MongoDB에 저장한다. (DB 미설정/실패 시 조용히 건너뜀) */
export async function saveOwnerVisit(doc: OwnerVisitDoc): Promise<void> {
  try {
    const db = await getDb()
    await db.collection(COLLECTIONS.ownerVisits).insertOne(doc)
  } catch (err) {
    console.error('[ownerVisit] DB 저장 실패:', err)
  }
}

const TYPE_LABEL: Record<string, string> = {
  visit: '👀 랜딩 접속',
  cta_click: '🖱️ 문의 버튼 클릭',
  lead: '📩 문의 폼 제출',
}

/** 디바이스 종류를 user-agent로 대략 추정 */
function deviceOf(ua?: string): string {
  if (!ua) return '알 수 없음'
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS'
  if (/Android/i.test(ua)) return 'Android'
  if (/Windows/i.test(ua)) return 'Windows'
  if (/Mac OS X/i.test(ua)) return 'Mac'
  return '기타'
}

/** 방문/이벤트를 알림 채널(텔레그램 등)로 전송한다. */
export async function notifyOwnerVisit(doc: OwnerVisitDoc): Promise<void> {
  const time = doc.createdAt.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
  const lines = [
    `*${TYPE_LABEL[doc.type] || doc.type}* · 포토토스트 영업 랜딩`,
    '',
    `🕒 ${time}`,
    `📱 ${deviceOf(doc.userAgent)}${doc.screen ? ` · ${doc.screen}` : ''}`,
    `🔗 유입: ${doc.referrer || '직접 접속'}`,
  ]
  if (doc.ip) lines.push(`🌐 IP: ${doc.ip}`)
  await sendNotification(lines.join('\n'))
}
