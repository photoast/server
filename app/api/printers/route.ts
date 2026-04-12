import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getAllPrinters, createPrinter } from '@/lib/models'
import { checkAuth } from '@/lib/middleware'

export async function GET(request: NextRequest) {
  try {
    if (!checkAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const printers = await getAllPrinters()
    return NextResponse.json(printers)
  } catch (error) {
    console.error('Error fetching printers:', error)
    return NextResponse.json({ error: 'Failed to fetch printers' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!checkAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json()
    const {
      name,
      printMethod = 'email',
      email,
      epsonAuth,
      supportedSizes = ['4x6', '6x4'],
      borderCorrectionEnabled = true,
      shrinkPercent = 97.5,
      verticalOffsetPx = 0,
    } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    if (printMethod === 'email' && !email) {
      return NextResponse.json({ error: 'Email is required for email print method' }, { status: 400 })
    }
    if (printMethod === 'epson_api' && (!epsonAuth?.apiKey || !epsonAuth?.clientId || !epsonAuth?.clientSecret)) {
      return NextResponse.json({ error: 'Epson API Key, Client ID, Client Secret이 필요합니다' }, { status: 400 })
    }

    const printer = await createPrinter({
      name,
      printMethod,
      email: printMethod === 'email' ? email : undefined,
      apiKey: printMethod === 'polling' ? randomUUID() : undefined,
      epsonAuth: printMethod === 'epson_api' ? epsonAuth : undefined,
      supportedSizes,
      borderCorrectionEnabled,
      shrinkPercent,
      verticalOffsetPx,
    })

    return NextResponse.json(printer, { status: 201 })
  } catch (error) {
    console.error('Error creating printer:', error)
    return NextResponse.json({ error: 'Failed to create printer' }, { status: 500 })
  }
}
