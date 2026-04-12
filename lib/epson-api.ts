import { EpsonApiAuth } from './types'

const EPSON_AUTH_URL = 'https://auth.epsonconnect.com/auth/token'
const EPSON_API_BASE = 'https://api.epsonconnect.com/api/2/printing'

interface TokenResponse {
  token_type: string
  access_token: string
  expires_in: number
  refresh_token: string
}

interface CreateJobResponse {
  jobId: string
  uploadUri: string
}

/**
 * 리프레시 토큰으로 액세스 토큰 갱신 시도
 */
async function tryRefreshToken(auth: EpsonApiAuth): Promise<{
  accessToken: string
  refreshToken: string
  tokenExpiresAt: number
} | null> {
  if (!auth.refreshToken || !auth.clientId || !auth.clientSecret) {
    return null
  }

  // Basic Auth 방식
  const basicAuth = Buffer.from(`${auth.clientId}:${auth.clientSecret}`).toString('base64')
  let res = await fetch(EPSON_AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: auth.refreshToken,
    }),
  })

  // Basic Auth 실패 시 body params 방식
  if (!res.ok) {
    res = await fetch(EPSON_AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: auth.refreshToken,
        client_id: auth.clientId,
        client_secret: auth.clientSecret,
      }),
    })
  }

  if (!res.ok) {
    console.error(`[Epson API] Token refresh failed: ${await res.text()}`)
    return null
  }

  const data = (await res.json()) as TokenResponse
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenExpiresAt: Date.now() + data.expires_in * 1000,
  }
}

/**
 * Epson Connect V2 API로 사진 인쇄
 *
 * 핵심: accessToken + apiKey만으로 동작
 * 401 발생 시 refreshToken이 있으면 자동 갱신 시도
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
    if (!auth.accessToken || !auth.apiKey) {
      throw new Error('Access Token과 API Key가 필요합니다. 어드민에서 입력해주세요.')
    }

    let token = auth.accessToken
    let updatedAuth: Partial<EpsonApiAuth> = {}

    const makeHeaders = () => ({
      Authorization: `Bearer ${token}`,
      'x-api-key': auth.apiKey,
      'Content-Type': 'application/json',
    })

    console.log(`[Epson API] Creating print job...`)

    // 1. Job 생성
    let jobRes = await fetch(`${EPSON_API_BASE}/jobs`, {
      method: 'POST',
      headers: makeHeaders(),
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

    // 401이면 토큰 갱신 후 재시도
    if (jobRes.status === 401) {
      console.warn('[Epson API] 401 - attempting token refresh...')
      const refreshed = await tryRefreshToken(auth)
      if (refreshed) {
        token = refreshed.accessToken
        updatedAuth = {
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken,
          tokenExpiresAt: refreshed.tokenExpiresAt,
        }
        jobRes = await fetch(`${EPSON_API_BASE}/jobs`, {
          method: 'POST',
          headers: makeHeaders(),
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
      }
    }

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
        Authorization: `Bearer ${token}`,
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
