import nodemailer from 'nodemailer'

type EmailType = 'payment_complete' | 'print_complete' | 'refund_complete'

interface EmailParams {
  to: string
  type: EmailType
  eventName: string
  orderNumber?: number
  amount?: number
  jobId?: string
}

function getTransporter() {
  const host = process.env.SMTP_HOST
  const port = parseInt(process.env.SMTP_PORT || '587')
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    throw new Error('SMTP configuration missing')
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })
}

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

function buildHtml(params: EmailParams): { subject: string; html: string } {
  const { type, eventName, orderNumber, amount, jobId } = params
  const baseUrl = getBaseUrl()
  const resultUrl = jobId ? `${baseUrl}/result/${jobId}` : ''

  const configs: Record<EmailType, { subject: string; title: string; message: string; color: string }> = {
    payment_complete: {
      subject: `[포토토스트] 결제가 완료되었습니다`,
      title: '결제 완료',
      message: '결제가 정상적으로 처리되었습니다. 인쇄를 요청했습니다.',
      color: '#4CAF50',
    },
    print_complete: {
      subject: `[포토토스트] 인쇄가 완료되었습니다`,
      title: '인쇄 완료',
      message: '사진 인쇄가 완료되었습니다. 프린터에서 사진을 수령해 주세요!',
      color: '#2196F3',
    },
    refund_complete: {
      subject: `[포토토스트] 결제가 취소되었습니다`,
      title: '결제 취소',
      message: '결제가 취소되었습니다. 환불은 카드사에 따라 3~5영업일 소요될 수 있습니다.',
      color: '#FF5722',
    },
  }

  const config = configs[type]

  const orderInfo = orderNumber ? `<p style="margin:8px 0;color:#666;">인쇄번호: <strong>#${orderNumber}</strong></p>` : ''
  const amountInfo = amount ? `<p style="margin:8px 0;color:#666;">금액: ${amount.toLocaleString()}원</p>` : ''

  const resultLink = resultUrl
    ? `<div style="margin:20px 0;text-align:center;">
        <a href="${resultUrl}" style="display:inline-block;padding:14px 32px;background:${config.color};color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">결과 확인하기</a>
      </div>
      <p style="margin:8px 0 0;color:#999;font-size:12px;text-align:center;">사진 저장, 인쇄 상태 확인, 취소 요청을 할 수 있습니다.</p>`
    : ''

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:${config.color};padding:32px 24px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:600;">${config.title}</h1>
    </div>
    <div style="padding:32px 24px;">
      <p style="margin:0 0 16px;color:#333;font-size:15px;line-height:1.6;">${config.message}</p>
      <div style="background:#f9f9f9;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0 0 8px;color:#333;font-weight:600;">${eventName}</p>
        ${orderInfo}
        ${amountInfo}
      </div>
      ${resultLink}
    </div>
    <div style="padding:16px 24px;border-top:1px solid #eee;text-align:center;">
      <p style="margin:0;color:#999;font-size:12px;">포토토스트 | PhotoToast</p>
    </div>
  </div>
</body>
</html>`

  return { subject: config.subject, html }
}

export async function sendAdminNotification(params: {
  eventName: string
  slug: string
  jobId: string
  quantity: number
  amount?: number
  paymentTid?: string
}): Promise<void> {
  const adminEmail = process.env.ADMIN_NOTIFY_EMAIL
  if (!adminEmail) return

  try {
    const transporter = getTransporter()
    const baseUrl = getBaseUrl()
    const from = process.env.SMTP_FROM || process.env.SMTP_USER
    const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })

    const subject = `[포토토스트] 인쇄 요청 - ${params.eventName}`
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#FF9800;padding:24px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:20px;">🖨️ 새 인쇄 요청</h1>
    </div>
    <div style="padding:24px;">
      <div style="background:#f9f9f9;border-radius:8px;padding:16px;">
        <p style="margin:0 0 8px;color:#333;font-weight:600;">${params.eventName}</p>
        <p style="margin:4px 0;color:#666;font-size:14px;">시간: ${now}</p>
        <p style="margin:4px 0;color:#666;font-size:14px;">수량: ${params.quantity}매</p>
        ${params.amount ? `<p style="margin:4px 0;color:#666;font-size:14px;">결제: ${params.amount.toLocaleString()}원</p>` : ''}
        ${params.paymentTid ? `<p style="margin:4px 0;color:#666;font-size:14px;">TID: ${params.paymentTid}</p>` : ''}
      </div>
      <div style="margin:16px 0;text-align:center;">
        <a href="${baseUrl}/admin" style="display:inline-block;padding:12px 24px;background:#FF9800;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;">관리자 페이지</a>
      </div>
    </div>
  </div>
</body></html>`

    await transporter.sendMail({ from, to: adminEmail, subject, html })
    console.log(`[Admin Notify] Sent print notification to ${adminEmail}`)
  } catch (error: any) {
    console.error(`[Admin Notify] Failed:`, error.message)
  }
}

export async function sendCustomerEmail(params: EmailParams): Promise<void> {
  if (!params.to) return

  try {
    const transporter = getTransporter()
    const { subject, html } = buildHtml(params)
    const from = process.env.SMTP_FROM || process.env.SMTP_USER

    await transporter.sendMail({ from, to: params.to, subject, html })
    console.log(`[Customer Email] Sent ${params.type} to ${params.to}`)
  } catch (error: any) {
    console.error(`[Customer Email] Failed to send ${params.type} to ${params.to}:`, error.message)
  }
}
