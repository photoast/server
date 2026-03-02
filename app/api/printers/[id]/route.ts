import { NextRequest, NextResponse } from 'next/server'
import { findPrinterById, updatePrinter, deletePrinter } from '@/lib/models'
import { checkAuth } from '@/lib/middleware'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!checkAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const printer = await findPrinterById(params.id)
    if (!printer) {
      return NextResponse.json({ error: 'Printer not found' }, { status: 404 })
    }
    return NextResponse.json(printer)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch printer' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!checkAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json()
    const { name, printMethod, email, supportedSizes, borderCorrectionEnabled, shrinkPercent, verticalOffsetPx } = body

    const updates: any = {}
    if (name !== undefined) updates.name = name
    if (printMethod !== undefined) updates.printMethod = printMethod
    if (email !== undefined) updates.email = email
    if (supportedSizes !== undefined) updates.supportedSizes = supportedSizes
    if (borderCorrectionEnabled !== undefined) updates.borderCorrectionEnabled = borderCorrectionEnabled
    if (shrinkPercent !== undefined) updates.shrinkPercent = shrinkPercent
    if (verticalOffsetPx !== undefined) updates.verticalOffsetPx = verticalOffsetPx

    const success = await updatePrinter(params.id, updates)
    if (!success) {
      return NextResponse.json({ error: 'Printer not found' }, { status: 404 })
    }
    const updated = await findPrinterById(params.id)
    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update printer' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!checkAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const deleted = await deletePrinter(params.id)
    if (!deleted) {
      return NextResponse.json({ error: 'Printer not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete printer' }, { status: 500 })
  }
}
