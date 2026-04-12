import { EpsonApiAuth } from './types'

const EPSON_AUTH_URL = 'https://auth.epsonconnect.com/auth/token'
const EPSON_API_BASE = 'https://api.epsonconnect.com/api/2/printing'

interface TokenResponse {
  token_type: string
  access_token: string
  expires_in: number
  refresh_token: string
  subject_id: string
}

interface CreateJobResponse {
  jobId: string
  uploadUri: string
}

/**
 * 리프레시 토큰으로 액세스 토큰 갱신
 */
async function refreshAccessToken(auth: EpsonApiAuth): Promise<{
  accessToken: string
  refreshToken: string
  tokenExpiresAt: number
}> {
  if (!auth.refreshToken) {
    throw new Error('리프레시 토큰이 없습니다. 어드민에서 토큰을 입력해주세요.')
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
    const text = await res.text()
    throw new Error(`토큰 갱신 실패 [${res.status}]: ${text}. 어드민에서 토큰을 재발급해주세요.`)
  }

  const data = (await res.json()) as TokenResponse
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenExpiresAt: Date.now() + data.expires_in * 1000,
  }
}

/**
 * 유효한 액세스 토큰 확보 (만료 5분 전 자동 갱신)
 */
async function ensureValidToken(auth: EpsonApiAuth): Promise<{
  accessToken: string
  refreshToken: string
  tokenExpiresAt: number
}> {
  const now = Date.now()
  const bufferMs = 5 * 60 * 1000

  if (auth.accessToken && auth.tokenExpiresAt && auth.tokenExpiresAt - now > bufferMs) {
    return {
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken!,
      tokenExpiresAt: auth.tokenExpiresAt,
    }
  }

  return refreshAccessToken(auth)
}

/**
 * Epson Connect V2 API로 사진 인쇄
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
    if (!auth.accessToken && !auth.refreshToken) {
      throw new Error('액세스 토큰 또는 리프레시 토큰이 필요합니다. 어드민에서 입력해주세요.')
    }

    const token = await ensureValidToken(auth)
    const updatedAuth: Partial<EpsonApiAuth> = {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      tokenExpiresAt: token.tokenExpiresAt,
    }

    const apiHeaders = {
      Authorization: `Bearer ${token.accessToken}`,
      'x-api-key': auth.apiKey,
      'Content-Type': 'application/json',
    }

    console.log(`[Epson API] Creating print job...`)

    // 1. Job 생성
    const jobRes = await fetch(`${EPSON_API_BASE}/jobs`, {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify({
        jobName: 'PhotoToast_Print',
        printMode: 'photo',
        printSettings: {
          paperSize: 'ps_kg',
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

    // 2. 이미지 업로드
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

    // 3. 인쇄 실행
    const printRes = await fetch(`${EPSON_API_BASE}/jobs/${jobId}/print`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        'x-api-key': auth.apiKey,
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
