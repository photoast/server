/**
 * Socket.IO server utilities
 *
 * Socket.IO 인스턴스는 server.js 커스텀 서버에서 global._socketIO 로 저장됩니다.
 * Next.js API 라우트에서 이 모듈을 통해 프린터 클라이언트에 접근합니다.
 */

import fs from 'fs/promises'
import path from 'path'

const PRINT_TIMEOUT_MS = 30_000 // 30초

function getIO(): any {
  return (global as any)._socketIO ?? null
}

function getPrintCallbacks(): Map<string, Function> {
  return (global as any)._printCallbacks ?? new Map()
}

/**
 * 현재 연결된 프린터 클라이언트(phototoast) 수 반환
 */
export function getConnectedPrinterCount(): number {
  const io = getIO()
  if (!io) return 0
  return io.sockets.sockets.size
}

/**
 * 프린터 클라이언트가 연결되어 있는지 확인
 */
export function hasPrinterClient(): boolean {
  return getConnectedPrinterCount() > 0
}

/**
 * Socket.IO를 통해 프린터 클라이언트에 인쇄 요청을 보내고 결과를 기다립니다.
 *
 * 클라이언트(phototoast)가 수신하는 이벤트: 'print'
 * 클라이언트가 응답하는 이벤트: 'print_result'
 *
 * @param imagePath  - 인쇄할 이미지 파일의 절대 경로
 * @param size       - 용지 크기: '4x6'(기본) | '2x6' | '5x7' | '6x8'
 * @param filename   - 클라이언트에서 저장할 파일명 (선택)
 */
export async function emitPrintJob(params: {
  imagePath: string
  size?: string
  filename?: string
}): Promise<{ success: boolean; error?: string }> {
  const io = getIO()

  if (!io) {
    console.error('[Socket] Socket.IO 서버가 초기화되지 않았습니다. server.js로 실행했는지 확인하세요.')
    return {
      success: false,
      error: 'Socket.IO 서버가 초기화되지 않았습니다. server.js 커스텀 서버로 실행해야 합니다.',
    }
  }

  const clients = [...io.sockets.sockets.values()] as any[]

  if (clients.length === 0) {
    console.error('[Socket] 연결된 프린터 클라이언트(phototoast)가 없습니다.')
    return {
      success: false,
      error: '연결된 프린터 클라이언트(phototoast)가 없습니다. 프린터 PC에서 client.js를 실행하세요.',
    }
  }

  // 이미지를 base64 data URL로 변환
  let imageData: string
  try {
    const buffer = await fs.readFile(params.imagePath)
    imageData = `data:image/jpeg;base64,${buffer.toString('base64')}`
  } catch (e: any) {
    console.error(`[Socket] 이미지 파일 읽기 실패: ${params.imagePath}`, e)
    return { success: false, error: `이미지 파일 읽기 실패: ${e.message}` }
  }

  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const size = params.size || '4x6'
  const filename = params.filename || `print_${Date.now()}.jpg`

  console.log(`[Socket] 인쇄 요청 준비 (jobId: ${jobId}, size: ${size}, clients: ${clients.length}개)`)

  return new Promise((resolve) => {
    const callbacks = getPrintCallbacks()

    // 타임아웃 처리
    const timer = setTimeout(() => {
      callbacks.delete(jobId)
      console.error(`[Socket] 인쇄 응답 시간 초과 (jobId: ${jobId})`)
      resolve({ success: false, error: '프린터 응답 시간 초과 (30초). 프린터 PC 상태를 확인하세요.' })
    }, PRINT_TIMEOUT_MS)

    // 결과 콜백 등록
    callbacks.set(jobId, (result: { success: boolean; error?: string }) => {
      clearTimeout(timer)
      resolve(result)
    })

    // 첫 번째 연결된 클라이언트에 인쇄 이벤트 전송
    const targetSocket = clients[0]
    targetSocket.emit('print', { imageData, filename, size, jobId })

    console.log(`[Socket] 'print' 이벤트 전송 → ${targetSocket.id} (jobId: ${jobId}, size: ${size})`)
  })
}
