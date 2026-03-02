import { NextRequest, NextResponse } from 'next/server'
import { findEventById } from '@/lib/models'
import { checkAuth } from '@/lib/middleware'
import { generateCalibrationImage } from '@/lib/calibration'
import { printImage } from '@/lib/printer'
import path from 'path'
import fs from 'fs/promises'

// POST: 캘리브레이션 테스트 패턴 인쇄
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!checkAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const event = await findEventById(params.id)
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const shrinkPercent = event.shrinkPercent ?? 97.5
    const verticalOffsetPx = event.verticalOffsetPx ?? 0

    // 캘리브레이션 이미지 생성
    const calibrationBuffer = await generateCalibrationImage({
      shrinkPercent,
      verticalOffsetPx,
    })

    // 임시 파일로 저장
    const tempDir = '/tmp/uploads'
    await fs.mkdir(tempDir, { recursive: true })
    const filename = `calibration-${params.id}-${Date.now()}.jpg`
    const tempPath = path.join(tempDir, filename)
    await fs.writeFile(tempPath, calibrationBuffer)

    // 프린터로 전송
    const result = await printImage(
      tempPath,
      event.printMethod || 'email',
      {
        borderCorrection: event.borderCorrectionEnabled,
        shrinkPercent,
        verticalOffsetPx,
      }
    )

    return NextResponse.json({
      success: result.success,
      error: result.error,
      settings: { shrinkPercent, verticalOffsetPx },
      message: result.success
        ? `테스트 패턴 인쇄 완료 (shrink: ${shrinkPercent}%, offset: ${verticalOffsetPx}px)`
        : `인쇄 실패: ${result.error}`,
    })
  } catch (error: any) {
    console.error('Error sending test print:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send test print' },
      { status: 500 }
    )
  }
}

// GET: 캘리브레이션 이미지 미리보기 (인쇄 없이)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!checkAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const event = await findEventById(params.id)
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const calibrationBuffer = await generateCalibrationImage({
      shrinkPercent: event.shrinkPercent ?? 97.5,
      verticalOffsetPx: event.verticalOffsetPx ?? 0,
    })

    return new NextResponse(new Uint8Array(calibrationBuffer), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Disposition': `inline; filename="calibration-${event.slug}.jpg"`,
      },
    })
  } catch (error: any) {
    console.error('Error generating calibration image:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate calibration image' },
      { status: 500 }
    )
  }
}
