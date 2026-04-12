import { EpsonApiAuth } from './types'

/**
 * Epson Connect V2 API
 * Spec: docs/epson-openapi-spec
 * Auth: https://auth.epsonconnect.com/auth/token (OAuth2 authorization code flow)
 * API:  https://api.epsonconnect.com/api/2/printing/...
 */

const EPSON_AUTH_URL = 'https://auth.epsonconnect.com/auth/token'
const EPSON_API_BASE = 'https://api.epsonconnect.com/api/2/printing'

interface TokenResponse {
  token_type: string
  access_token: string
  expires_in: number // seconds
  refresh_token: string
  subject_id: string
}

interface CreateJobResponse {
  jobId: string
  uploadUri: string
}

/**
 * Epson Connect API 인증 (최초 토큰 발급 - password grant)
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
 * 토큰 리프레시 (refresh_token 만료: 30일)
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
  const bufferMs = 5 * 60 * 1000

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
 * Epson Connect V2 API로 사진 인쇄
 *
 * Flow: 토큰 확보 → Job 생성 → 이미지 업로드 → 인쇄 명령
 * Endpoint: POST /api/2/printing/jobs
 * Headers: Authorization: Bearer {token}, x-api-key: {apiKey}
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

    const apiHeaders = {
      Authorization: `Bearer ${token.accessToken}`,
      'x-api-key': auth.clientId,
      'Content-Type': 'application/json',
    }

    console.log(`[Epson API] Creating print job...`)

    // 2. Job 생성 (V2: /printing/jobs, camelCase fields)
    const jobRes = await fetch(`${EPSON_API_BASE}/jobs`, {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify({
        jobName: 'PhotoToast_Print',
        printMode: 'photo',
        printSettings: {
          paperSize: 'ps_kg',       // 4x6 인치
          paperType: 'pt_photopaper',
          borderless: true,
          printQuality: 'high',
          paperSource: 'rear',
          colorMode: 'color',
          copies: 1,
        },
      }),
    })

    if (!jobRes.ok) {
      const text = await jobRes.text()
      throw new Error(`Job 생성 실패 [${jobRes.status}]: ${text}`)
    }

    const { jobId, uploadUri } = (await jobRes.json()) as CreateJobResponse
    console.log(`[Epson API] Job created: ${jobId}`)

    // 3. 이미지 업로드 (uploadUri에 File 파라미터 추가)
    const separator = uploadUri.includes('?') ? '&' : '?'
    const uploadUrl = `${uploadUri}${separator}File=1.jpg`
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

    // 4. 인쇄 실행 (V2: /printing/jobs/{jobId}/print)
    const printRes = await fetch(`${EPSON_API_BASE}/jobs/${jobId}/print`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        'x-api-key': auth.clientId,
      },
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
