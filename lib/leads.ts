import { getDb, COLLECTIONS } from './mongodb'

/**
 * 생일카페 사장님 대상 영업 랜딩(/owner)의 CTA 폼에서 수집되는 리드(상담 신청) 데이터.
 *
 * Form Submit 시 클라이언트가 /api/leads 로 보내는 JSON Payload 구조이기도 하다.
 */
export interface LeadPayload {
  /** 사장님 성함 */
  name: string
  /** 연락처 (휴대폰) */
  phone: string
  /** 매장명 */
  storeName: string
  /** 미팅 희망 날짜 (YYYY-MM-DD) */
  meetingDate: string
  /** 미팅 희망 시간 (HH:mm) */
  meetingTime: string
  /** 추가 문의 / 메모 (선택) */
  message?: string
}

/** 서버에 저장되는 리드 도큐먼트 */
export interface LeadDoc extends LeadPayload {
  createdAt: Date
  /** 유입 출처(referrer 등) */
  source?: string
}

const PHONE_RE = /^[0-9+\-\s()]{7,20}$/

/** 들어온 payload를 검증하고 정규화한다. 유효하지 않으면 에러 메시지를 반환. */
export function validateLead(input: unknown): { ok: true; data: LeadPayload } | { ok: false; error: string } {
  if (typeof input !== 'object' || input === null) {
    return { ok: false, error: '잘못된 요청입니다.' }
  }
  const o = input as Record<string, unknown>
  const name = typeof o.name === 'string' ? o.name.trim() : ''
  const phone = typeof o.phone === 'string' ? o.phone.trim() : ''
  const storeName = typeof o.storeName === 'string' ? o.storeName.trim() : ''
  const meetingDate = typeof o.meetingDate === 'string' ? o.meetingDate.trim() : ''
  const meetingTime = typeof o.meetingTime === 'string' ? o.meetingTime.trim() : ''
  const message = typeof o.message === 'string' ? o.message.trim() : ''

  if (!name) return { ok: false, error: '성함을 입력해 주세요.' }
  if (!PHONE_RE.test(phone)) return { ok: false, error: '연락처를 정확히 입력해 주세요.' }
  if (!storeName) return { ok: false, error: '매장명을 입력해 주세요.' }
  if (!meetingDate) return { ok: false, error: '미팅 희망 날짜를 선택해 주세요.' }
  if (!meetingTime) return { ok: false, error: '미팅 희망 시간을 선택해 주세요.' }

  return {
    ok: true,
    data: { name, phone, storeName, meetingDate, meetingTime, message: message || undefined },
  }
}

/** 리드를 MongoDB에 저장한다. (DB 미설정 시 조용히 건너뜀) */
export async function saveLead(doc: LeadDoc): Promise<void> {
  try {
    const db = await getDb()
    await db.collection(COLLECTIONS.leads).insertOne(doc)
  } catch (err) {
    console.error('[leads] DB 저장 실패:', err)
  }
}

function formatMessage(doc: LeadDoc): string {
  const lines = [
    '📩 *생일카페 도입 상담 신청*',
    '',
    `👤 성함: ${doc.name}`,
    `📞 연락처: ${doc.phone}`,
    `🏪 매장: ${doc.storeName}`,
    `📅 희망 미팅: ${doc.meetingDate} ${doc.meetingTime}`,
  ]
  if (doc.message) lines.push(`📝 메모: ${doc.message}`)
  if (doc.source) lines.push(`🔗 유입: ${doc.source}`)
  return lines.join('\n')
}

/**
 * 수집한 리드를 사장(나)의 스마트폰으로 즉시 알림 전송한다.
 *
 * 환경변수가 설정된 채널로만 전송하며, 여러 채널을 동시에 켜둘 수 있다.
 * - 텔레그램:   TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
 * - 슬랙:       SLACK_WEBHOOK_URL
 * - 디스코드:   DISCORD_WEBHOOK_URL
 */
export async function notifyLead(doc: LeadDoc): Promise<void> {
  const text = formatMessage(doc)
  const tasks: Promise<unknown>[] = []

  const tgToken = process.env.TELEGRAM_BOT_TOKEN
  const tgChat = process.env.TELEGRAM_CHAT_ID
  if (tgToken && tgChat) {
    tasks.push(
      fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: tgChat, text, parse_mode: 'Markdown' }),
      })
    )
  }

  const slack = process.env.SLACK_WEBHOOK_URL
  if (slack) {
    tasks.push(
      fetch(slack, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
    )
  }

  const discord = process.env.DISCORD_WEBHOOK_URL
  if (discord) {
    // 디스코드는 Markdown bold(*..*)가 아닌 (**..**)를 쓰므로 변환
    tasks.push(
      fetch(discord, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text.replace(/\*([^*]+)\*/g, '**$1**') }),
      })
    )
  }

  if (tasks.length === 0) {
    console.warn('[leads] 알림 채널이 설정되지 않았습니다. (TELEGRAM_/SLACK_/DISCORD_ env 확인)')
    return
  }

  const results = await Promise.allSettled(tasks)
  results.forEach((r) => {
    if (r.status === 'rejected') console.error('[leads] 알림 전송 실패:', r.reason)
  })
}
