import { EpsonApiAuth } from './types'

const EPSON_AUTH_URL = 'https://api.epsonconnect.com/api/1/printing/oauth2/auth/token?dc=v2'
const EPSON_API_BASE = 'https://api.epsonconnect.com/api/1/printing'

interface TokenResponse {
  token_type: string
  access_token: string
  expires_in: number // seconds
  refresh_token: string
  subject_id: string
}

interface CreateJobResponse {
  id: string
  upload_uri: string
}

/**
 * Epson Connect API 인증 (최초 토큰 발급)
 */
export async function authenticateEpson(auth: EpsonApiAuth): Promise<{
  accessToken: string
  refreshToken: string
  tokenExpiresAt: number
  subjectId: string
}> {
  const res = await fetch(EPSON_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      username: auth.printerEmail,
      password: '',
      client_id: auth.clientId,
      client_secret: auth.clientSecret,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Epson 인증 실패 [${res.status}]: ${text}`)
  }

  const data = (await res.json()) as TokenResponse
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenExpiresAt: Date.now() + data.expires_in * 1000,
    subjectId: data.subject_id,
  }
}

/**
 * 토큰 리프레시
 */
export async function refreshEpsonToken(auth: EpsonApiAuth): Promise<{
  accessToken: string
  refreshToken: string
  tokenExpiresAt: number
  subjectId: string
}> {
  if (!auth.refreshToken) {
    return authenticateEpson(auth)
  }

  const res = await fetch(EPSON_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: auth.refreshToken,
      client_id: auth.clientId,
      client_secret: auth.clientSecret,
    }),
  })

  if (!res.ok) {
    // 리프레시 실패 시 새로 인증
    console.warn('[Epson API] Token refresh failed, re-authenticating...')
    return authenticateEpson(auth)
  }

  const data = (await res.json()) as TokenResponse
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenExpiresAt: Date.now() + data.expires_in * 1000,
    subjectId: data.subject_id,
  }
}

/**
 * 유효한 액세스 토큰을 보장 (만료 5분 전에 리프레시)
 */
export async function ensureValidToken(auth: EpsonApiAuth): Promise<{
  accessToken: string
  refreshToken: string
  tokenExpiresAt: number
  subjectId: string
}> {
  const now = Date.now()
  const bufferMs = 5 * 60 * 1000 // 5분 여유

  if (auth.accessToken && auth.tokenExpiresAt && auth.tokenExpiresAt - now > bufferMs) {
    return {
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken!,
      tokenExpiresAt: auth.tokenExpiresAt,
      subjectId: auth.subjectId!,
    }
  }

  return refreshEpsonToken(auth)
}

/**
 * Epson Connect API로 사진 인쇄
 */
export async function printViaEpsonApi(
  imageBuffer: Buffer,
  auth: EpsonApiAuth,
): Promise<{
  success: boolean
  jobId?: string
  error?: string
  updatedAuth: Partial<EpsonApiAuth>
}> {
  try {
    // 1. 토큰 확보
    const token = await ensureValidToken(auth)
    const updatedAuth: Partial<EpsonApiAuth> = {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      tokenExpiresAt: token.tokenExpiresAt,
      subjectId: token.subjectId,
    }

    const deviceId = token.subjectId
    const headers = {
      Authorization: `Bearer ${token.accessToken}`,
      'Content-Type': 'application/json',
    }

    console.log(`[Epson API] Creating print job for device ${deviceId}...`)

    // 2. Job 생성
    const jobRes = await fetch(`${EPSON_API_BASE}/printers/${deviceId}/jobs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        job_name: 'PhotoToast_Print',
        print_mode: 'photo',
        print_setting: {
          media_size: 'ms_kg',
          media_type: 'mt_photopaper',
          borderless: true,
          print_quality: 'high',
          source: 'rear',
          color_mode: 'color',
          copies: 1,
        },
      }),
    })

    if (!jobRes.ok) {
      const text = await jobRes.text()
      throw new Error(`Job 생성 실패 [${jobRes.status}]: ${text}`)
    }

    const { id: jobId, upload_uri: uploadUri } = (await jobRes.json()) as CreateJobResponse
    console.log(`[Epson API] Job created: ${jobId}`)

    // 3. 이미지 업로드
    const uploadUrl = `${uploadUri}&File=1.jpg`
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': imageBuffer.length.toString(),
      },
      body: new Uint8Array(imageBuffer),
    })

    if (!uploadRes.ok) {
      const text = await uploadRes.text()
      throw new Error(`파일 업로드 실패 [${uploadRes.status}]: ${text}`)
    }
    console.log(`[Epson API] Image uploaded`)

    // 4. 인쇄 실행
    const printRes = await fetch(`${EPSON_API_BASE}/printers/${deviceId}/jobs/${jobId}/print`, {
      method: 'POST',
      headers,
    })

    if (!printRes.ok) {
      const text = await printRes.text()
      throw new Error(`인쇄 명령 실패 [${printRes.status}]: ${text}`)
    }

    console.log(`[Epson API] Print command sent successfully`)
    return { success: true, jobId, updatedAuth }
  } catch (error: any) {
    console.error('[Epson API] Print error:', error)
    return { success: false, error: error.message, updatedAuth: {} }
  }
}
