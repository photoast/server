import { NextRequest, NextResponse } from 'next/server'
import { findPrinterById } from '@/lib/models'
import { checkAuth } from '@/lib/middleware'
import { generateCalibrationImage } from '@/lib/calibration'
import { printImage } from '@/lib/printer'
import path from 'path'
import fs from 'fs/promises'

// POST: 프린터 캘리브레이션 테스트 인쇄
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!checkAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const printer = await findPrinterById(params.id)
    if (!printer) {
      return NextResponse.json({ error: 'Printer not found' }, { status: 404 })
    }

    const { shrinkPercent, verticalOffsetPx } = printer

    const calibrationBuffer = await generateCalibrationImage({
      shrinkPercent,
      verticalOffsetPx,
    })

    const tempDir = '/tmp/uploads'
    await fs.mkdir(tempDir, { recursive: true })
    const filename = `calibration-printer-${params.id}-${Date.now()}.jpg`
    const tempPath = path.join(tempDir, filename)
    await fs.writeFile(tempPath, calibrationBuffer)

    const result = await printImage(tempPath, {
      borderCorrection: printer.borderCorrectionEnabled,
      shrinkPercent,
      verticalOffsetPx,
      printerEmail: printer.email,
    })

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
